## API client

- **Send without an environment:** an absolute URL (`https://…`) works with no API Access. The selector includes **No environment** and **+ New environment** to create an API Access
- **Environment/variable is opt-in:** an API Access only becomes an environment (and gets an automatic `{{baseUrl}}`) once you check "Expose this URL as an environment variable" on the record — unchecked, it's just a stored URL, no Connect button
- **Environments are global:** the environment selector lists API Accesses from any client, not just the open collection's client
- **Variable autocomplete:** type `{{` in the URL, params, headers, or Auth to see the selected environment's variables; a recognized `{{variable}}` is highlighted, an unrecognized one is underlined in red
- **Reusable presets:** save a set of headers or an Auth configuration as a global preset from the Headers/Auth tabs and apply it to any request later, in any collection
- **Cleaner headers/params rows and a redesigned Variables list**, with a reveal button for saved secrets
- **Larger responses:** the response body cap went from 1 MB to 10 MB, and the JSON response view is more readable (more spacing, syntax highlighting); when the body is truncated, the hint now says so explicitly instead of claiming it's "not JSON"

See the [API client](api) manual chapter.

## Personalization

- **App font:** pick the family (IBM Plex Mono, JetBrains Mono, system monospace, Menlo/Consolas, Courier New) and size in **Settings → App font** — it applies to everything: the interface, terminal, code editors, hosts/ports, and shortcuts

## Fixes

- Opening a table or running a query in the SQL studio no longer freezes the workspace when you return to inventory — sidebar, list, and details panel work again
- Response search (🔍) in the API client now highlights and jumps to matches — the field existed before but did nothing
- Expanding a folder inside a Collection no longer collapses every other open folder

See the [SQL studio](database) manual chapter.
