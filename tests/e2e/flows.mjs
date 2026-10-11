// Fluxos completos com navegador real (Chrome + puppeteer-core), como um usuário faria.
// Uso: com `npx next dev -p 3006` rodando →  node tests/e2e/flows.mjs [baseUrl]
import puppeteer from "puppeteer-core";

const BASE = (process.argv[2] ?? "http://localhost:3006").replace(/\/$/, "");
const results = [];
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
page.on("dialog", (d) => void d.accept()); // confirmações ("Suspender…?")

async function step(id, title, fn) {
  try { const d = await fn(); results.push(true); console.log(`✅ ${id} ${title}${d ? ` — ${d}` : ""}`); }
  catch (e) { results.push(false); console.log(`❌ ${id} ${title} — ${e.message}`); await page.screenshot({ path: `tests/e2e/fail-${id}.png` }).catch(() => {}); }
}
const text = () => page.evaluate(() => document.body.innerText.replace(/ /g, " "));
const go = async (p) => { await page.goto(BASE + p, { waitUntil: "networkidle0" }); await sleep(300); };
const waitText = (t, timeout = 8000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
async function click(label, tag = "button") {
  for (let i = 0; i < 20; i++) {
    const all = await page.$$(`xpath/.//${tag}[contains(normalize-space(.), ${JSON.stringify(label)})]`);
    for (const el of all) if (await el.evaluate((n) => n.getClientRects().length > 0 && !n.disabled)) { await el.evaluate((n) => n.scrollIntoView({ block: "center" })); await el.click(); await sleep(250); return; }
    await sleep(200);
  }
  throw new Error(`não achei "${label}"`);
}
/** Preenche o campo pelo rótulo (<label class="field"><span>Rótulo</span><input/>). */
async function fill(label, value) {
  const [input] = await page.$$(`xpath/.//label[span[starts-with(normalize-space(.), ${JSON.stringify(label)})]]//*[self::input or self::textarea or self::select]`);
  assert(input, `campo "${label}" não encontrado`);
  const tag = await input.evaluate((n) => n.tagName);
  if (tag === "SELECT") return void (await input.select(String(value)));
  await input.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await input.type(String(value));
}

const EMAIL = `joana.${Date.now()}@paoquente.com.br`;
const PASSWORD = "SenhaForte123";

await step("F-01", "cadastro em 4 etapas cria a empresa em teste grátis", async () => {
  await go("/comecar");
  await click("Continuar");
  assert((await text()).includes("Informe o nome da empresa."), "validação da etapa 1 não apareceu");
  await fill("Nome da empresa", "Padaria Pão Quente");
  await fill("Seu nome", "Joana Dias");
  await fill("E-mail profissional", EMAIL);
  await fill("Crie uma senha", PASSWORD);
  await click("Continuar");
  await waitText("Escolha o plano ideal");
  await click("Essencial", "label");
  await click("Continuar");
  await fill("Nome do assistente", "Pãozinho");
  await fill("Principal objetivo", "Responder sobre encomendas, horários e entregas da padaria.");
  await click("Continuar");
  await waitText("Prepare sua conexão");
  await click("Criar meu espaço");
  assert((await text()).includes("É preciso aceitar os termos"), "não exigiu aceitar os termos");
  await page.click(".check-field > span");
  await click("Criar meu espaço");
  await waitText("Seu espaço foi criado!");
  await click("Acessar meu painel");
  await page.waitForFunction(() => location.pathname === "/painel", { timeout: 10000 });
  await waitText("Teste grátis até");
  const t = await text();
  assert(t.includes("Olá, Joana!") && t.includes("Conecte seu WhatsApp"), "painel inicial incorreto");
  return "Padaria Pão Quente · Essencial · teste grátis · aviso para conectar o WhatsApp";
});

await step("F-02", "base de conhecimento: adiciona pergunta e texto", async () => {
  await go("/painel/conhecimento");
  assert((await text()).includes("Sua base está vazia"), "base deveria começar vazia");
  await click("Adicionar conteúdo");
  await fill("Título", "Entregas");
  await fill("Pergunta do cliente", "Vocês fazem entrega? Qual o frete?");
  await fill("Resposta", "Entregamos em Palmas de terça a domingo. O frete é grátis acima de R$ 50.");
  await click("Salvar", "footer//button");
  await waitText("Conteúdo salvo");
  await click("Adicionar conteúdo");
  await click("Texto");
  await fill("Título", "Encomendas de bolo");
  await fill("Conteúdo", "Bolos de aniversário precisam ser encomendados com 48 horas de antecedência.\n\nO sinal de 50% é pago por PIX no momento da encomenda.");
  await click("Salvar", "footer//button");
  await waitText("Encomendas de bolo");
  return "2 conteúdos ativos";
});

await step("F-03", "testar assistente: responde pela base e transfere quando pedem atendente", async () => {
  await go("/painel/chatbot");
  const input = await page.$("input[aria-label='Mensagem de teste']");
  await input.type("Vocês fazem entrega?");
  await page.keyboard.press("Enter");
  await waitText("frete é grátis");
  assert((await text()).includes("Resposta da base · Entregas"), "não indicou a fonte da resposta");
  await input.type("Com quanto tempo encomendo um bolo de aniversário?");
  await page.keyboard.press("Enter");
  await waitText("48 horas de antecedência");
  await click("Quero falar com um atendente");
  await page.waitForFunction(() => /Transferência para a equipe|Fora do horário/.test(document.body.innerText), { timeout: 5000 });
  return "entrega (FAQ), bolo (texto) e transferência";
});

await step("F-04", "configurar assistente: valida e salva", async () => {
  await fill("Mensagem de boas-vindas", "Oi");
  await click("Salvar alterações");
  await waitText("Escreva a mensagem de boas-vindas.");
  await fill("Mensagem de boas-vindas", "Olá, {nome}! Aqui é o Pãozinho, da Padaria Pão Quente. 🥖");
  await click("Salvar alterações");
  await waitText("Assistente atualizado");
  return "mensagem curta recusada; nova saudação salva";
});

await step("F-05", "conversa: IA responde, equipe assume, responde e encerra", async () => {
  await go("/painel/conversas");
  await click("Simular nova conversa");
  await waitText("Nova conversa simulada");
  const demo = await page.$("input[aria-label='Simular mensagem do cliente']");
  await demo.type("Qual o frete?");
  await page.keyboard.press("Enter");
  await waitText("Entregamos em Palmas");
  await click("Assumir atendimento");
  await waitText("assumiu o atendimento");
  await page.type("input[aria-label='Sua resposta']", "Oi! Aqui é a Joana. Quer que eu reserve um bolo?");
  await page.keyboard.press("Enter");
  await waitText("Quer que eu reserve um bolo?");
  await click("Encerrar");
  await waitText("Atendimento encerrado pela equipe");
  return "IA → humano → encerrada";
});

await step("F-06", "integrações: conecta o WhatsApp em 2 etapas", async () => {
  await go("/painel/integracoes");
  await click("Conectar (demonstração)");
  await fill("Número do WhatsApp", "63987654321");
  await click("Enviar código");
  await waitText("Etapa 2 de 2");
  await fill("Código de verificação", "123456");
  await click("Verificar e conectar");
  await waitText("WhatsApp conectado!");
  assert((await text()).includes("+55 63 98765-4321"), "número não aparece");
  return "+55 63 98765-4321 conectado";
});

await step("F-07", "cobrança: cadastra cartão, ativa assinatura e muda de plano", async () => {
  await go("/painel/plano");
  await click("Ativar assinatura");
  await waitText("Cadastre um cartão");
  await click("Cadastrar cartão");
  await fill("Número do cartão", "4242 4242 4242 4242");
  await fill("Validade", "12/29");
  await click("Salvar cartão");
  await waitText("•••• •••• •••• 4242");
  await click("Ativar assinatura");
  await waitText("Assinatura ativada!");
  await click("Comparar planos");
  await click("Mudar para Profissional");
  await waitText("Plano alterado para Profissional");
  const t = await text();
  assert(t.includes("PLANO ATUAL · ATIVO") && t.includes("Profissional"), "assinatura não ficou ativa no Profissional");
  return "cartão final 4242 · ativa · Profissional";
});

await step("F-08", "backoffice: encontra o novo cliente e suspende; cliente suspenso não entra", async () => {
  await click("", "button[@aria-label='Sair']");
  await go("/entrar");
  await click("Backoffice Nuvio");
  await page.waitForFunction(() => location.pathname === "/admin", { timeout: 10000 });
  await go("/admin/clientes");
  await page.type(".section-toolbar input", "Pão Quente");
  await sleep(300);
  await click("Padaria Pão Quente");
  await waitText("Joana Dias");
  await click("Suspender conta");
  await waitText("Conta suspensa.");
  await click("", "button[@aria-label='Sair']");
  await go("/entrar");
  await page.type("input[type=email]", EMAIL);
  await page.type("input[type=password]", PASSWORD);
  await click("Entrar");
  await waitText("Conta suspensa");
  return "suspensa pelo backoffice; login recusado";
});

await step("F-09", "site: “Ver demonstração” abre o painel da Clínica Lumina", async () => {
  await go("/");
  await click("Ver demonstração");
  await page.waitForFunction(() => location.pathname === "/painel", { timeout: 10000 });
  await waitText("Olá, Mariana!");
  return "painel de demonstração";
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nResultado: ${ok}/${results.length} fluxos aprovados${errors.length ? ` · erros de página: ${[...new Set(errors)].join(" | ")}` : ""}`);
process.exit(ok === results.length && !errors.length ? 0 : 1);
