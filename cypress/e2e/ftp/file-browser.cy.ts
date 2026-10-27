const remote = '[data-testid="file-pane-remote"]'
const local = '[data-testid="file-pane-local"]'

describe('ftp file-browser', () => {
  beforeEach(() => {
    cy.visit('/?scenario=ftp')
    cy.get('[data-testid="connect-button"]').click()
    cy.get('[data-testid="file-browser"]').should('be.visible')
  })

  it('shows the local disk next to the server', () => {
    cy.get(local).find('[data-testid="file-browser-entry-local.txt"]').should('be.visible')
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').should('be.visible')
  })

  it('lists remote entries and navigates into a directory', () => {
    cy.get(remote).find('[data-testid="file-browser-entry-docs"]').dblclick()
    cy.get(remote)
      .find('[data-testid="file-browser-entry-readme.txt"]')
      .should('contain', 'readme.txt')
    cy.get(remote).find('[aria-label="Pasta superior"]').click()
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').should('be.visible')
  })

  it('creates, renames and deletes entries with the keyboard', () => {
    cy.get(remote).find('[aria-label="Nova pasta (F7)"]').click()
    cy.get('[data-testid="file-name-dialog"] input').type('nova-pasta{enter}')
    cy.get(remote).find('[data-testid="file-browser-entry-nova-pasta"]').should('be.visible')

    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').click()
    cy.get(remote).trigger('keydown', { key: 'F2' })
    cy.get('[data-testid="file-name-dialog"] input').clear().type('renamed.txt{enter}')
    cy.get(remote).find('[data-testid="file-browser-entry-renamed.txt"]').should('be.visible')
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').should('not.exist')

    cy.get(remote).find('[data-testid="file-browser-entry-renamed.txt"]').click()
    cy.get(remote).trigger('keydown', { key: 'Delete' })
    cy.get('[role="alertdialog"]').should('contain', 'permanentemente')
    cy.get('[role="alertdialog"]').contains('button', 'Excluir').click()
    cy.get(remote).find('[data-testid="file-browser-entry-renamed.txt"]').should('not.exist')
  })

  it('downloads the selection with F5 and lists it in the transfer queue', () => {
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').click()
    cy.get(remote).trigger('keydown', { key: 'F5' })
    cy.get('[data-testid="transfer-queue"]').should('contain', 'hello.txt')
  })

  it('asks before overwriting a file that already exists on the server', () => {
    cy.get(local).find('[data-testid="file-browser-entry-local.txt"]').click()
    cy.get(local).trigger('keydown', { key: 'F5' })
    cy.get(remote).find('[data-testid="file-browser-entry-local.txt"]').should('be.visible')

    cy.get(local).find('[data-testid="file-browser-entry-local.txt"]').click()
    cy.get(local).trigger('keydown', { key: 'F5' })
    cy.get('[data-testid="transfer-conflict-dialog"]').should('contain', 'local.txt')
    cy.get('[data-testid="transfer-conflict-dialog"]')
      .contains('button', 'Pular existentes')
      .click()
    cy.get('[data-testid="transfer-conflict-dialog"]').should('not.exist')
  })

  it('shows empty state when a folder has no entries', () => {
    cy.get(remote).find('[aria-label="Nova pasta (F7)"]').click()
    cy.get('[data-testid="file-name-dialog"] input').type('vazia{enter}')
    cy.get(remote).find('[data-testid="file-browser-entry-vazia"]').dblclick()
    cy.get(remote)
      .find('[data-testid="file-browser-empty"]')
      .should('contain', 'Pasta vazia — arraste arquivos para cá')
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
