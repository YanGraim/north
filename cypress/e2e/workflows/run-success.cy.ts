describe('workflows run-success', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('runs a workflow via Executar and shows timeline progress without auth UI', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').type('Happy Path')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-list"]').should('contain', 'Happy Path')
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')

    cy.get('[data-testid="workflow-section"]')
      .contains('Happy Path')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()

    cy.get('[data-testid="workflow-run-view"]').should('be.visible')
    cy.get('[data-testid="session-identity-bar"]').should('contain', 'Cliente A')
    cy.get('[data-testid="session-identity-bar"]').should('contain', 'Prod')
    cy.get('[data-testid="workflow-auth-prompt"]').should('not.exist')
    cy.get('[data-testid="workflow-run-timeline"]').should('be.visible')
    cy.get('[data-testid="workflow-run-progress"]', { timeout: 10000 }).should('contain', '1 / 1')
    cy.get('[data-testid="workflow-run-progress"]').should('contain', 'succeeded')
    cy.get('[data-testid="workflow-run-log"]').should('contain', 'ok')
  })
})
