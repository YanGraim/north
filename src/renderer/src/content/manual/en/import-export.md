# Import / export and updates

## Inventory JSON

Under **Settings → Inventory**:

- **Export JSON** — inventory backup (schemaVersion 2: clients → environments → groups → connections **and accesses** + tags)
- **Import JSON** — restore from an exported JSON (accepts v1 and v2)

The JSON **does not include credentials/secrets**. After importing, reconfigure passwords and keys in the vault.

## Spreadsheet CSV

- **Download CSV template** — saves `north-acessos-modelo.csv` for Excel/Sheets
- **Import spreadsheet (CSV)** — rows with `tipo` = `servidor` | `banco` | `login`

Main columns: `cliente`, `ambiente`, `grupo`, `nome`, `protocolo`/`engine`, `host`, `porta`, `database`, `url`, `usuario`, `senha`, `notas`, `tags`.

If the CSV has passwords, the UI asks for explicit confirmation before writing them to the vault. Without confirmation, passwords are skipped.

## Updates

Under **Settings → Updates**, check for new versions via GitHub Releases. In development builds the updater is usually off.

**macOS — first install:** the `.dmg` is not Apple-signed; Gatekeeper may ask for Right-click → Open. Copy North to **Applications** before using in-app updates.

**If you are on 0.1.16 or older:** install this `.dmg` **once**. Ad-hoc builds reject the new zip. After that, **Check now** → **Install and restart**.

**Later updates:** the GitHub release must be **published** (drafts are invisible to the updater).
