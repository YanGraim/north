const CLIENT_ID = 'b1000000-0000-4000-8000-000000000001'
const ENV_ID = 'b2000000-0000-4000-8000-000000000002'
const DB_GROUP_ID = 'b3000000-0000-4000-8000-000000000003'
const DB_ACCESS_ID = 'b4000000-0000-4000-8000-000000000004'
const SSH_CONNECTION_ID = 'b5000000-0000-4000-8000-000000000005'
const API_GROUP_ID = 'b6000000-0000-4000-8000-000000000006'
const SRV_GROUP_ID = 'b7000000-0000-4000-8000-000000000007'
const API_ACCESS_ID = 'b8000000-0000-4000-8000-000000000008'

const START_ROUTE =
  `/clients/${CLIENT_ID}?scenario=app&env=${ENV_ID}` +
  `&group=${DB_GROUP_ID}&access=${DB_ACCESS_ID}`

let renderLoopErrors: string[] = []

/**
 * Runs the production AppShell (titlebar + sidebar tree + list + details + session tabs).
 * A render loop in the studio aborts React and freezes the whole workspace, so every
 * scenario also asserts that React never hit "Maximum update depth exceeded".
 */
describe('workspace stays interactive while a database session is open', () => {
  beforeEach(() => {
    renderLoopErrors = []
    cy.visit(START_ROUTE, {
      onBeforeLoad: (win) => {
        win.localStorage.clear()
        const original = win.console.error
        win.console.error = (...args: unknown[]) => {
          const text = args.map(String).join(' ')
          if (text.includes('Maximum update depth exceeded')) renderLoopErrors.push(text)
          original.apply(win.console, args as [])
        }
      }
    })
    cy.get('[data-testid="connect-button"]').should('be.visible')
  })

  afterEach(() => {
    expect(renderLoopErrors, 'React render loop errors').to.have.length(0)
  })

  function connectDatabase(): void {
    cy.get('[data-testid="connect-button"]').click()
    cy.get('[data-testid="database-studio"]').should('be.visible')
  }

  function openOrdersTable(): void {
    cy.get('[data-testid="schema-table-orders"]').click()
    cy.get('[data-testid="studio-tab-orders"]').should('be.visible')
    cy.get('[data-testid="query-result-grid"]').should('be.visible')
  }

  function runQuery(): void {
    cy.get('[data-testid="studio-new-query"]').click()
    cy.get('[data-testid="studio-tab-query-2"]').should('be.visible')
    cy.get('.cm-content').last().type('select * from orders', { force: true })
    cy.get('[data-testid="studio-run"]').click()
    cy.get('[data-testid="query-result-grid"]').should('be.visible')
  }

  function selectGridCells(): void {
    cy.get('[data-testid="grid-row-0"] td').eq(1).trigger('mousedown', { button: 0 })
    cy.get('[data-testid="grid-row-1"] td').eq(1).trigger('mousemove')
    cy.get('[data-testid="grid-row-1"] td').eq(1).trigger('mouseup')
  }

  function goToWorkspace(): void {
    cy.get('[data-testid="session-tab-workspace"]').click()
  }

  function selectGroup(groupId: string): void {
    cy.get(`a[href*="group=${groupId}"]`).first().click()
    cy.location('search').should('include', `group=${groupId}`)
  }

  function expectAccessSelectionWorks(): void {
    selectGroup(API_GROUP_ID)
    cy.get(`a[href*="access=${API_ACCESS_ID}"]`).first().click()
    cy.get('[data-testid="access-details-panel"]').should('contain.text', 'teste')
  }

  function expectConnectionSelectionWorks(): void {
    selectGroup(SRV_GROUP_ID)
    cy.get(`a[href*="connection=${SSH_CONNECTION_ID}"]`).first().click()
    cy.get('[data-testid="connection-details-panel"]').should('contain.text', 'app-server')
  }

  it('selects another access after opening a table', () => {
    connectDatabase()
    openOrdersTable()
    goToWorkspace()
    expectAccessSelectionWorks()
  })

  it('selects an SSH connection after opening a table', () => {
    connectDatabase()
    openOrdersTable()
    goToWorkspace()
    expectConnectionSelectionWorks()
  })

  it('selects another access after running a query', () => {
    connectDatabase()
    runQuery()
    goToWorkspace()
    expectAccessSelectionWorks()
  })

  it('selects an SSH connection after selecting grid cells', () => {
    connectDatabase()
    openOrdersTable()
    selectGridCells()
    goToWorkspace()
    expectConnectionSelectionWorks()
  })

  it('starts an SSH session after a database session', () => {
    // xterm has no real geometry in the harness; the session still opens.
    cy.on('uncaught:exception', (err) => !err.message.includes('dimensions'))
    connectDatabase()
    openOrdersTable()
    goToWorkspace()
    expectConnectionSelectionWorks()

    cy.get('[data-testid="connection-details-panel"]')
      .find('[data-testid="connect-button"]')
      .click()
    cy.get('[data-testid="terminal-view"]').should('be.visible')
  })

  it('keeps the workspace usable with an API session and a database session open', () => {
    connectDatabase()
    openOrdersTable()
    goToWorkspace()

    expectAccessSelectionWorks()
    cy.get('[data-testid="access-details-panel"]').find('[data-testid="connect-button"]').click()
    cy.get('[data-testid="api-studio"]').should('be.visible')

    goToWorkspace()
    expectConnectionSelectionWorks()
  })

  it('reopens the database session from the tab bar', () => {
    connectDatabase()
    openOrdersTable()
    goToWorkspace()
    expectAccessSelectionWorks()

    cy.contains('[role="tab"]', 'PostgreSQL').click()
    cy.get('[data-testid="database-studio"]').should('be.visible')
    cy.get('[data-testid="query-result-grid"]').should('be.visible')
  })
})
