---
name: reverter-recurso
description: >
  Formaliza o fluxo reverso de um recurso em docs/recursos/: congelar (pausa), despromover
  de volta a ideia (com backup) ou abandonar. Atualiza ideias.md e o índice de recursos.
  Use quando o usuário pede para reverter, pausar, congelar, abandonar ou despromover um REC-XXX.
---

<!-- GERADO por scripts/harness/sync.mjs a partir de .agents/skills/reverter-recurso/SKILL.md. Não edite: altere a fonte e rode `npm run harness:sync`. -->

# Reverter Recurso

| Ação | Status do recurso | Status da ideia | Diretório |
| --- | --- | --- | --- |
| ⏸️ Congelar | `⏸️ Congelado` | `⏸️ Adiada` | Mantido |
| ⬅️ Despromover | Linha removida do índice | `🔍 Em análise` | Backup em `docs/recursos/_backup/` e removido |
| ❌ Abandonar | `❌ Abandonado` | `❌ Descartada` | Mantido como histórico |

## Passos

1. **Identificar o recurso** (`REC-XXX` ou nome do diretório) em `docs/recursos/README.md`. Ler `especificacao.md` e anotar a ideia de origem.
2. **Bloqueio:** se o recurso está `✅ Concluído`, não se aplica — sugerir abrir `BUG-XXX` ou uma nova ideia de remoção.
3. **Perguntar** a ação (congelar / despromover / abandonar) e a justificativa.
4. **Verificar código:** `git log --oneline --all -- <arquivos-chave do plano.md>` e `git branch --show-current`. Se já existe código do recurso em branch, perguntar o que fazer com ele (manter na branch, reverter commits, descartar a branch). **Não** reverter nem apagar branch sem confirmação explícita.
5. **Executar:**
   - **Congelar:** status em `especificacao.md` e no índice → `⏸️ Congelado`; ideia → `⏸️ Adiada`; registrar a justificativa e a data na spec.
   - **Despromover:** copiar o diretório para `docs/recursos/_backup/rec-xxx-<nome>_YYYY-MM-DD/`, confirmar a cópia com o usuário, remover o original, remover a linha do índice, ideia → `🔍 Em análise` (limpar a coluna Recurso e anotar o motivo nas notas da ideia).
   - **Abandonar:** status → `❌ Abandonado` na spec e no índice, com a nota `> ❌ Abandonado em YYYY-MM-DD: <justificativa>`; ideia → `❌ Descartada`.
6. Se havia ADR `Proposto` só para esse recurso, perguntar se vira `Rejeitado` ou `Adiado`.
7. **Resumo final:** documentos alterados, status, backup criado, pendências de código.

## Regras

- Nunca excluir sem backup; nunca executar ação destrutiva sem confirmação.
- Ignorar `docs/recursos/_backup/` nas demais skills (auditoria, planejamento).

## Exemplo de uso

> "congela o REC-005, vamos esperar o North Server estabilizar"

## Saída esperada

```
⏸️ REC-005 — Sincronização de snippets congelado

- Justificativa: aguardando estabilização do North Server
- docs/recursos/rec-005-sincronizacao-snippets/especificacao.md — ⏸️ Congelado
- docs/recursos/README.md — REC-005 ⏸️ Congelado
- docs/ideias.md — IDEIA-011 → ⏸️ Adiada
- Código: 2 commits em feature/snippets-sync mantidos na branch
```
