# Distribuição e release

Empacotamento com **electron-builder**, publicação em **GitHub Releases** e auto-update via **electron-updater**. Ver também [ADR 0010](./adr/0010-import-export-update.md), [ADR 0011](./adr/0011-settings-e-release.md) e [ADR 0013](./adr/0013-import-csv-acessos.md).

## Convenção: `build` vs `dist`

| Script | Faz |
| --- | --- |
| `npm run build` | Typecheck + `electron-vite build` → bundle em `out/` |
| `npm run dist` | `build` + instalador da plataforma atual → `release/` |
| `npm run dist:mac` / `dist:win` / `dist:linux` | `build` + target da plataforma |
| `npm run dist:dir` | `build` + app unpacked (`--dir`) para smoke rápido |

Saídas:

```
out/       # main / preload / renderer (electron-vite)
release/   # .dmg / NSIS / .AppImage (+ blockmap, latest*.yml)
```

`build` = só compilação. Empacotar = `dist*`.

## Configuração atual

Arquivo: [`electron-builder.yml`](../electron-builder.yml) (fonte única — não duplicar no `package.json`).

| Item | Valor |
| --- | --- |
| `appId` | `app.north.desktop` |
| `productName` | North (`package.json` + `app.setName('North')` no main) |
| Output | `directories.output: release` |
| macOS | DMG (primário) + zip (útil para updater/GitHub); `notarize: false` |
| Windows | NSIS (`North-${version}-setup.exe`) |
| Linux | AppImage (`North-${version}.AppImage`) |
| Nativos | `npmRebuild: true` (`better-sqlite3`, `serialport`) |
| Publish | `provider: github`, `owner: YanGraim`, `repo: north` |

Recursos em `build/`:

- `entitlements.mac.plist` / `entitlements.mac.inherit.plist` — JIT / memória para WASM (RDP)
- `icon.icns` / `icon.ico` / `icon.png` — brand oficial (N + bússola)
- Runtime Linux: `resources/icon.png` (janela)
- Modelo de planilha: `resources/templates/north-acessos-modelo.csv` (também baixável em Settings → Inventário)

### userData

Paths esperados (nunca ao lado do `.app` / instalador):

- macOS: `~/Library/Application Support/North/`
- Windows: `%APPDATA%/North/`
- Linux: `~/.config/North/`

**Migração:** quem já rodou em dev com pasta `north` (minúsculo, derivado só de `name`) não vê dados automaticamente em `North`. Mover a pasta manualmente ou, no futuro, one-shot migrate.

Dev updater: [`dev-app-update.yml`](../dev-app-update.yml) aponta para o mesmo repositório GitHub.

## Builds locais

```bash
npm run build          # só compile → out/
npm run dist           # instalador da plataforma atual → release/
npm run dist:mac       # .dmg (+ zip)
npm run dist:win       # NSIS .exe
npm run dist:linux     # AppImage
npm run dist:dir       # app unpacked (smoke)
```

`postinstall` já roda `electron-builder install-app-deps` para recompilar addons nativos contra o Electron do projeto.

### Limitações

- **Cross-compile:** gerar `.exe` no mac (ou AppImage no Windows) exige CI na plataforma alvo ou wine frágil — rode `dist:win` / `dist:linux` no SO correspondente.
- **Assinatura / notarize:** Gatekeeper e SmartScreen avisam sem certificados; `notarize: false` permanece até haver Apple/Windows certs.
- **Updater:** testar só em app instalado a partir de artefatos em `release/` + publish GitHub.

Checklist pós-build:

1. Abrir o artefato (`.app` / Setup / AppImage)
2. Confirmar SQLite em Application Support/`North` (ou equivalente), não dentro do bundle
3. Smoke SSH curto
4. Serial: listar portas (se houver hardware)
5. Confirmar ícone N no Dock / taskbar / instalador

## GitHub Actions (build multiplataforma)

Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml)

Dispara ao criar uma tag `v*` (ex.: `v0.1.0`) ou manualmente em **Actions → Release → Run workflow**.

| Job | Runner | Saída |
| --- | --- | --- |
| `build` (mac) | `macos-latest` | `.dmg`, `.zip`, `*.blockmap` |
| `build` (win) | `windows-latest` | `North-*-setup.exe`, `*.blockmap` |
| `build` (linux) | `ubuntu-latest` | `.AppImage`, `*.blockmap` |

O job `release` junta os artefatos e cria um **draft release** no GitHub. Revise os binários antes de publicar.

### Gerar `.exe` estando no Mac

Não use `npm run dist:win` localmente — módulos nativos (`better-sqlite3`, `serialport`) exigem build no SO alvo. No Mac:

```bash
git tag v0.1.0          # versão alinhada a package.json
git push origin v0.1.0  # dispara o workflow
```

Depois: **Actions** → workflow concluído → artefato `north-win` ou draft release com `North-0.1.0-setup.exe`.

Também é possível rodar só o build Windows em **Actions → Release → Run workflow** (sem tag; nesse caso não cria release, só artefatos por 30 dias).

### Runbook operacional (tag e execução manual)

1. Confirmar `package.json#version` alinhado à versão alvo.
2. Criar a tag semântica e publicar:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

3. Abrir **Actions → Release** e validar a conclusão de:
   - `verify` (executa `npm run test`)
   - `build` (matriz mac/win/linux com `dist:*`)
   - `release` (apenas em `refs/tags/v*`, cria draft)
4. No draft release, conferir artefatos esperados:
   - macOS: `.dmg`, `.zip`, `*.blockmap`
   - Windows: `North-*-setup.exe`, `*.blockmap`
   - Linux: `.AppImage`, `*.blockmap`
   - updater: `latest*.yml` quando presentes
5. Rodar checklist de smoke dos instaladores e publicar manualmente.

### Execução manual (sem tag)

Use **Actions → Release → Run workflow** para gerar artefatos em qualquer branch sem criar release. Isso é útil para validar o pipeline antes da primeira tag; os artefatos ficam disponíveis temporariamente no GitHub Actions.

## GitHub Releases

1. `GITHUB_TOKEN` do Actions já tem `contents: write` no workflow de release
2. Tag semântica (`v0.1.0`) alinhada a `package.json#version`
3. Push da tag dispara o CI; ou publicar localmente com electron-builder:

```bash
GH_TOKEN=… npm run dist:mac -- --publish always
```

4. Preferir **draft release** na primeira vez; validar artefatos (DMG/zip/NSIS/AppImage) antes de publicar
5. Artefatos `latest*.yml` / `*.blockmap` devem acompanhar o release — o updater depende deles

## Auto-update

- UI: Configurações → Atualizações (`updates:check` / `updates:install`)
- Em **dev** (`electron-vite dev`) o main ignora check salvo `NORTH_ENABLE_UPDATES=1`
- Testar updater **somente** em build empacotado instalado a partir de um release anterior (ou feed de teste)
- Fluxo: verificar → toast/estado “nova versão” → Instalar e reiniciar (download + `quitAndInstall`)

## Assinatura e notarização (opt-in)

Não bloqueiam o restante do pipeline enquanto não houver certificados.

### macOS

1. Apple Developer ID Application + perfil de notarização
2. Variáveis típicas: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (ou `CSC_LINK` / `CSC_KEY_PASSWORD` para o certificado)
3. Em `electron-builder.yml`, ligar `mac.notarize: true` (hoje `false`)
4. Validar com Gatekeeper (`spctl --assess`) após notarizar

### Windows

1. Certificado Authenticode (EV ou standard)
2. `CSC_LINK` + `CSC_KEY_PASSWORD` (ou store Windows)
3. Confirmar que o NSIS assinado não dispara SmartScreen em excesso após reputação inicial

Até haver certificados, distribuir builds **não assinados** só para QA interna; documentar o aviso do SO para testadores.
