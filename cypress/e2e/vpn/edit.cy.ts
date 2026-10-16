import { type ovpnConfig, seedVpn, visitVpns } from './helpers'

describe('VPNs — editar conexão', () => {
  it('troca IPsec → SSL-VPN sem apagar, mantendo gateway e usuário', () => {
    visitVpns()
    seedVpn('PAC VPN', {
      kind: 'ipsec-ikev1',
      gateway: '179.190.99.2',
      username: 'grp.yanpinheiro',
      xauth: 'saved'
    } as unknown as ReturnType<typeof ovpnConfig>)
    cy.get('[data-testid="vpn-list-item"]').click()
    cy.get('[data-testid="vpn-edit"]').click()

    cy.get('[data-testid="vpn-edit-kind"]').click()
    cy.get('[role="option"]').contains('FortiGate SSL-VPN').click()
    cy.get('#vpn-edit-gateway').should('have.value', '179.190.99.2')
    cy.get('#vpn-edit-port').clear().type('4433')
    cy.get('#vpn-edit-username').should('have.value', 'grp.yanpinheiro')
    cy.get('[data-testid="vpn-edit-save"]').click()

    cy.get('[data-testid="vpn-details"]').should('contain.text', 'FortiGate SSL-VPN')
    // the credentials form now asks only what SSL-VPN needs
    cy.get('[data-testid="vpn-secret-psk"]').should('not.exist')
    cy.get('[data-testid="vpn-secret-password"]').should('exist')
    cy.get('[data-testid="vpn-list-item"]').should('have.length', 1)
  })

  it('substitui o .ovpn mantendo a VPN', () => {
    visitVpns()
    seedVpn('ACME')
    cy.get('[data-testid="vpn-list-item"]').click()
    cy.get('[data-testid="vpn-edit"]').click()
    cy.get('[data-testid="vpn-replace-ovpn-input"]').selectFile(
      'test/fixtures/ovpn/plain-cert-only.ovpn',
      {
        force: true
      }
    )
    cy.get('[data-testid="ovpn-summary"]').should('contain.text', '203.0.113.10:1194')
    cy.get('[data-testid="vpn-details"]').should('contain.text', 'ACME')
    cy.get('[data-testid="vpn-list-item"]').should('have.length', 1)
  })
})
