# REC-026 — Melhorias no auto-update (itens 1–4)

- **Status:** 🔄 Em desenvolvimento
- **Ideia de origem:** IDEIA-024
- **Criado em:** 2026-11-15
- **Última atualização:** 2026-11-15
- **ADRs:** —

## Visão geral

Endurece o fluxo de atualização do processo main (`src/main/ipc/updates.ts`) e o contrato `UpdateStatus` (`src/shared/types/updates.ts`): checagem única em andamento, detecção de AppTranslocation no macOS, erros como códigos traduzidos no renderer e checagem periódica. Entrega em 4 PRs sequenciais, um por item.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | `runCheck()` com checagem em andamento devolve a mesma Promise; sem segundo `checkForUpdates()` nem segundo download. Depois de terminar (sucesso ou erro) uma nova chamada volta a checar | Alta |
| RF-02 | `process.execPath` em `/AppTranslocation/` (macOS) é tratado como `/Volumes/`, com a mesma orientação de mover o app para Aplicativos | Alta |
| RF-03 | `UpdateStatus` ganha `errorCode` (`releases_unreachable`, `mac_signature`, `read_only_location`, `unknown`) e `errorDetail` opcional; o main não monta mais frases em português; o renderer traduz (pt-BR, en, es) | Alta |
| RF-04 | Checagem a cada 4 h com o app aberto, além da de 8 s após abrir; pula se houver checagem em andamento ou atualização já baixada; respeita `isUpdatesEnabled()` | Média |

## Requisitos técnicos

- **Main:** `src/main/ipc/updates.ts`. `setInterval` com `unref()` no item 4.
- **IPC:** sem canais novos; muda só o contrato de `UpdateStatus` (item 3), seguindo a regra `ipc`.
- **Renderer:** tradução dos códigos de erro pelo i18n (item 3).
- **Dados:** sem migration.
- **Segurança:** não mudar provedor/URL de update, verificação de assinatura nem `autoInstallOnAppQuit`; `errorDetail` sem segredo ou token.

## Interface / UX

Mensagens de erro de atualização passam a seguir o idioma do app (pt-BR, en, es). Sem tela nova.

## Critérios de aceite

- [ ] 2 chamadas simultâneas a `runCheck()` resultam em 1 `autoUpdater.checkForUpdates` e o mesmo status; nova checagem após sucesso e após erro
- [ ] No darwin, `/Volumes/...` e `.../AppTranslocation/...` são detectados; `/Applications/...` não; em outras plataformas, sempre false
- [ ] Com o app em en, os erros aparecem em inglês; nenhuma string de erro solta no main; sem segredo em `errorDetail`
- [ ] Com fake timers, uma checagem a cada 4 h; nenhuma com updates desabilitado; nenhuma dupla; o timer não segura o encerramento

## Fora de escopo

- Item 5 (instalar ao fechar) e item 6 (canal beta) da IDEIA-024.
- Mudar provedor, URL, assinatura ou `autoInstallOnAppQuit`.

## Documentação de produto

- Manual: só se o texto de erro que o usuário vê mudar (item 3).
- What's new: itens 1, 2 e 4 não são percebidos de forma direta; avaliar na release.
