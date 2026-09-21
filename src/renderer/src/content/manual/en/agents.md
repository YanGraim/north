# Agents

The sidebar **Agents** section manages AI agent workspaces (Claude Code, Codex, or any CLI) running in isolated git worktrees — it's not part of the Client → Environment → Group → Connection hierarchy.

## Create a workspace

**New workspace** (in the sidebar or the board) asks for:

- **Repository** — any folder with a git repository, picked via the native folder dialog. It doesn't need to be registered in North.
- **Branch** — name of the new branch to create for the worktree.
- **Agent command** — free text (`claude`, `codex`, whatever).
- **Task** (optional) — a short note about what the agent is doing.

On create, North runs `git worktree add` inside the repository, creating the folder at `<repository>/.north/worktrees/<branch>`. The session opens automatically, running the agent command there. If the branch you typed already exists, North warns before creating: if it's free, it offers to check it out instead; if it's already checked out in another worktree (including the repo's main working tree), it blocks and shows where — git doesn't allow the same branch in two places at once.

## Session and context

A workspace's session is a terminal like any other (same tab, same engine), but with a context bar above the terminal showing the **repository**, **branch**, and the noted **task** — so you don't lose track of which agent/branch is open when running several sessions in parallel.

## Board (Kanban)

The board starts with 3 columns (**Backlog**, **In progress**, **Done**), but they're fully yours:

- **+ New column** creates a column with whatever name you want.
- Click a column's name to rename it.
- Hover a column's header to see the delete button — deleting a column doesn't delete its workspaces, they just move to "No column" until you place them elsewhere.
- Drag cards between columns freely.

A green dot on a card means a session is currently open for that workspace; gray means none is.

## Deleting a workspace

Deleting runs `git worktree remove` **without `--force`**. If the worktree has uncommitted changes, removal fails and nothing is lost — commit or discard the changes manually before trying again.
