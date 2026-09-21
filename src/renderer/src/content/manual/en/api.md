# API client

The sidebar **APIs** section holds HTTP collections. They are not server Connections. An **API** Access is only the environment (Base URL, default auth, variables). It only joins the environment selector (and the Connect button) once "Expose this URL as an environment variable" is checked on the record — without it, it's just a stored URL.

## Global vs client

- **Globals** — `client_id` empty, shown everywhere.
- **Client** — collections under that client, shown only there.

A client without collections does not appear. Deleting an Access does **not** delete collections. Deleting a client deletes that client’s collections; globals remain.

**The environment selector is independent of this.** It lists *every* API Access with the environment variable enabled, from any client — it doesn't need to match the open collection's client. The label shows `Client / Environment — name` to make the source clear.

## Open the studio

Click a collection in the sidebar (no Connect required). **Connect** on an API Access opens the same studio with that Access pre-selected as environment.

## Import and export

The section **+**, empty area, and studio toolbar import **Postman Collection v2.1**. Choose Global or a client. Export from the collection context menu. Secrets are written only as `{{var}}`.

## Send

An absolute URL (`https://…`) works with no environment. A relative URL needs an API Access in the selector (Base URL, default auth, variables). The selector lists Accesses with `type: api` and the environment variable enabled, from any client — not the inventory HML/PROD folders, and it doesn't need to match the collection's client.

**No environment** sends only what is on the tab. **+ New environment** opens the Access form with type API (and the collection’s client, when there is one). Connect on an Access still pre-selects that environment.

Secrets never leave main. Without an Access, the send is not written to history.

There is no request timeout by default. Use **Cancel** on the tab bar to abort. While a request is in flight, the response pane shows a spinner and elapsed time; the previous response stays dimmed behind.

The response body is capped at 10 MB; past that it's truncated. When that happens, the Pretty/Raw toggle is unavailable and the hint next to it shows "truncated" (instead of "not JSON"), with the reason in the tooltip.

With a JSON body, the **Format** button (above the editor) re-indents pasted or typed content. Both the request and response bodies are full code editors — besides the **Copy** button (copies everything), you can select any snippet with the mouse and copy just that (⌘/Ctrl+C).

Search in Collections filters by name, method, URL, and folder/collection names. History filters by method, URL, and status. Closing a tab with unsaved edits asks to save, discard, or stay.

## Variables

Type `{{` in the URL, params, headers, or Auth fields (Bearer, Basic, API Key) to get autocomplete suggestions from the selected environment's variables (plus `{{baseUrl}}`, always available when an environment is set). A recognized `{{variable}}` is highlighted in accent color; an unrecognized one is underlined in red.

## Presets

**Apply preset** and **Save as preset…** live in the Headers and Auth tabs of a request. A preset stores either a set of headers or an Auth configuration — never both — and is global: available from any request, in any collection or client, not tied to an environment. Saving Auth as a preset follows the same convention as the rest of the request definition: put `{{variable}}` templates in the fields, not literal secrets.

## Shortcuts

- **⌘/Ctrl+Enter** — Send
- **⌘/Ctrl+S** — Save request
- **⌘/Ctrl+L** — Focus URL

