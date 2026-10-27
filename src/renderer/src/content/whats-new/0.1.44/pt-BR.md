## Agente SSH no Windows

- **Encaminhar agente SSH:** no Windows, o North agora encontra o serviço OpenSSH Authentication Agent de forma confiável. Antes, em algumas máquinas, o encaminhamento não funcionava e o `git` no servidor dava *Permission denied*
- **Aviso no terminal:** se o encaminhamento não puder ser ligado (nenhum agente rodando ou servidor recusando), o North avisa em amarelo, como o `ssh -A`

Veja o capítulo [Conectar](connect) no manual.
