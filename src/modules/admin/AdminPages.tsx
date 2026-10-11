"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addDays, dayKey, formatDay, formatMonth, formatNumber, formatPercent, formatPrice, initials } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon, type IconName } from "@/core/ui/Icon";
import { DashboardHeader, Field, Modal, SelectField, StatusPill } from "@/core/ui/ui";
import { WORKSPACE_STATUS_LABEL, type Invoice, type Plan, type PlanId, type Workspace, type WorkspaceStatus } from "@/modules/domain/types";
import { INVOICE_LABEL, INVOICE_TONE } from "@/modules/client/Billing";
import type { PlatformStore } from "@/modules/platform/platform-store";
import { usePlatform, useSync } from "@/modules/platform/PlatformProvider";

const STATUS_TONE: Record<WorkspaceStatus, "success" | "warning" | "danger" | "neutral" | "active"> = { active: "success", trial: "active", past_due: "warning", suspended: "danger", cancelled: "neutral" };
const shortMoney = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatPrice(v));

function platformMonth(store: PlatformStore) {
  return store.workspaces.reduce((acc, w) => {
    const u = store.usage(w);
    return { total: acc.total + u.total, ai: acc.ai + u.ai };
  }, { total: 0, ai: 0 });
}

function AdminMetric({ label, value, note, icon, tone, positive }: { label: string; value: string; note: string; icon: IconName; tone: string; positive?: boolean }) {
  return (
    <article className="metric-card admin-metric">
      <div className={`metric-icon metric-icon--${tone}`}>
        <Icon name={icon} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={positive ? "positive" : ""}>{note}</small>
    </article>
  );
}

function ClientRow({ w, store, onOpen }: { w: Workspace; store: PlatformStore; onOpen: () => void }) {
  const u = store.usage(w);
  const plan = store.plan(w.planId);
  return (
    <button className="admin-row" type="button" onClick={onOpen}>
      <span>
        <i className="company-avatar">{initials(w.name)}</i>
        <b>{w.name}</b>
      </span>
      <span>{plan.name}</span>
      <span className={u.ratio >= store.settings.usageAlert ? "text-warning" : ""}>
        {formatNumber(u.total)} / {formatNumber(u.limit)}
      </span>
      <StatusPill tone={STATUS_TONE[w.status]}>{WORKSPACE_STATUS_LABEL[w.status]}</StatusPill>
      <span>
        <b>{w.status === "active" || w.status === "past_due" ? formatPrice(plan.price) : "—"}</b>
      </span>
      <span>
        <Icon name="chevron" size={16} />
      </span>
    </button>
  );
}

function TableHead() {
  return (
    <div className="admin-row admin-row--head">
      <span>EMPRESA</span>
      <span>PLANO</span>
      <span>CONVERSAS NO MÊS</span>
      <span>STATUS</span>
      <span>MRR</span>
      <span />
    </div>
  );
}

// ------------------------------------------------------------------ visão geral

export const AdminOverview = observer(function AdminOverview() {
  const store = usePlatform();
  const [open, setOpen] = useState<string | null>(null);
  const active = store.workspaces.filter((w) => w.status === "active" || w.status === "past_due");
  const month = dayKey().slice(0, 7);
  const newThisMonth = store.workspaces.filter((w) => w.createdAt.slice(0, 7) === month).length;
  const conv = platformMonth(store);
  const history = [...store.mrrHistory.slice(0, -1), { month: store.mrrHistory.at(-1)?.month ?? month, value: store.mrr }];
  const max = Math.max(...history.map((h) => h.value), 1);
  // Escala "redonda": 4 faixas iguais (ex.: 0, 2k, 4k, 6k, 8k).
  const step = Math.ceil(max / 4 / 500) * 500;
  const top = step * 4;
  const prev = history.at(-2)?.value ?? 0;
  const recent = [...store.workspaces].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <>
      <DashboardHeader title="Painel administrativo" description="Visão consolidada da operação da Nuvio." />
      <div className="admin-metrics">
        <AdminMetric label="Clientes ativos" value={String(active.length)} note={`+${newThisMonth} este mês · ${store.workspaces.filter((w) => w.status === "trial").length} em teste`} icon="people" tone="blue" positive />
        <AdminMetric label="Receita mensal (MRR)" value={shortMoney(store.mrr)} note={prev ? `${store.mrr >= prev ? "+" : ""}${formatPercent((store.mrr - prev) / prev)} vs. mês anterior` : "—"} icon="money" tone="green" positive={store.mrr >= prev} />
        <AdminMetric label="Conversas no mês" value={formatNumber(conv.total)} note={`${formatPercent(conv.total ? conv.ai / conv.total : 0)} resolvidas pela IA`} icon="conversation" tone="purple" positive />
        <AdminMetric label="Saúde da operação" value="99,8%" note="Todos os sistemas online" icon="trend" tone="cyan" />
      </div>
      <div className="admin-grid">
        <article className="panel revenue-panel">
          <div className="panel-head">
            <div>
              <h2>Receita recorrente mensal</h2>
              <p>Evolução do MRR nos últimos 12 meses</p>
            </div>
            <div className="revenue-total">
              <small>MRR atual</small>
              <b>{formatPrice(store.mrr)}</b>
            </div>
          </div>
          <div className="revenue-chart">
            <div className="y-labels">
              {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                <span key={f}>{f ? `${((top * f) / 1000).toLocaleString("pt-BR")}k` : "0"}</span>
              ))}
            </div>
            <div className="revenue-bars">
              {history.map((h) => (
                <div key={h.month} title={`${formatMonth(h.month)}: ${formatPrice(h.value)}`}>
                  <i style={{ height: `${(h.value / top) * 100}%` }} />
                  <span>{formatMonth(h.month).slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
        <HealthPanel />
      </div>
      <article className="panel client-panel">
        <div className="panel-head">
          <div>
            <h2>Clientes recentes</h2>
            <p>Últimas contas criadas e status da operação</p>
          </div>
        </div>
        <div className="admin-table">
          <TableHead />
          {recent.map((w) => (
            <ClientRow key={w.id} w={w} store={store} onOpen={() => setOpen(w.id)} />
          ))}
        </div>
      </article>
      {open && <ClientModal id={open} onClose={() => setOpen(null)} />}
    </>
  );
});

function HealthPanel() {
  return (
    <article className="panel health-panel">
      <div className="panel-head">
        <div>
          <h2>Saúde da plataforma</h2>
          <p>Status em tempo real (simulado na demonstração)</p>
        </div>
        <span className="live-status">
          <i /> Operacional
        </span>
      </div>
      {[
        ["API WhatsApp", "99,99%", "green"],
        ["Motor de IA", "99,97%", "green"],
        ["Fila de mensagens", "99,82%", "green"],
        ["Tempo de resposta", "1,2s", "blue"],
      ].map(([name, value, tone]) => (
        <div className="health-row" key={name}>
          <span>
            <i className={tone} />
            {name}
          </span>
          <b>{value}</b>
        </div>
      ))}
    </article>
  );
}

// ------------------------------------------------------------------ clientes

export const AdminClients = observer(function AdminClients() {
  const store = usePlatform();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkspaceStatus | "all">("all");
  const [plan, setPlan] = useState<PlanId | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const list = store.workspaces
    .filter((w) => (status === "all" || w.status === status) && (plan === "all" || w.planId === plan) && (!q || `${w.name} ${store.ownerOf(w.id)?.email ?? ""} ${w.segment}`.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <DashboardHeader title="Clientes" description={`${store.workspaces.length} empresas na plataforma.`} />
      <div className="section-toolbar">
        <label>
          <Icon name="search" size={18} />
          <input placeholder="Buscar por empresa, e-mail ou segmento…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="toolbar-select" value={status} onChange={(e) => setStatus(e.target.value as WorkspaceStatus | "all")} aria-label="Status">
          <option value="all">Todos os status</option>
          {(Object.keys(WORKSPACE_STATUS_LABEL) as WorkspaceStatus[]).map((s) => <option key={s} value={s}>{WORKSPACE_STATUS_LABEL[s]}</option>)}
        </select>
        <select className="toolbar-select" value={plan} onChange={(e) => setPlan(e.target.value as PlanId | "all")} aria-label="Plano">
          <option value="all">Todos os planos</option>
          {store.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <article className="panel client-panel">
        <div className="admin-table">
          <TableHead />
          {list.length === 0 && <p className="muted-note">Nenhuma empresa encontrada.</p>}
          {list.map((w) => (
            <ClientRow key={w.id} w={w} store={store} onOpen={() => setOpen(w.id)} />
          ))}
        </div>
      </article>
      {open && <ClientModal id={open} onClose={() => setOpen(null)} />}
    </>
  );
});

const ClientModal = observer(function ClientModal({ id, onClose }: { id: string; onClose: () => void }) {
  const store = usePlatform();
  const w = store.workspace(id)!;
  const owner = store.ownerOf(id);
  const u = store.usage(w);
  const invoices = store.invoicesOf(id);
  const run = (err: string | null, ok: string) => (err ? toast.error(err) : toast.success(ok));
  return (
    <Modal title={w.name} description={`${w.segment} · ${w.teamSize} · cliente desde ${formatDay(w.createdAt.slice(0, 10))}`} onClose={onClose} wide>
      <div className="detail-grid">
        <div>
          <h3>Responsável</h3>
          <p>
            {owner?.name}
            <br />
            {owner?.email}
          </p>
        </div>
        <div>
          <h3>WhatsApp</h3>
          <p>
            {w.whatsapp.status === "connected" ? `Conectado · ${w.whatsapp.phone}` : w.whatsapp.status === "pending" ? "Aguardando verificação" : "Desconectado"}
            <br />
            Assistente: {w.assistant.name} ({w.assistant.active ? "ativo" : "pausado"})
          </p>
        </div>
        <div>
          <h3>Uso no mês</h3>
          <p>
            {formatNumber(u.total)} de {formatNumber(u.limit)} conversas ({formatPercent(u.ratio)}) · {formatPercent(u.aiRate)} pela IA
          </p>
        </div>
        <div>
          <h3>Assinatura</h3>
          <p>
            <StatusPill tone={STATUS_TONE[w.status]}>{WORKSPACE_STATUS_LABEL[w.status]}</StatusPill>
            <br />
            {w.status === "trial" ? `Teste até ${formatDay(w.trialEndsAt!)}` : `Renova em ${formatDay(w.renewsAt)}`}
          </p>
        </div>
      </div>
      <div className="form-grid">
        <SelectField label="Plano" value={w.planId} onChange={(e) => run(store.changePlan(w.id, e.target.value as PlanId), "Plano alterado.")}>
          {store.plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>)}
        </SelectField>
        <div className="field">
          <span>Acesso</span>
          {w.status === "suspended" || w.status === "cancelled" ? (
            <button className="button button--primary button--small" type="button" onClick={() => run(store.setWorkspaceStatus(w.id, "active"), "Conta reativada.")}>
              Reativar conta
            </button>
          ) : (
            <button className="button button--outline button--small" type="button" onClick={() => window.confirm(`Suspender ${w.name}? O assistente para de atender.`) && run(store.setWorkspaceStatus(w.id, "suspended"), "Conta suspensa.")}>
              Suspender conta
            </button>
          )}
        </div>
      </div>
      {invoices.length > 0 && <InvoiceTable invoices={invoices.slice(0, 4)} />}
    </Modal>
  );
});

// ------------------------------------------------------------------ assinaturas

function InvoiceTable({ invoices, showClient }: { invoices: Invoice[]; showClient?: boolean }) {
  const store = usePlatform();
  return (
    <div className="data-table">
      <div className="data-row data-row--head">
        {showClient && <span>Empresa</span>}
        <span>Referência</span>
        <span>Vencimento</span>
        <span>Valor</span>
        <span>Situação</span>
        <span />
      </div>
      {invoices.map((inv) => (
        <div className="data-row" key={inv.id}>
          {showClient && <span>{store.workspace(inv.workspaceId)?.name}</span>}
          <span>
            {formatMonth(inv.period)} · {store.plan(inv.planId).name}
          </span>
          <span>{formatDay(inv.dueDate)}</span>
          <span>
            <b>{formatPrice(inv.amount)}</b>
          </span>
          <StatusPill tone={INVOICE_TONE[inv.status]}>{INVOICE_LABEL[inv.status]}</StatusPill>
          <span>
            {inv.status !== "paid" && (
              <button className="text-button" type="button" onClick={() => (store.payInvoice(inv.id) ? toast.error("Não foi possível.") : toast.success("Fatura marcada como paga."))}>
                Marcar paga
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export const AdminSubscriptions = observer(function AdminSubscriptions() {
  const store = usePlatform();
  const [filter, setFilter] = useState<Invoice["status"] | "all">("all");
  const list = [...store.invoices].filter((i) => filter === "all" || i.status === filter).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const overdue = store.invoices.filter((i) => i.status === "overdue");
  const byPlan = store.plans.map((p) => {
    const ws = store.workspaces.filter((w) => w.planId === p.id && (w.status === "active" || w.status === "past_due"));
    return { plan: p, count: ws.length, mrr: ws.length * p.price };
  });
  return (
    <>
      <DashboardHeader title="Assinaturas" description="Receita por plano e cobranças de todos os clientes." />
      <div className="admin-metrics">
        {byPlan.map(({ plan, count, mrr }) => (
          <AdminMetric key={plan.id} label={`Plano ${plan.name}`} value={formatPrice(mrr)} note={`${count} ${count === 1 ? "assinatura" : "assinaturas"} · ${formatPrice(plan.price)}/mês`} icon="money" tone={plan.id === "escala" ? "purple" : plan.id === "profissional" ? "blue" : "green"} />
        ))}
        <AdminMetric label="Em atraso" value={formatPrice(overdue.reduce((s, i) => s + i.amount, 0))} note={`${overdue.length} ${overdue.length === 1 ? "fatura" : "faturas"}`} icon="alert" tone="cyan" />
      </div>
      <article className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Faturas</h2>
            <p>Na demonstração, “Marcar paga” simula a confirmação do gateway de pagamento</p>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Invoice["status"] | "all")} aria-label="Filtrar faturas">
            <option value="all">Todas</option>
            <option value="overdue">Em atraso</option>
            <option value="pending">Em aberto</option>
            <option value="paid">Pagas</option>
          </select>
        </div>
        <InvoiceTable invoices={list} showClient />
      </article>
    </>
  );
});

// ------------------------------------------------------------------ operação

export const AdminOperation = observer(function AdminOperation() {
  const store = usePlatform();
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    return store.workspaces.reduce((acc, w) => {
      const d = w.daily.find((x) => x.date === date);
      return { date, total: acc.total + (d?.total ?? 0), ai: acc.ai + (d?.ai ?? 0) };
    }, { date, total: 0, ai: 0 });
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  const live = store.workspaces.filter((w) => w.status !== "cancelled" && w.status !== "suspended");
  const wa = { connected: live.filter((w) => w.whatsapp.status === "connected").length, pending: live.filter((w) => w.whatsapp.status === "pending").length, off: live.filter((w) => w.whatsapp.status === "disconnected").length };
  const alerts: { tone: "warning" | "danger" | "active"; text: string }[] = [
    ...store.workspaces.filter((w) => w.status !== "cancelled" && store.usage(w).ratio >= store.settings.usageAlert).map((w) => ({ tone: "warning" as const, text: `${w.name} usou ${formatPercent(store.usage(w).ratio)} das conversas do plano ${store.plan(w.planId).name} — oferecer upgrade.` })),
    ...live.filter((w) => w.whatsapp.status !== "connected").map((w) => ({ tone: "active" as const, text: `${w.name} ainda não conectou o WhatsApp (${WORKSPACE_STATUS_LABEL[w.status].toLowerCase()}).` })),
    ...store.workspaces.filter((w) => w.status === "past_due").map((w) => ({ tone: "danger" as const, text: `${w.name} está com pagamento pendente.` })),
    ...store.workspaces.filter((w) => w.status === "trial" && w.trialEndsAt && w.trialEndsAt <= addDays(today, 5)).map((w) => ({ tone: "active" as const, text: `Teste grátis de ${w.name} termina em ${formatDay(w.trialEndsAt!)}.` })),
  ];
  return (
    <>
      <DashboardHeader title="Operação" description="Volume de conversas, conexões e alertas da plataforma." />
      <div className="admin-metrics">
        <AdminMetric label="WhatsApp conectados" value={String(wa.connected)} note={`${wa.pending} aguardando · ${wa.off} sem conexão`} icon="whatsapp" tone="green" />
        <AdminMetric label="Conversas hoje" value={formatNumber(days.at(-1)!.total)} note={`${formatNumber(days.at(-1)!.ai)} pela IA`} icon="conversation" tone="blue" />
        <AdminMetric label="Automação (14 dias)" value={formatPercent(days.reduce((s, d) => s + d.ai, 0) / Math.max(1, days.reduce((s, d) => s + d.total, 0)))} note="resolvidas sem equipe" icon="bot" tone="purple" positive />
        <AdminMetric label="Alertas" value={String(alerts.length)} note={alerts.length ? "ver lista abaixo" : "tudo em ordem"} icon="alert" tone="cyan" />
      </div>
      <div className="admin-grid">
        <article className="panel revenue-panel">
          <div className="panel-head">
            <div>
              <h2>Conversas processadas</h2>
              <p>Todas as empresas · últimos 14 dias</p>
            </div>
          </div>
          <div className="bar-chart bar-chart--wide">
            {days.map((d) => (
              <div className="bar-group" key={d.date} title={`${formatDay(d.date)}: ${formatNumber(d.total)} conversas`}>
                <div>
                  <i style={{ height: `${(d.total / max) * 82}%` }} />
                  <i style={{ height: `${(d.ai / max) * 82}%` }} />
                </div>
                <span>{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </article>
        <HealthPanel />
      </div>
      <IntegrationStatus />
      <article className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Alertas</h2>
            <p>O que precisa de atenção do time</p>
          </div>
        </div>
        <ul className="alert-list">
          {alerts.length === 0 && <li className="muted-note">Nenhum alerta.</li>}
          {alerts.map((a) => (
            <li key={a.text}>
              <StatusPill tone={a.tone}>{a.tone === "danger" ? "Cobrança" : a.tone === "warning" ? "Uso" : "Ativação"}</StatusPill>
              {a.text}
            </li>
          ))}
        </ul>
      </article>
    </>
  );
});

// ------------------------------------------------------------------ configurações

export const AdminSettings = observer(function AdminSettings() {
  const store = usePlatform();
  const [trial, setTrial] = useState(store.settings.trialDays);
  const [alert, setAlert] = useState(Math.round(store.settings.usageAlert * 100));
  return (
    <>
      <DashboardHeader title="Configurações" description="Planos, preços e regras da plataforma. As mudanças aparecem no site e no cadastro." />
      <div className="plan-editor-grid">
        {store.plans.map((p) => (
          <PlanEditor key={p.id} plan={p} />
        ))}
      </div>
      <article className="panel form-panel">
        <div className="panel-head">
          <div>
            <h2>Regras gerais</h2>
            <p>Teste grátis e alertas de uso</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Dias de teste grátis" type="number" min={0} max={60} value={trial} onChange={(e) => setTrial(Number(e.target.value))} />
          <Field label="Alerta de uso (% do limite)" type="number" min={50} max={100} value={alert} onChange={(e) => setAlert(Number(e.target.value))} />
        </div>
        <button
          className="button button--primary button--small"
          type="button"
          onClick={() => {
            const err = store.updateSettings({ trialDays: trial, usageAlert: alert / 100 });
            if (err) return void toast.error(err);
            toast.success("Configurações salvas.");
          }}
        >
          Salvar regras
        </button>
      </article>
    </>
  );
});

const PlanEditor = observer(function PlanEditor({ plan }: { plan: Plan }) {
  const store = usePlatform();
  const [p, setP] = useState({ price: plan.price, conversations: plan.conversations, numbers: plan.numbers, unlimited: plan.knowledgeLimit === null, knowledgeLimit: plan.knowledgeLimit ?? 50, description: plan.description });
  const save = () => {
    const err = store.updatePlan(plan.id, { price: p.price, conversations: p.conversations, numbers: p.numbers, knowledgeLimit: p.unlimited ? null : p.knowledgeLimit, description: p.description });
    if (err) return void toast.error(err);
    toast.success(`Plano ${plan.name} atualizado.`);
  };
  return (
    <article className="panel form-panel">
      <div className="panel-head">
        <div>
          <h2>{plan.name}</h2>
          <p>{store.workspaces.filter((w) => w.planId === plan.id).length} empresas neste plano</p>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Preço (R$/mês)" type="number" min={1} value={p.price} onChange={(e) => setP({ ...p, price: Number(e.target.value) })} />
        <Field label="Conversas/mês" type="number" min={100} step={100} value={p.conversations} onChange={(e) => setP({ ...p, conversations: Number(e.target.value) })} />
        <Field label="Números de WhatsApp" type="number" min={1} value={p.numbers} onChange={(e) => setP({ ...p, numbers: Number(e.target.value) })} />
        <Field label="Conteúdos na base" type="number" min={5} disabled={p.unlimited} value={p.knowledgeLimit} onChange={(e) => setP({ ...p, knowledgeLimit: Number(e.target.value) })} />
        <label className="check-inline field--full">
          <input type="checkbox" checked={p.unlimited} onChange={(e) => setP({ ...p, unlimited: e.target.checked })} /> Base de conhecimento ilimitada
        </label>
        <Field full label="Descrição" value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
      </div>
      <button className="button button--outline button--small" type="button" onClick={save}>
        Salvar plano
      </button>
    </article>
  );
});

/** O que está configurado no servidor (sem mostrar segredos). */
const IntegrationStatus = observer(function IntegrationStatus() {
  const store = usePlatform();
  const { info } = useSync();
  const real = store.workspaces.filter((w) => w.whatsapp.mode === "manual" || w.whatsapp.mode === "embedded");
  const failing = store.workspaces.filter((w) => w.whatsapp.lastError);
  return (
    <article className="panel table-panel">
      <div className="panel-head">
        <div>
          <h2>Integrações do servidor</h2>
          <p>Chaves configuradas nas variáveis do servidor (valores nunca são exibidos)</p>
        </div>
      </div>
      <ul className="alert-list">
        <li>
          <StatusPill tone={info.whatsapp.enabled ? "success" : "neutral"}>{info.whatsapp.enabled ? "Ligado" : "Desligado"}</StatusPill>
          WhatsApp Cloud API (webhook e envio){info.whatsapp.embedded ? " · cadastro incorporado disponível" : info.whatsapp.enabled ? " · só conexão manual" : " — sem META_APP_SECRET / WHATSAPP_VERIFY_TOKEN, as empresas usam a conexão simulada"}
        </li>
        <li>
          <StatusPill tone={info.ai.enabled ? "success" : "neutral"}>{info.ai.enabled ? "Ligado" : "Motor local"}</StatusPill>
          IA das respostas{info.ai.enabled ? `: Claude (${info.ai.model})` : " — sem ANTHROPIC_API_KEY, as respostas usam a busca na base"}
        </li>
        <li>
          <StatusPill tone="active">{info.store === "firestore" ? "Firestore" : "Arquivo local"}</StatusPill>
          Banco de dados · {real.length} {real.length === 1 ? "empresa conectada" : "empresas conectadas"} pela API oficial
        </li>
        {failing.map((w) => (
          <li key={w.id}>
            <StatusPill tone="danger">Falha</StatusPill>
            {w.name}: {w.whatsapp.lastError}
          </li>
        ))}
      </ul>
    </article>
  );
});
