const OPEN_MODAL_SELECTORS = [
  '[data-slot="dialog-content"]',
  '[data-slot="alert-dialog-content"]'
].join(', ')

/**
 * Radix DropdownMenu/ContextMenu/Dialog set `pointer-events: none` on body.
 * If the user switches tabs before the menu closes, clicks stop working app-wide.
 * Only clear when no portaled modal content remains mounted.
 */
export function releaseStaleBodyPointerEvents(): void {
  if (typeof document === 'undefined') return
  if (document.body.style.pointerEvents !== 'none') return
  const openModals = document.querySelectorAll(OPEN_MODAL_SELECTORS)
  if (openModals.length === 0) {
    document.body.style.removeProperty('pointer-events')
  }
}

/** Unconditional clear — used when opening inventory dialogs after a menu. */
export function forceReleaseBodyPointerEvents(): void {
  if (typeof document === 'undefined') return
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.removeProperty('pointer-events')
  }
}
