# Roadmap

## MVP — completo (Partes 1–10)

| Parte   | Entrega                                                                                                | Status   |
| ------- | ------------------------------------------------------------------------------------------------------ | -------- |
| **1**   | Docs, rules, scaffold electron-vite, tooling, UI shell dark-first, IPC tipado                          | Feito    |
| **2**   | SQLite + migrations, repositórios no main, IPC de inventário                                           | Feito    |
| **3**   | Shell UI 3 painéis, navegação, design system aplicado                                                  | Feito    |
| **4**   | CRUD completo + menus de contexto + vault (`safeStorage`)                                              | Feito    |
| **4.5** | UX: pontos de entrada visíveis, onboarding, passe visual / tokens                                      | Feito    |
| **5**   | Command Palette (⌘/Ctrl+K) + busca fuzzy global (fuse.js)                                              | Feito    |
| **6**   | Núcleo de sessões: `ProtocolManager`, abas, xterm.js, driver SSH                                       | Feito    |
| **7**   | SFTP/FTP file browser + Telnet + Serial                                                                | Feito    |
| **8**   | RDP (IronRDP WASM) + VNC (noVNC)                                                                       | Feito    |
| **9**   | Dashboard + estatísticas + notas Markdown                                                              | Feito    |
| **10**  | Import/export, duplicar, polimento, empacotamento (`electron-builder`), auto-update                    | Feito    |

## Pós-MVP / release

Faixa prática para o produto ser usável e distribuível de verdade (ver [ADR 0011](./adr/0011-settings-e-release.md)):

| Item | Entrega | Docs |
| --- | --- | --- |
| **Settings** | Rota `/settings` — Aparência, Idioma, Geral, Inventário, Atualizações, Sobre | — |
| **Access** | Entidade `Access` (database/login/other), vault reveal com ownership, lista unificada | [ADR 0012](./adr/0012-accesses-tema-i18n.md) |
| **Estúdio SQL** | Sessão `database` a partir de Access: modal DataGrip, editor Beekeeper, engines SQL v1 | [ADR 0015](./adr/0015-estudio-sql.md) |
| **Tema / i18n** | Dark/light/system/automatic (08:00–17:00) + locales pt-BR/en/es | [ADR 0012](./adr/0012-accesses-tema-i18n.md), [REC-001](./recursos/rec-001-modo-aparencia-automatico/especificacao.md) |
| **Workflows** | Ações repetíveis por grupo: variáveis, engine linear, aba run, secrets bag, Vitest + Cypress | [ADR 0014](./adr/0014-workflows.md) |
| **Log ao vivo (SSH)** | Arquivos de log por conexão, quadro destacável com `tail -F` | [ADR 0019](./adr/0019-acompanhamento-log-ssh.md), [REC-004](./recursos/rec-004-acompanhamento-log-ssh/especificacao.md) |
| **Pasta do terminal (SSH)** | Painel com os arquivos da pasta corrente, via OSC 7 e SFTP curto no client da sessão | [ADR 0020](./adr/0020-listagem-cwd-terminal-ssh.md), [REC-010](./recursos/rec-010-arquivos-do-diretorio-atual/especificacao.md) |
| **Editar arquivo remoto** | No painel SFTP/FTP, texto abre no editor do North ou num executável local e volta ao salvar | [REC-014](./recursos/rec-014-editar-arquivo-remoto/especificacao.md) |
| **Caminho clicável** | A barra do navegador de arquivos abre a pasta de cada trecho | [REC-015](./recursos/rec-015-caminho-clicavel-painel-arquivos/especificacao.md) |
| **Diretórios favoritos** | No painel remoto de SFTP e de FTP, a pasta aberta fica salva só naquela conexão | [REC-016](./recursos/rec-016-diretorios-favoritos-painel-arquivos/especificacao.md) |
| **Ações na pasta do terminal** | No painel Arquivos do SSH, as ações do SFTP remoto e a navegação com `cd` no shell | [ADR 0021](./adr/0021-cd-painel-pasta-terminal.md), [REC-017](./recursos/rec-017-acoes-sftp-painel-terminal/especificacao.md) |
| **Botão do meio no terminal** | Copia a seleção; sem seleção, cola a área de transferência | [REC-018](./recursos/rec-018-botao-meio-copia-cola-terminal/especificacao.md) |
| **Botões do terminal** | Interruptor troca o copiar ou colar com o menu entre o meio e o direito | [REC-019](./recursos/rec-019-inverter-botoes-meio-direito/especificacao.md) |
| **QA** | Checklist manual por protocolo + fluxos de produto + smoke CI local | [09-qa.md](./09-qa.md) |
| **Distribuição** | Validar electron-builder, GitHub Releases, updater empacotado, signing/notarize opt-in | [10-distribuicao.md](./10-distribuicao.md) |

## Detalhe por faixa (histórico do MVP)

### Inventário e vault (4–5)

CRUD e menus de contexto fecham o ciclo do inventário. O vault de credenciais antecipa-se para a Parte 4 (`safeStorage`), para que as Partes 6+ resolvam `credentialRef` sem reinventar armazenamento. A Parte 4.5 expõe ações (Nova conexão, hover, detalhes) e o onboarding. A palette (Parte 5) opera sobre o inventário com índice `search:index` + fuse.js ([ADR 0006](./adr/0006-busca-fusejs.md)).

### Sessões nativas (6–8)

- **6** — abstração (`ProtocolSession` / drivers / `ProtocolManager`), abas, terminal com `@xterm/xterm`, SSH via `ssh2`.
- **7** — transferência de arquivos (SFTP no `ssh2`, FTP com `basic-ftp`) + Telnet + Serial (`serialport`).
- **8** — desktop remoto: IronRDP (WASM) e `@novnc/novnc`, com ponte TCP/TLS no main.

Ver [08-protocolos.md](./08-protocolos.md) e [ADR 0004](./adr/0004-sessoes-nativas-in-app.md).

### Produto e distribuição (9–10)

Dashboard, favoritos/recentes/histórico com estatísticas, notas Markdown; depois import/export, polimento e empacotamento. Settings + QA + release notes fecham o pós-MVP imediato.

## Longo prazo

- **Plugins** — drivers e ações de terceiros via registry (UI sem protocolo hardcoded)
- **Cloud sync** (opt-in) — metadados criptografados; credenciais continuam locais
- **Workflows avançados** — dry-run UI, multi-target, scheduler, conditions/loops, templates/export
- **Multi-janela** e workspaces salvos — o quadro de log do [ADR 0019](./adr/0019-acompanhamento-log-ssh.md) é uma janela auxiliar presa ao app; várias janelas de workspace continuam neste item
- **Audit log** exportável para compliance
- **Fallback opcional** para cliente externo só quando o protocolo in-app ainda não existir

## Fora de escopo do MVP

- Colaboração em tempo real
- Agente remoto instalado nos servidores
- Marketplace de plugins (só a API de registry)
- Launcher de clientes do SO como caminho principal
