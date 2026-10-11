"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { observer } from "@/core/state/mobx";
import { Icon } from "@/core/ui/Icon";
import { Field, Logo, SelectField, TextArea } from "@/core/ui/ui";
import { TONE_LABEL, type Tone } from "@/modules/domain/types";
import { PlatformStore, type SignupInput } from "@/modules/platform/platform-store";
import { usePlatform } from "@/modules/platform/PlatformProvider";

const SEGMENTS = ["Saúde e bem-estar", "Varejo", "Serviços", "Educação", "Alimentação", "Outro"];
const TEAM = ["Só eu", "2 a 10 pessoas", "11 a 50 pessoas", "Mais de 50 pessoas"];

/** Cadastro em 4 etapas (design do Figma Make): empresa → plano → assistente → conexão. */
export const Onboarding = observer(function Onboarding() {
  const store = usePlatform();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState<SignupInput>({ company: "", name: "", email: "", password: "", segment: SEGMENTS[0], teamSize: TEAM[1], planId: "profissional", assistantName: "", tone: "amigavel", objective: "", website: "" });
  const set = <K extends keyof SignupInput>(k: K, v: SignupInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const next = async (event: FormEvent) => {
    event.preventDefault();
    const e = PlatformStore.validateSignup(f, step);
    if (step === 1 && !e.email && store.emailInUse(f.email)) e.email = "Já existe uma conta com este e-mail.";
    if (step === 4 && !accept) e.accept = "É preciso aceitar os termos para continuar.";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < 4) return setStep(step + 1);
    setBusy(true);
    const result = await store.signup(f);
    setBusy(false);
    if (Object.keys(result).length) {
      setErrors(result);
      setStep(result.company || result.name || result.email || result.password ? 1 : 3);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="success-page">
        <div className="success-card">
          <div className="success-mark">
            <Icon name="check" size={34} />
          </div>
          <span className="eyebrow eyebrow--plain">Tudo pronto</span>
          <h1>Seu espaço foi criado!</h1>
          <p>Você tem {store.settings.trialDays} dias grátis. Agora treine seu assistente e conecte seu número do WhatsApp com nosso guia passo a passo.</p>
          <button className="button button--primary button--large" onClick={() => router.push("/painel")} type="button">
            Acessar meu painel <Icon name="arrow" />
          </button>
          <Link className="text-button" href="/">
            Voltar para o site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <aside className="onboarding-aside">
        <Logo light />
        <div className="onboarding-pitch">
          <span className="aside-icon">
            <Icon name="sparkle" size={24} />
          </span>
          <h2>Seu atendimento inteligente começa aqui.</h2>
          <p>Em poucos minutos, vamos preparar a base para seu chatbot.</p>
        </div>
        <small className="aside-legal">© {new Date().getFullYear()} Nuvio · Seus dados estão seguros</small>
      </aside>
      <main className="onboarding-main">
        <Link className="close-onboarding" href="/">
          <Icon name="x" />
          <span className="sr-only">Fechar</span>
        </Link>
        <div className="onboarding-wrap">
          <div className="progress-head">
            <span>Etapa {step} de 4</span>
            <b>{step * 25}% concluído</b>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${step * 25}%` }} />
          </div>
          <form onSubmit={next} noValidate>
            {step === 1 && (
              <>
                <div className="form-heading">
                  <span className="form-icon">
                    <Icon name="company" size={23} />
                  </span>
                  <h1>Vamos conhecer sua empresa</h1>
                  <p>Essas informações ajudam a personalizar sua experiência.</p>
                </div>
                <div className="form-grid">
                  <Field full label="Nome da empresa" placeholder="Ex.: Empresa Aurora" value={f.company} error={errors.company} onChange={(e) => set("company", e.target.value)} />
                  <Field label="Seu nome" placeholder="Nome completo" autoComplete="name" value={f.name} error={errors.name} onChange={(e) => set("name", e.target.value)} />
                  <Field label="E-mail profissional" type="email" autoComplete="email" value={f.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
                  <Field label="Crie uma senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres." value={f.password} error={errors.password} onChange={(e) => set("password", e.target.value)} />
                  <SelectField label="Segmento" value={f.segment} onChange={(e) => set("segment", e.target.value)}>
                    {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
                  </SelectField>
                  <SelectField full label="Tamanho da equipe" value={f.teamSize} onChange={(e) => set("teamSize", e.target.value)}>
                    {TEAM.map((s) => <option key={s}>{s}</option>)}
                  </SelectField>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className="form-heading">
                  <span className="form-icon">
                    <Icon name="money" size={23} />
                  </span>
                  <h1>Escolha o plano ideal</h1>
                  <p>{store.settings.trialDays} dias grátis em qualquer plano. Você poderá alterar quando quiser.</p>
                </div>
                <div className="select-plans">
                  {store.plans.map((item) => (
                    <label className={`select-plan ${f.planId === item.id ? "select-plan--active" : ""}`} key={item.id}>
                      <input checked={f.planId === item.id} name="plan" onChange={() => set("planId", item.id)} type="radio" />
                      <span className="radio-dot" />
                      <span>
                        <b>{item.name}</b>
                        <small>{item.features[1]}</small>
                      </span>
                      <strong>
                        R$ {item.price.toLocaleString("pt-BR")}
                        <small>/mês</small>
                      </strong>
                    </label>
                  ))}
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="form-heading">
                  <span className="form-icon">
                    <Icon name="bot" size={23} />
                  </span>
                  <h1>Personalize seu assistente</h1>
                  <p>Dê uma identidade e um objetivo inicial para a IA.</p>
                </div>
                <div className="form-grid">
                  <Field label="Nome do assistente" placeholder="Ex.: Lumi" value={f.assistantName} error={errors.assistantName} onChange={(e) => set("assistantName", e.target.value)} />
                  <SelectField label="Tom de voz" value={f.tone} onChange={(e) => set("tone", e.target.value as Tone)}>
                    {(Object.keys(TONE_LABEL) as Tone[]).map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
                  </SelectField>
                  <TextArea full label="Principal objetivo" rows={4} placeholder="Ex.: Responder dúvidas sobre serviços e valores e ajudar clientes a agendar." value={f.objective} error={errors.objective} onChange={(e) => set("objective", e.target.value)} />
                  <Field full optional label="Site da empresa" type="url" placeholder="https://suaempresa.com.br" value={f.website} error={errors.website} hint="Vamos ler as páginas para treinar o assistente." onChange={(e) => set("website", e.target.value)} />
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <div className="form-heading">
                  <span className="form-icon form-icon--green">
                    <Icon name="whatsapp" size={23} />
                  </span>
                  <h1>Prepare sua conexão</h1>
                  <p>Usamos a API oficial da Meta para manter seu número seguro.</p>
                </div>
                <div className="connect-box">
                  <div className="connect-brand">
                    <span>
                      <Icon name="whatsapp" size={26} />
                    </span>
                    <div>
                      <b>WhatsApp Business</b>
                      <small>Conexão oficial via Meta</small>
                    </div>
                    <i>
                      <Icon name="check" size={14} />
                    </i>
                  </div>
                  <div className="connect-steps">
                    {[
                      ["Conta comercial da Meta", "Você poderá criar uma durante a conexão."],
                      ["Número de telefone", "Que não esteja ativo no WhatsApp convencional."],
                      ["Verificação segura", "Um código será enviado por SMS ou ligação."],
                    ].map(([title, text], i) => (
                      <span key={title}>
                        <i>{i + 1}</i>
                        <p>
                          <b>{title}</b>
                          <small>{text}</small>
                        </p>
                      </span>
                    ))}
                  </div>
                </div>
                <label className="check-field">
                  <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                  <span>
                    <Icon name="check" size={13} />
                  </span>
                  <p>
                    Li e concordo com os <Link href="/termos" target="_blank">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank">Política de Privacidade</Link>.
                  </p>
                </label>
                {errors.accept && <small className="field-error">{errors.accept}</small>}
              </>
            )}
            <div className="form-actions">
              {step > 1 ? (
                <button className="button button--ghost" onClick={() => setStep(step - 1)} type="button">
                  Voltar
                </button>
              ) : (
                <Link className="button button--ghost" href="/entrar">
                  Já tenho conta
                </Link>
              )}
              <button className="button button--primary" type="submit" disabled={busy}>
                {step === 4 ? "Criar meu espaço" : "Continuar"} <Icon name="arrow" size={18} />
              </button>
            </div>
          </form>
          <div className="form-help">
            <Icon name="help" size={17} /> Precisa de ajuda? <a href="mailto:contato@nuvio.com.br">Fale com nosso time</a>
          </div>
        </div>
      </main>
    </div>
  );
});
