const DEFAULT_NEAR_BOTTOM_PX = 48

export type ScrollMetrics = {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

export function isNearBottom(el: ScrollMetrics, thresholdPx = DEFAULT_NEAR_BOTTOM_PX): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx
}

export function stickToBottom(el: { scrollTop: number; scrollHeight: number }): void {
  el.scrollTop = el.scrollHeight
}
