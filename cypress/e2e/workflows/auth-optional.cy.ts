describe('workflows auth-optional', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('saves authHints opt-in and run without hints never shows auth prompt', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').type('Optional Auth')
    cy.get('[data-testid="workflow-auth-hint-git"]').should('not.be.checked')
    cy.get('[data-testid="workflow-auth-hint-sudo"]').should('not.be.checked')
    cy.get('[data-testid="workflow-auth-hint-sudo"]').check()
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-editor-title"]').should('contain', 'Editando: Optional Auth')
    cy.get('[data-testid="workflow-auth-hint-sudo"]').should('be.checked')
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')

    // Second workflow without hints — run must not show auth UI (mock never emits it)
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').type('No Auth')
    cy.get('[data-testid="workflow-auth-hint-sudo"]').should('not.be.checked')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')

    cy.get('[data-testid="workflow-section"]')
      .contains('No Auth')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()

    cy.get('[data-testid="workflow-run-view"]').should('be.visible')
    cy.get('[data-testid="workflow-auth-prompt"]').should('not.exist')
    cy.get('[data-testid="workflow-run-progress"]', { timeout: 10000 }).should(
      'contain',
      'succeeded'
    )
  })
})
