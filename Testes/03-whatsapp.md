# 3. WhatsApp

## Com o simulador da Meta — ✅ 10/10

**Como funciona o teste:** `tests/e2e/whatsapp.mjs` sobe um servidor que **imita a Graph API**:
- mesmos endereços (`/v23.0/{phone_number_id}`, `/messages`);
- mesmas respostas;
- mesmos códigos de erro (190, 100, 131047).

O próprio script faz o papel da Meta, enviando **webhooks assinados**.

Saída: [resultados/whatsapp-simulado.txt](resultados/whatsapp-simulado.txt)

| ID | Verificação | Resultado |
| --- | --- | --- |
| WA-01 | Verificação do webhook (`hub.challenge`): token errado 403, certo devolve o challenge | ✅ |
| WA-02 | Conexão manual: token validado na "Meta", guardado cifrado, nunca volta ao navegador | ✅ |
| WA-03 | Webhook sem assinatura ou com assinatura errada → 401, nada gravado | ✅ |
| WA-04 | Mensagem nova → conversa criada → IA responde pela base → enviada pela API (wamid) | ✅ |
| WA-05 | Notificação repetida não duplica | ✅ |
| WA-06 | Status enviado → entregue → lida (fora de ordem é ignorado) | ✅ |
| WA-07 | Pedido de atendente → transferência; equipe responde pela API | ✅ |
| WA-08 | Erro 131047 (fora das 24 h) aparece na mensagem e no painel | ✅ |
| WA-09 | Áudio vira aviso para a equipe; número de outra conta é ignorado | ✅ |
| WA-10 | Desconectar apaga o token; nada mais é enviado | ✅ |

## ⏳ Com a Meta real — pendente

**Não realizado ainda:** depende de criar o app na Meta (gratuito) e configurar as variáveis.

**É viável:**
- A Meta oferece um número de teste gratuito, que envia mensagens para até 5 celulares cadastrados, sem contrato nem verificação da empresa.
- O código é o mesmo testado com o simulador. Muda só o endereço da API (`META_GRAPH_BASE` vazio).

**Roteiro:**
- Passo a passo de configuração: [Documents/02 · 2.4](../Documents/02-whatsapp-e-ia.md#24-como-ativar-com-a-meta-passo-a-passo).
- Publicação: [Documents/05](../Documents/05-publicacao-e-operacao.md#ativar-o-whatsapp-real).

| ID | O que testar | Resultado esperado |
| --- | --- | --- |
| META-01 | Salvar a URL do webhook no painel da Meta | A Meta confirma a verificação |
| META-02 | Conexão manual com o número de teste | Painel mostra "API oficial · conexão manual" |
| META-03 | Mandar "Quanto custa?" de um celular cadastrado | Resposta da IA chega no celular; painel mostra ✓ → ✓✓ → ✓✓ azul |
| META-04 | Mandar "quero falar com um atendente" e responder pelo painel | Mensagem da equipe chega no celular |
| META-05 | Mandar áudio/imagem | Painel mostra o aviso; IA não responde |
| META-06 | Responder depois de 24 h | Painel bloqueia e explica a regra |
| META-07 | Token temporário expirado (24 h) | Painel mostra "Token expirado…" (erro 190) |
| META-08 | Com `ANTHROPIC_API_KEY`: respostas da IA | Texto natural, fontes da base |

**Riscos a observar no teste real:**
- formato do número brasileiro (o WhatsApp às vezes informa o celular sem o 9º dígito);
- atraso dos webhooks de status;
- limites de envio do número de teste.
