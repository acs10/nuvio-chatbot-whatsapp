"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { observer } from "@/core/state/mobx";
import { Icon } from "@/core/ui/Icon";
import { Field, Logo } from "@/core/ui/ui";
import { DEMO_PASSWORD } from "@/modules/platform/demo-data";
import { usePlatform } from "@/modules/platform/PlatformProvider";

/** Entrar (mesmo visual do cadastro). Botões de acesso rápido para a demonstração. */
export const LoginPage = observer(function LoginPage() {
  const store = usePlatform();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const enter = async (mail: string, pass: string) => {
    setBusy(true);
    const err = await store.login(mail, pass);
    setBusy(false);
    if (err) return setError(err);
    router.replace(store.role === "admin" ? "/admin" : "/painel");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enter(email, password);
  };

  return (
    <div className="onboarding-page">
      <aside className="onboarding-aside">
        <Logo light />
        <div className="onboarding-pitch">
          <span className="aside-icon">
            <Icon name="message" size={24} />
          </span>
          <h2>Bem-vindo de volta.</h2>
          <p>Acompanhe suas conversas, treine seu assistente e veja os resultados do seu atendimento.</p>
        </div>
        <small className="aside-legal">© {new Date().getFullYear()} Nuvio · Seus dados estão seguros</small>
      </aside>
      <main className="onboarding-main">
        <Link className="close-onboarding" href="/">
          <Icon name="x" />
          <span className="sr-only">Fechar</span>
        </Link>
        <div className="onboarding-wrap">
          <div className="form-heading">
            <span className="form-icon">
              <Icon name="user" size={23} />
            </span>
            <h1>Entrar na Nuvio</h1>
            <p>Use o e-mail e a senha da sua conta.</p>
          </div>
          <form onSubmit={submit} className="form-grid form-grid--single" noValidate>
            <Field full label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field full label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && (
              <p role="alert" className="form-alert field--full">
                {error}
              </p>
            )}
            <button className="button button--primary button--full field--full" type="submit" disabled={busy}>
              Entrar <Icon name="arrow" size={18} />
            </button>
          </form>
          <div className="demo-box">
            <b>Demonstração — acesso rápido (senha {DEMO_PASSWORD})</b>
            <div>
              <button type="button" className="button button--outline button--small" disabled={busy} onClick={() => void enter("mariana@lumina.com.br", DEMO_PASSWORD)}>
                <Icon name="company" size={16} /> Cliente (Clínica Lumina)
              </button>
              <button type="button" className="button button--outline button--small" disabled={busy} onClick={() => void enter("admin@nuvio.com.br", DEMO_PASSWORD)}>
                <Icon name="settings" size={16} /> Backoffice Nuvio
              </button>
            </div>
          </div>
          <div className="form-help">
            Ainda não tem conta? <Link href="/comecar">Comece seus {store.settings.trialDays} dias grátis</Link>
          </div>
        </div>
      </main>
    </div>
  );
});
