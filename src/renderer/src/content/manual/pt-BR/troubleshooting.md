# Problemas conhecidos

Sintomas que aparecem com o North em uso e o que fazer na sua máquina. O North não aplica a correção.

## `git push` com HTTP 408

> guidance

Com a VPN ligada, `git push` por HTTPS termina em `RPC failed; HTTP 408` e `unexpected disconnect while reading sideband packet`. Um pack de algumas centenas de bytes passa. Um pack acima de cerca de 1 KB não.

No ambiente em que o `git` roda (no Windows com IPsec, a distro WSL de trabalho):

```bash
git config --global http.version HTTP/1.1
git config --global http.extraHeader "Expect:"
```

Sem `--global`, as duas opções valem só para aquele repositório. `HTTP/1.1` tira o push do HTTP/2. O `Expect` vazio impede a espera do `100 Continue`, que o curl envia quando o corpo passa de 1024 bytes.
