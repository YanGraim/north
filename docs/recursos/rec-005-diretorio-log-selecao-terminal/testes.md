# Testes — REC-005 Diretório e log a partir da seleção do terminal

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-10-31
- **Última atualização:** 2026-10-31

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [ ] `npm run lint` — os arquivos deste recurso passam no Biome. `biome check .` neste Windows falha por CRLF no working tree (`core.autocrlf=true`; o índice está em LF). O mesmo já estava no REC-004. Há um aviso pré-existente de `void` em `contract.ts`, fora deste recurso.
- [ ] `npm run test` — `src/shared/lib/selection-path.test.ts` passou (13). A suíte completa teve 24 falhas já existentes de ambiente (VPN/openfortivpn, socket Unix, XDG, `node-pty`). Nenhuma no código deste recurso.
- [ ] `npm run test:e2e` — não se aplica. O harness não abre um terminal SSH com seleção. Não foi executado.

## 2. Roteiro funcional

Precisa de uma conexão SSH de verdade e de um arquivo e uma pasta no servidor. Shell local, telnet e sessão sem conexão servem para o CT-01.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | Terminal SSH de conexão salva, com e sem seleção. Repetir em telnet, terminal local e sessão sem conexão | Windows | SSH mostra **Definir diretório padrão** e **Adicionar arquivo de log**. Sem seleção, os dois ficam indisponíveis. Fora de SSH, os dois não aparecem | ✅ |
| CT-02 | Selecionar um diretório (`/var/www/app`) e um arquivo (`/var/www/html/portal/storage/logs/laravel-2026-10-31.log`, ou outro arquivo que exista) e usar **Definir diretório padrão** | Windows | Diretório grava o próprio path. Arquivo grava o pai. O campo no cadastro continua **Diretório inicial** | ✅ |
| CT-03 | Conexão que já tem diretório inicial diferente. Cancelar, depois confirmar | Windows | Cancelar não grava e o prompt não recebe `cd`. Confirmar grava e o terminal desta sessão entra no diretório | ✅ |
| CT-04 | Diretório inicial vazio; depois repetir com o valor já igual ao gravado | Windows | Vazio grava sem diálogo e faz `cd`. Valor igual não regrava e ainda envia o `cd` | ✅ |
| CT-05 | **Adicionar arquivo de log** num arquivo regular; repetir com um diretório | Windows | O arquivo entra na lista, o quadro abre e o detalhe da conexão mostra o path. Diretório não entra na lista e não abre quadro | ✅ |
| CT-06 | Path já na lista; lista já com 8 arquivos | Windows | Não grava e não abre quadro. O aviso é traduzido | ✅ |
| CT-07 | Selecionar `var/log`, `~outro`, um texto com quebra de linha e um path que não existe. Depois `~/app/app.log` se o arquivo existir | Windows | Os quatro primeiros não gravam. `~/app/app.log` grava como `~/app/app.log` | ✅ |
| CT-08 | Diretório com espaço ou `'` no nome | Windows | O `cd` vai citado. A seleção não vira comando | ✅ |
| CT-09 | Painel SFTP já aberto na mesma conexão; gravar outro diretório pelo terminal; fechar e abrir os arquivos de novo | Windows | O painel que já estava aberto não muda de pasta. A próxima abertura usa o diretório gravado | ✅ |
| CT-10 | Trocar o idioma e abrir o menu e o diálogo | Windows | Rótulos, diálogo e toasts em pt-BR, en e es. O restante do menu continua em português | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | --- |
| 2026-10-31 | Homologação concluída, sem apontamento | — | ✅ |
