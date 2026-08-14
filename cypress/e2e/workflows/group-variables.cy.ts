describe('workflows group-variables', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('interpolates group variables into planned commands', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-variables-tab"]').click()
    cy.get('[data-testid="workflow-var-key"]').type('PROJECT_PATH')
    cy.get('[data-testid="workflow-var-value"]').type('/var/www/app')
    cy.get('[data-testid="workflow-var-add"]').click()
    cy.get('[data-testid="workflow-hub-variables"]').should('contain', 'PROJECT_PATH')

    cy.contains('button', 'Workflows').click()
    cy.get('[data-testid="workflow-hub-create"]').click()
    cy.get('[data-testid="workflow-hub-editor-title"]').should('contain', 'Novo workflow')
    cy.get('[data-testid="workflow-hub-new-name"]').clear().type('With Vars')
    cy.get('[data-testid="workflow-hub-command"]').clear().type('cd {{}{{}PROJECT_PATH}}')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')

    cy.get('[data-testid="workflow-section"]')
      .contains('With Vars')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()
    cy.get('[data-testid="workflow-run-log"]', { timeout: 10000 }).should('contain', '/var/www/app')
    cy.get('[data-testid="workflow-run-log"]').should('not.contain', '{{PROJECT_PATH}}')
  })
})
