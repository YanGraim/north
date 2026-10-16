import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * What North needs to stop a root-owned tunnel it can't `kill`: the management
 * port + per-session password (and pid as last resort). One 0600 file per profile.
 */
export type TunnelRecord = {
  profileId: string
  pid: number | null
  managementPort: number
  managementPassword: string
}

export class TunnelRegistry {
  constructor(private readonly dir: string) {}

  write(record: TunnelRecord): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 })
    writeFileSync(this.path(record.profileId), JSON.stringify(record), { mode: 0o600 })
  }

  remove(profileId: string): void {
    rmSync(this.path(profileId), { force: true })
  }

  list(): TunnelRecord[] {
    let names: string[]
    try {
      names = readdirSync(this.dir).filter((n) => n.endsWith('.json'))
    } catch {
      return []
    }
    const records: TunnelRecord[] = []
    for (const name of names) {
      try {
        records.push(JSON.parse(readFileSync(join(this.dir, name), 'utf8')) as TunnelRecord)
      } catch {
        rmSync(join(this.dir, name), { force: true })
      }
    }
    return records
  }

  private path(profileId: string): string {
    if (!/^[A-Za-z0-9-]+$/.test(profileId)) throw new Error('Invalid profile id')
    return join(this.dir, `${profileId}.json`)
  }
}
