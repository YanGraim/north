## Terminal

- **Paste image:** paste an image from the clipboard (e.g. a screenshot) straight into the terminal — North saves it to a temp file and pastes the path, the same way iTerm2/Terminal.app do it. Handy for agent CLIs like Claude Code.

## Agents

- **Branch-in-use warning:** creating a workspace with a branch that's already checked out elsewhere (including the repo's main working tree) now warns and shows where, instead of only failing after the attempt

See the [Connect](connect) and [Agents](agents) manual chapters.

## API client

- **Comments in JSON:** the JSON body now accepts `//` and `/* */` — North strips them before sending, so the target API always receives valid JSON

See the [API client](api) manual chapter.
