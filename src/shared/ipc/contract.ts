import { IpcChannels } from './channels'

/**
 * Contrato tipado de invoke (request/response) entre renderer e main.
 * Adicione novos canais aqui; main, preload e hooks devem seguir este mapa.
 */
export interface IpcInvokeMap {
  [IpcChannels.APP_GET_VERSION]: {
    args: []
    result: string
  }
}

export type InvokeChannel = keyof IpcInvokeMap

export type InvokeArgs<C extends InvokeChannel> = IpcInvokeMap[C]['args']
export type InvokeResult<C extends InvokeChannel> = IpcInvokeMap[C]['result']

/** API tipada exposta ao renderer via contextBridge. */
export interface NorthApi {
  getVersion: () => Promise<string>
}
