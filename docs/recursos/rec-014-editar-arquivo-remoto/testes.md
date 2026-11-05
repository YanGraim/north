# Testes — REC-014 Editar arquivo remoto e enviar ao salvar

- **Status da homologação:** ✅ Homologado
- **Início:** 2026-11-04
- **Última atualização:** 2026-11-04

## 1. Validações automatizadas

- [x] `npm run typecheck`
- [x] `npm run test` — `src/shared/lib/remote-edit.test.ts` (12 testes: texto vazio, NUL, acima de 8 MiB, spawn sem shell e sem o caminho remoto)
- [x] `npm run test:e2e` — `cypress/e2e/ftp/file-browser.cy.ts` (10 testes). Cobre **Editar** no remoto, aba interna, **Editar com…** indisponível sem editor cadastrado, ausência no painel local e pasta com **Editar** indisponível
- [ ] `npm run lint` — o Biome do repositório acusa fins de linha CRLF em arquivos antigos. Os arquivos deste recurso passaram em `biome check` isolado
- [ ] `npm run test` completo — a suíte tem 25 falhas já existentes nesta máquina (socket Unix, caminhos POSIX, helper de VPN no Linux). Nenhuma é deste recurso

## 2. Roteiro funcional

Homologado em 2026-11-04 no Windows, sem ajuste de código.

| # | Cenário | Plataforma | Resultado esperado | Status |
| --- | --- | --- | --- | :---: |
| CT-01 | No painel remoto, **Editar** um `.conf` ou `.sh`. Alterar e **Salvar** (ou Ctrl/Cmd+S) | Windows | O arquivo no servidor é substituído. A aba deixa de marcar alteração | ✅ |
| CT-02 | Cadastrar um editor em Configurações → Editores. **Editar com…** e gravar nesse programa | Windows | O remoto é substituído, sem perguntar se o original mudou | ✅ |
| CT-03 | **Editar** uma pasta, um binário e um arquivo acima de 8 MiB | Windows | Aviso, sem abrir editor e sem enviar | ✅ |
| CT-04 | Sem editor cadastrado, abrir o menu. Incluir e remover em Configurações | Windows | **Editar com…** fica indisponível. O submenu acompanha a lista | ✅ |
| CT-05 | Fechar a aba com alteração não salva. Fechar a sessão com o editor externo ainda aberto e gravar de novo | Windows | O temporário some. Gravar depois não envia. A sessão não fica aberta à espera do editor | ✅ |
| CT-06 | Clique duplo e **Abrir** num remoto. Copiar um arquivo que já existe no outro painel | Windows | Continua baixando para a pasta local. A cópia entre painéis ainda pergunta antes de substituir | ✅ |
| CT-07 | Menu do painel local e do espelho da pasta do terminal | Windows | Não mostram **Editar** | ✅ |
| CT-08 | Repetir CT-01 numa sessão FTP e numa SFTP | Windows | Os dois enviam ao salvar | ✅ |
| CT-09 | Trocar o idioma para English e Español e abrir o menu, a aba e Configurações → Editores | Windows | Rótulos de **Editar**, **Salvar**, dos avisos e da seção acompanham o idioma | ✅ |

## 3. Registro de execução e ajustes

| Data | Apontamento | Ajuste aplicado / arquivos | Status |
| --- | --- | --- | --- |
| 2026-11-04 | Recurso testado com sucesso | Sem ajuste de código | ✅ |
