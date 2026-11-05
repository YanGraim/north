# REC-012 — Notificações do sistema para VPN

- **Status:** 🧪 Em testes
- **Ideia de origem:** IDEIA-012
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

Quem deixa o North na bandeja recebe um aviso do sistema quando uma VPN conecta, desconecta ou perde a conexão. O aviso leva o nome do perfil e aparece na central de notificações do Windows, do macOS ou do Linux, com a janela escondida ou não. Em Configurações → Inicialização, um interruptor liga ou desliga os três avisos. Ele nasce ligado.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Ao entrar em `connected`, um aviso diz que aquela VPN conectou. Vale a primeira conexão e a volta depois de uma reconexão. | Alta |
| RF-02 | `VpnManager.disconnect()` pedido (botão, bandeja ou ociosidade), ao chegar em `disconnected`, avisa que aquela VPN foi desligada. O estado `disconnecting` não avisa. | Alta |
| RF-03 | A queda inesperada (`onDrop`) avisa uma vez, ao entrar em `reconnecting`. Um novo `emit` que continua em `reconnecting` não repete o aviso. Esgotar as tentativas e ir a `error` não gera um segundo aviso. | Alta |
| RF-04 | Queda com leases vazios (VPN automática na janela de ociosidade) chega em `disconnected` sem `disconnect()` pedido. Esse caso usa o aviso de perda, uma vez, e não o de desligamento. | Alta |
| RF-05 | Sair do North (`isQuitting()` já verdadeiro antes do `shutdown`) desliga os túneis sem aviso. | Alta |
| RF-06 | Falha ao ligar (primeira tentativa indo a `error`, inclusive pela bandeja) não usa estes avisos. A bandeja continua com o aviso que já existe, "VPN não conectou". | Alta |
| RF-07 | O `driver.disconnect()` interno do retorno de suspensão não conta como desligamento pedido. Se o driver emitir queda, vale o aviso de perda; a volta a `connected` avisa que conectou. | Média |
| RF-08 | Interruptor em Configurações → Inicialização, nascendo ligado. Desligado, os três avisos ficam em silêncio na hora, sem reiniciar. Cada perfil gera o próprio aviso. | Alta |
| RF-09 | Textos do interruptor e dos avisos nos 3 locales, no idioma que o main já guarda (`app:set-locale`). | Alta |

## Requisitos técnicos

- **Main:** função pura que, dada a transição (`from`, `to`, motivo `connected` | `disconnect-requested` | `dropped`) e o contexto (`enabled`, `quitting`), devolve o aviso ou nada. `VpnManager` informa a transição com o motivo; não importa Electron. Quem mostra é o `emit` em `src/main/ipc/vpn.ts`, com `Notification`, no mesmo ponto que já redesenha a bandeja. `Notification.isSupported()` falso: não avisa e não falha. O nome do perfil sai do cadastro; o corpo não leva gateway, usuário, senha nem linha de log.
- **IPC:** `app:get-vpn-notifications` → `boolean`. `app:set-vpn-notifications` recebe `boolean` e devolve `boolean`. O locale reusa `app:set-locale`.
- **Renderer:** interruptor em `SettingsPage`, seção Inicialização, ao lado de fechar para a bandeja.
- **Dados:** campo `vpnNotifications` em `userData/window-prefs.json`. Ausente significa ligado. Sem migration, sem SQLite, sem import/export.
- **Segurança:** sem segredo no texto. Sem superfície de rede nova. Sem dependência nova.

## Interface / UX

Interruptor em **Configurações → Inicialização**, nos 3 locales. O menu da bandeja, o ponto de cada item e o indicador na janela não mudam. Clicar no aviso não precisa focar a janela.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Interruptor | Avisos de VPN | VPN notifications | Avisos de VPN |
| Dica | Avisa quando uma VPN conecta, desconecta ou perde a conexão. | Notify when a VPN connects, disconnects, or drops. | Avisa cuando una VPN se conecta, se desconecta o pierde la conexión. |
| Conectou, título | VPN conectada | VPN connected | VPN conectada |
| Conectou, corpo | {nome} está no ar. | {name} is up. | {nombre} está en línea. |
| Desligou, título | VPN desconectada | VPN disconnected | VPN desconectada |
| Desligou, corpo | {nome} foi desligada. | {name} was turned off. | {nombre} se apagó. |
| Perda, título | VPN caiu | VPN dropped | VPN caída |
| Perda, corpo | {nome} perdeu a conexão. | {name} lost the connection. | {nombre} perdió la conexión. |

O corpo de perda não promete nova tentativa: a queda sem lease não reconecta, e a volta a `connected` já tem o aviso próprio.

## Critérios de aceite

- [ ] Conectar uma VPN avisa, com o nome do perfil, no idioma ativo.
- [ ] Desligar pelo botão, pela bandeja ou por ociosidade avisa que foi desligada.
- [ ] Queda inesperada avisa uma vez ao entrar em `reconnecting`. A volta avisa que conectou. Esgotar as tentativas não avisa de novo.
- [ ] Queda na janela de ociosidade, sem lease, avisa perda e não "foi desligada".
- [ ] **Sair do North** desliga os túneis sem aviso.
- [ ] Falha ao ligar, inclusive pela bandeja, não ganha um segundo aviso além do que a bandeja já mostra.
- [ ] Interruptor desligado silencia os três avisos na hora. Nasce ligado.
- [ ] Rótulos e avisos em pt-BR, en e es.

## Fora de escopo

- Aviso sonoro próprio ou ação ao clicar na notificação.
- Mudar o menu da bandeja, o indicador da janela ou o ícone (IDEIA-013).
- Aviso de saúde de conexão SSH, que já existe e continua em português fixo.
- Aviso quando a primeira tentativa de conectar falha.

## Documentação de produto

- Manual: parágrafo novo em `vpns` (os 3 locales), junto do trecho da bandeja. Sem capítulo novo.
- What's new: sim, no bump da próxima versão.
