"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatDateTime, formatTime, initials, timeAgo } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon } from "@/core/ui/Icon";
import { DashboardHeader, EmptyState, StatusPill } from "@/core/ui/ui";
import type { Conversation, ConversationStatus } from "@/modules/domain/types";
import { usePlatform } from "@/modules/platform/PlatformProvider";
import { STATUS_TEXT, STATUS_TONE } from "./Overview";

type Filter = "all" | ConversationStatus;
const FILTERS: [Filter, string][] = [
  ["all", "Todas"],
  ["waiting", "Aguardando"],
  ["bot", "Com a IA"],
  ["human", "Em atendimento"],
  ["resolved", "Resolvidas"],
];

/** Caixa de entrada: a IA atende; a equipe acompanha, assume, devolve e encerra. */
export const Conversations = observer(function Conversations() {
  const store = usePlatform();
  const ws = store.current!;
  const router = useRouter();
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const all = store.conversationsOf(ws.id);
  const q = query.trim().toLowerCase();
  const list = all.filter((c) => (filter === "all" || c.status === filter) && (!q || c.contactName.toLowerCase().includes(q) || c.phone.includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q))));
  const selectedId = params.get("c") ?? undefined;
  const selected = store.conversation(selectedId);

  useEffect(() => {
    if (selected?.unread && selected.status !== "waiting") store.markRead(selected.id);
  }, [selected, selected?.unread, store]);

  const open = (id: string) => router.replace(`/painel/conversas?c=${id}`, { scroll: false });
  const simulate = () => {
    const id = store.simulateIncoming(ws.id);
    if (id) {
      open(id);
      toast.info("Nova conversa simulada: a IA respondeu na hora.");
    }
  };

  return (
    <>
      <DashboardHeader
        title="Conversas"
        description="A IA atende primeiro. Acompanhe, assuma quando precisar e devolva quando terminar."
        actions={
          <button className="button button--primary button--small" type="button" onClick={simulate}>
            <Icon name="plus" size={17} /> Simular nova conversa
          </button>
        }
      />
      <div className={`inbox ${selected ? "inbox--open" : ""}`}>
        <section className="panel inbox-list" aria-label="Lista de conversas">
          <label className="inbox-search">
            <Icon name="search" size={17} />
            <input placeholder="Buscar por nome, telefone ou mensagem…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="filter-tabs" role="tablist">
            {FILTERS.map(([id, label]) => {
              const n = id === "all" ? all.length : all.filter((c) => c.status === id).length;
              return (
                <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)} type="button">
                  {label} <em>{n}</em>
                </button>
              );
            })}
          </div>
          <div className="inbox-items">
            {list.length === 0 && <p className="muted-note">Nenhuma conversa aqui.</p>}
            {list.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <button key={c.id} type="button" className={`inbox-item ${c.id === selected?.id ? "inbox-item--active" : ""}`} onClick={() => open(c.id)}>
                  <span className="avatar">{initials(c.contactName)}</span>
                  <span className="inbox-item-text">
                    <b>{c.contactName}</b>
                    <small>{last ? `${last.from === "customer" ? "" : last.from === "bot" ? `${ws.assistant.name}: ` : last.from === "agent" ? "Você: " : ""}${last.text}` : "—"}</small>
                  </span>
                  <span className="inbox-item-meta">
                    <small>{timeAgo(c.updatedAt)}</small>
                    {c.unread > 0 ? <em>{c.unread}</em> : <i className={`dot dot--${STATUS_TONE[c.status]}`} title={STATUS_TEXT(c)} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel inbox-thread" aria-label="Conversa">
          {selected ? <Thread conversation={selected} onBack={() => router.replace("/painel/conversas", { scroll: false })} /> : <EmptyState icon="conversation" title="Selecione uma conversa" text="Escolha um atendimento à esquerda para ver o histórico completo." />}
        </section>
      </div>
    </>
  );
});

const Thread = observer(function Thread({ conversation: c, onBack }: { conversation: Conversation; onBack: () => void }) {
  const store = usePlatform();
  const ws = store.current!;
  const [text, setText] = useState("");
  const [customer, setCustomer] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [c.messages.length]);
  const titleOf = (id: string) => store.knowledge.find((k) => k.id === id)?.title;
  const run = (err: string | null, ok?: string) => (err ? toast.error(err) : ok && toast.success(ok));

  const sendAgent = (e: FormEvent) => {
    e.preventDefault();
    const err = store.sendAgentMessage(c.id, text);
    if (err) return void toast.error(err);
    setText("");
  };
  const sendCustomer = (e: FormEvent) => {
    e.preventDefault();
    const err = store.receiveMessage(c.id, customer);
    if (err) return void toast.error(err);
    setCustomer("");
  };

  return (
    <>
      <header className="thread-head">
        <button className="icon-button thread-back" type="button" onClick={onBack} aria-label="Voltar para a lista">
          <Icon name="arrow" size={18} />
        </button>
        <span className="avatar">{initials(c.contactName)}</span>
        <div>
          <b>{c.contactName}</b>
          <small>
            {c.phone} · {c.topic || "Nova conversa"} · desde {formatDateTime(c.startedAt)}
          </small>
        </div>
        {c.demo && <span className="tiny-pill">SIMULADA</span>}
        <StatusPill tone={STATUS_TONE[c.status]}>{STATUS_TEXT(c)}</StatusPill>
      </header>
      <div className="thread-actions">
        {(c.status === "bot" || c.status === "waiting") && (
          <button className="button button--primary button--small" type="button" onClick={() => run(store.takeOver(c.id), "Você assumiu o atendimento. A IA fica em pausa nesta conversa.")}>
            <Icon name="user" size={16} /> Assumir atendimento
          </button>
        )}
        {(c.status === "human" || c.status === "waiting") && (
          <button className="button button--outline button--small" type="button" onClick={() => run(store.returnToBot(c.id), `Conversa devolvida para ${ws.assistant.name}.`)}>
            <Icon name="bot" size={16} /> Devolver para a IA
          </button>
        )}
        {c.status !== "resolved" && (
          <button className="button button--outline button--small" type="button" onClick={() => run(store.resolve(c.id), "Conversa encerrada.")}>
            <Icon name="check" size={16} /> Encerrar
          </button>
        )}
      </div>
      <div className="thread-messages">
        {c.messages.map((m) =>
          m.from === "system" ? (
            <div className="thread-system" key={m.id}>
              {m.text} · {formatTime(m.at)}
            </div>
          ) : (
            <div key={m.id} className={`bubble ${m.from === "customer" ? "bubble--incoming" : "bubble--outgoing"} ${m.from === "agent" ? "bubble--agent" : ""}`}>
              {m.from !== "customer" && <span className="bubble-author">{m.from === "bot" ? `${ws.assistant.name} (IA)` : m.author ?? "Equipe"}</span>}
              {m.text}
              {!!m.sources?.length && (
                <span className="bubble-sources">
                  <Icon name="document" size={12} /> Base: {m.sources.map(titleOf).filter(Boolean).join(", ")}
                </span>
              )}
              <small>
                {formatTime(m.at)} {m.from !== "customer" && <DeliveryMark status={m.status} error={m.error} />}
              </small>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      {c.status !== "resolved" && !store.windowOpen(c) && (
        <p className="composer-note composer-note--warn">
          <Icon name="clock" size={14} /> Mais de 24 h desde a última mensagem do cliente: pelas regras do WhatsApp, só um modelo aprovado pode ser enviado agora.
        </p>
      )}
      {c.status === "human" ? (
        <form className="composer" onSubmit={sendAgent}>
          <input placeholder="Escreva sua resposta…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Sua resposta" />
          <button className="button button--primary button--small" type="submit" aria-label="Enviar">
            <Icon name="send" size={17} />
          </button>
        </form>
      ) : (
        <p className="composer-note">{c.status === "resolved" ? "Conversa encerrada. Se o cliente escrever de novo, a IA retoma o atendimento." : c.status === "waiting" ? "O cliente está aguardando a equipe. Assuma o atendimento para responder." : `${ws.assistant.name} está atendendo. Assuma para responder você mesmo.`}</p>
      )}
      {c.demo && <form className="composer composer--demo" onSubmit={sendCustomer}>
        <span className="tiny-pill">DEMONSTRAÇÃO</span>
        <input placeholder={`Escrever como ${c.contactName.split(" ")[0]} (cliente no WhatsApp)…`} value={customer} onChange={(e) => setCustomer(e.target.value)} aria-label="Simular mensagem do cliente" />
        <button className="button button--outline button--small" type="submit">
          Simular
        </button>
      </form>}
    </>
  );
});

/** ✓ enviada · ✓✓ entregue · ✓✓ azul lida · ⚠ falhou (mesma lógica do WhatsApp). */
function DeliveryMark({ status, error }: { status?: string; error?: string }) {
  if (!status || status === "simulated") return null;
  if (status === "failed") return <span className="mark mark--failed" title={error ?? "Falha no envio"}>⚠ não enviada</span>;
  if (status === "pending" || status === "sending") return <span className="mark" title="Enviando">🕓</span>;
  return <span className={`mark ${status === "read" ? "mark--read" : ""}`} title={status === "sent" ? "Enviada" : status === "delivered" ? "Entregue" : "Lida"}>{status === "sent" ? "✓" : "✓✓"}</span>;
}
