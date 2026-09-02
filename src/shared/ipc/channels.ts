/**
 * Canais IPC do North.
 * Fonte única de verdade para nomes de canais entre main, preload e renderer.
 */
export const IpcChannels = {
  APP_GET_VERSION: 'app:get-version',
  APP_GET_IDENTITY: 'app:get-identity',
  APP_SET_THEME: 'app:set-theme',

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
  SESSIONS_OPEN_ACCESS: 'sessions:open-access',
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

  DB_TEST: 'db:test',
  DB_INTROSPECT: 'db:introspect',
  DB_QUERY: 'db:query',
  DB_CANCEL: 'db:cancel',
  DB_TX_STATE: 'db:tx-state',
  DB_SET_AUTO_COMMIT: 'db:set-auto-commit',
  DB_COMMIT: 'db:commit',
  DB_ROLLBACK: 'db:rollback',
  DB_PICK_FILE: 'db:pick-file',
  DB_EXPORT: 'db:export',

  STATS_OVERVIEW: 'stats:overview',

  INVENTORY_EXPORT: 'inventory:export',
  INVENTORY_IMPORT: 'inventory:import',
  INVENTORY_IMPORT_CSV: 'inventory:import-csv',
  INVENTORY_DOWNLOAD_CSV_TEMPLATE: 'inventory:download-csv-template',

  UPDATES_CHECK: 'updates:check',
  UPDATES_INSTALL: 'updates:install',
  UPDATES_GET_STATUS: 'updates:get-status',
  /** Main → renderer (event): update available. */
  UPDATES_AVAILABLE: 'updates:available',
  /** Main → renderer (event): full update state changed. */
  UPDATES_STATUS_CHANGED: 'updates:status-changed',

  WORKFLOWS_LIST: 'workflows:list',
  WORKFLOWS_GET: 'workflows:get',
  WORKFLOWS_CREATE: 'workflows:create',
  WORKFLOWS_COPY: 'workflows:copy',
  WORKFLOWS_UPDATE: 'workflows:update',
  WORKFLOWS_DELETE: 'workflows:delete',
  WORKFLOWS_LIST_VARIABLES: 'workflows:list-variables',
  WORKFLOWS_CREATE_VARIABLE: 'workflows:create-variable',
  WORKFLOWS_UPDATE_VARIABLE: 'workflows:update-variable',
  WORKFLOWS_DELETE_VARIABLE: 'workflows:delete-variable',
  WORKFLOWS_LIST_RUNS: 'workflows:list-runs',
  WORKFLOWS_GET_RUN: 'workflows:get-run',
  WORKFLOWS_RUN: 'workflows:run',
  WORKFLOWS_RESPOND: 'workflows:respond',
  WORKFLOWS_CANCEL: 'workflows:cancel',
  WORKFLOWS_LIST_CONNECTION_SECRETS: 'workflows:list-connection-secrets',
  WORKFLOWS_SET_CONNECTION_SECRET: 'workflows:set-connection-secret',
  WORKFLOWS_DELETE_CONNECTION_SECRET: 'workflows:delete-connection-secret',
  /** Main → renderer (event): workflow run timeline event. */
  WORKFLOWS_RUN_EVENT: 'workflows:run-event',

  API_SEND: 'api:send',
  API_CANCEL: 'api:cancel',
  API_HISTORY_LIST: 'api:history-list',
  API_COLLECTION_LIST: 'api:collection-list',
  API_COLLECTION_CREATE: 'api:collection-create',
  API_COLLECTION_UPDATE: 'api:collection-update',
  API_COLLECTION_DELETE: 'api:collection-delete',
  API_COLLECTION_DUPLICATE: 'api:collection-duplicate',
  API_COLLECTION_IMPORT: 'api:collection-import',
  API_COLLECTION_EXPORT: 'api:collection-export',
  API_FOLDER_LIST: 'api:folder-list',
  API_FOLDER_CREATE: 'api:folder-create',
  API_FOLDER_UPDATE: 'api:folder-update',
  API_FOLDER_DELETE: 'api:folder-delete',
  API_REQUEST_LIST: 'api:request-list',
  API_REQUEST_CREATE: 'api:request-create',
  API_REQUEST_UPDATE: 'api:request-update',
  API_REQUEST_DELETE: 'api:request-delete',
  API_REQUEST_DUPLICATE: 'api:request-duplicate',
  API_REQUEST_MOVE: 'api:request-move',
  API_VARIABLE_LIST: 'api:variable-list',
  API_VARIABLE_SET: 'api:variable-set',
  API_VARIABLE_DELETE: 'api:variable-delete'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
