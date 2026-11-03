---
name: nova-adr
description: >
  Cria um Architecture Decision Record em docs/adr/ no formato do North (Status, Data, Contexto,
  Decisões, Alternativas, Consequências) e o liga ao roadmap e ao recurso de origem. Use quando
  uma decisão estrutural precisa ser registrada (dependência nova, superfície de rede ou de segurança,
  schema, fronteira de processo, novo protocolo) ou quando o usuário pede um ADR.
---

# Nova ADR

## Quando um ADR é obrigatório

- Dependência nova com peso (driver de protocolo, engine, lib nativa, WASM).
- Nova superfície de rede ou de segurança (socket de escuta, elevação de privilégio, segredo em lugar novo).
- Mudança de schema SQLite com impacto em import/export ou migração de dados.
- Mudança nas fronteiras main/preload/renderer/shared ou no modelo de sessões (`ProtocolManager`, `MessagePort`).
- Mudança no North Server que altera o contrato com o desktop.

## Passos

1. Listar `docs/adr/` e pegar o próximo número com 4 dígitos (maior existente + 1).
2. Ler os ADRs relacionados (pelo tema) para citar e não contradizer sem dizer.
3. Criar `docs/adr/NNNN-<titulo-kebab-case>.md` com o template abaixo. Status inicial `Proposto`, a menos que o usuário diga que a decisão já foi tomada.
4. Linkar o ADR: na `especificacao.md` do recurso (campo ADRs), e em `docs/07-roadmap.md` quando for uma entrega de produto.
5. Ao aceitar: mudar `Status` para `Aceito` (ou `Aceito (fases X–Y)` quando parcial). ADR substituído: `Substituído por ADR NNNN` — nunca apagar ADRs.

## Template

```markdown
# ADR NNNN — <Título>

- **Status:** Proposto
- **Data:** YYYY-MM-DD
- **Recurso:** REC-XXX (se houver)

## Contexto

Problema, restrições do repositório (cite `docs/06-seguranca.md`, `docs/02-arquitetura.md`, ADRs anteriores) e o que força a decisão agora.

## Decisões

1. **<Decisão>:** o que e por quê.

## Alternativas

- **<Alternativa>:** rejeitada/adiada porque ...

## Consequências

- O que muda no código, nos docs, na distribuição e na segurança.
- Obrigações de doc ao implementar (manual, what's new, `09-qa.md`).
- Próximo passo.
```

## Exemplo de uso

> "cria um ADR para usar OpenSSH nativo como fallback do ssh2"

## Saída esperada

```
📐 docs/adr/0019-fallback-openssh-nativo.md criado (Status: Proposto)
- Relacionados: ADR 0004 (sessões nativas in-app), ADR 0007 (núcleo de sessões)
- Linkado em: docs/recursos/rec-006-fallback-openssh/especificacao.md
```
