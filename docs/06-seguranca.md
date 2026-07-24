# Segurança

## Princípios

1. **Credenciais nunca no SQLite em claro** — apenas referências (`credentialRef`) ao armazenamento seguro do SO.
2. **Renderer sem Node** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
3. **Superfície IPC mínima** — só canais do contrato em `shared/ipc`; validar inputs no main.
4. **Links externos** — `setWindowOpenHandler` abre no browser do SO; negar navegação in-app.
5. **CSP no HTML** — restringir `script-src` / `default-src` a `'self'`.

## Credenciais (Parte 8)

| Plataforma | Backend preferido                                                      |
| ---------- | ---------------------------------------------------------------------- |
| macOS      | Keychain via `keytar`                                                  |
| Windows    | Credential Manager via `keytar`                                        |
| Linux      | Secret Service / libsecret via `keytar`                                |
| Fallback   | `safeStorage` do Electron (criptografa com DPAPI/Keychain do Chromium) |

Fluxo:

1. Usuário salva senha/chave → main grava no keychain → retorna `credentialRef`
2. Ao conectar → main resolve `credentialRef` → passa ao cliente (OpenSSH, etc.) sem expor ao renderer

## Hardening Electron

- Desabilitar `nodeIntegration` e manter `sandbox`
- Não expor `ipcRenderer` cru; só a API `window.north`
- Tratar todo payload IPC como não confiável
- Atualizações assinadas (quando houver auto-update)
- Princípio do menor privilégio em entitlements macOS

## Dados locais

- DB SQLite no `userData` do app
- Backup/export (Parte 8) deve permitir excluir segredos ou exportar só metadados
