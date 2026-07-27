# ADR 0005 — Vault com safeStorage

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

O inventário já persiste `credentialRef` em conexões, mas ainda não havia backend de segredos. Precisávamos de um vault local-first que:

1. Nunca exponha senhas ao renderer
2. Use criptografia do SO (Keychain / DPAPI / Secret Service)
3. Sobreviva a backup atômico do SQLite no `userData`
4. Seja testável em Vitest sem Electron

## Decisão

1. **Backend:** Electron `safeStorage` (não `keytar`).
2. **Persistência:** tabela `credentials` (migration 002) com `id` (UUID = `credentialRef`), `ciphertext` BLOB e timestamps. O blob é o resultado de `safeStorage.encryptString`.
3. **API IPC (só sobe, nunca desce):**
   - `vault:set-secret` → retorna `credentialRef`
   - `vault:delete-secret`
   - `vault:has-secret`
   - `vault:is-available`
   - **Sem** `vault:get-secret` no contrato
4. **`resolveSecret(ref)`** existe apenas no main (`CredentialVault`), para drivers de sessão (Partes 6+).
5. **Abstração `Encryptor`:** `SafeStorageEncryptor` em produção; `FakeEncryptor` / `UnavailableEncryptor` nos testes.
6. **Ciclo de vida:** excluir conexão (ou cascata cliente/ambiente/grupo) apaga o blob; substituir senha atualiza o ciphertext mantendo o mesmo `credentialRef`; duplicar conexão copia o segredo para um novo ref.
7. **Linux sem Secret Service:** `isEncryptionAvailable() === false` — a UI avisa e o campo senha fica opcional; não há fallback inseguro silencioso.

## Alternativas consideradas

| Alternativa | Motivo do descarte |
| --- | --- |
| `keytar` | Biblioteca deprecada; ADR 0004 já apontou `safeStorage` |
| Arquivos soltos em `userData` | Backup/export menos atômico que SQLite; refs mais frágeis |
| Canal `get-secret` tipado | Violaria o princípio “segredo nunca desce ao renderer” |
| Criptografia própria com chave em arquivo | Reimplementa o SO; risco de chave no disco em claro |

## Consequências

- CRUD de conexões já nasce com vault real.
- Docs de modelo de dados passam a documentar a tabela `credentials`.
- Sessões (Parte 6+) resolvem credenciais só no main via `getVault().resolveSecret`.
