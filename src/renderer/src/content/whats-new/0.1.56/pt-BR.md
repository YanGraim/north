## Workflows mais confiáveis na organização

- **Tags de deploy na organização:** o campo **Tag de deploy** dos workflows da organização volta a listar as tags do repositório. Se não for possível listá-las, o North mostra o erro em vez de "nenhuma tag"
- **Sudo sem senha:** em servidores com sudo sem senha, os steps com sudo deixam de pedir a senha
- **Falhas deixam de passar em silêncio:** steps com senha Git ou sudo que falhavam sem aviso agora mostram o erro do comando e o workflow falha. Se algum workflow passar a falhar, é a falha real do servidor que antes ficava escondida

Veja o capítulo [Workflows](workflows) no manual.
