describe('workflows split-connect-menu', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('keeps connect click and lists workflows in the chevron menu', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').type('From Split')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-list"]').should('contain', 'From Split')
    cy.get('body').type('{esc}')

    cy.get('[data-testid="connect-button"]').click()
    cy.get('[data-testid="connecting-state"]').should('contain', 'Conectando')

    cy.get('[data-testid="connect-split-chevron"]').click()
    cy.get('[data-testid="connect-split-menu"]').should('be.visible')
    cy.get('[data-testid="connect-split-menu"]').should('contain', 'From Split')
    cy.get('[data-testid="connect-split-manage"]').should('contain', 'Gerenciar workflows')
    cy.get('[data-testid="connect-split-menu"]').contains('From Split').click()
    cy.get('[data-testid="workflow-run-view"]').should('be.visible')
  })
})
