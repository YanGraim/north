import type { Migration } from '../migrate'
import { migration001InitialSchema } from './001-initial-schema'
import { migration002Credentials } from './002-credentials'
import { migration003KnownHosts } from './003-known-hosts'
import { migration004Accesses } from './004-accesses'
import { migration005EnvironmentColor } from './005-environment-color'
import { migration006Workflows } from './006-workflows'
import { migration007AccessHistory } from './007-access-history'
import { migration008ApiClient } from './008-api-client'
import { migration009ApiCollectionsClient } from './009-api-collections-client'
import { migration010ApiEnvironmentEnabled } from './010-api-environment-enabled'
import { migration011ApiPresets } from './011-api-presets'
import { migration012AgentWorkspaces } from './012-agent-workspaces'
import { migration013EnvironmentUpdates } from './013-environment-updates'
import { migration014ApiRequestDescription } from './014-api-request-description'
import { migration015ConnectionHealth } from './015-connection-health'

/** Ordered list of schema migrations. Append new ones; never reorder or reuse versions. */
export const migrations: Migration[] = [
  migration001InitialSchema,
  migration002Credentials,
  migration003KnownHosts,
  migration004Accesses,
  migration005EnvironmentColor,
  migration006Workflows,
  migration007AccessHistory,
  migration008ApiClient,
  migration009ApiCollectionsClient,
  migration010ApiEnvironmentEnabled,
  migration011ApiPresets,
  migration012AgentWorkspaces,
  migration013EnvironmentUpdates,
  migration014ApiRequestDescription,
  migration015ConnectionHealth
]
