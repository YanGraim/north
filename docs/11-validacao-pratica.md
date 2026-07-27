# Validação prática — roteiro do usuário

Checklist para preencher à mão ao configurar ambientes reais. Complementa (não substitui) [09-qa.md](./09-qa.md).

Marque com `[x]` o que passou. Preencha os campos `___` com o que testou.

---

## 1. Preparação

- [ ] `npm run dev` sobe sem erro
- [ ] (Opcional) seed de desenvolvimento carregou dados de exemplo
- [ ] Anotar pasta de dados do app (`userData`):

| SO | Path típico | Seu path |
| --- | --- | --- |
| macOS | `~/Library/Application Support/North/` | ___ |
| Windows | `%APPDATA%\North\` | ___ |
| Linux | `~/.config/North/` | ___ |

Versão do app: `___`  
Data do teste: `___`

---

## 2. Inventário

### Hierarquia

- [ ] Criar 1 cliente — nome: `___`
- [ ] Criar 1 ambiente nesse cliente — nome: `___`
- [ ] Criar 1 grupo nesse ambiente — nome: `___`

### Conexão e accesses

- [ ] Cadastrar 1 conexão SSH — nome: `___` · host: `___` · porta: `___`
- [ ] Cadastrar 1 access tipo **login** — nome: `___` · URL: `___`
- [ ] Cadastrar 1 access tipo **banco** — nome: `___` · engine: `___` · host: `___`
- [ ] Salvar senha no vault (conexão ou access)
- [ ] Revelar senha na UI
- [ ] Copiar senha para a área de transferência

Notas: `___`

---

## 3. SSH

| Cenário | Host | Resultado (ok / falhou) | Observação |
| --- | --- | --- | --- |
| Senha | ___ | ___ | ___ |
| Chave privada | ___ | ___ | ___ |
| Host key (1ª conexão — aceitar) | ___ | ___ | ___ |
| Host key mismatch (rejeitar) | ___ | ___ | ___ |
| Terminal (digitação / resize) | ___ | ___ | ___ |
| Fechar aba → histórico | ___ | ___ | ___ |

- [ ] Sessão abre **dentro** do North (não em cliente externo)
- [ ] Fechar a aba encerra a sessão sem travar a UI

---

## 4. Outros protocolos (opcional por ambiente)

Preencha só o que for relevante no seu ambiente.

| Protocolo | Host / alvo | Resultado | Observação |
| --- | --- | --- | --- |
| SFTP | ___ | ___ | ___ |
| RDP | ___ | ___ | ___ |
| VNC | ___ | ___ | ___ |
| Telnet | ___ | ___ | ___ |
| Serial | porta: ___ | ___ | ___ |

- [ ] Listagem / upload / download SFTP (se aplicável)
- [ ] Desktop remoto com mouse/teclado (RDP/VNC)

---

## 5. Palette / favoritos / dashboard

- [ ] Command palette (`⌘/Ctrl+K`) encontra conexão por typo parcial
- [ ] Marcar favorito — aparece em Favoritos
- [ ] Abrir conexão — aparece em Recentes
- [ ] Dashboard mostra stats / atalhos úteis

---

## 6. Import / export

### JSON

- [ ] Exportar inventário (Settings → Inventário)
- [ ] Arquivo tem `schemaVersion: 2` (ou 1 em builds antigos)
- [ ] JSON **sem** senhas (`includeSecrets: false`, sem `credentialRef` útil)
- [ ] Importar de volta — relatório mostra criados / ignorados
- [ ] Accesses (login/banco) voltam no inventário após import v2

Arquivo exportado: `___`

### CSV (planilha)

- [ ] Baixar CSV modelo (`north-acessos-modelo.csv`)
- [ ] Preencher 1 `servidor` + 1 `banco` + 1 `login`
- [ ] Confirmar aviso de senhas na UI (se o CSV tiver coluna `senha` preenchida)
- [ ] Importar planilha — entidades aparecem na hierarquia correta
- [ ] Senhas do CSV gravadas no vault (quando confirmado)
- [ ] Relatório com erros por linha (ex.: `Linha 12: …`) se houver linha inválida

Arquivo CSV usado: `___`

---

## 7. Build (quando a distribuição estiver pronta)

Ver [10-distribuicao.md](./10-distribuicao.md).

- [ ] `npm run dist:mac` (ou `dist:win` / `dist:linux`) conclui
- [ ] Abrir o instalador / `.dmg` / AppImage
- [ ] Repetir smoke SSH (conectar + digitar + fechar aba)

Artefato: `___`

---

## 8. Registro de bugs

| Data | O que fiz | Esperado | Obtido |
| --- | --- | --- | --- |
| ___ | ___ | ___ | ___ |
| ___ | ___ | ___ | ___ |
| ___ | ___ | ___ | ___ |
| ___ | ___ | ___ | ___ |
