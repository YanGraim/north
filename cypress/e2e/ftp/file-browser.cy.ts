describe('ftp file-browser', () => {
  beforeEach(() => {
    cy.visit('/?scenario=ftp')
    cy.get('[data-testid="connect-button"]').click()
    cy.get('[data-testid="file-browser"]').should('be.visible')
  })

  it('lists remote entries and navigates into a directory', () => {
    cy.get('[data-testid="file-browser-entry-hello.txt"]').should('be.visible')
    cy.get('[data-testid="file-browser-entry-docs"]').dblclick()
    cy.get('[data-testid="file-browser-entry-readme.txt"]').should('contain', 'readme.txt')
    cy.get('[aria-label="Pasta superior"]').click()
    cy.get('[data-testid="file-browser-entry-hello.txt"]').should('be.visible')
  })

  it('creates, renames and deletes entries via prompts', () => {
    cy.window().then((win) => {
      cy.stub(win, 'prompt').callsFake((_message?: string, defaultValue?: string) => {
        if (defaultValue) return 'renamed.txt'
        return 'nova-pasta'
      })
      cy.stub(win, 'confirm').returns(true)
    })

    cy.get('[aria-label="Nova pasta"]').click()
    cy.get('[data-testid="file-browser-entry-nova-pasta"]').should('be.visible')

    cy.get('[aria-label="Renomear hello.txt"]').click()
    cy.get('[data-testid="file-browser-entry-renamed.txt"]').should('be.visible')
    cy.get('[data-testid="file-browser-entry-hello.txt"]').should('not.exist')

    cy.get('[aria-label="Excluir renamed.txt"]').click()
    cy.get('[data-testid="file-browser-entry-renamed.txt"]').should('not.exist')
  })

  it('shows empty state when a folder has no entries', () => {
    cy.window().then((win) => {
      cy.stub(win, 'prompt').returns('vazia')
    })
    cy.get('[aria-label="Nova pasta"]').click()
    cy.get('[data-testid="file-browser-entry-vazia"]').dblclick()
    cy.get('[data-testid="file-browser-empty"]').should(
      'contain',
      'Pasta vazia — arraste arquivos para enviar'
    )
  })
})

describe('ftp file-browser list failure', () => {
  it('surfaces a toast when listing fails', () => {
    cy.visit('/?scenario=ftp&fsFail=1')
    cy.get('[data-testid="connect-button"]').click()
    cy.get('[data-testid="file-browser"]').should('be.visible')
    cy.get('[data-sonner-toast]', { timeout: 5000 }).should('contain', 'Falha ao listar diretório')
  })
})
