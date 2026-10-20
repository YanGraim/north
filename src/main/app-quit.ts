/**
 * Set by every real quit (tray "Sair do North", Cmd+Q, installing an update): closing the
 * window then really closes it instead of hiding North in the tray.
 */
let quitting = false

export function markQuitting(): void {
  quitting = true
}

export function isQuitting(): boolean {
  return quitting
}
