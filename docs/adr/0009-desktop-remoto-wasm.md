# ADR 0009 — Desktop remoto (WASM) e exceção de credencial

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

VNC e RDP precisam de decode gráfico no renderer (noVNC / IronRDP WASM), enquanto sockets e TLS permanecem no main. Clientes WASM tipicamente esperam WebSocket + senha no processo de UI.

## Decisão

1. **Ponte TCP/TLS única** (`tcp-bridge.ts`) no main: pipe binário ↔ MessagePort (`type: 'data'`).
2. **VNC:** noVNC no renderer com shim WebSocket-like sobre MessagePort.
3. **RDP:** IronRDP WASM (`ironrdp-wasm`) + ponte TLS; certificado validado com o mesmo fluxo de host-key (`keyType: 'tls'`). Integração completa de RDCleanPath fica em beta se o pacote exigir proxy específico.
4. **Exceção de credencial (desktop):** o main entrega username/password **uma única vez** no handshake da sessão via MessagePort (`type: 'desktop-auth'`). Nunca via `window.north`, nunca persistido no renderer, limpo após consumo.
5. CSP do renderer inclui `'wasm-unsafe-eval'` apenas para carregar WASM.

## Consequências

- Documentar a exceção em `docs/06-seguranca.md`.
- UI continua switch por `SessionKind === 'desktop'`; escolha VNC/RDP só dentro de `DesktopView` via `protocol` da aba.
