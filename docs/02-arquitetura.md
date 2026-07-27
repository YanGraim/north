# Arquitetura

## Visão geral

North é um aplicativo **Electron** com três processos isolados e um pacote **shared** de tipos/contratos. A UI (renderer) nunca acessa Node, banco ou APIs de SO diretamente — tudo passa por IPC tipado. Sessões remotas acontecem **in-app**: drivers no main, clientes de renderização no renderer, streaming por `MessagePort`.

```
Renderer (React + xterm / noVNC / IronRDP WASM)
        ↕ MessagePort (plano de dados por sessão)
        ↕ IPC tipado (plano de controle)
Preload (contextBridge → window.north)
        ↕
Main (handlers + ProtocolManager + drivers + vault)
        ↑
 shared/ipc + shared/protocols (contratos)
```

## Clean Architecture no Electron

| Camada              | Onde vive                                                         | Responsabilidade                         |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| Apresentação        | `src/renderer`                                                    | UI, abas de sessão, views por tipo       |
| Adapters / IPC      | `src/preload`, `src/main/ipc`                                     | Traduz contrato tipado ↔ Electron        |
| Aplicação / Domínio | `src/main/services`, `ProtocolManager`                            | Casos de uso, ciclo de vida de sessões   |
| Infraestrutura      | `src/main/repositories`, vault (`safeStorage`), drivers/protocolos | Persistência, I/O e sockets              |

**Regra de dependência:** renderer → shared; preload → shared; main → shared. Renderer **não** importa main. Shared **não** importa Electron.

## Camada de sessões

A UI conhece só o **tipo de sessão** (`Terminal` | `Desktop` | `FileTransfer`), nunca o protocolo. Detalhes em [08-protocolos.md](./08-protocolos.md).

| Peça              | Onde                         | Papel                                                                 |
| ----------------- | ---------------------------- | --------------------------------------------------------------------- |
| `ProtocolManager` | main                         | Registry de drivers; abre/fecha sessões; emite eventos de estado      |
| `ProtocolDriver`  | main                         | Implementação por protocolo (SSH, RDP bridge, VNC bridge, FTP, …)     |
| `ProtocolSession` | main (handle) + renderer (UI)| Sessão ativa com capacidades tipadas                                  |
| Plano de controle | IPC (`shared/ipc`)           | `sessions:open|close|list` + host key trust                           |
| Plano de dados    | `MessagePort` por sessão     | Bytes de terminal, framebuffer, progresso de transferência            |
| Clientes de view  | renderer                     | `@xterm/xterm`, `@novnc/novnc`, IronRDP WASM                          |
| Host keys (SSH)   | `known_hosts` + diálogo UI   | Trust-on-first-use; mismatch exige confirmação (ADR 0007)             |

```
┌──────────── renderer ────────────┐     ┌──────────── main ────────────┐
│  SessionTabs                     │     │  ProtocolManager             │
│    ├─ TerminalView (xterm)       │◄───►│    drivers: ssh, ftp, …      │
│    ├─ DesktopView (noVNC/IronRDP)│ MP  │    sessions Map              │
│    └─ FileBrowserView            │     │    TCP/TLS bridges           │
│  window.north.sessions.*  (IPC)  │◄───►│  ipc handlers                │
└──────────────────────────────────┘     │  CredentialVault             │
                                         └──────────────────────────────┘
```

## Processos

### Main (`src/main`)

- Ciclo de vida da janela e do app
- Handlers IPC registrados a partir do contrato
- Repositórios SQLite e serviços de inventário
- `ProtocolManager`, drivers e pontes TCP/TLS para clientes WASM
- Vault de credenciais (`safeStorage`)

### Preload (`src/preload`)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Expõe apenas `window.north` (API tipada) via `contextBridge`
- Encaminha `MessagePort` de sessão sem vazar `ipcRenderer` cru

### Renderer (`src/renderer`)

- React + features (`features/*`)
- Zustand (UI local) + TanStack Query (dados via IPC)
- Views de sessão por tipo (não por protocolo)
- shadcn/ui + Tailwind (tokens do design system)

### Shared (`src/shared`)

- Contrato IPC (`shared/ipc`)
- Tipos de domínio compartilhados
- Contratos de protocolo/sessão (`shared/protocols`) — capacidades e eventos, sem Electron

## Fluxo IPC

1. Canal e tipos definidos em `src/shared/ipc`
2. Main registra `ipcMain.handle(canal, …)`
3. Preload mapeia método da API → `ipcRenderer.invoke`
4. Renderer consome via hook (`useAppVersion`, etc.)
5. Sessões: IPC abre a sessão e entrega um `MessagePort`; o streaming não passa pelo invoke

## Estrutura de pastas

```
src/
  main/
    index.ts              # Janela + bootstrap
    ipc/handlers.ts       # Registro de handlers
    repositories/         # Persistência
    services/             # Casos de uso + ProtocolManager
    protocols/            # Drivers (ssh2, basic-ftp, bridges, …)
    vault/                # Credenciais via safeStorage
  preload/
    index.ts              # contextBridge → window.north
    index.d.ts            # Tipagem global Window
  renderer/
    src/
      components/ui/      # shadcn
      components/layout/  # Shell
      features/           # Features por domínio (+ sessions)
      hooks/              # Hooks IPC / UI
      lib/                # Utils (cn, etc.)
      stores/             # Zustand
  shared/
    ipc/                  # Contrato tipado (plano de controle)
    protocols/            # Tipos de sessão, capacidades, eventos
```

## Janela

- `titleBarStyle: 'hiddenInset'` (traffic lights no macOS)
- Fundo `#0a0e17`, layout de três painéis (sidebar / lista / detalhes)
- Abas de sessão ocupam a área de trabalho quando uma conexão está ativa
