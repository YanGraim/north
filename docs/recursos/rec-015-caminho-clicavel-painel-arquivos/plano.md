# Plano — REC-015 Caminho clicável no painel de arquivos

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `pathSegments` em `paths.ts` | renderer | ✅ |
| 2 | Faixa de trechos no `FilePane`, com o campo ao editar | renderer | ✅ |
| 3 | Rótulos nos 3 locales | renderer | ✅ |
| 4 | Vitest de `pathSegments` + cenário no Cypress do navegador | test | ✅ |
| 5 | Manual (`connect`) nos 3 locales. What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

Não há contrato IPC, preload, migration nem serviço no main.

## Arquivos-chave

- `src/renderer/src/features/sessions/file-browser/paths.ts`
- `src/renderer/src/features/sessions/file-browser/paths.test.ts`
- `src/renderer/src/features/sessions/file-browser/FilePane.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `cypress/e2e/ftp/file-browser.cy.ts`
- `src/renderer/src/content/manual/{pt-BR,en,es}/connect.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Um trecho do espelho chamar `changePath` | O painel do terminal mudaria de pasta sem o shell | `mirror` não renderiza botão; o campo continua `readOnly` |
| `C:\` perder a barra e virar `C:` | A listagem local não abre a raiz | `pathSegments` reusa a mesma raiz que `parentPath` (`C:\`) |
| Barra final ou barra dupla gerar botão vazio | Clique navega para um caminho torto | Trechos vazios não entram na lista |
| Caminho longo quebrar a altura da lista | A lista perde espaço | A faixa rola na horizontal e mantém uma linha |

## Notas de implementação

A função pura devolve o prefixo de cada trecho, para o botão não remontar o caminho na UI. O campo de texto que já existe no `FilePane` só aparece no modo edição. Um caminho UNC (`\\servidor\pasta`) fica num trecho só, para o clique não montar um prefixo sem as barras iniciais.
