import "server-only";
import { respond, type BotResult } from "@/modules/bot/engine";
import type { AssistantConfig, KnowledgeItem, Message } from "@/modules/domain/types";
import { aiConfig, askClaude } from "./claude";

/**
 * Quem responde ao cliente:
 *  1. regras fixas primeiro (palavras que pedem atendente e horário da equipe) — motor local;
 *  2. IA (Claude) com a base de conhecimento, quando ANTHROPIC_API_KEY estiver configurada;
 *  3. sem IA (ou se ela falhar), o motor local por busca na base.
 * Depois, a regra de "transferir após N respostas sem informação" vale para os dois.
 */
export interface ReplyInput {
  config: AssistantConfig;
  company: string;
  knowledge: KnowledgeItem[];
  history: Pick<Message, "from" | "text">[];
  failures: number;
  contactName?: string;
  now?: Date;
}

export async function generateReply(input: ReplyInput): Promise<BotResult & { engine: "ia" | "local"; aiError?: string }> {
  const text = [...input.history].reverse().find((m) => m.from === "customer")?.text ?? "";
  const local = respond({ text, config: input.config, knowledge: input.knowledge, first: input.history.filter((m) => m.from === "customer").length <= 1, failures: input.failures, contactName: input.contactName, now: input.now });
  // Regras fixas e sem IA: o motor local decide.
  if (local.action === "handoff" && input.config.handoffKeywords.some((k) => k && text.toLowerCase().includes(k.toLowerCase()))) return { ...local, engine: "local" };
  if (local.action === "out_of_hours" || !aiConfig().enabled) return { ...local, engine: "local" };
  try {
    const ai = await askClaude({ config: input.config, company: input.company, knowledge: input.knowledge, history: input.history });
    if (ai.action === "fallback" && input.failures + 1 >= input.config.handoffAfterFailures) {
      // Mesma regra do motor local: depois de N tentativas, chama a equipe (respeitando o horário).
      const forced = respond({ text: "", config: input.config, knowledge: [], first: false, failures: input.failures, now: input.now });
      return { ...forced, topic: ai.topic, engine: "ia" };
    }
    return { action: ai.action, reply: ai.reply, sources: ai.sources, topic: ai.topic, engine: "ia" };
  } catch (error) {
    console.error("[ia] falha; usando o motor local", error);
    return { ...local, engine: "local", aiError: (error as Error).message };
  }
}
