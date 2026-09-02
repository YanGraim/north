describe('workflows copy-to-groups', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('copies a workflow to another client group via Copiar para…', () => {
    cy.window().then((win) => {
      const north = (win as unknown as { north: { workflows: { copy?: unknown } } }).north
      expect(north.workflows.copy, 'preload/mock must expose workflows.copy').to.be.a('function')
    })

    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').clear().type('Deploy Shared')
    cy.get('[data-testid="workflow-hub-command"]').clear().type('echo deploy')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-editor-title"]').should('contain', 'Editando: Deploy Shared')

    cy.get('[data-testid="workflow-hub-copy"]').click()
    cy.get('[data-testid="workflow-group-targets"]').scrollIntoView().should('be.visible')
    cy.get('[data-testid="workflow-group-target-group-2"]').check()
    cy.get('[data-testid="workflow-hub-copy-confirm"]').click()

    cy.window().then(async (win) => {
      const north = (
        win as unknown as {
          north: { workflows: { list: (groupId: string) => Promise<{ name: string }[]> } }
        }
      ).north
      const copies = await north.workflows.list('group-2')
      expect(copies.some((w) => w.name === 'Deploy Shared')).to.eq(true)
    })
  })

  it('warns when copying back a workflow that already exists by name', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').clear().type('teste')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-copy"]').click()
    cy.get('[data-testid="workflow-group-target-group-2"]').check()
    cy.get('[data-testid="workflow-hub-copy-confirm"]').click()

    cy.get('[data-testid="workflow-hub-copy"]').click()
    cy.get('[data-testid="workflow-group-target-group-2"]').check()
    cy.get('[data-testid="workflow-copy-name-conflict"]', { timeout: 5000 })
      .should('be.visible')
      .and('contain', 'Já existe')
    cy.get('[data-testid="workflow-hub-copy-confirm"]').should('be.disabled')

    cy.window().then(async (win) => {
      const north = (
        win as unknown as {
          north: { workflows: { list: (groupId: string) => Promise<unknown[]> } }
        }
      ).north
      expect(await north.workflows.list('group-2')).to.have.length(1)
    })

    cy.get('[data-testid="workflow-copy-allow-duplicate"]').check()
    cy.get('[data-testid="workflow-hub-copy-confirm"]').should('not.be.disabled').click()
    cy.window().then(async (win) => {
      const north = (
        win as unknown as {
          north: { workflows: { list: (groupId: string) => Promise<unknown[]> } }
        }
      ).north
      expect(await north.workflows.list('group-2')).to.have.length(2)
    })
  })
})
