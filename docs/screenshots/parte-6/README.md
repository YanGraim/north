# Screenshots / validação — Parte 6

## Etapa 0 — UI

| Item | Status |
| --- | --- |
| Sidebar: indentação/altura uniforme, dots de ambiente, hover/ativo sutis | Implementado |
| Rodapé Configurações (placeholder) | Implementado |
| Modal de conexão com nav lateral + footer fixo | Implementado |
| Host largo / porta curta | Implementado |

Referência visual: `docs/screenshots/parte-4.5/after-connections.png`.

## Critérios de aceite (sessões)

| Critério | Como validar |
| --- | --- |
| Conectar SSH (senha e chave) | `npm run dev` → Conectar em conexão SSH com credencial no vault / `privateKeyPath` |
| Prompt de fingerprint na 1ª vez | Host novo → diálogo HostKey → Confiar |
| Mismatch bloqueia | Alterar chave no servidor conhecido → diálogo com aviso vermelho |
| Terminal interativo + resize | Abrir `vim`/`htop`; redimensionar janela |
| Múltiplas abas keep-alive | Abrir 2+ sessões; trocar abas sem perder estado |
| Fechar aba grava histórico | `⌘W` → Histórico com duração |
| Auth falha sem derrubar o app | Senha errada → toast/erro na aba |
| `lint` / `typecheck` / `test` | `npm run lint && npm run typecheck && npm test` |

## Automação

- Unit: `ssh-utils`, `ProtocolManager` (ciclo de vida + histórico + known_hosts), migrations `003`
- SSH real: requer servidor acessível (porta 22 local estava fechada no ambiente de CI/dev desta entrega)
