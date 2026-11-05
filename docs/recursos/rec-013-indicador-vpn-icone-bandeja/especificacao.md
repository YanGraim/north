# REC-013 — Indicador de VPN ativa no ícone da bandeja

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-013
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

Quem deixa o North na bandeja vê, no próprio ícone, se alguma VPN está no ar. Uma elipse verde no canto inferior direito do N aparece enquanto houver pelo menos um túnel `connected`. Sem túnel nesse estado, o ícone volta a ser só o N. Continua um ícone só.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Com uma ou mais VPNs em `connected`, o ícone da bandeja (Windows e Linux) ou da barra de menus (macOS) ganha uma elipse verde no canto inferior direito. Várias VPNs no ar continuam sendo uma elipse só. | Alta |
| RF-02 | Sem nenhuma VPN `connected` — lista vazia, desligada, conectando, reconectando, desconectando ou em erro — o ícone é só o N, sem elipse. | Alta |
| RF-03 | A troca acontece no mesmo `onVpnChange` que já redesenha o menu, com `tray.setImage`. O texto ao passar o mouse e o ponto verde, âmbar ou cinza de cada item do menu não mudam. | Alta |
| RF-04 | No macOS, sem VPN no ar, o N continua imagem template, tingida pelo sistema. Com a elipse, a imagem não é template: no aparência escura do sistema o N fica branco e na clara fica preto, e o verde permanece verde. | Alta |
| RF-05 | No Windows e no Linux a base continua `tray.png` (e o `@2x`). Só a elipse entra por cima. | Alta |

## Requisitos técnicos

- **Main:** `trayShowsVpnBadge` decide o desenho (algum `status === 'connected'`). O pixel da elipse é pintado numa cópia do PNG da bandeja e entregue ao Electron com `nativeImage.createFromBuffer`, sem `toBitmap` (o formato cru muda por plataforma). O verde é o do `dot-on.png` já usado no menu (`#22c55e`). No macOS a variante com elipse chama `setTemplateImage(false)`. A cor do N nessa variante segue `AppleInterfaceStyle` (`Dark` ou não), não o tema do app, porque a barra de menus é do sistema. `AppleInterfaceThemeChangedNotification` redesenha o ícone se a elipse estiver no ar.
- **IPC:** nenhum.
- **Renderer:** nenhum.
- **Dados:** nenhum. Sem migration, sem import/export.
- **Segurança:** sem segredo, sem superfície de rede, sem dependência nova.

## Interface / UX

Não há tela nova nem texto de interface. A elipse fica no canto inferior direito, com um fio escuro fino para separar o verde do N. Os nomes das VPNs no ar continuam no texto ao passar o mouse.

## Critérios de aceite

- [x] Com uma VPN `connected`, o ícone mostra a elipse verde. Com duas, continua uma elipse só, e o texto ao passar o mouse lista os dois nomes.
- [x] Conectando, reconectando, desconectando, erro ou desligada, o ícone volta a ser só o N.
- [x] O ponto de cada item do menu não muda.
- [x] No Windows e no Linux o N colorido permanece, com a elipse no canto.
- [ ] No macOS, sem VPN no ar, o N segue claro ou escuro com a barra. Com VPN no ar, o verde não vira preto nem branco. Não executado: a homologação foi no Windows.

## Fora de escopo

- Um segundo ícone na bandeja.
- Elipse em outro estado que não `connected`.
- Mudar o ponto do menu, o indicador da janela ou o texto ao passar o mouse.
- Cadeado no lugar da elipse.
- Preferência para esconder a elipse.

## Documentação de produto

- Manual: parágrafo em `vpns` (os 3 locales), na seção do ícone. Sem capítulo novo.
- What's new: entra no bump da próxima versão. O app está em `0.1.47` e o diálogo só mostra notas até a versão do app.

## Resultado final

Entregue e homologado no Windows em 2026-11-04, sem ajuste de código. O macOS ficou na spec e não entrou neste roteiro.

Com alguma VPN `connected`, o N da bandeja ganha uma elipse verde no canto inferior direito. Várias no ar continuam com uma elipse só; os nomes seguem no texto ao passar o mouse. Nos outros estados o ícone volta a ser só o N. O ponto de cada item do menu não muda. No Windows o N colorido permanece. No macOS, com a elipse, a imagem não é template: o N fica preto na aparência clara do sistema e branco na escura, para o verde não virar preto ou branco.

`docs/02-arquitetura.md`, `docs/04-modelo-dados.md`, `docs/06-seguranca.md`, `docs/08-protocolos.md` e `docs/07-roadmap.md` não descrevem o desenho desse ícone. O what's new espera a próxima versão.

Arquivos principais: `src/main/tray.ts`, `src/main/tray-badge.ts`, `src/main/tray-menu.ts`, `src/main/png-rgba.ts`.
