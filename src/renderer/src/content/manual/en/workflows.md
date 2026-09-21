# Workflows

**Workflows** are repeatable actions owned by a **group**: deploy, restart, health-check and similar — without loose scripts outside North.

## Where to create and edit

1. Select a connection (or the group) in the inventory.
2. Open the group **workflow hub** (connection panel or Command Palette → Manage workflows…).
3. Create the workflow: name, optional inputs and steps (for example `ssh.exec`).

**Group** variables (plaintext config) apply to every workflow in that group. Inputs are prompted at run time.

## How to run

- Connection panel → Workflows section
- **Connect** button (split menu) → pick a workflow
- Command Palette → **Run workflow…** (SSH connection selected)

Execution opens a **run tab** with timeline, progress and per-step log. The bar under the header shows the **client** and the environment (**HML** / **PROD** / **DEV** and the name). The step log follows the output; scrolling up pauses follow until you return to the bottom. Duration in the header and on each step freezes when the run finishes. On failure, depending on the step policy, you can **Retry**, **Continue** or **Cancel**.

## Secrets

Passwords and keys live in the connection **secrets bag**, never in the workflow definition or group variables. North may prompt and offer to save to the vault when a step needs authentication.

## Git tracking (optional)

A workflow can enable **Git tracking**: toggle it on in the editor and give it a repository path on the server (e.g. `/var/www/html/wms-api`), and North captures the current commit before running and again after. If the commit changed, it automatically records which commits came in, how many files changed, and whether the run succeeded or failed — without changing anything about what the workflow does.

This needs no Git provider API (GitHub/Bitbucket) or PRs — North reads the state directly from the repository on the server, via the same SSH commands the workflow already uses. If the path doesn't exist or isn't a Git repository, tracking simply records nothing; the workflow still runs normally.

The update history shows up in two places:

- **Dashboard** → **Recent updates** section, at the bottom — a global view across every client/environment: how many updates today/this week, a per-week chart, and the full timeline.
- **Connection panel** → **Updates** section, right below Workflows — the same view, filtered to that connection's environment.

In both, history is scoped per **environment**: if two different connections (e.g. backend and frontend) update the same environment via separate workflows, it all shows up together.
