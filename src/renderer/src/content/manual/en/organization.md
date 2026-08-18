# Organization

The inventory follows an explicit hierarchy:

1. **Client** — company or account you support
2. **Environment** — production, staging, lab, etc.
3. **Group** — logical grouping (region, stack, team)
4. **Items** — connections and accesses inside the group

In the **sidebar**, expand client → environment → group to see each connection and access as a leaf. Click opens the item in the center panel (deep link in the URL). Database icons use the engine brand when no custom icon is set.

## Connections vs accesses

| Type | Purpose |
| --- | --- |
| **Connection** | Remote server with a session (SSH, RDP, VNC, SFTP, FTP, Telnet, Serial) |
| **Access** | Database credential, portal login or other secret — **no** remote session |

Think of connections as “how I reach the host” and accesses as “what I use to authenticate to services”.

## Workflows

The **group** owns workflows and project variables. A run targets a connection; credentials never live in the workflow — only in the connection secrets bag.
