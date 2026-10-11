import { addDays, dayKey } from "@/core/lib/format";
import { respond, topicOf } from "@/modules/bot/engine";
import type { AssistantConfig, Conversation, DailyStat, Invoice, KnowledgeItem, Message, Plan, PlanId, PlatformData, User, Workspace, WorkspaceStatus } from "@/modules/domain/types";
/** Senha de todas as contas demonstrativas. */
export const DEMO_PASSWORD = "demo123";
/** Hash de "demo123" (senha de todas as contas demonstrativas). */
export const DEMO_HASH = "975cc80c48fc763b2bcf82f824486a4877978965d723bcace9cf53c8036dc2f3";

export const defaultPlans = (): Plan[] => [
  { id: "essencial", name: "Essencial", price: 297, description: "Para começar a automatizar seu atendimento.", numbers: 1, conversations: 1500, knowledgeLimit: 50, features: ["1 número de WhatsApp", "1.500 conversas/mês", "Base com até 50 conteúdos", "Relatórios essenciais"] },
  { id: "profissional", name: "Profissional", price: 597, description: "Para empresas que querem crescer com eficiência.", numbers: 3, conversations: 5000, knowledgeLimit: null, features: ["3 números de WhatsApp", "5.000 conversas/mês", "Base de conhecimento ilimitada", "Integrações e relatórios avançados"], popular: true },
  { id: "escala", name: "Escala", price: 1190, description: "Para operações com alto volume e múltiplas equipes.", numbers: 10, conversations: 20000, knowledgeLimit: null, features: ["10 números de WhatsApp", "20.000 conversas/mês", "Atendimento prioritário", "Implantação acompanhada"] },
];

export const defaultAssistant = (name: string, company: string, objective: string): AssistantConfig => ({
  name,
  tone: "amigavel",
  objective,
  greeting: `Olá, {nome}! Sou ${name}, a assistente virtual da ${company}. Como posso ajudar?`,
  fallback: "Hmm, ainda não tenho essa informação. Pode me contar com outras palavras? Se preferir, digite *atendente* para falar com a equipe.",
  handoffKeywords: ["atendente", "humano", "falar com alguém", "reclamação", "gerente"],
  handoffAfterFailures: 2,
  hours: { days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00" },
  outOfHoursMessage: "Nossa equipe atende de segunda a sexta, das 8h às 18h. Deixei seu pedido registrado e retornamos no próximo horário de atendimento. 💙",
  active: true,
});

/** Base da Clínica Lumina (estética e bem-estar). */
function luminaKnowledge(now: string): KnowledgeItem[] {
  const k = (id: string, kind: KnowledgeItem["kind"], title: string, content: string, extra: Partial<KnowledgeItem> = {}): KnowledgeItem => ({ id, workspaceId: "w-lumina", kind, title, content, status: "ready", active: true, updatedAt: now, ...extra });
  return [
    k("k-valores", "faq", "Valores da avaliação", "A avaliação inicial custa R$ 120 e esse valor é abatido se você fechar qualquer tratamento em até 30 dias.", { question: "Quanto custa a avaliação? Qual o valor?" }),
    k("k-pagamento", "faq", "Formas de pagamento", "Aceitamos PIX, cartão de débito e crédito em até 10x sem juros nos tratamentos acima de R$ 600.", { question: "Quais as formas de pagamento? Parcela no cartão? Aceita PIX?" }),
    k("k-agendar", "faq", "Como agendar", "Você pode agendar por aqui mesmo! Temos horários de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h. Me diga o melhor dia que eu verifico a agenda.", { question: "Como faço para agendar uma avaliação ou consulta? Tem horário disponível?" }),
    k("k-endereco", "faq", "Endereço e estacionamento", "Ficamos na Av. Teotônio Segurado, 1200, sala 304 — Palmas (TO). Há estacionamento gratuito no subsolo do prédio.", { question: "Onde fica a clínica? Qual o endereço? Tem estacionamento?" }),
    k("k-funcionamento", "faq", "Horário de funcionamento", "Funcionamos de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h.", { question: "Qual o horário de funcionamento? Abre sábado?" }),
    k("k-remarcar", "text", "Políticas de agendamento", "Para remarcar ou cancelar, avise com pelo menos 24 horas de antecedência. Remarcações podem ser feitas por aqui mesmo, sem custo.\n\nFaltas sem aviso geram uma taxa de R$ 50 no próximo agendamento.\n\nAtrasos de até 15 minutos são tolerados sem prejuízo ao atendimento."),
    k("k-catalogo", "document", "Catálogo de serviços", "Limpeza de pele profunda: R$ 180, duração de 1h30, recomendada a cada 45 dias.\n\nPeeling químico: a partir de R$ 350 por sessão, indicado para manchas e textura da pele.\n\nDrenagem linfática: pacote com 10 sessões por R$ 900.\n\nToxina botulínica: valor sob avaliação, aplicada por médica dermatologista.", { fileName: "catalogo-de-servicos.pdf" }),
    k("k-site", "site", "clinica-lumina.com.br", "A Clínica Lumina atua há 8 anos em estética facial e corporal, com equipe de dermatologistas e esteticistas. Todos os procedimentos começam com uma avaliação personalizada.", { url: "https://clinica-lumina.com.br" }),
  ];
}

const SCRIPTS: { name: string; phone: string; lines: string[]; agent?: string[]; status: Conversation["status"]; minutesAgo: number }[] = [
  { name: "João Carlos", phone: "+55 63 98111-2233", lines: ["Oi, bom dia", "Como faço para agendar uma avaliação?"], status: "resolved", minutesAgo: 2 },
  { name: "Ana Ferreira", phone: "+55 63 99222-3344", lines: ["Vocês fazem peeling?", "Quero falar com um atendente sobre o meu caso"], agent: ["Oi, Ana! Aqui é a Carla, da recepção. Me conta um pouco do que você precisa?"], status: "human", minutesAgo: 8 },
  { name: "Ricardo Mendes", phone: "+55 63 98333-4455", lines: ["Quais as formas de pagamento? Dá pra parcelar no cartão?"], status: "resolved", minutesAgo: 24 },
  { name: "Luiza Santos", phone: "+55 63 99444-5566", lines: ["Preciso remarcar minha consulta de amanhã", "atendente por favor"], status: "waiting", minutesAgo: 42 },
  { name: "Paulo Henrique", phone: "+55 63 98555-6677", lines: ["Qual o endereço da clínica? Tem estacionamento?"], status: "resolved", minutesAgo: 75 },
  { name: "Fernanda Lima", phone: "+55 63 99666-7788", lines: ["Quanto custa a limpeza de pele?"], status: "resolved", minutesAgo: 130 },
  { name: "Marcos Vinícius", phone: "+55 63 98777-8899", lines: ["Vocês abrem sábado?"], status: "resolved", minutesAgo: 210 },
  { name: "Juliana Prado", phone: "+55 63 99888-9900", lines: ["Vocês atendem plano de saúde?", "E convênio Unimed?"], status: "waiting", minutesAgo: 320 },
  { name: "Carla Souza", phone: "+55 63 98123-4567", lines: ["Qual o valor da avaliação?"], status: "resolved", minutesAgo: 480 },
  { name: "Bruno Alves", phone: "+55 63 99234-5678", lines: ["Boa tarde! Quanto custa a drenagem linfática?"], status: "bot", minutesAgo: 600 },
  { name: "Patrícia Gomes", phone: "+55 63 98345-6789", lines: ["Se eu faltar tem multa?"], status: "resolved", minutesAgo: 900 },
  { name: "Diego Rocha", phone: "+55 63 99456-7890", lines: ["Aceita PIX?"], status: "resolved", minutesAgo: 1300 },
];

function iso(minutesAgo: number, now: Date) {
  return new Date(now.getTime() - minutesAgo * 60000).toISOString();
}

/** Conversas montadas com o PRÓPRIO motor do robô (as respostas são as que ele daria). */
function luminaConversations(config: AssistantConfig, knowledge: KnowledgeItem[], now: Date): Conversation[] {
  // Horário comercial fixo para os exemplos não dependerem da hora em que a demonstração foi criada.
  const businessNow = new Date("2026-10-07T13:00:00Z");
  return SCRIPTS.map((s, i) => {
    let t = s.minutesAgo + s.lines.length * 2 + 2;
    const messages: Message[] = [];
    let failures = 0;
    let handed = false;
    let topic = "";
    s.lines.forEach((line, n) => {
      messages.push({ id: `m-${i}-${n}-c`, from: "customer", text: line, at: iso((t -= 1), now) });
      const r = respond({ text: line, config, knowledge, first: n === 0, failures, contactName: s.name, now: businessNow, seed: i + n });
      if (r.topic !== "Saudação" && r.topic !== "Dúvidas gerais") topic = r.topic;
      else topic ||= r.topic === "Saudação" ? "" : r.topic;
      failures = r.action === "fallback" ? failures + 1 : 0;
      messages.push({ id: `m-${i}-${n}-b`, from: "bot", text: r.reply, at: iso((t -= 1), now), sources: r.sources });
      if (r.action === "handoff") handed = true;
    });
    if (handed) messages.push({ id: `m-${i}-sys`, from: "system", text: "Conversa transferida para a equipe.", at: iso(t, now) });
    s.agent?.forEach((text, n) => messages.push({ id: `m-${i}-a${n}`, from: "agent", author: "Carla (recepção)", text, at: iso(Math.max(0, (t -= 1)), now) }));
    return {
      id: `c-lumina-${i + 1}`,
      workspaceId: "w-lumina",
      contactName: s.name,
      phone: s.phone,
      topic: topic || topicOf(s.lines.join(" ")),
      status: s.status,
      resolvedBy: s.status === "resolved" ? (s.agent ? "human" : "ai") : undefined,
      failures,
      messages,
      startedAt: messages[0].at,
      updatedAt: messages[messages.length - 1].at,
      unread: s.status === "waiting" ? 1 : 0,
    };
  });
}

/** Histórico diário (30 dias) com um padrão semanal realista. */
function dailyHistory(perDay: number, aiRate: number, today: string, seed: number): DailyStat[] {
  const weekday = [0.55, 1, 1.15, 1.05, 1.25, 1.1, 0.75]; // dom..sáb
  return Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, i - 29);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const wobble = 0.85 + (((seed * 31 + i * 17) % 30) / 100);
    const total = Math.round(perDay * weekday[dow] * wobble);
    return { date, total, ai: Math.round(total * (aiRate - 0.03 + (((seed + i) % 7) / 100))) };
  });
}

interface Company {
  id: string;
  name: string;
  owner: string;
  email: string;
  segment: string;
  plan: PlanId;
  status: WorkspaceStatus;
  perDay: number;
  aiRate: number;
  daysAgo: number;
  phone: string;
  assistant: string;
}

const COMPANIES: Company[] = [
  { id: "w-lumina", name: "Clínica Lumina", owner: "Mariana Alves", email: "mariana@lumina.com.br", segment: "Saúde e bem-estar", plan: "profissional", status: "active", perDay: 72, aiRate: 0.87, daysAgo: 210, phone: "+55 63 98765-4321", assistant: "Lumi" },
  { id: "w-aurora", name: "Aurora Labs", owner: "Rodrigo Nunes", email: "rodrigo@auroralabs.com", segment: "Serviços", plan: "profissional", status: "active", perDay: 128, aiRate: 0.82, daysAgo: 160, phone: "+55 11 97654-3210", assistant: "Aura" },
  { id: "w-semente", name: "Escola Semente", owner: "Cláudia Ramos", email: "claudia@escolasemente.com.br", segment: "Educação", plan: "escala", status: "active", perDay: 405, aiRate: 0.9, daysAgo: 300, phone: "+55 63 99876-5432", assistant: "Sementinha" },
  { id: "w-casaverde", name: "Casa Verde", owner: "Henrique Duarte", email: "henrique@casaverde.com.br", segment: "Varejo", plan: "essencial", status: "past_due", perDay: 46, aiRate: 0.78, daysAgo: 95, phone: "+55 62 98765-1122", assistant: "Verdinho" },
  { id: "w-forma", name: "Studio Forma", owner: "Beatriz Moura", email: "bia@studioforma.com.br", segment: "Saúde e bem-estar", plan: "profissional", status: "active", perDay: 98, aiRate: 0.85, daysAgo: 120, phone: "+55 63 98222-1100", assistant: "Fit" },
  { id: "w-norte", name: "Norte Imóveis", owner: "Gustavo Pires", email: "gustavo@norteimoveis.com.br", segment: "Serviços", plan: "escala", status: "active", perDay: 520, aiRate: 0.76, daysAgo: 250, phone: "+55 63 99111-0099", assistant: "Norte" },
  { id: "w-flora", name: "Flora Cosméticos", owner: "Larissa Teles", email: "larissa@floracosmeticos.com", segment: "Varejo", plan: "profissional", status: "active", perDay: 140, aiRate: 0.88, daysAgo: 70, phone: "+55 61 98444-3322", assistant: "Flora" },
  { id: "w-upway", name: "Upway Idiomas", owner: "Tiago Campos", email: "tiago@upway.com.br", segment: "Educação", plan: "essencial", status: "active", perDay: 38, aiRate: 0.84, daysAgo: 45, phone: "+55 63 98999-1212", assistant: "Up" },
  { id: "w-wevo", name: "Wevo Delivery", owner: "Camila Rocha", email: "camila@wevo.com.br", segment: "Varejo", plan: "escala", status: "active", perDay: 610, aiRate: 0.91, daysAgo: 180, phone: "+55 63 99333-4455", assistant: "Wevinho" },
  { id: "w-bemestar", name: "Bem-Estar Pet", owner: "Felipe Araújo", email: "felipe@bemestarpet.com.br", segment: "Serviços", plan: "essencial", status: "trial", perDay: 12, aiRate: 0.8, daysAgo: 6, phone: "", assistant: "Pipoca" },
  { id: "w-odonto", name: "OdontoVida", owner: "Renata Lopes", email: "renata@odontovida.com.br", segment: "Saúde e bem-estar", plan: "profissional", status: "trial", perDay: 20, aiRate: 0.83, daysAgo: 9, phone: "+55 63 98555-0101", assistant: "Vida" },
  { id: "w-mercadinho", name: "Mercadinho Bom Preço", owner: "Antônio Silva", email: "antonio@bompreco.com.br", segment: "Varejo", plan: "essencial", status: "suspended", perDay: 0, aiRate: 0.7, daysAgo: 140, phone: "+55 63 98000-7777", assistant: "Bia" },
];

export function createDemoData(now = new Date()): PlatformData {
  const today = dayKey(now);
  const nowIso = now.toISOString();
  const plans = defaultPlans();
  const price = (id: PlanId) => plans.find((p) => p.id === id)!.price;

  const workspaces: Workspace[] = COMPANIES.map((c, i) => {
    const createdAt = new Date(now.getTime() - c.daysAgo * 864e5).toISOString();
    const trial = c.status === "trial";
    return {
      id: c.id,
      name: c.name,
      segment: c.segment,
      teamSize: i % 3 === 0 ? "11 a 50 pessoas" : "2 a 10 pessoas",
      planId: c.plan,
      status: c.status,
      createdAt,
      trialEndsAt: trial ? addDays(dayKey(new Date(createdAt)), 14) : undefined,
      renewsAt: addDays(today, 3 + ((i * 7) % 26)),
      whatsapp: c.phone
        ? { status: c.status === "suspended" ? "disconnected" : "connected", phone: c.phone, displayName: c.name, connectedAt: createdAt, lastSyncAt: new Date(now.getTime() - 2 * 60000).toISOString() }
        : { status: "disconnected", phone: "", displayName: c.name },
      assistant: defaultAssistant(c.assistant, c.name, "Responder dúvidas dos clientes e encaminhar para a equipe quando necessário."),
      integrations: c.id === "w-lumina" ? { "google-calendar": { enabled: true, target: "Agenda de avaliações", connectedAt: createdAt }, "google-sheets": { enabled: false }, webhook: { enabled: false } } : {},
      daily: dailyHistory(c.perDay, c.aiRate, today, i + 1),
      card: trial ? undefined : { brand: i % 2 ? "MASTERCARD" : "VISA", last4: String(4242 + i * 1111).slice(-4), expires: `0${(i % 9) + 1}/2${8 + (i % 2)}` },
    };
  });

  const lumina = workspaces[0];
  lumina.assistant = defaultAssistant("Lumi", "Clínica Lumina", "Responder dúvidas sobre tratamentos, valores e ajudar pacientes a agendar uma avaliação.");
  lumina.website = "https://clinica-lumina.com.br";
  const knowledge = luminaKnowledge(nowIso);
  const conversations = luminaConversations(lumina.assistant, knowledge, now);

  const invoices: Invoice[] = [];
  workspaces.forEach((w, i) => {
    if (w.status === "trial") return;
    for (let m = 2; m >= 0; m--) {
      const due = addDays(w.renewsAt, -30 * (m + 1));
      const overdue = m === 0 && (w.status === "past_due" || w.status === "suspended");
      invoices.push({ id: `inv-${w.id}-${m}`, workspaceId: w.id, period: due.slice(0, 7), planId: w.planId, amount: price(w.planId), dueDate: due, status: overdue ? "overdue" : "paid", paidAt: overdue ? undefined : new Date(`${due}T15:00:00Z`).toISOString() });
    }
    // próxima fatura em aberto
    invoices.push({ id: `inv-${w.id}-next`, workspaceId: w.id, period: w.renewsAt.slice(0, 7), planId: w.planId, amount: price(w.planId), dueDate: w.renewsAt, status: w.status === "suspended" ? "overdue" : "pending" });
    void i;
  });

  const users: User[] = [
    { id: "u-admin", role: "admin", name: "Rafael Admin", email: "admin@nuvio.com.br", passwordHash: DEMO_HASH },
    ...COMPANIES.map((c) => ({ id: `u-${c.id.slice(2)}`, role: "client" as const, name: c.owner, email: c.email, passwordHash: DEMO_HASH, workspaceId: c.id })),
  ];

  // MRR dos últimos 12 meses (crescimento até o valor atual).
  const currentMrr = workspaces.filter((w) => w.status === "active" || w.status === "past_due").reduce((s, w) => s + price(w.planId), 0);
  const mrrHistory = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 15);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { month, value: Math.round(currentMrr * (0.3 + (0.7 * i) / 11) * (i % 3 === 2 ? 0.97 : 1)) };
  });

  return { plans, workspaces, knowledge, conversations, invoices, users, settings: { trialDays: 14, usageAlert: 0.8 }, mrrHistory };
}
