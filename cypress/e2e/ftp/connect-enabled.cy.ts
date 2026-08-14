describe('ftp connect-enabled', () => {
  beforeEach(() => {
    cy.visit('/?scenario=ftp')
  })

  it('enables Connect for FTP while keeping workflow chevron disabled', () => {
    cy.get('[data-testid="ftp-harness"]').should('be.visible')
    cy.contains('ftp-files').should('be.visible')
    cy.get('[data-testid="connect-button"]').should('not.be.disabled')
    cy.get('[data-testid="connect-split-chevron"]').should('be.disabled')
  })

  it('opens the file browser after connecting', () => {
    cy.get('[data-testid="connect-button"]').click()
    cy.get('[data-testid="file-browser"]').should('be.visible')
    cy.get('[data-testid="file-browser-entry-hello.txt"]').should('contain', 'hello.txt')
    cy.get('[data-testid="file-browser-entry-docs"]').should('contain', 'docs')
  })
})
