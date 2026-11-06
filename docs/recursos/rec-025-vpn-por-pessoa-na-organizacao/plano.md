# REC-025 — Plano

- [x] Migração 025: `vpn_profiles.workspace_id`, `organization_vpn_choices`, cópia das VPNs já usadas por organizações
- [x] `VpnProfilesRepository`: `list(workspaceId)`, `create(input, workspaceId)`, `clone`
- [x] `OrganizationVpnBridge`: `adopt`, `resolve`, `choose`, `clientOf`; `withLocalVpnIds` com escolha por item
- [x] IPC de VPN filtrado pelo workspace ativo; "Cliente" na tela VPNs da organização = escolha da pessoa
- [x] Cópia entre workspaces leva as VPNs (`adopt`) nos dois sentidos
- [x] OpenVPN só pelo endereço (servidor 0.4.1)
- [x] Manual e what's new 0.1.53 nos 3 idiomas
