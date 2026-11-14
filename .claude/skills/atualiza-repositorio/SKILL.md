---
name: atualiza-repositorio
description: >
  Identifica as branches locais com commits à frente do remoto (ou sem upstream) e faz o push
  delas; nunca envia tags v*, porque disparam o build de release (só a preparar-release envia).
  Use quando o usuário pede para atualizar o remoto, fazer push de tudo ou sincronizar branches.
---

<!-- GERADO por scripts/harness/sync.mjs a partir de .agents/skills/atualiza-repositorio/SKILL.md. Não edite: altere a fonte e rode `npm run harness:sync`. -->

# Atualiza Repositório

## Passo 1 — Estado

```bash
git rev-parse --abbrev-ref HEAD
git status --short
git fetch --prune
git for-each-ref --format="%(refname:short) %(upstream:short) %(upstream:track)" refs/heads/
```

Alterações não commitadas: avisar (não bloqueiam o push, mas o usuário pode querer commitar antes).

## Passo 2 — Mapear pendências

- **Ahead:** branches com `[ahead N]`. Pular `main` e `develop`, salvo no fluxo de release (skill `preparar-release`); elas recebem mudanças via PR.
- **Sem upstream:** branches locais sem remoto correspondente. Perguntar quais publicar (podem ser experimentos locais).
- **Divergentes** (`[ahead N, behind M]`): **não** fazer push. Explicar e sugerir `git pull --rebase` ou merge, a decidir pelo usuário.
- **Tags locais que não existem no remoto:** comparar `git tag` com `git ls-remote --tags origin` e só **avisar**. Esta skill nunca envia tag `v*`; só a `preparar-release` envia a tag da versão atual.

## Passo 3 — Plano

Mostrar o plano (branch → destino, quantidade de commits, tags). Push direto em `main`/`develop` só no fluxo de release. Tags `v*` órfãs aparecem só como aviso: **cada uma dispararia o workflow de Release**.

## Passo 4 — Executar

```bash
git push origin <branch>          # com upstream
git push -u origin <branch>       # sem upstream
```

Nunca usar `--force`, `--force-with-lease` ou `--tags` sem pedido explícito. Não trocar de branch durante o processo.

## Passo 5 — Resumo

```
🚀 Remoto atualizado
- develop → origin/develop (3 commits)
- feature/socks-tunnel → origin/feature/socks-tunnel (nova, upstream configurado)
- ⚠️ feature/rdp-resize divergente — não enviada
- Tags: nenhuma pendente
- Branch ativa: develop
```

## Exemplo de uso

> "/atualiza-repositorio" — ou — "faz push de tudo"
