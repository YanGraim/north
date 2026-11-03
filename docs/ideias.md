# Ideias (backlog)

- **Última atualização:** 2026-11-02

Primeiro passo de toda funcionalidade nova: a ideia é registrada aqui, amadurece e, quando aprovada, vira um recurso em [`recursos/`](./recursos/README.md). Defeitos em algo que já existe **não** entram aqui, e sim em [`correcoes.md`](./correcoes.md). O procedimento está na skill `ciclo-vida-recursos` (`.agents/skills/`).

Temas de longo prazo ainda sem forma de ideia continuam no [roadmap](./07-roadmap.md#longo-prazo).

## Legendas

| Status | Significado |
| --- | --- |
| 💡 Nova | Registrada, aguardando análise |
| 🔍 Em análise | Em refinamento, com questões em aberto |
| 🚀 Promovida | Virou recurso (ver coluna Recurso) |
| ⏸️ Adiada | Postergada |
| ❌ Descartada | Não será feita |

| Esforço do agente | Quando |
| --- | --- |
| ⚡ Low | Escopo determinístico, segue padrões existentes (UI, CRUD, canal IPC, migration simples) |
| 🧠 High | Arquitetura, segurança, protocolo/plataforma nova, concorrência, migração de dados |

## Backlog

| ID | Ideia | Status | Prioridade | Esforço | Registrada em | Recurso |
| --- | --- | --- | --- | :---: | --- | --- |
| IDEIA-001 | Modo de aparência Automático | 🚀 Promovida | Média | ⚡ Low | 2026-10-29 | REC-001 |
| IDEIA-002 | Diretório padrão na conexão SSH | 🚀 Promovida | Média | ⚡ Low | 2026-10-30 | REC-002 |
| IDEIA-003 | Indicador e erros amigáveis do componente de VPN | 🚀 Promovida | Média | ⚡ Low | 2026-10-30 | REC-003 |
| IDEIA-004 | Acompanhamento de log na conexão SSH | 🚀 Promovida | Média | 🧠 High | 2026-10-30 | REC-004 |
| IDEIA-005 | Diretório e log a partir da seleção do terminal | 🚀 Promovida | Média | ⚡ Low | 2026-10-31 | REC-005 |
| IDEIA-006 | Cor livre e cores favoritas no seletor | 🚀 Promovida | Média | ⚡ Low | 2026-10-31 | REC-006 |
| IDEIA-007 | Mais fontes mono e controle de ligaturas | 🚀 Promovida | Média | 🧠 High | 2026-10-31 | REC-007 |
| IDEIA-008 | Monitorar log da seleção no painel | 🚀 Promovida | Média | ⚡ Low | 2026-10-31 | REC-008 |
| IDEIA-009 | Diretório padrão e monitoramento no painel SFTP | 🚀 Promovida | Média | ⚡ Low | 2026-10-31 | REC-009 |
| IDEIA-010 | Arquivos do diretório atual ao lado do terminal | 🚀 Promovida | Média | 🧠 High | 2026-10-31 | REC-010 |

## Detalhamento

### IDEIA-001 — Modo de aparência Automático

- **Status:** 🚀 Promovida → [REC-001](./recursos/rec-001-modo-aparencia-automatico/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-10-29
- **Área:** UI

**Descrição:** Quarto modo de aparência, **Automático**, ao lado de Escuro, Claro e Sistema. Com ele selecionado, a interface fica clara das 08:00 às 17:00 e escura no restante do dia. A troca acontece com o app aberto, sem precisar reiniciar. Sistema continua seguindo o tema do sistema operacional; Automático segue o relógio.

**Motivação:** Quem usa o North o dia todo quer claro no expediente e escuro de noite, sem depender da configuração do sistema operacional e sem trocar o tema na mão.

**Impacto esperado:** Uma opção a mais em Configurações → Aparência. Terminal, chrome nativo da janela e o restante da UI acompanham a troca no horário.

**Notas técnicas:** A preferência hoje é `ThemePreference = 'dark' | 'light' | 'system'` em `src/shared/lib/theme.ts`, persistida na store `north-ui` e aplicada por `useThemeEffect` (classe no `<html>`, `window.north.setTheme` e, no modo Sistema, `prefers-color-scheme`). O modo novo entra nesse mesmo contrato: resolver claro/escuro pelo relógio local, reagendar a próxima virada (08:00 e 17:00) e reaplicar chrome nativo, xterm e editores que já escutam o tema resolvido. Textos do seletor nos 3 locales. Horários fixos nesta ideia, não configuráveis.

**Decisões (2026-10-30):**

- Às 17:00 em ponto o tema já é escuro: claro das 08:00 inclusive até 17:00 exclusive.
- O relógio é o local da máquina, sem fuso configurável.

**Questões em aberto:** nenhuma.

### IDEIA-002 — Diretório padrão na conexão SSH

- **Status:** 🚀 Promovida → [REC-002](./recursos/rec-002-diretorio-padrao-ssh/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-10-30
- **Área:** sessões/ssh

**Descrição:** Cada conexão SSH pode ter um diretório remoto padrão, opcional. Quando estiver preenchido, o North abre esse diretório ao conectar: no terminal (`cd` no shell) e no navegador de arquivos SFTP. Sem o campo, a conexão abre como hoje, sem falhar. Se o diretório estiver configurado mas não existir ou não tiver permissão, a sessão conecta no home e avisa.

**Motivação:** Quem entra sempre no mesmo caminho (um app, um log, um home de serviço) não quer digitar `cd` depois de cada conexão.

**Impacto esperado:** Campo no cadastro da conexão SSH. Com o diretório preenchido, terminal e SFTP já abrem nele. Sem o campo, nada muda no login.

**Notas técnicas:** `Connection` não tem diretório inicial. O shell SSH (`src/main/protocols/ssh-driver.ts`) abre um PTY sem `cd`. Existe `defaultCommand` persistido e exibido no detalhe da conexão, mas ele não é executado no login — esta ideia é um campo próprio, não reaproveita esse comando. Encaixa em migration + contrato Zod + formulário da conexão + envio do caminho só depois do shell autenticado, sem interpolar o path como shell livre, e no caminho inicial do SFTP da mesma conexão. Import/export de inventário precisa carregar o campo. Vale só para protocolo SSH.

**Decisões (2026-10-30):**

- Abrir nos dois: terminal e navegador de arquivos SFTP.
- Sem diretório configurado, a conexão abre como já é feito hoje, sem falhar.
- Se o diretório estiver configurado mas não existir ou não tiver permissão, a sessão conecta no home e avisa.

**Questões em aberto:** nenhuma.

### IDEIA-003 — Indicador e erros amigáveis do componente de VPN

- **Status:** 🚀 Promovida → [REC-003](./recursos/rec-003-indicador-componente-vpn/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-10-30
- **Área:** UI

**Descrição:** Na tela de VPNs, mostrar de forma explícita se o componente de VPN está **instalado**, **ausente** ou **desatualizado**. Quando a instalação ou a remoção falhar, o usuário vê uma frase curta do que aconteceu e o que fazer. A linha crua do instalador (`Command failed`, `Access is denied`, caminho do `north-vpn-service.exe`) não aparece na tela; fica só no log.

**Motivação:** O rodapé da lista já muda o texto e o botão conforme o status, mas não parece um estado do componente. Nas falhas de instalação no Windows a tela repete o erro do processo elevado, que não diz se faltou permissão, se o arquivo estava em uso ou se a distro WSL não veio no pacote.

**Impacto esperado:** Um indicador visual no bloco do componente (o mesmo de “Remover componente de VPN”). Toasts e o aviso de erro da VPN passam a usar mensagens traduzidas para os casos de instalação. Vale no Windows, no macOS e no Linux.

**Notas técnicas:** O status já chega por `vpn:helper-status` (`installed` | `missing` | `outdated` | `unsupported`) e o bloco é `VpnHelperCard` em `src/renderer/src/features/vpns/VpnsPage.tsx`. Códigos de erro já existem (`PRIVILEGE_DENIED`, `BINARY_MISSING`, `DRIVER_CRASHED`) e a UI tem título em `vpn.errors.*`, mas `DRIVER_CRASHED` e `BINARY_MISSING` ainda mostram `error.message` cru. A oferta na abertura do app (`offerHelperInstall`) só escreve no console. Textos nos 3 locales. No Windows, `installed` significa o serviço North VPN no ar; distro WSL e pasta `openconnect` não entram nesse status.

**Decisões (2026-10-30):**

- O detalhe técnico some da tela e fica só no log.

**Questões em aberto:** nenhuma.

### IDEIA-004 — Acompanhamento de log na conexão SSH

- **Status:** 🚀 Promovida → [REC-004](./recursos/rec-004-acompanhamento-log-ssh/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** 🧠 High
- **Registrada em:** 2026-10-30
- **Área:** sessões/ssh

**Descrição:** Na conexão SSH, o usuário pode indicar um ou mais arquivos de log no servidor. Cada arquivo configurado ganha um quadro que o acompanha em tempo real e continua no arquivo novo quando o log rotaciona (`tail -F`). O quadro pode ser destacado: sai da janela principal e vira um widget próprio, que permanece visível com a janela principal minimizada.

**Motivação:** Quem opera um serviço fica olhando o log ao mesmo tempo em que mexe em outra conexão, num SQL ou na lista. Hoje isso exige um terminal aberto só para o `tail`, preso na janela principal.

**Impacto esperado:** Lista de arquivos de log no cadastro da conexão SSH. Um quadro ao vivo por arquivo. Ação de destacar cada quadro para uma janela independente. Sem nenhum arquivo, a conexão segue como hoje.

**Notas técnicas:** `Connection` não tem caminho de log. A IDEIA-002 é outro campo (diretório inicial) e não cobre este caso. O shell SSH (`src/main/protocols/ssh-driver.ts`) é um PTY interativo; cada arquivo usa um canal próprio no main, com a credencial resolvida no vault, sem digitar o caminho no terminal do usuário e sem interpolar o path como shell livre. O fluxo contínuo de bytes cabe em `MessagePort` por acompanhamento, não em `invoke` solto. Seguir o nome (`tail -F`) é o que sobrevive à rotação; `tail -f` perde o arquivo quando ele é trocado. O North hoje tem uma janela; o widget destacado é uma `BrowserWindow` auxiliar — encosta no tema de **Multi-janela** do roadmap, mas não é o produto de várias janelas de workspace. O [ADR 0016](./adr/0016-logs.md) (proposto) descreve uma área de logs bem maior (busca, retenção, ingestão); a opção A dela é pull via SSH, inclusive `tail`. Esta ideia é só o ao vivo dos arquivos configurados na conexão, mais o quadro destacável — sem banco de logs, sem busca e sem porta de ingestão. Sem agente instalado no servidor.

**Decisões (2026-10-30):**

- Vários arquivos por conexão. Cada um tem o próprio quadro e pode ser destacado sozinho.
- O acompanhamento abre um canal próprio, com as credenciais da conexão. Não reusa o terminal da sessão.
- O widget destacado continua visível com a janela principal minimizada. Ele é janela do North: fechar o app fecha o widget junto.
- A rotação entra agora: o acompanhamento segue o nome do arquivo (`tail -F`).

**Questões em aberto:** nenhuma.

### IDEIA-005 — Diretório e log a partir da seleção do terminal

- **Status:** 🚀 Promovida → [REC-005](./recursos/rec-005-diretorio-log-selecao-terminal/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-10-31
- **Área:** sessões/ssh

**Descrição:** No menu de contexto do terminal de uma sessão SSH, duas ações novas usam o texto selecionado e gravam na conexão dona da sessão. **Definir diretório padrão** preenche o diretório inicial da conexão. **Adicionar arquivo de log** inclui esse caminho na lista de logs acompanhados. Sem seleção, as duas ficam indisponíveis. Não é o menu da conexão na lista do inventário: é o menu do terminal (Cortar, Copiar, Colar, Colar senha salva, Selecionar tudo, Limpar seleção).

**Motivação:** O caminho já está na tela — um `ls`, um `pwd`, a saída de um deploy. Hoje, para gravar o diretório inicial ou um log, a pessoa copia a seleção, abre o cadastro da conexão e cola no campo. No caso do print, a seleção é `/var/www/html/portal/storage/logs/laravel-2026-10-31.log`.

**Impacto esperado:** Com um caminho selecionado no terminal SSH, o menu oferece as duas ações. O diretório padrão e a lista de logs da conexão passam a refletir essa escolha, os mesmos campos do cadastro. Seleção vazia, caminho inválido ou sessão sem conexão SSH salva não grava nada.

**Notas técnicas:** O menu é `TerminalContextMenu` (`src/renderer/src/features/sessions/TerminalContextMenu.tsx`); a sessão já sabe a conexão (o item Colar senha salva depende disso). Os campos já existem: `startupDirectory` ([REC-002](./recursos/rec-002-diretorio-padrao-ssh/especificacao.md)) e `logFiles` ([REC-004](./recursos/rec-004-acompanhamento-log-ssh/especificacao.md)). A gravação reusa o update da conexão, com `normalizeStartupDirectory` e `normalizeLogFilePath` (caminho absoluto POSIX ou `~` / `~/...`; relativo e caractere de controle são rejeitados). Log duplicado e o teto de 8 arquivos já falham em `normalizeLogFileList`. Para saber se a seleção é arquivo ou diretório, a conferência é no servidor pela sessão SSH já aberta — heurística de extensão trataria mal arquivo sem ponto e diretório com ponto. O `cd` da sessão aberta reusa o mesmo caminho do diretório inicial; o acompanhamento reusa o quadro do REC-004. Não há protocolo novo nem segredo novo: o renderer continua sem ver credencial. Os rótulos novos entram nos 3 locales; o restante desse menu ainda está fixo em português e fica de fora desta ideia.

**Decisões (2026-10-31):**

- Na ação de diretório, seleção que é um arquivo grava o diretório pai. Ex.: `/var/www/html/portal/storage/logs/laravel-2026-10-31.log` → `/var/www/html/portal/storage/logs`.
- A gravação vale para as próximas sessões e para a sessão aberta: `cd` no terminal, no caso do diretório, e o acompanhamento do arquivo, no caso do log.
- Se a conexão já tem diretório padrão, a troca pede confirmação.

**Questões em aberto:** nenhuma.

### IDEIA-006 — Cor livre e cores favoritas no seletor

- **Status:** 🚀 Promovida → [REC-006](./recursos/rec-006-cor-livre-cores-favoritas/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-10-31
- **Área:** UI

**Descrição:** O seletor de cor ganha um campo para digitar o hexadecimal e um ícone que abre o color picker nativo do sistema, para escolher qualquer cor. A grade das cores pré-definidas permanece como está. O usuário pode guardar até 10 cores personalizadas e reutilizá-las nos próximos cadastros. Para remover uma, clica com o botão direito sobre ela.

**Motivação:** Cliente, ambiente, conexão, acesso e tag só aceitam as dez cores da grade. Quem quer a cor da marca, ou a mesma cor em várias entidades, não tem como sair dessa lista nem guardar a cor que já usou.

**Impacto esperado:** Em todo seletor de cor do sistema, dá para digitar a cor (`#RRGGBB`, `#RGB` ou o código sem `#`), abrir o picker nativo e escolher qualquer cor, ou aplicar uma das até 10 personalizadas. As dez cores atuais continuam no mesmo lugar. Limpar a cor continua possível.

**Notas técnicas:** O componente é `ColorPicker` (`src/renderer/src/components/ColorPicker.tsx`), usado nos formulários de cliente, ambiente, conexão, conexão de banco, acesso e tag. O gatilho já mostra o hexadecimal e o ícone de pipeta, mas o texto não é editável e o popover só lista `ENTITY_COLORS` (`src/renderer/src/lib/entity-colors.ts`). Essa lista não muda. O ícone aciona `<input type="color">`. O campo normaliza os três formatos para `#RRGGBB` antes de gravar. O campo `color` das entidades já é `z.string().nullable()` — cor fora da grade persiste sem migration. As personalizadas são preferência local da interface (a store `north-ui`), no máximo 10, a mesma lista em todos os seletores; não são dado de inventário nem segredo. A remoção é o botão direito sobre a amostra personalizada. Rótulos novos nos 3 locales.

**Decisões (2026-10-31):**

- O ícone abre o seletor nativo do sistema.
- Até 10 cores personalizadas. A remoção é o clique com o botão direito sobre a amostra.
- O campo aceita `#RRGGBB`, `#RGB` e o código colado sem `#`.

**Questões em aberto:** nenhuma.

### IDEIA-007 — Mais fontes mono e controle de ligaturas

- **Status:** 🚀 Promovida → [REC-007](./recursos/rec-007-fontes-mono-ligaturas/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** 🧠 High
- **Registrada em:** 2026-10-31
- **Área:** UI

**Descrição:** O seletor Fonte do app ganha famílias mono novas, além das cinco atuais (IBM Plex Mono, JetBrains Mono, monoespaçada do sistema, Menlo / Consolas, Courier New). As novas são Ubuntu Mono, Fira Code, Source Code Pro, Cascadia, Hack, Inconsolata, Roboto Mono, Space Mono e Noto Sans Mono. Cascadia é uma família só: com ligaturas, Cascadia Code; sem elas, Cascadia Mono. O mesmo bloco ganha um interruptor para ligar ou desligar ligaturas (`=>`, `!=`, `->`), e o app passa a honrar esse interruptor em toda a interface, no mesmo alcance da fonte de hoje.

**Motivação:** Quem passa o dia no terminal escolhe a fonte pelo desenho dos caracteres e, no caso de Fira Code e Cascadia, pelas ligaturas. Hoje a lista é curta e não há como ligar ou desligar ligadura: o xterm desenha um glifo por célula, então a sequência continua aparecendo como dois caracteres mesmo quando a fonte tem ligadura.

**Impacto esperado:** As famílias novas aparecem no seletor, com o preview `console.log("Olá, North!")` na fonte escolhida. O interruptor de ligaturas muda na hora o terminal, os editores de código (SQL Studio e API Studio), o quadro de log e o restante da UI que já usa essa fonte. Desligado, o desenho fica o de hoje. IBM Plex Mono continua o padrão.

**Notas técnicas:** A preferência mora em `monoFontFamily` na store `north-ui` (`src/renderer/src/stores/ui-store.ts`). `useCodeFontEffect` publica a pilha em `--font-sans`, `--font-mono` e `--code-font-family`, e o terminal lê `MONO_FONT_FAMILY_STACKS` em `TerminalView` e `LogFollowView`. IBM Plex Mono e JetBrains Mono já entram por `@fontsource` em `src/renderer/src/main.tsx` (pesos 400 e 500), sem CDN; as novas seguem o mesmo pacote local. Licenças para redistribuir no app: Ubuntu Mono é Ubuntu Font Licence; Fira Code, Source Code Pro, Cascadia Code, Cascadia Mono, Inconsolata, Space Mono e Noto Sans Mono são OFL; Hack é MIT; Roboto Mono é Apache 2.0. Ligadura no DOM (UI e CodeMirror) é `font-variant-ligatures` / `calt`. No xterm não basta CSS: o canvas não liga glifos entre células, então o terminal e o quadro de log precisam de um addon de ligaduras, com cursor, seleção e cópia continuando sobre os caracteres originais. `@xterm/addon-webgl` está no `package.json` e não é carregado hoje; se passar a ser, ligadura e WebGL não combinam na mesma sessão. Em Cascadia o interruptor troca o arquivo: ligado carrega Cascadia Code, desligado carrega Cascadia Mono, que não tem ligadura por desenho. Nas outras famílias o interruptor só liga ou desliga `calt` / `liga`. O [design system](./05-design-system.md) ainda descreve IBM Plex Sans na UI; o seletor atual já aplica a mono escolhida no app inteiro, e esta ideia segue esse comportamento.

**Decisões (2026-10-31):**

- O interruptor de ligaturas começa desligado. Quem já usa JetBrains Mono ou IBM Plex Mono não muda de desenho até ligar.
- Cascadia entra como uma família só. Ligado usa Cascadia Code; desligado usa Cascadia Mono.
- O interruptor vale no app inteiro, no mesmo alcance da fonte de hoje.

**Questões em aberto:** nenhuma.

### IDEIA-008 — Monitorar log da seleção no painel

- **Status:** 🚀 Promovida → [REC-008](./recursos/rec-008-monitorar-log-selecao/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-10-31
- **Área:** sessões/ssh

**Descrição:** No menu de contexto do terminal de uma sessão SSH, uma ação nova monitora o arquivo de log correspondente ao texto selecionado. O clique abre o acompanhamento na hora e mostra o painel de monitoramento do app. O caminho não entra na lista de arquivos de log da conexão: vale só para este acompanhamento. Sem seleção, a ação fica indisponível. Com seleção que não é um caminho válido, o clique avisa e não abre quadro.

**Motivação:** O caminho do log já está na tela. Para ver o arquivo ao vivo hoje, a pessoa copia a seleção, abre o cadastro da conexão, cola em **Arquivos de log**, salva e clica em **Acompanhar**. Quando o interesse é só olhar agora, gravar o arquivo na conexão é um passo a mais.

**Impacto esperado:** Com um caminho selecionado no terminal SSH, o menu oferece monitorar aquele arquivo. O painel do rodapé passa a mostrar o quadro ao vivo. Se esse arquivo já está ao vivo, o clique só traz o painel para a frente. Caminho inválido mostra um aviso e não abre quadro. Este acompanhamento não entra no teto de 8 quadros do REC-004. Fechar o quadro encerra o acompanhamento, e a lista da conexão continua como estava. A [IDEIA-005](#ideia-005--diretório-e-log-a-partir-da-seleção-do-terminal) ([REC-005](./recursos/rec-005-diretorio-log-selecao-terminal/especificacao.md)) segue sendo a ação que grava o arquivo na conexão.

**Notas técnicas:** O menu é `TerminalContextMenu`. O painel é a faixa `LogFollowDock` do [REC-004](./recursos/rec-004-acompanhamento-log-ssh/especificacao.md): `tail -F`, canal próprio, credencial só no main. Hoje `log-follows:start` exige um `logFileId` que já esteja em `connection.logFiles` e recusa o nono quadro (`LOG_FOLLOW_LIMIT` em `LogFollowService.start`). Esta ideia precisa de um início pelo path, sem escrever a coluna `log_files`, e esse quadro não entra na contagem dos 8. O path passa por `normalizeLogFilePath` (absoluto POSIX ou `~` / `~/...`); a falha vira aviso traduzido, sem quadro. Se já houver acompanhamento ao vivo daquele arquivo, o clique só foca o quadro ou o widget. Não há protocolo novo nem segredo novo. O rótulo e o aviso entram nos 3 locales; o restante desse menu ainda está fixo em português e fica de fora.

**Decisões (2026-10-31):**

- Seleção que não é um caminho válido: o clique avisa e não abre quadro.
- Este acompanhamento não conta no teto de 8 quadros abertos do REC-004.
- Se aquele arquivo já está ao vivo, o clique só traz o painel para a frente.

**Questões em aberto:** nenhuma.

### IDEIA-009 — Diretório padrão e monitoramento no painel SFTP

- **Status:** 🚀 Promovida → [REC-009](./recursos/rec-009-diretorio-e-monitoramento-sftp/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-10-31
- **Área:** sessões/sftp

**Descrição:** No painel de arquivos SFTP de uma conexão SSH, três ações usam o que já está na tela. Um botão na barra do painel remoto grava o diretório atual como diretório padrão da conexão. No menu de contexto de um arquivo, **Adicionar ao monitoramento** inclui o caminho na lista de logs da conexão e abre o acompanhamento. No mesmo menu, **Monitorar em tempo real** abre o acompanhamento daquele arquivo sem gravá-lo na conexão. As duas opções de arquivo ficam indisponíveis quando a seleção não é exatamente um arquivo.

**Motivação:** No print, o painel já está em `/var/www/html/gruppe/storage/logs` e o menu de `laravel.log` só oferece baixar, abrir, renomear, nova pasta, atualizar e excluir. Para gravar essa pasta como diretório inicial, ou para acompanhar o log, a pessoa ainda abre o cadastro da conexão e cola o caminho. O terminal já tem ações parecidas ([IDEIA-005](#ideia-005--diretório-e-log-a-partir-da-seleção-do-terminal) / [REC-005](./recursos/rec-005-diretorio-log-selecao-terminal/especificacao.md) e [IDEIA-008](#ideia-008--monitorar-log-da-seleção-no-painel) / [REC-008](./recursos/rec-008-monitorar-log-selecao/especificacao.md)); o painel de arquivos não.

**Impacto esperado:** Na barra do lado remoto, o botão grava a pasta da barra de caminho no campo **Diretório inicial**. Com um arquivo selecionado, o menu oferece as duas ações de log. **Adicionar ao monitoramento** passa a constar na lista da conexão e abre o quadro. **Monitorar em tempo real** só abre o quadro desta vez. Pasta, seleção múltipla, painel local e sessão sem conexão SSH salva não ganham essas ações.

**Notas técnicas:** A barra e o menu ficam em `FilePane` (`src/renderer/src/features/sessions/file-browser/FilePane.tsx`). O lado remoto já conhece o caminho atual; `FileBrowserView` já recebe `connectionId` e lê `startupDirectory` quando o protocolo é SSH. A gravação do diretório reusa `connections.update` com `normalizeStartupDirectory`, o mesmo campo do [REC-002](./recursos/rec-002-diretorio-padrao-ssh/especificacao.md). O path do arquivo listado já é absoluto: **Adicionar ao monitoramento** reusa `normalizeLogFilePath` e `normalizeLogFileList` (duplicata e teto de 8) e abre o quadro do [REC-004](./recursos/rec-004-acompanhamento-log-ssh/especificacao.md), como o **Adicionar arquivo de log** do REC-005. **Monitorar em tempo real** reusa o início pelo path do [REC-008](./recursos/rec-008-monitorar-log-selecao/especificacao.md): não escreve `log_files`, não entra no teto de 8 e, se o arquivo já está ao vivo, só traz o painel para a frente. Não há protocolo novo nem segredo novo. Os rótulos novos entram nos 3 locales; o restante desse menu ainda está fixo em português e fica de fora.

**Decisões (2026-10-31):**

- Se a conexão já tem diretório padrão, a troca pede confirmação, como na IDEIA-005.
- **Monitorar em tempo real** fica só nesta sessão. Não entra na lista de logs da conexão e não conta no teto de 8 quadros, como na IDEIA-008.
- As três ações aparecem só no painel remoto de SFTP aberto a partir de uma conexão SSH salva. FTP e o painel local ficam de fora.

**Questões em aberto:** nenhuma.

### IDEIA-010 — Arquivos do diretório atual ao lado do terminal

- **Status:** 🚀 Promovida → [REC-010](./recursos/rec-010-arquivos-do-diretorio-atual/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** 🧠 High
- **Registrada em:** 2026-10-31
- **Área:** sessões/ssh

**Descrição:** Na barra da sessão SSH, ao lado da badge do ambiente (no exemplo, **DEV · Desenvolvimento**), uma badge clicável abre um painel à direita do terminal. O painel lista a pasta em que o terminal está, no mesmo visual do navegador SFTP: nome, tamanho, data e permissões. Se o terminal está em `/var`, o painel mostra `/var` aberto e os arquivos dessa pasta. Quando a pessoa dá `cd`, o painel acompanha. Fechar a badge esconde o painel. Não é o navegador de dois lados (local e remoto): é só o lado remoto, preso a esta sessão.

**Motivação:** A pasta já está no prompt (`root@LAPTOP-PREDATOR:/var/www/html#`), mas ver os arquivos exige abrir outra aba SFTP, que começa no diretório inicial da conexão e não segue o `cd` do terminal. Quem está no meio de um deploy quer a lista da pasta atual sem sair do shell.

**Impacto esperado:** No terminal SSH de uma conexão salva, a badge abre e fecha o painel. O painel mostra a pasta corrente e os arquivos dela. Um `cd` atualiza a lista. Sem a pasta conhecida ainda, o painel espera ou avisa, e não lista o diretório de login no lugar. Shell local, FTP, RDP e o navegador de arquivos completo ficam como estão.

**Notas técnicas:** A badge entra em `SessionIdentityBar`, logo depois de `EnvironmentBadge`, na barra que `TerminalView` já monta. O painel é um bloco ao lado do xterm; a divisão reusa o `ResizablePanel` do `FileBrowserView`. A lista reusa `FilePane` só no lado remoto. A listagem sai de um SFTP curto no `Client` SSH já autenticado — o mesmo padrão do `stat` em `ssh-driver.ts` — e não de um `ls` digitado no PTY. O PTY não informa o `cwd`. A pasta chega por integração de shell desta sessão: bash (`PROMPT_COMMAND`) e zsh (`precmd`) emitem OSC 7 (`file://` com o path) a cada prompt, e o xterm lê com `parser.registerOscHandler`. O gancho não é gravado em `.bashrc` nem `.zshrc`. OSC 7 atravessa o PTY em qualquer versão de OpenSSH e vale em Linux, macOS e BSD; não depende de `/proc` nem de achar o PID do shell. `/proc/<pid>/cwd` fica de fora: só existe no Linux e quebra quando o sshd muda a árvore de processos. Ler o `cd` digitado quebra em falha, script, `pushd` e alias. Shell que não é bash nem zsh (dash, ash, fish) não emite a sequência: o painel avisa e não lista a pasta de login no lugar. O diretório inicial do [REC-002](./recursos/rec-002-diretorio-padrao-ssh/especificacao.md) só serve de ponto de partida. A [IDEIA-009](#ideia-009--diretório-padrão-e-monitoramento-no-painel-sftp) mexe no navegador SFTP já aberto; esta ideia não grava diretório padrão nem arquivo de log. Não há protocolo novo nem segredo novo. Os rótulos novos entram nos 3 locales.

**Decisões (2026-10-31):**

- A pasta corrente vem de OSC 7 emitido pelo prompt nesta sessão. Não usa `/proc` nem o texto digitado. O gancho não é gravado no servidor.
- O painel só reflete o terminal. Clicar numa pasta não dá `cd`.
- Vale só para o terminal SSH de uma conexão salva.

**Questões em aberto:** nenhuma.
