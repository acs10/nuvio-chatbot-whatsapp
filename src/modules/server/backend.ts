import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PlatformData } from "@/modules/domain/types";
import { COLLECTIONS, firestore, hasFirebaseCredentials } from "./firestore";

/** Coleções com um documento por registro (o resto fica no documento meta/state). */
export const DOC_COLLECTIONS = ["plans", "workspaces", "knowledge", "conversations", "invoices", "users"] as const;
export type DocCollection = (typeof DOC_COLLECTIONS)[number];

export interface Write {
  collection: DocCollection;
  id: string;
  /** null = apagar */
  doc: Record<string, unknown> | null;
}

export interface Meta {
  settings: PlatformData["settings"];
  mrrHistory: PlatformData["mrrHistory"];
}

export interface Stored {
  version: number;
  data: PlatformData;
}

/**
 * Onde os dados ficam. "firestore" (padrão quando há credencial) ou "file" (.data/nuvio.json,
 * para desenvolver e testar sem gastar a cota gratuita do Firebase). Força com DATA_STORE=file|firestore.
 */
export interface Backend {
  readonly kind: "firestore" | "file";
  /** Versão atual dos dados (1 leitura) ou null se o banco ainda está vazio. */
  readVersion(): Promise<number | null>;
  loadAll(): Promise<Stored>;
  /** Grava se a versão não mudou desde `baseVersion`; false = outra gravação chegou antes. */
  commit(baseVersion: number, writes: Write[], meta: Meta): Promise<boolean>;
  /** Apaga tudo e grava os dados informados (versão 1). */
  replaceAll(data: PlatformData): Promise<void>;
  /** Documentos só do servidor (ex.: tokens do Mercado Pago dos designers), fora dos dados da plataforma. */
  getPrivate(id: string): Promise<Record<string, unknown> | null>;
  setPrivate(id: string, doc: Record<string, unknown> | null): Promise<void>;
}

// ------------------------------------------------------------------ Firestore

class FirestoreBackend implements Backend {
  readonly kind = "firestore" as const;
  private get db() {
    return firestore();
  }
  private get metaRef() {
    return this.db.collection(COLLECTIONS.meta).doc("state");
  }

  async readVersion() {
    const snap = await this.metaRef.get();
    return snap.exists ? Number(snap.get("version") ?? 0) : null;
  }

  async loadAll(): Promise<Stored> {
    const [meta, ...lists] = await Promise.all([this.metaRef.get(), ...DOC_COLLECTIONS.map((c) => this.db.collection(c).get())]);
    const data = Object.fromEntries(DOC_COLLECTIONS.map((c, i) => [c, lists[i].docs.map((d) => ({ ...d.data(), id: d.id }))])) as unknown as PlatformData;
    data.settings = meta.get("settings") as PlatformData["settings"];
    data.mrrHistory = (meta.get("mrrHistory") ?? []) as PlatformData["mrrHistory"];
    return { version: Number(meta.get("version") ?? 0), data };
  }

  async commit(baseVersion: number, writes: Write[], meta: Meta) {
    return this.db.runTransaction(async (tx) => {
      const current = await tx.get(this.metaRef);
      if (Number(current.get("version") ?? 0) !== baseVersion) return false;
      for (const w of writes) {
        const ref = this.db.collection(w.collection).doc(w.id);
        if (w.doc) tx.set(ref, w.doc);
        else tx.delete(ref);
      }
      tx.set(this.metaRef, { ...meta, version: baseVersion + 1, updatedAt: new Date().toISOString() });
      return true;
    });
  }

  async replaceAll(data: PlatformData) {
    const db = this.db;
    for (const c of DOC_COLLECTIONS) {
      for (;;) {
        const snap = await db.collection(c).limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    const docs = DOC_COLLECTIONS.flatMap((c) => (data[c] as { id: string }[]).map((d) => ({ c, d })));
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      for (const { c, d } of docs.slice(i, i + 400)) batch.set(db.collection(c).doc(d.id), d);
      await batch.commit();
    }
    await this.metaRef.set({ settings: data.settings, mrrHistory: data.mrrHistory, version: 1, updatedAt: new Date().toISOString() });
  }

  async getPrivate(id: string) {
    const snap = await this.db.collection(COLLECTIONS.private).doc(id).get();
    return snap.exists ? (snap.data() as Record<string, unknown>) : null;
  }
  async setPrivate(id: string, doc: Record<string, unknown> | null) {
    const ref = this.db.collection(COLLECTIONS.private).doc(id);
    if (doc) await ref.set(doc);
    else await ref.delete();
  }
}

// ------------------------------------------------------------------ arquivo local

class FileBackend implements Backend {
  readonly kind = "file" as const;
  private file = path.join(process.cwd(), ".data", "nuvio.json");

  private read(): Stored | null {
    if (!existsSync(this.file)) return null;
    return JSON.parse(readFileSync(this.file, "utf8")) as Stored;
  }
  private write(stored: Stored) {
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(`${this.file}.tmp`, JSON.stringify(stored));
    renameSync(`${this.file}.tmp`, this.file);
  }

  async readVersion() {
    return this.read()?.version ?? null;
  }
  async loadAll() {
    const stored = this.read();
    if (!stored) throw new Error("Banco local vazio.");
    return stored;
  }
  async commit(baseVersion: number, writes: Write[], meta: Meta) {
    const stored = this.read();
    if (!stored || stored.version !== baseVersion) return false;
    for (const w of writes) {
      const list = stored.data[w.collection] as unknown as Record<string, unknown>[];
      const i = list.findIndex((d) => d.id === w.id);
      if (w.doc && i >= 0) list[i] = w.doc;
      else if (w.doc) list.push(w.doc);
      else if (i >= 0) list.splice(i, 1);
    }
    Object.assign(stored.data, meta);
    this.write({ version: baseVersion + 1, data: stored.data });
    return true;
  }
  async replaceAll(data: PlatformData) {
    this.write({ version: 1, data });
  }

  private privateFile = path.join(process.cwd(), ".data", "private.json");
  private readPrivate(): Record<string, Record<string, unknown>> {
    return existsSync(this.privateFile) ? (JSON.parse(readFileSync(this.privateFile, "utf8")) as Record<string, Record<string, unknown>>) : {};
  }
  async getPrivate(id: string) {
    return this.readPrivate()[id] ?? null;
  }
  async setPrivate(id: string, doc: Record<string, unknown> | null) {
    const all = this.readPrivate();
    if (doc) all[id] = doc;
    else delete all[id];
    mkdirSync(path.dirname(this.privateFile), { recursive: true });
    writeFileSync(this.privateFile, JSON.stringify(all));
  }
}

let backend: Backend | undefined;

export function getBackend(): Backend {
  if (backend) return backend;
  const forced = process.env.DATA_STORE;
  const useFirestore = forced ? forced === "firestore" : hasFirebaseCredentials();
  backend = useFirestore ? new FirestoreBackend() : new FileBackend();
  return backend;
}
