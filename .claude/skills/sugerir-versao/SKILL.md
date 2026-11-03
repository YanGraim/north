---
name: sugerir-versao
description: >
  Analisa os commits desde a última tag vX.Y.Z e recomenda o próximo número de versão do North
  seguindo SemVer e a convenção atual do projeto (fase 0.x), com justificativa. Use quando o usuário
  pergunta qual versão usar ou antes de preparar uma release.
---

<!-- GERADO por scripts/harness/sync.mjs a partir de .agents/skills/sugerir-versao/SKILL.md. Não edite: altere a fonte e rode `npm run harness:sync`. -->

# Sugerir Versão

## Passo 1 — Estado atual

```bash
node -p "require('./package.json').version"
git describe --tags --abbrev=0
git log <ultima_tag>..HEAD --format='%h %s'
```

Se a versão do `package.json` já for maior que a última tag, a release anterior foi preparada mas não tagueada: avisar.

## Passo 2 — Classificar commits

Usar apenas os commits do intervalo `<ultima_tag>..HEAD` (não usar status de docs como fonte):

| Sinal | Classe |
| --- | --- |
| `BREAKING CHANGE:` no corpo, `!` após o type, migration não retrocompatível, quebra do contrato desktop ↔ North Server, quebra do formato de import/export | Breaking |
| `feat(...)` | Feature |
| `fix`, `perf`, `refactor`, ajustes de UI | Fix |
| `docs`, `test`, `ci`, `chore` sem efeito no app | Não versiona sozinho |

## Passo 3 — Regra do North

Fase atual **0.x** (convenção observada no histórico: `0.1.44 → 0.1.45 → 0.1.46`):

- Features e fixes → **PATCH** (`0.1.46 → 0.1.47`).
- Breaking ou marco de produto (ex.: workspaces com North Server em produção) → **MINOR** (`0.1.x → 0.2.0`), e só com o acordo do usuário.
- `1.0.0` é decisão de produto, nunca sugestão automática.

Depois de `1.0.0`: SemVer clássico (breaking → MAJOR, feat → MINOR, fix → PATCH).

## Passo 4 — Saída

```markdown
### 🏷️ Sugestão de versão

- package.json: `0.1.46` · última tag: `v0.1.46`
- **Recomendada:** `0.1.47` (PATCH — fase 0.x)

#### Mudanças no intervalo
- Features: feat(api) send files in the body…
- Fixes: fix(vpn) …
- Breaking: nenhuma

Próximo passo: skill `preparar-release`.
```

## Exemplo de uso

> "/sugerir-versao" — ou — "qual versão eu solto agora?"
