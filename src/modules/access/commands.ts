import { TONE_LABEL, type AssistantConfig, type IntegrationId, type KnowledgeKind, type PlanId, type Tone, type Weekday, type WorkspaceStatus } from "@/modules/domain/types";
import type { PlatformStore } from "@/modules/platform/platform-store";
import type { ViewActor } from "./views";

/**
 * Ações que o navegador pode pedir ao servidor. Cada uma:
 *  1. confere o perfil (vem da sessão, nunca do navegador) e se o alvo é da empresa do usuário;
 *  2. limpa os argumentos (só campos conhecidos, tipos e tamanhos certos);
 *  3. chama a MESMA regra do PlatformStore que a tela usou.
 */
export interface CommandContext {
  /** Pagamento real ligado: cliente não pode "pagar" fatura sozinho. */
  paymentsLive: boolean;
}
type Handler = (s: PlatformStore, actor: ViewActor, args: unknown[], ctx: CommandContext) => unknown;

const DENIED = "Ação não permitida para o seu perfil.";
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (list.includes(v as T) ? (v as T) : undefined);
const isAdmin = (a: ViewActor) => a.role === "admin";

/** O alvo é da empresa do usuário (cliente) ou o usuário é do backoffice. */
const ownsWorkspace = (a: ViewActor, workspaceId: unknown) => isAdmin(a) || (a.role === "client" && workspaceId === a.workspaceId);
const ownsConversation = (s: PlatformStore, a: ViewActor, id: unknown) => {
  const c = s.conversation(str(id, 60));
  return !!c && a.role === "client" && c.workspaceId === a.workspaceId;
};
const ownsKnowledge = (s: PlatformStore, a: ViewActor, id: unknown) => {
  const k = s.knowledge.find((x) => x.id === str(id, 60));
  return !!k && a.role === "client" && k.workspaceId === a.workspaceId;
};
const ownsInvoice = (s: PlatformStore, a: ViewActor, id: unknown) => {
  const inv = s.invoices.find((x) => x.id === str(id, 60));
  return !!inv && (isAdmin(a) || inv.workspaceId === a.workspaceId);
};

const TONES = Object.keys(TONE_LABEL) as Tone[];
const KINDS: KnowledgeKind[] = ["faq", "text", "document", "site"];
const PLANS: PlanId[] = ["essencial", "profissional", "escala"];
const INTEGRATIONS: IntegrationId[] = ["google-calendar", "google-sheets", "rd-station", "webhook", "instagram"];
const STATUSES: WorkspaceStatus[] = ["trial", "active", "past_due", "suspended", "cancelled"];
const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : undefined);

export const COMMANDS = {
  updateAssistant: (s, a, [wid, raw]) => {
    if (a.role !== "client" || wid !== a.workspaceId) return DENIED;
    const p = obj(raw);
    const hours = obj(p.hours);
    const patch: Partial<AssistantConfig> = {};
    if ("name" in p) patch.name = str(p.name, 40);
    if ("tone" in p) patch.tone = oneOf(p.tone, TONES) ?? "amigavel";
    if ("objective" in p) patch.objective = str(p.objective, 600);
    if ("greeting" in p) patch.greeting = str(p.greeting, 400);
    if ("fallback" in p) patch.fallback = str(p.fallback, 400);
    if ("outOfHoursMessage" in p) patch.outOfHoursMessage = str(p.outOfHoursMessage, 400);
    if ("handoffKeywords" in p) patch.handoffKeywords = (Array.isArray(p.handoffKeywords) ? p.handoffKeywords : []).map((k) => str(k, 40)).slice(0, 20);
    if ("handoffAfterFailures" in p) patch.handoffAfterFailures = Math.round(num(p.handoffAfterFailures));
    if ("active" in p) patch.active = p.active === true;
    if ("hours" in p)
      patch.hours = {
        days: (Array.isArray(hours.days) ? hours.days : []).filter((d): d is Weekday => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6),
        start: time(hours.start) ?? "08:00",
        end: time(hours.end) ?? "18:00",
      };
    return s.updateAssistant(a.workspaceId!, patch);
  },

  saveKnowledge: (s, a, [wid, raw]) => {
    if (a.role !== "client" || wid !== a.workspaceId) return DENIED;
    const i = obj(raw);
    const kind = oneOf(i.kind, KINDS);
    if (!kind) return "Tipo de conteúdo inválido.";
    const id = typeof i.id === "string" ? i.id : undefined;
    if (id && !ownsKnowledge(s, a, id)) return DENIED;
    return s.saveKnowledge(a.workspaceId!, { id, kind, title: str(i.title, 120), content: str(i.content, 20000), question: kind === "faq" ? str(i.question, 400) : undefined, url: kind === "site" ? str(i.url, 300) : undefined, fileName: kind === "document" ? str(i.fileName, 160) || undefined : undefined });
  },
  finishProcessing: (s, a, [id]) => (ownsKnowledge(s, a, id) ? (s.finishProcessing(str(id, 60)), null) : DENIED),
  toggleKnowledge: (s, a, [id]) => (ownsKnowledge(s, a, id) ? (s.toggleKnowledge(str(id, 60)), null) : DENIED),
  removeKnowledge: (s, a, [id]) => (ownsKnowledge(s, a, id) ? (s.removeKnowledge(str(id, 60)), null) : DENIED),

  /** Demonstração: simula um cliente escrevendo (conversas marcadas como demo nunca vão ao WhatsApp real). */
  simulateIncoming: (s, a, [wid, text]) => (a.role === "client" && wid === a.workspaceId ? (s.simulateIncoming(a.workspaceId!, text === undefined ? undefined : str(text, 1000)) ? null : "Empresa não encontrada.") : DENIED),
  receiveMessage: (s, a, [id, text]) => {
    if (!ownsConversation(s, a, id)) return DENIED;
    if (!s.conversation(str(id, 60))!.demo) return "Só é possível simular mensagens em conversas de demonstração.";
    return s.receiveMessage(str(id, 60), str(text, 1000));
  },
  takeOver: (s, a, [id]) => (ownsConversation(s, a, id) ? s.takeOver(str(id, 60)) : DENIED),
  sendAgentMessage: (s, a, [id, text]) => (ownsConversation(s, a, id) ? s.sendAgentMessage(str(id, 60), str(text, 4000)) : DENIED),
  returnToBot: (s, a, [id]) => (ownsConversation(s, a, id) ? s.returnToBot(str(id, 60)) : DENIED),
  resolve: (s, a, [id]) => (ownsConversation(s, a, id) ? s.resolve(str(id, 60)) : DENIED),
  markRead: (s, a, [id]) => (ownsConversation(s, a, id) ? (s.markRead(str(id, 60)), null) : DENIED),

  /** Conexão simulada (demonstração). A conexão real é feita por /api/whatsapp/*. */
  startWhatsApp: (s, a, [wid, phone, name]) => (a.role === "client" && wid === a.workspaceId ? s.startWhatsApp(a.workspaceId!, str(phone, 30), str(name, 80)) : DENIED),
  verifyWhatsApp: (s, a, [wid, code]) => (a.role === "client" && wid === a.workspaceId ? s.verifyWhatsApp(a.workspaceId!, str(code, 10)) : DENIED),
  disconnectWhatsApp: (s, a, [wid]) => (ownsWorkspace(a, wid) ? (s.disconnectWhatsApp(str(wid, 60)), null) : DENIED),
  setIntegration: (s, a, [wid, id, enabled, target]) => {
    if (a.role !== "client" || wid !== a.workspaceId) return DENIED;
    const integration = oneOf(id, INTEGRATIONS);
    return integration ? s.setIntegration(a.workspaceId!, integration, enabled === true, target === undefined ? undefined : str(target, 300)) : "Integração inválida.";
  },

  changePlan: (s, a, [wid, plan]) => {
    if (!ownsWorkspace(a, wid)) return DENIED;
    const p = oneOf(plan, PLANS);
    return p ? s.changePlan(str(wid, 60), p) : "Plano inválido.";
  },
  updateCard: (s, a, [wid, number, expires]) => (a.role === "client" && wid === a.workspaceId ? s.updateCard(a.workspaceId!, str(number, 30), str(expires, 5)) : DENIED),
  /** Demonstração: o cliente "paga". Com o gateway ligado, só a confirmação do gateway (ou o backoffice) quita. */
  payInvoice: (s, a, [id], ctx) => {
    if (!ownsInvoice(s, a, id)) return DENIED;
    if (ctx.paymentsLive && !isAdmin(a)) return "O pagamento é confirmado automaticamente pelo gateway.";
    return s.payInvoice(str(id, 60));
  },
  activateSubscription: (s, a, [wid]) => (a.role === "client" && wid === a.workspaceId ? s.activateSubscription(a.workspaceId!) : DENIED),
  cancelSubscription: (s, a, [wid]) => (a.role === "client" && wid === a.workspaceId ? s.cancelSubscription(a.workspaceId!) : DENIED),

  // ---- backoffice
  setWorkspaceStatus: (s, a, [wid, status]) => {
    if (!isAdmin(a)) return DENIED;
    const st = oneOf(status, STATUSES);
    return st ? s.setWorkspaceStatus(str(wid, 60), st) : "Situação inválida.";
  },
  updatePlan: (s, a, [plan, raw]) => {
    if (!isAdmin(a)) return DENIED;
    const p = oneOf(plan, PLANS);
    const r = obj(raw);
    if (!p) return "Plano inválido.";
    return s.updatePlan(p, { price: num(r.price), conversations: Math.round(num(r.conversations)), numbers: Math.round(num(r.numbers)), knowledgeLimit: r.knowledgeLimit === null ? null : Math.round(num(r.knowledgeLimit)), description: str(r.description, 200) });
  },
  updateSettings: (s, a, [raw]) => {
    if (!isAdmin(a)) return DENIED;
    const r = obj(raw);
    return s.updateSettings({ trialDays: Math.round(num(r.trialDays)), usageAlert: num(r.usageAlert) });
  },
} satisfies Record<string, Handler>;

export type CommandName = keyof typeof COMMANDS;
export const isCommand = (name: unknown): name is CommandName => typeof name === "string" && Object.hasOwn(COMMANDS, name);

export function runCommand(s: PlatformStore, actor: ViewActor, name: CommandName, args: unknown[], ctx: CommandContext = { paymentsLive: false }): { error: string | null } {
  const result = (COMMANDS[name] as Handler)(s, actor, Array.isArray(args) ? args : [], ctx);
  return { error: typeof result === "string" ? result : null };
}
