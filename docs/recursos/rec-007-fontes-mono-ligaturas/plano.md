# Plano — REC-007 Mais fontes mono e controle de ligaturas

- **Criado em:** 2026-10-31
- **Última atualização:** 2026-10-31
- **Homologação:** encerrada em 2026-10-31, sem ajuste de código. O what's new continua para o bump da próxima versão.
- **Esforço do agente:** 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Pacotes `@fontsource` (400 e 500, ou só 400) e imports em `main.tsx` | renderer | ✅ |
| 2 | `resolveMonoFontStack`, `monoLigatures` na store (`partialize` + `merge`) e Vitest | renderer | ✅ |
| 3 | `useCodeFontEffect`: pilha resolvida e `font-variant-ligatures` | renderer | ✅ |
| 4 | Seletor, interruptor e chaves `settings.editor.*` (pt-BR, en, es) | renderer | ✅ |
| 5 | `TerminalView` e `LogFollowView`: pilha resolvida e `LigaturesAddon` só quando ligado, sem recriar o xterm | renderer | ✅ |
| 6 | Manual `overview` (3 locales). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

Sem migration, sem canal IPC e sem mudança no main. O quadro de log deixa de recriar o xterm quando a família muda: família, tamanho e ligadura passam a atualizar a instância já aberta, como o terminal SSH já faz com família e tamanho.

## Arquivos-chave

- `package.json` — `@fontsource/ubuntu-mono`, `fira-code`, `source-code-pro`, `cascadia-code`, `cascadia-mono`, `hack`, `inconsolata`, `roboto-mono`, `space-mono`, `noto-sans-mono`, `@xterm/addon-ligatures`
- `src/renderer/src/main.tsx`
- `src/renderer/src/stores/ui-store.ts`
- `src/renderer/src/lib/mono-font.ts` (pilha resolvida e saneamento, se não couber na store)
- `src/renderer/src/lib/mono-font.test.ts`
- `src/renderer/src/hooks/use-code-font-effect.ts`
- `src/renderer/src/features/settings/SettingsPage.tsx`
- `src/renderer/src/features/sessions/TerminalView.tsx`
- `src/renderer/src/features/log-follow/LogFollowView.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/overview.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| `@xterm/addon-ligatures` 0.10.0 declara `main` para um `.js` que o pacote não traz | O import quebra no bundle | Importar o `.mjs` que a versão entrega. Sem fork |
| Colocar ligadura nas deps do efeito que cria o `Terminal` | A sessão SSH reconecta ou o scrollback some | O efeito de criação do terminal continua dependendo só de `sessionId`. Família, tamanho e addon atualizam a instância viva |
| `dispose` do addon não devolve o renderer de uma célula | Desligar a ligadura deixa o glifo junto | Descartar o addon pela API dele e, se o canvas continuar ligado, não recarregar até a face voltar a um glifo por célula. Não dar `term.dispose()` |
| Ligadura e WebGL no mesmo xterm | Atlas errado ou tela em branco | Não carregar `@xterm/addon-webgl` |
| `font-feature-settings` com só `calt`/`liga` | A fonte perde kerning e outras features | Só `font-variant-ligatures`: `none` ou `normal` |
| Cascadia lida como pilha estática | O interruptor troca o CSS e o arquivo continua o outro | Toda leitura passa por `resolveMonoFontStack(family, ligatures)` |
| Bundle cresce com nove famílias | Instalador maior | Só 400 e 500, sem itálico. Três famílias ficam só no 400 |
| Primeira abertura separa `=>` no CodeMirror | Quem já via ligadura no editor vê dois glifos sem ter ligado nada | É o padrão desligado da ideia. O terminal não muda |

## Notas de implementação

- Sem ADR: reaproveita `@fontsource` local (ADR 0003) e a store `north-ui`. O addon de ligadura não é driver, lib nativa nem WASM.
- `test:e2e` não entra neste recurso. O bloco Fonte do app não tem fluxo no `e2e-harness`. A pilha e o saneamento ficam no Vitest; terminal, cópia e editores ficam na homologação.
- O what's new espera o bump da próxima versão: o diálogo só mostra notas até a versão do app.
- `docs/05-design-system.md` ainda descreve IBM Plex Sans na UI. A atualização desse parágrafo é da conclusão, junto com o manual.
- `@fontsource/hack` não existe no npm (404 em 2026-10-31; o pedido no fontsource continua aberto). Hack entra só no peso 400 pelo pacote oficial `hack-font@3.3.0`, no `@font-face` de `src/renderer/src/assets/hack-400.css` (regular, sem itálico e sem 700). Sem CDN. Ubuntu Mono e Space Mono publicam só `400.css`; as outras famílias novas publicam `400.css` e `500.css`.
- `@xterm/addon-ligatures@0.10.0` aponta `main` para `lib/addon-ligatures.js`, que o pacote não traz. O import é `lib/addon-ligatures.mjs`, o arquivo que a versão entrega. O tipo fica em `src/renderer/src/env.d.ts`.
- `dispose()` do addon chama `deregisterCharacterJoiner`. No xterm 6 isso já dá `refresh` das linhas visíveis, então o DOM volta a um glifo por célula sem `term.dispose()` e sem `clearTextureAtlas` (WebGL continua sem carregar). O construtor recebe `fontFeatureSettings: 'normal'` para o addon não gravar `"calt" on` no elemento, que derrubaria kerning. A junção continua no character joiner; o desenho usa `font-variant-ligatures` no `documentElement`.
- O efeito que cria o terminal SSH depende só de `sessionId`. O do quadro de log depende só de `follow.id` e continua com o replay. Família, tamanho e ligadura atualizam a instância viva. A carga inicial do addon, quando o interruptor já está ligado, acontece dentro desse efeito de criação, lendo a store na hora, para a sessão nova nascer com a preferência sem recriar o xterm quando ela muda.
