# Modelo de dados

Schema SQLite da Parte 2. Hierarquia:

```
Cliente → Ambiente → Grupo → Servidor (Conexão)
                ↘ Tags (N:N com Conexão)
                ↘ Histórico de uso
```

Arquivo: `north.db` (produção) / `north-dev.db` (dev) em `app.getPath('userData')`.
Migrations versionadas via `PRAGMA user_version` em `src/main/database/migrations`.

**Segurança:** apenas `credentialRef` no SQLite — nunca senha em claro (keychain na Parte 8).

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
| `credentialRef`     | string?   | Referência no keychain (nunca a senha em claro) |
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

## Índices

- `environments(client_id)`, `groups(environment_id)`
- `connections(host)`, `connections(group_id)`, `connections(is_favorite)`
- `connection_tags(tag_id)`
- `connection_history(connection_id, connected_at DESC)`
- Full-text / busca fuzzy sobre `name`, `host`, `notes` (Parte 5)
