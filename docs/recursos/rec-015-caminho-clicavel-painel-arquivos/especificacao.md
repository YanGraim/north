# REC-015 — Caminho clicável no painel de arquivos

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-015
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

No espelho da pasta do terminal, o [REC-017](../rec-017-acoes-sftp-painel-terminal/especificacao.md) faz o trecho do caminho pedir `cd`. No navegador de dois lados, o clique continua só listando a pasta. Os critérios abaixo descrevem o que foi homologado neste recurso.

## Visão geral

A barra de caminho do navegador de arquivos mostra a pasta atual em trechos clicáveis, no estilo do WinSCP. Em `/var/www/html`, clicar em `www` lista `/var/www`. Cada trecho anterior abre a pasta daquele ponto. O trecho final é a pasta que o painel já lista.

Vale no painel local e no painel remoto de SFTP e de FTP. Digitar um caminho e confirmar com Enter continua valendo, assim como subir um nível e ir para a pasta inicial. O espelho da pasta do terminal permanece só leitura.

## Decisões

Herdadas da IDEIA-015:

- Clicar num trecho abre essa pasta. O exemplo é `/var/www/html` → clique em `www` → `/var/www`.
- Vale nos dois lados do navegador de arquivos. O espelho da pasta do terminal não navega.

Fechadas na spec:

- A barra nasce em trechos, no lugar do campo de texto. Cada trecho anterior e a raiz são botões. O clique chama `changePath` com o prefixo até ali. O trecho final é a pasta atual: aparece, e o clique nele abre o campo de texto em vez de listar de novo.
- A área vazia à direita dos trechos também abre o campo. Enter confirma o texto e lista essa pasta. Escape, ou o campo perder o foco sem Enter, volta aos trechos da pasta que o painel já lista. É o mesmo campo de hoje.
- A raiz é um trecho. Em POSIX, `/var/www` tem `/` (`/`), `var` (`/var`) e `www` (atual). No Windows local, `C:\Users\yan` tem `C:\` (`C:\`), `Users` (`C:\Users`) e `yan` (atual). Barra no fim não cria trecho vazio. A raiz sozinha (`/` ou `C:\`) é só o trecho atual.
- Caminho longo rola na horizontal dentro da barra. Não quebra linha nem empurra a lista.
- Se a pasta não abrir, vale o aviso que a listagem já mostra. Não há diálogo novo.
- O modo `mirror` mantém o campo somente leitura, sem botões. Subir, home e o seletor de unidade continuam desabilitados lá, como hoje.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | No painel local e no remoto, a barra mostra cada pasta do caminho. Clicar num trecho anterior lista essa pasta. | Alta |
| RF-02 | O trecho final é a pasta atual e não dispara outra listagem. Clicar nele, ou na área vazia da barra, abre o campo de texto. | Alta |
| RF-03 | Enter no campo lista o caminho digitado. Escape ou blur devolve os trechos da pasta já listada. | Alta |
| RF-04 | Subir um nível, ir para a pasta inicial, trocar de unidade no Windows e entrar numa pasta da lista continuam como hoje. | Alta |
| RF-05 | No espelho da pasta do terminal, a barra segue só leitura e nenhum trecho navega. | Alta |
| RF-06 | Rótulos novos dos trechos e do campo em pt-BR, en e es. | Alta |

## Requisitos técnicos

- **Renderer:** `FilePane` troca o `input` visível por uma faixa de botões quando não está em modo edição e `mirror` é falso. O campo atual permanece para digitar. `changePath` não muda.
- **Shared / puro:** `pathSegments(path, sep)` em `paths.ts`. Devolve `{ label, path }[]` do primeiro ao último. POSIX separa em `/` e preserva a raiz `/`. Windows local separa em `\` e preserva a raiz `C:\` (a barra da unidade fica no rótulo da raiz). Sem IPC, sem sessão nova, sem schema.
- **Main / preload:** nada.
- **Dados:** nada. Sem migration e sem impacto em import/export.
- **Segurança:** o clique só pede a listagem que o painel já faz. Nenhum caminho novo sai do renderer para além de `changePath`.

## Interface / UX

A barra fica no mesmo lugar do campo de hoje, entre os botões da barra e a lista. Trechos em fonte mono, separados por um chevron. O trecho atual usa a cor de texto; os anteriores usam a cor de ação. Foco visível no botão.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Botão do trecho | Abrir {caminho} | Open {path} | Abrir {ruta} |
| Campo, ao editar | Caminho | Path | Ruta |

O nome acessível do trecho atual, que só abre o campo, é o rótulo do campo (`Caminho` / `Path` / `Ruta`).

## Critérios de aceite

- [x] Em `/var/www/html` no painel remoto, clicar em `www` lista `/var/www`. Clicar em `/` lista `/`.
- [x] No painel local do Windows, `C:\Users\yan` tem o trecho `C:\`, e clicar em `Users` lista `C:\Users`.
- [x] O trecho final não lista de novo. Clicar nele abre o campo; Enter em `/etc` lista `/etc`; Escape volta aos trechos da pasta anterior à confirmação.
- [x] Subir um nível e ir para a pasta inicial continuam listando a pasta esperada.
- [x] No espelho da pasta do terminal, a barra não tem botão de trecho e não muda a pasta.
- [x] Rótulos em pt-BR, en e es.
- [x] Vitest cobre `pathSegments` para POSIX, Windows, raiz sozinha e barra final.

## Fora de escopo

- O espelho da pasta do terminal passar a navegar, inclusive com `cd` no shell (IDEIA-017).
- Diretórios favoritos (IDEIA-016).
- Histórico de pastas visitadas ou menu suspenso de subpastas no trecho.
- Traduzir os rótulos que o painel já tinha antes deste recurso (Pasta superior, Atualizar, Nova pasta).

## Documentação de produto

- Manual: extensão do capítulo `connect`, seção **Arquivos (SFTP/FTP)**, nos 3 locales. Escrita em 2026-11-04.
- What's new: fica para o bump da próxima versão. O app está em `0.1.47`, e o diálogo só mostra notas até a versão do app.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste de código.

Nos painéis local e remoto, a barra mostra cada pasta do caminho. Clicar num trecho anterior lista essa pasta. O trecho final abre o campo; Enter confirma e Esc volta aos trechos da pasta que já estava aberta. Subir um nível e ir para a pasta inicial continuam como antes. No espelho da pasta do terminal, a barra segue só leitura.

`pathSegments` separa POSIX e a raiz Windows `C:\`. Um caminho UNC fica num trecho só. O what's new espera a próxima versão.

Arquivos principais: `src/renderer/src/features/sessions/file-browser/paths.ts`, `src/renderer/src/features/sessions/file-browser/FilePane.tsx`.
