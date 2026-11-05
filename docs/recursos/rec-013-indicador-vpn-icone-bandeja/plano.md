# Plano — REC-013 Indicador de VPN ativa no ícone da bandeja

- **Criado em:** 2026-11-04
- **Última atualização:** 2026-11-04
- **Homologação:** roteiro em `testes.md`. What's new fica para o bump da próxima versão.
- **Esforço do agente:** ⚡ Low

## Etapas

| # | Etapa | Camada | Status |
| --- | --- | --- | --- |
| 1 | `trayShowsVpnBadge` ao lado do texto ao passar o mouse | main | ✅ |
| 2 | Pintura da elipse e leitura/gravação PNG (sem dependência nova) | main | ✅ |
| 3 | `tray.setImage` no refresh da bandeja, com variante não-template no macOS | main | ✅ |
| 4 | Vitest da decisão, da cor e do canto | test | ✅ |
| 5 | Manual `vpns` nos 3 locales. What's new fica para o bump | docs | ✅ |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ feito

## Arquivos-chave

- `src/main/tray-menu.ts`
- `src/main/tray-badge.ts`
- `src/main/png-rgba.ts`
- `src/main/tray.ts`
- `resources/tray/tray.png`, `trayTemplate.png`, `dot-on.png`
- `src/renderer/src/content/manual/{pt-BR,en,es}/vpns.md`

## Riscos e mitigações

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Imagem template no macOS com a elipse | O verde vira preto ou branco | Com VPN no ar, `setTemplateImage(false)` |
| N preto na barra escura, ou branco na clara | O N some e sobra só a elipse | A tinta do N segue `AppleInterfaceStyle`, não o tema do app |
| Barra de menus automática (papel de parede) diferente do estilo do sistema | O N pode perder contraste; o verde continua | Aceito nesta entrega |
| `toBitmap` com canal diferente por plataforma | Elipse na cor errada | PNG próprio via `createFromBuffer` |
| `setImage` a cada mudança de estado | O ícone pisca | Só troca a imagem quando o modo muda: sem elipse, elipse com N preto, elipse com N branco |

## Notas de implementação

A elipse fica no canto inferior direito. O verde é o pixel opaco de `resources/tray/dot-on.png` (`#22c55e`). O ponto da janela usa `bg-emerald-500`, um verde próximo; a bandeja repete o ponto que ela já desenha no menu. Um fio escuro fino separa a elipse do N. A pintura sobre os PNGs reais da bandeja foi conferida: no Windows o N colorido permanece; no macOS o N fica preto na aparência clara e branco na escura, com o verde igual nos dois.
