let focusMain: () => void = () => undefined

/** Registered by the process entry once the primary window exists. */
export function setMainWindowFocuser(focus: () => void): void {
  focusMain = focus
}

/** Restores and focuses the primary window (host-key dialog lives there). */
export function focusMainWindow(): void {
  focusMain()
}
