---
name: resolve-conflitos
description: >
  Resolve conflitos de merge/rebase passo a passo: levantamento completo, resolução arquivo a
  arquivo com confirmação e stage individual, e encerramento sem commit automático. Inclui
  tratamento específico de package-lock.json, migrations e whats-new/index.ts do North.
  Use quando o usuário pede ajuda com conflitos de merge ou rebase.
---

<!-- GERADO por scripts/harness/sync.mjs a partir de .agents/skills/resolve-conflitos/SKILL.md. Não edite: altere a fonte e rode `npm run harness:sync`. -->

# Resolve Conflitos

Não pular etapas nem resolver tudo de uma vez.

## Fase 1 — Levantamento

1. `git status` e `git diff --name-only --diff-filter=U`. Identificar se é merge, rebase ou cherry-pick (`.git/MERGE_HEAD`, `.git/rebase-merge/`). Num rebase, "ours" e "theirs" ficam invertidos: dizer isso ao usuário.
2. Para cada arquivo: trechos em conflito, o que cada lado pretende (`git log --oneline -3 <lado> -- <arquivo>` ajuda) e por que conflitou.
3. Apresentar a lista e **parar** até o usuário confirmar.

## Fase 2 — Arquivo a arquivo

Para cada arquivo, um por vez:

1. Motivo técnico do conflito.
2. Resolução proposta (manter, mesclar ou descartar) e por quê. Se houver mais de uma opção razoável, apresentar antes de aplicar.
3. Aplicar e remover os marcadores.
4. Mostrar `git diff <arquivo>`.
5. Aguardar confirmação explícita.
6. `git add <arquivo>` e conferir com `git status`.

### Casos específicos do North

- **`package-lock.json`:** não editar à mão. Resolver o `package.json`, depois `git checkout --theirs package-lock.json` (ou `--ours`, conforme a base) e `npm install` para regenerar; mostrar o diff resultante.
- **`src/renderer/src/content/whats-new/index.ts`:** manter os imports e as entradas dos dois lados, com as entradas em ordem crescente de versão.
- **Migrations em `src/main/database/migrations`:** dois lados criando a mesma numeração é conflito **lógico**, mesmo sem marcadores. Sinalizar e pedir decisão (renumerar a do branch que ainda não foi lançado).
- **Arquivos gerados do harness** (`.cursor/rules/*.mdc`, `.claude/**`, `.agents/workflows/**`): resolver só a fonte (`AGENTS.md`, `.agents/rules`, `.agents/skills`) e rodar `npm run harness:sync`.
- **Lógica de negócio ambígua** (protocolos, vault, VPN): não escolher sozinho; perguntar.

## Fase 3 — Encerramento

1. `git diff --check` e uma busca por `<<<<<<<|>>>>>>>` no repositório (sem `node_modules`).
2. Sugerir `npm run lint && npm run typecheck && npm run test`.
3. `git status` + resumo das resoluções.
4. Perguntar se pode concluir (`git commit` no merge / `git rebase --continue`). **Nunca** commitar sem autorização; se o usuário não quiser, deixar tudo staged.

## Exemplo de uso

> "/resolve-conflitos" — ou — "deu conflito no merge da develop, me ajuda"
