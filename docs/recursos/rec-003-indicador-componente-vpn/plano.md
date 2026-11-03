# Plano — REC-003 Indicador e erros amigáveis do componente de VPN

- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **Homologação:** encerrada em 2026-10-30. O what's new continua para o bump da próxima versão.
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Classificar a falha do processo elevado em `PRIVILEGE_DENIED`, `BINARY_MISSING` ou `DRIVER_CRASHED`, logar o original e cobrir com Vitest | main | ✅ |
| 2 | Ponto, rótulo e botão Atualizar no `VpnHelperCard`; toast e `VpnErrorNotice` sem a linha crua; chaves nos 3 locales | renderer | ✅ |
| 3 | Diálogo curto quando `offerHelperInstall` falha, sem `detail` técnico | main | ✅ |
| 4 | Manual `vpns` (3 idiomas). What's new no bump da próxima versão | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

O manual do capítulo `vpns` está nos 3 idiomas. O what's new entra no bump da próxima versão. O roteiro está em `testes.md`.

## Arquivos-chave

- `src/main/services/vpn/vpn-runtime.ts` (install/uninstall: classificar antes do `rethrow`)
- `src/main/ipc/vpn.ts` (`elevate` rejeita o `Error` cru; `offerHelperInstall`)
- `src/main/services/vpn/privilege-broker.ts` (os sinais de cancelamento já usados no macOS/Linux)
- `src/shared/lib/vpn/errors.ts` (o fio `[VPN:CODE]` continua; a UI ignora a mensagem nesses códigos)
- `src/renderer/src/features/vpns/VpnsPage.tsx` (`VpnHelperCard`)
- `src/renderer/src/features/vpns/VpnStatus.tsx` (`VpnDot`)
- `src/renderer/src/features/vpns/VpnDetails.tsx` (`VpnErrorNotice`)
- `src/renderer/src/hooks/use-vpn.ts` (`useVpnHelperAction`)
- `src/renderer/src/lib/vpn-ui.ts` (`vpnErrorFromUnknown`)
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`
- `src/renderer/src/content/manual/{pt-BR,en,es}/vpns.md`

A função de classificação fica ao lado do que já formata erro de VPN, com teste próprio. Não é canal IPC novo e não passa pelo preload.

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Tratar `Access is denied` como permissão negada | Arquivo em uso vira «aceite o pedido de administrador» | Só os sinais de cancelamento já conhecidos viram `PRIVILEGE_DENIED`; o resto é a frase genérica, que cita arquivo em uso |
| Esconder `error.message` de `DRIVER_CRASHED` também esconde «O túnel IPsec caiu» | O aviso da conexão fica só com o título | O título traduzido e **Tentar de novo** cobrem esse caso; a frase do driver não era traduzida e misturava texto cru |
| A oferta na abertura roda antes da janela React | Não há toast | `dialog.showMessageBox`, no mesmo ponto em que a oferta já pergunta se instala |
| Logar o erro do `elevate` | Caminho de exe no console | O console já é o destino dessa linha; senha de VPN não trafega nesse comando |

## Notas de implementação

- `WindowsVpnSetup.status()` não muda. `installed` no Windows segue exigindo OpenVPN e o serviço North VPN. WSL e `openconnect/` ficam de fora.
- `formatVpnErrorMessage` pode continuar carregando a mensagem antiga no fio. Quem decide o texto da tela é o locale, não esse campo.
- `WSL_DISTRO_MISSING` segue sendo lançado como `BINARY_MISSING` para o log. A tela usa `vpn.errors.BINARY_MISSING` e a frase de reinstalar, sem `docker run` nem `build-wsl.sh`.
- Sem ADR e sem migration.
