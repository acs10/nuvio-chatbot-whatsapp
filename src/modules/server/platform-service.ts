import "server-only";
import { ID_PATTERN, withIdSource } from "@/core/lib/ids";
import type { PlatformData, Role, User } from "@/modules/domain/types";
import { createDemoData } from "@/modules/platform/demo-data";
import { PlatformStore } from "@/modules/platform/platform-store";
import { DOC_COLLECTIONS, getBackend, type Stored, type Write } from "./backend";
import { hashPassword } from "./secrets";

/**
 * Acesso aos dados da Nuvio no servidor (mesmo desenho do KreativeArt):
 *  - leitura: 1 leitura do documento de versão por requisição; recarrega tudo só se outra instância gravou;
 *  - gravação: a ação roda com as mesmas regras do PlatformStore; só os documentos alterados são
 *    gravados, numa transação que confere a versão (sem sobrescrever ninguém).
 */
type Seq = { _seq?: number };
export interface Actor {
  id: string;
  name: string;
  role: Role;
  workspaceId?: string;
}

const globalCache = globalThis as unknown as { __nvCache?: Stored | null };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function sortData(data: PlatformData) {
  const seq = (d: unknown) => (d as Seq)._seq ?? 0;
  for (const c of DOC_COLLECTIONS) (data[c] as unknown[]).sort((a, b) => seq(a) - seq(b));
}

function assignSeq(data: PlatformData) {
  const base = Date.now() * 1000;
  for (const c of DOC_COLLECTIONS) (data[c] as Seq[]).forEach((d, i) => d._seq === undefined && (d._seq = base + i));
}

/** Documentos que mudaram entre duas versões dos dados. */
export function diff(before: PlatformData, after: PlatformData): Write[] {
  const writes: Write[] = [];
  for (const c of DOC_COLLECTIONS) {
    const old = new Map((before[c] as { id: string }[]).map((d) => [d.id, JSON.stringify(d)]));
    const seen = new Set<string>();
    for (const d of after[c] as unknown as { id: string }[]) {
      seen.add(d.id);
      if (old.get(d.id) !== JSON.stringify(d)) writes.push({ collection: c, id: d.id, doc: d as unknown as Record<string, unknown> });
    }
    for (const id of old.keys()) if (!seen.has(id)) writes.push({ collection: c, id, doc: null });
  }
  return writes;
}

const DEMO_PASSWORD = "demo123";

export async function demoData(): Promise<PlatformData> {
  const data = createDemoData();
  const hash = await hashPassword(DEMO_PASSWORD);
  for (const u of data.users) u.passwordHash = hash;
  // Conversas da demonstração nunca são enviadas pelo WhatsApp real.
  for (const c of data.conversations) c.demo = true;
  for (const w of data.workspaces) if (w.whatsapp.status === "connected") w.whatsapp.mode = "demo";
  assignSeq(data);
  return data;
}

export async function resetToDemo(): Promise<void> {
  const data = await demoData();
  await getBackend().replaceAll(clone(data));
  globalCache.__nvCache = { version: 1, data };
}

async function current(force = false): Promise<Stored> {
  const backend = getBackend();
  const version = await backend.readVersion();
  if (version === null) {
    await resetToDemo();
    return globalCache.__nvCache!;
  }
  const cached = globalCache.__nvCache;
  if (!force && cached && cached.version === version) return cached;
  const stored = await backend.loadAll();
  sortData(stored.data);
  globalCache.__nvCache = stored;
  return stored;
}

export function actorOf(users: User[], userId: string | null | undefined, data?: Pick<PlatformData, "workspaces">): Actor | null {
  const u = users.find((x) => x.id === userId);
  if (!u) return null;
  const ws = data?.workspaces.find((w) => w.id === u.workspaceId);
  if (u.role === "client" && ws?.status === "suspended") return null;
  return { id: u.id, name: u.name, role: u.role, workspaceId: u.workspaceId };
}

export class ConflictError extends Error {}

/** Store do servidor: sem resposta automática (a IA responde depois, de forma assíncrona). */
function serverStore(data: PlatformData, userId?: string | null) {
  const s = new PlatformStore(data);
  s.autoReply = false;
  s.setHydrated(userId ?? null);
  return s;
}

/**
 * Executa uma alteração. `ids`: os ids gerados no navegador para a mesma ação (aceitos só se
 * tiverem o formato certo e ainda não existirem). `discard` = não grava (ação recusada).
 */
export async function mutate<T>(fn: (s: PlatformStore, data: PlatformData) => T, options: { ids?: unknown[]; userId?: string | null; discard?: (result: T) => boolean } = {}): Promise<{ result: T; data: PlatformData }> {
  const backend = getBackend();
  for (let attempt = 0; attempt < 4; attempt++) {
    const base = await current(attempt > 0);
    const s = serverStore(clone(base.data), options.userId);
    s.tick();
    const existing = new Set(DOC_COLLECTIONS.flatMap((c) => (base.data[c] as { id: string }[]).map((d) => d.id)));
    const queue = (options.ids ?? []).filter((id): id is string => typeof id === "string" && ID_PATTERN.test(id) && !existing.has(id)).slice(0, 200);
    const result = withIdSource(() => queue.shift(), () => fn(s, base.data));
    if (options.discard?.(result)) return { result, data: base.data };
    const next = clone(s.snapshot);
    assignSeq(next);
    const writes = diff(base.data, next);
    const metaChanged = JSON.stringify(base.data.settings) !== JSON.stringify(next.settings) || JSON.stringify(base.data.mrrHistory) !== JSON.stringify(next.mrrHistory);
    if (!writes.length && !metaChanged) return { result, data: base.data };
    if (await backend.commit(base.version, writes, { settings: next.settings, mrrHistory: next.mrrHistory })) {
      sortData(next);
      globalCache.__nvCache = { version: base.version + 1, data: next };
      return { result, data: next };
    }
  }
  throw new ConflictError("Muitas alterações ao mesmo tempo. Tente de novo.");
}

export async function readData(): Promise<PlatformData> {
  return (await mutate(() => null)).data;
}

export const storeKind = () => getBackend().kind;
