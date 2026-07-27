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

  ACCESSES_LIST: 'accesses:list',
  ACCESSES_GET: 'accesses:get',
  ACCESSES_CREATE: 'accesses:create',
  ACCESSES_UPDATE: 'accesses:update',
  ACCESSES_DELETE: 'accesses:delete',
  ACCESSES_TOGGLE_FAVORITE: 'accesses:toggle-favorite',

  TAGS_LIST: 'tags:list',
  TAGS_CREATE: 'tags:create',
  TAGS_UPDATE: 'tags:update',
  TAGS_DELETE: 'tags:delete',
  TAGS_SET_FOR_CONNECTION: 'tags:set-for-connection',
  TAGS_LIST_FOR_CONNECTION: 'tags:list-for-connection',
  TAGS_SET_FOR_ACCESS: 'tags:set-for-access',
  TAGS_LIST_FOR_ACCESS: 'tags:list-for-access',

  HISTORY_LIST: 'history:list',
  HISTORY_RECORD: 'history:record',

  SEARCH_INDEX: 'search:index',

  VAULT_SET_SECRET: 'vault:set-secret',
  VAULT_DELETE_SECRET: 'vault:delete-secret',
  VAULT_HAS_SECRET: 'vault:has-secret',
  VAULT_IS_AVAILABLE: 'vault:is-available',
  VAULT_REVEAL_SECRET: 'vault:reveal-secret',

  SESSIONS_OPEN: 'sessions:open',
  SESSIONS_CLOSE: 'sessions:close',
  SESSIONS_LIST: 'sessions:list',
  SESSIONS_RESPOND_HOST_KEY: 'sessions:respond-host-key',

  /** Main → renderer (event): MessagePort transfer payload. */
  SESSIONS_PORT: 'sessions:port',
  /** Main → renderer (event): session descriptor state changed. */
  SESSIONS_STATE_CHANGED: 'sessions:state-changed',
  /** Main → renderer (event): host key trust prompt. */
  SESSIONS_HOST_KEY_PROMPT: 'sessions:host-key-prompt',
  /**
   * Terminal byte stream via IPC (reliable under sandbox/contextIsolation).
   * MessagePort remains for desktop; terminal I/O uses these channels.
   */
  SESSIONS_STDOUT: 'sessions:stdout',
  SESSIONS_STDIN: 'sessions:stdin',
  SESSIONS_RESIZE: 'sessions:resize',
  SESSIONS_STDOUT_READY: 'sessions:stdout-ready',

  FS_LIST: 'fs:list',
  FS_MKDIR: 'fs:mkdir',
  FS_RENAME: 'fs:rename',
  FS_DELETE: 'fs:delete',
  FS_DOWNLOAD: 'fs:download',
  FS_UPLOAD: 'fs:upload',
  /** Main → renderer (event): transfer progress. */
  FS_PROGRESS: 'fs:progress',

  SERIAL_LIST_PORTS: 'serial:list-ports',

  STATS_OVERVIEW: 'stats:overview',

  INVENTORY_EXPORT: 'inventory:export',
  INVENTORY_IMPORT: 'inventory:import',
  INVENTORY_IMPORT_CSV: 'inventory:import-csv',
  INVENTORY_DOWNLOAD_CSV_TEMPLATE: 'inventory:download-csv-template',

  UPDATES_CHECK: 'updates:check',
  UPDATES_INSTALL: 'updates:install',
  /** Main → renderer (event): update available. */
  UPDATES_AVAILABLE: 'updates:available'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
