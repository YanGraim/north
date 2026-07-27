/**
 * Canais IPC do North.
 * Fonte única de verdade para nomes de canais entre main, preload e renderer.
 */
export const IpcChannels = {
  APP_GET_VERSION: 'app:get-version',

  CLIENTS_LIST: 'clients:list',
  CLIENTS_GET: 'clients:get',
  CLIENTS_CREATE: 'clients:create',
  CLIENTS_UPDATE: 'clients:update',
  CLIENTS_DELETE: 'clients:delete',

  ENVIRONMENTS_LIST: 'environments:list',
  ENVIRONMENTS_GET: 'environments:get',
  ENVIRONMENTS_CREATE: 'environments:create',
  ENVIRONMENTS_UPDATE: 'environments:update',
  ENVIRONMENTS_DELETE: 'environments:delete',

  GROUPS_LIST: 'groups:list',
  GROUPS_GET: 'groups:get',
  GROUPS_CREATE: 'groups:create',
  GROUPS_UPDATE: 'groups:update',
  GROUPS_DELETE: 'groups:delete',

  CONNECTIONS_LIST: 'connections:list',
  CONNECTIONS_GET: 'connections:get',
  CONNECTIONS_CREATE: 'connections:create',
  CONNECTIONS_UPDATE: 'connections:update',
  CONNECTIONS_DELETE: 'connections:delete',
  CONNECTIONS_TOGGLE_FAVORITE: 'connections:toggle-favorite',
  CONNECTIONS_DUPLICATE: 'connections:duplicate',

  TAGS_LIST: 'tags:list',
  TAGS_CREATE: 'tags:create',
  TAGS_UPDATE: 'tags:update',
  TAGS_DELETE: 'tags:delete',
  TAGS_SET_FOR_CONNECTION: 'tags:set-for-connection',
  TAGS_LIST_FOR_CONNECTION: 'tags:list-for-connection',

  HISTORY_LIST: 'history:list',
  HISTORY_RECORD: 'history:record'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
