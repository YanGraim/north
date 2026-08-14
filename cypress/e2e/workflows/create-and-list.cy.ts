describe('workflows create-and-list', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('creates a workflow in the hub editor and lists it in the panel', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-dialog"]').should('be.visible')
    cy.get('[data-testid="workflow-hub-editor-title"]').should('contain', 'Novo workflow')
    cy.get('[data-testid="workflow-hub-new-name"]').clear().type('Deploy API')
    cy.get('[data-testid="workflow-hub-command"]').clear().type('echo deploy')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-editor-title"]').should('contain', 'Editando: Deploy API')
    cy.get('[data-testid="workflow-hub-list"]').should('contain', 'Deploy API')
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')
    cy.get('[data-testid="workflow-section"]').should('contain', 'Deploy API')
  })

  it('edit button opens hub with the workflow selected', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').type('Edit Me')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-list"]').should('contain', 'Edit Me')
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')

    cy.get('[data-testid="workflow-section"]')
      .contains('Edit Me')
      .parents('li')
      .find('[data-testid^="workflow-edit-"]')
      .click()

    cy.get('[data-testid="workflow-hub-dialog"]').should('be.visible')
    cy.get('[data-testid="workflow-hub-editor-title"]').should('contain', 'Editando: Edit Me')
    cy.get('[data-testid="workflow-hub-new-name"]').should('have.value', 'Edit Me')
  })
})
