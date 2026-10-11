"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDay, formatLongDay, formatMonth, formatNumber, formatPercent, formatPrice } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon } from "@/core/ui/Icon";
import { DashboardHeader, Field, Modal, StatusPill } from "@/core/ui/ui";
import { WORKSPACE_STATUS_LABEL, type Invoice, type PlanId } from "@/modules/domain/types";
import { usePlatform } from "@/modules/platform/PlatformProvider";

export const INVOICE_TONE: Record<Invoice["status"], "success" | "warning" | "danger"> = { paid: "success", pending: "warning", overdue: "danger" };
export const INVOICE_LABEL: Record<Invoice["status"], string> = { paid: "Paga", pending: "Em aberto", overdue: "Em atraso" };

export const Billing = observer(function Billing() {
  const store = usePlatform();
  const ws = store.current!;
  const plan = store.plan(ws.planId);
  const usage = store.usage(ws);
  const invoices = store.invoicesOf(ws.id);
  const [plans, setPlans] = useState(false);
  const [card, setCard] = useState(false);
  const run = (err: string | null, ok: string) => (err ? toast.error(err) : toast.success(ok));

  return (
    <>
      <DashboardHeader title="Plano e cobrança" description="Gerencie sua assinatura, uso e formas de pagamento." />
      <div className="billing-layout">
        <article className="panel current-plan">
          <span className="plan-chip">PLANO ATUAL · {WORKSPACE_STATUS_LABEL[ws.status].toUpperCase()}</span>
          <h2>{plan.name}</h2>
          <p>
            {ws.status === "trial" && ws.trialEndsAt
              ? `Teste grátis até ${formatLongDay(ws.trialEndsAt)}. Depois, ${formatPrice(plan.price)}/mês.`
              : ws.status === "cancelled"
                ? "Assinatura cancelada."
                : `${formatPrice(plan.price)}/mês · renova em ${formatLongDay(ws.renewsAt)}.`}
          </p>
          <div className="usage">
            <span>
              <b>{formatNumber(usage.total)}</b> de {formatNumber(usage.limit)} conversas este mês
            </span>
            <div>
              <i style={{ width: `${Math.min(100, usage.ratio * 100)}%` }} className={usage.ratio >= store.settings.usageAlert ? "usage-alert" : ""} />
            </div>
            <small>{formatPercent(usage.ratio)} utilizado</small>
          </div>
          <div className="button-row">
            <button className="button button--outline button--small" type="button" onClick={() => setPlans(true)}>
              Comparar planos
            </button>
            {ws.status === "trial" && (
              <button className="button button--primary button--small" type="button" onClick={() => run(store.activateSubscription(ws.id), "Assinatura ativada! Obrigado por escolher a Nuvio.")}>
                Ativar assinatura
              </button>
            )}
          </div>
        </article>
        <article className="panel payment-card">
          <h2>Forma de pagamento</h2>
          {ws.card ? (
            <div className="credit-card">
              <span>{ws.card.brand}</span>
              <b>•••• •••• •••• {ws.card.last4}</b>
              <small>Expira em {ws.card.expires}</small>
            </div>
          ) : (
            <p className="muted-note">Nenhum cartão cadastrado.</p>
          )}
          <button className="text-button" type="button" onClick={() => setCard(true)}>
            {ws.card ? "Atualizar cartão" : "Cadastrar cartão"}
          </button>
        </article>
      </div>
      <article className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Faturas</h2>
            <p>Histórico de cobranças da assinatura</p>
          </div>
        </div>
        {invoices.length === 0 ? (
          <p className="muted-note">Nenhuma fatura ainda{ws.status === "trial" ? " — você está no período de teste." : "."}</p>
        ) : (
          <div className="data-table">
            <div className="data-row data-row--head">
              <span>Referência</span>
              <span>Plano</span>
              <span>Vencimento</span>
              <span>Valor</span>
              <span>Situação</span>
              <span />
            </div>
            {invoices.map((inv) => (
              <div className="data-row" key={inv.id}>
                <span>{formatMonth(inv.period)}</span>
                <span>{store.plan(inv.planId).name}</span>
                <span>{formatDay(inv.dueDate)}</span>
                <span>
                  <b>{formatPrice(inv.amount)}</b>
                </span>
                <StatusPill tone={INVOICE_TONE[inv.status]}>{INVOICE_LABEL[inv.status]}</StatusPill>
                <span>
                  {inv.status !== "paid" && (
                    <button className="text-button" type="button" onClick={() => run(store.payInvoice(inv.id), "Pagamento aprovado (demonstração).")}>
                      Pagar
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
      {ws.status !== "cancelled" && ws.status !== "trial" && (
        <button
          className="danger-link"
          type="button"
          onClick={() => {
            if (!window.confirm("Cancelar a assinatura? O assistente para de atender e o WhatsApp é desconectado.")) return;
            run(store.cancelSubscription(ws.id), "Assinatura cancelada.");
          }}
        >
          Cancelar assinatura
        </button>
      )}
      {plans && <PlansModal current={ws.planId} onClose={() => setPlans(false)} />}
      {card && <CardModal onClose={() => setCard(false)} />}
    </>
  );
});

const PlansModal = observer(function PlansModal({ current, onClose }: { current: PlanId; onClose: () => void }) {
  const store = usePlatform();
  const ws = store.current!;
  return (
    <Modal title="Comparar planos" description="A mudança vale a partir da próxima fatura." onClose={onClose} wide>
      <div className="pricing-grid pricing-grid--modal">
        {store.plans.map((plan) => (
          <article className={`price-card ${plan.id === current ? "price-card--popular" : ""}`} key={plan.id}>
            {plan.id === current && <span className="popular-label">Plano atual</span>}
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
            <div className="price">
              <sup>R$</sup>
              <strong>{plan.price.toLocaleString("pt-BR")}</strong>
              <span>/mês</span>
            </div>
            <button
              className={`button ${plan.id === current ? "button--outline" : "button--primary"} button--full`}
              type="button"
              disabled={plan.id === current}
              onClick={() => {
                const err = store.changePlan(ws.id, plan.id);
                if (err) return void toast.error(err);
                toast.success(`Plano alterado para ${plan.name}.`);
                onClose();
              }}
            >
              {plan.id === current ? "Plano atual" : `Mudar para ${plan.name}`}
            </button>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span>
                    <Icon name="check" size={14} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Modal>
  );
});

const CardModal = observer(function CardModal({ onClose }: { onClose: () => void }) {
  const store = usePlatform();
  const ws = store.current!;
  const [number, setNumber] = useState("");
  const [expires, setExpires] = useState("");
  const save = () => {
    const err = store.updateCard(ws.id, number, expires);
    if (err) return void toast.error(err);
    toast.success("Cartão salvo.");
    onClose();
  };
  return (
    <Modal
      title="Cartão de crédito"
      description="Demonstração: guardamos só a bandeira e os 4 últimos números. Na etapa de pagamentos, o cartão é tokenizado pelo gateway — a Nuvio nunca vê o número completo."
      onClose={onClose}
      footer={
        <button className="button button--primary button--small" type="button" onClick={save}>
          Salvar cartão
        </button>
      }
    >
      <div className="form-grid">
        <Field full label="Número do cartão" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d ]/g, "").slice(0, 23))} />
        <Field label="Validade" placeholder="MM/AA" value={expires} onChange={(e) => setExpires(e.target.value.replace(/[^\d/]/g, "").slice(0, 5))} />
      </div>
    </Modal>
  );
});
