# API client

The sidebar **APIs** section holds HTTP collections. They are not server Connections. An **API** Access is only the environment (Base URL, default auth, variables).

## Global vs client

- **Globals** — `client_id` empty. The environment selector lists every API Access.
- **Client** — collections under that client; the selector lists only that client’s API Accesses, labeled `HML — teste`.

A client without collections does not appear. Deleting an Access does **not** delete collections. Deleting a client deletes that client’s collections; globals remain.

## Open the studio

Click a collection in the sidebar (no Connect required). **Connect** on an API Access opens the same studio with that Access pre-selected as environment.

## Import and export

The section **+**, empty area, and studio toolbar import **Postman Collection v2.1**. Choose Global or a client. Export from the collection context menu. Secrets are written only as `{{var}}`.

## Send

Pick an environment before Send. URL, default auth and variables come from the selected Access (`accesses.url` is `{{baseUrl}}`). Secrets never leave main.

There is no request timeout by default. Use **Cancel** on the tab bar to abort. While a request is in flight, the response pane shows a spinner and elapsed time; the previous response stays dimmed behind.

Search in Collections filters by name, method, URL, and folder/collection names. History filters by method, URL, and status. Closing a tab with unsaved edits asks to save, discard, or stay.

## Shortcuts

- **⌘/Ctrl+Enter** — Send
- **⌘/Ctrl+S** — Save request
- **⌘/Ctrl+L** — Focus URL

