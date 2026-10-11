// Segurança da API: o que cada perfil vê e o que o servidor recusa (sem passar pelas telas).
// Uso: com o site rodando →  node tests/e2e/api-security.mjs [baseUrl]
const BASE = (process.argv[2] ?? "http://localhost:3006").replace(/\/$/, "");
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
async function check(id, title, fn) {
  try { const d = await fn(); results.push(true); console.log(`✅ ${id} ${title} — ${d}`); }
  catch (e) { results.push(false); console.log(`❌ ${id} ${title} — ${e.message}`); }
}
function session() {
  let cookie = "";
  const call = async (path, body, headers = {}) => {
    const res = await fetch(BASE + path, { method: body === undefined ? "GET" : "POST", headers: { ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: BASE }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };
  return { call, login: (email, password = "demo123") => call("/api/auth/login", { email, password }) };
}
const cmd = (s, name, args) => s.call("/api/command", { name, args, ids: [] });

const lumina = session();
const aurora = session();
const admin = session();

await check("API-01", "visitante vê só os planos", async () => {
  const { json } = await session().call("/api/state");
  const d = json.data;
  assert(d.plans.length === 3 && !d.workspaces.length && !d.users.length && !d.conversations.length && !d.invoices.length, "dados privados para visitante");
  return "3 planos; nenhuma empresa, usuário, conversa ou fatura";
});

await check("API-02", "login: senha errada recusada; sessão HttpOnly", async () => {
  assert((await session().login("mariana@lumina.com.br", "errada123")).status === 401, "senha errada aceita");
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ email: "mariana@lumina.com.br", password: "demo123" }) });
  const c = res.headers.get("set-cookie") ?? "";
  assert(/HttpOnly/i.test(c) && /SameSite=lax/i.test(c), "cookie sem proteção");
  for (const [s, e] of [[lumina, "mariana@lumina.com.br"], [aurora, "rodrigo@auroralabs.com"], [admin, "admin@nuvio.com.br"]]) assert((await s.login(e)).status === 200, `login ${e}`);
  return "401 com senha errada; cookie HttpOnly + SameSite=Lax";
});

await check("API-03", "cada empresa vê só os próprios dados; ninguém recebe hash", async () => {
  const a = (await lumina.call("/api/state")).json.data;
  const b = (await aurora.call("/api/state")).json.data;
  assert(a.workspaces.length === 1 && a.workspaces[0].id === "w-lumina", "Lumina vê outras empresas");
  assert(b.workspaces.length === 1 && b.workspaces[0].id === "w-aurora" && !b.conversations.some((c) => c.workspaceId === "w-lumina"), "Aurora vê dados da Lumina");
  assert(a.users.length === 1 && a.users[0].passwordHash === "", "usuários/hash expostos");
  return `Lumina: ${a.conversations.length} conversas, ${a.knowledge.length} conteúdos; Aurora não vê nada da Lumina`;
});

await check("API-04", "backoffice vê empresas e faturas, mas não as conversas dos clientes finais", async () => {
  const d = (await admin.call("/api/state")).json.data;
  assert(d.workspaces.length >= 12 && d.invoices.length > 0, "backoffice sem dados");
  assert(d.conversations.length === 0 && d.knowledge.length === 0, "backoffice recebe conversas/base");
  assert(d.users.every((u) => u.passwordHash === ""), "hash exposto");
  return `${d.workspaces.length} empresas; 0 conversas (privacidade); sem hash`;
});

await check("API-05", "ações em dados de outra empresa ou fora do perfil são recusadas", async () => {
  const conv = (await lumina.call("/api/state")).json.data.conversations[0];
  const k = (await lumina.call("/api/state")).json.data.knowledge[0];
  const tries = [
    [aurora, "takeOver", [conv.id]],
    [aurora, "resolve", [conv.id]],
    [aurora, "removeKnowledge", [k.id]],
    [aurora, "updateAssistant", ["w-lumina", { name: "Hacker" }]],
    [aurora, "changePlan", ["w-lumina", "essencial"]],
    [lumina, "setWorkspaceStatus", ["w-aurora", "suspended"]],
    [lumina, "updatePlan", ["escala", { price: 1, conversations: 100, numbers: 1, knowledgeLimit: null, description: "x" }]],
    [lumina, "payInvoice", ["inv-w-aurora-next"]],
  ];
  for (const [s, name, args] of tries) {
    const r = await cmd(s, name, args);
    assert(r.status === 422 && /não permitida/.test(r.json.error ?? ""), `${name} não recusada (${r.status} ${r.json.error})`);
  }
  assert((await cmd(session(), "resolve", [conv.id])).status === 401, "sem login aceito");
  assert((await cmd(lumina, "constructor", [])).status === 400, "ação inexistente aceita");
  const real = (await lumina.call("/api/state")).json.data.conversations.find((c) => c.id === conv.id);
  assert(real.status === conv.status, "conversa foi alterada");
  return `${tries.length} tentativas recusadas (422); sem login 401; ação inexistente 400`;
});

await check("API-06", "CSRF: alterações só a partir do próprio site", async () => {
  const none = await fetch(`${BASE}/api/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const evil = await fetch(`${BASE}/api/command`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://site-malicioso.com" }, body: "{}" });
  assert(none.status === 403 && evil.status === 403, `${none.status}/${evil.status}`);
  return "sem origem 403; outro site 403";
});

await check("API-07", "simular mensagens só em conversas de demonstração; integrações sem chaves ficam fechadas", async () => {
  const wa = await lumina.call("/api/whatsapp/manual", { phoneNumberId: "123456789", token: "x".repeat(40) });
  const hook = await fetch(`${BASE}/api/webhooks/whatsapp`, { method: "POST", body: "{}" });
  assert(wa.status === 404 && hook.status === 404, `whatsapp ${wa.status}, webhook ${hook.status}`);
  return "sem chaves da Meta: conexão real e webhook respondem 404";
});

const ok = results.filter(Boolean).length;
console.log(`\nResultado: ${ok}/${results.length} verificações aprovadas`);
process.exit(ok === results.length ? 0 : 1);
