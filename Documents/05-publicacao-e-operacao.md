# 5. Publicação e operação

## O que é preciso

| Item | Situação |
| --- | --- |
| Conta Netlify | A mesma dos outros projetos. Precisa de créditos/espaço disponível |
| Firebase | ✅ Projeto `nuvio-97b72` (plano gratuito Spark), já com a demonstração |
| Chave do Firebase | ✅ `firebase-service-account.json` na pasta (fora do Git; **nunca** publicar) |
| `SESSION_SECRET`, `VAULT_KEY` | ✅ No `.env.local` (criados pelo `npm run db:setup`) |
| Chaves da Meta e da Anthropic | Opcionais. Sem elas, o site funciona com WhatsApp **simulado** e o motor local de respostas |
| Node | 22 (fixado no `netlify.toml`) |

## Primeira publicação

Na pasta do projeto, em ordem:

1. Criar o site e ligar a pasta a ele (uma vez):

```bash
npx netlify-cli sites:create --name nuvio
```

2. Enviar as variáveis de produção, **sem mostrar os valores** na tela (uma vez, e de novo se alguma chave mudar):

```bash
npm run env:push
```

3. Publicar (agora e nas próximas vezes):

```bash
npm run deploy
```

**Sobre as variáveis (`scripts/push-env.mjs`):**

- O que ele lê:
  - do `.env.local`: `SESSION_SECRET`, `VAULT_KEY` e, se existirem, as chaves da Meta e da Anthropic;
  - do `firebase-service-account.json`: só os três campos necessários (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), que cabem no limite de 4 KB das funções.
- Como envia: grava tudo num arquivo temporário, importa no Netlify e apaga o arquivo. Na tela aparecem só os nomes.

**Sobre a publicação (`scripts/deploy.mjs`):**

1. Tira da pasta, durante o build, a chave do Firebase, os `.env*` e o `.data/`. Sem isso, o adaptador do Next copiaria esses arquivos para dentro da função.
2. Publica como rascunho e promove a versão para o endereço principal. Esse caminho funciona mesmo sem créditos para `deploy --prod`.
3. Devolve os arquivos para a pasta, mesmo se algo der errado.

**Depois de publicar:**

- **Acesso público:** se o site abrir pedindo login do Netlify, desligue a proteção de visitantes em *Site configuration → Access & security*.
- **Documentação:** fica em `https://nuvio.netlify.app/documents/<código>`. O código está em `src/modules/docs/docs-access.ts`.

## Ativar o WhatsApp real

Siga o passo a passo em [02 · WhatsApp e IA](02-whatsapp-e-ia.md#24-como-ativar-com-a-meta-passo-a-passo).

- **URL do webhook** a informar à Meta: `https://nuvio.netlify.app/api/webhooks/whatsapp`. Ela também aparece em *Painel → Integrações*.
- Depois de colocar as chaves da Meta no `.env.local`, rode `npm run env:push` e `npm run deploy`.
- Em seguida, execute o roteiro META-01 a META-08 em [Testes/03](../Testes/03-whatsapp.md).

## Conferir em produção

```bash
npm run test:api -- https://nuvio.netlify.app
```

```bash
npm run test:smoke -- https://nuvio.netlify.app
```

> Os fluxos completos (`test:flows`) criam uma empresa de teste no Firestore. Rode-os em produção só se for restaurar a demonstração depois (`npm run db:setup`).

## Operação

| Tarefa | Como |
| --- | --- |
| Restaurar a demonstração | `npm run db:setup` (consome cota do Firestore; evite repetir) |
| Atualizar a documentação | Edite os `.md` → `npm run docs` → `npm run deploy` |
| Trocar o link da documentação | Mude o código em `docs-access.ts` e publique |
| Ver erros | Netlify → *Logs → Functions* · Painel do backoffice → "Status das integrações" |
| Trocar uma chave | Edite o `.env.local` → `npm run env:push` → `npm run deploy` |
| Uso do Firestore | Console do Firebase → *Usage* (plano Spark: 50 mil leituras e 20 mil gravações por dia) |
