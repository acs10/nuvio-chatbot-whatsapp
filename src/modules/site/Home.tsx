"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { observer } from "@/core/state/mobx";
import { Icon, type IconName } from "@/core/ui/Icon";
import { Logo } from "@/core/ui/ui";
import { DEMO_PASSWORD } from "@/modules/platform/demo-data";
import { usePlatform } from "@/modules/platform/PlatformProvider";

/* Site de apresentação — JSX do design (Figma Make), com botões ligados às páginas reais. */

function Header() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const scroll = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setOpen(false)
  }

  return (
    <header className="marketing-header">
      <div className="container header-inner">
        <Logo />
        <button
          className="icon-button mobile-menu"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Icon name={open ? "x" : "menu"} />
          <span className="sr-only">Abrir menu</span>
        </button>
        <nav className={`main-nav ${open ? "main-nav--open" : ""}`}>
          <button onClick={() => scroll("produto")} type="button">
            Produto
          </button>
          <button onClick={() => scroll("recursos")} type="button">
            Recursos
          </button>
          <button onClick={() => scroll("planos")} type="button">
            Planos
          </button>
          <button onClick={() => scroll("seguranca")} type="button">
            Segurança
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="button button--ghost"
            onClick={() => router.push("/entrar")}
            type="button"
          >
            Entrar
          </button>
          <button
            className="button button--primary button--small"
            onClick={() => router.push("/comecar")}
            type="button"
          >
            Começar agora <Icon name="arrow" size={17} />
          </button>
        </div>
      </div>
    </header>
  )
}

function HeroPreview() {
  return (
    <div className="hero-preview">
      <div className="preview-glow" />
      <div className="preview-shell">
        <div className="preview-top">
          <div className="preview-brand">
            <span className="avatar avatar--brand">
              <Icon name="sparkle" size={18} />
            </span>
            <span>
              <b>Atendente Nuvio</b>
              <small>
                <i /> Online agora
              </small>
            </span>
          </div>
          <span className="tiny-pill">IA ativa</span>
        </div>
        <div className="chat-area">
          <div className="chat-time">Hoje, 10:32</div>
          <div className="bubble bubble--incoming">
            Olá, Mariana! Sou a assistente virtual da sua empresa. Como posso
            ajudar?
            <small>10:32</small>
          </div>
          <div className="bubble bubble--outgoing">
            Gostaria de agendar uma avaliação para esta semana.
            <small>
              10:33 <Icon name="check" size={12} />
            </small>
          </div>
          <div className="bubble bubble--incoming">
            Claro! Encontrei estes horários disponíveis:
            <div className="schedule-options">
              <button type="button">Quarta, 14h</button>
              <button type="button">Quinta, 10h</button>
            </div>
            <small>10:33</small>
          </div>
        </div>
        <div className="preview-input">
          <span>Digite uma mensagem...</span>
          <span>
            <Icon name="send" size={18} />
          </span>
        </div>
      </div>
      <div className="floating-card floating-card--top">
        <span className="floating-icon">
          <Icon name="clock" size={19} />
        </span>
        <span>
          <b>24h por dia</b>
          <small>Sem deixar clientes esperando</small>
        </span>
      </div>
      <div className="floating-card floating-card--bottom">
        <div className="mini-chart">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span>
          <small>Resolução automática</small>
          <b>
            87,4% <em>+12%</em>
          </b>
        </span>
      </div>
    </div>
  )
}

export const Home = observer(function Home() {
  const store = usePlatform()
  const router = useRouter()
  const demo = async () => {
    await store.login("mariana@lumina.com.br", DEMO_PASSWORD)
    router.push("/painel")
  }
  return (
    <div className="marketing-page">
      <Header />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span>
                  <Icon name="sparkle" size={14} />
                </span>{" "}
                Atendimento inteligente no WhatsApp
              </div>
              <h1>
                Converse, venda e encante. <span>No automático.</span>
              </h1>
              <p className="hero-subtitle">
                Transforme seu WhatsApp em um canal de atendimento inteligente,
                treinado com o conhecimento da sua empresa e disponível o tempo
                todo.
              </p>
              <div className="hero-actions">
                <button
                  className="button button--primary button--large"
                  onClick={() => router.push("/comecar")}
                  type="button"
                >
                  Criar meu chatbot <Icon name="arrow" size={19} />
                </button>
                <button
                  className="button button--play button--large"
                  onClick={() => void demo()}
                  type="button"
                >
                  <span>
                    <Icon name="play" size={16} />
                  </span>{" "}
                  Ver demonstração
                </button>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>
        <section className="section product-section" id="produto">
          <div className="container">
            <div className="section-heading">
              <div className="eyebrow eyebrow--plain">
                Simples desde o início
              </div>
              <h2>Do seu conhecimento a conversas que geram resultado.</h2>
              <p>Você ensina sobre sua empresa. A Nuvio cuida do resto.</p>
            </div>
            <div className="steps-grid">
              {[
                [
                  "01",
                  "Conte sobre sua empresa",
                  "Adicione seu site, documentos, produtos e o jeito que sua marca se comunica.",
                  "document",
                ],
                [
                  "02",
                  "Personalize seu assistente",
                  "Defina personalidade, objetivos, horários e quando transferir para sua equipe.",
                  "sparkle",
                ],
                [
                  "03",
                  "Conecte ao WhatsApp",
                  "Faça a conexão oficial com a Meta e comece a atender com segurança.",
                  "whatsapp",
                ],
              ].map(([number, title, text, icon], index) => (
                <article className="step-card" key={number}>
                  <div className="step-top">
                    <span className="step-number">{number}</span>
                    <span className="step-icon">
                      <Icon name={icon as IconName} size={24} />
                    </span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  {index < 2 && (
                    <span className="step-connector">
                      <Icon name="arrow" size={18} />
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section features-section" id="recursos">
          <div className="container">
            <div className="section-heading section-heading--left">
              <div className="eyebrow eyebrow--plain">Feito para resolver</div>
              <h2>
                Um atendimento que parece humano.
                <br />E trabalha como máquina.
              </h2>
            </div>
            <div className="bento-grid">
              <article className="feature-card feature-card--large">
                <div>
                  <span className="feature-icon">
                    <Icon name="sparkle" size={22} />
                  </span>
                  <h3>IA treinada com seu negócio</h3>
                  <p>
                    Respostas precisas usando somente as informações que você
                    aprovar.
                  </p>
                </div>
                <div className="knowledge-visual">
                  <div className="knowledge-file">
                    <Icon name="document" />
                    <span>
                      <b>Catálogo de serviços.pdf</b>
                      <small>Conhecimento atualizado</small>
                    </span>
                    <i>
                      <Icon name="check" size={13} />
                    </i>
                  </div>
                  <div className="knowledge-file">
                    <Icon name="document" />
                    <span>
                      <b>Políticas da empresa</b>
                      <small>32 respostas aprendidas</small>
                    </span>
                    <i>
                      <Icon name="check" size={13} />
                    </i>
                  </div>
                  <div className="ai-beam">
                    <span>
                      <Icon name="sparkle" size={18} />
                    </span>
                  </div>
                </div>
              </article>
              <article className="feature-card">
                <span className="feature-icon feature-icon--green">
                  <Icon name="whatsapp" size={22} />
                </span>
                <h3>WhatsApp oficial</h3>
                <p>
                  Conexão segura pela API oficial da Meta, com práticas que
                  protegem seu número.
                </p>
                <div className="official-badge">
                  <Icon name="check" size={14} /> Conexão verificada
                </div>
              </article>
              <article className="feature-card feature-card--dark">
                <span className="feature-icon feature-icon--dark">
                  <Icon name="trend" size={22} />
                </span>
                <h3>Resultados em tempo real</h3>
                <p>
                  Acompanhe conversas, satisfação e oportunidades em um só
                  painel.
                </p>
                <div className="feature-chart">
                  <div>
                    <span>Conversas resolvidas</span>
                    <b>1.842</b>
                  </div>
                  <svg viewBox="0 0 260 70" preserveAspectRatio="none">
                    <path d="M0 59C25 54 31 45 48 48s29 10 48-4 30-2 45-13 29 2 47-10 33-8 72-19" />
                    <path
                      className="chart-fill"
                      d="M0 59C25 54 31 45 48 48s29 10 48-4 30-2 45-13 29 2 47-10 33-8 72-19V70H0Z"
                    />
                  </svg>
                </div>
              </article>
              <article className="feature-card feature-card--wide">
                <div>
                  <span className="feature-icon">
                    <Icon name="people" size={22} />
                  </span>
                  <h3>Humano quando precisa</h3>
                  <p>
                    A IA identifica situações sensíveis e transfere a conversa
                    com todo o contexto para sua equipe.
                  </p>
                </div>
                <div className="handoff">
                  <div className="handoff-user">
                    <span className="avatar">AI</span>
                    <i />
                  </div>
                  <div className="handoff-line">
                    <span>
                      <Icon name="arrow" size={16} />
                    </span>
                  </div>
                  <div className="handoff-user">
                    <span className="avatar avatar--photo">MC</span>
                    <i />
                  </div>
                  <small>Transferência concluída em 3s</small>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section security-section" id="seguranca">
          <div className="container security-grid">
            <div>
              <div className="eyebrow eyebrow--plain">
                Segurança em primeiro lugar
              </div>
              <h2>Sua marca protegida em cada conversa.</h2>
              <p>
                Operamos de acordo com as políticas da Meta e boas práticas de
                privacidade. Controle os envios, consentimentos e acessos da sua
                equipe.
              </p>
              <div className="security-list">
                <span>
                  <Icon name="check" size={15} /> Conformidade com a LGPD
                </span>
                <span>
                  <Icon name="check" size={15} /> Templates aprovados pela Meta
                </span>
                <span>
                  <Icon name="check" size={15} /> Dados criptografados
                </span>
              </div>
            </div>
            <div className="security-visual">
              <div className="shield">
                <span>
                  <Icon name="check" size={32} />
                </span>
              </div>
              <div className="orbit orbit--one">
                <i />
              </div>
              <div className="orbit orbit--two">
                <i />
              </div>
              <div className="security-float security-float--one">
                <Icon name="whatsapp" size={18} /> API oficial
              </div>
              <div className="security-float security-float--two">
                <Icon name="company" size={18} /> LGPD
              </div>
            </div>
          </div>
        </section>

        <section className="section pricing-section" id="planos">
          <div className="container">
            <div className="section-heading">
              <div className="eyebrow eyebrow--plain">Planos transparentes</div>
              <h2>Comece pequeno. Cresça sem limites.</h2>
              <p>
                Todos os planos incluem 14 dias grátis e configuração guiada.
              </p>
            </div>
            <div className="pricing-grid">
              {store.plans.map((plan) => (
                <article
                  className={`price-card ${
                    plan.popular ? "price-card--popular" : ""
                  }`}
                  key={plan.name}
                >
                  {plan.popular && (
                    <span className="popular-label">Mais escolhido</span>
                  )}
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className="price">
                    <sup>R$</sup>
                    <strong>{plan.price.toLocaleString("pt-BR")}</strong>
                    <span>/mês</span>
                  </div>
                  <button
                    className={`button ${
                      plan.popular ? "button--primary" : "button--outline"
                    } button--full`}
                    onClick={() => router.push("/comecar")}
                    type="button"
                  >
                    Começar grátis
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
          </div>
        </section>

        <section className="final-cta">
          <div className="container">
            <div className="cta-card">
              <div className="cta-orb cta-orb--one" />
              <div className="cta-orb cta-orb--two" />
              <div className="cta-content">
                <span className="cta-icon">
                  <Icon name="message" size={26} />
                </span>
                <h2>Seu próximo cliente já está no WhatsApp.</h2>
                <p>
                  Esteja pronto para atender, vender e encantar — a qualquer
                  hora.
                </p>
                <button
                  className="button button--white button--large"
                  onClick={() => router.push("/comecar")}
                  type="button"
                >
                  Começar meus 14 dias grátis <Icon name="arrow" size={19} />
                </button>
                <small>Sem cartão de crédito · Cancele quando quiser</small>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer>
        <div className="container footer-grid">
          <div>
            <Logo />
            <p>
              Conversas mais inteligentes.
              <br />
              Negócios mais próximos.
            </p>
          </div>
          <div>
            <b>Produto</b>
            <a href="#recursos">Recursos</a>
            <a href="#produto">Como funciona</a>
            <a href="#planos">Planos</a>
          </div>
          <div>
            <b>Acesso</b>
            <Link href="/entrar">Entrar</Link>
            <Link href="/comecar">Criar conta</Link>
            <a href="#seguranca">Segurança</a>
          </div>
          <div>
            <b>Legal</b>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade#lgpd">LGPD</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Nuvio Tecnologia. Todos os direitos reservados.</span>
          <span>Feito no Brasil</span>
        </div>
      </footer>
    </div>
  )
})
