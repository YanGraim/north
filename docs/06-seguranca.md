# Segurança

## Princípios

1. **Credenciais nunca no SQLite em claro** — apenas referências (`credentialRef`) ao vault local.
2. **Renderer sem Node** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
3. **Superfície IPC mínima** — só canais do contrato em `shared/ipc`; validar inputs no main.
4. **Segredos fora do plano de dados** — `MessagePort` transporta bytes de sessão; credenciais resolvem só no main.
5. **Links externos** — `setWindowOpenHandler` abre no browser do SO; negar navegação in-app.
6. **CSP no HTML** — restringir `script-src` / `default-src` a `'self'` (WASM de RDP com política explícita quando necessário).

## Vault de credenciais (Parte 4)

Backend único: **`safeStorage` do Electron** (criptografa com Keychain/DPAPI/libsecret via Chromium). `keytar` está deprecado e **não** será usado.

| Plataforma | Mecanismo efetivo via `safeStorage`      |
| ---------- | ---------------------------------------- |
| macOS      | Keychain (Chromium)                      |
| Windows    | DPAPI                                    |
| Linux      | Secret Service / backend do Chromium     |

Fluxo:

1. Usuário salva senha/chave → main grava blob cifrado com `safeStorage` → retorna `credentialRef`
2. Ao abrir sessão → main resolve `credentialRef` → entrega ao driver **sem** expor o segredo ao renderer
3. UI recebe só estado da sessão e metadados (host, usuário mascarado, etc.)
4. **Reveal pontual (Access / Connection):** `vault:reveal-secret` devolve plaintext ao renderer **somente** se o `credentialRef` for owned por um `Access` ou `Connection`. UI mascara, revela temporariamente (~15s) e copia sob demanda. Senha nunca entra no `search:index` nem no export padrão.

Canais IPC do vault: `set-secret`, `delete-secret`, `has-secret`, `is-available`, `reveal-secret`.

Ver [ADR 0012](./adr/0012-accesses-tema-i18n.md).

## Sessões remotas

### SSH — host key checking

- Manter known_hosts local (arquivo ou tabela dedicada no `userData`).
- Na primeira conexão: prompt de confiança (fingerprint) antes de gravar.
- Em mismatch: bloquear e exigir confirmação explícita (não sobrescrever em silêncio).
- Preferir verificação estrita; “aceitar sempre” só com opt-in consciente.

### RDP / VNC — TLS e certificados

- Ponte TCP/TLS no main; o renderer/WASM não abre sockets crus ao host.
- Validar cadeia de certificados quando o protocolo usar TLS; permitir exceção explícita do usuário (pin / trust store local via mesmo fluxo do host-key SSH, `keyType: 'tls'`), nunca trust-all por padrão.
- Não logar material de autenticação NLA/credenciais no plano de controle.

### Exceção documentada — credenciais em sessão desktop

Clientes WASM (noVNC / IronRDP) precisam da senha no renderer para o handshake do protocolo gráfico. Regra:

1. O main resolve o segredo via vault e envia **uma única vez** no MessagePort da sessão (`type: 'desktop-auth'`).
2. O payload **não** passa por `window.north` nem por canais `invoke` de inventário/vault.
3. O renderer consome e descarta; não persiste em store/disco.
4. Ver [ADR 0009](./adr/0009-desktop-remoto-wasm.md).

### Isolamento

- Um `MessagePort` por sessão; fechar a porta ao encerrar a sessão.
- Drivers rodam no main; falha de um protocolo não deve derrubar o processo de UI.

## Hardening Electron

- Desabilitar `nodeIntegration` e manter `sandbox`
- Não expor `ipcRenderer` cru; só a API `window.north`
- Tratar todo payload IPC como não confiável
- Atualizações assinadas (quando houver auto-update)
- Princípio do menor privilégio em entitlements macOS

## Dados locais

- DB SQLite no `userData` do app
- Blobs do vault no `userData`, cifrados por `safeStorage`
- Backup/export (Parte 10) deve permitir excluir segredos ou exportar só metadados
