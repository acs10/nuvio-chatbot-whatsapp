# 5. Produção (roteiro)

**Situação:** ⏳ aguardando a publicação no Netlify. O roteiro abaixo está pronto para rodar logo depois de `npm run env:push` e `npm run deploy` ([Documents/05](../Documents/05-publicacao-e-operacao.md)).

| # | Verificação | Como | Esperado |
| --- | --- | --- | --- |
| P-01 | Site abre para qualquer pessoa | Abrir `https://nuvio.netlify.app` numa janela anônima | Página inicial (sem tela de login do Netlify) |
| P-02 | Firestore conectado | Painel do backoffice → "Status das integrações" | Banco: Firestore |
| P-03 | API e segurança | `npm run test:api -- https://nuvio.netlify.app` | 7/7 |
| P-04 | Todas as páginas | `npm run test:smoke -- https://nuvio.netlify.app` (e com `MOBILE=1`) | Sem erros |
| P-05 | Cabeçalhos | `curl -I https://nuvio.netlify.app` | CSP, `X-Frame-Options: DENY`, `nosniff` |
| P-06 | Documentação | Link `/documents/<código>` + `node tests/e2e/docs-check.mjs <link>` | Todos os diagramas desenhados; outro código → 404 |
| P-07 | Arquivos locais fora da função | Netlify → *Deploys → Functions* | Sem `firebase-service-account.json`, `.env*` nem `.data/` |
| P-08 | WhatsApp real | Roteiro META-01 a META-08 em [03-whatsapp.md](03-whatsapp.md) | — |

Ao executar, salve as saídas em `resultados/` (`producao-api.txt`, `producao-paginas.txt`) e atualize esta página e o [README](README.md).
