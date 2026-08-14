# Modelo de dados

Schema SQLite (Partes 2–4). Hierarquia:

```
Cliente → Ambiente → Grupo → Servidor (Conexão)
                           ↘ Acesso (database | login | other)
                           ↘ Variáveis de grupo (config plaintext)
                           ↘ Workflows (+ runs com snapshot)
                ↘ Tags (N:N com Conexão e Access)
                ↘ Histórico de uso
                ↘ Credentials (vault, blobs cifrados)
                ↘ connection_secrets (bolsa por kind → credential_ref)
                ↘ known_hosts (SSH host keys)
```
Arquivo: `north.db` (produção) / `north-dev.db` (dev) em `app.getPath('userData')`.
Migrations versionadas via `PRAGMA user_version` em `src/main/database/migrations`.

**Segurança:** secrets só na conexão (bolsa `connection_secrets` + vault) — nunca em workflows, variáveis de grupo ou snapshots de run. Blobs cifrados com Electron `safeStorage` na tabela `credentials` (Parte 4 / ADR 0005; Workflows / ADR 0014).

## Cliente

| Campo       | Tipo     | Notas                         |
| ----------- | -------- | ----------------------------- |
| `id`        | UUID     | PK                            |
| `name`      | string   | Nome do cliente / organização |
| `notes`     | text?    | Observações                   |
| `color`     | string?  | Cor de identificação na UI    |
| `createdAt` | datetime | ISO-8601                      |
| `updatedAt` | datetime | ISO-8601                      |

## Ambiente

| Campo                     | Tipo     | Notas                           |
| ------------------------- | -------- | ------------------------------- |
| `id`                      | UUID     | PK                              |
| `clientId`                | UUID     | FK → Cliente (`ON DELETE CASCADE`) |
| `name`                    | string   | ex.: Produção, Staging, Homolog |
| `notes`                   | text?    |                                 |
| `sortOrder`               | int      | Ordenação manual                |
| `createdAt` / `updatedAt` | datetime |                                 |

## Grupo

| Campo                     | Tipo     | Notas                 |
| ------------------------- | -------- | --------------------- |
| `id`                      | UUID     | PK                    |
| `environmentId`           | UUID     | FK → Ambiente (`ON DELETE CASCADE`) |
| `name`                    | string   | ex.: App, Banco, Edge |
| `notes`                   | text?    |                       |
| `sortOrder`               | int      |                       |
| `createdAt` / `updatedAt` | datetime |                       |

## Servidor / Conexão

| Campo               | Tipo      | Notas                                           |
| ------------------- | --------- | ----------------------------------------------- |
| `id`                | UUID      | PK                                              |
| `groupId`           | UUID      | FK → Grupo (`ON DELETE CASCADE`)                |
| `name`              | string    | Nome amigável                                   |
| `description`       | text?     | Resumo curto para listas                        |
| `protocol`          | enum      | `ssh` \| `rdp` \| `vnc` \| `sftp` \| `telnet` \| `http` \| `https` \| `custom` |
| `host`              | string    | Hostname ou IP                                  |
| `port`              | int       | Default por protocolo                           |
| `username`          | string?   |                                                 |
| `authMethod`        | enum      | `password` \| `key` \| `agent` \| `none`        |
| `credentialRef`     | string?   | FK lógica → `credentials.id` (nunca a senha)    |
| `privateKeyPath`    | string?   | Caminho local da chave (opcional)               |
| `jumpHostId`        | UUID?     | FK → outra Conexão (bastion), `ON DELETE SET NULL` |
| `defaultCommand`    | string?   | Comando pós-login (SSH)                         |
| `notes`             | markdown? | Notas ricas                                     |
| `os`                | string?   | SO do host (ex.: Ubuntu 24.04)                  |
| `icon`              | string?   | Ícone Lucide / chave visual                     |
| `color`             | string?   | Cor de identificação                            |
| `owner`             | string?   | Responsável                                     |
| `links`             | JSON?     | Array `{ label, url }`                          |
| `vpnRequired`       | bool      | Exige VPN antes de conectar                     |
| `checklist`         | JSON?     | Array `{ id, text, done }`                      |
| `relatedFiles`      | JSON?     | Array de caminhos locais                        |
| `isFavorite`        | bool      |                                                 |
| `accessCount`       | int       | Contagem de conexões bem-sucedidas / tentativas |
| `totalConnectedMs`  | int       | Tempo total conectado (ms)                      |
| `lastConnectedAt`   | datetime? |                                                 |
| `createdAt` / `updatedAt` | datetime |                                           |

### Campos extras por protocolo (futuro / JSON)

- SSH: `sshOptions`, `forwardAgent`, `localForwards`
- RDP: `domain`, `screenSize`, `fullscreen`

## Credentials (vault)

| Campo        | Tipo     | Notas                                              |
| ------------ | -------- | -------------------------------------------------- |
| `id`         | UUID     | PK — valor de `connections.credential_ref`         |
| `ciphertext` | BLOB     | Saída de `safeStorage.encryptString` (nunca claro) |
| `createdAt`  | datetime |                                                    |
| `updatedAt`  | datetime | Atualizado ao substituir a senha (ref estável)     |

O renderer só chama `vault:set-secret` / `delete-secret` / `has-secret` / `is-available` / `reveal-secret`. Resolução de plaintext (`resolveSecret`) é exclusiva do main — exceto `vault:reveal-secret`, que devolve a string ao renderer **somente** após checagem de ownership (o `credentialRef` deve pertencer a um `Access` ou a uma `Connection`).

## Acesso (Access)

Inventário de segredo/metadado (login de portal, credencial de banco). **Não** abre sessão. Ver [ADR 0012](./adr/0012-accesses-tema-i18n.md).

| Campo               | Tipo      | Notas                                           |
| ------------------- | --------- | ----------------------------------------------- |
| `id`                | UUID      | PK                                              |
| `groupId`           | UUID      | FK → Grupo (`ON DELETE CASCADE`)                |
| `type`              | enum      | `database` \| `login` \| `other`                |
| `name`              | string    |                                                 |
| `description`       | text?     |                                                 |
| `notes`             | markdown? |                                                 |
| `username`          | string?   |                                                 |
| `credentialRef`     | string?   | FK lógica → `credentials.id`                    |
| `url`               | string?   | Portal / admin / API                            |
| `links`             | JSON?     | Array `{ label, url }`                          |
| `icon` / `color`    | string?   |                                                 |
| `isFavorite`        | bool      |                                                 |
| `engine`            | enum?     | Só `database`: postgres, mysql, mariadb, redis, mongodb, mssql, other |
| `host` / `port`     | string?/int? | Só `database`                                |
| `database`          | string?   | Nome da base (coluna SQL `database_name`)       |
| `ssl`               | bool?     | Só `database`                                   |
| `createdAt` / `updatedAt` | datetime |                                           |

## AccessTag (N:N)

| Campo      | Tipo | Notas |
| ---------- | ---- | ----- |
| `accessId` | UUID | FK → Access (`ON DELETE CASCADE`) |
| `tagId`    | UUID | FK → Tag (`ON DELETE CASCADE`) |

## Tag

| Campo   | Tipo    | Notas                    |
| ------- | ------- | ------------------------ |
| `id`    | UUID    | PK                       |
| `name`  | string  | Único (case-insensitive) |
| `color` | string? |                          |

## ConexãoTag (N:N)

| Campo          | Tipo | Notas |
| -------------- | ---- | ----- |
| `connectionId` | UUID | FK → Conexão (`ON DELETE CASCADE`) |
| `tagId`        | UUID | FK → Tag (`ON DELETE CASCADE`) |

## Histórico de conexão

| Campo          | Tipo     | Notas         |
| -------------- | -------- | ------------- |
| `id`           | UUID     | PK            |
| `connectionId` | UUID     | FK (`ON DELETE CASCADE`) |
| `connectedAt`  | datetime |               |
| `durationMs`   | int?     | Se mensurável |
| `success`      | bool     |               |
| `errorMessage` | string?  |               |

## known_hosts (SSH)

Gravado pelo `ProtocolManager` após o usuário confiar na fingerprint (Parte 6 / ADR 0007).

| Campo         | Tipo     | Notas                                      |
| ------------- | -------- | ------------------------------------------ |
| `id`          | UUID     | PK                                         |
| `host`        | string   | Hostname ou IP                             |
| `port`        | int      |                                            |
| `keyType`     | string   | ex.: `ssh-ed25519`, `ssh-rsa`              |
| `fingerprint` | string   | `SHA256:…` (base64 sem padding)            |
| `publicKey`   | BLOB     | Chave pública bruta do host                |
| `createdAt` / `updatedAt` | datetime |                              |

Unique: `(host, port, keyType)`. Em mismatch, a UI bloqueia e só atualiza após confirmação explícita.

## Variáveis de grupo (Workflows)

Config plaintext compartilhada pelos workflows do grupo. **Nunca** secrets. Ver [ADR 0014](./adr/0014-workflows.md).

| Campo         | Tipo     | Notas                          |
| ------------- | -------- | ------------------------------ |
| `id`          | UUID     | PK                             |
| `groupId`     | UUID     | FK → Grupo (`ON DELETE CASCADE`) |
| `key`         | string   | Único por grupo (ex.: `PROJECT_PATH`) |
| `value`       | string   | Plaintext de configuração      |
| `description` | text?    |                                |
| `createdAt` / `updatedAt` | datetime |                    |

## Workflow

| Campo                   | Tipo     | Notas                                      |
| ----------------------- | -------- | ------------------------------------------ |
| `id`                    | UUID     | PK                                         |
| `groupId`               | UUID     | FK → Grupo (`ON DELETE CASCADE`)           |
| `name`                  | string   |                                            |
| `description`           | text?    |                                            |
| `icon`                  | string?  |                                            |
| `preferredConnectionId` | UUID?    | Atalho; `ON DELETE SET NULL`               |
| `sortOrder`             | int      |                                            |
| `definition`            | JSON     | `{ schemaVersion, inputs, steps }`         |
| `createdAt` / `updatedAt` | datetime |                                        |

## WorkflowRun

| Campo                 | Tipo     | Notas                                              |
| --------------------- | -------- | -------------------------------------------------- |
| `id`                  | UUID     | PK                                                 |
| `workflowId`          | UUID     | FK → Workflow (`ON DELETE CASCADE`)                |
| `groupId`             | UUID     | Denormalizado                                      |
| `mode`                | enum     | `live` \| `dry-run`                                |
| `status`              | enum     | pending/running/succeeded/failed/cancelled/paused  |
| `targets`             | JSON     | `[{ connectionId }]` (MVP: length 1)               |
| `definitionSnapshot`  | JSON     | Imutável no start                                  |
| `variablesSnapshot`   | JSON     | Group vars + inputs resolvidos                     |
| `inputValues`         | JSON     | Valores do formulário pré-run                      |
| `startedAt`           | datetime |                                                    |
| `finishedAt`          | datetime?|                                                    |

## connection_secrets

Bolsa de secrets por conexão (`kind` → `credential_ref`). Migração do `connections.credential_ref` legado.

| Campo           | Tipo     | Notas                                      |
| --------------- | -------- | ------------------------------------------ |
| `id`            | UUID     | PK                                         |
| `connectionId`  | UUID     | FK → Conexão (`ON DELETE CASCADE`)         |
| `kind`          | string   | ex.: `password`, `passphrase`, `sudo`      |
| `credentialRef` | UUID     | FK lógica → `credentials.id`               |
| `createdAt` / `updatedAt` | datetime |                                |

Unique: `(connection_id, kind)`.

## Índices

- `environments(client_id)`, `groups(environment_id)`
- `connections(host)`, `connections(group_id)`, `connections(is_favorite)`
- `connection_tags(tag_id)`
- `connection_history(connection_id, connected_at DESC)`
- `known_hosts(host, port)`
- `group_variables(group_id)`, `workflows(group_id)`, `workflow_runs(workflow_id)`
- `connection_secrets(connection_id)`
- Full-text / busca fuzzy sobre `name`, `host`, `notes` (Parte 5)
