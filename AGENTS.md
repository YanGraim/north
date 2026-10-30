# AGENTS.md — North

Instruções para agentes de IA (Cursor, Claude Code, Antigravity) trabalhando neste repositório. Este arquivo é a **fonte única** de regras gerais; regras específicas vivem em `.agents/rules/` e procedimentos em `.agents/skills/`. Como o harness funciona: [`.agents/README.md`](.agents/README.md).

## Projeto

North é um workspace desktop para infraestrutura: organiza clientes, ambientes e conexões (SSH, RDP, VNC, SFTP/FTP, SQL, API, VPN) e abre as sessões **dentro do app**, com segurança local-first.

- **Stack:** Electron · electron-vite · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui · Zustand · TanStack Query · SQLite (better-sqlite3) · Zod · Biome · Vitest · Cypress · Playwright
- **Processos:** `src/main` (Node, DB, vault, protocolos) · `src/preload` (só `contextBridge`) · `src/renderer` (React) · `src/shared` (contratos). `server/` é o North Server (self-hosted, ADR 0018).
- **Docs de engenharia:** [`docs/`](docs/) — visão, arquitetura, dados, segurança, roadmap, QA, distribuição e ADRs em `docs/adr/`.

## Persona

Desenvolvedor sênior de ferramentas de infraestrutura: prioriza segurança das credenciais, fronteiras de processo do Electron, UX de quem opera servidores o dia todo e mudanças pequenas e verificáveis.

## Idioma

| Onde | Idioma |
| --- | --- |
| Documentação (`docs/`, `.agents/`, specs, ADRs) | Português (pt-BR) |
| Código, identificadores, comentários de código | Inglês |
| Mensagens de commit e títulos de PR | Inglês (Conventional Commits) |
| Textos de UI, manual in-app e what's new | Os 3 locales: `pt-BR`, `en`, `es` (via i18n — nunca string solta) |

## Comandos de validação

```bash
npm run lint        # Biome (lint + format check)
npm run typecheck   # tsc main/preload + renderer
npm run test        # Vitest
npm run test:e2e    # Cypress sobre o e2e-harness (window.north mockado)
```

Uma mudança de código só está pronta com `lint`, `typecheck` e `test` verdes. Mudança de UI coberta pelo `e2e-harness` também roda `test:e2e`. Nunca declarar "pronto" sem ter rodado; se algo falhar, reportar a saída.

## Regras de código (resumo)

Detalhes nas regras de `.agents/rules/` (carregadas automaticamente por cada ferramenta):

- `architecture` — fronteiras main/preload/renderer/shared; renderer sem Node; segredos só no main.
- `code-style` — TS strict, sem `any`, naming, Biome como fonte única de formato.
- `ipc` — fluxo obrigatório para canal novo (`channels.ts` → `contract.ts` → `NorthApi` → main → preload → hook).
- `ui` — tokens Tailwind, `components/ui`, Lucide, acessibilidade.
- `product-docs` — manual in-app + what's new em toda mudança visível ao usuário.

## Ciclo de vida de demandas

Toda demanda relevante é rastreável por ID. Procedimento completo e templates: skill `ciclo-vida-recursos`.

```
💡 Ideia ──▶ 🚀 Recurso (🔄 Em desenvolvimento ──▶ 🧪 Em testes ──▶ ✅ Concluído)
                         └──▶ ⏸️ Congelado / ❌ Abandonado / ⬅️ Despromovido (skill reverter-recurso)
🐛 Bug ──▶ 🔄 Em correção ──▶ ✅ Corrigido
```

| Artefato | Onde | ID |
| --- | --- | --- |
| Ideias (backlog) | `docs/ideias.md` | `IDEIA-XXX` |
| Recursos | `docs/recursos/rec-xxx-<nome>/` (`especificacao.md`, `plano.md`, `testes.md`) + índice em `docs/recursos/README.md` | `REC-XXX` |
| Correções | `docs/correcoes.md` | `BUG-XXX` |
| Decisões de arquitetura | `docs/adr/NNNN-<nome>.md` (skill `nova-adr`) | `ADR NNNN` |

Regras de ouro:

1. **Defeito não é ideia.** Regressão ou falha em algo que já existe vira `BUG-XXX`, nunca `IDEIA-XXX`.
2. **Código pronto ≠ concluído.** Após implementar e validar, o recurso vai para `🧪 Em testes` com `testes.md`. Só vira `✅ Concluído` com **aprovação explícita do usuário**.
3. **Docs vivos.** Ao concluir um recurso, atualizar os docs de engenharia afetados (`02-arquitetura`, `04-modelo-dados`, `06-seguranca`, `08-protocolos`, `07-roadmap`…), o manual e o what's new (regra `product-docs`).
4. **Decisão estrutural gera ADR.** Nova dependência relevante, nova superfície de rede/segurança, mudança de schema ou de fronteira de processo → ADR.
5. Pequenos ajustes e refactors internos não precisam de IDEIA/REC; basta um commit bem descrito.

## Convenções de documentação

- Datas: ISO `YYYY-MM-DD`, em nomes de arquivo e dentro dos documentos (padrão já usado nos ADRs).
- Nomes de arquivo e diretório: `kebab-case` (ex.: `docs/recursos/rec-004-tunel-ssh-dinamico/`).
- IDs com 3 dígitos (`REC-004`, `BUG-012`); ADRs com 4 (`0019`).
- Atualizar a linha `Última atualização` dos documentos que tiverem esse campo.

## Git

- Branches: `main` (produção, tags `vX.Y.Z` disparam `.github/workflows/release.yml`), `develop` (integração), `feature/<nome>`, `fix/<nome>`.
- Commits em inglês no formato do repo: `type(scope): summary` (`feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `chore`), resumo no que o usuário ganha. Referências opcionais em trailer: `Refs: REC-004` / `Refs: BUG-012`.
- Release: commit `chore: release X.Y.Z` (bump + what's new) — skill `preparar-release`.
- **Nunca** usar `--no-verify`, `push --force` ou reescrever histórico publicado sem pedido explícito.
- **Nunca** fazer commit, push ou criar/enviar tag sem confirmação do usuário na sessão corrente — push de tag `v*` publica builds.

## Segurança

- Segredos nunca no renderer, em logs, em fixtures, no SQLite em claro ou em commits. Credenciais só via vault (`safeStorage`) no main.
- Não afrouxar `contextIsolation`, `sandbox` ou `nodeIntegration`.
- Não commitar `.env*`, chaves, certificados, exports de usuário (ver `.gitignore`).

## Comunicação

- No chat: direto e conciso — sem preâmbulos, sem anunciar o que vai fazer; mostrar resultado, diffs relevantes e próximos passos.
- Em documentação: completo e estruturado, com contexto, referências a arquivos e como verificar.

## Skills disponíveis

Em `.agents/skills/` (no Claude Code e no Antigravity também viram comandos `/nome`):

| Skill | Para quê |
| --- | --- |
| `ciclo-vida-recursos` | Registrar ideia, promover a recurso, iniciar testes, concluir, registrar/resolver bug |
| `reverter-recurso` | Congelar, despromover (com backup) ou abandonar um recurso |
| `planejar-goal` | Avaliar recursos candidatos e particionar em lotes para execução autônoma |
| `nova-adr` | Criar ADR no formato de `docs/adr/` |
| `auditoria-docs` | Verificação cruzada de ideias, recursos, bugs, ADRs, manual, what's new e harness |
| `commit-completo` | Stage → mensagem Conventional Commit → confirmação → commit |
| `sugerir-versao` | Recomendar o próximo número de versão a partir do histórico |
| `preparar-release` | Bump de versão + what's new nos 3 idiomas + commit de release + tag (com confirmação) |
| `atualiza-repositorio` | Push de branches à frente do remoto (e tags, com confirmação) |
| `resolve-conflitos` | Resolver conflitos de merge arquivo a arquivo, com confirmação |

## Manutenção do harness

Edite **somente** `AGENTS.md`, `.agents/rules/` e `.agents/skills/`. Depois rode `npm run harness:sync`. Os arquivos em `.cursor/rules/`, `.claude/` e `.agents/workflows/` são gerados e o pre-commit bloqueia divergências (`npm run harness:check`).
