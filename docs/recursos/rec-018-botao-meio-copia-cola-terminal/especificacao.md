# REC-018 — Botão do meio copia ou cola no terminal

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-018
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

No terminal, o botão do meio copia o texto selecionado. Sem seleção, cola o que está na área de transferência. O botão direito continua abrindo o menu de contexto.

Vale em toda sessão que usa `TerminalView`: SSH, Telnet, serial, shell local e workspace de agente. Quem prefere o botão direito para copiar e colar usa o interruptor do [REC-019](../rec-019-inverter-botoes-meio-direito/especificacao.md), que nasce desligado e fica fora deste recurso.

## Decisões

Herdadas da IDEIA-018:

- Seleção copia e a seleção some, como o **Copiar** do menu. Sem seleção, cola. O botão direito permanece o menu.
- Colar inclui imagem: o caminho do arquivo temporário entra como texto, pelo mesmo caminho de ⌘V/Ctrl+V.
- O clique que move o cursor e a seleção de palavra com o botão direito ficam como estão.

Fechadas na spec:

- A área de transferência é a do sistema (`navigator.clipboard`), a mesma de copiar e colar hoje. A seleção primária do X11 não entra.
- Área de transferência vazia não escreve nada no shell. Falha ao copiar mantém a seleção e mostra o aviso que o **Copiar** já usa.
- Clique do meio sobre um link não abre o endereço. Abrir link continua no clique que o addon já trata.
- O gesto não cola senha do vault. Isso continua só no item **Colar senha salva**.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Com texto selecionado, o botão do meio copia esse texto e tira a seleção. | Alta |
| RF-02 | Sem seleção, o botão do meio cola o texto da área de transferência. Se houver imagem, cola o caminho do arquivo temporário. | Alta |
| RF-03 | O botão direito continua abrindo o menu (copiar, colar, cortar, selecionar tudo e as ações de SSH). A seleção de palavra com o direito permanece. | Alta |
| RF-04 | O clique esquerdo na linha de comando atual continua movendo o cursor. Arrastar com o esquerdo continua selecionando. | Alta |
| RF-05 | O botão do meio não dispara a rolagem automática do Chromium nem o atalho do xterm que só reposiciona a área de texto para a seleção primária. | Alta |
| RF-06 | O gesto vale em SSH, Telnet, serial, shell local e workspace de agente. | Alta |

## Requisitos técnicos

- **Renderer:** em `attachTerminalInteraction`, o botão 1 chama `copySelection` quando `term.hasSelection()` e `paste` caso contrário. As duas funções já existem e são as do menu e dos atalhos. A ação corre no `mouseup`, porque o `preventDefault` do `mousedown` — o que segura a rolagem automática do Chromium — pode impedir o `auxclick`. O `auxclick` do botão 1 continua sendo cancelado em captura: no Linux o xterm reposiciona a textarea nesse evento. Se o `mouseup` não tiver tratado o clique, o `auxclick` ainda copia ou cola. Botões 0 e 2 não entram. Os listeners saem no `dispose`.
- **Main / preload / IPC:** nada.
- **Dados:** nada. Sem migration e sem impacto em import/export.
- **Segurança:** nenhum segredo novo. Colar senha do vault não passa por este gesto.

## Interface / UX

Não há controle novo nem rótulo de interface. O aviso de falha ao copiar é o que já existe.

O manual, na seção **Terminal** do capítulo `connect`, ganha uma frase nos 3 locales: com seleção, o botão do meio copia; sem seleção, cola; o botão direito segue o menu.

## Critérios de aceite

- [x] Com texto selecionado num terminal SSH, o botão do meio copia esse texto, a seleção some e colar em outro lugar devolve o mesmo texto.
- [x] Sem seleção, o botão do meio cola o texto da área de transferência no shell.
- [x] Com uma imagem na área de transferência e sem seleção, o botão do meio cola um caminho de arquivo, como ⌘V/Ctrl+V.
- [x] O botão direito abre o menu. O clique esquerdo na linha atual move o cursor. Arrastar com o esquerdo seleciona.
- [x] O botão do meio não rola a página sozinho e não abre link.
- [x] O mesmo gesto funciona no shell local.
- [x] O manual descreve o gesto em pt-BR, en e es.

## Fora de escopo

- O interruptor que troca o botão do meio com o direito ([REC-019](../rec-019-inverter-botoes-meio-direito/especificacao.md)).
- Seleção primária do X11 no lugar da área de transferência do sistema.
- Botões do mouse no navegador de arquivos, no SQL Studio, no API Studio e no quadro de log.
- Colar senha do vault pelo botão do meio.

## Documentação de produto

- Manual: extensão do capítulo `connect`, seção **Terminal**, nos 3 locales. Escrita em 2026-11-04.
- What's new: fica para o bump da próxima versão. O app está em `0.1.47`, e o diálogo só mostra notas até a versão do app.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste de código.

No terminal, o botão do meio copia a seleção e tira ela. Sem seleção, cola a área de transferência do sistema, inclusive uma imagem, que vira caminho. O botão direito segue o menu. O clique esquerdo continua movendo o cursor. Vale em SSH, Telnet, serial, shell local e workspace de agente.

A ação corre no `mouseup` do botão 1. O `mousedown` cancela a rolagem automática. O `auxclick` é engolido para o xterm, no Linux, não reposicionar a textarea. O what's new espera a próxima versão.

Arquivos principais: `src/renderer/src/lib/terminal/attach-interaction.ts`, `src/renderer/src/lib/terminal/middle-button.ts`.
