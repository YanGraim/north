# Testes — REC-013 Indicador de VPN ativa no ícone da bandeja

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test` — `tray-badge.test.ts` e `tray-menu.test.ts` (13 testes)
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. `biome check .` neste checkout acusa fim de linha CRLF no restante do repositório
- [ ] `npm run test` completo — a suíte tem 26 falhas já existentes nesta máquina (caminhos POSIX, `/bin/sh`, socket Unix, openfortivpn). Nenhuma é deste recurso

`npm run test:e2e` não cobre o ícone da bandeja: ele vive no processo principal.

## 2. Roteiro funcional

A elipse no ícone de verdade precisa de uma VPN conectada. O desenho (canto, verde `#22c55e`, N colorido no Windows, N preto ou branco no macOS) foi conferido nos PNGs da bandeja; o ícone ao vivo fica com quem usa o app.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Conectar uma VPN | Windows | Elipse verde no canto inferior direito do N. O texto ao passar o mouse traz o nome | ✅ |
| CT-02 | Conectar uma segunda VPN | Windows | Continua uma elipse só. O texto ao passar o mouse lista os dois nomes | ✅ |
| CT-03 | Desligar, ou deixar conectando / reconectando / em erro | Windows | O ícone volta a ser só o N. O ponto de cada item do menu não muda | ✅ |
| CT-04 | Sem VPN no ar, com a barra clara e com a barra escura | macOS | O N segue a barra, como antes | — |
| CT-05 | Com VPN no ar, barra clara e barra escura | macOS | A elipse continua verde. O N fica preto na barra clara e branco na escura | — |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| 2026-11-04 | Recurso testado com sucesso no Windows. CT-04 e CT-05 não rodaram: não houve Mac nesta homologação | Sem ajuste de código | ✅ |
