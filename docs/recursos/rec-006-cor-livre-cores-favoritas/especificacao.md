# REC-006 — Cor livre e cores favoritas no seletor

- **Status:** ✅ Concluído
- **Ideia de origem:** IDEIA-006
- **Criado em:** 2026-10-31
- **Última atualização:** 2026-10-31
- **ADRs:** —

## Visão geral

O seletor de cor usado no cadastro de cliente, ambiente, conexão, conexão de banco, acesso e tag passa a aceitar qualquer cor, além das dez da grade. Dá para digitar o hexadecimal, abrir o seletor nativo do sistema e reaplicar até dez cores personalizadas guardadas neste computador. A grade atual permanece no mesmo lugar. Limpar a cor continua possível.

Quem quer a cor da marca, ou a mesma cor em várias entidades, deixa de ficar preso às dez amostras.

## Decisões

Herdadas da IDEIA-006:

- O ícone de pipeta abre o seletor nativo do sistema (`<input type="color">`).
- Até 10 cores personalizadas. A remoção é o clique com o botão direito sobre a amostra personalizada.
- O campo aceita `#RRGGBB`, `#RGB` e o código colado sem `#`.
- A lista `ENTITY_COLORS` não muda. Cor fora da grade persiste no campo `color` já existente (`z.string().nullable()`), sem migration.
- As personalizadas são preferência local da interface (store `north-ui`), a mesma lista em todos os seletores. Não são dado de inventário, não entram em import/export e não são segredo.

Fechadas na spec:

- A pipeta é um botão irmão do gatilho do popover, na mesma fileira (amostra, hexadecimal, pipeta). O clique nela não abre nem fecha o popover. Aninhar o botão dentro do gatilho seria HTML inválido.
- O valor do seletor nativo só é gravado no evento `change` (o diálogo fechou). O `input` contínuo, enquanto se arrasta o picker no Windows, não entra nas personalizadas.
- Sem cor atual, o diálogo nativo abre em `#64748b`. Isso não grava nada até o usuário confirmar uma cor.
- O campo hexadecimal fica dentro do popover. Confirma com Enter ou ao sair do campo, se o texto for válido, e fecha o popover. Texto inválido ao sair restaura o valor anterior e não grava.
- Formato gravado: `#` + seis dígitos hexadecimais minúsculos. `#RGB` expande cada dígito (`#abc` → `#aabbcc`). Espaço nas pontas é ignorado. Maiúsculas viram minúsculas. Nome CSS, `hsl`, alfa (`#rgba`, `#rrggbbaa`) e tamanho fora de 3 ou 6 dígitos são rejeitados.
- Cor confirmada que não está em `ENTITY_COLORS` entra no início da lista de personalizadas. Repetida (já normalizada) só muda de lugar, para o início. Na 11ª, sai a mais antiga. Cor da grade não entra nessa lista.
- Abrir um cadastro que já tem cor livre não adiciona essa cor sozinho. Ela entra quando o usuário a confirma de novo neste seletor.
- Clique esquerdo numa personalizada aplica e fecha o popover, como na grade. Botão direito (e Ctrl+clique no macOS, via `contextmenu`) remove só da lista, não altera a cor da entidade e não fecha o popover. Com o foco na amostra, Delete ou Backspace também remove.
- Botão direito na grade não faz nada.
- **Limpar** continua gravando `null` e não mexe na lista.

## Requisitos funcionais

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-01 | Em todo `ColorPicker` do app, a grade das dez cores e o botão Limpar seguem como hoje. | Alta |
| RF-02 | O popover tem um campo que aceita `#RRGGBB`, `#RGB` e o mesmo código sem `#`, e grava `#rrggbb`. | Alta |
| RF-03 | A pipeta abre o seletor nativo. A cor confirmada vira a cor da entidade. | Alta |
| RF-04 | Até 10 cores personalizadas aparecem nos seletores seguintes e sobrevivem a fechar o app. | Alta |
| RF-05 | Botão direito numa personalizada remove essa amostra. A cor já salva na entidade não muda. | Alta |
| RF-06 | Texto inválido não grava. Limpar volta a nenhuma cor. | Alta |
| RF-07 | Cliente, ambiente, conexão, conexão de banco, acesso e tag passam a persistir cor fora da grade sem outro campo. | Alta |
| RF-08 | Rótulos do seletor, inclusive os que hoje estão fixos em português, ficam nos 3 locales. | Média |

## Requisitos técnicos

- **Main:** nada. O campo `color` já é string anulável nos contratos de cliente, ambiente, conexão, acesso e tag.
- **IPC:** nenhum canal novo.
- **Renderer:** `ColorPicker` (`src/renderer/src/components/ColorPicker.tsx`) ganha o campo, a pipeta com `<input type="color">` e a faixa de personalizadas. A normalização e a regra das 10 ficam em funções puras (`src/renderer/src/lib/favorite-colors.ts`), com Vitest. A lista mora em `favoriteColors: string[]` na store `north-ui` (`src/renderer/src/stores/ui-store.ts`): entra no `partialize`; no `merge`, descarta entrada inválida, deduplica e corta em 10. Os seis formulários que já usam o componente não mudam de props.
- **Dados:** sem migration e sem impacto em import/export. Cor livre continua numa coluna `color` text/nullable. A heurística de ambiente (`environmentStatusColor`) já prefere a cor salva; um hex livre pinta do mesmo jeito.
- **Segurança:** preferência local de UI. Sem segredo, sem superfície de rede, sem mudança de fronteira de processo. O hex não é interpolado em shell nem em CSS além de `backgroundColor` no estilo da amostra.

## Interface / UX

O gatilho segue mostrando a amostra, o hexadecimal (ou “nenhuma”) e, ao lado, a pipeta.

Popover, de cima para baixo:

1. Campo hexadecimal.
2. Grade 5×2 de `ENTITY_COLORS`, com o anel na cor selecionada.
3. Faixa **Personalizadas**, só quando houver ao menos uma. Mesmo tamanho de amostra. O anel aparece se o valor atual for essa cor.
4. **Limpar**.

Estados: lista vazia omite a faixa. Campo inválido não mostra erro persistente; ao sair, o texto volta ao valor gravado. Seletor desabilitado (`disabled`) não abre popover nem o picker nativo.

Atalho novo: Enter confirma o campo; Delete ou Backspace com foco numa personalizada remove a amostra.

Chaves novas em `colorPicker.*` nos locales `pt-BR`, `en` e `es`, cobrindo também “Escolher cor”, “Nenhuma”, “Limpar” e o nome acessível de cada amostra.

## Critérios de aceite

- [x] Digitar `#abc`, `abc`, `#aabbcc` ou `AABBCC` grava `#aabbcc`.
- [x] `red`, `#abcd`, `#aabbccdd` e vazio não gravam; ao sair do campo o texto volta ao valor anterior.
- [x] A pipeta confirma uma cor fora da grade e essa cor fica na entidade e na lista de personalizadas.
- [x] A 11ª cor personalizada derruba a mais antiga. Repetir uma cor só a traz para o início.
- [x] Cor da grade não entra na lista. Abrir um cadastro com cor livre também não.
- [x] Botão direito remove a amostra e deixa a cor da entidade como estava. Limpar zera a cor da entidade e mantém a lista.
- [x] A lista é a mesma no cliente, no ambiente, na conexão, no acesso e na tag, e continua depois de reabrir o app.
- [x] Vitest cobre a normalização e o teto de 10.
- [x] Rótulos em pt-BR, en e es.

## Fora de escopo

- Alfa, conta-gotas da tela, paleta HSL ou nomes CSS.
- Personalizadas sincronizadas com a organização ou com outro computador.
- Editar a grade `ENTITY_COLORS` ou a cor sugerida pelo nome do ambiente.
- Mais de 10 personalizadas, ou pastas de paletas.
- Traduzir outros formulários além das strings do próprio `ColorPicker`.

## Documentação de produto

- Manual: extensão do capítulo `organization` nos 3 locales (feito).
- What's new: fica para o bump da próxima versão. A tag `v0.1.46` já existe, e o diálogo só mostra notas até a versão do app, então esta entrega não entra no patch já publicado.
- Engenharia: sem mudança. O campo `color` e a store `north-ui` já estão descritos; não há ADR (sem dependência, schema, rede ou fronteira de processo).

## Resultado final

Entregue em 2026-10-31, homologado sem ajuste de código.

O `ColorPicker` dos cadastros de cliente, ambiente, conexão, conexão de banco, acesso e tag aceita qualquer hexadecimal (`#RGB`, `#RRGGBB` ou sem `#`, gravado como `#rrggbb`), abre o seletor nativo pela pipeta e reutiliza até 10 cores personalizadas guardadas neste computador. A grade `ENTITY_COLORS` não mudou. Cor da grade não entra na lista. A 11ª derruba a mais antiga. Botão direito remove só a amostra. **Limpar** continua gravando `null`.

Não há coluna nova nem canal IPC. As personalizadas ficam em `favoriteColors` na store `north-ui`. O what's new espera a próxima versão.

Arquivos principais: `src/renderer/src/components/ColorPicker.tsx`, `src/renderer/src/lib/favorite-colors.ts`, `src/renderer/src/stores/ui-store.ts`.
