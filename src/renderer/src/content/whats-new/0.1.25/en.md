## Agents

- **AI agent manager:** new "Agents" sidebar section and a Kanban board with fully customizable columns (create, rename, delete) to run Claude Code, Codex, or any agent CLI in an isolated git worktree, without touching the main repo
- **Context always visible:** an agent's session shows the repository, branch, and the noted task in a bar above the terminal — easy to tell which agent is which with several tabs open
- Creating a workspace runs `git worktree add` automatically; deleting runs `git worktree remove` without `--force` — if there are uncommitted changes, nothing is lost

See the [Agents](agents) manual chapter.
