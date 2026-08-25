/** Buffer fields used to decide stick-to-bottom (xterm `buffer.active`). */
export type FollowBuffer = {
  viewportY: number
  baseY: number
}

export type FollowTerminal = {
  buffer: { active: FollowBuffer }
  write(data: string | Uint8Array, callback?: () => void): void
  writeln(data: string | Uint8Array, callback?: () => void): void
  scrollToBottom(): void
}

export function isAtBottom(term: FollowTerminal): boolean {
  const buf = term.buffer.active
  return buf.viewportY === buf.baseY
}

export function writeFollowing(term: FollowTerminal, data: string | Uint8Array): void {
  const follow = isAtBottom(term)
  term.write(data, () => {
    if (follow) term.scrollToBottom()
  })
}

export function writelnFollowing(term: FollowTerminal, data: string): void {
  const follow = isAtBottom(term)
  term.writeln(data, () => {
    if (follow) term.scrollToBottom()
  })
}

export function fitFollowing(term: FollowTerminal, applyResize: () => void): void {
  const follow = isAtBottom(term)
  applyResize()
  if (follow) term.scrollToBottom()
}
