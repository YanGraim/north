# Protocolos e sessões nativas

Documento de arquitetura da camada de sessões in-app. Implementação começa na Parte 6 do [roadmap](./07-roadmap.md). Decisão formal: [ADR 0004](./adr/0004-sessoes-nativas-in-app.md).

## Quatro tipos de sessão

A UI conhece **apenas** o tipo. O protocolo concreto fica no driver.

| Tipo            | Exemplos de protocolo                          | View no renderer              |
| --------------- | ---------------------------------------------- | ----------------------------- |
| `Terminal`      | SSH, Telnet, Serial                            | `@xterm/xterm`                |
| `Desktop`       | RDP, VNC                                       | IronRDP WASM / `@novnc/novnc` |
| `FileTransfer`  | SFTP, FTP                                      | File browser próprio          |
| `Database`      | PostgreSQL, MySQL/MariaDB, SQL Server, SQLite  | Estúdio SQL (Access)          |

## Onde roda o plano de dados

| Protocolo | Main (driver / I/O)                         | Renderer (view / decode)      |
| --------- | ------------------------------------------- | ----------------------------- |
| SSH       | `ssh2` (shell/channel)                      | xterm (PTY bytes)             |
| Telnet    | Negociação Telnet própria + socket TCP      | xterm                         |
| Serial    | `serialport`                                | xterm                         |
| SFTP      | Subsistema SFTP do `ssh2`                   | File browser                  |
| FTP       | `basic-ftp`                                 | File browser                  |
| VNC       | Ponte TCP (proxy de socket)                 | `@novnc/novnc`                |
| RDP       | Ponte TCP/TLS                               | IronRDP WASM                  |
| SQL       | `pg` / `mysql2` / `tedious` / `better-sqlite3` no main | Estúdio SQL (Access) |

Regra: sockets, TLS, credenciais e arquivos locais ficam no **main**. O renderer só renderiza e envia input do usuário.

## Interfaces (contratos em `shared/protocols`)

Esboço conceitual — nomes finais alinhados ao TypeScript na Parte 6.

```ts
type SessionKind = 'terminal' | 'desktop' | 'file-transfer' | 'database'
type SessionState = 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'

interface ProtocolSession {
  readonly id: string
  readonly kind: SessionKind
  readonly protocol: string // 'ssh' | 'rdp' | …
  readonly state: SessionState
  dispose(): Promise<void>
}

interface TerminalCapabilities {
  write(data: Uint8Array): void
  resize(cols: number, rows: number): void
  // output chega via MessagePort
}

interface DesktopCapabilities {
  sendInput(event: DesktopInputEvent): void
  setClipboard?(text: string): void
}

interface FileTransferCapabilities {
  list(path: string): Promise<RemoteEntry[]>
  download(remote: string, localHint?: string): Promise<TransferHandle>
  upload(local: string, remote: string): Promise<TransferHandle>
  mkdir?(path: string): Promise<void>
  remove?(path: string): Promise<void>
}

interface ProtocolDriver {
  readonly id: string
  readonly protocols: string[]
  readonly kind: SessionKind
  connect(opts: ConnectOptions, ports: SessionPorts): Promise<ProtocolSession>
}

interface ProtocolManager {
  register(driver: ProtocolDriver): void
  open(connectionId: string): Promise<{ sessionId: string; port: MessagePort }>
  close(sessionId: string): Promise<void>
  get(sessionId: string): ProtocolSession | undefined
  list(): ProtocolSession[]
}
```

Eventos de sessão (plano de controle) — canais definitivos:

- `sessions:open` / `sessions:close` / `sessions:list`
- `sessions:open-access` — sessão SQL a partir de Access (sem MessagePort; [ADR 0015](./adr/0015-estudio-sql.md))
- `sessions:state-changed` / `sessions:host-key-prompt` / `sessions:respond-host-key`
- Entrega do port: `sessions:port` via `postMessage` (transfer)
- File-transfer: `fs:list|mkdir|rename|delete|download|upload` + evento `fs:progress` ([ADR 0008](./adr/0008-file-transfer-ipc.md))
- SQL studio: `db:test|introspect|query|cancel|pick-file`
- Serial: `serial:list-ports`

O plano de dados **não** usa esses canais para bytes contínuos.

## Transporte

```
1. Renderer: north.sessions.open(connectionId)
2. Main: resolve conexão + credentialRef → driver.connect()
3. Main ↔ Preload: transfere MessagePort dedicado
4. Renderer: view associa port.onmessage ↔ xterm / noVNC / IronRDP
5. Encerrar: dispose no main + port.close() no renderer
```

- **Um `MessagePort` por sessão** — isolamento e backpressure natural.
- **IPC tipado** — só controle (abrir, fechar, resize, listar arquivos, trust host key).
- **Ponte TCP/TLS** — para VNC e RDP: main aceita/conecta o socket remoto e encaminha frames opacos ao cliente WASM/JS no renderer (padrão electerm / noVNC websocket-proxy, aqui via MessagePort).

## Stack de bibliotecas (2026)

| Protocolo     | Escolha                         | Alternativas descartadas                         | Por quê |
| ------------- | ------------------------------- | ------------------------------------------------ | ------- |
| SSH           | `ssh2`                          | spawn `ssh` CLI; `node-ssh`                      | Controle fino de canais/SFTP; padrão electerm/Termius-like |
| Terminal UI   | `@xterm/xterm`                  | hterm, custom canvas                             | Ecossistema VS Code; addons maduros |
| Telnet        | Negociação própria + TCP        | libs abandonadas                                 | Spec pequena; evitar dependência morta |
| Serial        | `serialport`                    | bindings ad-hoc                                  | Padrão Node multiplataforma |
| SFTP          | subsistema `ssh2`               | cliente SFTP separado                            | Mesma sessão SSH; menos deps |
| FTP           | `basic-ftp`                     | `ftp` legado, `jsftp`                            | API moderna, TypeScript-friendly |
| VNC           | `@novnc/novnc` v1.7 + ponte TCP | Guacamole só para VNC                            | Ativo; roda no renderer |
| RDP           | **IronRDP** WASM (Devolutions) + ponte | FreeRDP bindings nativos; Guacamole; stack TS própria | WASM seguro no renderer; referência `electerm/ironrdp-wasm`; FreeRDP complica sandbox Electron |
| SQL           | `pg` / `mysql2` / `tedious` / `better-sqlite3` | Cliente SQL no renderer; protocolo em `Connection` | Sockets e senha só no main; Access continua inventário |

Credenciais: **`safeStorage`** (ver [06-seguranca.md](./06-seguranca.md)). `keytar` descartado (deprecado).

## Preparação para plugins

- `ProtocolManager.register(driver)` — nada de `switch (protocol)` na UI.
- Manifesto futuro: `id`, `protocols[]`, `kind`, entrypoint do driver (main) + opcional view extra (renderer).
- MVP: drivers first-party registrados no bootstrap do main.
- Marketplace fica fora do MVP; só o **registry** precisa existir desde a Parte 6.

## Anti-padrões

- UI importando `ssh2` / `serialport` / sockets Node
- Credencial em claro no SQLite ou no resultado IPC
- Streaming de terminal via `invoke`/`send` genérico sem MessagePort
- Hardcode de protocol IDs em componentes de feature (usar `SessionKind`)
