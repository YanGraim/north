# Testes — REC-011 Fechar a janela para a bandeja

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test` — `src/main/close-to-tray.test.ts` e `src/main/window-prefs.test.ts` (12 testes)
- [ ] `npm run lint` — nesta máquina o Biome acusa fins de linha do repositório inteiro; os arquivos deste recurso passaram no check
- [ ] `npm run test` completo — a suíte tem falhas já existentes nesta máquina (caminhos POSIX, `/bin/sh`, socket Unix). Nenhuma é deste recurso

`npm run test:e2e` não cobre Configurações.

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Sem VPN, opção ligada (padrão). Fechar a janela | Windows | A janela some e o processo continua. O ícone da bandeja traz a janela de volta | ✅ |
| CT-02 | Sem VPN, desligar **Fechar para a bandeja**. Fechar a janela | Windows | O North encerra | ✅ |
| CT-03 | Cadastrar uma VPN | Windows | O interruptor fica ligado e não pode ser desmarcado. Fechar a janela esconde o North | ✅ |
| CT-04 | Apagar a última VPN | Windows | O interruptor destrava e continua ligado. Dá para desligar | ✅ |
| CT-05 | Com a opção ligada, **Sair do North** no ícone | Windows | O app encerra de verdade | ✅ |
| CT-06 | Primeira vez que a janela vai para a bandeja | Windows | Um aviso do sistema diz que o North continua no ícone, no idioma ativo, sem citar VPN | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | --- |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
