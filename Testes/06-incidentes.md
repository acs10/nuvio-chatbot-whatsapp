# 6. Incidentes

Problemas encontrados pelos testes durante o desenvolvimento e como foram resolvidos.

| # | Encontrado por | Problema | Causa | Solução |
| --- | --- | --- | --- | --- |
| I-01 | Fluxos | A tela travava ao ligar a ponte com o servidor | O `Proxy` sobre a store do MobX violava uma regra do JavaScript (métodos travados pelo MobX) | O alvo do `Proxy` passou a ser um objeto vazio com o protótipo da store |
| I-02 | Fluxos | Erro ao abrir uma conversa | `scrollIntoView` devolvia uma Promise dentro do `useEffect` (função de limpeza inválida) | Chaves no corpo da função |
| I-03 | Unitários | O uso do dia não aumentava em algumas conversas | Cópia de um objeto do MobX na função `bump` | Buscar o objeto de novo depois de incluir |
| I-04 | Unitários | O robô não entendia "multa" ou "faltar" | Sinônimos ausentes | Sinônimos incluídos no motor local |
| I-05 | Fluxos | "Simular mensagem" mostrava erro mesmo funcionando | A ação devolve o id (texto), e a ponte tratava todo texto como mensagem de erro | Resultado da ação embrulhado e conferido pelo tipo |
| I-06 | API | Desconectar o WhatsApp falhava pelo servidor | Número de argumentos diferente entre a tela e o comando | Assinatura alinhada nos dois lados |
| I-07 | Unitários | Teste instável | O teste escolhia uma conversa já resolvida | O teste escolhe uma conversa aberta |
| I-08 | Páginas, com as chaves da Meta (10/10/2026) | Erro de hydration na página **Integrações** quando o WhatsApp real está habilitado (cenário de produção) | O endereço do webhook usava `window.location.origin` durante a renderização: vazio no servidor, preenchido no navegador | O endereço é preenchido depois de a página montar (`useEffect`). Página aprovada de novo |
