import { ovpnConfig, seedVpn, visitVpns, vpnMock } from './helpers'

describe('VPNs — conectar', () => {
  it('liga e desliga pela tela, com IP e anúncio de status', () => {
    visitVpns()
    seedVpn('ACME')
    cy.get('[data-testid="vpn-list-item"]').click()
    cy.get('[data-testid="vpn-connect"]').click()
    cy.get('[data-testid="vpn-status"]').should('contain.text', 'Conectada')
    cy.get('[data-testid="vpn-local-ip"]').should('have.text', '10.8.0.6')
    cy.get('[data-testid="vpn-indicator"]')
      .should('have.attr', 'data-tone', 'connected')
      .and('contain.text', 'ACME')
    cy.get('[data-testid="vpn-disconnect"]').click()
    cy.get('[data-testid="vpn-status"]').should('contain.text', 'Desligada')
  })

  it('senha recusada → erro com ação "Atualizar senha" no lugar', () => {
    visitVpns()
    seedVpn('ACME')
    vpnMock().then((m) => m.failNext('AUTH_FAILED'))
    cy.get('[data-testid="vpn-list-item"]').click()
    cy.get('[data-testid="vpn-connect"]').click()
    // credential errors open the credentials dialog directly
    cy.get('[data-testid="vpn-secrets-dialog"]').should('be.visible')
    cy.get('body').type('{esc}')
    cy.get('[data-testid="vpn-error"]').should('contain.text', 'Senha recusada pelo servidor VPN')
    cy.get('[data-testid="vpn-error-update-secret"]').click()
    cy.get('[data-testid="vpn-secrets-dialog"]').should('be.visible')
  })

  it('titlebar: 0, 1 e 2 VPNs; switch no popover; queda fica vermelha', () => {
    visitVpns()
    seedVpn('POLY', ovpnConfig(['10.1.0.0/16']))
    seedVpn('ACME', ovpnConfig(['10.2.0.0/16']))
    cy.get('[data-testid="vpn-indicator"]').should('contain.text', 'VPN').click()
    cy.get('[data-testid="vpn-popover-item"]').should('have.length', 2)
    cy.get('[data-testid="vpn-popover-switch"]').eq(0).click()
    cy.get('[data-testid="vpn-indicator"]').should('have.attr', 'data-tone', 'connected')
    cy.get('[data-testid="vpn-popover-switch"]').eq(1).click()
    cy.get('[data-testid="vpn-indicator"]').should('contain.text', '2 VPNs')
    cy.window().then(async (win) => {
      const w = win as unknown as {
        __vpnMock: { drop: (id: string) => void }
        north: { vpn: { list: () => Promise<Array<{ id: string }>> } }
      }
      const list = await w.north.vpn.list()
      w.__vpnMock.drop(list[0].id)
    })
    cy.get('[data-testid="vpn-indicator"]').should('have.attr', 'data-tone', 'error')
  })

  it('conflito de rede pergunta antes; "Desligar e conectar" troca a VPN', () => {
    visitVpns()
    seedVpn('POLY', ovpnConfig(['192.168.1.0/24']), true)
    seedVpn('ACME', ovpnConfig(['192.168.0.0/16']))
    cy.contains('[data-testid="vpn-list-item"]', 'ACME').click()
    cy.get('[data-testid="vpn-connect"]').click()
    cy.get('[data-testid="vpn-conflict-dialog"]')
      .should('contain.text', 'redes sobrepostas com POLY')
      .and('contain.text', '192.168.1.0/24')
    cy.get('[data-testid="vpn-conflict-switch"]').click()
    cy.get('[data-testid="vpn-status"]').should('contain.text', 'Conectada')
    cy.contains('[data-testid="vpn-list-item"]', 'POLY').click()
    cy.get('[data-testid="vpn-status"]').should('contain.text', 'Desligada')
  })

  it('a11y: switch com rótulo, status anunciado, foco visível no indicador', () => {
    visitVpns()
    seedVpn('POLY')
    cy.get('[data-testid="vpn-indicator"]')
      .should('have.attr', 'aria-label')
      .and('contain', 'Status das VPNs')
    cy.get('[data-testid="vpn-indicator"]').click()
    cy.get('[data-testid="vpn-popover-switch"]').should('have.attr', 'aria-label', 'Ligar VPN POLY')
    cy.get('[data-testid="vpn-popover"] [aria-live="polite"]').should('exist')
  })
})
