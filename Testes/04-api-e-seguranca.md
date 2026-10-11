# 4. API e segurança

**Ferramenta:** `tests/e2e/api-security.mjs` (chamadas HTTP diretas, sem as telas) · **Resultado:** ✅ 7/7 · saída: [resultados/api-seguranca.txt](resultados/api-seguranca.txt)

```bash
npm run test:api -- http://localhost:3016
```

| ID | Verificação | Esperado | Resultado |
| --- | --- | --- | --- |
| API-01 | Visitante lê o estado | Só os 3 planos; nenhuma empresa, usuário, conversa ou fatura | ✅ |
| API-02 | Login | Senha errada → 401; cookie HttpOnly + SameSite=Lax | ✅ |
| API-03 | Cada empresa vê só os próprios dados | A Aurora não vê nada da Lumina; ninguém recebe hash de senha | ✅ |
| API-04 | Backoffice | Vê empresas e faturas, mas **nenhuma conversa** dos clientes finais | ✅ |
| API-05 | Ações em outra empresa ou fora do perfil | 8 tentativas recusadas (422); sem login 401; ação inexistente 400 | ✅ |
| API-06 | CSRF | Sem origem → 403; de outro site → 403 | ✅ |
| API-07 | Simulação e integrações | Simular mensagens só em conversas de demonstração; sem chaves da Meta, conexão real e webhook → 404 | ✅ |

As proteções de cada ameaça estão em [Documents/03 · 3.2](../Documents/03-arquitetura-e-seguranca.md#32-segurança). As do webhook (assinatura, repetição) são testadas em [03-whatsapp.md](03-whatsapp.md).
