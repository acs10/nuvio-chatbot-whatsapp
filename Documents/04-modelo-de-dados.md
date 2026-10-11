# 4. Modelo de dados

## Entidades

```mermaid
erDiagram
    PLAN ||--o{ WORKSPACE : "assinado por"
    WORKSPACE ||--o{ USER : "equipe"
    WORKSPACE ||--o{ KNOWLEDGE : "base"
    WORKSPACE ||--o{ CONVERSATION : "atende"
    WORKSPACE ||--o{ INVOICE : "cobrado em"
    WORKSPACE ||--o| PRIVATE_TOKEN : "token cifrado"
    CONVERSATION ||--|{ MESSAGE : "contém"
    PLAN {
        string id "essencial profissional escala"
        number price
        number conversations "limite por mês"
        number knowledgeLimit
    }
    WORKSPACE {
        string id
        string name
        string planId
        string status "trial active past_due suspended cancelled"
        object whatsapp "status telefone modo phoneNumberId"
        object assistant "nome tom saudação horário regras"
        object integrations
        array daily "uso por dia"
    }
    USER {
        string id
        string email
        string role "client ou admin"
        string passwordHash "scrypt"
    }
    KNOWLEDGE {
        string id
        string kind "faq text document site"
        string title
        string content
        boolean active
    }
    CONVERSATION {
        string id
        string phone
        string status "IA atendimento aguardando resolvida"
        string topic
        boolean demo "simulada"
    }
    MESSAGE {
        string id
        string from "cliente IA equipe sistema"
        string text
        string externalId "wamid da Meta"
        string status "pending sent delivered read failed simulated"
    }
    INVOICE {
        string id
        number amount
        string status
    }
    PRIVATE_TOKEN {
        string workspaceId
        string token "AES-256-GCM"
    }
```

## Coleções do Firestore

| Coleção | Conteúdo | Quem lê |
| --- | --- | --- |
| `plans` | Planos e preços | Todos |
| `workspaces` | Empresas: plano, situação, WhatsApp, assistente, uso diário | A própria empresa; o backoffice (sem conversas) |
| `users` | Pessoas com acesso (hash scrypt da senha) | Só o servidor (o hash nunca é enviado) |
| `knowledge` | Base de conhecimento de cada empresa | A própria empresa |
| `conversations` | Conversas com as mensagens | A própria empresa |
| `invoices` | Faturas das assinaturas | A empresa e o backoffice |
| `meta` | Documento `state`: configurações, histórico de receita e **versão** dos dados | Só o servidor |
| `private` | Tokens do WhatsApp de cada empresa, **cifrados** (AES-256-GCM com `VAULT_KEY`) | Só o servidor |

## Como uma alteração é gravada

```mermaid
sequenceDiagram
    participant T as Tela
    participant S as Servidor
    participant F as Firestore
    T->>S: POST /api/command (ação, argumentos, ids)
    S->>F: transação: lê meta/state (versão) e os dados
    S->>S: executa a MESMA regra da tela, com o perfil da sessão
    S->>S: compara antes × depois (diff)
    S->>F: grava só os documentos que mudaram + versão + 1
    S-->>T: estado oficial (visão do perfil)
```

- **Transação:** se duas pessoas alteram ao mesmo tempo, o Firestore refaz a transação com os dados novos.
- **Diff:** só os documentos alterados são gravados. Isso economiza a cota gratuita (plano Spark: 20 mil gravações por dia).
- **No computador:** com `DATA_STORE=file`, os mesmos dados ficam em `.data/nuvio.json`, com as mesmas regras. É assim que os testes rodam sem gastar a cota.

## Criar ou restaurar os dados

```bash
npm run db:setup
```

O comando cria `SESSION_SECRET` e `VAULT_KEY` no `.env.local`, se ainda não existirem, e grava a demonstração no Firestore: empresas de exemplo, a Clínica Lumina com conversas e o backoffice.

> Rode o comando só quando precisar restaurar os dados: cada execução consome gravações da cota gratuita.
