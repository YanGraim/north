## Terminal

- **Colar imagem:** cole uma imagem do clipboard (ex.: um screenshot) direto no terminal — o North salva num arquivo temporário e cola o caminho, do jeito que iTerm2/Terminal.app fazem. Útil pra CLIs de agente como Claude Code.

## Agentes

- **Aviso de branch em uso:** ao criar um workspace com uma branch que já está aberta em outro lugar (inclusive na pasta principal do repositório), o North avisa e mostra onde, em vez de só falhar depois de tentar

Ver os capítulos [Conectar](connect) e [Agentes](agents) no manual.

## Cliente API

- **Comentários no JSON:** o body JSON agora aceita `//` e `/* */` — o North remove antes de enviar, então a API de destino sempre recebe JSON válido
- **Notas na request:** nova aba **Notas** pra documentar o que uma request faz, visível como tooltip na árvore de Collections

Ver o capítulo [Cliente API](api) no manual.
