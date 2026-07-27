declare module '@novnc/novnc' {
  const RFB: new (
    target: HTMLElement,
    urlOrChannel: unknown,
    options?: Record<string, unknown>
  ) => {
    scaleViewport: boolean
    resizeSession: boolean
    focus: () => void
    blur: () => void
    disconnect: () => void
    sendCredentials: (credentials: Record<string, string>) => void
    addEventListener: (type: string, listener: (e: Event) => void) => void
    removeEventListener: (type: string, listener: (e: Event) => void) => void
  }
  export default RFB
}

declare module 'ironrdp-wasm' {
  const init: () => Promise<unknown>
  export default init
  export class SessionBuilder {
    build(): Promise<unknown>
  }
}
