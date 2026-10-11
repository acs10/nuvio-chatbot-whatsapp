import { generateReply } from "@/modules/ai/responder";
import { TONE_LABEL, type AssistantConfig, type Tone, type Weekday } from "@/modules/domain/types";
import { handle, json, readJson, sameOrigin, sessionActor } from "@/modules/server/api";
import { readData } from "@/modules/server/platform-service";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * "Testar assistente": responde como responderia no WhatsApp (IA ou motor local), usando as regras
 * que estão na tela (mesmo antes de salvar) e a base da empresa. Não grava nada.
 */
export async function POST(req: Request) {
  return handle("assistant-test", async () => {
    if (!sameOrigin(req)) return json({ error: "Origem não permitida." }, 403);
    const data = await readData();
    const actor = await sessionActor(data);
    const ws = data.workspaces.find((w) => w.id === actor?.workspaceId);
    if (!actor || actor.role !== "client" || !ws) return json({ error: "Entre como cliente." }, 401);
    const b = (await readJson(req)) ?? {};
    const c = (b.config && typeof b.config === "object" ? b.config : {}) as Record<string, unknown>;
    const hours = (c.hours && typeof c.hours === "object" ? c.hours : {}) as Record<string, unknown>;
    const config: AssistantConfig = {
      ...ws.assistant,
      name: str(c.name, 40) || ws.assistant.name,
      tone: (Object.keys(TONE_LABEL) as Tone[]).includes(c.tone as Tone) ? (c.tone as Tone) : ws.assistant.tone,
      objective: str(c.objective, 600) || ws.assistant.objective,
      greeting: str(c.greeting, 400) || ws.assistant.greeting,
      fallback: str(c.fallback, 400) || ws.assistant.fallback,
      outOfHoursMessage: str(c.outOfHoursMessage, 400) || ws.assistant.outOfHoursMessage,
      handoffKeywords: Array.isArray(c.handoffKeywords) ? c.handoffKeywords.map((k) => str(k, 40)).filter(Boolean).slice(0, 20) : ws.assistant.handoffKeywords,
      handoffAfterFailures: Number.isInteger(c.handoffAfterFailures) ? Math.min(5, Math.max(1, c.handoffAfterFailures as number)) : ws.assistant.handoffAfterFailures,
      hours: Array.isArray(hours.days) ? { days: (hours.days as unknown[]).filter((d): d is Weekday => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6), start: str(hours.start, 5) || "08:00", end: str(hours.end, 5) || "18:00" } : ws.assistant.hours,
    };
    const history = (Array.isArray(b.history) ? b.history : [])
      .slice(-20)
      .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
      .map((m) => ({ from: m.from === "customer" ? ("customer" as const) : ("bot" as const), text: str(m.text, 1000) }))
      .filter((m) => m.text);
    if (!history.length || history.at(-1)!.from !== "customer") return json({ error: "Escreva uma mensagem." }, 422);
    const failures = Number.isInteger(b.failures) ? Math.min(10, Math.max(0, b.failures as number)) : 0;
    const r = await generateReply({ config, company: ws.name, knowledge: data.knowledge.filter((k) => k.workspaceId === ws.id), history, failures, contactName: actor.name });
    return json({ result: { action: r.action, reply: r.reply, sources: r.sources, topic: r.topic }, engine: r.engine });
  });
}
