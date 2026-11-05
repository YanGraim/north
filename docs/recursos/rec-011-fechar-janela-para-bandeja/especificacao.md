# REC-011 — Fechar a janela para a bandeja

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-011
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

Quem usa o North escolhe, em Configurações, se o botão de fechar esconde a janela na bandeja ou encerra o app. A opção nasce ligada. Com pelo menos um perfil de VPN gravado, o interruptor fica bloqueado e ligado: a janela continua indo para a bandeja, porque o túnel depende do processo. **Sair do North**, Cmd+Q e a instalação de atualização continuam encerrando de verdade.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Em Configurações → Inicialização, um interruptor define se fechar a janela a esconde na bandeja. Nasce ligado. | Alta |
| RF-02 | Ligado, o botão de fechar esconde a janela (`hide`). O processo, as sessões, os widgets de log e os túneis continuam. A volta é pelo ícone, por **Abrir North** ou por abrir o North de novo. | Alta |
| RF-03 | Com um ou mais perfis de VPN, o interruptor aparece ligado e desabilitado. O main ignora um valor desligado. Ao apagar o último perfil, o interruptor destrava, continua ligado, e a pessoa pode desligar. | Alta |
| RF-04 | Desligado e sem perfil de VPN, no Windows e no Linux o botão de fechar encerra o app. No macOS a janela fecha e o app fica no Dock até o Quit. | Alta |
| RF-05 | **Sair do North**, Cmd+Q e a instalação de atualização fecham de verdade, com a opção ligada ou não. | Alta |
| RF-06 | Na primeira vez que a janela vai para a bandeja, um aviso do sistema diz que o North continua no ícone, no idioma ativo (pt-BR, en, es), sem falar só de VPN. | Média |
| RF-07 | Rótulos do interruptor nos 3 locales. | Alta |

## Requisitos técnicos

- **Main:** `close` em `src/main/index.ts` esconde a janela quando `isQuitting()` é falso e (`hasVpnProfiles()` ou a preferência está ligada). Sem isso, no Windows e no Linux segue o fechamento atual, inclusive `closeAllLogFollowWindows`. No macOS, desligada, a janela fecha e `window-all-closed` não chama `app.quit`. A preferência mora num JSON em `userData` (ausente = ligada), lido no processo principal. Não entra no SQLite nem no import/export.
- **IPC:** `app:get-close-to-tray` → `{ enabled: boolean, locked: boolean }`. `enabled` é o que o interruptor mostra (sempre `true` quando `locked`). `app:set-close-to-tray` recebe `boolean` e devolve o mesmo objeto; com perfil de VPN, não grava desligado. `app:set-locale` recebe `'pt-BR' | 'en' | 'es'` para o aviso da bandeja, porque o idioma hoje só existe na store do renderer. O renderer envia o locale na abertura e ao trocá-lo.
- **Renderer:** interruptor na seção Inicialização de `SettingsPage`, ao lado de abrir com o sistema. Desabilitado quando `locked`.
- **Dados:** nenhum. Sem migration.
- **Segurança:** sem segredo novo. O aviso não inclui nome de VPN, host nem credencial.

## Interface / UX

Interruptor em **Configurações → Inicialização**, nos 3 locales. Com VPN cadastrada, ligado e sem poder desmarcar. A primeira ida à bandeja mostra a notificação uma vez (o arquivo `tray-hint-shown` já existe; o texto deixa de citar VPN).

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Interruptor | Fechar para a bandeja | Close to the tray | Cerrar a la bandeja |
| Aviso, título | O North continua aberto | North is still open | North sigue abierto |
| Aviso, corpo | O North fica no ícone da bandeja, perto do relógio. | North stays in the tray icon, next to the clock. | North queda en el icono de la bandeja, junto al reloj. |
| Aviso, corpo (macOS) | O North fica no ícone da barra de menus. | North stays in the menu bar icon. | North queda en el icono de la barra de menús. |

## Critérios de aceite

- [x] Sem VPN e com a opção ligada (o padrão), fechar esconde a janela e o processo continua. O ícone traz a janela de volta.
- [x] Sem VPN e com a opção desligada, fechar encerra no Windows e no Linux. No macOS a janela fecha e o app fica no Dock até o Quit.
- [x] Com um perfil de VPN, o interruptor fica ligado e bloqueado, e fechar esconde a janela mesmo que alguém tente gravar desligado.
- [x] Ao apagar o último perfil, o interruptor destrava e continua ligado.
- [x] **Sair do North**, Cmd+Q e instalar atualização encerram de verdade.
- [x] A primeira ida à bandeja avisa no idioma ativo, sem mencionar VPN.
- [x] Rótulos em pt-BR, en e es.

## Fora de escopo

- Minimizar a janela em vez de esconder.
- Desligar a ida à bandeja enquanto existir perfil de VPN.
- Mudar o menu da bandeja ou o indicador de VPN no ícone.

## Documentação de produto

- Manual: extensão de `getting-started` (seção de inicialização) e do parágrafo de fechar a janela em `vpns` — os 3 locales. Escrita em 2026-11-04.
- What's new: fica para o bump da próxima versão. O app está em `0.1.47`, e o diálogo só mostra notas até a versão do app.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste de código.

**Fechar para a bandeja** fica em Configurações → Inicialização e nasce ligado. Fechar esconde a janela. Com um perfil de VPN o interruptor fica ligado e bloqueado. Sem VPN, desligado, fechar encerra no Windows e no Linux; no macOS a janela fecha e o app fica no Dock até o Quit. **Sair do North**, Cmd+Q e a atualização encerram de verdade. O aviso da primeira ida à bandeja sai no idioma ativo e não cita VPN.

A preferência fica em `userData/window-prefs.json`, fora do SQLite. `docs/02-arquitetura.md`, `docs/04-modelo-dados.md`, `docs/06-seguranca.md`, `docs/08-protocolos.md` e `docs/07-roadmap.md` não descreviam esse fechar. O [ADR 0019](../../adr/0019-acompanhamento-log-ssh.md) ganhou um adendo: a regra antiga de recolher só com VPN não vale mais. O what's new espera a próxima versão.

Arquivos principais: `src/main/close-to-tray.ts`, `src/main/window-prefs.ts`, `src/main/index.ts`, `src/main/ipc/theme.ts`, `src/renderer/src/features/settings/SettingsPage.tsx`.
