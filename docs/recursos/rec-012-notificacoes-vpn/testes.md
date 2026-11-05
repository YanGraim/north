# Testes — REC-012 Notificações do sistema para VPN

- **Status da homologação:** 🧪 Em testes
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test` — `vpn-notices.test.ts`, `vpn-manager.test.ts` e `window-prefs.test.ts` (36 testes)
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. `biome check .` neste checkout acusa fim de linha CRLF no restante do repositório
- [ ] `npm run test` completo — a suíte tem 24 falhas já existentes nesta máquina (caminhos POSIX, `/bin/sh`, socket Unix, openfortivpn). Nenhuma é deste recurso

`npm run test:e2e` não cobre Configurações.

## 2. Roteiro funcional

O aviso do sistema precisa de uma VPN de verdade. O interruptor pode ser visto sem conectar.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Conectar uma VPN, com o app em pt-BR, en e es | Windows | Aviso "VPN conectada" / "VPN connected" / "VPN conectada", com o nome do perfil | ⬜ |
| CT-02 | Desligar pelo botão ou pela bandeja | Windows | Aviso de que a VPN foi desligada. O estado "desconectando" não avisa sozinho | ⬜ |
| CT-03 | Derrubar o túnel (queda inesperada) e deixar reconectar | Windows | Um aviso de queda. Ao voltar, um aviso de que conectou. Se as tentativas se esgotarem, não há um segundo aviso de queda | ⬜ |
| CT-04 | VPN automática na janela de ociosidade (sessão fechada, túnel ainda no ar) e o túnel cai antes do tempo | Windows | Aviso de perda, não de "foi desligada" | ⬜ |
| CT-05 | Com uma VPN no ar, **Sair do North** | Windows | As VPNs desligam sem aviso | ⬜ |
| CT-06 | Falhar ao ligar pela bandeja | Windows | Só o aviso que já existia, "VPN não conectou". Sem o aviso de queda | ⬜ |
| CT-07 | Desligar **Avisos de VPN** e repetir conectar / desligar | Windows | Nenhum dos três avisos. O interruptor nasce ligado | ⬜ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| — | Aguardando execução pelo usuário | — | — |
