# REC-007 — Mais fontes mono e controle de ligaturas

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-007
- **Criado em:** 2026-10-31
- **Última atualização:** 2026-10-31
- **ADRs:** —

## Visão geral

Configurações → Fonte do app ganha nove famílias mono além das cinco de hoje, e um interruptor para ligar ou desligar ligaturas (`=>`, `!=`, `->`). A escolha vale na hora, no mesmo alcance da fonte atual: interface, terminal, editores de código (SQL Studio e API Studio), quadro de log, hosts, portas e atalhos. IBM Plex Mono continua o padrão. O interruptor começa desligado.

Quem passa o dia no terminal escolhe a fonte pelo desenho e, em Fira Code, JetBrains Mono e Cascadia, pelas ligaturas. Hoje a lista é curta e o xterm desenha um glifo por célula, então a sequência continua aparecendo como dois caracteres mesmo quando a fonte tem ligadura.

## Decisões

Herdadas da IDEIA-007:

- O interruptor de ligaturas começa desligado. Quem já usa JetBrains Mono ou IBM Plex Mono não muda o desenho do terminal até ligar.
- Cascadia entra como uma família só. Ligado usa Cascadia Code; desligado usa Cascadia Mono.
- O interruptor vale no app inteiro, no mesmo alcance da fonte de hoje.

Fechadas na spec:

- As cinco famílias atuais permanecem no topo do seletor, na ordem de hoje. As novas vêm em seguida, nesta ordem: Ubuntu Mono, Fira Code, Source Code Pro, Cascadia, Hack, Inconsolata, Roboto Mono, Space Mono, Noto Sans Mono. O rótulo de Cascadia é «Cascadia», sem Code/Mono no nome. Só IBM Plex Mono leva o sufixo de padrão, nos 3 locales.
- A pilha de cada família é fixa, com fallback `ui-monospace, monospace` (e `"SF Mono"` onde a pilha atual já usa). A única pilha que depende do interruptor é Cascadia: `"Cascadia Code"` ligado, `"Cascadia Mono"` desligado. Nas outras, o interruptor não troca o arquivo.
- Pacotes `@fontsource` no renderer, o mesmo caminho de IBM Plex Mono e JetBrains Mono (`400.css` e, quando o pacote publica o peso, `500.css`). Sem itálico e sem os outros pesos. Ubuntu Mono, Hack e Space Mono não têm 500: só `400.css`, e o peso 500 da UI cai no 400. Sem CDN.
- Licenças, arquivos originais, sem renomear: Ubuntu Mono é Ubuntu Font Licence 1.0; Fira Code, Source Code Pro, Cascadia Code, Cascadia Mono, Inconsolata, Space Mono e Noto Sans Mono são OFL-1.1; Hack é MIT; Roboto Mono é Apache-2.0. Não criar arquivo NOTICE neste recurso: o empacotamento é o que IBM Plex Mono já usa.
- Preferência nova `monoLigatures: boolean` na store `north-ui`, padrão `false`, persistida. No `merge`, família desconhecida volta a `ibm-plex-mono` e valor que não é boolean volta a `false`.
- Desligado: `font-variant-ligatures: none` no `documentElement`, e o addon do xterm não é carregado. Ligado: `normal`, e o addon entra. Não usar `font-feature-settings` parcial: um valor incompleto derruba outras features da fonte. O navegador hoje pode juntar `=>` no editor porque `calt` vem ligado por padrão; a primeira abertura com o interruptor desligado separa esses glifos no DOM. Esse é o estado desligado, o mesmo em toda a interface. O terminal, que já separa, não muda até ligar.
- Addon: `@xterm/addon-ligatures`, peer de `@xterm/xterm` ^6, import ESM como os outros addons. Se a versão publicada apontar `main` para um `.js` ausente (o 0.10.0 faz isso), resolver o `.mjs` que o pacote realmente entrega. Sem fork.
- `@xterm/addon-webgl` continua no `package.json` e continua sem ser carregado. Este recurso não liga WebGL. Ligadura e WebGL não entram juntos nesta entrega.
- Trocar família, tamanho ou ligadura não recria o `Terminal` da sessão SSH nem o do quadro de log, não desconecta e não apaga o scrollback. Atualiza `fontFamily` / `fontSize` e carrega ou descarta o addon na instância que já existe. O quadro de log hoje recria o xterm quando a família muda; a ligadura e a troca Cascadia Code/Mono passam a seguir o mesmo efeito in-place do terminal.
- Cursor, seleção e cópia continuam sobre os caracteres originais. Selecionar o glifo de `=>` copia `=>`. A seta anda uma célula por caractere.
- Família sem ligadura (Courier New, Ubuntu Mono, a mono do sistema quando a fonte instalada não tem o glifo) não é erro: o interruptor liga do mesmo jeito e a sequência continua em dois glifos.
- O preview continua a frase localizada de hoje (`console.log("Olá, North!")` e as equivalentes). Ela não contém ligadura; a prova do interruptor é o terminal, o quadro de log e os editores. O preview usa a família, o tamanho e o mesmo `font-variant-ligatures` da interface.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | O seletor lista as cinco famílias atuais e as nove novas, com IBM Plex Mono ainda como padrão. | Alta |
| RF-02 | O mesmo bloco tem um interruptor de ligaturas, desligado na instalação nova e em quem ainda não tem a chave salva. | Alta |
| RF-03 | A família e o interruptor mudam na hora a interface, o terminal, o SQL Studio, o API Studio, o quadro de log, hosts, portas e atalhos. | Alta |
| RF-04 | Com Cascadia e o interruptor desligado, a face é Cascadia Mono. Ligado, Cascadia Code. | Alta |
| RF-05 | Desligado, o terminal e o quadro de log seguem um glifo por célula. Ligado, `=>`, `!=` e `->` juntam quando a face tem esses glifos. | Alta |
| RF-06 | Copiar a ligadura grava os caracteres originais. A sessão SSH não cai e o scrollback permanece ao alternar. | Alta |
| RF-07 | As fontes novas vêm no bundle, sem rede em runtime. | Alta |
| RF-08 | Rótulos novos do bloco, inclusive o interruptor, ficam nos 3 locales. Nomes de fonte permanecem o nome da família. | Média |

## Requisitos técnicos

- **Main:** nada.
- **IPC:** nenhum canal novo.
- **Renderer:** `MonoFontFamily` e `resolveMonoFontStack(family, ligatures)` em `src/renderer/src/stores/ui-store.ts` (ou um módulo puro ao lado, se a store ficar só com estado). `useCodeFontEffect` publica a pilha resolvida em `--font-sans`, `--font-display`, `--font-mono` e `--code-font-family`, e aplica `font-variant-ligatures` no `documentElement`. `SettingsPage` ganha as opções e o `Switch`. `TerminalView` e `LogFollowView` leem a pilha resolvida e carregam `LigaturesAddon` só com o interruptor ligado. Imports de peso em `src/renderer/src/main.tsx`.
- **Dados:** sem migration, sem SQLite, sem import/export. A preferência é local da interface, como `monoFontFamily`.
- **Segurança:** sem segredo, sem superfície de rede, sem mudança de fronteira de processo. O nome da família não é interpolado em shell.

Não há ADR. A decisão de fonte local sem CDN já está no [ADR 0003](../../adr/0003-navegacao-e-shell.md); este recurso acrescenta pacotes `@fontsource` no mesmo import. `@xterm/addon-ligatures` é addon de renderer, da mesma classe de `addon-fit` e `addon-search`, não driver, lib nativa nem WASM.

## Interface / UX

Bloco **Fonte do app** (`settings.editor`), de cima para baixo:

1. Família, no `Select` de hoje, largura atual.
2. Tamanho, como hoje.
3. Interruptor **Ligaduras**, no mesmo padrão do interruptor «Copiar ao selecionar»: rótulo na linha, `Switch` com `aria-label` traduzido.
4. Preview, com a pilha resolvida, o tamanho e a ligadura da interface.

Estados: valor persistido inválido cai no padrão sem toast. Fonte do sistema ausente cai no próximo nome da pilha, como Menlo / Consolas já faz. Interruptor desabilitado não existe: ele sempre pode ser clicado.

Sem atalho novo.

Chaves novas em `settings.editor.*` nos locales `pt-BR`, `en` e `es` (rótulo e nome acessível do interruptor, e o nome de cada família nova). O preview existente não muda.

## Critérios de aceite

- [x] As nove famílias aparecem depois das cinco atuais e o preview desenha a face escolhida.
- [x] Instalação sem a chave, e valor persistido que não é boolean, abrem com ligaduras desligadas. Família persistida desconhecida abre em IBM Plex Mono.
- [x] Desligado, o terminal mostra `=>` como dois glifos. Ligado, Fira Code, JetBrains Mono e Cascadia Code juntam `=>`, `!=` e `->`.
- [x] Cascadia desligada carrega Cascadia Mono; ligada, Cascadia Code.
- [x] Alternar família ou ligadura numa sessão SSH aberta não desconecta e não limpa o scrollback. O quadro de log também não é recriado.
- [x] Selecionar a ligadura e copiar cola os caracteres originais.
- [x] SQL Studio, API Studio e o restante da UI que já usa a fonte acompanham o interruptor.
- [x] Ubuntu Mono, Hack e Space Mono entram só no peso 400; as demais novas, em 400 e 500. Nenhuma pede fonte na rede.
- [x] Vitest cobre a pilha resolvida (em especial Cascadia) e o saneamento do valor persistido.
- [x] Rótulos em pt-BR, en e es.

## Fora de escopo

- Ligar `@xterm/addon-webgl`, ou fazer ligadura e WebGL conviverem.
- Tamanho de fonte livre, hinting, entrelinha, ou um interruptor por superfície (só terminal, só editor).
- A grade de resultados SQL (`QueryResultGrid`), que hoje usa uma pilha `ui-monospace` fixa em 13px e não segue o seletor.
- Itálico, pesos além de 400/500, e fontes fora da lista.
- Arquivo NOTICE ou tela de licenças de fonte.
- Reescrever o princípio de tipografia do design system além do parágrafo que a conclusão deste recurso precisa atualizar.

## Documentação de produto

- Manual: extensão do capítulo `overview` nos 3 locales (feito).
- What's new: fica para o bump da próxima versão. A tag `v0.1.46` já existe, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- Engenharia: `docs/05-design-system.md` atualizado. Sem ADR.

## Resultado final

Entregue em 2026-10-31, homologado sem ajuste de código.

Configurações → Fonte do app lista as nove famílias novas depois das cinco de hoje. O interruptor de ligaduras começa desligado e vale na interface, no terminal, nos editores, no quadro de log, em hosts, portas e atalhos. Cascadia desligada usa Cascadia Mono; ligada, Cascadia Code. Trocar família ou ligadura não recria o xterm. Copiar uma ligadura grava os caracteres originais.

Não há coluna nova nem canal IPC. A preferência fica em `monoFontFamily` e `monoLigatures` na store `north-ui`. `@fontsource/hack` não existe no registro; a Hack 400 vem de `hack-font`. O what's new espera a próxima versão.

Arquivos principais: `src/renderer/src/lib/mono-font.ts`, `src/renderer/src/lib/terminal/ligatures.ts`, `src/renderer/src/stores/ui-store.ts`, `src/renderer/src/hooks/use-code-font-effect.ts`, `src/renderer/src/features/settings/SettingsPage.tsx`, `src/renderer/src/features/sessions/TerminalView.tsx`, `src/renderer/src/features/log-follow/LogFollowView.tsx`.
