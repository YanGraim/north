# Plano — REC-021 Problemas conhecidos no manual

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Homologação:** roteiro em `testes.md`. What's new fica para o bump da próxima versão.
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `troubleshooting.md` nos 3 locales, `MANUAL_CHAPTER_IDS` e chaves `help.chapters` / `help.knownIssues` | renderer | ✅ |
| 2 | Faixa no `ManualMarkdown` para o blockquote `guidance`; `href` de capítulo troca de página | renderer | ✅ |
| 3 | Parágrafo em `vpns.md` nos 3 locales | renderer | ✅ |
| 4 | Vitest: capítulo registrado, marcador e os dois `git config` nos 3 corpos | test | ✅ |
| 5 | What's new no bump da próxima versão (texto já na spec) | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/renderer/src/content/manual/index.ts`
- `src/renderer/src/content/manual/{pt-BR,en,es}/troubleshooting.md`
- `src/renderer/src/content/manual/{pt-BR,en,es}/vpns.md`
- `src/renderer/src/features/help/ManualPage.tsx`
- `src/renderer/src/i18n/locales/pt-BR.json`, `en.json`, `es.json`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| O token `guidance` vazar como citação | A pessoa lê o marcador | O componente só troca o blockquote cujo texto inteiro é esse token |
| A faixa parecer uma ação | A pessoa acha que o North aplicou o `git config` | `role="note"`, sem botão e sem `onClick`; o título diz que é só orientação |
| O link de VPNs abrir janela em branco | O cruzamento não funciona | `href` igual a um id de capítulo chama `goTo`; o restante continua externo |
| O corpo da faixa citar `git` num registro futuro | Texto errado | A spec manda trocar a chave quando o registro não for comando no ambiente do `git` |

## Notas de implementação

Sem IPC, sem preferência e sem ADR. O corpo do manual continua markdown. A faixa não é um parágrafo do markdown: o renderer reconhece o marcador e desenha o aviso com texto do i18n. Um `href` que é id de capítulo vira `Link` do React Router (`?chapter=`), então o clique troca de capítulo no hash do app e no harness. Link externo segue com `target="_blank"`.
