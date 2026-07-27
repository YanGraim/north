export type UpdateStatus = {
  enabled: boolean
  checking: boolean
  available: boolean
  version: string | null
  downloaded: boolean
  downloading: boolean
  progress: number | null
  error: string | null
}
