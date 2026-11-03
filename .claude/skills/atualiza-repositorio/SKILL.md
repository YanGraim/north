---
name: atualiza-repositorio
description: >
  Identifica as branches locais com commits à frente do remoto (ou sem upstream) e faz o push
  delas após confirmação; trata tags com cuidado, porque tags v* disparam o build de release.
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

- **Ahead:** branches com `[ahead N]`.
- **Sem upstream:** branches locais sem remoto correspondente. Perguntar quais publicar (podem ser experimentos locais).
- **Divergentes** (`[ahead N, behind M]`): **não** fazer push. Explicar e sugerir `git pull --rebase` ou merge, a decidir pelo usuário.
- **Tags locais que não existem no remoto:** comparar `git tag` com `git ls-remote --tags origin`.

## Passo 3 — Confirmar

Mostrar o plano (branch → destino, quantidade de commits, tags) e pedir confirmação. Tags `v*` ganham um aviso próprio: **cada uma dispara o workflow de Release**. Confirmar tag por tag.

## Passo 4 — Executar

```bash
git push origin <branch>          # com upstream
git push -u origin <branch>       # sem upstream
git push origin <tag>             # uma por uma, só as confirmadas
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
