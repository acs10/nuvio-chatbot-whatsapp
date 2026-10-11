"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { initials } from "@/core/lib/format";
import { observer } from "@/core/state/mobx";
import { Icon, type IconName } from "@/core/ui/Icon";
import { Logo } from "@/core/ui/ui";
import type { Role } from "@/modules/domain/types";
import { resetDemo, usePlatform, useSync } from "@/modules/platform/PlatformProvider";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

/** Estrutura das áreas logadas (menu lateral do design) com proteção por perfil. */
export const AppShell = observer(function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const store = usePlatform();
  const sync = useSync();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allowed = store.role === role;
  const hydrated = store.hydrated;

  useEffect(() => {
    if (hydrated && !allowed) router.replace("/entrar");
  }, [hydrated, allowed, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (!hydrated || !allowed || !store.user) return <div className="app-loading">Carregando…</div>;

  const ws = store.current;
  const waiting = ws ? store.conversationsOf(ws.id).filter((c) => c.status === "waiting" || c.unread > 0).length : 0;
  const nav: NavItem[] =
    role === "client"
      ? [
          { href: "/painel", label: "Visão geral", icon: "dashboard" },
          { href: "/painel/conversas", label: "Conversas", icon: "conversation", badge: waiting },
          { href: "/painel/chatbot", label: "Meu chatbot", icon: "bot" },
          { href: "/painel/conhecimento", label: "Conhecimento", icon: "document" },
          { href: "/painel/integracoes", label: "Integrações", icon: "integration" },
          { href: "/painel/plano", label: "Plano e cobrança", icon: "money" },
        ]
      : [
          { href: "/admin", label: "Visão geral", icon: "dashboard" },
          { href: "/admin/clientes", label: "Clientes", icon: "people" },
          { href: "/admin/assinaturas", label: "Assinaturas", icon: "money", badge: store.invoices.filter((i) => i.status === "overdue").length },
          { href: "/admin/operacao", label: "Operação", icon: "bot" },
          { href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
        ];
  const home = nav[0].href;
  const logout = () => {
    store.logout();
    router.replace("/");
  };
  const reset = async () => {
    if (!window.confirm("Restaurar os dados de demonstração no banco? Contas, conversas e alterações de todos os usuários serão apagadas.")) return;
    const err = await resetDemo(store);
    if (err) return void toast.error(err);
    toast.success("Demonstração restaurada. Entre novamente.");
    router.replace("/entrar");
  };

  return (
    <div className={`app-layout ${open ? "app-layout--menu" : ""}`}>
      <div className="app-topbar">
        <Logo href={home} />
        <button className="icon-button" type="button" onClick={() => setOpen(!open)} aria-label="Abrir menu" aria-expanded={open}>
          <Icon name={open ? "x" : "menu"} />
        </button>
      </div>
      <aside className="app-sidebar">
        <Logo href={home} />
        <div className="workspace-switcher">
          <span className="workspace-logo">{role === "admin" ? "N" : initials(ws?.name ?? "N").slice(0, 1)}</span>
          <span>
            <b>{role === "admin" ? "Nuvio Admin" : ws?.name}</b>
            <small>{role === "admin" ? "Backoffice" : `Plano ${store.plan(ws?.planId).name}`}</small>
          </span>
        </div>
        <nav aria-label="Menu">
          <small className="nav-label">{role === "admin" ? "GESTÃO" : "MENU"}</small>
          {nav.map((item) => {
            const active = item.href === home ? pathname === home : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                <Icon name={item.icon} size={19} /> {item.label}
                {item.badge ? <em>{item.badge}</em> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          {role === "admin" && (
            <button className="support-link" onClick={() => void reset()} type="button">
              <Icon name="refresh" size={18} /> Restaurar demonstração
            </button>
          )}
          <Link className="support-link" href="/">
            <Icon name="globe" size={18} /> Site da Nuvio
          </Link>
          <div className="user-card">
            <span className="avatar avatar--photo">{initials(store.user.name)}</span>
            <span>
              <b>{store.user.name}</b>
              <small>{role === "admin" ? "Administrador" : store.user.email}</small>
            </span>
            <button onClick={logout} type="button" aria-label="Sair" title="Sair">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className={`dashboard-main ${role === "admin" ? "admin-main" : ""}`}>
        {role === "client" && ws?.status === "trial" && ws.trialEndsAt && (
          <div className="trial-banner">
            <Icon name="sparkle" size={16} /> Teste grátis até {new Date(`${ws.trialEndsAt}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}.{" "}
            <Link href="/painel/plano">Ativar assinatura</Link>
          </div>
        )}
        {sync.error && (
          <div className="trial-banner trial-banner--danger" role="alert">
            <Icon name="alert" size={16} /> {sync.error}
          </div>
        )}
        {role === "client" && ws?.whatsapp.lastError && ws.whatsapp.status === "connected" && (
          <div className="trial-banner trial-banner--danger">
            <Icon name="whatsapp" size={16} /> WhatsApp: {ws.whatsapp.lastError} <Link href="/painel/integracoes">Ver conexão</Link>
          </div>
        )}
        {role === "client" && ws?.status === "past_due" && (
          <div className="trial-banner trial-banner--danger">
            <Icon name="alert" size={16} /> Há uma fatura em atraso. Regularize para não interromper o atendimento. <Link href="/painel/plano">Ver faturas</Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
});
