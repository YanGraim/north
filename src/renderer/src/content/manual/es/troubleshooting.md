# Problemas conocidos

Síntomas que aparecen con North en uso y qué hacer en tu máquina. North no aplica la corrección.

## `git push` con HTTP 408

> guidance

Con la VPN encendida, `git push` por HTTPS termina en `RPC failed; HTTP 408` y `unexpected disconnect while reading sideband packet`. Un pack de unos cientos de bytes pasa. Un pack por encima de cerca de 1 KB no.

En el entorno donde corre `git` (en Windows con IPsec, la distro WSL de trabajo):

```bash
git config --global http.version HTTP/1.1
git config --global http.extraHeader "Expect:"
```

Sin `--global`, las dos opciones valen solo para ese repositorio. `HTTP/1.1` saca el push de HTTP/2. El `Expect` vacío impide la espera del `100 Continue`, que curl envía cuando el cuerpo pasa de 1024 bytes.
