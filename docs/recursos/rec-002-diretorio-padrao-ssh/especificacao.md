# REC-002 — Diretório padrão na conexão SSH

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-002
- **Criado em:** 2026-10-30
- **Última atualização:** 2026-10-30
- **ADRs:** —

## Visão geral

Cada conexão SSH pode ter um diretório remoto opcional. Quando estiver preenchido, o terminal abre nele (`cd` no shell já autenticado) e o navegador de arquivos aberto por **Abrir arquivos (SFTP)** nessa mesma conexão também. Sem o campo, a sessão abre como hoje, no diretório de login, sem falhar. Se o diretório estiver configurado mas não existir ou não der para entrar, a sessão conecta nesse diretório de login e avisa.

Quem entra sempre no mesmo caminho (um app, um log, um home de serviço) deixa de digitar `cd` depois de cada conexão.

## Decisões

Herdadas da IDEIA-002:

- Vale para os dois: terminal SSH e o SFTP aberto a partir dessa conexão (`as: 'sftp'`).
- Campo vazio: nada muda no login.
- Diretório inexistente ou sem permissão: conecta no diretório de login e avisa. A sessão não falha.
- Campo próprio. `defaultCommand` continua só persistido e exibido; esta entrega não passa a executá-lo.

Fechadas na spec:

- Nome no código: `startupDirectory` (coluna `startup_directory`). Na UI: **Diretório inicial**.
- O valor guardado é o que a pessoa digitou (depois do trim), não o caminho resolvido. `~/app` continua `~/app` se o home do servidor mudar.
- Vazio ou só espaço vira `null`.
- Caminho aceito: absoluto POSIX (`/var/www`) ou relativo ao home (`~` ou `~/app`). Relativo sem `~` (`var/log`, `./app`) e `~outro-usuario` são recusados no formulário.
- Sem caractere de controle (nada abaixo de `0x20`, nem DEL). Tamanho máximo 4096.
- O path nunca entra no shell como texto livre. O `~` resolve no main via SFTP (`realpath('.')`), e o `cd` recebe só o absoluto já entre aspas simples (`cd -- '...'`).
- O botão de home do navegador de arquivos continua indo para o diretório de login (`realpath('.')`), não para o diretório inicial.
- Trocar o protocolo para fora de SSH limpa o campo no save.
- Conexão cujo protocolo já é `sftp` ou `ftp` não ganha o campo e abre no login, como hoje.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | O formulário da conexão SSH tem o campo opcional **Diretório inicial**, nos 3 locales. Outros protocolos não mostram o campo. | Alta |
| RF-02 | Com o campo preenchido, o terminal SSH autenticado fica nesse diretório. | Alta |
| RF-03 | **Abrir arquivos (SFTP)** nessa mesma conexão abre o painel remoto nesse diretório. | Alta |
| RF-04 | Com o campo vazio, terminal e SFTP abrem no diretório de login, como hoje. | Alta |
| RF-05 | Se o diretório não existir ou não der para entrar, a sessão conecta no login e avisa. O terminal não recebe o `cd`. | Alta |
| RF-06 | Um caminho com espaço, aspas ou `;` é tratado como path, não como comando. | Alta |
| RF-07 | O painel de detalhes mostra o diretório quando estiver preenchido. | Média |
| RF-08 | Export/import JSON, cópia de workspace e o inventário do North Server preservam o campo. CSV não ganha coluna nova. | Alta |
| RF-09 | Workflows, shell local, telnet e serial não mudam de diretório por causa deste campo. | Média |

## Requisitos técnicos

- **Shared:** `startupDirectory: string | null` em `ConnectionSchema`, com `.default(null)` para um inventário remoto antigo (sem a chave) ainda parsear. `CreateConnectionInputSchema` aceita `string | null` opcional. `normalizeStartupDirectory` em `src/shared/lib/startup-directory.ts` aplica trim, vazio → `null`, o formato acima e o teto de 4096. `quotePosixArg` no mesmo arquivo: aspas simples com `'` escapado como `'\''`.
- **Main:** migration `020-connection-startup-directory` (`ALTER TABLE connections ADD COLUMN startup_directory TEXT`). Repositório lê e grava como `default_command`. No `SshDriver`, depois do shell autenticado e só se o campo estiver preenchido: abre um SFTP curto no mesmo `Client`, resolve `~` com `realpath('.')`, faz `stat`. Se for diretório acessível, escreve `cd -- ` + path absoluto citado + Enter (`\r`, o que o PTY trata como a tecla Enter) e fecha esse SFTP. Se o `stat` falhar, não escreve nada e chama `session.notice` (linha amarela `[North]`, o mesmo canal do aviso do agente). Se o subsistema SFTP não subir, não há como confirmar o diretório: aí sim escreve o `cd` citado (continua sem injeção) e não emite aviso falso de “diretório indisponível”; o erro, se houver, é o do próprio shell. `~` sozinho, resolvido para o diretório de login, não gera `cd`.
- **SFTP:** `ProtocolManager` já faz `{ ...stored, protocol: 'sftp' }` em `as: 'sftp'`, então o campo chega na sessão. O painel remoto não usa `fs.home` como pasta inicial quando o campo existe. `FileBrowserView` recebe o `connectionId` da aba, lê `startupDirectory` da conexão e tenta `fs.list` nesse path. Sucesso: abre ali. Falha: abre no home atual (`fs.home` / `realpath('.')`) e mostra um toast. O home da barra não muda.
- **IPC:** nenhum canal novo. `connections:create` / `connections:update` passam a carregar o campo no contrato que já usa `CreateConnectionInput` / `Connection`.
- **Renderer:** campo no `ConnectionFormDialog`, visível só com protocolo `ssh`, ao lado de encaminhar agente. Validação com `normalizeStartupDirectory`. Detalhe em `ConnectionDetailsPanel`. Chaves novas em `connection.form.*` e `connection.details.*` (e a do toast) em `pt-BR`, `en` e `es`.
- **Dados:** coluna nullable, sem default, sem backfill. Import JSON entra pelo schema. O export em `inventory-json.ts` e a cópia em `workspace-copy.ts` listam o campo na mão — precisam incluí-lo. North Server: migration `006-connection-startup-directory` e a coluna em `CONNECTION_COLUMNS` / `mapConnection` (`SELECT c.*` já cobre a leitura). CSV de inventário segue sem essa coluna; o create continua gravando `null`, como faz com `defaultCommand`.
- **Segurança:** o path não é segredo, mas é entrada que iria para um shell. Rejeitar controle na borda, resolver `~` fora do shell e citar o absoluto. Não concatenar o texto do formulário em `cd ${path}`. O aviso do terminal pode repetir o path configurado; ele não pode carregar ESC nem quebra de linha, porque a normalização já barrou isso.

O aviso do terminal sai em português no driver, no mesmo padrão dos avisos de agente SSH: o main não tem catálogo de i18n, e esta entrega não cria um. Rótulos, detalhe e toast do SFTP são traduzidos.

## Interface / UX

- Formulário da conexão, seção de SSH: input mono, placeholder `/var/www` ou `~/app`. Descrição curta: terminal e arquivos abrem aqui; se a pasta não existir, a sessão entra no login e avisa.
- Vazio, espaço e campo apagado salvam `null`.
- Caminho rejeitado: erro no próprio campo, sem salvar.
- Terminal: linha amarela `[North] …` só quando o SFTP confirmou que não dá para entrar. A sessão permanece conectada.
- SFTP: toast traduzido no fallback. Sem banner permanente.
- Detalhe da conexão: uma linha quando o valor não for `null`.
- Sem atalho novo.

## Critérios de aceite

- [x] Conexão SSH sem o campo abre o terminal e o SFTP no mesmo lugar de hoje.
- [x] Com `/tmp` (ou outro diretório que exista), o prompt do terminal já está lá e o painel remoto do SFTP também.
- [x] Com um caminho que não existe, os dois abrem no login, a sessão fica conectada, o terminal mostra o aviso `[North]` e o SFTP mostra o toast.
- [x] Um caminho com espaço e um com `'` são citados; um valor com `; rm` não executa nada além do `cd` do path.
- [x] `var/log` e `~outro` não salvam. `~/app` salva como `~/app`.
- [x] Export JSON e o inventário do servidor devolvem o campo. CSV inalterado.
- [x] Rótulos em pt-BR, en e es.
- [x] Vitest cobre a normalização, a citação e a migration até `user_version` 20.

## Fora de escopo

- Executar `defaultCommand` no login.
- Diretório inicial em SFTP/FTP cadastrados como protocolo próprio, telnet, serial, shell local, RDP, VNC ou workflows (`ssh.exec`).
- Vários diretórios, diretório por aba ou lembrar a última pasta visitada.
- `~usuario`.
- Catálogo de i18n no main para a linha `[North]`.
- Coluna nova no CSV de inventário.

## Documentação de produto

- Manual: extensão do capítulo `connect` nos 3 locales (seção de terminal e de arquivos SFTP). Feito.
- What's new: fica para o bump da próxima versão. A tag `v0.1.46` já existe, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- Engenharia: `startupDirectory` em `docs/04-modelo-dados.md` e o comportamento no SSH em `docs/08-protocolos.md`. Sem ADR.

## Resultado final

Entregue em 2026-10-30, homologado sem ajuste de código.

Cada conexão SSH tem o campo opcional `startupDirectory` (**Diretório inicial**). Com ele preenchido, o terminal autenticado faz `cd` para essa pasta e **Abrir arquivos (SFTP)** abre o painel remoto nela. Vazio, a sessão fica no diretório de login. Pasta inexistente ou sem permissão: a sessão conecta no login, o terminal mostra a linha `[North]` e o SFTP mostra um toast. O path é normalizado na borda, `~` resolve via SFTP e o `cd` recebe só o absoluto entre aspas simples, terminado com Enter (`\r`).

`defaultCommand` continua sem ser executado. CSV de inventário não ganhou coluna. O what's new espera a próxima versão.

Arquivos principais: `src/shared/lib/startup-directory.ts`, `src/shared/types/connection.ts`, `src/main/database/migrations/020-connection-startup-directory.ts`, `src/main/protocols/ssh-driver.ts`, `src/renderer/src/features/inventory/ConnectionFormDialog.tsx`, `src/renderer/src/features/sessions/FileBrowserView.tsx`, `server/src/migrations.ts`.
