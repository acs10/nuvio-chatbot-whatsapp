import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/** Nomes das coleções do Firestore (o equivalente às "tabelas"). */
export const COLLECTIONS = {
  plans: "plans",
  workspaces: "workspaces",
  knowledge: "knowledge",
  conversations: "conversations",
  invoices: "invoices",
  users: "users",
  /** Documento "state": configurações da plataforma, histórico de MRR e versão dos dados */
  meta: "meta",
  /** Dados só do servidor, cifrados (tokens do WhatsApp de cada empresa) */
  private: "private",
} as const;

/**
 * Credencial do Admin SDK:
 *  - produção (Netlify): FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (cabe no limite
 *    de 4 KB de variáveis das funções) ou FIREBASE_SERVICE_ACCOUNT com o JSON inteiro (texto ou base64);
 *  - desenvolvimento: arquivo firebase-service-account.json na raiz do projeto (fora do git).
 */
function credentials(): ServiceAccount {
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env;
  if (projectId && clientEmail && key) {
    // A chave costuma ser colada com "\n" escritos no lugar das quebras de linha.
    return { projectId, clientEmail, privateKey: key.replace(/\\n/g, "\n") };
  }
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (fromEnv) {
    const json = fromEnv.startsWith("{") ? fromEnv : Buffer.from(fromEnv, "base64").toString("utf8");
    return JSON.parse(json) as ServiceAccount;
  }
  const file = path.join(process.cwd(), "firebase-service-account.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as ServiceAccount;
  throw new Error("Credencial do Firebase não encontrada (FIREBASE_SERVICE_ACCOUNT ou firebase-service-account.json).");
}

export const hasFirebaseCredentials = () =>
  !!(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || existsSync(path.join(process.cwd(), "firebase-service-account.json")));

let db: Firestore | undefined;

export function firestore(): Firestore {
  if (db) return db;
  const app = getApps()[0] ?? initializeApp({ credential: cert(credentials()) });
  db = getFirestore(app);
  try {
    // O Firestore recusa campos `undefined`; com isso eles são simplesmente omitidos.
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // já configurado (recarregamento em desenvolvimento)
  }
  return db;
}
