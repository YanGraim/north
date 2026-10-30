# Ideias (backlog)

- **Última atualização:** 2026-10-30

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
| IDEIA-002 | Diretório padrão na conexão SSH | 💡 Nova | Média | ⚡ Low | 2026-10-30 | — |
| IDEIA-003 | Indicador e erros amigáveis do componente de VPN | 💡 Nova | Média | ⚡ Low | 2026-10-30 | — |
| IDEIA-004 | Acompanhamento de log na conexão SSH | 💡 Nova | Média | 🧠 High | 2026-10-30 | — |

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

- **Status:** 💡 Nova
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

- **Status:** 💡 Nova
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

- **Status:** 💡 Nova
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
