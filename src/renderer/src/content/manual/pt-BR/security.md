# Dicas de segurança

- Credenciais ficam no **vault local** (Electron `safeStorage` / keychain do SO).
- O processo **renderer nunca** recebe segredos em claro no fluxo normal — só no reveal consciente (copiar/mostrar senha).
- Secrets de workflow ficam na **conexão**, nunca na definition nem nas variáveis de grupo.
- Exportação de inventário **não** leva senhas.
- Confirme fingerprints de host key SSH antes de aceitar.
- Prefira senhas fortes e, quando possível, chaves SSH em vez de senha.

North é **local-first**: seus dados ficam no dispositivo, sem nuvem por padrão.
