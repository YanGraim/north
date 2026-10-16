type VpnMock = {
  failNext: (code: string) => void
  drop: (id: string) => void
  seed: (input: unknown, connected?: boolean) => string
}

export const ovpnConfig = (routes: string[] = [], redirectGateway = false) => ({
  kind: 'openvpn',
  ovpn: 'client\nremote vpn.example 1194\n',
  requiresUserPass: true,
  requiresKeyPassphrase: false,
  username: 'alice',
  remoteSummary: [{ host: 'vpn.example', port: 1194, proto: 'udp' }],
  redirectGateway,
  declaredRoutes: routes
})

export function visitVpns(): void {
  cy.visit('/vpns?scenario=app', { onBeforeLoad: (win) => win.localStorage.clear() })
  cy.get('[data-testid="vpns-page"]').should('be.visible')
}

/** Seed profiles through the mock and refresh TanStack Query. */
export function seedVpn(
  name: string,
  config = ovpnConfig(),
  connected = false
): Cypress.Chainable<string> {
  return cy.window().then((win) => {
    const w = win as unknown as { __vpnMock: VpnMock; __e2eInvalidate: () => void }
    const id = w.__vpnMock.seed({ name, config }, connected)
    w.__e2eInvalidate()
    return id
  })
}

export function vpnMock(): Cypress.Chainable<VpnMock> {
  return cy.window().then((win) => (win as unknown as { __vpnMock: VpnMock }).__vpnMock)
}
