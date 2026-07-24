# Roadmap

## Partes do MVP

| Parte | Entrega                                                                        |
| ----- | ------------------------------------------------------------------------------ |
| **1** | Docs, rules, scaffold electron-vite, tooling, UI shell dark-first, IPC tipado  |
| **2** | SQLite + migrations, repositórios no main, IPC de CRUD                         |
| **3** | Shell UI 3 painéis, navegação, design system aplicado                          |
| **4** | CRUD completo: Clientes, Ambientes, Grupos, Conexões, Tags, menus de contexto  |
| **5** | Command Palette (⌘/Ctrl+K) + busca fuzzy global                                |
| **6** | Dashboard, favoritos, recentes, histórico e estatísticas                       |
| **7** | `RemoteProtocol` + lançamento via clientes do SO + abas                        |
| **8** | Keychain, notas Markdown, import/export, duplicar, polimento, electron-builder |

## Longo prazo

- **Plugins** — protocolos e ações de terceiros
- **Cloud sync** (opt-in) — metadados criptografados; credenciais continuam locais
- **Protocolos nativos** — sessão embutida (terminal/RDP) além do launch externo
- **Multi-janela** e workspaces salvos
- **Audit log** exportável para compliance

## Fora de escopo do MVP

- Colaboração em tempo real
- Agente remoto instalado nos servidores
- Marketplace de plugins (só a API)
