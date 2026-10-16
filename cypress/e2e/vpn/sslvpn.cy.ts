import { visitVpns } from './helpers'

describe('VPNs — FortiGate SSL-VPN', () => {
  it('cadastra como no FortiClient, confia no certificado e conecta', () => {
    visitVpns()
    cy.get('[data-testid="vpn-new"]').click()
    cy.get('[data-testid="vpn-kind-fortinet-sslvpn"]').click()
    cy.get('#vpn-ssl-name').type('PAC')
    // pasting "host:port" like FortiClient shows it splits into gateway + port
    cy.get('#vpn-ssl-gateway').type('179.190.99.2:4433').blur()
    cy.get('#vpn-ssl-gateway').should('have.value', '179.190.99.2')
    cy.get('#vpn-ssl-port').should('have.value', '4433')
    cy.get('#vpn-ssl-username').type('grp.yanpinheiro')
    cy.get('[data-testid="vpn-sslvpn-create"]').click()

    cy.get('[data-testid="vpn-secret-username"]').should('have.value', 'grp.yanpinheiro')
    cy.get('[data-testid="vpn-secret-psk"]').should('not.exist')
    cy.get('[data-testid="vpn-secret-password"]').type('segredo')
    cy.get('[data-testid="vpn-credentials-save"]').click()

    cy.get('[data-testid="vpn-details"]').should('contain.text', 'FortiGate SSL-VPN')
    cy.get('[data-testid="vpn-details"]').should('contain.text', '179.190.99.2:4433')
    cy.get('[data-testid="vpn-connect"]').click()
    cy.get('[data-testid="vpn-error"]').should(
      'contain.text',
      'Certificado do gateway não reconhecido'
    )
    cy.get('[data-testid="vpn-cert-digest"]').should('contain.text', 'c'.repeat(64))
    cy.get('[data-testid="vpn-trust-cert"]').click()
    cy.get('[data-testid="vpn-status"]').should('contain.text', 'Conectada')
  })
})
