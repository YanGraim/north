import type { CSSProperties } from 'react'

/** Overlay content box: starts at x=0 so env(titlebar-area-width) does not sit under caption buttons. */
export function titlebarContentStyle(isMac: boolean): CSSProperties | undefined {
  if (isMac) return undefined
  return {
    width: 'env(titlebar-area-width, 100%)',
    marginLeft: 'env(titlebar-area-x, 0px)'
  }
}

export function titlebarHeaderClass(isMac: boolean): string {
  return isMac ? 'px-4' : ''
}

export function titlebarInnerClass(isMac: boolean): string {
  return isMac ? 'w-full pl-16' : 'pl-4 pr-2'
}
