# Plano — REC-020 Seleção de fontes da aplicação

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Homologação:** encerrada em 2026-11-04, sem ajuste de código. O what's new continua para o bump da próxima versão.
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Pacotes `@fontsource` (Inter, Roboto, Open Sans, Outfit e Montserrat em 400/500/600; Ubuntu em 400/500/700; 600 de JetBrains Mono e Fira Code). Remover IBM Plex Sans. Imports em `main.tsx` | renderer | ✅ |
| 2 | `resolveAppFontStack`, `appFontFamily` na store (`partialize` + `merge`) e Vitest | renderer | ✅ |
| 3 | `useCodeFontEffect`: sans/display na aplicação, mono e `--code-font-family` na mono, ligadura fora da raiz | renderer | ✅ |
| 4 | Seletor, preview, rótulos e descrição em `settings.editor.*` (pt-BR, en, es) | renderer | ✅ |
| 5 | `.cm-tooltip` na pilha mono | renderer | ✅ |
| 6 | Manual `overview` (3 locales). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

Sem migration, sem canal IPC e sem mudança no main. O terminal e o quadro de log continuam lendo `resolveMonoFontStack`; não passam a observar `appFontFamily`.

## Arquivos-chave

- `package.json` — `@fontsource/inter`, `roboto`, `open-sans`, `outfit`, `montserrat`, `ubuntu`; saída de `@fontsource/ibm-plex-sans`
- `src/renderer/src/main.tsx`
- `src/renderer/src/assets/index.css` — token padrão Inter
- `src/renderer/src/lib/mono-font.ts` ou módulo vizinho da família da aplicação
- `src/renderer/src/lib/mono-font.test.ts` (ou teste irmão)
- `src/renderer/src/stores/ui-store.ts`
- `src/renderer/src/hooks/use-code-font-effect.ts`
- `src/renderer/src/features/settings/SettingsPage.tsx`
- `src/renderer/src/features/sessions/sql-codemirror-theme.ts`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/overview.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| `font-variant-ligatures` permanece na raiz | Inter desenha ligadura de código, ou o `calt` da Inter fica desligado | A propriedade sai do `documentElement` e fica em `.font-mono`, `.xterm` e `.cm-editor` |
| `.cm-tooltip` continua em `--font-sans` | O autocomplete do SQL e da API vira a face da interface | Apontar o tooltip para `--code-font-family` |
| Instalação existente lia a mono na janela | A UI muda para Inter no update | É o padrão da ideia. A mono salva segue no terminal. O what's new avisa |
| Segoe UI no macOS e no Linux | A opção não tem a face | Fallback `sans-serif`, sem baixar arquivo. O padrão do sistema usa a sans da plataforma |
| Bundle cresce com seis famílias | Instalador maior | Só os pesos que a chrome usa, sem itálico. IBM Plex Sans sai |
| Peso 600 sintético em JetBrains e Fira na chrome | Título e selo borrados quando a aplicação é mono | Importar o `600.css` dessas duas, que o pacote já publica |
| Ubuntu proporcional confundida com Ubuntu Mono | A pessoa acha que trocou o terminal | Pacotes e rótulos distintos. O seletor mono não lista a Ubuntu proporcional |
| Token CSS ainda em IBM Plex Sans | Primeiro quadro pisca a face antiga | O token padrão passa a Inter no mesmo passo do efeito |
| Nome `@fontsource/ubuntu` no lugar de `ubuntu-mono` | O terminal perde a Ubuntu Mono | Não remover `@fontsource/ubuntu-mono`. O import novo é o outro pacote |

## Notas de implementação

- Sem ADR: reaproveita `@fontsource` local (ADR 0003) e a store `north-ui`.
- `test:e2e` não entra neste recurso. O bloco Fonte do app não tem fluxo no `e2e-harness`. A pilha e o saneamento ficam no Vitest; terminal, editores e a janela ficam na homologação.
- O what's new espera o bump da próxima versão. A tag `v0.1.47` já existe, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- `docs/05-design-system.md` atualizado na conclusão: a interface deixa de ser descrita como mono.
- Catálogo em `src/renderer/src/lib/app-font.ts`. A ligadura sai da raiz por `--code-ligatures` em `.font-mono`, `.xterm` e `.cm-editor`. O preview mono lê a mesma variável.
- `@fontsource/ubuntu` 5.3.0 não publica `600.css` (só 300, 400, 500 e 700). O import é 400, 500 e 700. O peso 600 da chrome resolve no 700.
