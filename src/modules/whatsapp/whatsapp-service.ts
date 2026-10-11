import "server-only";
import { randomInt } from "node:crypto";
import { formatWhatsAppPhone } from "@/core/lib/format";
import { generateReply } from "@/modules/ai/responder";
import type { PlatformData } from "@/modules/domain/types";
import { getBackend } from "@/modules/server/backend";
import { mutate, readData } from "@/modules/server/platform-service";
import { decryptSecret, encryptSecret } from "@/modules/server/secrets";
import { exchangeCode, explainGraphError, getPhone, markRead, registerPhone, sendText, subscribeApp } from "./cloud-api";
import { parseWebhook } from "./webhook";

/**
 * Orquestra o WhatsApp no servidor:
 *  receber (webhook) → gravar a mensagem → IA responde → enviar pela Cloud API → acompanhar entrega.
 * Conversas de demonstração e empresas sem conexão real nunca enviam nada: ficam como "simulated".
 */

// ------------------------------------------------------------------ token de cada empresa (cifrado, fora dos dados)

const tokenKey = (workspaceId: string) => `wa-${workspaceId}`;

async function saveToken(workspaceId: string, info: { token: string; phoneNumberId: string; wabaId?: string; pin?: string }) {
  await getBackend().setPrivate(tokenKey(workspaceId), { tokenEnc: encryptSecret(info.token), phoneNumberId: info.phoneNumberId, wabaId: info.wabaId ?? "", pinEnc: info.pin ? encryptSecret(info.pin) : "", savedAt: new Date().toISOString() });
}

async function tokenOf(workspaceId: string): Promise<{ token: string; phoneNumberId: string } | null> {
  const doc = await getBackend().getPrivate(tokenKey(workspaceId));
  const token = doc ? decryptSecret(String(doc.tokenEnc ?? "")) : "";
  return token ? { token, phoneNumberId: String(doc!.phoneNumberId) } : null;
}

// ------------------------------------------------------------------ conectar

/**
 * Conexão manual: id do número + token (ex.: número de TESTE da Meta, ou token de usuário do sistema).
 * Valida na Meta antes de salvar.
 */
export async function connectManual(workspaceId: string, input: { phoneNumberId: string; wabaId?: string; token: string }): Promise<string | null> {
  let phone;
  try {
    phone = await getPhone(input.token, input.phoneNumberId);
  } catch (e) {
    return `A Meta recusou os dados: ${explainGraphError(e)}`;
  }
  await saveToken(workspaceId, input);
  const { result } = await mutate((s) => s.connectWhatsApp(workspaceId, { mode: "manual", phone: formatWhatsAppPhone(phone.display_phone_number), displayName: phone.verified_name, phoneNumberId: input.phoneNumberId, wabaId: input.wabaId }));
  return result;
}

/**
 * Cadastro incorporado (botão "Conectar com o Facebook"): a Meta devolve um código e os ids da conta
 * e do número. Trocamos o código por token, inscrevemos o app na conta (webhooks) e registramos o número.
 */
export async function connectEmbedded(workspaceId: string, input: { code: string; wabaId: string; phoneNumberId: string }): Promise<string | null> {
  try {
    const token = await exchangeCode(input.code);
    await subscribeApp(token, input.wabaId);
    const pin = String(randomInt(100000, 999999));
    await registerPhone(token, input.phoneNumberId, pin);
    const phone = await getPhone(token, input.phoneNumberId);
    await saveToken(workspaceId, { token, phoneNumberId: input.phoneNumberId, wabaId: input.wabaId, pin });
    const { result } = await mutate((s) => s.connectWhatsApp(workspaceId, { mode: "embedded", phone: formatWhatsAppPhone(phone.display_phone_number), displayName: phone.verified_name, phoneNumberId: input.phoneNumberId, wabaId: input.wabaId }));
    return result;
  } catch (e) {
    console.error("[whatsapp] cadastro incorporado falhou", e);
    return `Não foi possível concluir a conexão: ${explainGraphError(e)}`;
  }
}

export async function disconnect(workspaceId: string) {
  await getBackend().setPrivate(tokenKey(workspaceId), null);
  await mutate((s) => s.disconnectWhatsApp(workspaceId));
}

// ------------------------------------------------------------------ responder e enviar

const isReal = (data: PlatformData, workspaceId: string) => {
  const w = data.workspaces.find((x) => x.id === workspaceId);
  return !!w && w.whatsapp.status === "connected" && (w.whatsapp.mode === "manual" || w.whatsapp.mode === "embedded");
};

/** IA responde às conversas da empresa que estão esperando resposta. */
export async function replyPending(workspaceId: string, data?: PlatformData) {
  const snapshot = data ?? (await readData());
  const ws = snapshot.workspaces.find((w) => w.id === workspaceId);
  if (!ws) return;
  const knowledge = snapshot.knowledge.filter((k) => k.workspaceId === workspaceId);
  const waiting = snapshot.conversations.filter((c) => c.workspaceId === workspaceId && c.status === "bot" && c.messages.at(-1)?.from === "customer");
  for (const c of waiting.slice(0, 10)) {
    const lastId = c.messages.at(-1)!.id;
    const r = await generateReply({ config: ws.assistant, company: ws.name, knowledge, history: c.messages, failures: c.failures, contactName: c.contactName });
    // Só aplica se ninguém respondeu nesse meio-tempo (a última mensagem ainda é a mesma).
    await mutate((s) => (s.conversation(c.id)?.messages.at(-1)?.id === lastId ? s.applyBotResult(c.id, r) : null));
  }
}

/** Envia pelo WhatsApp as mensagens pendentes (IA e equipe). Reserva antes de enviar para não duplicar. */
export async function deliverPending(workspaceId: string) {
  const { result: claimed, data } = await mutate((s) => {
    const real = isReal(s.snapshot, workspaceId);
    const list: { conversationId: string; messageId: string; to: string; text: string }[] = [];
    for (const c of s.conversationsOf(workspaceId))
      for (const m of c.messages)
        if (m.status === "pending" && (m.from === "bot" || m.from === "agent")) {
          if (!real || c.demo) s.setDelivery(c.id, m.id, "simulated");
          else {
            s.setDelivery(c.id, m.id, "sending");
            list.push({ conversationId: c.id, messageId: m.id, to: c.phone.replace(/\D/g, ""), text: m.text });
          }
        }
    return list;
  });
  if (!claimed.length) return;
  const creds = await tokenOf(workspaceId);
  for (const item of claimed) {
    try {
      if (!creds) throw new Error("Token do WhatsApp não encontrado. Reconecte o número.");
      const wamid = await sendText(creds.token, creds.phoneNumberId, item.to, item.text);
      await mutate((s) => {
        s.setDelivery(item.conversationId, item.messageId, "sent", wamid);
        s.setWhatsAppError(workspaceId, undefined);
      });
    } catch (e) {
      const why = e instanceof Error && !("code" in e) ? e.message : explainGraphError(e);
      console.error("[whatsapp] envio falhou", item.conversationId, why);
      await mutate((s) => {
        s.setDelivery(item.conversationId, item.messageId, "failed", undefined, why);
        s.setWhatsAppError(workspaceId, why);
      });
    }
  }
  void data;
}

/** Depois de qualquer mudança nas conversas: IA responde e as mensagens são enviadas. */
export async function afterChange(workspaceId: string) {
  await replyPending(workspaceId);
  await deliverPending(workspaceId);
}

// ------------------------------------------------------------------ webhook

/** Processa uma notificação (já com assinatura conferida). Devolve um resumo para o log. */
export async function handleWebhook(payload: unknown): Promise<{ messages: number; statuses: number; ignored: number }> {
  const { inbound, statuses } = parseWebhook(payload);
  let ignored = 0;
  const data = await readData();
  const byNumber = new Map(data.workspaces.filter((w) => w.whatsapp.phoneNumberId && w.whatsapp.status === "connected").map((w) => [w.whatsapp.phoneNumberId!, w.id]));
  const touched = new Set<string>();
  for (const m of inbound) {
    const workspaceId = byNumber.get(m.phoneNumberId);
    if (!workspaceId) {
      ignored += 1;
      continue;
    }
    const { result } = await mutate((s) => s.inbound(workspaceId, { phone: m.from, name: m.name, text: m.text, externalId: m.externalId }));
    if (result) {
      touched.add(workspaceId);
      const creds = await tokenOf(workspaceId);
      if (creds) await markRead(creds.token, creds.phoneNumberId, m.externalId).catch(() => undefined);
    }
  }
  if (statuses.length) await mutate((s) => statuses.forEach((st) => s.markDelivery(st.externalId, st.status, st.error)));
  for (const w of touched) await afterChange(w);
  return { messages: inbound.length - ignored, statuses: statuses.length, ignored };
}
