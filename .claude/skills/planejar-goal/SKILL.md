---
name: planejar-goal
description: >
  Analisa um conjunto de recursos ou ideias candidatos (REC-XXX / IDEIA-XXX), avalia maturidade
  da especificação, acoplamento entre camadas do Electron e risco de estouro de contexto,
  classifica cada item como apto para execução autônoma, dependente de alinhamento ou interativo,
  particiona em lotes e gera prompts prontos para /goal (ou execução autônoma equivalente).
  Use quando o usuário pede para planejar, agrupar ou priorizar recursos para implementação em lote.
---

<!-- GERADO por scripts/harness/sync.mjs a partir de .agents/skills/planejar-goal/SKILL.md. Não edite: altere a fonte e rode `npm run harness:sync`. -->

# Planejar Goal

Decide **o que** pode ser implementado de forma autônoma e **em que lotes**, antes de gastar uma sessão longa.

## Passo 1 — Carregar candidatos

- Se o usuário listou IDs, usar esses. Senão, listar em `docs/recursos/README.md` os itens `🔄 Em desenvolvimento` e, em `docs/ideias.md`, as ideias `💡 Nova` / `🔍 Em análise` de prioridade Alta.
- Para cada item, ler `especificacao.md` + `plano.md` (recurso) ou a seção detalhada (ideia).
- Ignorar `docs/recursos/_backup/`.

## Passo 2 — Maturidade

Um item só é apto se:

- requisitos funcionais e critérios de aceite estão escritos;
- decisões de UI são claras ou triviais;
- contratos IPC, migrations SQLite e pontos de segurança (vault, superfície de rede) estão mapeados;
- não há "Questões em aberto" pendentes.

Se faltar algo: **não** incluir no lote. Listar perguntas objetivas (múltipla escolha quando possível) para o usuário; com as respostas, atualizar a spec/ideia e reavaliar. Ideias aptas precisam ser promovidas (skill `ciclo-vida-recursos`) antes de entrar num lote.

## Passo 3 — Mapa de camadas e acoplamento

Para cada item, marcar as camadas tocadas:

| Camada | Caminhos |
| --- | --- |
| Contratos | `src/shared/ipc`, `src/shared/types`, `src/shared/protocols` |
| Main | `src/main/ipc`, `src/main/services`, `src/main/repositories`, `src/main/protocols`, `src/main/vault` |
| Dados | `src/main/database/migrations` |
| Preload | `src/preload` |
| Renderer | `src/renderer/src/features`, `stores`, `hooks`, `components/ui` |
| Server | `server/` |
| Produto | `src/renderer/src/content/manual`, `src/renderer/src/content/whats-new` |
| Testes | `test/`, `cypress/`, `e2e-harness/`, `playwright/` |

Itens que tocam os mesmos arquivos, a mesma migration ou o mesmo contrato IPC vão **no mesmo lote** (ou em lotes sequenciais, nunca em paralelo).

## Passo 4 — Classificação

| Classe | Critério | Ação |
| --- | --- | --- |
| 🟢 Apto | Spec completa, escopo determinístico, validação automatizada clara | Entra em lote |
| 🟡 Alinhamento | 1–2 decisões de UI/negócio em aberto | Perguntar antes; depois entra |
| 🔴 Interativo | Exploratório, protocolo/plataforma nova, mudança de segurança, migração destrutiva, dependência externa incerta | Fazer passo a passo com aprovações |

Dimensionamento: no máximo **2–3 recursos médios** ou **1 grande** por lote. Itens `🧠 High` contam como grandes. Mudanças com validação só manual (VPN, RDP, Serial em hardware real) não fecham sozinhas: o lote termina em `🧪 Em testes`.

## Passo 5 — Saída

```markdown
### 🎯 Planejamento de lotes

#### Diagnóstico
- **REC-XXX <nome>:** 🟢 Apto — camadas: shared, main, renderer
- **REC-YYY <nome>:** 🟡 Alinhamento — <decisão em aberto>
- **IDEIA-ZZZ <nome>:** 🔴 Interativo — <motivo>

#### Perguntas pendentes
1. ...

#### Lotes
- **Lote 1:** REC-XXX + REC-WWW — <foco> — arquivos-chave: ...
- **Lote 2:** REC-YYY (após alinhamento)

#### Prompt do Lote 1
```

Prompt-modelo:

```text
/goal Implementar o Lote 1: REC-XXX (<nome>) e REC-WWW (<nome>).
1. Seguir docs/recursos/rec-xxx-*/especificacao.md e plano.md de cada recurso, respeitando as regras de .agents/rules (architecture, ipc, ui, code-style).
2. Atualizar o plano.md de cada recurso conforme as etapas forem concluídas.
3. Validar: npm run lint, npm run typecheck, npm run test (e npm run test:e2e se houver UI no e2e-harness) — todos verdes.
4. Atualizar manual in-app e what's new nos 3 idiomas quando houver mudança visível (regra product-docs).
5. Ao final, levar cada recurso para 🧪 Em testes com testes.md (skill ciclo-vida-recursos). Não marcar como concluído nem fazer commit.
```

Se a ferramenta não tiver `/goal`, o mesmo texto serve como prompt de uma sessão autônoma.

## Exemplo de uso

> "/planejar-goal REC-004, REC-005, IDEIA-012"
