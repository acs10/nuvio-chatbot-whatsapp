# 1. Testes unitários

**Ferramenta:** Vitest · **Arquivos:** `tests/unit/platform.test.ts`, `tests/unit/server.test.ts` · **Resultado:** ✅ 28/28 · saída: [resultados/unitarios-vitest.txt](resultados/unitarios-vitest.txt)

```bash
npm test
```

| # | Grupo | Caso | Resultado |
| --- | --- | --- | --- |
| 1 | UT-01 Entendimento das perguntas | Normaliza acentos, ignora palavras vazias e une sinônimos | ✅ |
| 2 | UT-01 | Classifica o assunto da conversa | ✅ |
| 3 | UT-01 | Encontra a resposta certa na base, inclusive dentro de textos longos | ✅ |
| 4 | UT-01 | Não usa conteúdo desativado ou ainda em leitura | ✅ |
| 5 | UT-02 Regras do assistente | Responde pela base com o tom escolhido e cita a fonte | ✅ |
| 6 | UT-02 | Cumprimenta pelo nome | ✅ |
| 7 | UT-02 | Transfere quando o cliente pede atendente, ou avisa o horário fora do expediente | ✅ |
| 8 | UT-02 | Depois de N respostas sem informação, transfere para a equipe | ✅ |
| 9 | UT-03 Conversas e atendimento humano | Conversa simulada: a IA responde, conta no uso do dia, a equipe assume, responde, devolve e encerra | ✅ |
| 10 | UT-03 | Pedido de atendente coloca a conversa em espera para a equipe | ✅ |
| 11 | UT-04 Base, integrações, cobrança, backoffice | Valida conteúdos e respeita o limite do plano | ✅ |
| 12 | UT-04 | Conecta o WhatsApp em duas etapas | ✅ |
| 13 | UT-04 | Fatura vencida deixa a conta com pagamento pendente; pagar regulariza | ✅ |
| 14 | UT-04 | Cadastro cria empresa em teste grátis; backoffice exige perfil admin | ✅ |
| 15 | UT-04 | Demonstração: a Lumina tem conversas montadas pelo próprio motor do robô | ✅ |
| 16 | UT-05 Webhook do WhatsApp | Lê texto, botões e mídia; ignora reações | ✅ |
| 17 | UT-05 | Lê status de entrega e erros | ✅ |
| 18 | UT-05 | Assinatura X-Hub-Signature-256 confere com o segredo do app | ✅ |
| 19 | UT-06 Conversas reais | Mensagem nova abre conversa; repetida é ignorada; mesma pessoa continua na mesma conversa | ✅ |
| 20 | UT-06 | Status de entrega só avança; falha registra o motivo | ✅ |
| 21 | UT-06 | Regra das 24 h e limite do plano | ✅ |
| 22 | UT-06 | No servidor, a resposta vem depois (sem resposta automática no navegador) | ✅ |
| 23 | UT-07 IA (Claude) | Instruções levam só a base ATIVA e as regras de segurança | ✅ |
| 24 | UT-07 | Histórico: começa pelo cliente, junta mensagens seguidas e ignora avisos do sistema | ✅ |
| 25 | UT-07 | Confere a resposta da IA: ação válida, texto e fontes que existem | ✅ |
| 26 | UT-08 Acesso e gravação no servidor | Cada perfil recebe só o que pode | ✅ |
| 27 | UT-08 | Recusa ações em outra empresa | ✅ |
| 28 | UT-08 | Grava só o que mudou; token cifrado não é legível | ✅ |
