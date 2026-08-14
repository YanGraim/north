# ADR 0015 — Estúdio SQL in-app

- **Status:** Aceito
- **Data:** 2026-08-14

## Contexto

Acessos de banco ([ADR 0012](./0012-accesses-tema-i18n.md)) guardam engine, host, porta, database e credencial no vault, mas **não** abrem sessão. Meter banco em `Connection` poluiria o `ProtocolManager` e sugeriria Conectar onde o protocolo não existe. O produto precisa de um estúdio SQL in-app (cadastro estilo DataGrip, sessão estilo Beekeeper) sem enviar senha ao renderer.

## Decisões

1. **Access continua inventário.** Login e `other` não abrem sessão. Banco com engine suportado ganha **Conectar**.
2. **Sessão `database`** — quarto `SessionKind`. `SessionDescriptor` tem `connectionId` **ou** `accessId`. Drivers SQL **não** entram em `ConnectionProtocol`.
3. **Engines v1:** `postgres`, `mysql`, `mariadb`, `mssql`, `sqlite`. Redis/Mongo/`other` ficam só inventário.
4. **Plano de dados** — sockets e clientes Node (`pg`, `mysql2`, `tedious`, `better-sqlite3`) só no main. IPC `db:test|introspect|query|cancel`. Credenciais resolvem no vault; o renderer nunca recebe a senha da sessão.
5. **Modal próprio** de conexão de banco (host, porta, usuário, senha, Testar, Salvar e conectar). Login permanece no form de Access.
6. **Limites:** timeout 30s, teto de 1000 linhas (`truncated`). SQL arbitrário do usuário (SELECT/DML) — é o produto.
7. **UI da sessão (Beekeeper):** clique na tabela abre aba de dados com barra de filtro (`WHERE` ou SQL curto); **+** abre aba de query com editor. Grid com ordenação e drag-and-drop de colunas no cliente.
8. **Histórico** — tabela irmã `access_history`; não reutilizar `connection_id` com UUID de Access.

## Alternativas

- Protocolo `postgres` em `Connection` — rejeitado (mistura inventário de segredo com drivers de sessão de servidor).
- Cliente SQL no renderer — rejeitado (Node/TCP/credenciais fora do main).

## Consequências

- IPC `sessions:open-access`, `db:*`.
- Manual + what's-new; túnel SSH via Connection fica para fase 2.
