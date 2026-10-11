import { makeAutoObservable } from "mobx";
import { addDays, dayKey, EMAIL, formatWhatsAppPhone, hashPassword, newId } from "@/core/lib/format";
import { respond, type BotResult } from "@/modules/bot/engine";
import type {
  AssistantConfig,
  Conversation,
  DeliveryStatus,
  IntegrationId,
  Invoice,
  KnowledgeItem,
  Message,
  Plan,
  PlanId,
  PlatformData,
  PlatformSettings,
  Role,
  User,
  Workspace,
  WorkspaceStatus,
} from "@/modules/domain/types";
import { createDemoData, defaultAssistant } from "./demo-data";

/** null = deu certo; texto = motivo (mostrado ao usuário). */
export type Result = string | null;

export interface SignupInput {
  company: string;
  name: string;
  email: string;
  password: string;
  segment: string;
  teamSize: string;
  planId: PlanId;
  assistantName: string;
  tone: AssistantConfig["tone"];
  objective: string;
  website: string;
}

const CONTACTS = [
  ["Gabriela Martins", "+55 63 98123-0001"], ["Lucas Oliveira", "+55 63 99234-0002"], ["Sofia Ribeiro", "+55 63 98345-0003"], ["Mateus Costa", "+55 63 99456-0004"],
  ["Helena Barros", "+55 63 98567-0005"], ["Pedro Araújo", "+55 63 99678-0006"], ["Alice Fernandes", "+55 63 98789-0007"], ["Rafael Lima", "+55 63 99890-0008"],
] as const;
const QUESTIONS = ["Quanto custa a avaliação?", "Vocês abrem sábado?", "Qual o endereço?", "Dá pra parcelar no cartão?", "Como faço para agendar?", "Quero falar com um atendente", "Vocês fazem tatuagem?", "Tem estacionamento?"];

/**
 * Todos os dados e regras da Nuvio (demonstração no navegador).
 * As telas só chamam estes métodos; na etapa de backend cada um vira uma chamada à API com as mesmas regras.
 */
export class PlatformStore {
  plans: Plan[];
  workspaces: Workspace[];
  knowledge: KnowledgeItem[];
  conversations: Conversation[];
  invoices: Invoice[];
  users: User[];
  settings: PlatformSettings;
  mrrHistory: PlatformData["mrrHistory"];
  userId: string | null = null;
  hydrated = false;
  /**
   * true = o motor local responde na hora (testes e demonstração sem servidor).
   * O navegador e o servidor usam false: a resposta vem do servidor (IA ou motor), depois da mensagem.
   */
  autoReply = true;

  constructor(data: PlatformData = createDemoData()) {
    this.plans = data.plans;
    this.workspaces = data.workspaces;
    this.knowledge = data.knowledge;
    this.conversations = data.conversations;
    this.invoices = data.invoices;
    this.users = data.users;
    this.settings = data.settings;
    this.mrrHistory = data.mrrHistory;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get snapshot(): PlatformData {
    return { plans: this.plans, workspaces: this.workspaces, knowledge: this.knowledge, conversations: this.conversations, invoices: this.invoices, users: this.users, settings: this.settings, mrrHistory: this.mrrHistory };
  }

  replaceAll(data: PlatformData) {
    Object.assign(this, data);
  }

  setHydrated(userId: string | null) {
    this.userId = this.users.some((u) => u.id === userId) ? userId : null;
    this.hydrated = true;
  }

  // ------------------------------------------------------------------ consultas

  plan(id?: PlanId) {
    return this.plans.find((p) => p.id === id) ?? this.plans[0];
  }
  workspace(id?: string) {
    return this.workspaces.find((w) => w.id === id);
  }
  get user() {
    return this.users.find((u) => u.id === this.userId);
  }
  get role(): Role | undefined {
    return this.user?.role;
  }
  /** Empresa do cliente logado */
  get current() {
    return this.workspace(this.user?.workspaceId);
  }
  knowledgeOf(workspaceId: string) {
    return this.knowledge.filter((k) => k.workspaceId === workspaceId);
  }
  conversationsOf(workspaceId: string) {
    return this.conversations.filter((c) => c.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  conversation(id?: string) {
    return this.conversations.find((c) => c.id === id);
  }
  invoicesOf(workspaceId: string) {
    return this.invoices.filter((i) => i.workspaceId === workspaceId).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }
  ownerOf(workspaceId: string) {
    return this.users.find((u) => u.workspaceId === workspaceId);
  }

  /** Conversas e resolvidas pela IA no mês atual (a partir do histórico diário). */
  usage(w: Workspace, today = dayKey()) {
    const month = today.slice(0, 7);
    const days = w.daily.filter((d) => d.date.startsWith(month));
    const total = days.reduce((s, d) => s + d.total, 0);
    const ai = days.reduce((s, d) => s + d.ai, 0);
    const limit = this.plan(w.planId).conversations;
    return { total, ai, aiRate: total ? ai / total : 0, limit, ratio: total / limit };
  }

  /** Últimos N dias do histórico (preenche dias sem registro com zero). */
  lastDays(w: Workspace, n: number, today = dayKey()) {
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(today, i - n + 1);
      return w.daily.find((d) => d.date === date) ?? { date, total: 0, ai: 0 };
    });
  }

  /** Assuntos das conversas (para "Assuntos mais frequentes"). */
  topics(workspaceId: string) {
    const counts = new Map<string, number>();
    for (const c of this.conversationsOf(workspaceId)) if (c.topic && c.topic !== "Dúvidas gerais") counts.set(c.topic, (counts.get(c.topic) ?? 0) + 1);
    const total = [...counts.values()].reduce((s, v) => s + v, 0);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([topic, n]) => ({ topic, share: total ? n / total : 0 }));
  }

  get mrr() {
    return this.workspaces.filter((w) => w.status === "active" || w.status === "past_due").reduce((s, w) => s + this.plan(w.planId).price, 0);
  }

  // ------------------------------------------------------------------ acesso

  async login(email: string, password: string): Promise<Result> {
    const user = this.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.passwordHash !== (await hashPassword(password))) return "E-mail ou senha incorretos.";
    const ws = this.workspace(user.workspaceId);
    if (ws?.status === "suspended") return "Conta suspensa. Fale com o suporte da Nuvio.";
    this.setUser(user.id);
    return null;
  }

  setUser(id: string | null) {
    this.userId = id;
  }

  logout() {
    this.userId = null;
  }

  static validateSignup(i: SignupInput, step = 4): Record<string, string> {
    const e: Record<string, string> = {};
    if (step >= 1) {
      if (i.company.trim().length < 2) e.company = "Informe o nome da empresa.";
      if (i.name.trim().length < 3) e.name = "Informe seu nome completo.";
      if (!EMAIL.test(i.email.trim())) e.email = "E-mail inválido.";
      if (i.password.length < 8) e.password = "A senha precisa de pelo menos 8 caracteres.";
    }
    if (step >= 3) {
      if (i.assistantName.trim().length < 2) e.assistantName = "Dê um nome ao assistente.";
      if (i.objective.trim().length < 15) e.objective = "Descreva o objetivo em uma frase (mínimo 15 caracteres).";
      if (i.website.trim() && !/^https:\/\/\S+\.\S+$/.test(i.website.trim())) e.website = "Use o endereço completo, começando com https://";
    }
    return e;
  }

  emailInUse(email: string) {
    return this.users.some((u) => u.email === email.trim().toLowerCase());
  }

  /** Cria a empresa (14 dias grátis) e o usuário, e já entra. */
  async signup(i: SignupInput): Promise<Record<string, string>> {
    return this.createAccount(i, await hashPassword(i.password));
  }

  /** Cria empresa + usuário com o hash já calculado (no servidor: scrypt). */
  createAccount(i: SignupInput, passwordHash: string): Record<string, string> {
    const errors = PlatformStore.validateSignup(i);
    if (this.emailInUse(i.email)) errors.email = "Já existe uma conta com este e-mail.";
    if (Object.keys(errors).length) return errors;
    const now = new Date();
    const today = dayKey(now);
    const id = `w-${newId()}`;
    const company = i.company.trim();
    const assistant = defaultAssistant(i.assistantName.trim(), company, i.objective.trim());
    assistant.tone = i.tone;
    this.workspaces.push({
      id,
      name: company,
      segment: i.segment,
      teamSize: i.teamSize,
      website: i.website.trim() || undefined,
      planId: i.planId,
      status: "trial",
      createdAt: now.toISOString(),
      trialEndsAt: addDays(today, this.settings.trialDays),
      renewsAt: addDays(today, this.settings.trialDays),
      whatsapp: { status: "disconnected", phone: "", displayName: company },
      assistant,
      integrations: {},
      daily: [],
    });
    if (i.website.trim()) {
      this.knowledge.push({ id: newId(), workspaceId: id, kind: "site", title: i.website.trim().replace(/^https:\/\//, ""), content: "", url: i.website.trim(), status: "processing", active: true, updatedAt: now.toISOString() });
    }
    const user: User = { id: `u-${newId()}`, role: "client", name: i.name.trim(), email: i.email.trim().toLowerCase(), passwordHash, workspaceId: id };
    this.users.push(user);
    this.setUser(user.id);
    return {};
  }

  // ------------------------------------------------------------------ assistente e base

  updateAssistant(workspaceId: string, patch: Partial<AssistantConfig>): Result {
    const w = this.workspace(workspaceId);
    if (!w) return "Empresa não encontrada.";
    const next = { ...w.assistant, ...patch };
    if (next.name.trim().length < 2) return "Dê um nome ao assistente.";
    if (next.greeting.trim().length < 5) return "Escreva a mensagem de boas-vindas.";
    if (next.fallback.trim().length < 5) return "Escreva a resposta para quando a IA não souber.";
    if (!next.hours.days.length) return "Escolha ao menos um dia de atendimento.";
    if (next.hours.start >= next.hours.end) return "O horário final deve ser depois do inicial.";
    if (!(next.handoffAfterFailures >= 1 && next.handoffAfterFailures <= 5)) return "Transferência após 1 a 5 tentativas.";
    w.assistant = { ...next, handoffKeywords: next.handoffKeywords.map((k) => k.trim()).filter(Boolean) };
    return null;
  }

  saveKnowledge(workspaceId: string, input: Omit<KnowledgeItem, "id" | "workspaceId" | "status" | "updatedAt" | "active"> & { id?: string }): Result {
    const w = this.workspace(workspaceId);
    if (!w) return "Empresa não encontrada.";
    if (input.title.trim().length < 3) return "Dê um título ao conteúdo.";
    if (input.kind === "faq" && (input.question ?? "").trim().length < 5) return "Escreva a pergunta.";
    if (input.kind === "site" && !/^https:\/\/\S+\.\S+$/.test(input.url ?? "")) return "Informe o endereço do site começando com https://";
    if (input.kind !== "site" && input.content.trim().length < 10) return input.kind === "faq" ? "Escreva a resposta." : "O conteúdo está vazio.";
    const existing = input.id ? this.knowledge.find((k) => k.id === input.id && k.workspaceId === workspaceId) : undefined;
    const limit = this.plan(w.planId).knowledgeLimit;
    if (!existing && limit !== null && this.knowledgeOf(workspaceId).length >= limit) return `Seu plano permite até ${limit} conteúdos. Faça upgrade para adicionar mais.`;
    const now = new Date().toISOString();
    const clean = { ...input, title: input.title.trim(), content: input.content.trim(), question: input.question?.trim() };
    if (existing) Object.assign(existing, clean, { updatedAt: now });
    else this.knowledge.push({ ...clean, id: newId(), workspaceId, status: input.kind === "site" ? "processing" : "ready", active: true, updatedAt: now });
    return null;
  }

  /** Demonstração: conclui a leitura de um site (no backend, um robô lê as páginas). */
  finishProcessing(id: string) {
    const item = this.knowledge.find((k) => k.id === id);
    if (!item || item.status !== "processing") return;
    item.status = "ready";
    if (!item.content) item.content = `Conteúdo lido do site ${item.url}. (Na demonstração, a leitura automática do site é simulada; na versão com servidor, as páginas são lidas e resumidas.)`;
    item.updatedAt = new Date().toISOString();
  }

  toggleKnowledge(id: string) {
    const item = this.knowledge.find((k) => k.id === id);
    if (item) item.active = !item.active;
  }

  removeKnowledge(id: string) {
    this.knowledge = this.knowledge.filter((k) => k.id !== id);
  }

  // ------------------------------------------------------------------ conversas

  private bump(w: Workspace, field: "total" | "ai") {
    const today = dayKey();
    if (!w.daily.some((x) => x.date === today)) w.daily.push({ date: today, total: 0, ai: 0 });
    // Busca de novo: o MobX guarda uma cópia observável do objeto colocado na lista.
    const d = w.daily.find((x) => x.date === today)!;
    d[field] += 1;
  }

  private push(c: Conversation, m: Omit<Message, "id" | "at">): Message {
    const at = new Date().toISOString();
    c.messages.push({ ...m, id: newId(), at });
    c.updatedAt = at;
    return c.messages[c.messages.length - 1];
  }

  /**
   * Regra do WhatsApp: mensagens livres só até 24 h depois da última mensagem do cliente.
   * Fora dessa janela, só um modelo (template) aprovado pela Meta.
   */
  windowOpen(c: Conversation, now = Date.now()): boolean {
    const last = [...c.messages].reverse().find((m) => m.from === "customer");
    return !!last && now - Date.parse(last.at) < 24 * 3600e3;
  }

  /** A IA deve responder agora? (conversa com ela, assistente ligado, última mensagem do cliente) */
  needsReply(conversationId: string): boolean {
    const c = this.conversation(conversationId);
    const w = c && this.workspace(c.workspaceId);
    return !!c && !!w && c.status === "bot" && w.assistant.active && c.messages.at(-1)?.from === "customer" && (w.status === "active" || w.status === "trial" || w.status === "past_due");
  }

  /** Aplica uma resposta (motor local ou IA): mensagem, assunto, falhas seguidas e transferência. */
  applyBotResult(conversationId: string, r: BotResult): Message | null {
    const c = this.conversation(conversationId);
    if (!c || !this.needsReply(conversationId)) return null;
    if (r.topic !== "Saudação" && (c.topic === "" || c.topic === "Dúvidas gerais")) c.topic = r.topic;
    c.failures = r.action === "fallback" ? c.failures + 1 : 0;
    const msg = this.push(c, { from: "bot", text: r.reply, sources: r.sources, status: "pending" });
    if (r.action === "handoff" || r.action === "out_of_hours") {
      c.status = "waiting";
      c.unread += 1;
      this.push(c, { from: "system", text: r.action === "handoff" ? "Conversa transferida para a equipe." : "Pedido registrado fora do horário de atendimento." });
    }
    return msg;
  }

  /** Resposta imediata com o motor local (demonstração e testes). */
  replyLocally(conversationId: string) {
    const c = this.conversation(conversationId);
    if (!c || !this.needsReply(conversationId)) return;
    const w = this.workspace(c.workspaceId)!;
    const text = c.messages.at(-1)!.text;
    const r = respond({ text, config: w.assistant, knowledge: this.knowledgeOf(w.id), first: c.messages.filter((m) => m.from === "customer").length <= 1, failures: c.failures, contactName: c.contactName });
    this.applyBotResult(conversationId, r);
  }

  /** Mensagem do cliente (WhatsApp real pelo webhook, ou simulada na demonstração). */
  receiveMessage(conversationId: string, text: string, externalId?: string): Result {
    const c = this.conversation(conversationId);
    if (!c) return "Conversa não encontrada.";
    if (!text.trim()) return "Escreva uma mensagem.";
    if (c.status === "resolved") {
      c.status = "bot";
      c.resolvedBy = undefined;
    }
    this.push(c, { from: "customer", text: text.trim(), ...(externalId ? { externalId } : {}) });
    const w = this.workspace(c.workspaceId)!;
    const usage = this.usage(w);
    if (c.status === "bot" && usage.total > usage.limit) {
      c.status = "waiting";
      this.push(c, { from: "system", text: `Limite de ${usage.limit.toLocaleString("pt-BR")} conversas do plano atingido: a IA pausou e a equipe foi avisada.` });
    }
    if (c.status === "bot") {
      if (this.autoReply) this.replyLocally(c.id);
    } else c.unread += 1;
    return null;
  }

  /**
   * Mensagem real recebida pelo WhatsApp. Reaproveita a conversa aberta com o mesmo número
   * (ou reabre uma encerrada nas últimas 24 h); senão, abre uma nova. Ignora mensagens repetidas
   * (o WhatsApp pode reenviar a mesma notificação). Devolve o id da conversa ou null.
   */
  inbound(workspaceId: string, msg: { phone: string; name: string; text: string; externalId: string }): string | null {
    const w = this.workspace(workspaceId);
    if (!w || !msg.externalId) return null;
    if (this.conversations.some((c) => c.messages.some((m) => m.externalId === msg.externalId))) return null;
    const digits = msg.phone.replace(/\D/g, "");
    const same = this.conversationsOf(workspaceId).filter((c) => c.phone.replace(/\D/g, "") === digits);
    let c = same.find((x) => x.status !== "resolved") ?? same.find((x) => Date.now() - Date.parse(x.updatedAt) < 24 * 3600e3);
    if (!c) {
      const now = new Date().toISOString();
      this.conversations.push({ id: `c-${newId()}`, workspaceId, contactName: msg.name.trim() || formatWhatsAppPhone(digits), phone: formatWhatsAppPhone(digits), topic: "", status: "bot", failures: 0, messages: [], startedAt: now, updatedAt: now, unread: 0 });
      c = this.conversations[this.conversations.length - 1];
      this.bump(w, "total");
    }
    this.receiveMessage(c.id, msg.text, msg.externalId);
    return c.id;
  }

  /** Servidor: registra o envio pelo WhatsApp (id da Meta e situação). */
  setDelivery(conversationId: string, messageId: string, status: DeliveryStatus, externalId?: string, error?: string) {
    const m = this.conversation(conversationId)?.messages.find((x) => x.id === messageId);
    if (!m) return;
    m.status = status;
    if (externalId) m.externalId = externalId;
    if (error) m.error = error;
  }

  /** Webhook de status (enviada → entregue → lida; ou falhou). Nunca volta para trás. */
  markDelivery(externalId: string, status: DeliveryStatus, error?: string) {
    const order: DeliveryStatus[] = ["pending", "sending", "sent", "delivered", "read"];
    for (const c of this.conversations)
      for (const m of c.messages)
        if (m.externalId === externalId) {
          if (status === "failed" || order.indexOf(status) > order.indexOf(m.status ?? "pending")) m.status = status;
          if (error) m.error = error;
          return;
        }
  }

  /** Demonstração: chega uma conversa nova de um cliente fictício. */
  simulateIncoming(workspaceId: string, text?: string): string | null {
    const w = this.workspace(workspaceId);
    if (!w) return null;
    const n = this.conversations.length;
    const [name, phone] = CONTACTS[n % CONTACTS.length];
    const now = new Date().toISOString();
    const c: Conversation = { id: `c-${newId()}`, workspaceId, contactName: name, phone, topic: "", status: "bot", failures: 0, messages: [], startedAt: now, updatedAt: now, unread: 0, demo: true };
    this.conversations.push(c);
    const conv = this.conversations[this.conversations.length - 1];
    this.bump(w, "total");
    this.receiveMessage(conv.id, text ?? QUESTIONS[n % QUESTIONS.length]);
    return conv.id;
  }

  takeOver(conversationId: string): Result {
    const c = this.conversation(conversationId);
    if (!c) return "Conversa não encontrada.";
    if (c.status === "resolved") return "Esta conversa já foi encerrada.";
    c.status = "human";
    c.unread = 0;
    this.push(c, { from: "system", text: `${this.user?.name ?? "Equipe"} assumiu o atendimento.` });
    return null;
  }

  sendAgentMessage(conversationId: string, text: string): Result {
    const c = this.conversation(conversationId);
    if (!c) return "Conversa não encontrada.";
    if (!text.trim()) return "Escreva uma mensagem.";
    if (c.status !== "human") return "Assuma o atendimento para responder.";
    if (!this.windowOpen(c)) return "Já se passaram 24 horas desde a última mensagem do cliente. Pelas regras do WhatsApp, agora só é possível enviar um modelo aprovado.";
    this.push(c, { from: "agent", text: text.trim(), author: this.user?.name, status: "pending" });
    return null;
  }

  returnToBot(conversationId: string): Result {
    const c = this.conversation(conversationId);
    if (!c || c.status === "resolved") return "Conversa não encontrada.";
    c.status = "bot";
    c.failures = 0;
    this.push(c, { from: "system", text: "Conversa devolvida para a IA." });
    return null;
  }

  resolve(conversationId: string): Result {
    const c = this.conversation(conversationId);
    if (!c) return "Conversa não encontrada.";
    if (c.status === "resolved") return null;
    const byAi = c.status === "bot";
    c.status = "resolved";
    c.resolvedBy = byAi ? "ai" : "human";
    c.unread = 0;
    if (byAi) this.bump(this.workspace(c.workspaceId)!, "ai");
    this.push(c, { from: "system", text: byAi ? "Resolvida pela IA." : "Atendimento encerrado pela equipe." });
    return null;
  }

  markRead(conversationId: string) {
    const c = this.conversation(conversationId);
    if (c) c.unread = 0;
  }

  // ------------------------------------------------------------------ integrações

  /** Etapa 1 da conexão (na versão real: cadastro incorporado da Meta). */
  startWhatsApp(workspaceId: string, phone: string, displayName: string): Result {
    const w = this.workspace(workspaceId);
    if (!w) return "Empresa não encontrada.";
    if (phone.replace(/\D/g, "").length < 12) return "Informe o número com DDD (ex.: +55 63 98765-4321).";
    if (displayName.trim().length < 3) return "Informe o nome que aparecerá para os clientes.";
    w.whatsapp = { status: "pending", phone, displayName: displayName.trim() };
    return null;
  }

  /** Etapa 2: código recebido por SMS (demonstração: qualquer código de 6 dígitos). */
  verifyWhatsApp(workspaceId: string, code: string): Result {
    const w = this.workspace(workspaceId);
    if (!w || w.whatsapp.status !== "pending") return "Comece a conexão novamente.";
    if (!/^\d{6}$/.test(code)) return "O código tem 6 números.";
    const now = new Date().toISOString();
    w.whatsapp = { ...w.whatsapp, status: "connected", connectedAt: now, lastSyncAt: now };
    return null;
  }

  /** Servidor: conexão real com a API do WhatsApp (o token fica fora destes dados, cifrado). */
  connectWhatsApp(workspaceId: string, conn: { mode: "embedded" | "manual"; phone: string; displayName: string; phoneNumberId: string; wabaId?: string }): Result {
    const w = this.workspace(workspaceId);
    if (!w) return "Empresa não encontrada.";
    const now = new Date().toISOString();
    w.whatsapp = { status: "connected", mode: conn.mode, phone: conn.phone, displayName: conn.displayName, phoneNumberId: conn.phoneNumberId, wabaId: conn.wabaId, connectedAt: now, lastSyncAt: now };
    return null;
  }

  /** Servidor: registra a última falha da integração (aparece para o cliente e o suporte). */
  setWhatsAppError(workspaceId: string, error?: string) {
    const w = this.workspace(workspaceId);
    if (!w) return;
    w.whatsapp.lastError = error;
    if (!error) w.whatsapp.lastSyncAt = new Date().toISOString();
  }

  disconnectWhatsApp(workspaceId: string) {
    const w = this.workspace(workspaceId);
    if (w) w.whatsapp = { status: "disconnected", phone: "", displayName: w.name };
  }

  setIntegration(workspaceId: string, id: IntegrationId, enabled: boolean, target?: string): Result {
    const w = this.workspace(workspaceId);
    if (!w) return "Empresa não encontrada.";
    if (id === "webhook" && enabled && !/^https:\/\/\S+$/.test(target ?? "")) return "Informe a URL do webhook começando com https://";
    if (id === "instagram") return "Instagram Direct estará disponível em breve.";
    w.integrations[id] = enabled ? { enabled: true, target: target?.trim() || undefined, connectedAt: new Date().toISOString() } : { enabled: false };
    return null;
  }

  // ------------------------------------------------------------------ plano e cobrança

  changePlan(workspaceId: string, planId: PlanId): Result {
    const w = this.workspace(workspaceId);
    if (!w) return "Empresa não encontrada.";
    if (w.planId === planId) return "Este já é o seu plano.";
    const plan = this.plan(planId);
    const items = this.knowledgeOf(workspaceId).length;
    if (plan.knowledgeLimit !== null && items > plan.knowledgeLimit) return `O plano ${plan.name} permite ${plan.knowledgeLimit} conteúdos; você tem ${items}. Remova alguns antes de mudar.`;
    w.planId = planId;
    const next = this.invoices.find((i) => i.workspaceId === workspaceId && i.status === "pending");
    if (next) Object.assign(next, { planId, amount: plan.price });
    return null;
  }

  updateCard(workspaceId: string, number: string, expires: string): Result {
    const w = this.workspace(workspaceId);
    const digits = number.replace(/\D/g, "");
    if (!w) return "Empresa não encontrada.";
    if (digits.length < 13 || digits.length > 19) return "Número de cartão inválido.";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expires)) return "Validade no formato MM/AA.";
    w.card = { brand: digits.startsWith("4") ? "VISA" : digits.startsWith("5") ? "MASTERCARD" : "CARTÃO", last4: digits.slice(-4), expires };
    return null;
  }

  /** Demonstração: pagamento aprovado (na etapa de APIs, confirmado pelo gateway). */
  payInvoice(invoiceId: string): Result {
    const inv = this.invoices.find((i) => i.id === invoiceId);
    if (!inv || inv.status === "paid") return "Fatura não encontrada ou já paga.";
    const w = this.workspace(inv.workspaceId);
    if (!w?.card && this.role !== "admin") return "Cadastre um cartão antes de pagar.";
    inv.status = "paid";
    inv.paidAt = new Date().toISOString();
    if (w && (w.status === "past_due" || w.status === "suspended") && !this.invoices.some((i) => i.workspaceId === w.id && i.status === "overdue")) {
      w.status = "active";
      if (w.whatsapp.phone) w.whatsapp.status = "connected";
    }
    return null;
  }

  /** Fim do teste grátis: passa a ativo com a primeira fatura. */
  activateSubscription(workspaceId: string): Result {
    const w = this.workspace(workspaceId);
    if (!w || w.status !== "trial") return "Assinatura já ativa.";
    if (!w.card) return "Cadastre um cartão para ativar a assinatura.";
    const today = dayKey();
    w.status = "active";
    w.trialEndsAt = undefined;
    w.renewsAt = addDays(today, 30);
    this.invoices.push({ id: newId(), workspaceId, period: today.slice(0, 7), planId: w.planId, amount: this.plan(w.planId).price, dueDate: today, status: "paid", paidAt: new Date().toISOString() });
    this.invoices.push({ id: newId(), workspaceId, period: w.renewsAt.slice(0, 7), planId: w.planId, amount: this.plan(w.planId).price, dueDate: w.renewsAt, status: "pending" });
    return null;
  }

  cancelSubscription(workspaceId: string): Result {
    const w = this.workspace(workspaceId);
    if (!w || w.status === "cancelled") return "Assinatura não encontrada.";
    w.status = "cancelled";
    w.whatsapp.status = "disconnected";
    this.invoices = this.invoices.filter((i) => !(i.workspaceId === workspaceId && i.status === "pending"));
    return null;
  }

  // ------------------------------------------------------------------ backoffice

  setWorkspaceStatus(workspaceId: string, status: WorkspaceStatus): Result {
    if (this.role !== "admin") return "Ação exclusiva do backoffice.";
    const w = this.workspace(workspaceId);
    if (!w) return "Empresa não encontrada.";
    w.status = status;
    if (status === "suspended" || status === "cancelled") w.whatsapp.status = "disconnected";
    else if (w.whatsapp.phone) w.whatsapp.status = "connected";
    return null;
  }

  updatePlan(planId: PlanId, patch: Partial<Pick<Plan, "price" | "conversations" | "numbers" | "knowledgeLimit" | "description">>): Result {
    if (this.role !== "admin") return "Ação exclusiva do backoffice.";
    const p = this.plans.find((x) => x.id === planId);
    if (!p) return "Plano não encontrado.";
    const next = { ...p, ...patch };
    if (!(next.price > 0)) return "Informe um preço maior que zero.";
    if (!(next.conversations >= 100)) return "Mínimo de 100 conversas por mês.";
    if (!(next.numbers >= 1)) return "Ao menos 1 número de WhatsApp.";
    if (next.knowledgeLimit !== null && !(next.knowledgeLimit >= 5)) return "Base com ao menos 5 conteúdos (ou ilimitada).";
    Object.assign(p, next);
    p.features = [
      `${p.numbers} ${p.numbers > 1 ? "números" : "número"} de WhatsApp`,
      `${p.conversations.toLocaleString("pt-BR")} conversas/mês`,
      p.knowledgeLimit === null ? "Base de conhecimento ilimitada" : `Base com até ${p.knowledgeLimit} conteúdos`,
      ...p.features.slice(3),
    ];
    return null;
  }

  updateSettings(patch: Partial<PlatformSettings>): Result {
    if (this.role !== "admin") return "Ação exclusiva do backoffice.";
    const next = { ...this.settings, ...patch };
    if (!(next.trialDays >= 0 && next.trialDays <= 60)) return "Teste grátis entre 0 e 60 dias.";
    if (!(next.usageAlert >= 0.5 && next.usageAlert <= 1)) return "Alerta de uso entre 50% e 100%.";
    this.settings = next;
    return null;
  }

  /** Rotina diária: faturas vencidas marcam a empresa como "pagamento pendente". */
  tick(today = dayKey()) {
    for (const inv of this.invoices) if (inv.status === "pending" && inv.dueDate < today) inv.status = "overdue";
    for (const w of this.workspaces) {
      if (w.status === "active" && this.invoices.some((i) => i.workspaceId === w.id && i.status === "overdue")) w.status = "past_due";
    }
  }
}
