import { seedVpn, visitVpns } from './helpers'

describe('VPNs — cadastro', () => {
  it('estado vazio com CTA', () => {
    visitVpns()
    cy.contains('Nenhuma VPN ainda').should('be.visible')
    cy.get('[data-testid="vpn-indicator"]').should('have.attr', 'data-tone', 'idle')
  })

  it('importa .ovpn pelo assistente e pede só os campos exigidos', () => {
    visitVpns()
    cy.get('[data-testid="vpn-new"]').click()
    cy.get('[data-testid="vpn-ovpn-input"]').selectFile(
      'test/fixtures/ovpn/inline-userpass-encrypted-key.ovpn',
      { force: true }
    )
    cy.get('[data-testid="ovpn-summary"]')
      .should('contain.text', 'vpn.acme.com:1194 UDP')
      .and('contain.text', 'exige usuário e senha')
      .and('contain.text', 'chave privada protegida por senha')
    cy.get('[data-testid="vpn-secret-username"]').should('exist')
    cy.get('[data-testid="vpn-secret-password"]').should('exist')
    cy.get('[data-testid="vpn-secret-key-passphrase"]').should('exist')
    cy.get('[data-testid="vpn-secret-psk"]').should('not.exist')
    cy.get('[data-testid="vpn-secret-username"]').type('alice')
    cy.get('[data-testid="vpn-secret-password"]').type('pw')
    cy.get('[data-testid="vpn-secret-key-passphrase"]').type('kp')
    cy.get('[data-testid="vpn-credentials-save"]').click()
    cy.get('[data-testid="vpn-wizard"]').should('not.exist')
    cy.location('search').should('match', /vpn=/)
    cy.get('[data-testid="vpn-details"]').should('contain.text', 'inline-userpass-encrypted-key')
  })

  it('importa arrastando o arquivo e abre as credenciais', () => {
    visitVpns()
    cy.get('[data-testid="vpns-page"]').selectFile('test/fixtures/ovpn/plain-cert-only.ovpn', {
      action: 'drag-drop'
    })
    cy.get('[data-testid="vpn-secrets-dialog"]').should('be.visible')
    cy.get('[data-testid="vpn-list-item"]').should('have.length', 1)
  })

  it('rejeita .ovpn com script e explica por quê', () => {
    visitVpns()
    cy.get('[data-testid="vpn-new"]').click()
    cy.get('[data-testid="vpn-ovpn-input"]').selectFile('test/fixtures/ovpn/dangerous.ovpn', {
      force: true
    })
    cy.get('[data-testid="vpn-import-error"]').should('contain.text', 'script-security')
    cy.get('[data-testid="vpn-list-item"]').should('not.exist')
  })

  it('formulário IPsec espelha o FortiClient', () => {
    visitVpns()
    cy.get('[data-testid="vpn-new"]').click()
    cy.get('[data-testid="vpn-kind-ipsec-ikev1"]').click()
    cy.get('[data-testid="vpn-ipsec-form"] label').then(($labels) => {
      const fortiFields = ['Gateway remoto', 'Nome do grupo (opcional)', 'XAuth', 'Usuário']
      const order = [...$labels]
        .map((l) => l.textContent)
        .filter((l) => fortiFields.includes(l ?? ''))
      expect(order).to.deep.equal([
        'Gateway remoto',
        'Nome do grupo (opcional)',
        'XAuth',
        'Usuário'
      ])
    })
    cy.get('[data-testid="vpn-unsupported"]').should('contain.text', 'em breve')
    cy.get('#vpn-name').type('POLY')
    cy.get('#vpn-gateway').type('poly.fortiddns.com')
    cy.get('#vpn-username').type('yan')
    cy.get('[data-testid="vpn-ipsec-create"]').click()
    cy.get('[data-testid="vpn-secret-psk"]').should('exist')
    cy.get('[data-testid="vpn-secret-password"]').should('exist')
  })

  it('aba de logs não mostra segredos e copia diagnóstico', () => {
    visitVpns()
    seedVpn('ACME')
    cy.get('[data-testid="vpn-list-item"]').click()
    cy.get('[data-testid="vpn-connect"]').click()
    cy.get('[data-testid="vpn-disconnect"]').should('be.visible')
    cy.get('[data-testid="vpn-tab-logs"]').click()
    cy.get('[data-testid="vpn-logs"]')
      .should('contain.text', 'CONNECTED')
      .and('not.contain.text', 'pw')
    cy.get('[data-testid="vpn-copy-diagnostics"]').should('be.visible')
  })
})
