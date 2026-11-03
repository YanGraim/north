# Testes — REC-007 Mais fontes mono e controle de ligaturas

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-10-31
- **Última atualização:** 2026-10-31

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [ ] `npm run lint` — `biome check .` neste checkout Windows acusa fim de linha CRLF no restante do repositório (666 erros de formatação, o mesmo tipo já visto no REC-006). Os arquivos deste recurso passam no `biome check` dos caminhos deles.
- [ ] `npm run test` — a suíte completa teve 26 falhas já existentes de ambiente (VPN, caminho XDG, socket Unix). Nenhuma no código deste recurso. `src/renderer/src/lib/mono-font.test.ts` passou: 7 testes (pilha, Cascadia, saneamento da família e da ligadura, ordem das famílias e rótulos nos 3 locales).
- [ ] `npm run test:e2e` — não se aplica. O bloco Fonte do app não tem fluxo no `e2e-harness`.

## 2. Roteiro funcional

O seletor fica em **Configurações → Fonte do app**. O terminal e o quadro de log precisam de uma sessão SSH. Os editores, de um SQL Studio ou API Studio aberto.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Abrir o seletor de família | Windows | As nove famílias novas vêm depois das cinco de hoje, nesta ordem: Ubuntu Mono, Fira Code, Source Code Pro, Cascadia, Hack, Inconsolata, Roboto Mono, Space Mono, Noto Sans Mono. O rótulo de Cascadia é «Cascadia». Só IBM Plex Mono leva o sufixo de padrão. O preview desenha a face escolhida, na frase localizada de hoje | ✅ |
| CT-02 | Instalação sem a chave `monoLigatures`, e um valor persistido que não é boolean. Família persistida desconhecida | Windows | Ligaduras abrem desligadas. Família desconhecida abre em IBM Plex Mono. Não aparece toast | ✅ |
| CT-03 | Com ligaduras desligadas, escrever `=>`, `!=` e `->` no terminal. Ligar o interruptor em Fira Code, JetBrains Mono e Cascadia | Windows | Desligado, cada sequência fica em dois glifos. Ligado, essas três faces juntam as três sequências. Courier New e Ubuntu Mono continuam em dois glifos, sem erro | ✅ |
| CT-04 | Escolher Cascadia e alternar o interruptor | Windows | Desligado, a face é Cascadia Mono. Ligado, Cascadia Code. As outras famílias não trocam de arquivo | ✅ |
| CT-05 | Com uma sessão SSH aberta e texto no scrollback, trocar família, tamanho e ligadura. Repetir no quadro de log | Windows | A sessão não cai e o scrollback permanece. O quadro de log não é recriado e não perde as linhas | ✅ |
| CT-06 | Com ligaduras ligadas, selecionar o glifo de `=>` e copiar | Windows | A área de transferência recebe os caracteres `=>`. O cursor anda uma célula por caractere | ✅ |
| CT-07 | Ligar e desligar o interruptor com SQL Studio, API Studio, hosts, portas e atalhos visíveis | Windows | A interface inteira que já usa a fonte acompanha. Desligado, `=>` no editor separa. Ligado, junta quando a face tem o glifo | ✅ |
| CT-08 | Abrir o app sem rede e olhar as fontes novas | Windows | Ubuntu Mono, Hack e Space Mono entram só no peso 400. As demais novas, em 400 e 500. Nenhuma pede fonte na rede | ✅ |
| CT-09 | Trocar o idioma e abrir o bloco | Windows | Rótulo e nome acessível do interruptor em pt-BR, en e es. Os nomes de fonte permanecem o nome da família | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | --- |
| 2026-10-31 | Homologação concluída, sem apontamento | — | ✅ |
