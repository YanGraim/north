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

Execution opens a **run tab** with timeline, progress and per-step log. Duration in the header and on each step freezes when the run finishes. On failure, depending on the step policy, you can **Retry**, **Continue** or **Cancel**.

## Secrets

Passwords and keys live in the connection **secrets bag**, never in the workflow definition or group variables. North may prompt and offer to save to the vault when a step needs authentication.
