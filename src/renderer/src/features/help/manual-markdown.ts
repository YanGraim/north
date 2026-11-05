import { isValidElement, type ReactNode } from 'react'

/** Blockquote token that the manual renders as a guidance notice, not as a quote. */
export const GUIDANCE_MARKER = 'guidance'

export function isGuidanceMarker(text: string): boolean {
  return text.trim() === GUIDANCE_MARKER
}

/** Plain text of a React node tree, used to recognize the guidance blockquote. */
export function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => nodeText(child)).join('')
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return nodeText(props.children)
  }
  return ''
}
