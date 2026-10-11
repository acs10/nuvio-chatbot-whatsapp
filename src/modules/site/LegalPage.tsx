import Link from "next/link";
import { Logo } from "@/core/ui/ui";

const PRIVACY = [
  ["Quem somos", "A Nuvio Tecnologia oferece uma plataforma para empresas atenderem seus clientes pelo WhatsApp com ajuda de inteligência artificial. Para as conversas, a empresa cliente é a controladora dos dados; a Nuvio é a operadora."],
  ["Dados que tratamos", "Dos clientes da plataforma: nome, e-mail, dados da empresa e de pagamento (o cartão é guardado pelo provedor de pagamentos; a Nuvio vê só os 4 últimos números). Das conversas: nome e telefone do contato e o conteúdo das mensagens, para responder e gerar os relatórios."],
  ["Para que usamos", "Prestar o serviço de atendimento, treinar o assistente apenas com a base de conhecimento da própria empresa, gerar relatórios, cobrar a assinatura e cumprir obrigações legais. Não vendemos dados e não usamos as conversas de uma empresa para atender outra."],
  ["WhatsApp e Meta", "A conexão é feita pela API oficial do WhatsApp Business, seguindo as políticas da Meta. Mensagens iniciadas pela empresa usam modelos aprovados e exigem consentimento do contato."],
  ["Segurança", "Acesso por login, dados criptografados em trânsito, separação entre empresas e registro das ações da equipe."],
  ["Seus direitos (LGPD)", "Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados e revogar consentimentos pelo e-mail privacidade@nuvio.com.br. Contatos atendidos pelas empresas devem falar primeiro com a empresa que os atendeu."],
  ["Retenção", "Conversas ficam disponíveis enquanto a assinatura estiver ativa e são excluídas até 90 dias após o cancelamento, salvo obrigação legal."],
];

const TERMS = [
  ["O serviço", "A Nuvio fornece um assistente virtual para WhatsApp, painel de conversas, base de conhecimento, integrações e relatórios, conforme o plano contratado."],
  ["Teste grátis e assinatura", "Todo plano começa com um período de teste. Depois, a assinatura é mensal, renovada automaticamente e pode ser cancelada a qualquer momento pelo painel."],
  ["Uso adequado", "É proibido usar a plataforma para spam, mensagens sem consentimento, conteúdo ilegal ou que viole as políticas do WhatsApp. Contas nessas situações podem ser suspensas."],
  ["Respostas da IA", "O assistente responde com base no conteúdo cadastrado pela empresa. A empresa é responsável por manter as informações corretas e por revisar as conversas transferidas para a equipe."],
  ["Limites do plano", "Cada plano tem limite de conversas por mês, números de WhatsApp e conteúdos. Ao se aproximar do limite, avisamos e sugerimos a mudança de plano."],
  ["Disponibilidade", "Trabalhamos para manter o serviço disponível 24 horas, mas dependemos também da disponibilidade da Meta (WhatsApp) e dos provedores de IA."],
];

/** Páginas legais (texto-base de demonstração; revisar com um advogado antes do uso comercial). */
export function LegalPage({ kind }: { kind: "privacidade" | "termos" }) {
  const sections = kind === "privacidade" ? PRIVACY : TERMS;
  return (
    <div className="legal-page">
      <header className="marketing-header">
        <div className="container header-inner">
          <Logo />
          <Link className="button button--ghost" href="/">
            Voltar ao site
          </Link>
        </div>
      </header>
      <main className="container legal-content">
        <span className="eyebrow eyebrow--plain">{kind === "privacidade" ? "LGPD" : "Contrato"}</span>
        <h1>{kind === "privacidade" ? "Política de Privacidade" : "Termos de Uso"}</h1>
        <p className="legal-note">Texto-base da demonstração — revisar com assessoria jurídica antes do uso comercial.</p>
        {sections.map(([title, text]) => (
          <section key={title} id={title.includes("LGPD") ? "lgpd" : undefined}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
