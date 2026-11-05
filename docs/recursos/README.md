# Recursos

- **Última atualização:** 2026-11-05

Índice dos recursos promovidos a partir de [ideias](../ideias.md). Cada recurso tem um diretório `rec-xxx-<nome>/` com:

| Arquivo | Conteúdo |
| --- | --- |
| `especificacao.md` | Requisitos, contratos, UX, critérios de aceite, status (fonte da verdade do status) |
| `plano.md` | Etapas por camada, arquivos-chave, riscos |
| `testes.md` | Validações automatizadas, roteiro funcional e registro da homologação (a partir de 🧪) |

Fluxo e templates: skill `ciclo-vida-recursos`. Pausar, despromover ou abandonar: skill `reverter-recurso` (backups em `_backup/`).

## Legenda

| Status | Significado |
| --- | --- |
| 🔄 Em desenvolvimento | Promovido, especificado e em implementação |
| 🧪 Em testes | Código pronto e validado (lint/typecheck/test), em homologação com o usuário |
| ✅ Concluído | Homologado pelo usuário; docs, manual e what's new atualizados |
| ⏸️ Congelado | Pausado; pode ser retomado |
| ❌ Abandonado | Descartado; diretório mantido como histórico |

## Índice

| ID | Recurso | Status | Ideia | Esforço | Branch | Início | Conclusão | ADR |
| --- | --- | --- | --- | :---: | --- | --- | --- | --- |
| REC-001 | [Modo de aparência Automático](./rec-001-modo-aparencia-automatico/especificacao.md) | ✅ Concluído | IDEIA-001 | ⚡ Low | `feature/harness-ia-dev` | 2026-10-30 | 2026-10-30 | — |
| REC-002 | [Diretório padrão na conexão SSH](./rec-002-diretorio-padrao-ssh/especificacao.md) | ✅ Concluído | IDEIA-002 | ⚡ Low | `feature/harness-ia-dev` | 2026-10-30 | 2026-10-30 | — |
| REC-003 | [Indicador e erros amigáveis do componente de VPN](./rec-003-indicador-componente-vpn/especificacao.md) | ✅ Concluído | IDEIA-003 | ⚡ Low | `feature/harness-ia-dev` | 2026-10-30 | 2026-10-30 | — |
| REC-004 | [Acompanhamento de log na conexão SSH](./rec-004-acompanhamento-log-ssh/especificacao.md) | 🧪 Em testes | IDEIA-004 | 🧠 High | `feature/harness-ia-dev` | 2026-10-30 | — | [0019](../adr/0019-acompanhamento-log-ssh.md) |
| REC-005 | [Diretório e log a partir da seleção do terminal](./rec-005-diretorio-log-selecao-terminal/especificacao.md) | ✅ Concluído | IDEIA-005 | ⚡ Low | `feature/harness-ia-dev` | 2026-10-31 | 2026-10-31 | — |
| REC-006 | [Cor livre e cores favoritas no seletor](./rec-006-cor-livre-cores-favoritas/especificacao.md) | ✅ Concluído | IDEIA-006 | ⚡ Low | `feature/harness-ia-dev` | 2026-10-31 | 2026-10-31 | — |
| REC-007 | [Mais fontes mono e controle de ligaturas](./rec-007-fontes-mono-ligaturas/especificacao.md) | ✅ Concluído | IDEIA-007 | 🧠 High | `feature/harness-ia-dev` | 2026-10-31 | 2026-10-31 | — |
| REC-008 | [Monitorar log da seleção](./rec-008-monitorar-log-selecao/especificacao.md) | ✅ Concluído | IDEIA-008 | ⚡ Low | `feature/harness-ia-dev` | 2026-10-31 | 2026-11-02 | — |
| REC-009 | [Diretório padrão e monitoramento no painel SFTP](./rec-009-diretorio-e-monitoramento-sftp/especificacao.md) | ✅ Concluído | IDEIA-009 | ⚡ Low | `feature/harness-ia-dev` | 2026-11-02 | 2026-11-02 | — |
| REC-010 | [Arquivos do diretório atual ao lado do terminal](./rec-010-arquivos-do-diretorio-atual/especificacao.md) | ✅ Concluído | IDEIA-010 | 🧠 High | `feature/harness-ia-dev` | 2026-11-02 | 2026-11-03 | [0020](../adr/0020-listagem-cwd-terminal-ssh.md) |
| REC-011 | [Fechar a janela para a bandeja](./rec-011-fechar-janela-para-bandeja/especificacao.md) | ✅ Concluído | IDEIA-011 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-012 | [Notificações do sistema para VPN](./rec-012-notificacoes-vpn/especificacao.md) | 🧪 Em testes | IDEIA-012 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | — | — |
| REC-013 | [Indicador de VPN ativa no ícone da bandeja](./rec-013-indicador-vpn-icone-bandeja/especificacao.md) | ✅ Concluído | IDEIA-013 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-014 | [Editar arquivo remoto e enviar ao salvar](./rec-014-editar-arquivo-remoto/especificacao.md) | ✅ Concluído | IDEIA-014 | 🧠 High | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-015 | [Caminho clicável no painel de arquivos](./rec-015-caminho-clicavel-painel-arquivos/especificacao.md) | ✅ Concluído | IDEIA-015 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-016 | [Diretórios favoritos no painel de arquivos](./rec-016-diretorios-favoritos-painel-arquivos/especificacao.md) | ✅ Concluído | IDEIA-016 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-017 | [Ações de SFTP no painel da pasta do terminal](./rec-017-acoes-sftp-painel-terminal/especificacao.md) | ✅ Concluído | IDEIA-017 | 🧠 High | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | [0021](../adr/0021-cd-painel-pasta-terminal.md) |
| REC-018 | [Botão do meio copia ou cola no terminal](./rec-018-botao-meio-copia-cola-terminal/especificacao.md) | ✅ Concluído | IDEIA-018 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-019 | [Inverter botões do meio e direito no shell](./rec-019-inverter-botoes-meio-direito/especificacao.md) | ✅ Concluído | IDEIA-019 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-020 | [Seleção de fontes da aplicação](./rec-020-selecao-fontes-aplicacao/especificacao.md) | ✅ Concluído | IDEIA-020 | 🧠 High | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-021 | [Problemas conhecidos no manual](./rec-021-problemas-conhecidos-manual/especificacao.md) | ✅ Concluído | IDEIA-021 | ⚡ Low | `feature/pacote-melhorias-v2` | 2026-11-04 | 2026-11-04 | — |
| REC-022 | [Equipes e acesso por conexão no North Server](./rec-022-equipes-e-acesso-por-conexao/especificacao.md) | 🧪 Em testes | IDEIA-022 | 🧠 High | `feature/acesso-por-conexao-e-equipes` | 2026-11-05 | — | [0018](../adr/0018-north-server-workspaces.md) |
