# REC-019 — Inverter botões do meio e direito no shell

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-019
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

Em Configurações, um interruptor troca as funções do botão do meio e do botão direito nos shells. Desligado, vale o [REC-018](../rec-018-botao-meio-copia-cola-terminal/especificacao.md): o meio copia ou cola, o direito abre o menu. Ligado, o direito copia ou cola e o meio abre o menu.

Vale em toda sessão que usa `TerminalView`: SSH, Telnet, serial, shell local e workspace de agente. Fora do terminal, os botões não mudam.

## Decisões

Herdadas da IDEIA-019:

- Depende do REC-018, já concluído. O interruptor nasce desligado.
- Vale só nos shells. O resto do app não troca os botões.
- A preferência fica neste computador, na store `north-ui`.

Fechadas na spec:

- A escolha copiar ou colar é a do REC-018: com seleção, copia e a seleção some; sem seleção, cola a área de transferência do sistema, inclusive imagem, que vira caminho. Área vazia não escreve nada. Falha ao copiar mantém a seleção e mostra o aviso que o **Copiar** já usa.
- O menu aberto pelo botão que cabe a ele é o `TerminalContextMenu` de hoje (copiar, colar, cortar, selecionar tudo, colar senha salva e as ações de SSH).
- Com o interruptor ligado, `rightClickSelectsWord` fica desligado. Se o direito selecionasse a palavra antes, o copiar dispararia no lugar de colar.
- O gesto de copiar ou colar não cola senha do vault. Isso continua só no item **Colar senha salva**, no botão que abre o menu.
- O clique esquerdo na linha de comando atual continua movendo o cursor. Arrastar com o esquerdo continua selecionando.
- Sessão já aberta acompanha o interruptor no próximo clique, sem reconectar.
- **Copiar ao selecionar** permanece independente deste interruptor.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Na seção Terminal de Configurações, um interruptor nasce desligado e persiste neste computador. | Alta |
| RF-02 | Desligado, o botão do meio copia ou cola e o direito abre o menu, como no REC-018. A seleção de palavra com o direito permanece. | Alta |
| RF-03 | Ligado, o botão direito copia a seleção ou cola se não houver seleção. O direito não seleciona a palavra antes. | Alta |
| RF-04 | Ligado, o botão do meio abre o mesmo menu de contexto. O meio não copia nem cola, não rola a página sozinho e não abre link. | Alta |
| RF-05 | O clique esquerdo continua movendo o cursor e selecionando por arraste, nos dois estados. | Alta |
| RF-06 | O gesto vale em SSH, Telnet, serial, shell local e workspace de agente. Fora do terminal, os botões não mudam. | Alta |

## Requisitos técnicos

- **Renderer:** a preferência entra na store `north-ui`, no mesmo padrão de `terminalCopyOnSelect`, com padrão `false` e campo no `partialize`. O interruptor fica em `SettingsPage`, na seção `settings.terminal`. No terminal, o clique lê a store no momento do evento. Desligado, `attachMiddleButton` e o `contextmenu` do `TerminalContextMenu` seguem como hoje, com `rightClickSelectsWord: true`. Ligado, o `contextmenu` do botão direito é cancelado e chama a mesma escolha de `resolveMiddleButtonAction`; o `mouseup` do botão 1 abre o menu em vez de copiar ou colar, e `rightClickSelectsWord` fica `false` também numa sessão já aberta. O `preventDefault` do meio (rolagem automática e reposicionamento da textarea no Linux) permanece nos dois estados.
- **Main / preload / IPC:** nada.
- **Dados:** nada. Sem migration e sem impacto em import/export. A preferência não sai do `localStorage` deste computador.
- **Segurança:** nenhum segredo novo. Colar senha do vault continua só no item do menu.

## Interface / UX

O interruptor fica na seção **Terminal**, ao lado de **Copiar ao selecionar**. Rótulo curto, no tom dessa linha, com uma frase de apoio: desligado, o meio copia ou cola e o direito abre o menu; ligado, os papéis se invertem. Textos em pt-BR, en e es. `aria-label` no interruptor.

O menu, quando aberto pelo meio, aparece no ponto do clique e traz os mesmos itens.

O manual, na seção **Terminal** do capítulo `connect`, ganha a frase do interruptor nos 3 locales, ao lado da que o REC-018 já escreveu.

## Critérios de aceite

- [x] O interruptor nasce desligado. Fechar e abrir o app mantém o estado escolhido.
- [x] Desligado, o botão do meio copia ou cola e o direito abre o menu, inclusive a seleção de palavra.
- [x] Ligado, com texto selecionado, o botão direito copia esse texto, a seleção some e colar em outro lugar devolve o mesmo texto.
- [x] Ligado e sem seleção, o botão direito cola a área de transferência. Uma imagem vira caminho, como ⌘V/Ctrl+V.
- [x] Ligado, o botão do meio abre o menu (copiar, colar, cortar, selecionar tudo e, numa conexão SSH, as ações de SSH). Não copia, não cola, não rola a página e não abre link.
- [x] Ligado, o botão direito não seleciona a palavra no lugar de colar.
- [x] O clique esquerdo continua movendo o cursor nos dois estados.
- [x] Trocar o interruptor com um shell já aberto vale no próximo clique.
- [x] O manual descreve o interruptor em pt-BR, en e es.

## Fora de escopo

- Seleção primária do X11 no lugar da área de transferência do sistema.
- Botões do mouse no navegador de arquivos, no SQL Studio, no API Studio e no quadro de log.
- Colar senha do vault pelo gesto de copiar ou colar. O item do menu permanece.
- Atalhos de teclado de copiar, colar, cortar e selecionar tudo.

## Documentação de produto

- Manual: extensão do capítulo `connect`, seção **Terminal**, nos 3 locales. Escrita em 2026-11-04.
- What's new: entra na próxima versão. O app está em `0.1.47`, e o diálogo só mostra notas até a versão do app.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste de código.

Em **Configurações → Terminal**, **Botão direito copia ou cola** nasce desligado e fica neste computador. Desligado, o meio copia ou cola e o direito abre o menu. Ligado, o direito copia a seleção ou cola se não houver seleção, e o meio abre o mesmo menu. O direito deixa de selecionar a palavra. O clique esquerdo não muda. Vale em SSH, Telnet, serial, shell local e workspace de agente. Uma sessão já aberta acompanha o interruptor no próximo clique.

A preferência é `terminalRightButtonCopies` na store `north-ui`. O copiar ou colar continua `resolveMiddleButtonAction`. Com o interruptor ligado, o `contextmenu` do botão 2 é cancelado em captura. O menu do meio nasce de um `contextmenu` disparado no container, com `button` 0, para o Radix posicionar no clique.

Arquivos principais: `src/renderer/src/stores/ui-store.ts`, `src/renderer/src/features/settings/SettingsPage.tsx`, `src/renderer/src/lib/terminal/middle-button.ts`, `src/renderer/src/lib/terminal/attach-interaction.ts`, `src/renderer/src/features/sessions/TerminalView.tsx`.
