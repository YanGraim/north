/**
 * Canais IPC do North.
 * Fonte única de verdade para nomes de canais entre main, preload e renderer.
 */
export const IpcChannels = {
  APP_GET_VERSION: 'app:get-version'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
