---
name: preparar-release
description: >
  Prepara uma release do North: define a versão, faz o bump no package.json, garante o what's new
  nos 3 idiomas registrado em whats-new/index.ts, valida, cria o commit "chore: release X.Y.Z" e,
  com confirmação, cria e envia a tag vX.Y.Z que dispara o workflow de Release (draft no GitHub).
  Use quando o usuário pede para soltar, cortar ou preparar uma versão/release.
---

# Preparar Release

O push da tag `vX.Y.Z` dispara `.github/workflows/release.yml`, que compila DMG, NSIS e AppImage e abre um **draft release**. Esse passo é público e caro: **sempre confirmar antes**.

## Passo 1 — Pré-condições

- `git status --short` limpo (senão, parar e avisar).
- `git branch --show-current`: releases saem da linha principal (`main`/`develop`, hoje sincronizadas). Em outra branch, perguntar antes de seguir.
- `git fetch --tags` e conferir que a branch não está atrás do remoto.

## Passo 2 — Versão

Aplicar a skill `sugerir-versao` e confirmar a versão com o usuário.

## Passo 3 — What's new

Pasta: `src/renderer/src/content/whats-new/<versão>/`.

1. Listar os commits do intervalo `<ultima_tag>..HEAD` e separar o que o **usuário percebe** (regra `product-docs`). Fix interno, refactor, testes, CI e docs de engenharia **não entram**.
2. Se a pasta da versão já existe (às vezes é criada junto da feature), revisar e completar. Se não existe e há mudança visível, criar `pt-BR.md`, `en.md` e `es.md` no formato vigente:

   ```markdown
   ## <Tema principal>

   - **<Item>:** o que mudou para o usuário, em uma ou duas frases
   - **<Item>:** ...

   Veja o capítulo [<Nome>](<chapter-id>) no manual.
   ```

   Os três arquivos dizem a mesma coisa; os títulos de capítulo usam o nome do manual em cada idioma.
3. Registrar em `whats-new/index.ts`: os 3 imports `notesNNNPt/En/Es` (onde `NNN` é o patch com 3 dígitos, seguindo o padrão do arquivo) e a entrada **no fim** de `WHATS_NEW_ENTRIES` com `version`, `chapter` opcional (um `ManualChapterId` válido) e `bodies`.
4. Se não houver nada visível, não criar what's new e dizer isso no resumo.

## Passo 4 — Bump e validação

```bash
npm version <X.Y.Z> --no-git-tag-version
npm run lint && npm run typecheck && npm run test
```

Qualquer falha interrompe a release.

## Passo 5 — Commit (com confirmação)

Mostrar `git diff --stat` e a mensagem `chore: release X.Y.Z`. Com o "sim", fazer o commit (sem `--no-verify`).

## Passo 6 — Tag e push (com confirmação separada)

Perguntar explicitamente: **"Posso criar a tag vX.Y.Z e enviar branch e tag? Isso dispara o build de release."** Só então:

```bash
git tag vX.Y.Z
git push origin <branch>
git push origin vX.Y.Z
```

Nunca usar `git push --tags`, que pode publicar tags antigas esquecidas.

## Passo 7 — Pós-release

Informar o runbook do `README.md`: acompanhar **Actions → Release** (`verify`, `build`, `release`), validar no draft os artefatos (`.dmg`/`.zip`, `North-*-setup.exe`, `.AppImage`, `*.blockmap`, `latest*.yml`) e publicar o draft manualmente depois do QA (`docs/09-qa.md`).

## Exemplo de uso

> "/preparar-release" — ou — "solta a 0.1.47"

## Saída esperada

```
📦 Release 0.1.47 pronta

- package.json: 0.1.46 → 0.1.47
- What's new: whats-new/0.1.47/{pt-BR,en,es}.md criados, capítulo `api`, registrado no index.ts
- Validação: lint ✅ typecheck ✅ test ✅
- Commit: chore: release 0.1.47 (a1b2c3d)
- Tag v0.1.47 enviada → acompanhe Actions → Release e publique o draft após o QA
```
