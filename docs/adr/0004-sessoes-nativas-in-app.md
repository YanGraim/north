# ADR 0004 — Sessões nativas in-app

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

O North precisa conectar a hosts via SSH, RDP, VNC, SFTP, FTP, Telnet e Serial. A visão inicial contemplava lançar clientes do sistema operacional. Isso fragmenta a UX (“sair do app para trabalhar”), dificulta abas unificadas, histórico rico e extensibilidade por plugins, e amarra o produto a binários externos por plataforma.

Queremos que **a experiência aconteça dentro do North**, alinhada a Termius / electerm / VS Code Remote, sem abrir mão do modelo de segurança Electron (renderer sem Node).

## Decisão

1. **Sessões in-app como caminho oficial**  
   Launcher de cliente externo, se existir, é fallback transitório — não o objetivo do produto.

2. **Três tipos de sessão na UI** — `Terminal`, `Desktop`, `FileTransfer`. A UI nunca acopla a um protocolo concreto.

3. **`ProtocolManager` + registry de drivers no main**  
   Cada protocolo é um `ProtocolDriver`. Base para plugins futuros.

4. **Stack de protocolos (2026)**  
   - SSH / SFTP: `ssh2`  
   - Telnet: negociação própria  
   - Serial: `serialport`  
   - FTP: `basic-ftp`  
   - Terminal UI: `@xterm/xterm`  
   - VNC: `@novnc/novnc` + ponte TCP no main  
   - RDP: IronRDP (WASM) + ponte TCP/TLS no main  

5. **Transporte** — IPC tipado = plano de controle; `MessagePort` por sessão = plano de dados.

6. **Vault com `safeStorage`** na Parte 4 (não `keytar`).

## Alternativas consideradas

| Alternativa                    | Motivo do descarte                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Launcher de clientes do SO     | UX fragmentada; sem abas/streaming unificado; dependência de apps instalados       |
| Apache Guacamole               | Servidor/proxy pesado; overkill para app desktop local-first                       |
| FreeRDP bindings nativos       | Complexidade de build/sandbox no Electron; superfície nativa maior                 |
| Stack RDP/VNC só em TypeScript | Imaturidade / custo de protocol correctness vs IronRDP e noVNC                     |
| `keytar` para credenciais      | Biblioteca deprecada; `safeStorage` cobre o caso local-first                       |

## Consequências

- Roadmap reorganizado em 10 partes: vault na 4; núcleo SSH/xterm na 6; arquivos/Telnet/Serial na 7; RDP/VNC na 8.
- Docs e rules deixam de tratar “spawn de cliente externo” como arquitetura alvo.
- Main ganha responsabilidade de sockets, TLS, host keys e pontes; renderer ganha clientes WASM/JS de view.
- Extensibilidade futura = registrar driver, não forkar a UI.
- Detalhamento técnico em [08-protocolos.md](../08-protocolos.md).
