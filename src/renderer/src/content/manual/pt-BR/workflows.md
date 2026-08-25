# Workflows

**Workflows** são ações repetíveis ligadas a um **grupo**: deploy, restart, health-check e similares — sem scripts soltos fora do North.

## Onde criar e editar

1. Selecione uma conexão (ou o grupo) no inventário.
2. Abra o **hub de workflows** do grupo (painel da conexão ou Command Palette → Gerenciar workflows…).
3. Crie o workflow: nome, inputs opcionais e passos (por exemplo `ssh.exec`).

Variáveis do **grupo** (config plaintext) valem para todos os workflows daquele grupo. Inputs são pedidas no momento do run.

## Como executar

- Painel da conexão → seção Workflows
- Botão **Conectar** (menu split) → escolher um workflow
- Command Palette → **Executar workflow…** (conexão SSH selecionada)

A execução abre uma **aba de run** com timeline, progresso e log por passo. A barra abaixo do cabeçalho mostra o **cliente** e o ambiente (**HML** / **PROD** / **DEV** e o nome). O log do passo acompanha o fim da saída; se você subir o histórico, o follow pausa até voltar ao fundo. A duração no cabeçalho e em cada passo congela ao terminar. Em falha, conforme a política do passo, você pode **Retry**, **Continue** ou **Cancelar**.

## Secrets

Senhas e chaves ficam na **bolsa de secrets da conexão**, nunca na definition do workflow nem nas variáveis do grupo. O North pode pedir e oferecer salvar no vault quando o passo precisar autenticar.
