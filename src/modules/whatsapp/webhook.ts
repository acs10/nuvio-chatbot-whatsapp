import type { DeliveryStatus } from "@/modules/domain/types";

/**
 * Leitura das notificações do WhatsApp Cloud API (webhook "messages" da Meta).
 * Formato: { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {...} }] }] }
 * Função pura (testável sem a Meta).
 */
export interface InboundMessage {
  phoneNumberId: string;
  /** Telefone do cliente só com números, com DDI (ex.: 5563981112233) */
  from: string;
  name: string;
  text: string;
  /** wamid — usado para não processar a mesma mensagem duas vezes */
  externalId: string;
  type: string;
  timestamp: number;
}

export interface StatusUpdate {
  phoneNumberId: string;
  externalId: string;
  status: DeliveryStatus;
  error?: string;
}

const TYPE_LABEL: Record<string, string> = {
  image: "📷 Imagem recebida",
  audio: "🎤 Áudio recebido",
  video: "🎬 Vídeo recebido",
  document: "📎 Documento recebido",
  sticker: "Figurinha recebida",
  location: "📍 Localização recebida",
  contacts: "Contato compartilhado",
  reaction: "Reação",
};

type Json = Record<string, unknown>;
const o = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown) => (typeof v === "string" ? v : "");

/** Texto de uma mensagem (inclui respostas de botões/listas e legenda de mídia). */
function textOf(m: Json): string {
  const type = s(m.type);
  if (type === "text") return s(o(m.text).body);
  if (type === "button") return s(o(m.button).text);
  if (type === "interactive") {
    const i = o(m.interactive);
    return s(o(i.button_reply).title) || s(o(i.list_reply).title);
  }
  const caption = s(o(m[type]).caption);
  const label = TYPE_LABEL[type] ?? `Mensagem do tipo "${type}"`;
  return caption ? `${label}: ${caption}` : `${label} (a IA responde apenas a texto; a equipe pode ver no WhatsApp).`;
}

export function parseWebhook(payload: unknown): { inbound: InboundMessage[]; statuses: StatusUpdate[] } {
  const inbound: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const body = o(payload);
  if (body.object !== "whatsapp_business_account") return { inbound, statuses };
  for (const entry of arr(body.entry)) {
    for (const change of arr(o(entry).changes)) {
      const c = o(change);
      if (c.field !== "messages") continue;
      const value = o(c.value);
      const phoneNumberId = s(o(value.metadata).phone_number_id);
      const names = new Map(arr(value.contacts).map((ct) => [s(o(ct).wa_id), s(o(o(ct).profile).name)]));
      for (const raw of arr(value.messages)) {
        const m = o(raw);
        if (s(m.type) === "reaction") continue; // reações não abrem conversa
        const from = s(m.from).replace(/\D/g, "");
        if (!from || !s(m.id)) continue;
        inbound.push({ phoneNumberId, from, name: names.get(s(m.from)) ?? "", text: textOf(m).slice(0, 4000), externalId: s(m.id), type: s(m.type), timestamp: Number(m.timestamp) || 0 });
      }
      for (const raw of arr(value.statuses)) {
        const st = o(raw);
        const status = s(st.status);
        const mapped: DeliveryStatus | undefined = status === "sent" ? "sent" : status === "delivered" ? "delivered" : status === "read" ? "read" : status === "failed" ? "failed" : undefined;
        if (!mapped || !s(st.id)) continue;
        const err = o(arr(st.errors)[0]);
        statuses.push({ phoneNumberId, externalId: s(st.id), status: mapped, error: mapped === "failed" ? `${s(err.title) || "Falha no envio"}${err.code ? ` (código ${err.code})` : ""}` : undefined });
      }
    }
  }
  return { inbound, statuses };
}
