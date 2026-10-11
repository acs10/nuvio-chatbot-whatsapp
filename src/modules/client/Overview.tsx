"use client";

import Link from "next/link";
import { useState } from "react";
import { formatNumber, formatPercent, initials, timeAgo } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon, type IconName } from "@/core/ui/Icon";
import { DashboardHeader, StatusPill } from "@/core/ui/ui";
import { WEEKDAY_LABEL, type Conversation, type DailyStat } from "@/modules/domain/types";
import { usePlatform } from "@/modules/platform/PlatformProvider";

const sparkPoints = {
  blue: "0,31 12,29 25,34 38,25 52,28 65,17 78,20 92,11 105,15 120,5",
  green: "0,32 14,28 28,30 42,22 56,26 70,15 84,17 98,9 120,12",
  purple: "0,30 14,22 28,25 42,15 56,18 70,9 84,13 98,5 120,8",
};

/** Linha do minigráfico a partir dos números reais. */
function points(values: number[]) {
  const max = Math.max(1, ...values);
  return values.map((v, i) => `${Math.round((i / Math.max(1, values.length - 1)) * 120)},${Math.round(36 - (v / max) * 30)}`).join(" ");
}

function MetricCard({ icon, label, value, trend, tone, note, series }: { icon: IconName; label: string; value: string; trend: string; tone: "blue" | "green" | "purple"; note: string; series?: number[] }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon--${tone}`}>
        <Icon name={icon} size={20} />
      </div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <div className="metric-foot">
        <span>
          <b className={trend.startsWith("↘") ? "negative" : ""}>{trend}</b> {note}
        </span>
        <svg viewBox="0 0 120 40" aria-hidden="true">
          <polyline className={tone} points={series ? points(series) : sparkPoints[tone]} />
        </svg>
      </div>
    </article>
  );
}

export const STATUS_TONE: Record<Conversation["status"], "success" | "active" | "neutral" | "warning"> = { resolved: "success", bot: "active", human: "neutral", waiting: "warning" };
export const STATUS_TEXT = (c: Conversation) => (c.status === "resolved" ? (c.resolvedBy === "ai" ? "Resolvido pela IA" : "Resolvido pela equipe") : c.status === "bot" ? "Com a IA" : c.status === "human" ? "Em atendimento" : "Aguardando equipe");

const sum = (days: DailyStat[], k: "total" | "ai") => days.reduce((s, d) => s + d[k], 0);
const change = (now: number, before: number) => (before ? `${now >= before ? "↗" : "↘"} ${formatPercent(Math.abs(now - before) / before)}` : "—");

export const ClientOverview = observer(function ClientOverview() {
  const store = usePlatform();
  const ws = store.current!;
  const [range, setRange] = useState(7);
  const usage = store.usage(ws);
  const days = store.lastDays(ws, range);
  const last14 = store.lastDays(ws, 14);
  const [prev7, this7] = [last14.slice(0, 7), last14.slice(7)];
  const max = Math.max(1, ...days.map((d) => d.total));
  const conversations = store.conversationsOf(ws.id);
  const waiting = conversations.filter((c) => c.status === "waiting").length;
  const topics = store.topics(ws.id).slice(0, 4);
  const colors = ["blue", "violet", "cyan", "orange"];
  const wa = ws.whatsapp;

  return (
    <>
      <DashboardHeader
        title={`Olá, ${store.user!.name.split(" ")[0]}!`}
        description="Acompanhe como seu atendimento está performando."
        actions={
          <Link className="button button--outline button--small" href="/painel/chatbot">
            <Icon name="bot" size={17} /> Testar assistente
          </Link>
        }
      />
      {wa.status === "connected" ? (
        <div className="status-banner">
          <span className="status-icon">
            <Icon name="whatsapp" size={22} />
          </span>
          <div>
            <b>{ws.assistant.active ? "Seu WhatsApp está conectado e atendendo" : "WhatsApp conectado — assistente pausado"}</b>
            <p>
              Última sincronização há {timeAgo(wa.lastSyncAt ?? wa.connectedAt ?? new Date().toISOString()).toLowerCase()} · <span>{wa.phone}</span>
            </p>
          </div>
          <span className="live-status">
            <i /> {ws.assistant.active ? "Operando normalmente" : "IA pausada"}
          </span>
          <Link href="/painel/integracoes" aria-label="Ver conexão">
            <Icon name="chevron" size={17} />
          </Link>
        </div>
      ) : (
        <div className="status-banner status-banner--warning">
          <span className="status-icon">
            <Icon name="whatsapp" size={22} />
          </span>
          <div>
            <b>Conecte seu WhatsApp para começar a atender</b>
            <p>A conexão é feita pela API oficial da Meta e leva poucos minutos.</p>
          </div>
          <Link className="button button--primary button--small" href="/painel/integracoes">
            Conectar agora
          </Link>
        </div>
      )}
      <div className="metric-grid">
        <MetricCard icon="conversation" label="Conversas este mês" value={formatNumber(usage.total)} trend={change(sum(this7, "total"), sum(prev7, "total"))} note="últimos 7 dias" tone="blue" series={last14.map((d) => d.total)} />
        <MetricCard icon="bot" label="Resolvidas pela IA" value={formatPercent(usage.aiRate)} trend={formatNumber(usage.ai)} note="sem ajuda da equipe" tone="green" series={last14.map((d) => (d.total ? d.ai / d.total : 0))} />
        <MetricCard icon="clock" label="Aguardando sua equipe" value={String(waiting)} trend={waiting ? "Atender" : "✓"} note={waiting ? "conversas transferidas" : "nenhuma pendência"} tone="purple" />
      </div>
      <div className="dashboard-grid">
        <article className="panel performance-panel">
          <div className="panel-head">
            <div>
              <h2>Desempenho das conversas</h2>
              <p>Últimos {range} dias</p>
            </div>
            <select value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Período">
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
            </select>
          </div>
          <div className="chart-legend">
            <span>
              <i className="blue" /> Total de conversas
            </span>
            <span>
              <i className="green" /> Resolvidas pela IA
            </span>
          </div>
          <div className="bar-chart">
            {days.map((d) => (
              <div className="bar-group" key={d.date} title={`${d.total} conversas · ${d.ai} pela IA`}>
                <div>
                  <i style={{ height: `${(d.total / max) * 82}%` }} />
                  <i style={{ height: `${(d.ai / max) * 82}%` }} />
                </div>
                <span>{range === 7 ? WEEKDAY_LABEL[new Date(`${d.date}T12:00:00Z`).getUTCDay()] : d.date.slice(8)}</span>
              </div>
            ))}
            <div className="chart-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </article>
        <article className="panel topics-panel">
          <div className="panel-head">
            <div>
              <h2>Assuntos mais frequentes</h2>
              <p>O que seus clientes perguntam</p>
            </div>
            <Link href="/painel/conversas">
              Ver conversas <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="topic-list">
            {topics.length === 0 && <p className="muted-note">Os assuntos aparecem conforme as conversas chegam.</p>}
            {topics.map(({ topic, share }, i) => (
              <div className="topic-row" key={topic}>
                <span>
                  <i className={colors[i]} />
                  {topic}
                </span>
                <div>
                  <span>
                    <i className={colors[i]} style={{ width: `${Math.round(share * 100)}%` }} />
                  </span>
                  <b>{Math.round(share * 100)}%</b>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
      <article className="panel recent-panel">
        <div className="panel-head">
          <div>
            <h2>Conversas recentes</h2>
            <p>Acompanhe os últimos atendimentos</p>
          </div>
          <Link href="/painel/conversas">
            Ver todas as conversas <Icon name="arrow" size={15} />
          </Link>
        </div>
        <div className="conversation-table">
          {conversations.length === 0 && <p className="muted-note">Nenhuma conversa ainda. Conecte o WhatsApp ou simule uma conversa em Conversas.</p>}
          {conversations.slice(0, 5).map((c) => (
            <Link className="conversation-row" key={c.id} href={`/painel/conversas?c=${c.id}`}>
              <span className="avatar">{initials(c.contactName)}</span>
              <span>
                <b>{c.contactName}</b>
                <small>{c.topic || "Nova conversa"}</small>
              </span>
              <span>{timeAgo(c.updatedAt)}</span>
              <StatusPill tone={STATUS_TONE[c.status]}>{STATUS_TEXT(c)}</StatusPill>
              <span>
                <Icon name="chevron" size={17} />
              </span>
            </Link>
          ))}
        </div>
      </article>
    </>
  );
});
