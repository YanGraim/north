describe('workflows run-failure-actions', () => {
  beforeEach(() => {
    cy.visit('/?fail=1')
  })

  it('shows retry/continue/cancel and continues after failure', () => {
    cy.window().then(async (win) => {
      const north = (
        win as unknown as {
          north: {
            workflows: {
              create: (input: unknown) => Promise<unknown>
            }
          }
        }
      ).north
      await north.workflows.create({
        groupId: 'group-1',
        name: 'Flaky',
        definition: {
          schemaVersion: 1,
          inputs: [],
          steps: [
            {
              id: crypto.randomUUID(),
              type: 'ssh.exec',
              name: 'Ok',
              policy: { onFailure: 'stop' },
              config: { command: 'true' }
            },
            {
              id: crypto.randomUUID(),
              type: 'ssh.exec',
              name: 'Boom',
              policy: { onFailure: 'ask' },
              config: { command: 'false' }
            },
            {
              id: crypto.randomUUID(),
              type: 'ssh.exec',
              name: 'After',
              policy: { onFailure: 'stop' },
              config: { command: 'echo after' }
            }
          ]
        }
      })
      ;(win as unknown as { __e2eInvalidate: () => void }).__e2eInvalidate()
    })

    cy.selectConnection()
    cy.get('[data-testid="workflow-section"]')
      .contains('Flaky')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()
    cy.get('[data-testid="workflow-run-retry"]').should('be.visible')
    cy.get('[data-testid="workflow-run-continue"]').should('be.visible')
    cy.get('[data-testid="workflow-run-cancel"]').should('be.visible')
    cy.get('[data-testid="workflow-run-continue"]').click()
    cy.get('[data-testid="workflow-run-progress"]', { timeout: 10000 }).should(
      'contain',
      'succeeded'
    )
  })
})
