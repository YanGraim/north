# Import / export and updates

## Inventory JSON

Under **Settings → Inventory**:

- **Export JSON** — inventory backup: clients → environments → groups → connections and accesses, with each group's **workflows** and **variables**, the tags and the **FortiGate VPNs** (SSL-VPN and IPsec), including which VPN each client, environment and connection uses
- **Import JSON** — brings an exported JSON (from any North version) into this North. Anything that already exists with the same name stays as it is; only what's missing comes in

The JSON **does not include credentials/secrets**. After importing, reconfigure passwords and keys in the vault. For VPNs, not even the **user** goes in the file (it's personal): when you connect an imported VPN, North asks you to fill in your user in **Edit**, and the password/PSK on the first connection. **OpenVPN** VPNs aren't in the file, because everyone has their own `.ovpn`: import yours on the VPNs page.

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
