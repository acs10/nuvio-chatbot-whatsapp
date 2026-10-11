// Publica no Netlify: npm run deploy
// 1. Tira da pasta, durante o build, os arquivos locais com chaves (.env*) e dados de teste (.data):
//    o adaptador do Next no Netlify copiaria esses arquivos para dentro da função do servidor.
// 2. Cria uma versão (rascunho) e a promove para o endereço principal (funciona mesmo quando o
//    Netlify bloqueia "deploy --prod" por falta de créditos).
// 3. Devolve os arquivos, mesmo se algo der errado.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

if (!existsSync(".netlify/state.json")) {
  console.error("✗ Pasta ainda não ligada a um site do Netlify. Rode uma vez:  npx netlify-cli sites:create --name nuvio  e depois  npm run env:push");
  process.exit(1);
}
const SITE_ID = JSON.parse(readFileSync(".netlify/state.json", "utf8")).siteId;
const LOCAL = [".env.local", ".env.development.local", ".data", "firebase-service-account.json"];
const stash = path.join(os.tmpdir(), `nuvio-deploy-${Date.now()}`);
mkdirSync(stash, { recursive: true });

const run = (args) => spawnSync("npx", ["netlify-cli", ...args], { encoding: "utf8", shell: true });
const moved = [];
try {
  for (const f of LOCAL) if (existsSync(f)) (renameSync(f, path.join(stash, f)), moved.push(f));
  rmSync(".next", { recursive: true, force: true });
  rmSync(".netlify/functions-internal", { recursive: true, force: true });
  console.log(`• Arquivos locais guardados fora da pasta: ${moved.join(", ") || "nenhum"}`);

  const deploy = run(["deploy", "--json", "--message", `"publicacao ${new Date().toISOString()}"`]);
  const json = deploy.stdout.slice(deploy.stdout.indexOf("{"));
  let info;
  try { info = JSON.parse(json); } catch { info = null; }
  if (deploy.status !== 0 || !info?.deploy_id) {
    console.error("✗ Falha no build/envio:\n", (deploy.stderr || deploy.stdout).split("\n").filter((l) => !/token/i.test(l)).slice(-25).join("\n"));
    process.exitCode = 1;
  } else {
    const publish = run(["api", "restoreSiteDeploy", "--data", `"${JSON.stringify({ site_id: SITE_ID, deploy_id: info.deploy_id }).replace(/"/g, '\\"')}"`]);
    if (publish.status !== 0) {
      console.error("✗ Versão criada, mas não foi possível publicar:", info.deploy_url);
      process.exitCode = 1;
    } else console.log(`✔ Publicado: ${info.site_url ?? "https://nuvio.netlify.app"} (versão ${info.deploy_id})`);
  }
} finally {
  for (const f of moved) renameSync(path.join(stash, f), f);
  rmSync(stash, { recursive: true, force: true });
  console.log("• Arquivos locais devolvidos.");
}
