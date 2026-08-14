Cypress.Commands.add('openWorkflowHub', () => {
  cy.get('[data-testid="workflow-section-manage"]').click()
  cy.get('[data-testid="workflow-hub-dialog"]').should('be.visible')
})

Cypress.Commands.add('selectConnection', () => {
  cy.get('[data-testid="e2e-connection-card"]').click()
  cy.get('[data-testid="workflow-section"]').should('be.visible')
})

declare global {
  namespace Cypress {
    interface Chainable {
      openWorkflowHub(): Chainable<void>
      selectConnection(): Chainable<void>
    }
  }
}

export {}
