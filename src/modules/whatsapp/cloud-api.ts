import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Cloud API (Graph API da Meta). Variáveis:
 *  - META_APP_ID / META_APP_SECRET: aplicativo da Meta (o segredo assina os webhooks e troca o código do cadastro);
 *  - WHATSAPP_VERIFY_TOKEN: texto combinado na configuração do webhook;
 *  - META_CONFIG_ID: configuração do "cadastro incorporado" (Embedded Signup) — opcional;
 *  - META_GRAPH_VERSION: versão da Graph API (padrão v23.0).
 * Sem essas variáveis, a integração fica DESLIGADA e o painel usa a conexão simulada.
 */
export const waConfig = () => ({
  /** Webhook e envio real disponíveis */
  enabled: !!(process.env.META_APP_SECRET?.trim() && process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
  /** Botão "Conectar com o Facebook" (cadastro incorporado) disponível */
  embedded: !!(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim() && process.env.META_CONFIG_ID?.trim()),
  appId: process.env.META_APP_ID?.trim() ?? "",
  configId: process.env.META_CONFIG_ID?.trim() ?? "",
  graphVersion: process.env.META_GRAPH_VERSION?.trim() || "v23.0",
});

/** META_GRAPH_BASE só existe para testes (um servidor que imita a Meta); em produção fica vazio. */
const graph = () => `${process.env.META_GRAPH_BASE?.trim() || "https://graph.facebook.com"}/${waConfig().graphVersion}`;

export class GraphError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    message: string,
  ) {
    super(message);
  }
}

/** Mensagens de erro da Meta mais comuns, em português, para o painel. */
export function explainGraphError(e: unknown): string {
  if (!(e instanceof GraphError)) return "Falha de comunicação com o WhatsApp.";
  const known: Record<number, string> = {
    190: "Token de acesso expirado ou inválido. Gere um novo token na Meta e reconecte.",
    100: "Parâmetro inválido (confira o id do número).",
    131030: "Este número não está na lista de destinatários permitidos do número de teste da Meta.",
    131047: "Mais de 24 h desde a última mensagem do cliente: só é possível enviar um modelo aprovado.",
    131026: "Mensagem não entregue (o número pode não ter WhatsApp).",
    131056: "Muitas mensagens para o mesmo número em pouco tempo.",
    133010: "O número ainda não foi registrado na API do WhatsApp.",
  };
  return (e.code && known[e.code]) || e.message;
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${graph()}${path}`, { ...init, signal: controller.signal, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
    if (!res.ok || body.error) throw new GraphError(res.status, body.error?.code, body.error?.message ?? `Graph API ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Assinatura X-Hub-Signature-256: HMAC-SHA256 do corpo BRUTO com o segredo do app. */
export function verifySignature(rawBody: string, header: string | null, secret = process.env.META_APP_SECRET?.trim()): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function sendText(token: string, phoneNumberId: string, to: string, body: string): Promise<string> {
  const r = await call<{ messages?: { id: string }[] }>(token, `/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: body.slice(0, 4096) } }),
  });
  return r.messages?.[0]?.id ?? "";
}

/** Modelo aprovado (necessário para falar com o cliente depois de 24 h). */
export async function sendTemplate(token: string, phoneNumberId: string, to: string, name: string, language = "pt_BR"): Promise<string> {
  const r = await call<{ messages?: { id: string }[] }>(token, `/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: language } } }),
  });
  return r.messages?.[0]?.id ?? "";
}

/** Marca a mensagem do cliente como lida (os dois tracinhos azuis). */
export async function markRead(token: string, phoneNumberId: string, messageId: string): Promise<void> {
  await call(token, `/${encodeURIComponent(phoneNumberId)}/messages`, { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }) });
}

/** Dados do número (valida o token e o id na conexão manual). */
export function getPhone(token: string, phoneNumberId: string) {
  return call<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }>(token, `/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`);
}

// ------------------------------------------------------------------ cadastro incorporado (Embedded Signup)

/** Troca o código devolvido pelo cadastro incorporado por um token da empresa. */
export async function exchangeCode(code: string): Promise<string> {
  const q = new URLSearchParams({ client_id: process.env.META_APP_ID!.trim(), client_secret: process.env.META_APP_SECRET!.trim(), code });
  const res = await fetch(`${graph()}/oauth/access_token?${q}`, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string; code?: number } };
  if (!res.ok || !body.access_token) throw new GraphError(res.status, body.error?.code, body.error?.message ?? "Não foi possível trocar o código.");
  return body.access_token;
}

/** Inscreve o nosso app na conta do WhatsApp da empresa (para receber os webhooks dela). */
export async function subscribeApp(token: string, wabaId: string) {
  await call(token, `/${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST" });
}

/** Registra o número na Cloud API (PIN de 6 dígitos da verificação em duas etapas). */
export async function registerPhone(token: string, phoneNumberId: string, pin: string) {
  await call(token, `/${encodeURIComponent(phoneNumberId)}/register`, { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", pin }) });
}
