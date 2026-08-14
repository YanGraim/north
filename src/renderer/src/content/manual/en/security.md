# Security tips

- Credentials live in the **local vault** (Electron `safeStorage` / OS keychain).
- The **renderer never** receives plaintext secrets in the normal flow — only on a conscious reveal (copy/show password).
- Workflow secrets live on the **connection**, never in the definition or group variables.
- Inventory export **does not** include passwords.
- Confirm SSH host key fingerprints before accepting.
- Prefer strong passwords and, when possible, SSH keys instead of passwords.

North is **local-first**: your data stays on the device, with no cloud by default.
