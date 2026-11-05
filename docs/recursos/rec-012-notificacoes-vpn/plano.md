# Plano — REC-012 Notificações do sistema para VPN

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Homologação:** roteiro em `testes.md`. What's new fica para o bump da próxima versão.
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Canais `app:get-vpn-notifications` e `app:set-vpn-notifications` | shared | ✅ |
| 2 | Campo `vpnNotifications` em `window-prefs.json` (ausente = ligado) | main | ✅ |
| 3 | Função pura do aviso + transição com motivo no `VpnManager` + `Notification` no `emit` | main | ✅ |
| 4 | Preload | preload | ✅ |
| 5 | Interruptor em Inicialização | renderer | ✅ |
| 6 | Vitest da função pura (transições, silêncio no quit, preferência desligada, sem repetir `reconnecting`) | test | ✅ |
| 7 | Manual `vpns` nos 3 locales. What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/ipc/channels.ts`
- `src/shared/ipc/contract.ts`
- `src/main/window-prefs.ts`
- `src/main/ipc/theme.ts` (junto de `app:set-locale` e fechar para a bandeja)
- `src/main/ipc/vpn.ts`
- `src/main/services/vpn/vpn-manager.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/settings/SettingsPage.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/vpns.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| `emit` repete `reconnecting` a cada tentativa | Vários avisos de queda | A função pura só avisa na entrada em `reconnecting`, não enquanto o status anterior já era esse |
| `shutdown` no quit passar por `disconnect()` | Aviso ao sair do app | `isQuitting()` entra no contexto; o quit marca isso antes do `disposeVpn` |
| Queda sem lease classificada como desligamento | Texto "foi desligada" numa queda | Motivo `dropped` distinto de `disconnect-requested` |
| Nome de perfil com dado sensível | Vaza no aviso do sistema | O corpo leva só o nome já visível no menu da bandeja; nada de gateway, usuário ou log |

## Notas de implementação

A decisão cabe numa função pura, testável sem Electron: preferência desligada ou quit devolve nada; `connected` avisa conectou; `disconnect-requested` avisa desligou; `dropped` avisa perda. O `VpnManager` continua sem importar Electron. O texto segue o locale já gravado por `app:set-locale` (`readAppLocale`). Antes do primeiro envio, pt-BR, como o aviso da bandeja.
