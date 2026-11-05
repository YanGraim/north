# REC-020 — Seleção de fontes da aplicação

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-020
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

A interface do North passa a ter uma família própria, separada da fonte mono dos shells e dos terminais. Em Configurações → Fonte do app, uma lista nova escolhe a face da janela. O padrão é Inter. Terminal, shell, editores de código e quadro de log continuam na família mono de hoje, com o tamanho e as ligaduras que já existem.

Quem opera o dia todo deixa de ser obrigado a ler menus, formulários e tabelas numa mono. Hosts, portas, atalhos e o que já usa a classe mono continuam mono.

## Decisões

Herdadas da IDEIA-020:

- Duas preferências. A da aplicação não altera shell, terminal, editor de código nem quadro de log.
- A lista da aplicação, nesta ordem: Inter, Segoe UI, Roboto, Open Sans, Outfit, Montserrat, Ubuntu, padrão do sistema, JetBrains Mono, Fira Code.
- Inter é o padrão. Não há botão separado de restaurar.
- O tamanho da interface continua o de hoje: o controle existente escala a raiz, e a família da aplicação acompanha. Não há tamanho próprio da interface.
- O seletor é uma lista na seção que já escolhe a fonte mono, no mesmo `Select`. Não é a grade de cartões do print.
- O catálogo mono do [REC-007](../rec-007-fontes-mono-ligaturas/especificacao.md) permanece só no seletor do terminal. Na aplicação, as mono são JetBrains Mono e Fira Code.
- A frase de exemplo de outro produto não entra.

Fechadas na spec:

- Identificadores, nesta ordem: `inter`, `segoe-ui`, `roboto`, `open-sans`, `outfit`, `montserrat`, `ubuntu`, `system`, `jetbrains-mono`, `fira-code`. Preferência nova `appFontFamily` na store `north-ui`, persistida. No `merge`, valor desconhecido volta a `inter`. Instalação que ainda não tem a chave abre em Inter. `monoFontFamily` e `monoLigatures` não são reescritas.
- Quem já escolheu uma mono em Fonte do app continua com essa mono no terminal. A janela passa a Inter até a pessoa escolher outra família na lista nova. É a troca que a ideia pede.
- Pilhas fixas, com fallback. Inter, Roboto, Open Sans, Outfit, Montserrat e Ubuntu caem em `"Segoe UI", sans-serif`. Segoe UI é `"Segoe UI", sans-serif` e não se embute. O padrão do sistema é `ui-sans-serif, "SF Pro", "Segoe UI", system-ui, sans-serif`: no macOS resolve SF Pro, no Windows resolve Segoe UI, e nenhum dos dois arquivos entra no bundle. JetBrains Mono e Fira Code reaproveitam a pilha de `resolveMonoFontStack`.
- Ubuntu da aplicação é a proporcional (`@fontsource/ubuntu`). Ubuntu Mono continua só no seletor do terminal. Os rótulos são «Ubuntu» e «Ubuntu Mono».
- Pacotes locais, sem CDN, no mesmo import do REC-007. Inter, Roboto, Open Sans, Outfit e Montserrat entram em 400, 500 e 600, sem itálico: a chrome usa `font-medium` e `font-semibold`. Ubuntu não publica 600; entra em 400, 500 e 700, e o semibold (600) cai no 700 pela regra de peso do CSS. JetBrains Mono e Fira Code, já no app em 400 e 500, ganham também o 600 para a mesma chrome não sintetizar o peso. Segoe UI e SF Pro não têm pacote. IBM Plex Sans sai do token, do import e da dependência: não está na lista e deixa de ser fallback. IBM Plex Mono continua no seletor do terminal.
- Licenças, arquivos originais, sem renomear e sem arquivo NOTICE, como no REC-007. Inter, Open Sans, Outfit e Montserrat são OFL-1.1. Roboto é Apache-2.0. Ubuntu é Ubuntu Font Licence 1.0. JetBrains Mono e Fira Code já estão no app.
- `useCodeFontEffect` publica a pilha da aplicação só em `--font-sans` e `--font-display`. `--font-mono` e `--code-font-family` ficam em `resolveMonoFontStack`. O `font-size` da raiz continua derivado de `monoFontSize`. O token em `assets/index.css` passa a declarar Inter, para o primeiro quadro bater com o padrão.
- O interruptor de ligaduras sai do `documentElement`. Ele passa a valer nas superfícies de código: `.font-mono`, `.xterm` e `.cm-editor`, por uma variável (`--code-ligatures`: `none` ou `normal`). Na Inter, ligadura de código não altera o texto da janela, e o `calt` da própria Inter deixa de ser desligado pela raiz. O addon do xterm continua como no REC-007. O preview mono aplica a mesma variável, porque deixa de herdar a raiz.
- O corpo do CodeMirror já lê `--code-font-family`. O chrome `.cm-tooltip` ainda lê `--font-sans` e passa a ler a pilha mono (`--code-font-family`). SQL Studio, API Studio, o editor de arquivo remoto, o filtro de tabela e o campo de variável acompanham o terminal, não a interface. Hosts, portas e atalhos que já usam `font-mono` não mudam de token.
- Só Inter leva o sufixo de padrão, nos 3 locales. «Padrão do sistema» é rótulo traduzido, no mesmo espírito de «Monoespaçada do sistema». Os outros nomes são o nome da família.
- O preview de código de hoje (`console.log("Olá, North!")` e as equivalentes) fica na família mono, no tamanho e na ligadura de código. A lista da aplicação ganha uma linha de preview própria, curta e localizada, desenhada na face escolhida. Sem a frase de outro produto.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | A seção Fonte do app lista as dez famílias da aplicação, com Inter como padrão, e mantém o seletor mono do REC-007. | Alta |
| RF-02 | Trocar a família da aplicação muda na hora a janela, os menus, os formulários, as tabelas, os modais e os widgets. Terminal, shell, editores, quadro de log, hosts, portas e atalhos não mudam. | Alta |
| RF-03 | O controle de tamanho existente continua escalando a raiz e o terminal. A família da aplicação acompanha esse tamanho. | Alta |
| RF-04 | Ligaduras ligadas alteram terminal, quadro de log, editores e o que usa `font-mono`. Não alteram o texto proporcional da janela. | Alta |
| RF-05 | Instalação sem a chave, e valor persistido desconhecido, abrem em Inter. A mono já salva permanece. | Alta |
| RF-06 | Inter, Roboto, Open Sans, Outfit, Montserrat e Ubuntu vêm no bundle, sem rede em runtime. Segoe UI e SF Pro não são embutidas. | Alta |
| RF-07 | SQL Studio, API Studio e o editor de arquivo remoto continuam na mono, inclusive o tooltip de autocomplete. | Alta |
| RF-08 | Rótulos novos ficam nos 3 locales. Nomes de fonte permanecem o nome da família, salvo o padrão do sistema e o sufixo de Inter. | Média |

## Requisitos técnicos

- **Main:** nada.
- **IPC:** nenhum canal novo.
- **Renderer:** catálogo e `resolveAppFontStack` ao lado de `src/renderer/src/lib/mono-font.ts` (módulo próprio se o arquivo da mono ficar só com a mono). `appFontFamily` em `src/renderer/src/stores/ui-store.ts` (`partialize` + `merge`). `useCodeFontEffect` separa as variáveis e tira `font-variant-ligatures` da raiz. `SettingsPage` ganha o `Select` e o preview. Imports de peso em `src/renderer/src/main.tsx`. `.cm-tooltip` em `sql-codemirror-theme.ts` deixa de usar `--font-sans`.
- **Dados:** sem migration, sem SQLite, sem import/export. A preferência é local da interface, como `monoFontFamily`.
- **Segurança:** sem segredo, sem superfície de rede, sem mudança de fronteira de processo. O nome da família não é interpolado em shell.

Não há ADR. A decisão de fonte local sem CDN já está no [ADR 0003](../../adr/0003-navegacao-e-shell.md). Este recurso acrescenta pacotes `@fontsource` no mesmo import do REC-007.

## Interface / UX

Bloco **Fonte do app** (`settings.editor`), de cima para baixo:

1. Família da interface, `Select` na largura do seletor mono.
2. Preview da interface, uma linha localizada na face escolhida.
3. Família do terminal e do código, o `Select` mono de hoje. O rótulo deixa de ser o genérico «Família da fonte».
4. Tamanho, como hoje. O texto da seção deixa claro que o tamanho vale para a interface e para o terminal, e que a família da interface não troca o terminal.
5. Interruptor **Ligaduras**, como hoje. O texto passa a dizer que vale no terminal, nos editores e no que é mono.
6. Preview de código, com a pilha mono, o tamanho e a ligadura de código.

Estados: valor persistido inválido cai em Inter sem toast. Segoe UI ausente no macOS e no Linux cai em `sans-serif`. No padrão do sistema, a face é a sans da plataforma. Interruptor desabilitado não existe.

Sem atalho novo.

Chaves novas em `settings.editor.*` nos locales `pt-BR`, `en` e `es`. A descrição da seção e o rótulo da família mono são reescritos nos 3 locales. O preview de código existente não muda.

## Critérios de aceite

- [x] As dez famílias aparecem na ordem da ideia. Inter é a selecionada numa instalação sem a chave. O preview da interface desenha a face escolhida.
- [x] Valor persistido desconhecido abre em Inter. A mono já salva não é trocada.
- [x] Com a aplicação em Inter e a mono em IBM Plex Mono, a janela é Inter e o terminal, o quadro de log e os editores continuam IBM Plex Mono.
- [x] Trocar a família da aplicação numa sessão SSH aberta não desconecta e não altera `fontFamily` do xterm.
- [x] Ligaduras ligadas juntam `=>` no terminal quando a face mono tem o glifo, e não juntam esse par no texto da janela em Inter.
- [x] O tooltip de autocomplete do SQL Studio e do API Studio permanece mono.
- [x] Host, porta e atalho que já usam `font-mono` permanecem na mono.
- [x] Nenhuma família nova pede fonte na rede. Segoe UI e SF Pro não estão no bundle. IBM Plex Sans deixa de ser importada.
- [x] Vitest cobre a pilha da aplicação (em especial Segoe UI e o padrão do sistema) e o saneamento do valor persistido.
- [x] Rótulos em pt-BR, en e es. Ubuntu da interface e Ubuntu Mono do terminal não compartilham o mesmo rótulo.

## Fora de escopo

- Tamanho separado para a interface e para o terminal.
- Grade de cartões, frase de exemplo de outro produto, botão de restaurar.
- Incluir o catálogo mono do REC-007 na lista da aplicação, além de JetBrains Mono e Fira Code.
- Embutir Segoe UI ou SF Pro, ou baixar fonte em runtime.
- Itálico e pesos que a chrome não usa. Ubuntu entra com 700 no lugar do 600, porque o pacote não publica 600.
- A grade de resultados SQL (`QueryResultGrid`), que continua numa pilha `ui-monospace` fixa.
- Arquivo NOTICE ou tela de licenças de fonte.
- Reescrever o princípio de tipografia do design system além do parágrafo que a conclusão deste recurso atualiza.

## Documentação de produto

- Manual: extensão do capítulo `overview` nos 3 locales — a Fonte do app passa a descrever as duas famílias.
- What's new: entra na próxima versão. Quem atualiza vê a interface em Inter e o terminal na mono que já tinha.
- Engenharia: `docs/05-design-system.md` atualizado. Sem ADR.

## Resultado final

Entregue em 2026-11-04, homologado sem ajuste de código.

Configurações → Fonte do app tem duas listas. A da interface começa em Inter e cobre a janela, os menus, os formulários, as tabelas, os modais e os widgets. A mono de hoje continua no terminal, no shell, nos editores, no quadro de log, em hosts, portas e atalhos. O tamanho segue o controle que já existia. As ligaduras ficam só no que é mono.

Quem já tinha uma mono salva continua com ela no terminal. A janela passa a Inter até escolher outra família. Ubuntu da interface usa o peso 700 no lugar do 600, porque `@fontsource/ubuntu` 5.3.0 não publica 600. IBM Plex Sans saiu do bundle.

Não há coluna nova nem canal IPC. A preferência fica em `appFontFamily` na store `north-ui`. O what's new espera a próxima versão: a tag `v0.1.47` já existe, e o diálogo só mostra notas até a versão do app.

Arquivos principais: `src/renderer/src/lib/app-font.ts`, `src/renderer/src/stores/ui-store.ts`, `src/renderer/src/hooks/use-code-font-effect.ts`, `src/renderer/src/features/settings/SettingsPage.tsx`, `src/renderer/src/features/sessions/sql-codemirror-theme.ts`, `src/renderer/src/main.tsx`, `src/renderer/src/assets/index.css`.
