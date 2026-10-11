import "server-only";
import { NextResponse } from "next/server";
import { viewFor } from "@/modules/access/views";
import { aiConfig } from "@/modules/ai/claude";
import type { PlatformData } from "@/modules/domain/types";
import { waConfig } from "@/modules/whatsapp/cloud-api";
import { actorOf, ConflictError, storeKind, type Actor } from "./platform-service";
import { getSessionAccountId } from "./session";

const NO_STORE = { "Cache-Control": "no-store" };
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** O que o navegador precisa saber sobre as integrações (sem segredos). */
export const serverInfo = () => {
  const wa = waConfig();
  const ai = aiConfig();
  return { store: storeKind(), whatsapp: { enabled: wa.enabled, embedded: wa.embedded, appId: wa.embedded ? wa.appId : "", configId: wa.embedded ? wa.configId : "" }, ai: { enabled: ai.enabled, model: ai.enabled ? ai.model : "" } };
};
export type ServerInfo = ReturnType<typeof serverInfo>;

/** Resposta padrão: quem está logado e os dados que esse perfil pode ver. */
export function stateResponse(data: PlatformData, actor: Actor | null, extra: Record<string, unknown> = {}, status = 200) {
  return json({ me: actor?.id ?? null, info: serverInfo(), data: viewFor(data, actor), ...extra }, status);
}

export async function sessionActor(data: PlatformData): Promise<Actor | null> {
  return actorOf(data.users, await getSessionAccountId(), data);
}

/** Proteção contra CSRF: alterações só a partir de páginas do próprio site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return null;
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function handle(label: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ConflictError) return json({ error: error.message }, 409);
    console.error(`[api] ${label}`, error);
    const quota = /RESOURCE_EXHAUSTED|quota/i.test(String((error as Error)?.message ?? error));
    return json({ error: quota ? "O banco de dados atingiu o limite gratuito de hoje. Tente novamente amanhã." : "Não foi possível acessar o banco de dados agora. Tente de novo em instantes." }, 503);
  }
}
