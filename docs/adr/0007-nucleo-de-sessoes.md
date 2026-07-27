# ADR 0007 — Núcleo de sessões (SSH in-app)

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

A Parte 6 precisa abrir sessões remotas dentro do North sem clientes externos. O transporte de bytes contínuos não pode passar por `invoke` genérico; credenciais devem permanecer no main; a UI precisa de abas keep-alive (sem desmontar xterm ao trocar).

## Decisão

1. **Contratos em `src/shared/protocols`** — `SessionKind`, `SessionState`, `SessionDescriptor`, mensagens do MessagePort (`data` / `resize` / `state` / `error`), interfaces `ProtocolDriver` / `ProtocolSession`.

2. **`ProtocolManager` no main** — registry de drivers, mapa de sessões ativas, resolução de `credentialRef` via vault, gravação automática de histórico ao encerrar (sucesso/erro + duração). IPC de controle: `sessions:open|close|list|respond-host-key` + eventos `sessions:state-changed` / `sessions:host-key-prompt` / `sessions:port`.

3. **Um `MessageChannelMain` por sessão** — `port2` transferido ao renderer via `webContents.postMessage`; preload devolve `{ session, port }` em `north.sessions.open`. Bytes nunca via invoke.

4. **Driver SSH com `ssh2`** — auth senha (vault), chave (+ passphrase no vault) e agente (`SSH_AUTH_SOCK`); shell PTY; host key checking com tabela `known_hosts` (migration 003). Primeira conexão pede confiança; mismatch bloqueia com diálogo destacado.

5. **Abas keep-alive no renderer** — aba fixa `Workspace` + abas de sessão; views usam `display:none` (não desmontam); `TerminalView` com `@xterm/xterm` + fit/webgl e tema dos tokens do design system.

## Alternativas consideradas

| Alternativa | Motivo do descarte |
| --- | --- |
| Streaming via `ipcRenderer.send` | Sem backpressure; mistura plano de controle e dados |
| Spawn do `ssh` CLI | Menos controle de canais/SFTP futuro; UX frágil |
| Remontar xterm a cada troca de aba | Perde scrollback local e causa tela em branco |

## Consequências

- Extensão futura = registrar driver (`telnet`, `rdp`, …) sem mudar a UI de abas.
- Histórico deixa de depender do renderer chamar `history:record` ao conectar.
- Docs de arquitetura e modelo de dados passam a incluir `known_hosts`.
