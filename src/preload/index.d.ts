import type { NorthApi } from '../shared/ipc'

declare global {
  interface Window {
    north: NorthApi
  }
}
