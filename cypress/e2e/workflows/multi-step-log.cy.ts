describe('workflows multi-step and run log', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('creates and edits a workflow with 2 named steps; run shows both in timeline', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-dialog"]').should('be.visible')
    cy.get('[data-testid="workflow-hub-mode-flow"]').click()
    cy.get('[data-testid="workflow-hub-flow-canvas"]').should('be.visible')
    cy.get('[data-testid="workflow-hub-new-name"]').clear().type('Deploy WMS')

    cy.get('[data-testid="workflow-hub-step-list"]').find('li').should('have.length', 1)
    cy.get('[data-testid="workflow-hub-step-name"]').clear().type('Git pull')
    cy.get('[data-testid="workflow-hub-command"]').clear().type('sudo git pull')
    cy.get('[data-testid="workflow-hub-cwd"]').clear().type('/var/www/html/wms/wms-app')
    cy.get('[data-testid="workflow-auth-hint-git"]').check()
    cy.get('[data-testid="workflow-auth-hint-sudo"]').check()

    cy.get('[data-testid="workflow-hub-add-step"]').click()
    cy.get('[data-testid="workflow-hub-step-list"]').find('li').should('have.length', 2)
    cy.get('[data-testid="workflow-hub-step-name"]').clear().type('Docker up')
    cy.get('[data-testid="workflow-hub-command"]')
      .clear()
      .type('sudo docker compose -f docker-compose.prod.yml up --build -d')
    cy.get('[data-testid="workflow-hub-cwd"]').clear().type('/var/www/html/wms/wms-app')
    cy.get('[data-testid="workflow-auth-hint-sudo"]').check()

    cy.get('[data-testid="workflow-hub-move-up"]').click()
    cy.get('[data-testid="workflow-hub-step-0"]').should('contain', 'Docker up')
    cy.get('[data-testid="workflow-hub-step-1"]').should('contain', 'Git pull')
    cy.get('[data-testid="workflow-hub-move-down"]').click()
    cy.get('[data-testid="workflow-hub-step-0"]').should('contain', 'Git pull')
    cy.get('[data-testid="workflow-hub-step-1"]').should('contain', 'Docker up')

    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-editor-title"]').should('contain', 'Editando: Deploy WMS')
    cy.get('[data-testid="workflow-hub-list"]').should('contain', 'Deploy WMS')

    // Reopen via list — both step names persist (flow mode remembered in localStorage)
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')
    cy.get('[data-testid="workflow-section"]')
      .contains('Deploy WMS')
      .parents('li')
      .find('[data-testid^="workflow-edit-"]')
      .click()

    cy.get('[data-testid="workflow-hub-dialog"]').should('be.visible')
    cy.get('[data-testid="workflow-hub-mode-flow"]').click()
    cy.get('[data-testid="workflow-hub-step-list"]').find('li').should('have.length', 2)
    cy.get('[data-testid="workflow-hub-step-0"]').should('contain', 'Git pull')
    cy.get('[data-testid="workflow-hub-step-1"]').should('contain', 'Docker up')
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')

    cy.get('[data-testid="workflow-section"]')
      .contains('Deploy WMS')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()

    cy.get('[data-testid="workflow-run-view"]').should('be.visible')
    cy.get('[data-testid="workflow-run-timeline"]').should('contain', 'Git pull')
    cy.get('[data-testid="workflow-run-timeline"]').should('contain', 'Docker up')
    cy.get('[data-testid="workflow-run-timeline"]').find('li').should('have.length', 2)
    cy.get('[data-testid="workflow-run-progress"]', { timeout: 10000 }).should('contain', '2 / 2')
    cy.get('[data-testid="workflow-run-progress"]').should('contain', 'succeeded')
  })

  it('keeps later steps pending when the first step fails', () => {
    cy.visit('/?failFirst=1')
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
        name: 'Fail First',
        definition: {
          schemaVersion: 1,
          inputs: [],
          steps: [
            {
              id: crypto.randomUUID(),
              type: 'ssh.exec',
              name: 'Git pull',
              policy: { onFailure: 'stop' },
              config: { command: 'sudo git pull' }
            },
            {
              id: crypto.randomUUID(),
              type: 'ssh.exec',
              name: 'Docker up',
              policy: { onFailure: 'stop' },
              config: { command: 'sudo docker compose up -d' }
            }
          ]
        }
      })
      ;(win as unknown as { __e2eInvalidate: () => void }).__e2eInvalidate()
    })

    cy.selectConnection()
    cy.get('[data-testid="workflow-section"]')
      .contains('Fail First')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()

    cy.get('[data-testid="workflow-run-view"]').should('be.visible')
    cy.get('[data-testid="workflow-run-timeline"]').should('contain', 'Git pull')
    cy.get('[data-testid="workflow-run-timeline"]').should('contain', 'Docker up')
    cy.get('[data-testid="workflow-run-progress"]', { timeout: 10000 }).should('contain', 'failed')
    cy.get('[data-testid="workflow-run-step-0"]').should('have.attr', 'data-status', 'failed')
    cy.get('[data-testid="workflow-run-step-1"]').should('have.attr', 'data-status', 'pending')
    cy.get('[data-testid="workflow-run-step-1"]').should('not.have.attr', 'data-status', 'running')
  })

  it('exposes selectable log and Copiar log button', () => {
    cy.selectConnection()
    cy.get('[data-testid="workflow-section-new"]').click()
    cy.get('[data-testid="workflow-hub-new-name"]').type('Log Smoke')
    cy.get('[data-testid="workflow-hub-save"]').click()
    cy.get('[data-testid="workflow-hub-dialog"]').type('{esc}')

    cy.get('[data-testid="workflow-section"]')
      .contains('Log Smoke')
      .parents('li')
      .find('[data-testid^="workflow-run-"]')
      .click()

    cy.get('[data-testid="workflow-run-view"]').should('be.visible')
    cy.get('[data-testid="workflow-run-copy-log"]')
      .should('be.visible')
      .and('contain', 'Copiar log')
    cy.get('[data-testid="workflow-run-log"]')
      .should('have.class', 'select-text')
      .and('contain', 'ok')

    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('clipboardWrite')
    })
    cy.get('[data-testid="workflow-run-copy-log"]').click()
    cy.get('@clipboardWrite').should('have.been.called')
  })
})
