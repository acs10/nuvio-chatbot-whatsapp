"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatTime } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon } from "@/core/ui/Icon";
import { DashboardHeader, Field, SelectField, TextArea, Toggle } from "@/core/ui/ui";
import type { BotAction } from "@/modules/bot/engine";
import { TONE_LABEL, WEEKDAY_LABEL, type AssistantConfig, type Tone, type Weekday } from "@/modules/domain/types";
import { api, usePlatform } from "@/modules/platform/PlatformProvider";

const ACTION_LABEL: Record<BotAction, string> = {
  greeting: "Boas-vindas",
  answer: "Resposta da base",
  fallback: "Não encontrou",
  handoff: "Transferência para a equipe",
  out_of_hours: "Fora do horário",
};

export const Assistant = observer(function Assistant() {
  const store = usePlatform();
  const ws = store.current!;
  const [a, setA] = useState<AssistantConfig>(ws.assistant);
  const [keywords, setKeywords] = useState(ws.assistant.handoffKeywords.join(", "));
  const dirty = JSON.stringify({ ...a, handoffKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) }) !== JSON.stringify(ws.assistant);
  const set = <K extends keyof AssistantConfig>(k: K, v: AssistantConfig[K]) => setA((x) => ({ ...x, [k]: v }));
  const toggleDay = (d: Weekday) => set("hours", { ...a.hours, days: a.hours.days.includes(d) ? a.hours.days.filter((x) => x !== d) : [...a.hours.days, d].sort() as Weekday[] });

  const save = () => {
    const err = store.updateAssistant(ws.id, { ...a, handoffKeywords: keywords.split(",") });
    if (err) return void toast.error(err);
    toast.success("Assistente atualizado. As próximas conversas já usam as novas regras.");
  };

  return (
    <>
      <DashboardHeader
        title="Meu chatbot"
        description={`Configure a personalidade, os objetivos e as regras de ${ws.assistant.name}.`}
        actions={
          <button className="button button--primary button--small" type="button" onClick={save} disabled={!dirty}>
            <Icon name="check" size={17} /> Salvar alterações
          </button>
        }
      />
      <div className="assistant-layout">
        <div className="assistant-form">
          <article className="panel form-panel">
            <div className="panel-head">
              <div>
                <h2>Identidade</h2>
                <p>Como o assistente se apresenta aos clientes</p>
              </div>
              <span className="toggle-row">
                {a.active ? "Atendendo" : "Pausado"} <Toggle checked={a.active} onChange={(v) => set("active", v)} label="Assistente ativo" />
              </span>
            </div>
            <div className="form-grid">
              <Field label="Nome do assistente" value={a.name} onChange={(e) => set("name", e.target.value)} />
              <SelectField label="Tom de voz" value={a.tone} onChange={(e) => set("tone", e.target.value as Tone)}>
                {(Object.keys(TONE_LABEL) as Tone[]).map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
              </SelectField>
              <TextArea full label="Principal objetivo" rows={3} value={a.objective} onChange={(e) => set("objective", e.target.value)} hint="Usado como instrução para a IA na versão com servidor." />
              <TextArea full label="Mensagem de boas-vindas" rows={2} value={a.greeting} onChange={(e) => set("greeting", e.target.value)} hint="Use {nome} para chamar o cliente pelo nome." />
              <TextArea full label="Quando não souber responder" rows={2} value={a.fallback} onChange={(e) => set("fallback", e.target.value)} />
            </div>
          </article>
          <article className="panel form-panel">
            <div className="panel-head">
              <div>
                <h2>Transferência para a equipe</h2>
                <p>Quando a IA passa a conversa para um humano</p>
              </div>
            </div>
            <div className="form-grid">
              <Field full label="Palavras que pedem atendente" value={keywords} onChange={(e) => setKeywords(e.target.value)} hint="Separe por vírgula. Ex.: atendente, humano, reclamação" />
              <SelectField label="Transferir após" value={a.handoffAfterFailures} onChange={(e) => set("handoffAfterFailures", Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n > 1 ? "respostas sem informação" : "resposta sem informação"}</option>)}
              </SelectField>
            </div>
          </article>
          <article className="panel form-panel">
            <div className="panel-head">
              <div>
                <h2>Horário da equipe</h2>
                <p>A IA atende 24h; transferências só acontecem neste horário</p>
              </div>
            </div>
            <div className="day-picker" role="group" aria-label="Dias de atendimento">
              {WEEKDAY_LABEL.map((label, d) => (
                <button key={label} type="button" aria-pressed={a.hours.days.includes(d as Weekday)} className={a.hours.days.includes(d as Weekday) ? "active" : ""} onClick={() => toggleDay(d as Weekday)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <Field label="Das" type="time" value={a.hours.start} onChange={(e) => set("hours", { ...a.hours, start: e.target.value })} />
              <Field label="Até" type="time" value={a.hours.end} onChange={(e) => set("hours", { ...a.hours, end: e.target.value })} />
              <TextArea full label="Mensagem fora do horário" rows={2} value={a.outOfHoursMessage} onChange={(e) => set("outOfHoursMessage", e.target.value)} />
            </div>
          </article>
        </div>
        <Tester config={a} />
      </div>
    </>
  );
});

interface TestMessage {
  id: number;
  from: "customer" | "bot";
  text: string;
  action?: BotAction;
  sources?: string[];
  at: string;
}

/** Testa o assistente com as regras da tela (mesmo antes de salvar) e a base de conhecimento atual. */
const Tester = observer(function Tester({ config }: { config: AssistantConfig }) {
  const store = usePlatform();
  const ws = store.current!;
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [text, setText] = useState("");
  const [failures, setFailures] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  const knowledge = store.knowledgeOf(ws.id);
  const suggestions = ["Olá!", "Quanto custa?", "Qual o horário de funcionamento?", "Quero falar com um atendente"];

  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<"ia" | "local" | null>(null);
  /** Pergunta ao servidor: responde como no WhatsApp (IA, se configurada; senão o motor local). */
  const send = async (value: string) => {
    const t = value.trim();
    if (!t || busy) return;
    const now = new Date().toISOString();
    const history = [...messages, { id: messages.length, from: "customer" as const, text: t, at: now }];
    setMessages(history);
    setText("");
    setBusy(true);
    const r = await api("/api/assistant/test", { config, history: history.map((m) => ({ from: m.from, text: m.text })), failures });
    setBusy(false);
    const result = r.body.result as { action: BotAction; reply: string; sources: string[] } | undefined;
    if (!r.ok || !result) {
      setMessages((m) => m.slice(0, -1));
      return void toast.error(r.body.error ?? "Não foi possível testar agora.");
    }
    setEngine(r.body.engine === "ia" ? "ia" : "local");
    setFailures(result.action === "fallback" ? failures + 1 : 0);
    setMessages((m) => [...m, { id: m.length, from: "bot", text: result.reply, action: result.action, sources: result.sources, at: new Date().toISOString() }]);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <aside className="panel tester">
      <div className="preview-top">
        <div className="preview-brand">
          <span className="avatar avatar--brand">
            <Icon name="sparkle" size={18} />
          </span>
          <span>
            <b>{config.name || "Assistente"}</b>
            <small>
              <i /> Teste do assistente
            </small>
          </span>
        </div>
        <button className="tiny-pill" type="button" onClick={() => (setMessages([]), setFailures(0))}>
          Reiniciar
        </button>
      </div>
      <div className="chat-area tester-chat">
        {messages.length === 0 && (
          <p className="tester-empty">
            Converse como se fosse um cliente. As respostas usam a sua <Link href="/painel/conhecimento">base de conhecimento</Link> ({knowledge.filter((k) => k.active && k.status === "ready").length} conteúdos ativos).
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.from === "customer" ? "bubble--outgoing" : "bubble--incoming"}`}>
            {m.text}
            {m.action && (
              <span className="bubble-sources">
                {ACTION_LABEL[m.action]}
                {m.sources?.length ? ` · ${m.sources.map((id) => knowledge.find((k) => k.id === id)?.title).join(", ")}` : ""}
              </span>
            )}
            <small>{formatTime(m.at)}</small>
          </div>
        ))}
        {busy && <div className="bubble bubble--incoming typing">digitando…</div>}
        <div ref={end} />
      </div>
      <div className="tester-suggestions">
        {suggestions.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => void send(s)}>
            {s}
          </button>
        ))}
      </div>
      <form className="preview-input tester-input" onSubmit={submit}>
        <input placeholder="Digite uma mensagem…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Mensagem de teste" />
        <button type="submit" aria-label="Enviar">
          <Icon name="send" size={18} />
        </button>
      </form>
      <p className="tester-note">
        <Icon name="sparkle" size={13} /> {engine === "ia" ? "Resposta gerada pela IA (Claude) com a sua base de conhecimento." : "Respostas por busca na base (motor local). Com a chave da IA configurada no servidor, o texto fica mais natural — as regras são as mesmas."}
      </p>
    </aside>
  );
});
