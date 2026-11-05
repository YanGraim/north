const remote = '[data-testid="file-pane-remote"]'
const local = '[data-testid="file-pane-local"]'

describe('ftp file-browser', () => {
  beforeEach(() => {
    cy.visit('/?scenario=ftp')
    cy.get('[data-testid="connect-button"]').click()
    cy.get('[data-testid="file-browser"]').should('be.visible')
    cy.get('[data-testid="terminal-cwd-toggle"]').should('not.exist')
  })

  it('shows the local disk next to the server', () => {
    cy.get(local).find('[data-testid="file-browser-entry-local.txt"]').should('be.visible')
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').should('be.visible')
  })

  it('jumps to a parent folder from the path bar and still accepts a typed path', () => {
    cy.get(local).find('[data-testid="file-browser-entry-local.txt"]').should('be.visible')
    cy.get(local).find('[aria-label="Abrir /"]').should('exist')
    cy.get(local).find('[aria-label="Abrir /home"]').should('exist')
    cy.get(local).find('[data-testid="path-segment-current"]').should('contain', 'e2e')

    cy.get(remote).find('[data-testid="file-browser-entry-docs"]').dblclick()
    cy.get(remote).find('[data-testid="file-browser-entry-readme.txt"]').should('be.visible')
    cy.get(remote).find('[aria-label="Abrir /docs"]').should('not.exist')
    cy.get(remote).find('[aria-label="Abrir /"]').click()
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').should('be.visible')

    cy.get(remote).find('[data-testid="path-segment-current"]').click()
    cy.get(remote).find('[data-testid="path-input"]').clear().type('/docs{enter}')
    cy.get(remote).find('[data-testid="file-browser-entry-readme.txt"]').should('be.visible')
    cy.get(remote).find('[data-testid="path-input"]').should('not.exist')

    cy.get(remote).find('[data-testid="path-segment-current"]').click()
    cy.get(remote).find('[data-testid="path-input"]').type('{esc}')
    cy.get(remote).find('[data-testid="path-input"]').should('not.exist')
    cy.get(remote).find('[data-testid="file-browser-entry-readme.txt"]').should('be.visible')

    cy.get(remote).find('[data-testid="path-segment-current"]').click()
    cy.get(remote).find('[data-testid="path-input"]').type('/etc')
    cy.get(remote).find('[data-testid="file-browser-entry-readme.txt"]').click()
    cy.get(remote).find('[data-testid="path-input"]').should('not.exist')
    cy.get(remote).find('[data-testid="file-browser-entry-readme.txt"]').should('be.visible')
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

  it('does not offer SSH directory or log actions on the FTP panes', () => {
    cy.get('[data-testid="file-pane-remote"] [aria-label="Definir diretório padrão"]').should(
      'not.exist'
    )
    cy.get('[data-testid="file-pane-local"] [aria-label="Definir diretório padrão"]').should(
      'not.exist'
    )

    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').rightclick()
    cy.get('[data-slot="context-menu-content"]')
      .should('be.visible')
      .and('contain', 'Abrir')
      .and('not.contain', 'Adicionar ao monitoramento')
      .and('not.contain', 'Monitorar em tempo real')
  })

  it('shows empty state when a folder has no entries', () => {
    cy.get(remote).find('[aria-label="Nova pasta (F7)"]').click()
    cy.get('[data-testid="file-name-dialog"] input').type('vazia{enter}')
    cy.get(remote).find('[data-testid="file-browser-entry-vazia"]').dblclick()
    cy.get(remote)
      .find('[data-testid="file-browser-empty"]')
      .should('contain', 'Pasta vazia — arraste arquivos para cá')
  })

  it('edits a remote text file and hides edit on the local pane', () => {
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').click()
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').rightclick()
    cy.get('[data-testid="file-edit"]').should('be.visible').and('not.have.attr', 'data-disabled')
    cy.get('[data-testid="file-edit-with"]').should('have.attr', 'data-disabled')
    cy.get('[data-testid="file-edit"]').click()
    cy.get('[data-testid="remote-edit"]').should('be.visible')
    cy.get('[data-testid="remote-edit-tab"]').should('contain', 'hello.txt')
    cy.get('[data-testid="remote-edit-save"]').should('be.disabled')
    cy.get('[data-testid="remote-edit-close"]').click()
    cy.get('[data-testid="file-pane-remote"]').should('be.visible')
    cy.get('[data-testid="remote-edit"]').should('not.exist')

    cy.get(local).find('[data-testid="file-browser-entry-local.txt"]').rightclick()
    cy.get('[data-slot="context-menu-content"]').should('be.visible')
    cy.get('[data-testid="file-edit"]').should('not.exist')
  })

  it('does not edit a remote folder', () => {
    cy.get(remote).find('[data-testid="file-browser-entry-docs"]').click()
    cy.get(remote).find('[data-testid="file-browser-entry-docs"]').rightclick()
    cy.get('[data-testid="file-edit"]').should('have.attr', 'data-disabled')
  })

  it('saves a favorite directory and returns to it', () => {
    cy.get(local).find('[data-testid="directory-favorites"]').should('not.exist')
    cy.get(remote).find('[data-testid="directory-favorites"]').click()
    cy.get('[data-testid="directory-favorites-empty"]').should('be.visible')
    cy.get('[data-testid="directory-favorites-add"]').click()
    cy.get('[data-testid="directory-favorites-item"]').should('not.exist')

    cy.get(remote).find('[data-testid="file-browser-entry-docs"]').dblclick()
    cy.get(remote).find('[data-testid="file-browser-entry-readme.txt"]').should('be.visible')
    cy.get(remote).find('[data-testid="directory-favorites"]').click()
    cy.get('[data-testid="directory-favorites-item"]').should('contain', '/').find('span').click()
    cy.get(remote).find('[data-testid="file-browser-entry-hello.txt"]').should('be.visible')

    cy.get(remote).find('[data-testid="directory-favorites"]').click()
    cy.get('[data-testid="directory-favorites-remove"]').click()
    cy.get('body').type('{esc}')
    cy.get(remote).find('[data-testid="directory-favorites"]').click()
    cy.get('[data-testid="directory-favorites-empty"]').should('be.visible')
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
