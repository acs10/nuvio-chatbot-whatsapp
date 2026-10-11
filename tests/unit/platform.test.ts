import { describe, expect, it } from "vitest";
import { respond, search, tokens, topicOf } from "@/modules/bot/engine";
import { createDemoData, defaultAssistant } from "@/modules/platform/demo-data";
import { PlatformStore, type SignupInput } from "@/modules/platform/platform-store";

const NOW = new Date("2026-10-07T13:00:00Z"); // quarta, 10h em Brasília (horário comercial)
const NIGHT = new Date("2026-10-08T01:30:00Z"); // quarta, 22h30 em Brasília
const data = () => createDemoData(NOW);
const lumina = () => {
  const d = data();
  return { config: d.workspaces[0].assistant, knowledge: d.knowledge };
};

describe("UT-01 entendimento das perguntas", () => {
  it("normaliza acentos, ignora palavras vazias e une sinônimos", () => {
    expect(tokens("Qual o PREÇO da avaliação?")).toEqual(["valor", "agendamento"]);
    expect(tokens("Quanto custa?")).toEqual(["valor", "valor"]);
    expect(tokens("Onde fica a clínica?")).toContain("localizacao");
  });

  it("classifica o assunto da conversa", () => {
    expect(topicOf("Dá pra parcelar no cartão?")).toBe("Valores e pagamento");
    expect(topicOf("Quero remarcar minha consulta")).toBe("Agendamentos");
    expect(topicOf("Vocês abrem sábado?")).toBe("Horário e localização");
    expect(topicOf("Vocês vendem bolo?")).toBe("Dúvidas gerais");
  });

  it("encontra a resposta certa na base, inclusive dentro de textos longos", () => {
    const { knowledge } = lumina();
    expect(search("Quanto custa a avaliação?", knowledge)?.item.id).toBe("k-valores");
    expect(search("Aceita PIX?", knowledge)?.item.id).toBe("k-pagamento");
    expect(search("Tem multa se eu faltar?", knowledge)?.reply).toMatch(/taxa de R\$ 50/);
    expect(search("Quanto custa a drenagem linfática?", knowledge)?.reply).toMatch(/R\$ 900/);
    expect(search("Vocês fazem tatuagem?", knowledge)).toBeNull();
  });

  it("não usa conteúdo desativado ou ainda em leitura", () => {
    const { knowledge } = lumina();
    knowledge.find((k) => k.id === "k-valores")!.active = false;
    expect(search("Qual o valor da avaliação?", knowledge)?.item.id).not.toBe("k-valores");
  });
});

describe("UT-02 regras do assistente", () => {
  it("responde pela base com o tom escolhido e cita a fonte", () => {
    const { config, knowledge } = lumina();
    const r = respond({ text: "Qual o endereço?", config, knowledge, first: true, failures: 0, now: NOW, seed: 0 });
    expect(r.action).toBe("answer");
    expect(r.reply).toMatch(/^Claro! Ficamos na Av\. Teotônio Segurado/);
    expect(r.sources).toEqual(["k-endereco"]);
    const pro = respond({ text: "Qual o endereço?", config: { ...config, tone: "profissional" }, knowledge, first: true, failures: 0, now: NOW, seed: 0 });
    expect(pro.reply.startsWith("Ficamos")).toBe(true);
  });

  it("cumprimenta pelo nome", () => {
    const { config, knowledge } = lumina();
    const r = respond({ text: "Oi, bom dia!", config, knowledge, first: true, failures: 0, contactName: "João Carlos", now: NOW });
    expect(r.action).toBe("greeting");
    expect(r.reply).toBe("Olá, João! Sou Lumi, a assistente virtual da Clínica Lumina. Como posso ajudar?");
  });

  it("transfere quando o cliente pede atendente — ou avisa o horário fora do expediente", () => {
    const { config, knowledge } = lumina();
    expect(respond({ text: "quero falar com um atendente", config, knowledge, first: false, failures: 0, now: NOW }).action).toBe("handoff");
    const night = respond({ text: "quero falar com um atendente", config, knowledge, first: false, failures: 0, now: NIGHT });
    expect(night.action).toBe("out_of_hours");
    expect(night.reply).toBe(config.outOfHoursMessage);
  });

  it("depois de N respostas sem informação, transfere para a equipe", () => {
    const { config, knowledge } = lumina();
    const first = respond({ text: "Vocês fazem tatuagem?", config, knowledge, first: false, failures: 0, now: NOW });
    expect(first.action).toBe("fallback");
    expect(respond({ text: "E piercing?", config, knowledge, first: false, failures: 1, now: NOW }).action).toBe("handoff");
  });
});

describe("UT-03 conversas e atendimento humano", () => {
  it("conversa simulada: a IA responde, conta no uso do dia e a equipe assume, responde, devolve e encerra", () => {
    const s = new PlatformStore(data());
    s.setUser("u-lumina");
    const ws = s.current!;
    const before = s.usage(ws).total;
    const id = s.simulateIncoming(ws.id, "Quanto custa a avaliação?")!;
    const c = s.conversation(id)!;
    expect(c.messages.map((m) => m.from)).toEqual(["customer", "bot"]);
    expect(c.messages[1].sources).toEqual(["k-valores"]);
    expect(s.usage(ws).total).toBe(before + 1);
    expect(s.sendAgentMessage(id, "Oi!")).toMatch(/Assuma/);
    expect(s.takeOver(id)).toBeNull();
    expect(s.sendAgentMessage(id, "Posso ajudar em algo mais?")).toBeNull();
    expect(s.receiveMessage(id, "Quanto custa?")).toBeNull();
    expect(c.messages.at(-1)!.from).toBe("customer"); // com humano, a IA não responde
    expect(s.returnToBot(id)).toBeNull();
    expect(s.resolve(id)).toBeNull();
    expect(c.status).toBe("resolved");
    expect(c.resolvedBy).toBe("ai");
  });

  it("pedido de atendente coloca a conversa em espera para a equipe", () => {
    const s = new PlatformStore(data());
    s.setUser("u-lumina");
    const id = s.simulateIncoming(s.current!.id, "quero falar com um atendente")!;
    expect(["waiting"]).toContain(s.conversation(id)!.status);
  });
});

describe("UT-04 base, integrações, cobrança e backoffice", () => {
  it("valida conteúdos e respeita o limite do plano", () => {
    const s = new PlatformStore(data());
    s.setUser("u-lumina");
    const ws = s.current!;
    expect(s.saveKnowledge(ws.id, { kind: "faq", title: "Oi", content: "x", question: "" })).toMatch(/título/);
    expect(s.saveKnowledge(ws.id, { kind: "site", title: "Site novo", content: "", url: "http://inseguro.com" })).toMatch(/https/);
    expect(s.changePlan(ws.id, "essencial")).toBeNull(); // 8 conteúdos cabem no limite de 50
    s.plans.find((p) => p.id === "essencial")!.knowledgeLimit = 8;
    expect(s.saveKnowledge(ws.id, { kind: "text", title: "Mais um", content: "Conteúdo novo suficiente" })).toMatch(/até 8 conteúdos/);
  });

  it("conecta o WhatsApp em duas etapas", () => {
    const s = new PlatformStore(data());
    const id = "w-bemestar";
    expect(s.startWhatsApp(id, "+55 63", "Pet")).toMatch(/DDD/);
    expect(s.startWhatsApp(id, "+55 63 98765-4321", "Bem-Estar Pet")).toBeNull();
    expect(s.verifyWhatsApp(id, "12")).toMatch(/6 números/);
    expect(s.verifyWhatsApp(id, "123456")).toBeNull();
    expect(s.workspace(id)!.whatsapp.status).toBe("connected");
  });

  it("fatura vencida deixa a conta com pagamento pendente; pagar regulariza", () => {
    const s = new PlatformStore(data());
    const ws = s.workspace("w-aurora")!;
    const next = s.invoicesOf(ws.id).find((i) => i.status === "pending")!;
    s.tick("2099-01-01");
    expect(next.status).toBe("overdue");
    expect(ws.status).toBe("past_due");
    expect(s.payInvoice(next.id)).toBeNull();
    expect(ws.status).toBe("active");
  });

  it("cadastro cria empresa em teste grátis; backoffice exige perfil admin", async () => {
    const s = new PlatformStore(data());
    const input: SignupInput = { company: "Padaria Pão Quente", name: "Joana Dias", email: "joana@paoquente.com.br", password: "SenhaForte1", segment: "Alimentação", teamSize: "2 a 10 pessoas", planId: "essencial", assistantName: "Pãozinho", tone: "descontraido", objective: "Responder sobre encomendas e horários da padaria.", website: "" };
    expect(await s.signup({ ...input, email: "mariana@lumina.com.br" })).toHaveProperty("email");
    expect(await s.signup(input)).toEqual({});
    expect(s.current!.status).toBe("trial");
    expect(s.current!.assistant.tone).toBe("descontraido");
    expect(s.setWorkspaceStatus(s.current!.id, "suspended")).toMatch(/backoffice/);
    s.setUser("u-admin");
    expect(s.setWorkspaceStatus("w-flora", "suspended")).toBeNull();
    expect(s.workspace("w-flora")!.whatsapp.status).toBe("disconnected");
  });

  it("demonstração: a Lumina tem conversas montadas pelo próprio motor do robô", () => {
    const d = data();
    const convs = d.conversations.filter((c) => c.workspaceId === "w-lumina");
    expect(convs.length).toBe(12);
    expect(convs.find((c) => c.contactName === "Ricardo Mendes")!.messages[1].sources).toEqual(["k-pagamento"]);
    expect(defaultAssistant("A", "B", "C").handoffAfterFailures).toBe(2);
  });
});
