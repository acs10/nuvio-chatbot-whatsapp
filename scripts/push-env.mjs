// Envia as variáveis de produção para o site no Netlify SEM mostrar os valores: npm run env:push
// Lê .env.local (SESSION_SECRET, VAULT_KEY e, se existirem, as chaves da Meta e da Anthropic) e o
// firebase-service-account.json (vira FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY,
// que cabem no limite de 4 KB das funções). Grava num arquivo temporário, importa e apaga o arquivo.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

if (!existsSync(".netlify/state.json")) {
  console.error("✗ Pasta ainda não ligada a um site do Netlify. Rode antes:  npx netlify-cli sites:create --name nuvio");
  process.exit(1);
}

const ALLOWED = ["SESSION_SECRET", "VAULT_KEY", "META_APP_ID", "META_APP_SECRET", "META_CONFIG_ID", "WHATSAPP_VERIFY_TOKEN", "META_GRAPH_VERSION", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"];
const vars = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && ALLOWED.includes(m[1]) && m[2]) vars[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
if (existsSync("firebase-service-account.json")) {
  const sa = JSON.parse(readFileSync("firebase-service-account.json", "utf8"));
  vars.FIREBASE_PROJECT_ID = sa.project_id;
  vars.FIREBASE_CLIENT_EMAIL = sa.client_email;
  vars.FIREBASE_PRIVATE_KEY = sa.private_key.replace(/\n/g, "\\n");
}
for (const required of ["SESSION_SECRET", "VAULT_KEY", "FIREBASE_PRIVATE_KEY"]) {
  if (!vars[required]) {
    console.error(`✗ Falta ${required}. Rode  npm run db:setup  e confira o firebase-service-account.json.`);
    process.exit(1);
  }
}

const dir = mkdtempSync(path.join(os.tmpdir(), "nuvio-env-"));
const file = path.join(dir, ".env");
try {
  writeFileSync(file, Object.entries(vars).map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`).join("\n") + "\n", { mode: 0o600 });
  const r = spawnSync("npx", ["netlify-cli", "env:import", `"${file}"`], { encoding: "utf8", shell: true });
  if (r.status !== 0) {
    console.error("✗ Não foi possível enviar as variáveis (confira o login: npx netlify-cli login).");
    process.exitCode = 1;
  } else console.log(`✔ Variáveis enviadas (valores não exibidos): ${Object.keys(vars).join(", ")}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
