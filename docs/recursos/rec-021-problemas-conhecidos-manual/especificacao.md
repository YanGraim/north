# REC-021 — Problemas conhecidos no manual

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-021
- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **ADRs:** —

## Visão geral

O manual ganha o capítulo **Problemas conhecidos**. Cada registro descreve um sintoma que aparece com o North em uso e o que a pessoa faz na máquina dela. O North não executa a correção, não grava configuração e não altera o programa citado. No topo de cada registro, uma faixa deixa isso explícito. O primeiro registro é o `git push` por HTTPS que devolve HTTP 408 com a VPN ligada.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | O manual lista o capítulo `troubleshooting` depois de VPNs, nos 3 idiomas. | Alta |
| RF-02 | Cada registro do capítulo começa com uma faixa: ícone, título e corpo traduzidos. A faixa não é botão e não dispara comando. | Alta |
| RF-03 | O primeiro registro descreve o `git push` com HTTP 408 e os dois `git config` abaixo. O mesmo texto, traduzido, existe em pt-BR, en e es. | Alta |
| RF-04 | Em VPNs, na seção de falha, um parágrafo aponta para o capítulo novo. O clique troca de capítulo na mesma página. | Alta |
| RF-05 | O North não executa `git config`, nem neste repositório nem com `--global`. | Alta |

Comandos do primeiro registro, iguais nos 3 idiomas:

```bash
git config --global http.version HTTP/1.1
git config --global http.extraHeader "Expect:"
```

O texto do registro também diz: sem `--global`, as duas opções valem só para aquele repositório; `HTTP/1.1` tira o push do HTTP/2; o `Expect` vazio impede a espera do `100 Continue`, que o curl envia quando o corpo passa de 1024 bytes. Sintoma: com a VPN ligada, `git push` por HTTPS termina em `RPC failed; HTTP 408` e `unexpected disconnect while reading sideband packet`. Um pack de algumas centenas de bytes passa. Um pack acima de cerca de 1 KB não. No Windows com IPsec, os comandos rodam na distro WSL de trabalho.

## Requisitos técnicos

- **Main:** nada.
- **IPC:** nenhum canal novo.
- **Renderer:** capítulo em `src/renderer/src/content/manual/{pt-BR,en,es}/troubleshooting.md`, importado em `src/renderer/src/content/manual/index.ts` e incluído em `MANUAL_CHAPTER_IDS` depois de `vpns`. Títulos em `help.chapters.troubleshooting`. A faixa sai de `help.knownIssues.noticeTitle` e `help.knownIssues.noticeBody`.
- **Marcador:** em cada registro, logo após o `##`, um blockquote cujo único texto é o token `guidance` (`> guidance`). O token é o mesmo nos 3 markdowns e não aparece na tela. `ManualMarkdown` trata esse blockquote como a faixa (`role="note"`, ícone Lucide `Info`). Outro blockquote continua citação.
- **Link interno:** `href` que é um `ManualChapterId` (como os já usados em `accesses.md`) chama a troca de capítulo. Link externo segue com `target="_blank"`.
- **Dados:** nenhum. Sem migration, sem preferência, sem import/export.
- **Segurança:** sem segredo, sem superfície de rede, sem execução de comando. A faixa existe para deixar isso visível.

## Interface / UX

Capítulo no sumário do manual, último item. Estado vazio não se aplica: o capítulo já nasce com um registro. Sem atalho novo.

| Superfície | pt-BR | en | es |
| --- | --- | --- | --- |
| Capítulo | Problemas conhecidos | Known issues | Problemas conocidos |
| Registro | `git push` com HTTP 408 | `git push` with HTTP 408 | `git push` con HTTP 408 |
| Faixa, título | Só orientação | Guidance only | Solo orientación |
| Faixa, corpo | O North não aplica esta correção. Os comandos rodam no ambiente em que o git está, não no app. | North does not apply this fix. The commands run in the environment where git is, not in the app. | North no aplica esta corrección. Los comandos se ejecutan en el entorno donde está git, no en la app. |

A mesma faixa vale para todo registro deste capítulo. O corpo cita o `git` porque o único registro é esse. Um registro futuro que não seja comando no ambiente do `git` troca o corpo da chave, em vez de reaproveitar a frase.

## Critérios de aceite

- [x] O sumário mostra **Problemas conhecidos** / **Known issues** / **Problemas conocidos** depois de VPNs, no idioma ativo.
- [x] O registro do `git push` abre com a faixa (ícone, título e corpo). A faixa não é clicável.
- [x] Os dois `git config` aparecem como comando, nos 3 idiomas, com a nota de `--global`, HTTP/1.1 e `Expect`.
- [x] Em VPNs → "Quando algo dá errado" (e o equivalente em en e es), o link abre o capítulo novo sem sair do manual.
- [x] Nenhum código chama `git config` nem grava essas opções.

## Fora de escopo

- Aplicar `git config` pelo North.
- Outros problemas conhecidos além do HTTP 408.
- Mudar as mensagens de falha ao conectar a VPN.
- Preferência, IPC, vault ou schema.

## Documentação de produto

- Manual: capítulo novo `troubleshooting` e um parágrafo em `vpns` — os 3 locales. É o próprio recurso.
- What's new: entra na próxima versão, com CTA para `troubleshooting`. O app está em `0.1.47` e o diálogo só mostra notas até a versão do app. Texto previsto:
  - pt-BR: O manual passa a reunir problemas conhecidos e o que fazer na sua máquina. O North só orienta.
  - en: The manual now collects known issues and what to do on your machine. North only guides you.
  - es: El manual reúne problemas conocidos y qué hacer en tu máquina. North solo orienta.
- Engenharia: `docs/02-arquitetura.md`, `docs/04-modelo-dados.md`, `docs/06-seguranca.md`, `docs/08-protocolos.md` e `docs/07-roadmap.md` não listam os capítulos do manual. Sem ADR.

## Resultado final

Entregue e homologado em 2026-11-04, sem ajuste no capítulo.

O manual ganhou **Problemas conhecidos** depois de VPNs, nos três idiomas. O registro do `git push` com HTTP 408 abre com a faixa **Só orientação**. A faixa não executa comando. Em VPNs, "Quando algo dá errado" aponta para o capítulo e o clique troca de página. O North não grava `git config`.

O what's new espera a próxima versão. Arquivos principais: `src/renderer/src/content/manual/{pt-BR,en,es}/troubleshooting.md`, `src/renderer/src/content/manual/index.ts`, `src/renderer/src/features/help/ManualPage.tsx`, `src/renderer/src/features/help/manual-markdown.ts`.
