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

## Rastreamento Git (opcional)

Um workflow pode ativar **rastreamento Git**: ao ligar essa opção no editor e informar o caminho de um repositório no servidor (ex.: `/var/www/html/wms-api`), o North captura o commit atual antes de rodar e de novo depois. Se o commit mudou, ele registra automaticamente quais commits entraram, quantos arquivos foram alterados e se a execução teve sucesso ou falhou — sem mudar em nada o que o workflow faz.

Isso não exige API de provedor Git (GitHub/Bitbucket) nem PRs — o North lê o estado direto do repositório no servidor via os mesmos comandos SSH que o workflow já usa. Se o caminho não existir ou não for um repositório Git, o rastreamento simplesmente não registra nada; o workflow continua funcionando normalmente.

O histórico de atualizações aparece em dois lugares:

- **Dashboard** → seção **Últimas atualizações**, no rodapé — visão global, cruzando todos os clientes/ambientes: quantas atualizações hoje/nesta semana, gráfico por semana e a linha do tempo completa.
- **Painel da conexão** → seção **Atualizações**, logo abaixo de Workflows — a mesma visão, mas filtrada só pro ambiente daquela conexão.

Em ambos, o histórico é por **ambiente**: se duas conexões diferentes (ex.: backend e frontend) atualizam o mesmo ambiente via workflows distintos, tudo aparece junto.
