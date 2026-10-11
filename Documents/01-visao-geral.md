# 1. Visão geral

## 1.1 O produto

A **Nuvio** é um SaaS: empresas assinam um plano e ganham um **assistente virtual no WhatsApp**, treinado com o conhecimento delas. A IA atende 24 horas. A equipe acompanha as conversas pelo painel, assume quando precisa e devolve para a IA.

| Perfil | O que faz |
| --- | --- |
| **Visitante** | Conhece o produto e os planos; cria a conta (14 dias grátis) |
| **Cliente (empresa)** | Configura o assistente, cadastra a base de conhecimento, conecta o WhatsApp, acompanha e assume conversas, gerencia plano e faturas |
| **Backoffice Nuvio** | Acompanha MRR, clientes, assinaturas, operação (volume, conexões, alertas, integrações do servidor) e define preços e limites dos planos |
| **Cliente final** | Conversa pelo WhatsApp (não acessa a Nuvio) |

## 1.2 Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | Next.js 16 · React 19 · TypeScript · MobX · CSS do design (Figma Make) + complementos |
| Servidor | Rotas de API do Next.js |
| Banco | **Firebase Firestore** (`nuvio-97b72`, São Paulo, plano gratuito), só pelo servidor |
| WhatsApp | **WhatsApp Cloud API** (Meta): webhook assinado, envio, status, cadastro incorporado |
| IA | **Claude** (Anthropic), com saída estruturada; motor local como reserva |
| Testes | Vitest · Puppeteer · simulador local da Graph API |

## 1.3 Situação (10/10/2026)

| Item | Situação |
| --- | --- |
| Interface (site, cadastro, painel, backoffice) | ✅ |
| Servidor, login (scrypt + cookie assinado), dados por empresa, Firestore | ✅ testado no Firestore real |
| WhatsApp Cloud API (receber, responder, enviar, status, 24 h, erros) | ✅ pronto · testado com **simulador da Meta** · ⏳ teste com a Meta real pendente (ver [Testes/03](../Testes/03-whatsapp.md)) |
| IA (Claude) | ✅ pronta · ativa ao configurar `ANTHROPIC_API_KEY` (sem chave: motor local) |
| Pagamento das assinaturas | Demonstração (cartão e "pagar" simulados) |
| Documentação e testes | ✅ esta pasta e [`../Testes`](../Testes/README.md) |
| Publicação | ⏳ pronta (`npm run env:push` + `npm run deploy`), aguardando espaço no Netlify |

## 1.4 Acesso de demonstração

Senha `demo123`:
- `mariana@lumina.com.br` (Clínica Lumina);
- `admin@nuvio.com.br` (backoffice).

No site, o botão "Ver demonstração" entra direto.
