## Agents

- **AI agent manager:** new "Agents" sidebar section and a Kanban board with fully customizable columns (create, rename, delete) to run Claude Code, Codex, or any agent CLI in an isolated git worktree, without touching the main repo
- **Context always visible:** an agent's session shows the repository, branch, and the noted task in a bar above the terminal — easy to tell which agent is which with several tabs open
- Creating a workspace runs `git worktree add` automatically; deleting runs `git worktree remove` without `--force` — if there are uncommitted changes, nothing is lost

See the [Agents](agents) manual chapter.

## Terminal

- **Paste saved password:** in the terminal's right-click menu, paste the password (or sudo password) already saved for the connection directly — no OS clipboard involved, handy for `sudo su` when a normal paste fails

See the [Connect](connect) manual chapter.

## Workflows

- **Git tracking on workflows:** enable tracking on a workflow (server repository path) and North automatically records, on every run, which commits came in, how many files changed, and whether it succeeded or failed — without changing anything about what the workflow does
- **Per-environment update history:** "Recent updates" widget on the Dashboard (global view, every client/environment) plus a filtered version in each connection's panel — how many updates today/this week, a per-week chart, and an expandable timeline with each run's commits

See the [Workflows](workflows) manual chapter.
