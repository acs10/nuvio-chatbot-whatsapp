import type { AssistantConfig, KnowledgeItem, Tone } from "@/modules/domain/types";

/**
 * Motor de respostas da DEMONSTRAÇÃO. Busca a melhor resposta na base de conhecimento por
 * palavras em comum (com sinônimos simples) e aplica as regras do assistente: saudação,
 * pedido de atendente, horário de atendimento e transferência após falhas.
 * Na etapa de APIs, `respond` passa a chamar um modelo de IA (ex.: Claude) com a base como
 * contexto — as regras e o formato do resultado continuam os mesmos.
 */

export type BotAction = "greeting" | "answer" | "fallback" | "handoff" | "out_of_hours";

export interface BotResult {
  action: BotAction;
  reply: string;
  /** Ids dos conteúdos usados */
  sources: string[];
  topic: string;
}

const STOPWORDS = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por para pra pro com sem e ou que qual quais quanta como quando se eu voce vc voces me te lhe meu minha seu sua nos vos ao aos isso isto esse essa este esta aquilo tem ter ha há sobre mais muito pouco ja já so só tambem também ola olá oi bom boa dia tarde noite gostaria queria quero preciso pode podem poderia saber informar favor obrigado obrigada sim nao não é e foi ser sao são está esta estou vai vou fazer faz tudo bem".split(" "),
);

/** Variações comuns → forma única (assim "preço", "valor" e "custa" se encontram). */
const SYNONYMS: Record<string, string> = {
  preco: "valor", precos: "valor", valores: "valor", custa: "valor", custo: "valor", quanto: "valor", pagar: "pagamento", pagamentos: "pagamento", parcelar: "parcelamento", parcela: "parcelamento", parcelas: "parcelamento", cartao: "pagamento", pix: "pagamento",
  agendar: "agendamento", agenda: "agendamento", marcar: "agendamento", horarios: "horario", consulta: "agendamento", consultas: "agendamento", avaliacao: "agendamento", remarcar: "remarcacao", desmarcar: "cancelamento", cancelar: "cancelamento",
  endereco: "localizacao", fica: "localizacao", onde: "localizacao", local: "localizacao", estacionamento: "localizacao",
  funciona: "funcionamento", abre: "funcionamento", fecha: "funcionamento", aberto: "funcionamento", sabado: "funcionamento", domingo: "funcionamento",
  entrega: "entrega", frete: "entrega", prazo: "prazo", demora: "prazo", devolver: "troca", devolucao: "troca", trocar: "troca",
  matricula: "matricula", matriculas: "matricula", mensalidade: "valor", mensalidades: "valor",
  multa: "taxa", multas: "taxa", faltar: "falta", faltei: "falta", faltou: "falta", atraso: "atrasar", atrasos: "atrasar",
};

/** Assuntos para o relatório "Assuntos mais frequentes". */
const TOPICS: [string, string[]][] = [
  ["Agendamentos", ["agendamento", "remarcacao", "cancelamento"]],
  ["Valores e pagamento", ["valor", "pagamento", "parcelamento"]],
  ["Horário e localização", ["funcionamento", "localizacao", "horario"]],
  ["Entregas e trocas", ["entrega", "prazo", "troca"]],
];

export function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ");
}

export function tokens(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] ?? (t.length > 4 && t.endsWith("s") ? SYNONYMS[t.slice(0, -1)] ?? t.slice(0, -1) : t));
}

const GREETING = /^(oi+|ola|bom dia|boa tarde|boa noite|e ai|hello|hey)\b/;

/** Trechos pesquisáveis de cada conteúdo (FAQ inteira; textos em parágrafos/frases). */
function chunks(item: KnowledgeItem): { text: string; reply: string }[] {
  if (item.kind === "faq") return [{ text: `${item.question ?? ""} ${item.title} ${item.content}`, reply: item.content }];
  return item.content
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 12)
    .map((p) => ({ text: `${item.title} ${p}`, reply: p }));
}

export function topicOf(text: string): string {
  const t = new Set(tokens(text));
  for (const [topic, keys] of TOPICS) if (keys.some((k) => t.has(k))) return topic;
  return "Dúvidas gerais";
}

function inHours(config: AssistantConfig, now: Date): boolean {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now).map((p) => [p.type, p.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!);
  const hhmm = `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
  return config.hours.days.includes(day as AssistantConfig["hours"]["days"][number]) && hhmm >= config.hours.start && hhmm < config.hours.end;
}

const OPENERS: Record<Tone, string[]> = {
  amigavel: ["Claro! ", "Com certeza! ", "Boa pergunta! "],
  profissional: ["", "Certo. ", "Informação: "],
  descontraido: ["Opa! ", "Bora lá! ", "Fácil! "],
};

/** Melhor trecho da base para a pergunta (ou null). */
export function search(question: string, knowledge: KnowledgeItem[]): { item: KnowledgeItem; reply: string; score: number } | null {
  const q = new Set(tokens(question));
  if (!q.size) return null;
  let best: { item: KnowledgeItem; reply: string; score: number } | null = null;
  for (const item of knowledge) {
    if (!item.active || item.status !== "ready") continue;
    for (const c of chunks(item)) {
      const words = new Set(tokens(c.text));
      let hits = 0;
      for (const t of q) if (words.has(t)) hits += 1;
      // proporção da pergunta coberta + leve bônus para FAQ (resposta pensada para isso)
      const score = hits / q.size + (item.kind === "faq" && hits ? 0.15 : 0);
      if (hits && (!best || score > best.score)) best = { item, reply: c.reply, score };
    }
  }
  return best && best.score >= 0.34 ? best : null;
}

export interface RespondInput {
  text: string;
  config: AssistantConfig;
  knowledge: KnowledgeItem[];
  /** Primeira mensagem da conversa */
  first: boolean;
  /** Falhas seguidas até agora */
  failures: number;
  contactName?: string;
  now?: Date;
  /** Variação determinística dos inícios de frase (testes) */
  seed?: number;
}

export function respond(input: RespondInput): BotResult {
  const { config, text } = input;
  const now = input.now ?? new Date();
  const norm = normalize(text).trim();
  const topic = topicOf(text);
  const opener = OPENERS[config.tone][(input.seed ?? now.getSeconds()) % 3];
  const firstName = input.contactName?.split(" ")[0];

  const wantsHuman = config.handoffKeywords.some((k) => k.trim() && norm.includes(normalize(k).trim()));
  if (wantsHuman) {
    if (!inHours(config, now)) return { action: "out_of_hours", reply: config.outOfHoursMessage, sources: [], topic };
    return { action: "handoff", reply: "Entendi! Vou transferir você para alguém da nossa equipe, que já vai ver todo o nosso histórico. Só um instante. 🙂", sources: [], topic };
  }

  const found = search(text, input.knowledge);
  if (found) return { action: "answer", reply: `${opener}${found.reply}`, sources: [found.item.id], topic };

  if (GREETING.test(norm) && norm.split(/\s+/).length <= 4) {
    const greet = config.greeting.replace("{nome}", firstName ?? "").replace(/\s+,/, ",");
    return { action: "greeting", reply: greet, sources: [], topic: "Saudação" };
  }

  if (input.failures + 1 >= config.handoffAfterFailures) {
    if (!inHours(config, now)) return { action: "out_of_hours", reply: config.outOfHoursMessage, sources: [], topic };
    return { action: "handoff", reply: "Não encontrei essa informação com segurança, então vou chamar alguém da equipe para te ajudar. Só um instante!", sources: [], topic };
  }
  return { action: "fallback", reply: config.fallback, sources: [], topic };
}
