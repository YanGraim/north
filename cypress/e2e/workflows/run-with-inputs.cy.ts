describe('workflows run-with-inputs', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('asks for inputs before running and resolves them in the log', () => {
    cy.window().then(async (win) => {
      const north = (win as unknown as { north: { workflows: { create: Function } } }).north
      await north.workflows.create({
        groupId: 'group-1',
        name: 'Versioned',
        definition: {
          schemaVersion: 1,
          inputs: [
            {
              id: crypto.randomUUID(),
              key: 'version',
              label: 'Version',
              type: 'string',
              required: true
            }
          ],
          steps: [
            {
              id: crypto.randomUUID(),
              type: 'ssh.exec',
              name: 'Echo version',
              policy: { onFailure: 'stop' },
              config: { command: 'echo {{version}}' }
            }
          ]
        }
      })
      ;(win as unknown as { __e2eInvalidate: () => void }).__e2eInvalidate()
    })

    cy.selectConnection()
    cy.get('[data-testid="workflow-section"]')
      .contains('Versioned')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()
    cy.get('[data-testid="workflow-inputs-dialog"]').should('be.visible')
    cy.get('[data-testid="workflow-input-version"]').type('1.2.3')
    cy.get('[data-testid="workflow-inputs-confirm"]').click()
    cy.get('[data-testid="workflow-run-log"]', { timeout: 10000 }).should('contain', '1.2.3')
  })
})
