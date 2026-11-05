# Plano — REC-014 Editar arquivo remoto e enviar ao salvar

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Classificação de texto e plano de spawn + Vitest | shared | ✅ |
| 2 | Preferência dos editores em `userData` + IPC de settings | main / preload | ✅ |
| 3 | `fs:edit-open` / `fs:edit-save` / `fs:edit-close` e observação do temporário | shared / main / preload | ✅ |
| 4 | Menu remoto, abas do editor interno, seção Editores, i18n (3 locales) | renderer | ✅ |
| 5 | Cypress do navegador: **Editar** no remoto e ausência no local | test | ✅ |
| 6 | Manual `connect` (3 idiomas). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/ipc/channels.ts`, `contract.ts`
- `src/main/protocols/sftp-driver.ts` e `ftp-driver.ts` (download e upload já existentes; a edição não passa pelo diálogo de conflito)
- `src/main/ipc/` (handlers novos de edição e da lista de editores)
- `src/preload/index.ts`
- `src/renderer/src/features/sessions/file-browser/FilePane.tsx` (itens só fora do modo espelho, no painel remoto)
- `src/renderer/src/features/sessions/FileBrowserView.tsx` (abas do editor interno)
- `src/renderer/src/features/settings/SettingsPage.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`
- `cypress/e2e/ftp/file-browser.cy.ts`

Não há migration. O what's new fica para o bump. O manual entra na implementação.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Editor grava com outro nome e troca o arquivo | O envio não vê a gravação, ou envia a cópia pela metade | Observar data e tamanho e só enviar quando os dois ficam estáveis depois de uma espera curta |
| `fs:download` atual abre o diálogo de salvar | A edição pede pasta ao usuário | Canal próprio, temporário no main, sem diálogo |
| Upload reusa o conflito da cópia entre painéis | A pessoa confirma toda gravação | Upload da edição sempre sobrescreve |
| Spawn com shell e caminho remoto | Injeção no comando | `shell: false`, um argumento, só o temporário |
| Fechar a sessão com o editor ainda aberto | Temporário vaza ou a sessão não morre | Apagar o temporário, parar a observação e não esperar o processo |
| Conteúdo do arquivo no log | Config ou script em log local | Log só do motivo (`binary`, `unavailable`); nunca o corpo |
| Modo espelho ganha **Editar** | O painel do terminal passa a enviar arquivo | Itens só no painel remoto do navegador |

## Notas de implementação

- O [ADR 0008](../../adr/0008-file-transfer-ipc.md) continua valendo para listar, baixar com diálogo e enviar com conflito. Esta edição não muda esse contrato.
- Não há ADR novo: sem dependência nova, sem schema, sem superfície de rede e sem mudança do `ProtocolManager`. O spawn do editor fica no main, como os outros processos locais.
- O CodeMirror já usado no app cobre o editor interno. Sem pacote novo de editor.
- Implementado em 2026-11-04. A lista de editores fica em `userData/external-editors.json`. O spawn usa o plano puro (`shell: false`, um argumento). Fechar a sessão passa por `ProtocolManager.close` e `endWith`, que apagam o temporário antes de derrubar a conexão. O what's new continua fora deste patch.
