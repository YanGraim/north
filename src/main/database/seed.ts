import { app } from 'electron'
import type { Repositories } from '../repositories'
import { seedDevData } from './seed-data'

/**
 * Seeds sample inventory in development when NORTH_SEED=1 and the DB has no clients.
 */
export function maybeSeedDevData(repos: Repositories): void {
  const isDev = !app.isPackaged
  if (!isDev || process.env.NORTH_SEED !== '1') {
    return
  }

  if (repos.clients.list().length > 0) {
    return
  }

  seedDevData(repos)
}

export { seedDevData }
