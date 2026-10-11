# 2. Testes ponta a ponta

**Ferramenta:** Puppeteer + Google Chrome (sem janela) · **Resultado:** ✅ 9/9 fluxos · ✅ 34/34 páginas (+ página Integrações com as chaves da Meta configuradas)

Saídas: [resultados/fluxos.txt](resultados/fluxos.txt) · [resultados/paginas.txt](resultados/paginas.txt)

## Fluxos completos (`tests/e2e/flows.mjs`)

O robô usa o site como uma pessoa. Um erro de JavaScript em qualquer página reprova o teste.

| # | Fluxo | O que comprova | Resultado |
| --- | --- | --- | --- |
| F-01 | Cadastro em 4 etapas | Empresa "Padaria Pão Quente" criada no servidor, plano Essencial, teste grátis, aviso para conectar o WhatsApp | ✅ |
| F-02 | Base de conhecimento | Pergunta e texto adicionados e ativos | ✅ |
| F-03 | Testar o assistente | Responde pela base (FAQ e texto) e transfere quando pedem atendente (pelo servidor: mesma IA do WhatsApp) | ✅ |
| F-04 | Configurar o assistente | Mensagem curta recusada; nova saudação salva | ✅ |
| F-05 | Conversa | IA responde → equipe assume, responde → encerra | ✅ |
| F-06 | Integrações | Conecta o WhatsApp (modo demonstração) em 2 etapas | ✅ |
| F-07 | Cobrança | Cadastra cartão, ativa a assinatura e muda para o Profissional | ✅ |
| F-08 | Backoffice | Encontra o novo cliente e suspende; cliente suspenso não entra | ✅ |
| F-09 | Site | "Ver demonstração" abre o painel da Clínica Lumina | ✅ |

## Todas as páginas (`tests/e2e/smoke.mjs`)

Abre cada página como visitante, cliente e backoffice e registra qualquer erro do navegador.

| Rodada | Resultado |
| --- | --- |
| Computador (1366×900) | ✅ 17/17 |
| Celular (375×812) | ✅ 17/17 |
| Computador, **com as chaves da Meta configuradas** | ✅ 17/17, depois da correção do incidente I-08 ([06-incidentes](06-incidentes.md)) |
