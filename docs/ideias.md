# Ideias (backlog)

- **Última atualização:** 2026-11-04

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
| IDEIA-011 | Fechar a janela para a bandeja | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-011 |
| IDEIA-012 | Notificações do sistema para VPN | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-012 |
| IDEIA-013 | Indicador de VPN ativa no ícone da bandeja | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-013 |
| IDEIA-014 | Editar arquivo remoto e enviar ao salvar | 🚀 Promovida | Média | 🧠 High | 2026-11-04 | REC-014 |
| IDEIA-015 | Caminho clicável no painel de arquivos | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-015 |
| IDEIA-016 | Diretórios favoritos no painel de arquivos | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-016 |
| IDEIA-017 | Ações de SFTP no painel da pasta do terminal | 🚀 Promovida | Média | 🧠 High | 2026-11-04 | REC-017 |
| IDEIA-018 | Botão do meio copia ou cola no terminal | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-018 |
| IDEIA-019 | Inverter botões do meio e direito no shell | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-019 |
| IDEIA-020 | Seleção de fontes da aplicação | 🚀 Promovida | Média | 🧠 High | 2026-11-04 | REC-020 |
| IDEIA-021 | Problemas conhecidos no manual | 🚀 Promovida | Média | ⚡ Low | 2026-11-04 | REC-021 |

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

### IDEIA-011 — Fechar a janela para a bandeja

- **Status:** 🚀 Promovida → [REC-011](./recursos/rec-011-fechar-janela-para-bandeja/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** UI

**Descrição:** Em Configurações, um interruptor define se o botão de fechar esconde a janela na bandeja ou encerra o North. A opção nasce ligada. Com pelo menos um perfil de VPN gravado, o interruptor fica bloqueado e a janela continua indo para a bandeja. Sem perfil, a pessoa pode desligar: no Windows e no Linux o botão de fechar encerra o app; no macOS a janela some e o app fica no Dock até o Quit. **Sair do North**, Cmd+Q e a instalação de atualização continuam encerrando de verdade.

**Motivação:** Hoje a janela só vai para a bandeja quando existe um perfil de VPN. Quem não tem VPN perde sessões e o processo ao fechar a janela, mesmo querendo deixar o North no ícone. Quem tem VPN não pode escolher o contrário — e não deve, porque o túnel depende do processo.

**Impacto esperado:** O botão de fechar esconde a janela por padrão, com ou sem VPN. A volta é pelo ícone (clique, **Abrir North** ou abrir o North de novo). Com VPN cadastrada, a opção aparece ligada e não pode ser desmarcada. Sem VPN e com a opção desligada, fechar volta a encerrar no Windows e no Linux. Sessões, widgets de log e túneis seguem enquanto a janela está só escondida.

**Notas técnicas:** O ícone da bandeja já sobe sempre (`createTray`). O `close` em `src/main/index.ts` já esconde a janela (`hide`, não minimizar) quando `hasVpnProfiles()` e deixa fechar de verdade quando `isQuitting()` (bandeja, Cmd+Q, atualização). A preferência substitui essa condição quando não há perfil: o valor fica no processo principal, no padrão de `app:get-launch-at-login` / `app:set-launch-at-login`, porque o `close` não lê a store do renderer. O interruptor entra na seção de inicialização de Configurações, nos 3 locales. Com perfil de VPN, a UI desabilita o controle e o main ignora um valor desligado. O aviso da primeira ida à bandeja deixa de falar só de VPN e passa a dizer que o North continua no ícone, nos 3 idiomas. No macOS, opção ligada esconde a janela em vez de destruí-la; opção desligada mantém o fechamento atual, sem `app.quit` no botão vermelho. Não há ADR: a bandeja, o quit e o desligamento dos túneis em `before-quit` já existem.

**Decisões (2026-11-04):**

- Esconder a janela (`hide`), tirando-a da barra de tarefas. Não minimizar.
- A opção nasce ligada. Com um ou mais perfis de VPN, fica bloqueada e permanece ligada. Ao apagar o último perfil, o interruptor destrava, continua ligado, e a pessoa pode desligar.
- No macOS, ligada esconde a janela (sessões sobrevivem; a volta é pelo ícone da barra de menus). Desligada, a janela fecha e o app fica no Dock até o Quit.

**Questões em aberto:** nenhuma.

### IDEIA-012 — Notificações do sistema para VPN

- **Status:** 🚀 Promovida → [REC-012](./recursos/rec-012-notificacoes-vpn/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** VPN

**Descrição:** O North avisa pelo sistema operacional quando uma VPN conecta, desconecta ou perde a conexão. O aviso aparece na central de notificações do Windows, do macOS ou do Linux, com o nome da VPN, mesmo com a janela escondida na bandeja. Em Configurações, um interruptor liga ou desliga esses avisos. Ele nasce ligado.

**Motivação:** Quem deixa o North na bandeja não vê o estado na tela. Hoje a queda do túnel só entra no log da VPN e no menu do ícone. A saúde das conexões já usa aviso do sistema; a VPN não.

**Impacto esperado:** Três avisos, um por perfil: conectou, desconectou e perdeu a conexão. A perda sai na hora em que o túnel cai, e a volta avisa de novo quando reconecta. Sair do North desliga os túneis em silêncio. O interruptor em Configurações vale para os três avisos e começa ligado. O menu da bandeja e o indicador na janela continuam como estão. Falha ao ligar pela bandeja, que já mostra "VPN não conectou", não ganha um segundo aviso.

**Notas técnicas:** `Notification` do Electron já existe no main: saúde da conexão (`connection-health.ts`), falha ao conectar pela bandeja (`tray.ts`) e o aviso da primeira ida à bandeja. O estado da VPN sai do `VpnManager` (`setStatus` / `handleDrop`) e o `emit` já redesenha a bandeja. Conectou é `connected`, inclusive depois de uma reconexão. Desconectou é o `disconnect` pedido (botão, bandeja ou ociosidade) chegando em `disconnected`. Perda é a queda inesperada (`onDrop`), avisada ao entrar em `reconnecting`; esgotar as tentativas e ir a `error` não gera um segundo aviso de perda. `before-quit` / `isQuitting()` abafa o aviso. A preferência fica no processo principal, no padrão de `app:get-launch-at-login` / `app:set-launch-at-login`, porque o aviso sai no main e não lê a store do renderer. O interruptor entra em Configurações, nos 3 locales. Não há segredo no texto. Os avisos atuais do main estão fixos em português; estes entram nos 3 locales, então o main precisa do idioma ativo.

**Decisões (2026-11-04):**

- A perda avisa na hora, ao entrar em `reconnecting`. Quando o túnel volta a `connected`, avisa que conectou.
- Sair do North não avisa o desligamento dos túneis.
- Interruptor em Configurações, nascendo ligado. Desligado, os três avisos ficam em silêncio.

**Questões em aberto:** nenhuma.

### IDEIA-013 — Indicador de VPN ativa no ícone da bandeja

- **Status:** 🚀 Promovida → [REC-013](./recursos/rec-013-indicador-vpn-icone-bandeja/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** VPN

**Descrição:** Com pelo menos uma VPN conectada, o ícone do North na bandeja (Windows e Linux) ou na barra de menus (macOS) ganha uma elipse verde pequena no canto. Sem túnel no ar, o ícone volta a ser só o N. Continua um ícone só: a elipse faz parte dele, não é um segundo ícone ao lado.

**Motivação:** O estado “VPN no ar” hoje aparece no menu do ícone, no texto ao passar o mouse e no indicador da janela. Com a janela escondida, a pessoa precisa abrir o menu para saber se o túnel segue ativo.

**Impacto esperado:** Uma elipse verde no canto do N enquanto alguma VPN está `connected`. Várias VPNs no ar continuam sendo uma elipse só; os nomes seguem no texto ao passar o mouse. Conectando, reconectando, erro ou desligada, o ícone fica sem a elipse. O ponto verde, âmbar ou cinza de cada item do menu não muda.

**Notas técnicas:** `createTray` já redesenha o menu em todo `onVpnChange`. O desenho entra aí, com `tray.setImage`. O verde é o mesmo sinal de “no ar” do ponto do menu (`dot-on`) e do `VpnDot` da janela (`bg-emerald-500`). No macOS o N idle é imagem template, tingida pelo sistema: a variante com elipse não pode ser template, senão o verde vira preto ou branco. Sem VPN conectada, o template volta. No Windows e no Linux o ícone já é colorido (`tray.png`); a elipse entra no canto. Não há IPC, segredo nem ADR.

**Por que a elipse, e não o cadeado branco:** o N da bandeja tem cerca de 16px. Um cadeado branco nesse canto compete com o desenho e some na barra clara. O cadeado também não é o sinal de “túnel no ar” do North: na janela, o escudo aparece quando não há VPN ativa, e o ponto verde aparece quando há. A elipse repete esse ponto.

**Decisões (2026-11-04):**

- Elipse verde no canto do ícone, só enquanto alguma VPN está conectada.
- Um ícone só. Não um segundo ícone na bandeja.

**Questões em aberto:** nenhuma.

### IDEIA-014 — Editar arquivo remoto e enviar ao salvar

- **Status:** 🚀 Promovida → [REC-014](./recursos/rec-014-editar-arquivo-remoto/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** 🧠 High
- **Registrada em:** 2026-11-04
- **Área:** sessões/sftp

**Descrição:** No painel de arquivos remoto, um arquivo pode ser editado no editor do North ou num editor de texto instalado no computador. O North baixa o arquivo para uma pasta temporária, abre o editor escolhido e, ao salvar, envia a cópia de volta, substituindo o arquivo no servidor. Pastas e binários ficam de fora. Fechar a conexão apaga a cópia temporária.

**Motivação:** Hoje **Abrir** no painel remoto só baixa o arquivo para a pasta local. Para corrigir um config ou um script no servidor, a pessoa edita fora do North e envia de novo na mão. No WinSCP, salvar no editor já devolve o arquivo.

**Impacto esperado:** No menu do arquivo remoto, **Editar** abre o editor interno e **Editar com…** abre um editor cadastrado. Salvar devolve o arquivo ao servidor, mesmo se o original mudou lá no meio: a cópia local ganha. Em Configurações, a pessoa registra os editores instalados (nome e executável). Vale no painel SFTP e no FTP, que já baixam e enviam. Fechar a sessão apaga o temporário e acaba o envio automático. A pasta local e o duplo clique que só baixa continuam como estão.

**Notas técnicas:** `fs:download` e `fs:upload` já existem no SFTP (`sftp-driver.ts`, `fastGet` / `fastPut`) e no FTP (`ftp-driver.ts`). O ciclo novo fica no main: gravar em pasta temporária, abrir o editor e observar a cópia. O editor interno reusa o CodeMirror já usado em SQL e JSON; o salvar chama o upload. O editor externo é um executável cadastrado, aberto com lista de argumentos, sem passar o nome do arquivo remoto pelo shell. A observação vê a data e o tamanho da cópia, com uma espera curta, porque alguns editores gravam com outro nome e trocam o arquivo. Binário é o que um editor de texto não abre; pasta é o tipo da listagem. Fechar a sessão não segura a conexão: apaga o temporário. O conteúdo do arquivo não vai para log nem para o renderer como segredo de vault. Não há ADR.

**Decisões (2026-11-04):**

- Mesma abordagem do WinSCP ao fechar: a conexão não fica aberta por causa do editor. Fechar a sessão apaga o arquivo temporário e o envio automático acaba.
- Vale para qualquer arquivo que um editor de texto abre. Pastas e binários ficam de fora.
- O envio substitui o arquivo no servidor. Se o original mudou no meio tempo, a cópia local ganha.

**Questões em aberto:** nenhuma.

### IDEIA-015 — Caminho clicável no painel de arquivos

- **Status:** 🚀 Promovida → [REC-015](./recursos/rec-015-caminho-clicavel-painel-arquivos/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** sessões/sftp

**Descrição:** A barra que mostra a pasta atual no painel de arquivos vira um caminho clicável, como no WinSCP. Em `/var/www/html`, clicar em `www` abre `/var/www`. Cada trecho anterior leva à pasta daquele ponto. O trecho final é a pasta atual.

**Motivação:** Hoje a barra é um campo de texto. Para voltar a uma pasta do meio do caminho é preciso apagar o resto e confirmar, ou subir um nível de cada vez. No WinSCP, o trecho do caminho já é o atalho.

**Impacto esperado:** No painel remoto e no painel local, clicar num trecho lista aquela pasta. Digitar um caminho e confirmar com Enter continua valendo, assim como subir um nível e ir para a pasta inicial. No espelho da pasta do terminal, a barra segue só leitura: o caminho não navega.

**Notas técnicas:** A barra é o `input` de `FilePane` (`src/renderer/src/features/sessions/file-browser/FilePane.tsx`). `changePath` já lista a pasta nova. `paths.ts` separa raiz POSIX (`/`) e raiz Windows (`C:\`). O componente corta o caminho nesses separadores e cada trecho chama `changePath` com o prefixo até ali. Não há IPC, sessão nova nem ADR. Rótulos novos nos 3 locales. O modo `mirror` já bloqueia navegação e permanece assim.

**Decisões (2026-11-04):**

- Clicar num trecho abre essa pasta. O exemplo é `/var/www/html` → clique em `www` → `/var/www`.
- Vale nos dois lados do navegador de arquivos. O espelho da pasta do terminal não navega.

**Questões em aberto:** nenhuma.

### IDEIA-016 — Diretórios favoritos no painel de arquivos

- **Status:** 🚀 Promovida → [REC-016](./recursos/rec-016-diretorios-favoritos-painel-arquivos/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** sessões/sftp

**Descrição:** No painel remoto, a pessoa salva diretórios favoritos da conexão que está aberta e volta a qualquer um com um clique. O favorito guarda o caminho (por exemplo `/var/www/html` ou `/etc/apache2/sites-enabled`). Adicionar inclui o caminho; remover tira da lista. Um clique lista essa pasta. A lista não passa para outra conexão, nem para exportação, nem para outro lugar.

**Motivação:** O diretório inicial da conexão SSH abre uma pasta só, na hora de conectar. Quem alterna entre o site, o log e o config do Apache hoje digita o caminho ou sobe nível a nível. No WinSCP, a pasta salva abre de novo com um clique.

**Impacto esperado:** No painel remoto de SFTP e de FTP, a lista daquela conexão abre a pasta escolhida. Dá para acrescentar e remover. Outra conexão não vê esses caminhos. O painel local, o espelho da pasta do terminal e o diretório inicial da conexão continuam como estão. Se a pasta não existir mais, a navegação avisa e não troca o caminho.

**Notas técnicas:** A troca de pasta já é `changePath` em `FilePane`. O diretório inicial é uma coluna só, `connections.startup_directory` (migration `020`), normalizada por `normalizeStartupDirectory`. Favoritos são outra lista, só da conexão, não esse campo. A gravação fica no banco local ligada à conexão e fica de fora do import/export do inventário e de qualquer sincronização. O caminho segue a mesma validação do diretório inicial. Rótulos novos nos 3 locales. Não há protocolo novo nem ADR.

**Decisões (2026-11-04):**

- A lista é só da conexão ativa. Não há favoritos compartilhados entre conexões.
- Por hora, os diretórios salvos não são compartilhados de nenhuma maneira: nem com outra conexão, nem na exportação, nem em sincronização.

**Questões em aberto:** nenhuma.

### IDEIA-017 — Ações de SFTP no painel da pasta do terminal

- **Status:** 🚀 Promovida → [REC-017](./recursos/rec-017-acoes-sftp-painel-terminal/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** 🧠 High
- **Registrada em:** 2026-11-04
- **Área:** sessões/ssh

**Descrição:** O painel de arquivos ao lado do terminal SSH ganha as ações do painel remoto do SFTP: baixar, enviar, abrir, nova pasta, renomear, excluir, atualizar, gravar o diretório inicial e acompanhar log. Ele também pode entrar em outra pasta, subir e ir para a pasta inicial. Essa navegação escreve `cd` no shell, e só quando o prompt está livre. A lista continua sendo a pasta do terminal: um `cd` digitado no shell também troca o painel.

**Motivação:** O painel já mostra a pasta do shell com a cara do SFTP, mas o menu só tem **Atualizar**. Para baixar, criar ou entrar numa pasta, a pessoa abre outra aba de arquivos ou digita no shell.

**Impacto esperado:** No painel da badge **Arquivos**, as ações do remoto SFTP valem na pasta atual. Entrar numa pasta, subir ou ir para a pasta inicial manda `cd` ao shell, e a lista muda quando o prompt informa a pasta nova. Baixar pede o destino, porque não há painel local ao lado. Enviar usa um seletor de arquivo ou um arraste vindo de fora. O navegador de dois lados, o FTP e o terminal local ficam como estão.

**Notas técnicas:** O painel é `TerminalCwdPanel` com `FilePane` em modo `mirror`, que hoje bloqueia navegação, transferência e alteração. A listagem já abre um SFTP curto no `Client` da sessão (`listRemoteDirectory`), sem escrever no PTY. Criar, renomear, excluir, baixar e enviar repetem esse canal pelo tempo da operação. A navegação não troca a pasta por conta própria: escreve `cd` no shell pelo `terminal.write` já existente, com o caminho entre aspas, só com o prompt livre. Se a linha já tiver texto, espera. A lista só muda no OSC 7 que o prompt já emite. Isso revisa a regra do [REC-010](./recursos/rec-010-arquivos-do-diretorio-atual/especificacao.md) e do [ADR 0020](./adr/0020-listagem-cwd-terminal-ssh.md) de que um clique não escreve no terminal. A [IDEIA-015](#ideia-015--caminho-clicável-no-painel-de-arquivos) deixa este painel só leitura; se os dois existirem, um trecho do caminho aqui também manda `cd`. Log e diretório inicial reusam o que o painel SFTP já faz na conexão salva. Não há protocolo novo.

**Decisões (2026-11-04):**

- As ações do SFTP remoto valem neste painel, na pasta em que o terminal está.
- O painel pode navegar. A navegação reflete no shell com `cd`. A lista segue o que o shell confirmar.
- O `cd` só sai com o prompt livre. Se a linha já tiver texto, a navegação espera, para não montar um comando inválido.

**Questões em aberto:** nenhuma.

### IDEIA-018 — Botão do meio copia ou cola no terminal

- **Status:** 🚀 Promovida → [REC-018](./recursos/rec-018-botao-meio-copia-cola-terminal/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** sessões/ssh

**Descrição:** No terminal, o botão do meio copia o texto selecionado. Sem seleção, cola o que está na área de transferência. O botão direito continua abrindo o menu de contexto.

**Motivação:** No PowerShell e no shell do Linux, o botão direito copia se há seleção e cola se não há. No North esse botão abre o menu (copiar, colar, cortar, selecionar tudo e as ações de SSH). O botão do meio não faz nada no app.

**Impacto esperado:** Com texto selecionado, o botão do meio copia e tira a seleção, como o **Copiar** do menu. Sem seleção, cola, inclusive imagem, que já vira caminho. Vale em todo terminal que usa essa tela: SSH, shell local e os demais. O menu do botão direito, o clique que move o cursor e a seleção de palavra com o botão direito ficam como estão.

**Notas técnicas:** Copiar e colar já são `copyTerminalSelection` e `pasteClipboardIntoTerminal`, usados pelo `TerminalContextMenu`. O clique do meio entra em `attachTerminalInteraction`, no `auxclick` com `button === 1`, e chama um ou outro conforme `term.hasSelection()`. O `preventDefault` segura a rolagem automática do Chromium e, no Linux, o atalho do xterm que só reposiciona a área de texto para a seleção primária. O clique para mover o cursor já ignora qualquer botão que não seja o esquerdo. Não há IPC novo nem ADR. A [IDEIA-019](#ideia-019--inverter-botões-do-meio-e-direito-no-shell) troca este papel com o botão direito, por um interruptor que nasce desligado.

**Decisões (2026-11-04):**

- Seleção copia. Sem seleção, cola. O botão direito permanece o menu.

**Questões em aberto:** nenhuma.

### IDEIA-019 — Inverter botões do meio e direito no shell

- **Status:** 🚀 Promovida → [REC-019](./recursos/rec-019-inverter-botoes-meio-direito/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** sessões/ssh
- **Depende de:** [IDEIA-018](#ideia-018--botão-do-meio-copia-ou-cola-no-terminal) ([REC-018](./recursos/rec-018-botao-meio-copia-cola-terminal/especificacao.md), concluído)

**Descrição:** Em Configurações, um interruptor troca as funções do botão do meio e do botão direito nos shells. Desligado, vale a IDEIA-018: o meio copia ou cola, o direito abre o menu. Ligado, o direito copia ou cola e o meio abre o menu.

**Motivação:** Quem vem do PowerShell ou do shell do Linux espera o botão direito para copiar e colar. A IDEIA-018 coloca isso no botão do meio para não tirar o menu. O interruptor devolve o gesto antigo a quem preferir.

**Impacto esperado:** O interruptor fica na seção de terminal em Configurações e nasce desligado. Ligado, nos shells, o direito copia a seleção ou cola se não houver seleção, e o meio abre o mesmo menu de hoje. Fora do terminal, os botões não mudam. A preferência permanece neste computador.

**Notas técnicas:** A preferência cabe na store `north-ui`, como `terminalCopyOnSelect`, porque os dois cliques são do renderer. O `TerminalContextMenu` escuta o `contextmenu` do botão direito. Com o interruptor ligado, esse evento deixa de abrir o menu e passa a chamar o copiar ou colar da IDEIA-018. O menu abre no `auxclick` do botão do meio. `rightClickSelectsWord` fica desligado nesse modo: se o direito selecionasse a palavra antes, o copiar dispararia no lugar de colar. Rótulos nos 3 locales. Não há IPC novo nem ADR.

**Decisões (2026-11-04):**

- Depende da IDEIA-018. O interruptor nasce desligado.
- Vale só nos shells. O resto do app não troca os botões.

**Questões em aberto:** nenhuma.

### IDEIA-020 — Seleção de fontes da aplicação

- **Status:** 🚀 Promovida → [REC-020](./recursos/rec-020-selecao-fontes-aplicacao/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** 🧠 High
- **Registrada em:** 2026-11-04
- **Área:** UI

**Descrição:** A interface do North ganha uma família própria, separada da fonte mono dos shells e dos terminais. A lista da aplicação é a do print: Inter (padrão), Segoe UI, Roboto, Open Sans, Outfit, Montserrat, Ubuntu, o padrão do sistema (SF Pro / Segoe UI), JetBrains Mono e Fira Code. As duas mono entram para quem quiser a interface monoespaçada. Terminal, shell, editores de código e o quadro de log continuam na fonte mono de hoje, com o tamanho e as ligaturas que já existem.

**Motivação:** Hoje a fonte escolhida em Configurações vale para o app inteiro, e ela é sempre mono. Quem quer uma interface proporcional não tem opção. O print mostra esse seletor: a janela, os menus, os formulários, as tabelas, os modais e os widgets flutuantes seguem a família da aplicação, e o terminal fica de fora.

**Impacto esperado:** A família da aplicação entra como mais uma lista na seção de Configurações que já escolhe a fonte mono, no mesmo tipo de seletor. O padrão é Inter. O tamanho continua o de hoje: o controle de tamanho escala a interface inteira, e a família nova acompanha esse tamanho. Trocar a família da aplicação não muda o terminal. Hosts, portas, atalhos e o que já usa a classe mono continuam mono. A frase de exemplo do print ("Gruppe Desktop…") não entra: é de outro produto.

**Notas técnicas:** `useCodeFontEffect` hoje grava a mesma pilha mono em `--font-sans`, `--font-display`, `--font-mono` e `--code-font-family`, e o tamanho mono escala o `font-size` da raiz. Esse escalonamento da raiz permanece: a família da aplicação não ganha tamanho próprio. O token em `assets/index.css` ainda declara IBM Plex Sans, mas o efeito cobre isso. A família nova publica só `--font-sans` e `--font-display`. `--font-mono` e `--code-font-family` ficam na preferência mono atual (`monoFontFamily`). SQL Studio e API Studio leem `--font-sans` no tema do CodeMirror; passam a ler a pilha mono, senão o editor acompanha a interface. O interruptor de ligaturas sai da raiz e fica nas superfícies de código: numa Inter, ligadura de código não deve alterar o texto da janela. Inter, Roboto, Open Sans, Outfit, Montserrat e Ubuntu (a proporcional, não a Ubuntu Mono) entram por pacote local, sem CDN, no padrão do REC-007. JetBrains Mono e Fira Code já estão no app. Segoe UI e SF Pro não se embutem: são fontes do sistema, com fallback. IBM Plex Sans já está empacotada e não está no print, então sai da lista da aplicação. A mono IBM Plex Mono continua no seletor do terminal. Não há IPC, segredo nem ADR. `docs/05-design-system.md` diz que a interface inteira usa a mono; isso muda quando a ideia for promovida.

**Decisões (2026-11-04):**

- Duas preferências. A da aplicação não altera shell, terminal, editor de código nem quadro de log.
- A lista da aplicação é a do print, nesta ordem: Inter, Segoe UI, Roboto, Open Sans, Outfit, Montserrat, Ubuntu, padrão do sistema, JetBrains Mono, Fira Code.
- Inter é o padrão da lista. Não há botão separado de restaurar.
- O tamanho da interface continua o de hoje: o controle existente escala a raiz, e a família da aplicação acompanha.
- O seletor é uma lista na seção de Configurações que já existe, no mesmo padrão da fonte mono. Não é a grade de cartões do print.
- O catálogo mono do REC-007 permanece só no seletor do terminal. Na aplicação, as mono são JetBrains Mono e Fira Code.

**Questões em aberto:** nenhuma.

### IDEIA-021 — Problemas conhecidos no manual

- **Status:** 🚀 Promovida → [REC-021](./recursos/rec-021-problemas-conhecidos-manual/especificacao.md)
- **Prioridade:** Média
- **Esforço do agente:** ⚡ Low
- **Registrada em:** 2026-11-04
- **Área:** UI

**Descrição:** O manual do North ganha um capítulo de problemas conhecidos. Cada registro descreve um sintoma que aparece com o North em uso e o que a pessoa faz na máquina dela. O North não executa a correção, não grava configuração e não altera o programa citado. No topo de cada registro, um aviso visual deixa isso explícito.

**Motivação:** Com a VPN do North no ar, um `git push` por HTTPS devolve `HTTP 408` quando o pack passa de cerca de 1 KB. Um arquivo de uma palavra sobe. O túnel entrega o tráfego. O que falta é o `git` deixar o HTTP/2 e não esperar `100 Continue`. Quem opera não tem onde ler isso dentro do app. O capítulo de VPNs só fala de falha ao conectar.

**Impacto esperado:** Um capítulo novo no manual, nos 3 idiomas, listado com os demais. O de VPNs, em "Quando algo dá errado", aponta para ele. O primeiro registro é o push abaixo. Os próximos entram como seções no mesmo capítulo. A linha do what's new da versão avisa que o manual passou a reunir esses casos.

**Primeiro registro — `git push` com HTTP 408**

No topo do registro, antes do sintoma e dos comandos, o aviso visual:

> **Só orientação.** O North não aplica esta correção. Os comandos rodam no ambiente em que o `git` está, não no app.

Sintoma: com a VPN ligada, `git push` por HTTPS termina em `RPC failed; HTTP 408` e `unexpected disconnect while reading sideband packet`. Um pack de algumas centenas de bytes passa. Um pack acima de cerca de 1 KB não.

O que fazer, no ambiente em que o `git` roda (no Windows com IPsec, a distro WSL de trabalho):

```bash
git config --global http.version HTTP/1.1
git config --global http.extraHeader "Expect:"
```

Sem `--global`, as duas opções valem só para aquele repositório. `HTTP/1.1` tira o push do HTTP/2. O `Expect` vazio impede a espera do `100 Continue`, que o curl envia quando o corpo passa de 1024 bytes.

**Notas técnicas:** Capítulo `troubleshooting` em `src/renderer/src/content/manual/` (pt-BR, en, es), entrada em `MANUAL_CHAPTER_IDS` e título em `help.chapters.troubleshooting` nos 3 locales. O corpo continua markdown. O aviso não é um parágrafo comum: o renderer do manual (`ManualPage`) reconhece um marcador do registro e desenha uma faixa, com ícone e o texto traduzido, no alto da seção. A faixa não é um botão e não dispara comando. Cruzamento de um parágrafo em `vpns.md`, nos 3 idiomas. What's new na versão em que o capítulo entrar. Sem IPC, sem preferência, sem ADR.

**Decisões (2026-11-04):**

- O aviso visual nasce em todo registro do capítulo, não só no primeiro. O texto diz que o North apenas orienta.
- O primeiro registro é o `git push` com HTTP 408, com os dois `git config` acima.
- O North não aplica `git config`, nem neste repositório nem com `--global`.

**Questões em aberto:** nenhuma.
