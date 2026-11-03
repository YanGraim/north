---
name: auditoria-docs
description: >
  Auditoria cruzada de integridade da documentação e do harness do North: ideias ↔ recursos,
  índice ↔ diretórios, fase de testes, bugs, ADRs, manual in-app e what's new nos 3 idiomas,
  e sincronização do harness. Reporta inconsistências sem alterar nada até o usuário confirmar.
  Use quando o usuário pede para auditar/verificar a consistência dos docs, ou antes de uma release.
---

# Auditoria de Documentação

Somente leitura até o usuário aprovar correções.

## Verificações

### V1 — Ideias ↔ Recursos
- Toda ideia `🚀 Promovida` em `docs/ideias.md` tem `REC-XXX` na coluna Recurso, e esse REC existe em `docs/recursos/README.md`.
- Todo recurso do índice aponta para uma ideia existente (campo "Ideia de origem" da spec), quando houver.

### V2 — Índice ↔ Diretórios
- Todo diretório `docs/recursos/rec-xxx-*/` (exceto `_backup/`) está no índice, e vice-versa.
- Nome do diretório segue `rec-<3 dígitos>-<kebab-case>`; IDs não se repetem.
- O status no índice é igual ao `Status` de `especificacao.md`.

### V3 — Fase de testes
- Recurso `🧪 Em testes` ou `✅ Concluído` tem `testes.md`.
- Recurso `✅ Concluído` tem `testes.md` com `✅ Homologado` e seção **Resultado final** na spec.
- Recurso `🔄 Em desenvolvimento` sem commits há mais de 30 dias (`git log -1 --format=%cs -- <arquivos-chave>`) → informativo: candidato a congelar.

### V4 — Correções
- Todo `BUG-XXX` da tabela de `docs/correcoes.md` tem seção detalhada, e vice-versa.
- `✅ Corrigido` tem Causa raiz, Solução e data preenchidas.

### V5 — ADRs
- Todo arquivo em `docs/adr/` tem `Status` e `Data`; numeração sem buracos nem duplicatas.
- Todo link para ADR em specs, roadmap e README resolve para um arquivo existente.
- ADR `Proposto` há mais de 30 dias → informativo.

### V6 — Manual e what's new
- Todo diretório em `src/renderer/src/content/whats-new/<versão>/` tem `pt-BR.md`, `en.md` e `es.md` e está registrado em `whats-new/index.ts` (imports + entrada em `WHATS_NEW_ENTRIES`, em ordem crescente de versão).
- Todo `chapter` usado no what's new existe no manual.
- Todo capítulo do manual existe nos 3 locales (`src/renderer/src/content/manual/{pt-BR,en,es}/`).
- Recurso `✅ Concluído` com mudança visível tem capítulo/menção no manual ou justificativa de omissão na spec.

### V7 — Harness
- `npm run harness:check` passa (gerados em `.cursor/rules`, `.claude/`, `.agents/workflows` iguais à fonte).
- Toda skill em `.agents/skills/` tem `name` igual ao nome do diretório e uma `description`.
- Toda skill está listada na tabela "Skills disponíveis" do `AGENTS.md`.

## Relatório

```markdown
### 🔍 Auditoria de documentação — YYYY-MM-DD

#### ✅ Sem inconsistências
- V1, V4, ...

#### ⚠️ Inconsistências
##### V2 — Índice ↔ Diretórios
| Item | Problema | Arquivo |
| --- | --- | --- |
| REC-004 | Status no índice 🔄, spec diz 🧪 | docs/recursos/README.md |

#### 📊 Resumo
- Verificações: 7 · sem inconsistências: X · com inconsistências: Y · itens para ação: Z
```

## Correções

Depois do relatório, perguntar se o usuário quer corrigir.

- **Automáticas (após um "sim"):** sincronizar status entre índice e spec (a spec é a fonte), registrar entradas faltantes no `whats-new/index.ts`, rodar `npm run harness:sync`, adicionar skill faltante na tabela do `AGENTS.md`.
- **Exigem decisão:** criar conteúdo (spec, testes, manual, traduções), mudar status de ADR, congelar recursos, renumerar IDs.

## Exemplo de uso

> "/auditoria-docs" — ou — "confere se a documentação está consistente antes da release"
