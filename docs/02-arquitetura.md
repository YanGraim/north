# Arquitetura

## Visão geral

North é um aplicativo **Electron** com três processos isolados e um pacote **shared** de tipos/contratos. A UI (renderer) nunca acessa Node, banco ou APIs de SO diretamente — tudo passa por IPC tipado.

```
Renderer (React)  →  Preload (contextBridge)  →  Main (handlers + serviços)
                           ↑
                    shared/ipc (contrato)
```

## Clean Architecture no Electron

| Camada              | Onde vive                                            | Responsabilidade                      |
| ------------------- | ---------------------------------------------------- | ------------------------------------- |
| Apresentação        | `src/renderer`                                       | UI, estado de tela, queries via hooks |
| Adapters / IPC      | `src/preload`, `src/main/ipc`                        | Traduz contrato tipado ↔ Electron     |
| Aplicação / Domínio | `src/main/services`                                  | Casos de uso, regras de negócio       |
| Infraestrutura      | `src/main/repositories`, keychain, spawn de clientes | Persistência e I/O                    |

**Regra de dependência:** renderer → shared; preload → shared; main → shared. Renderer **não** importa main. Shared **não** importa Electron.

## Processos

### Main (`src/main`)

- Ciclo de vida da janela e do app
- Handlers IPC registrados a partir do contrato
- Repositórios SQLite (Parte 2) e serviços
- Lançamento de protocolos remotos (Parte 7)

### Preload (`src/preload`)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Expõe apenas `window.north` (API tipada) via `contextBridge`
- O renderer não vê `ipcRenderer` nem módulos Node

### Renderer (`src/renderer`)

- React + features (`features/*`)
- Zustand (UI local) + TanStack Query (dados via IPC)
- shadcn/ui + Tailwind (tokens do design system)

### Shared (`src/shared`)

- Contrato IPC (`shared/ipc`)
- Tipos de domínio compartilhados
- Abstração `RemoteProtocol` (Parte 7)

## Fluxo IPC

1. Canal e tipos definidos em `src/shared/ipc`
2. Main registra `ipcMain.handle(canal, …)`
3. Preload mapeia método da API → `ipcRenderer.invoke`
4. Renderer consome via hook (`useAppVersion`, etc.)

## Estrutura de pastas

```
src/
  main/
    index.ts              # Janela + bootstrap
    ipc/handlers.ts       # Registro de handlers
    repositories/         # Persistência (Parte 2)
    services/             # Casos de uso
  preload/
    index.ts              # contextBridge → window.north
    index.d.ts            # Tipagem global Window
  renderer/
    src/
      components/ui/      # shadcn
      components/layout/  # Shell
      features/           # Features por domínio
      hooks/              # Hooks IPC / UI
      lib/                # Utils (cn, etc.)
      stores/             # Zustand
  shared/
    ipc/                  # Contrato tipado
    protocols/            # RemoteProtocol (Parte 7)
```

## Janela

- `titleBarStyle: 'hiddenInset'` (traffic lights no macOS)
- Fundo `#0a0e17`, layout de três painéis (sidebar / lista / detalhes)
