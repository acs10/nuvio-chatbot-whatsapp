# Documentação de engenharia — Nuvio

| # | Documento | Conteúdo |
| --- | --- | --- |
| 1 | [Visão geral](01-visao-geral.md) | Produto, perfis, tecnologias, situação |
| 2 | [WhatsApp e IA](02-whatsapp-e-ia.md) | Fluxo da mensagem, regras, IA (Claude), formas de conexão, **passo a passo para ativar com a Meta**, variáveis |
| 3 | [Arquitetura e segurança](03-arquitetura-e-seguranca.md) | Camadas, ameaças e proteções, limites e evolução |
| 4 | [Modelo de dados](04-modelo-de-dados.md) | Entidades, coleções do Firestore, transação e diff, cota gratuita |
| 5 | [Publicação e operação](05-publicacao-e-operacao.md) | Netlify, `npm run env:push`, `npm run deploy`, ativar o WhatsApp real, operação |

Os testes estão em [`../Testes`](../Testes/README.md). Visão geral do produto e das telas: [`../README.md`](../README.md).

> **Situação (10/10/2026):** pronto para publicar. Ainda não hospedado (aguardando espaço na conta Netlify). Endereço previsto: `https://nuvio.netlify.app`.

## Como visualizar os diagramas

- **Mais fácil:** abra o arquivo [`visualizar.html`](visualizar.html) no navegador. Precisa de internet para carregar o desenhador.
- No site publicado, a mesma página fica no **link secreto** `/documents/<código>` (veja [Publicação e operação](05-publicacao-e-operacao.md)).
- No **GitHub**, os diagramas aparecem automaticamente.

Para atualizar o `visualizar.html` e a página do site depois de editar algum `.md`, rode `npm run docs`.
