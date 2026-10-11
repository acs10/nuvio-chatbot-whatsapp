/**
 * Modelo de dados da Nuvio (SaaS de atendimento por IA no WhatsApp).
 * Hoje os dados ficam no navegador (demonstração); a etapa de backend troca o repositório
 * por um banco + API mantendo estes mesmos tipos.
 */

export type PlanId = "essencial" | "profissional" | "escala";

export interface Plan {
  id: PlanId;
  name: string;
  /** Mensalidade em reais */
  price: number;
  description: string;
  /** Números de WhatsApp */
  numbers: number;
  /** Conversas por mês */
  conversations: number;
  /** Conteúdos na base de conhecimento (null = ilimitado) */
  knowledgeLimit: number | null;
  features: string[];
  popular?: boolean;
}

export type WorkspaceStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";

export const WORKSPACE_STATUS_LABEL: Record<WorkspaceStatus, string> = {
  trial: "Teste grátis",
  active: "Ativo",
  past_due: "Pagamento pendente",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

export type Tone = "amigavel" | "profissional" | "descontraido";
export const TONE_LABEL: Record<Tone, string> = { amigavel: "Amigável e acolhedor", profissional: "Objetivo e profissional", descontraido: "Leve e descontraído" };

/** 0 = domingo … 6 = sábado */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export interface AssistantConfig {
  name: string;
  tone: Tone;
  objective: string;
  greeting: string;
  /** Resposta quando a IA não encontra a informação na base */
  fallback: string;
  /** Palavras que pedem atendimento humano */
  handoffKeywords: string[];
  /** Transfere para a equipe depois de N respostas sem encontrar a informação */
  handoffAfterFailures: number;
  hours: { days: Weekday[]; start: string; end: string };
  outOfHoursMessage: string;
  active: boolean;
}

export type WhatsAppStatus = "disconnected" | "pending" | "connected";

export interface WhatsAppConnection {
  status: WhatsAppStatus;
  phone: string;
  displayName: string;
  connectedAt?: string;
  lastSyncAt?: string;
  /**
   * demo: simulada (nada é enviado) · embedded: cadastro incorporado da Meta ·
   * manual: ids e token informados (ex.: número de teste da Meta). O token fica só no servidor, cifrado.
   */
  mode?: "demo" | "embedded" | "manual";
  /** Id do número na API do WhatsApp (phone_number_id) */
  phoneNumberId?: string;
  /** Conta do WhatsApp Business (WABA) */
  wabaId?: string;
  /** Última falha de envio/recebimento (para o suporte) */
  lastError?: string;
}

export type IntegrationId = "google-calendar" | "google-sheets" | "rd-station" | "webhook" | "instagram";

export interface IntegrationState {
  enabled: boolean;
  /** Ex.: URL do webhook, nome da agenda */
  target?: string;
  connectedAt?: string;
}

/** Números agregados por dia (o histórico completo não é guardado mensagem a mensagem). */
export interface DailyStat {
  date: string;
  total: number;
  ai: number;
}

export interface Workspace {
  id: string;
  name: string;
  segment: string;
  teamSize: string;
  website?: string;
  planId: PlanId;
  status: WorkspaceStatus;
  createdAt: string;
  trialEndsAt?: string;
  /** Próxima renovação "AAAA-MM-DD" */
  renewsAt: string;
  whatsapp: WhatsAppConnection;
  assistant: AssistantConfig;
  integrations: Partial<Record<IntegrationId, IntegrationState>>;
  daily: DailyStat[];
  card?: { brand: string; last4: string; expires: string };
}

export type KnowledgeKind = "faq" | "text" | "document" | "site";
export const KNOWLEDGE_KIND_LABEL: Record<KnowledgeKind, string> = { faq: "Pergunta e resposta", text: "Texto", document: "Documento", site: "Site" };

export interface KnowledgeItem {
  id: string;
  workspaceId: string;
  kind: KnowledgeKind;
  title: string;
  /** Texto usado pela IA (FAQ: a resposta) */
  content: string;
  /** FAQ: a pergunta */
  question?: string;
  url?: string;
  fileName?: string;
  status: "ready" | "processing";
  active: boolean;
  updatedAt: string;
}

export type ConversationStatus = "bot" | "human" | "waiting" | "resolved";
export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  bot: "Com a IA",
  human: "Em atendimento",
  waiting: "Aguardando equipe",
  resolved: "Resolvida",
};

export interface Message {
  id: string;
  from: "customer" | "bot" | "agent" | "system";
  text: string;
  at: string;
  /** Agente humano que enviou */
  author?: string;
  /** Conteúdos da base usados na resposta da IA */
  sources?: string[];
  /** Id da mensagem no WhatsApp (wamid) — evita duplicar notificações repetidas */
  externalId?: string;
  /** Situação do envio pelo WhatsApp (mensagens da IA e da equipe) */
  status?: DeliveryStatus;
  error?: string;
}

/** pending → sending → sent → delivered → read · failed · simulated (demonstração, sem envio real) */
export type DeliveryStatus = "pending" | "sending" | "sent" | "delivered" | "read" | "failed" | "simulated";

export interface Conversation {
  id: string;
  workspaceId: string;
  contactName: string;
  phone: string;
  topic: string;
  status: ConversationStatus;
  resolvedBy?: "ai" | "human";
  /** Respostas seguidas da IA sem encontrar a informação */
  failures: number;
  messages: Message[];
  startedAt: string;
  updatedAt: string;
  unread: number;
  /** Conversa de demonstração/simulada: nunca é enviada pelo WhatsApp real */
  demo?: boolean;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  /** "AAAA-MM" */
  period: string;
  planId: PlanId;
  amount: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  paidAt?: string;
}

export type Role = "client" | "admin";

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** SHA-256 da senha (demonstração; no backend: hash forte no servidor) */
  passwordHash: string;
  workspaceId?: string;
}

export interface PlatformSettings {
  trialDays: number;
  /** Aviso de uso a partir deste percentual do limite de conversas */
  usageAlert: number;
}

export interface PlatformData {
  plans: Plan[];
  workspaces: Workspace[];
  knowledge: KnowledgeItem[];
  conversations: Conversation[];
  invoices: Invoice[];
  users: User[];
  settings: PlatformSettings;
  /** MRR dos últimos 12 meses (histórico para o gráfico do backoffice) */
  mrrHistory: { month: string; value: number }[];
}
