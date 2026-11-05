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
| SSH       | `ssh2` (shell/channel). Com `startupDirectory`, o shell autenticado abre nessa pasta (`cd` citado após `stat` SFTP) e o SFTP da mesma conexão também; senão, fica no diretório de login | xterm (PTY bytes)             |
| Telnet    | Negociação Telnet própria + socket TCP      | xterm                         |
| Serial    | `serialport`                                | xterm                         |
| SFTP      | Subsistema SFTP do `ssh2`                   | File browser                  |
| FTP       | `basic-ftp`                                 | File browser                  |
| VNC       | Ponte TCP (proxy de socket)                 | `@novnc/novnc`                |
| RDP       | Ponte TCP/TLS                               | IronRDP WASM                  |
| SQL       | `pg` / `mysql2` / `tedious` / `better-sqlite3` no main | Estúdio SQL (Access) |

Regra: sockets, TLS, credenciais e arquivos locais ficam no **main**. O renderer só renderiza e envia input do usuário.

No terminal (SSH, Telnet, serial, shell local e workspace de agente), o botão do meio copia a seleção e, sem seleção, cola a área de transferência do sistema. Uma imagem cola o caminho do arquivo temporário. O botão direito continua o menu. O gesto fica no renderer e reusa copiar e colar já existentes ([REC-018](./recursos/rec-018-botao-meio-copia-cola-terminal/especificacao.md)). Em Configurações, **Botão direito copia ou cola** nasce desligado e troca esses papéis; ligado, o direito deixa de selecionar a palavra ([REC-019](./recursos/rec-019-inverter-botoes-meio-direito/especificacao.md)). A preferência fica na store `north-ui` deste computador.

No menu de contexto do terminal SSH, a seleção pode gravar o diretório inicial ou um arquivo de log da conexão ([REC-005](./recursos/rec-005-diretorio-log-selecao-terminal/especificacao.md)). Arquivo ou diretório sai de um `stat` SFTP no `Client` já autenticado (`sessions:classify-path`). O PTY só recebe o `cd` citado depois que o diretório é gravado. **Monitorar log** ([REC-008](./recursos/rec-008-monitorar-log-selecao/especificacao.md)) abre o mesmo `tail -F` pelo path selecionado, sem gravar `log_files` e sem entrar no teto de 8 quadros gravados.

No painel remoto de arquivos de uma conexão SSH, a pasta listada grava o mesmo diretório inicial, com confirmação se já houver outro ([REC-009](./recursos/rec-009-diretorio-e-monitoramento-sftp/especificacao.md)). Um arquivo do menu entra na lista de logs e abre o quadro, ou só abre o quadro pelo path, sem gravar `log_files` e sem entrar no teto de 8. FTP e o painel local não têm essas ações. O terminal já aberto não recebe `cd`.

No mesmo painel remoto, em SFTP e em FTP, **Editar** abre um arquivo de texto no editor do North e **Editar com…** abre um executável cadastrado ([REC-014](./recursos/rec-014-editar-arquivo-remoto/especificacao.md)). O main baixa para um temporário e, ao salvar, envia com sobrescrita. Pasta, byte nulo nos primeiros 8 KiB e arquivo acima de 8 MiB não abrem. Fechar a sessão apaga a cópia e não espera o editor. O espelho da pasta do terminal não edita. **Abrir** e o clique duplo continuam só baixando.

Nos painéis local e remoto, a barra mostra cada pasta do caminho ([REC-015](./recursos/rec-015-caminho-clicavel-painel-arquivos/especificacao.md)). Clicar num trecho anterior lista essa pasta. O trecho final abre o campo; Enter confirma e Esc volta. No painel da pasta do terminal, o trecho pede `cd` ([REC-017](./recursos/rec-017-acoes-sftp-painel-terminal/especificacao.md)).

No painel remoto de SFTP e de FTP, **Diretórios favoritos** guarda a pasta listada só naquela conexão ([REC-016](./recursos/rec-016-diretorios-favoritos-painel-arquivos/especificacao.md)). Um clique lista a pasta de novo. Se ela não existir, o painel permanece. A lista não entra no export, na duplicata nem na sincronização. O painel local e o espelho do terminal não têm o botão.

No terminal SSH de uma conexão salva, a badge **Arquivos** abre um painel à direita do xterm com a pasta do shell ([REC-010](./recursos/rec-010-arquivos-do-diretorio-atual/especificacao.md), [ADR 0020](./adr/0020-listagem-cwd-terminal-ssh.md), [REC-017](./recursos/rec-017-acoes-sftp-painel-terminal/especificacao.md), [ADR 0021](./adr/0021-cd-painel-pasta-terminal.md)). A pasta chega por OSC 7 do prompt desta sessão, em bash e zsh. O gancho é um trecho fixo do main, não é gravado no servidor e não entra em fish, dash nem ash. O eco dessa linha é descartado antes do xterm; a linha do `cd` pedido pelo painel aparece. A listagem e as alterações de arquivo são SFTP curto no mesmo `Client`, sem `fs:list` e sem `ls` no PTY. Entrar numa pasta, subir, ir para a pasta inicial ou clicar num trecho escreve `cd --` com o path citado, e só com o prompt livre. O texto nasce no main. A lista só muda no OSC 7 seguinte. Sem OSC 7, não lista o diretório de login. Baixar pede a pasta local num diálogo do main. **Editar** e os favoritos continuam no navegador de dois lados.

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
- File-transfer: `fs:list|mkdir|rename|delete|download|upload` + evento `fs:progress` ([ADR 0008](./adr/0008-file-transfer-ipc.md)). Edição no painel: `fs:edit-open|save|close` + eventos `fs:edit-uploaded|failed` ([REC-014](./recursos/rec-014-editar-arquivo-remoto/especificacao.md))
- `sessions:list-directory` — pasta corrente do terminal SSH no `Client` já autenticado ([ADR 0020](./adr/0020-listagem-cwd-terminal-ssh.md))
- `sessions:change-directory`, `sessions:cancel-directory-change`, `sessions:home`, `sessions:mkdir`, `sessions:rename`, `sessions:delete`, `sessions:download`, `sessions:upload` — navegação com `cd` e SFTP curto no mesmo `Client` ([ADR 0021](./adr/0021-cd-painel-pasta-terminal.md))
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
