# Modelo de dados

Base para o schema SQLite da Parte 2. Hierarquia:

```
Cliente → Ambiente → Grupo → Servidor (Conexão)
                ↘ Tags (N:N com Conexão)
                ↘ Histórico de uso
```

## Cliente

| Campo       | Tipo     | Notas                         |
| ----------- | -------- | ----------------------------- |
| `id`        | UUID     | PK                            |
| `name`      | string   | Nome do cliente / organização |
| `notes`     | text?    | Observações                   |
| `color`     | string?  | Cor de identificação na UI    |
| `createdAt` | datetime |                               |
| `updatedAt` | datetime |                               |

## Ambiente

| Campo                     | Tipo     | Notas                           |
| ------------------------- | -------- | ------------------------------- |
| `id`                      | UUID     | PK                              |
| `clientId`                | UUID     | FK → Cliente                    |
| `name`                    | string   | ex.: Produção, Staging, Homolog |
| `notes`                   | text?    |                                 |
| `sortOrder`               | int      | Ordenação manual                |
| `createdAt` / `updatedAt` | datetime |                                 |

## Grupo

| Campo                     | Tipo     | Notas                 |
| ------------------------- | -------- | --------------------- |
| `id`                      | UUID     | PK                    |
| `environmentId`           | UUID     | FK → Ambiente         |
| `name`                    | string   | ex.: App, Banco, Edge |
| `notes`                   | text?    |                       |
| `sortOrder`               | int      |                       |
| `createdAt` / `updatedAt` | datetime |                       |

## Servidor / Conexão

| Campo                     | Tipo      | Notas                                           |
| ------------------------- | --------- | ----------------------------------------------- |
| `id`                      | UUID      | PK                                              |
| `groupId`                 | UUID      | FK → Grupo                                      |
| `name`                    | string    | Nome amigável                                   |
| `protocol`                | enum      | `ssh` \| `rdp` \| …                             |
| `host`                    | string    | Hostname ou IP                                  |
| `port`                    | int       | Default por protocolo                           |
| `username`                | string?   |                                                 |
| `authMethod`              | enum      | `password` \| `key` \| `agent` \| `none`        |
| `credentialRef`           | string?   | Referência no keychain (nunca a senha em claro) |
| `privateKeyPath`          | string?   | Caminho local da chave (opcional)               |
| `jumpHostId`              | UUID?     | FK → outra Conexão (bastion)                    |
| `defaultCommand`          | string?   | Comando pós-login (SSH)                         |
| `notes`                   | markdown? | Notas ricas                                     |
| `isFavorite`              | bool      |                                                 |
| `lastConnectedAt`         | datetime? |                                                 |
| `createdAt` / `updatedAt` | datetime  |                                                 |

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

| Campo          | Tipo |
| -------------- | ---- |
| `connectionId` | UUID |
| `tagId`        | UUID |

## Histórico de conexão

| Campo          | Tipo     | Notas         |
| -------------- | -------- | ------------- |
| `id`           | UUID     | PK            |
| `connectionId` | UUID     | FK            |
| `connectedAt`  | datetime |               |
| `durationMs`   | int?     | Se mensurável |
| `success`      | bool     |               |
| `errorMessage` | string?  |               |

## Índices sugeridos (Parte 2)

- `connection(host)`, `connection(groupId)`, `connection(isFavorite)`
- `history(connectionId, connectedAt DESC)`
- Full-text / busca fuzzy sobre `name`, `host`, `notes` (Parte 5)
