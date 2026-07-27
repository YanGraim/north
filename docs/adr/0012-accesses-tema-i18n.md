# ADR 0012 — Accesses, tema claro/escuro e i18n

- **Status:** Aceito
- **Data:** 2026-07-25

## Contexto

A planilha de acessos mistura servidores (sessão remota) com credenciais de banco e logins de portal. Meter tudo em `Connection` poluiria o `ProtocolManager` e sugeriria um botão “Conectar” onde não cabe. Em paralelo, a UI era dark-only e sem idioma configurável; Settings já existia ([ADR 0011](./0011-settings-e-release.md)) mas sem aparência/idioma.

## Decisões

1. **Entidade `Access`** (`database` | `login` | `other`) sob o mesmo grupo da hierarquia Cliente → Ambiente → Grupo. Guarda metadados + `credentialRef`; **não** abre sessão. Migration `004-accesses` + `access_tags`.
2. **Lista unificada** — Conexões e Acessos na mesma view, com badge (`Servidor` | `Banco` | `Login`) e filtro rápido. Detalhes de Access: revelar/copiar senha, abrir URL, copiar connection string (banco). Sem “Conectar”.
3. **`vault:reveal-secret`** — único canal que devolve plaintext ao renderer; exige ownership (`Access` ou `Connection`). Busca e export continuam sem senha.
4. **Tema** — tokens `dark` (default) e `light`; `ui-store.theme`: `dark` | `light` | `system`; class em `documentElement`; xterm acompanha o tema resolvido.
5. **i18n** — `i18next` + `react-i18next`; locales `pt-BR` (default), `en`, `es`; persistência em `ui-store.locale`. Escopo inicial: shell, settings, títulos de formulários principais.
6. **Settings** — seções Aparência e Idioma acima de Inventário / Updates / Sobre.

## Alternativas

- Campos extras em `Connection` por “protocolo inventário” — rejeitado (mistura inventário de segredo com drivers).
- Tema só via CSS sem store — rejeitado (precisa persistir e sincronizar xterm).
- Tradução 100% numa tacada — fora de escopo; strings legadas migram iterativamente.

## Consequências

- IPC `accesses:*`, tags `set/list-for-access`, search kind `access`.
- Cascade delete de cliente/ambiente/grupo limpa vault de Access e Connection.
- ADR 0011 permanece a base da página Settings; este ADR estende preferências.
