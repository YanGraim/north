---
name: ciclo-vida-recursos
description: >
  Gerencia o ciclo de vida das demandas do North em docs/: registrar ideia (IDEIA-XXX),
  promover ideia a recurso (REC-XXX com especificacao/plano/testes), iniciar fase de testes,
  concluir recurso após aprovação do usuário e registrar/resolver bugs (BUG-XXX). Use quando
  o usuário propõe uma ideia ou funcionalidade, pede para promover/implementar uma ideia,
  terminou de implementar um recurso, aprova os testes, ou reporta um defeito.
---

# Ciclo de Vida de Recursos

Mantém rastreáveis as demandas do North, integradas à documentação que já existe em `docs/` (ADRs, roadmap, docs de engenharia, manual in-app e what's new).

```
💡 IDEIA ──▶ 🚀 PROMOVIDA ──▶ 🔄 EM DESENVOLVIMENTO ──▶ 🧪 EM TESTES ──▶ ✅ CONCLUÍDO
 docs/ideias.md     docs/recursos/rec-xxx-<nome>/        testes.md        aprovado pelo usuário
```

## Artefatos

| Artefato | Caminho |
| --- | --- |
| Backlog de ideias | `docs/ideias.md` |
| Índice de recursos | `docs/recursos/README.md` |
| Recurso | `docs/recursos/rec-xxx-<nome>/especificacao.md`, `plano.md`, `testes.md` |
| Correções | `docs/correcoes.md` |
| Roadmap | `docs/07-roadmap.md` |
| ADRs | `docs/adr/` (skill `nova-adr`) |

Convenções: datas `YYYY-MM-DD`; diretórios `kebab-case`; IDs com 3 dígitos; docs em pt-BR.

---

## Fase 1 — Registrar ideia

1. Ler `docs/ideias.md` e pegar o próximo `IDEIA-XXX` (maior ID existente + 1).
2. Antes de registrar, procurar duplicatas no backlog, em `docs/recursos/README.md` e em `docs/07-roadmap.md` (seção Longo prazo). Se existir, apontar e perguntar se é a mesma coisa.
3. Se for um **defeito em algo existente**, não registrar como ideia: ir para a Fase 5.
4. Adicionar a linha na tabela **Backlog** e a seção detalhada (template abaixo).
5. Classificar o esforço do agente: `⚡ Low` (escopo determinístico, padrões existentes) ou `🧠 High` (arquitetura, segurança, protocolos novos, concorrência, migração de dados).

### Template — seção detalhada da ideia

```markdown
### IDEIA-XXX — <Nome>

- **Status:** 💡 Nova
- **Prioridade:** Alta | Média | Baixa
- **Esforço do agente:** ⚡ Low | 🧠 High
- **Registrada em:** YYYY-MM-DD
- **Área:** <inventário | sessões/<protocolo> | vault | VPN | workflows | SQL | API | workspaces/server | UI | distribuição>

**Descrição:** o que é.

**Motivação:** qual dor de quem opera infraestrutura isso resolve.

**Impacto esperado:** o que melhora para o usuário.

**Notas técnicas:** camadas afetadas, dependências, riscos de segurança, ADRs relacionados.

**Questões em aberto:** decisões que precisam do usuário antes de promover.
```

---

## Fase 2 — Promover ideia a recurso

1. Confirmar com o usuário qual ideia promover e checar se as **questões em aberto** foram respondidas. Se não, entrevistar o usuário (perguntas objetivas, de preferência múltipla escolha) e registrar as respostas na ideia antes de seguir.
2. Pegar o próximo `REC-XXX` em `docs/recursos/README.md`.
3. Criar `docs/recursos/rec-xxx-<nome>/` com `especificacao.md` e `plano.md` (templates abaixo).
4. Em `docs/ideias.md`: status → `🚀 Promovida`, preencher a coluna **Recurso** com `REC-XXX`.
5. Em `docs/recursos/README.md`: adicionar linha com status `🔄 Em desenvolvimento`, a branch atual (`git branch --show-current`) e a data.
6. Se a spec contém decisão estrutural (dependência nova, superfície de rede, schema, fronteira de processo, modelo de segurança), criar ADR com a skill `nova-adr` e linkar na spec.

### Template — `especificacao.md`

```markdown
# REC-XXX — <Nome>

- **Status:** 🔄 Em desenvolvimento
- **Ideia de origem:** IDEIA-XXX
- **Criado em:** YYYY-MM-DD
- **Última atualização:** YYYY-MM-DD
- **ADRs:** — | [ADR NNNN](../../adr/NNNN-<nome>.md)

## Visão geral

O que o recurso entrega e para quem.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | ... | Alta |

## Requisitos técnicos

- **Main:** serviços, repositórios, drivers de protocolo, vault.
- **IPC:** canais novos (`domínio:ação`), args/result em `IpcInvokeMap`.
- **Renderer:** features, stores, hooks TanStack Query.
- **Dados:** migrations SQLite (número, tabelas, colunas), impacto em import/export.
- **Segurança:** onde ficam segredos, superfície nova, validação no main.

## Interface / UX

Telas, estados (vazio, carregando, erro), atalhos, i18n (pt-BR/en/es).

## Critérios de aceite

- [ ] ...

## Fora de escopo

- ...

## Documentação de produto

- Manual: capítulo `<id>` (novo | extensão) — ou justificativa de omissão.
- What's new: entra na próxima versão? sim/não.
```

### Template — `plano.md`

```markdown
# Plano — REC-XXX <Nome>

- **Criado em:** YYYY-MM-DD
- **Última atualização:** YYYY-MM-DD
- **Esforço do agente:** ⚡ Low | 🧠 High

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | Contrato IPC + tipos Zod | shared | ⬜ |
| 2 | Migration + repositório | main | ⬜ |
| 3 | Handler IPC + serviço | main | ⬜ |
| 4 | Preload | preload | ⬜ |
| 5 | Hook + UI | renderer | ⬜ |
| 6 | Testes (Vitest / Cypress) | test | ⬜ |
| 7 | Manual + what's new (3 idiomas) | docs | ⬜ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/...`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |

## Notas de implementação

Decisões tomadas durante o desenvolvimento.
```

---

## Fase 3 — Iniciar testes (`🧪 Em testes`)

Quando o código estiver implementado. **Nunca** marcar como concluído neste momento.

1. Rodar e registrar: `npm run lint`, `npm run typecheck`, `npm run test` e, se a UI estiver coberta pelo `e2e-harness`, `npm run test:e2e`. Falhou → corrigir antes de seguir.
2. Criar `testes.md` (template abaixo) com cenários derivados dos critérios de aceite. Para protocolos/sessões, reaproveitar os roteiros de `docs/09-qa.md` e `docs/11-validacao-pratica.md`.
3. Atualizar status para `🧪 Em testes` em `especificacao.md` e em `docs/recursos/README.md`; marcar etapas do `plano.md`.
4. Pedir ao usuário que execute o roteiro. Cada apontamento vira linha em **Registro de execução**, com o ajuste aplicado e os arquivos alterados.

### Template — `testes.md`

```markdown
# Testes — REC-XXX <Nome>

- **Status da homologação:** 🧪 Em testes
- **Início:** YYYY-MM-DD
- **Última atualização:** YYYY-MM-DD

## 1. Validações automatizadas

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run test:e2e` (se aplicável)

## 2. Roteiro funcional

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | ... | macOS / Windows / Linux | ... | ⬜ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | :---: |
| — | Aguardando execução pelo usuário | — | — |
```

---

## Fase 4 — Concluir (`✅ Concluído`)

**Somente após aprovação explícita do usuário** ("aprovado", "pode concluir", etc.).

1. `testes.md`: cenários ✅ e status `✅ Homologado`.
2. `especificacao.md`: status `✅ Concluído` + seção **Resultado final** (o que foi entregue, decisões, ajustes da homologação, arquivos principais).
3. `docs/recursos/README.md`: status `✅ Concluído` e data de conclusão.
4. Atualizar os docs de engenharia afetados (`02-arquitetura`, `04-modelo-dados`, `06-seguranca`, `08-protocolos`, `07-roadmap`…).
5. Regra `product-docs`: manual in-app e what's new nos 3 idiomas — ou registrar a justificativa de omissão na spec.
6. Se houver ADR `Proposto`, perguntar ao usuário se passa a `Aceito`.

---

## Fase 5 — Bugs (`BUG-XXX`)

1. Ler `docs/correcoes.md`, pegar o próximo `BUG-XXX`.
2. Registrar na tabela e na seção detalhada: recurso/área afetada (`REC-XXX` se houver), severidade, plataforma, passos para reproduzir, comportamento esperado × atual.
3. Diagnosticar e preencher **Causa raiz** antes de corrigir. Status `🔄 Em correção`.
4. Corrigir, adicionar teste de regressão quando viável (Vitest/Cypress), rodar validações.
5. Preencher **Solução**, **Arquivos** e data; status `✅ Corrigido`. Commit com `fix(scope): ...` e trailer `Refs: BUG-XXX`.
6. Bug visível ao usuário entra no what's new da próxima versão (regra `product-docs`).

Severidades: **Crítica** (perda de dados, vazamento de segredo, app inutilizável) · **Alta** (fluxo principal quebrado) · **Média** (cenário específico com contorno) · **Baixa** (cosmético).

---

## Validação de consistência

Após qualquer transição, conferir que origem e destino foram atualizados (`ideias.md` ↔ `recursos/README.md` ↔ diretório do recurso ↔ `correcoes.md`) e que os status batem. Para uma checagem completa, use a skill `auditoria-docs`.

## Exemplo de uso

> "registrar ideia: túnel SSH dinâmico (SOCKS) por conexão"
> "promover a IDEIA-007"
> "terminei o REC-003, pode iniciar os testes"
> "o REC-003 foi aprovado"
> "bug: aba RDP fica preta ao redimensionar no Windows"

## Saída esperada (promoção)

```
🚀 IDEIA-007 promovida a REC-004 — Túnel SSH dinâmico (SOCKS)

- docs/recursos/rec-004-tunel-ssh-dinamico/especificacao.md (criado)
- docs/recursos/rec-004-tunel-ssh-dinamico/plano.md (criado)
- docs/ideias.md — IDEIA-007 → 🚀 Promovida (REC-004)
- docs/recursos/README.md — REC-004 🔄 Em desenvolvimento (branch feature/socks-tunnel)
- ADR: não necessário (reaproveita ssh2 e o ProtocolManager)
```
