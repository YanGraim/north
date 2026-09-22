## Terminal

- **Paste image:** paste an image from the clipboard (e.g. a screenshot) straight into the terminal — North saves it to a temp file and pastes the path, the same way iTerm2/Terminal.app do it. Handy for agent CLIs like Claude Code.
- **Local terminal in the sidebar:** now one of the first items in Overview, not just the Command Palette

## Agents

- **Branch-in-use warning:** creating a workspace with a branch that's already checked out elsewhere (including the repo's main working tree) now warns and shows where, instead of only failing after the attempt

See the [Connect](connect) and [Agents](agents) manual chapters.

## API client

- **Comments in JSON:** the JSON body now accepts `//` and `/* */` — North strips them before sending, so the target API always receives valid JSON
- **Request notes:** new **Notes** tab to document what a request does, shown as a tooltip in the Collections tree

See the [API client](api) manual chapter.

## Monitoring

- **Uptime monitoring:** turn on a periodic check for any Connection (does the port respond?) — status dot, outage history, and a native notification when something goes down or comes back. Opt-in per connection, no metrics, no agent installed on the server.
- **Dashboard widget:** see everything that's down right now and how many outages today/this week, in one place

See the [Connect](connect) manual chapter.
