"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDateTime, maskPhone } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon, type IconName } from "@/core/ui/Icon";
import { DashboardHeader, Field, Modal, StatusPill, TextArea } from "@/core/ui/ui";
import type { IntegrationId } from "@/modules/domain/types";
import { api, usePlatform, useSync } from "@/modules/platform/PlatformProvider";

const OTHERS: { id: IntegrationId; name: string; icon: IconName; text: string; target?: string; placeholder?: string; soon?: boolean }[] = [
  { id: "google-calendar", name: "Google Agenda", icon: "calendar", text: "A IA consulta horários livres e marca agendamentos direto na sua agenda.", target: "Nome da agenda", placeholder: "Ex.: Agenda de avaliações" },
  { id: "google-sheets", name: "Planilhas Google", icon: "document", text: "Cada novo contato e pedido vira uma linha na sua planilha.", target: "Nome da planilha", placeholder: "Ex.: Contatos do WhatsApp" },
  { id: "rd-station", name: "RD Station CRM", icon: "people", text: "Envia leads qualificados pela IA para o seu funil de vendas.", target: "Funil", placeholder: "Ex.: Funil de vendas" },
  { id: "webhook", name: "Webhook", icon: "link", text: "Avisa o seu sistema a cada conversa nova, transferência ou encerramento.", target: "URL do webhook", placeholder: "https://seusistema.com.br/webhooks/nuvio" },
  { id: "instagram", name: "Instagram Direct", icon: "message", text: "Atenda as mensagens do Instagram com o mesmo assistente.", soon: true },
];

export const Integrations = observer(function Integrations() {
  const store = usePlatform();
  const sync = useSync();
  const ws = store.current!;
  const real = sync.info.whatsapp.enabled;
  const [connecting, setConnecting] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<(typeof OTHERS)[number] | null>(null);
  // Endereço do site só existe no navegador: preenchido depois de montar (evita diferença com o HTML do servidor).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const wa = ws.whatsapp;

  return (
    <>
      <DashboardHeader title="Integrações" description="Conecte a Nuvio ao WhatsApp e às ferramentas que sua empresa já usa." />
      <article className="panel whatsapp-card">
        <span className="status-icon status-icon--big">
          <Icon name="whatsapp" size={28} />
        </span>
        <div>
          <h2>WhatsApp Business</h2>
          <p>Conexão oficial pela API da Meta. Seu número fica protegido e os templates de mensagem seguem as regras do WhatsApp.</p>
          {wa.status === "connected" && (
            <p className="whatsapp-details">
              <b>{wa.phone}</b> · aparece como <b>{wa.displayName}</b> · conectado em {wa.connectedAt ? formatDateTime(wa.connectedAt) : "—"}
              <br />
              {wa.mode === "manual" ? "API oficial · conexão manual" : wa.mode === "embedded" ? "API oficial · cadastro incorporado da Meta" : "Conexão simulada (demonstração): nada é enviado ao WhatsApp"}
              {wa.phoneNumberId ? ` · id do número ${wa.phoneNumberId}` : ""}
            </p>
          )}
          {wa.lastError && <p className="whatsapp-error">Última falha: {wa.lastError}</p>}
          {real && wa.status !== "connected" && (
            <p className="whatsapp-details">
              Webhook da Meta: <code>{origin}/api/webhooks/whatsapp</code>
            </p>
          )}
        </div>
        <div className="whatsapp-actions">
          {wa.status === "connected" ? <StatusPill tone="success">Conectado</StatusPill> : wa.status === "pending" ? <StatusPill tone="warning">Aguardando código</StatusPill> : <StatusPill tone="neutral">Desconectado</StatusPill>}
          {wa.status === "connected" ? (
            <button
              className="button button--outline button--small"
              type="button"
              onClick={() => {
                if (!window.confirm("Desconectar o WhatsApp? O assistente para de responder até você conectar de novo.")) return;
                if (wa.mode === "manual" || wa.mode === "embedded") {
                  void api("/api/whatsapp/disconnect", {}).then((r) => {
                    if (!r.ok) return void toast.error(r.body.error ?? "Não foi possível desconectar.");
                    void store.__refresh();
                    toast.success("WhatsApp desconectado e token apagado.");
                  });
                  return;
                }
                store.disconnectWhatsApp(ws.id);
                toast.success("WhatsApp desconectado.");
              }}
            >
              Desconectar
            </button>
          ) : real ? (
            <>
              {sync.info.whatsapp.embedded && (
                <button className="button button--primary button--small" type="button" disabled={busy} onClick={() => void embeddedSignup(sync.info.whatsapp.appId, sync.info.whatsapp.configId, setBusy, store.__refresh)}>
                  <Icon name="whatsapp" size={16} /> Conectar com o Facebook
                </button>
              )}
              <button className="button button--outline button--small" type="button" onClick={() => setManual(true)}>
                Conexão manual
              </button>
            </>
          ) : (
            <button className="button button--primary button--small" type="button" onClick={() => setConnecting(true)}>
              {wa.status === "pending" ? "Continuar conexão" : "Conectar (demonstração)"}
            </button>
          )}
        </div>
      </article>
      <div className="integration-grid">
        {OTHERS.map((it) => {
          const state = ws.integrations[it.id];
          return (
            <article className="panel integration-card" key={it.id}>
              <span className="resource-icon">
                <Icon name={it.icon} />
              </span>
              <h3>{it.name}</h3>
              <p>{it.text}</p>
              {state?.enabled && state.target && <small className="integration-target">{state.target}</small>}
              <div className="integration-foot">
                {it.soon ? <StatusPill tone="neutral">Em breve</StatusPill> : state?.enabled ? <StatusPill tone="success">Ativa</StatusPill> : <StatusPill tone="neutral">Desligada</StatusPill>}
                {!it.soon && (
                  <button className="text-button" type="button" onClick={() => setConfig(it)}>
                    {state?.enabled ? "Configurar" : "Conectar"} <Icon name="arrow" size={15} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="muted-note">
        <Icon name="lock" size={13} /> {real ? "WhatsApp pela API oficial da Meta. As demais integrações ainda são simuladas." : "Demonstração: as conexões são simuladas. Com as chaves da Meta configuradas no servidor, o WhatsApp passa a usar a API oficial."}
      </p>
      {connecting && <WhatsAppModal onClose={() => setConnecting(false)} />}
      {manual && <ManualModal onClose={() => setManual(false)} />}
      {config && <IntegrationModal integration={config} onClose={() => setConfig(null)} />}
    </>
  );
});

/** Conexão em 2 etapas (na versão real: cadastro incorporado da Meta + código por SMS). */
const WhatsAppModal = observer(function WhatsAppModal({ onClose }: { onClose: () => void }) {
  const store = usePlatform();
  const ws = store.current!;
  const pending = ws.whatsapp.status === "pending";
  const [phone, setPhone] = useState(ws.whatsapp.phone);
  const [name, setName] = useState(ws.whatsapp.displayName || ws.name);
  const [code, setCode] = useState("");

  const start = () => {
    const err = store.startWhatsApp(ws.id, phone, name);
    if (err) return void toast.error(err);
    toast.info("Enviamos um código por SMS para o número informado. (Demonstração: use quaisquer 6 números.)");
  };
  const verify = () => {
    const err = store.verifyWhatsApp(ws.id, code);
    if (err) return void toast.error(err);
    toast.success("WhatsApp conectado! O assistente já está atendendo.");
    onClose();
  };

  return (
    <Modal
      title="Conectar WhatsApp Business"
      description={pending ? "Etapa 2 de 2 · Verificação" : "Etapa 1 de 2 · Número e nome de exibição"}
      onClose={onClose}
      footer={
        <>
          <button className="button button--ghost button--small" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button--primary button--small" type="button" onClick={pending ? verify : start}>
            {pending ? "Verificar e conectar" : "Enviar código"}
          </button>
        </>
      }
    >
      {pending ? (
        <div className="form-grid">
          <p className="field--full modal-text">
            Digite o código de 6 números enviado para <b>{ws.whatsapp.phone}</b>.
          </p>
          <Field full label="Código de verificação" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </div>
      ) : (
        <div className="form-grid">
          <Field full label="Número do WhatsApp" inputMode="tel" placeholder="+55 63 98765-4321" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} hint="Não pode estar ativo no WhatsApp comum (aplicativo)." />
          <Field full label="Nome de exibição" value={name} onChange={(e) => setName(e.target.value)} hint="É o nome que seus clientes verão." />
        </div>
      )}
    </Modal>
  );
});

const IntegrationModal = observer(function IntegrationModal({ integration: it, onClose }: { integration: (typeof OTHERS)[number]; onClose: () => void }) {
  const store = usePlatform();
  const ws = store.current!;
  const state = ws.integrations[it.id];
  const [target, setTarget] = useState(state?.target ?? "");
  const save = (enabled: boolean) => {
    const err = store.setIntegration(ws.id, it.id, enabled, target);
    if (err) return void toast.error(err);
    toast.success(enabled ? `${it.name} conectada.` : `${it.name} desligada.`);
    onClose();
  };
  return (
    <Modal
      title={it.name}
      description={it.text}
      onClose={onClose}
      footer={
        <>
          {state?.enabled && (
            <button className="button button--ghost button--small" type="button" onClick={() => save(false)}>
              Desligar
            </button>
          )}
          <button className="button button--primary button--small" type="button" onClick={() => save(true)}>
            {state?.enabled ? "Salvar" : "Conectar"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        {it.target && <Field full label={it.target} placeholder={it.placeholder} value={target} onChange={(e) => setTarget(e.target.value)} />}
        <p className="field--full modal-text">Demonstração: ao conectar, a integração aparece como ativa. A autorização real com {it.name} entra na etapa de APIs.</p>
      </div>
    </Modal>
  );
});

/**
 * Conexão manual com a API do WhatsApp — ideal para o NÚMERO DE TESTE da Meta:
 * developers.facebook.com → seu app → WhatsApp → Configuração da API (id do número + token).
 */
const ManualModal = observer(function ManualModal({ onClose }: { onClose: () => void }) {
  const store = usePlatform();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await api("/api/whatsapp/manual", { phoneNumberId, wabaId, token });
    setBusy(false);
    if (!r.ok) return void toast.error(r.body.error ?? "Não foi possível conectar.");
    await store.__refresh();
    toast.success("WhatsApp conectado pela API oficial. Mande uma mensagem para o número para testar!");
    onClose();
  };
  return (
    <Modal
      title="Conexão manual (API oficial)"
      description="Use os dados do painel de desenvolvedores da Meta. O token é conferido na Meta e guardado cifrado — não volta para o navegador."
      onClose={onClose}
      footer={
        <button className="button button--primary button--small" type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Conferindo na Meta…" : "Conectar"}
        </button>
      }
    >
      <div className="form-grid">
        <Field full label="Id do número (Phone number ID)" inputMode="numeric" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ""))} hint="WhatsApp → Configuração da API → “Phone number ID”." />
        <Field full optional label="Id da conta do WhatsApp Business (WABA ID)" inputMode="numeric" value={wabaId} onChange={(e) => setWabaId(e.target.value.replace(/\D/g, ""))} />
        <TextArea full label="Token de acesso" rows={3} value={token} onChange={(e) => setToken(e.target.value.trim())} hint="Token temporário (24 h) do número de teste, ou token permanente de um usuário do sistema." />
      </div>
    </Modal>
  );
});

type FBLoginResponse = { authResponse?: { code?: string } };
type FBSdk = { init: (o: object) => void; login: (cb: (r: FBLoginResponse) => void, o: object) => void };

/**
 * Cadastro incorporado da Meta (Embedded Signup): abre a janela oficial, a empresa escolhe/cria a conta
 * e o número; a Meta devolve um código (trocado por token no servidor) e os ids da conta e do número.
 */
async function embeddedSignup(appId: string, configId: string, setBusy: (b: boolean) => void, refresh: () => Promise<void>) {
  setBusy(true);
  try {
    const w = window as unknown as { FB?: FBSdk; fbAsyncInit?: () => void };
    if (!w.FB) {
      await new Promise<void>((resolve, reject) => {
        w.fbAsyncInit = () => {
          w.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v23.0" });
          resolve();
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/pt_BR/sdk.js";
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onerror = () => reject(new Error("Não foi possível carregar o SDK da Meta."));
        document.body.appendChild(script);
      });
    }
    const session: { wabaId?: string; phoneNumberId?: string } = {};
    const onMessage = (event: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(event.origin).hostname)) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          session.wabaId = data.data?.waba_id;
          session.phoneNumberId = data.data?.phone_number_id;
        }
      } catch {
        // mensagens de outros tipos
      }
    };
    window.addEventListener("message", onMessage);
    const code = await new Promise<string | undefined>((resolve) =>
      w.FB!.login((r) => resolve(r.authResponse?.code), { config_id: configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, sessionInfoVersion: "3" } }),
    );
    window.removeEventListener("message", onMessage);
    if (!code || !session.wabaId || !session.phoneNumberId) return void toast.error("Cadastro não concluído na janela da Meta.");
    const r = await api("/api/whatsapp/embedded", { code, wabaId: session.wabaId, phoneNumberId: session.phoneNumberId });
    if (!r.ok) return void toast.error(r.body.error ?? "Não foi possível concluir a conexão.");
    await refresh();
    toast.success("WhatsApp conectado pela API oficial!");
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    setBusy(false);
  }
}
