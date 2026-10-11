// Teste do WhatsApp de ponta a ponta SEM a Meta: um servidor local imita a Graph API (mesmos
// endereços, formatos e erros) e este script faz o papel da Meta mandando webhooks assinados.
//
// Uso: 1) rode este script uma vez com --env para ver as variáveis;
//      2) suba o site com elas (META_GRAPH_BASE aponta para o simulador);
//      3) node tests/e2e/whatsapp.mjs http://localhost:3006
import { createHmac } from "node:crypto";
import http from "node:http";

const BASE = (process.argv[2] ?? "http://localhost:3006").replace(/\/$/, "");
const MOCK_PORT = 4999;
const SECRET = "segredo-de-teste-do-app-meta";
const VERIFY = "token-de-verificacao-teste";
const PNID = "109876543210";
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.argv.includes("--env")) {
  console.log(`META_APP_SECRET=${SECRET}\nWHATSAPP_VERIFY_TOKEN=${VERIFY}\nMETA_GRAPH_BASE=http://localhost:${MOCK_PORT}`);
  process.exit(0);
}

async function check(id, title, fn) {
  try { const d = await fn(); results.push(true); console.log(`✅ ${id} ${title} — ${d}`); }
  catch (e) { results.push(false); console.log(`❌ ${id} ${title} — ${e.message}`); }
}

// ------------------------------------------------------------------ simulador da Graph API (Meta)
const sent = [];
let failNext = null;
const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const auth = req.headers.authorization ?? "";
    const reply = (status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (!auth.startsWith("Bearer ") || auth.length < 40) return reply(401, { error: { message: "Invalid OAuth access token.", code: 190 } });
    if (req.method === "GET" && url.pathname === `/v23.0/${PNID}`) return reply(200, { id: PNID, display_phone_number: "+55 63 99999-0000", verified_name: "Clínica Lumina (teste)", quality_rating: "GREEN" });
    if (req.method === "GET") return reply(400, { error: { message: "Unsupported get request.", code: 100 } });
    if (req.method === "POST" && url.pathname === `/v23.0/${PNID}/messages`) {
      const b = JSON.parse(body || "{}");
      if (b.status === "read") return reply(200, { success: true });
      if (failNext) { const f = failNext; failNext = null; return reply(400, { error: { message: f.message, code: f.code } }); }
      const id = `wamid.TESTE${sent.length + 1}`;
      sent.push({ to: b.to, text: b.text?.body, id });
      return reply(200, { messaging_product: "whatsapp", contacts: [{ input: b.to, wa_id: b.to }], messages: [{ id }] });
    }
    reply(404, { error: { message: "Unknown path", code: 100 } });
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, r));

// ------------------------------------------------------------------ ajudantes
let cookie = "";
async function api(path, body) {
  const res = await fetch(BASE + path, { method: body === undefined ? "GET" : "POST", headers: { ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: BASE }), ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const sign = (raw, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
async function webhook(payload, signature) {
  const raw = JSON.stringify(payload);
  const res = await fetch(`${BASE}/api/webhooks/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature ?? sign(raw) }, body: raw });
  return res.status;
}
const message = (from, text, id, name = "Cliente Teste", pnid = PNID, type = "text") => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "5563999990000", phone_number_id: pnid }, contacts: [{ profile: { name }, wa_id: from }], messages: [type === "text" ? { from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } } : { from, id, timestamp: "1", type, [type]: { id: "media1", mime_type: "audio/ogg" } }] } }] }],
});
const status = (id, st, error) => ({ object: "whatsapp_business_account", entry: [{ id: "WABA1", changes: [{ field: "messages", value: { metadata: { phone_number_id: PNID }, statuses: [{ id, status: st, timestamp: "1", recipient_id: "5563999990001", ...(error ? { errors: [error] } : {}) }] } }] }] });
const conv = async (phoneDigits) => (await api("/api/state")).json.data.conversations.find((c) => c.phone.replace(/\D/g, "") === phoneDigits);

// ------------------------------------------------------------------ testes
await check("WA-01", "verificação do webhook (GET hub.challenge)", async () => {
  const bad = await fetch(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=123`);
  const ok = await fetch(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=987654`);
  assert(bad.status === 403, `token errado ${bad.status}`);
  assert(ok.status === 200 && (await ok.text()) === "987654", "não devolveu o challenge");
  return "token errado 403; certo devolve o challenge";
});

await check("WA-02", "conexão manual: token validado na 'Meta' e guardado cifrado", async () => {
  await api("/api/auth/login", { email: "mariana@lumina.com.br", password: "demo123" });
  const bad = await api("/api/whatsapp/manual", { phoneNumberId: PNID, token: "curto" });
  assert(bad.status === 422, `token curto ${bad.status}`);
  const wrong = await api("/api/whatsapp/manual", { phoneNumberId: "555555555", token: "x".repeat(40) });
  assert(wrong.status === 422 && /Meta recusou/.test(wrong.json.error), `número inexistente ${wrong.status}`);
  const r = await api("/api/whatsapp/manual", { phoneNumberId: PNID, wabaId: "777", token: "EAAteste" + "x".repeat(60) });
  assert(r.status === 200, `conectar ${r.status} ${r.json.error ?? ""}`);
  const wa = r.json.data.workspaces[0].whatsapp;
  assert(wa.mode === "manual" && wa.phoneNumberId === PNID && wa.status === "connected", "conexão não registrada");
  assert(!JSON.stringify(r.json).includes("EAAteste"), "token voltou para o navegador!");
  return `${wa.phone} · ${wa.displayName} · token não aparece no navegador`;
});

await check("WA-03", "webhook sem assinatura ou com assinatura errada é recusado", async () => {
  const p = message("5563999990001", "Oi", "wamid.FALSO1");
  const none = await fetch(`${BASE}/api/webhooks/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
  const wrong = await webhook(p, sign(JSON.stringify(p), "outro-segredo"));
  assert(none.status === 401 && wrong === 401, `sem ${none.status}, errada ${wrong}`);
  assert(!(await conv("5563999990001")), "mensagem falsa entrou");
  return "sem assinatura 401; assinatura errada 401; nada gravado";
});

let botWamid = "";
await check("WA-04", "mensagem real: conversa nova, IA responde e envia pela API", async () => {
  sent.length = 0;
  assert((await webhook(message("5563999990001", "Quanto custa a avaliação?", "wamid.IN1"))) === 200, "webhook não aceitou");
  const c = await conv("5563999990001");
  assert(c && c.contactName === "Cliente Teste" && c.phone === "+55 63 99999-0001", "conversa não criada");
  const bot = c.messages.find((m) => m.from === "bot");
  assert(bot && /R\$ 120/.test(bot.text), "IA não respondeu com a base");
  assert(sent.length === 1 && sent[0].to === "5563999990001" && sent[0].text === bot.text, `envio à API: ${JSON.stringify(sent)}`);
  assert(bot.status === "sent" && bot.externalId === sent[0].id, `status ${bot.status}`);
  botWamid = bot.externalId;
  return `resposta "${bot.text.slice(0, 50)}…" enviada (${bot.externalId})`;
});

await check("WA-05", "notificação repetida não duplica (mesmo wamid)", async () => {
  await webhook(message("5563999990001", "Quanto custa a avaliação?", "wamid.IN1"));
  const c = await conv("5563999990001");
  assert(c.messages.filter((m) => m.from === "customer").length === 1 && sent.length === 1, "duplicou");
  return "1 mensagem, 1 envio";
});

await check("WA-06", "status de entrega: entregue e lida (nunca volta para trás)", async () => {
  await webhook(status(botWamid, "delivered"));
  await webhook(status(botWamid, "read"));
  await webhook(status(botWamid, "delivered")); // chega fora de ordem
  const bot = (await conv("5563999990001")).messages.find((m) => m.externalId === botWamid);
  assert(bot.status === "read", `status ${bot.status}`);
  return "sent → delivered → read (fora de ordem ignorado)";
});

await check("WA-07", "cliente pede atendente: transferência; equipe responde pela API", async () => {
  await webhook(message("5563999990001", "quero falar com um atendente", "wamid.IN2"));
  let c = await conv("5563999990001");
  assert(c.status === "waiting" || /fora do horário/i.test(JSON.stringify(c.messages)), `status ${c.status}`);
  const t = await api("/api/command", { name: "takeOver", args: [c.id], ids: [] });
  assert(t.status === 200, `assumir ${t.status}`);
  const before = sent.length;
  const r = await api("/api/command", { name: "sendAgentMessage", args: [c.id, "Oi! Aqui é a Carla, posso ajudar?"], ids: ["zzteste00001"] });
  assert(r.status === 200, `enviar ${r.status} ${r.json.error ?? ""}`);
  assert(sent.length === before + 1 && sent.at(-1).text === "Oi! Aqui é a Carla, posso ajudar?", "mensagem da equipe não foi à API");
  c = await conv("5563999990001");
  assert(c.messages.at(-1).status === "sent", `status ${c.messages.at(-1).status}`);
  return "transferida; equipe assumiu e a resposta foi enviada";
});

await check("WA-08", "falha da Meta (fora das 24 h) aparece na mensagem e no painel", async () => {
  const c = await conv("5563999990001");
  failNext = { code: 131047, message: "Re-engagement message" };
  await api("/api/command", { name: "sendAgentMessage", args: [c.id, "Mensagem que vai falhar"], ids: ["zzteste00002"] });
  const after = await conv("5563999990001");
  const m = after.messages.at(-1);
  const ws = (await api("/api/state")).json.data.workspaces[0];
  assert(m.status === "failed" && /24 h/.test(m.error), `status ${m.status} ${m.error}`);
  assert(/24 h/.test(ws.whatsapp.lastError ?? ""), "erro não registrado na empresa");
  return `“${m.error}”`;
});

await check("WA-09", "mídia e números desconhecidos", async () => {
  sent.length = 0;
  await webhook(message("5563999990002", "", "wamid.AUDIO1", "Ana Áudio", PNID, "audio"));
  const c = await conv("5563999990002");
  assert(c && /Áudio recebido/.test(c.messages[0].text), "áudio não virou aviso");
  const other = await webhook(message("5563999990003", "Oi", "wamid.OUTRO1", "X", "000000000"));
  assert(other === 200 && !(await conv("5563999990003")), "número de outra conta não deveria criar conversa");
  return "áudio vira aviso para a equipe; número de outra conta é ignorado";
});

await check("WA-10", "desconectar apaga o token", async () => {
  const r = await api("/api/whatsapp/disconnect", {});
  assert(r.status === 200 && r.json.data.workspaces[0].whatsapp.status === "disconnected", "não desconectou");
  sent.length = 0;
  await webhook(message("5563999990001", "Ainda está aí?", "wamid.IN9"));
  assert(sent.length === 0, "enviou depois de desconectar");
  return "desconectado; mensagens novas não são enviadas";
});

mock.close();
const ok = results.filter(Boolean).length;
console.log(`\nResultado: ${ok}/${results.length} verificações do WhatsApp aprovadas`);
process.exit(ok === results.length ? 0 : 1);
