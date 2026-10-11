import { timingSafeEqual } from "node:crypto";
import { verifySignature, waConfig } from "@/modules/whatsapp/cloud-api";
import { handleWebhook } from "@/modules/whatsapp/whatsapp-service";

/**
 * Webhook do WhatsApp Cloud API (configurado no app da Meta: URL deste endereço + token de verificação).
 *  - GET: verificação inicial (hub.challenge) com WHATSAPP_VERIFY_TOKEN;
 *  - POST: mensagens e status; só aceita se a assinatura X-Hub-Signature-256 (META_APP_SECRET) conferir.
 * Sempre responde rápido; erros internos devolvem 500 para a Meta tentar de novo.
 */
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: Request) {
  if (!waConfig().enabled) return new Response("disabled", { status: 404 });
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  if (mode === "subscribe" && same(token, process.env.WHATSAPP_VERIFY_TOKEN!.trim())) return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  if (!waConfig().enabled) return new Response("disabled", { status: 404 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response("too large", { status: 413 });
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("invalid signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  try {
    const summary = await handleWebhook(payload);
    console.info("[webhook] whatsapp", summary);
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("[webhook] falha", error);
    return new Response("error", { status: 500 });
  }
}
