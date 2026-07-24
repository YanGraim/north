# Stack

| Tecnologia                           | Papel                         | Por quê                                             |
| ------------------------------------ | ----------------------------- | --------------------------------------------------- |
| **Electron**                         | Shell desktop multiplataforma | Acesso a SO, janelas, keychain, spawn de clientes   |
| **electron-vite**                    | Build dos 3 processos + HMR   | Padrão atual; evita Vite triplo manual              |
| **React 19**                         | UI do renderer                | Ecossistema maduro + composição por features        |
| **TypeScript (strict)**              | Tipagem ponta a ponta         | Contrato IPC e domínio sem drift                    |
| **Tailwind CSS v4**                  | Estilo utilitário             | Tokens no `@theme`; velocidade com consistência     |
| **shadcn/ui**                        | Primitivos de UI              | Componentes copiados/controlados, não caixa-preta   |
| **Lucide**                           | Ícones                        | Leve, consistente, acessível                        |
| **React Router**                     | Navegação (HashRouter)        | Compatível com `file://` no build Electron          |
| **Zustand**                          | Estado de UI                  | Simples; sem boilerplate para sidebar, modais, etc. |
| **TanStack Query**                   | Cache/async de dados IPC      | Loading/error/retry padronizados para invokes       |
| **better-sqlite3** _(Parte 2)_       | Persistência local            | Rápido, embutido, adequado a inventário offline     |
| **keytar / safeStorage** _(Parte 8)_ | Credenciais                   | Keychain nativo com fallback Electron               |
| **ESLint + Prettier**                | Qualidade de código           | Flat config + formatação única                      |
| **Husky + lint-staged**              | Gate no commit                | Lint/format só nos arquivos staged                  |
| **electron-builder**                 | Empacotamento                 | DMG / NSIS / AppImage                               |

## Package manager

**npm** — melhor compatibilidade com `electron-builder` e rebuild de nativos (`better-sqlite3`).

## O que fica fora do renderer

Qualquer I/O de SO, banco, filesystem sensível ou spawn de processos vive no **main**. O renderer só fala com `window.north`.
