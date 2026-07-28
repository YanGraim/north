import type { Migration } from '../migrate'
import { migration001InitialSchema } from './001-initial-schema'
import { migration002Credentials } from './002-credentials'
import { migration003KnownHosts } from './003-known-hosts'
import { migration004Accesses } from './004-accesses'
import { migration005EnvironmentColor } from './005-environment-color'

/** Ordered list of schema migrations. Append new ones; never reorder or reuse versions. */
export const migrations: Migration[] = [
  migration001InitialSchema,
  migration002Credentials,
  migration003KnownHosts,
  migration004Accesses,
  migration005EnvironmentColor
]
