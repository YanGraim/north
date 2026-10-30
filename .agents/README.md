# Harness de desenvolvimento agêntico

- **Versão do harness:** 1.0.0
- **Última atualização:** 2026-10-29

Regras e procedimentos para agentes de IA no North, compatíveis com **Cursor**, **Claude Code** e **Antigravity** a partir de uma única fonte.

## Fonte única → cópias geradas

```
AGENTS.md                      ← regras gerais (fonte)
.agents/rules/*.md             ← regras específicas (fonte)
.agents/skills/<nome>/SKILL.md ← procedimentos (fonte)
        │
        │  npm run harness:sync   (scripts/harness/sync.mjs)
        ▼
.cursor/rules/*.mdc            → Cursor
.claude/rules/*.md             → Claude Code
.claude/skills/<nome>/         → Claude Code
.agents/workflows/<nome>.md    → Antigravity (comandos /nome)
CLAUDE.md                      → Claude Code (só importa AGENTS.md)
```

| Ferramenta | Regras gerais | Regras específicas | Skills | Comando `/` |
| --- | --- | --- | --- | --- |
| Cursor | `AGENTS.md` | `.cursor/rules/*.mdc` (gerado) | `.agents/skills/` (nativo) | skills |
| Claude Code | `CLAUDE.md` → `@AGENTS.md` | `.claude/rules/*.md` (gerado) | `.claude/skills/` (gerado) | skills |
| Antigravity | `AGENTS.md` | `.agents/rules/*.md` (nativo) | `.agents/skills/` (nativo) | `.agents/workflows/` (gerado) |

Os arquivos gerados começam com o comentário `GERADO por scripts/harness/sync.mjs`. O pre-commit roda `npm run harness:check` e bloqueia o commit se algum estiver desatualizado ou editado à mão. Arquivos sem esse marcador nas pastas de destino (ex.: o `.cursor/rules/orchestrator.mdc` local) não são tocados.

## Como alterar

1. Edite `AGENTS.md`, `.agents/rules/` ou `.agents/skills/`.
2. Rode `npm run harness:sync`.
3. Commite fonte e gerados juntos.

### Regra nova

```markdown
---
trigger: always_on            # always_on | glob | model_decision | manual
description: Uma linha dizendo quando a regra vale
globs: src/main/**,src/shared/**   # só com trigger: glob
---

# Título

Conteúdo.
```

Conversão: `always_on` → Cursor `alwaysApply: true` e Claude sem `paths` (sempre carregada); `glob` → Cursor `globs` e Claude `paths`. As regras `model_decision` e `manual` ficam com `alwaysApply: false` no Cursor e são carregadas sempre no Claude, então prefira `always_on` ou `glob`.

### Skill nova

`.agents/skills/<nome-kebab>/SKILL.md`, com frontmatter `name` igual ao diretório e uma `description` que diga **o que faz e quando usar** (é por ela que o agente decide carregá-la). Inclua `## Exemplo de uso` e, quando houver formato fixo, `## Saída esperada`. Depois, adicione a skill na tabela do `AGENTS.md`.

## Limitações conhecidas

- O Cursor lê skills de `.agents/skills/` **e** de `.claude/skills/`. Se uma skill aparecer duplicada no Cursor, as duas cópias têm o mesmo conteúdo.
- O Claude Code não lê `AGENTS.md` nativamente: o `CLAUDE.md` faz o import. Preferências pessoais vão em `CLAUDE.local.md` (gitignored).

## Origem

Adaptado do harness do GruppeDesktop. Ficaram de fora o Trello, o `.alerta.yaml` com pacotes por branch, o alerta de janela de contexto e a descrição executiva de commit para cliente. O ciclo de vida foi integrado ao `docs/` existente (ADRs, roadmap, manual e what's new), com datas ISO e nomes em kebab-case.

## Histórico

| Versão | Data | Mudança |
| --- | --- | --- |
| 1.0.0 | 2026-10-29 | Versão inicial: AGENTS.md, 5 regras migradas de `.cursor/rules`, 10 skills, sync multi-ferramenta, ciclo de vida em `docs/` |
