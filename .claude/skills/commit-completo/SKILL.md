---
name: commit-completo
description: >
  Fluxo completo de commit no North: revisa o que mudou, faz o stage, gera a mensagem no padrão
  Conventional Commits em inglês usado pelo repo, pede confirmação e só então commita (com os
  hooks do husky). Use quando o usuário pede para commitar as mudanças.
---

<!-- GERADO por scripts/harness/sync.mjs a partir de .agents/skills/commit-completo/SKILL.md. Não edite: altere a fonte e rode `npm run harness:sync`. -->

# Commit Completo

Fluxo rápido e procedimental: não precisa de raciocínio profundo.

## Passo 1 — Revisar

- `git status --short` e `git branch --show-current`.
- Se a branch for `main`, avisar e perguntar se é isso mesmo (o trabalho normal acontece em `develop` ou `feature/*`).
- Procurar o que não deve entrar: `.env*`, chaves/certificados, `*.sqlite`, `north-export*.json`, `out/`, `release/`, `test-results/`. Se aparecer, parar e avisar.

## Passo 2 — Stage

- Se o usuário indicou arquivos, `git add <arquivos>`.
- Senão, `git add -A` e mostrar a lista com `git diff --cached --stat`.
- Se as mudanças misturam assuntos independentes (ex.: um fix de VPN + uma feature de SQL), sugerir commits separados.

## Passo 3 — Mensagem

Ler `git diff --cached` e `git log --format=%s -15` para seguir o estilo vigente:

- Título: `type(scope): summary` em inglês, minúsculo, sem ponto final, até ~72 caracteres. O resumo descreve **o que o usuário ganha ou o que deixa de quebrar**, não o mecanismo. Ex.: `fix(vpn): restart a stopped Windows VPN service and show a clear error`.
- `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `chore`, `perf`, `build`.
- `scope`: a área (`vpn`, `ssh`, `files`, `api`, `workspaces`, `server`, `release`, `e2e`, `adr-0018`, `harness`…). Omitir se for transversal.
- Corpo (opcional): o porquê e detalhes não óbvios, linhas de até 100 caracteres.
- Trailers (opcionais): `Refs: REC-004`, `Refs: BUG-012`. Adicionar as linhas de coautoria que a ferramenta exigir.
- Não inventar nada que não esteja no diff.

## Passo 4 — Confirmação obrigatória

Mostrar a mensagem completa e perguntar: **"Posso commitar com essa mensagem?"** Só seguir com um "sim" claro; se pedirem ajuste, refazer e perguntar de novo.

## Passo 5 — Commit

- `git commit -F <arquivo-temporário>` (ou `-m` para título + `-m` para corpo).
- O pre-commit roda `lint-staged` (Biome) e `harness:check`. Se falhar: corrigir a causa e criar o commit de novo. **Nunca** usar `--no-verify` nem `--amend` em commit que não foi criado nesta sessão.
- Mostrar `git log -1 --stat`. Não fazer push (skill `atualiza-repositorio`).

## Exemplo de uso

> "/commit-completo" — ou — "commita isso, é a correção do redimensionamento do RDP"

## Saída esperada

```
fix(rdp): keep the remote desktop sharp after resizing the tab on Windows

The canvas kept the first size and the browser scaled it. Resize now
renegotiates the desktop size with the server.

Refs: BUG-012

Posso commitar com essa mensagem?
```
