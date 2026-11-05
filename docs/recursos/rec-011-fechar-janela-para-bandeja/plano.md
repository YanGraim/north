# Plano — REC-011 Fechar a janela para a bandeja

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Homologação:** roteiro em `testes.md`. What's new fica para o bump da próxima versão.
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Canais `app:get-close-to-tray`, `app:set-close-to-tray`, `app:set-locale` + tipos | shared | ✅ |
| 2 | Preferência em `userData` e regra pura de esconder ou fechar | main | ✅ |
| 3 | `close` usa a regra; aviso da bandeja nos 3 idiomas | main | ✅ |
| 4 | Preload | preload | ✅ |
| 5 | Interruptor em Inicialização + envio do locale | renderer | ✅ |
| 6 | Vitest da regra (ligada, desligada, VPN trava, quit) | test | ✅ |
| 7 | Manual (`getting-started`, `vpns`) nos 3 locales. What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/shared/ipc/channels.ts`
- `src/shared/ipc/contract.ts`
- `src/main/index.ts`
- `src/main/ipc/` (junto de launch-at-login)
- `src/preload/index.ts`
- `src/renderer/src/features/settings/SettingsPage.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/getting-started.md`
- `src/renderer/src/content/manual/{pt-BR,en,es}/vpns.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| A preferência desligada gravada com VPN faria o túnel morrer ao fechar | Túnel cai | `locked` ignora desligado no main, não só na UI |
| No macOS, desligada passar a chamar `app.quit` | Fecha o app pelo botão vermelho | Desligada só deixa a janela fechar; `window-all-closed` no Darwin continua sem quit |
| Aviso da bandeja sair em português com o app em inglês | Texto errado | Locale persistido no main; antes do primeiro envio, pt-BR |

## Notas de implementação

A regra de fechar cabe numa função pura, testável sem Electron: quit de verdade não esconde; perfil de VPN esconde; sem perfil, esconde só se a preferência estiver ligada.
