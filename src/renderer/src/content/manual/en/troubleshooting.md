# Known issues

Symptoms that show up while using North, and what to do on your machine. North does not apply the fix.

## `git push` with HTTP 408

> guidance

With the VPN on, `git push` over HTTPS ends in `RPC failed; HTTP 408` and `unexpected disconnect while reading sideband packet`. A pack of a few hundred bytes goes through. A pack above about 1 KB does not.

In the environment where `git` runs (on Windows with IPsec, your working WSL distro):

```bash
git config --global http.version HTTP/1.1
git config --global http.extraHeader "Expect:"
```

Without `--global`, both options apply only to that repository. `HTTP/1.1` takes the push off HTTP/2. The empty `Expect` stops the wait for `100 Continue`, which curl sends when the body exceeds 1024 bytes.
