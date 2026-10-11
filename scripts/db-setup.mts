/**
 * Prepara o banco: cria as chaves do servidor em .env.local (se faltarem) e grava os dados
 * demonstrativos no Firestore (~150 gravações — não rode toda hora no plano gratuito).
 * Uso: npm run db:setup
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV = ".env.local";

function ensureKeys() {
  const current = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
  const missing = ["SESSION_SECRET", "VAULT_KEY"].filter((k) => !new RegExp(`^${k}=.{32,}`, "m").test(current));
  if (!missing.length) return console.log("• Chaves do servidor: já existem em .env.local");
  const lines = missing.map((k) => `${k}=${randomBytes(32).toString("base64url")}`);
  writeFileSync(ENV, `${current}${current && !current.endsWith("\n") ? "\n" : ""}${lines.join("\n")}\n`);
  console.log(`• Chaves do servidor criadas em .env.local: ${missing.join(", ")} (valores não exibidos)`);
}

ensureKeys();
process.loadEnvFile(ENV);
process.env.DATA_STORE ??= "firestore";

const { resetToDemo, storeKind } = await import("../src/modules/server/platform-service.ts");
const { getBackend } = await import("../src/modules/server/backend.ts");

console.log(`• Banco: ${storeKind()}`);
await resetToDemo();
const { data } = await getBackend().loadAll();
console.log(
  `• Dados demonstrativos gravados: ${data.users.length} usuários, ${data.workspaces.length} empresas, ${data.plans.length} planos, ` +
    `${data.conversations.length} conversas, ${data.knowledge.length} conteúdos, ${data.invoices.length} faturas`,
);
process.exit(0);
