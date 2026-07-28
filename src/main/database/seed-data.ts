import type { Repositories } from '../repositories'

/** Deterministic sample inventory for tests and NORTH_SEED=1. */
export function seedDevData(repos: Repositories): void {
  const acme = repos.clients.create({
    name: 'Acme Corp',
    notes: 'Cliente principal de staging e produção',
    color: '#3b82f6'
  })
  const globex = repos.clients.create({
    name: 'Globex',
    notes: 'Ambiente de labs / POCs',
    color: '#10b981'
  })

  const acmeProd = repos.environments.create({
    clientId: acme.id,
    name: 'Produção',
    color: '#ef4444',
    sortOrder: 0
  })
  const acmeStaging = repos.environments.create({
    clientId: acme.id,
    name: 'Staging',
    color: '#eab308',
    sortOrder: 1
  })
  const globexLab = repos.environments.create({
    clientId: globex.id,
    name: 'Lab',
    color: '#3d8bfd',
    sortOrder: 0
  })

  const acmeApp = repos.groups.create({
    environmentId: acmeProd.id,
    name: 'App',
    sortOrder: 0
  })
  const acmeDb = repos.groups.create({
    environmentId: acmeProd.id,
    name: 'Banco',
    sortOrder: 1
  })
  const acmeEdge = repos.groups.create({
    environmentId: acmeStaging.id,
    name: 'Edge',
    sortOrder: 0
  })
  const globexApp = repos.groups.create({
    environmentId: globexLab.id,
    name: 'App',
    sortOrder: 0
  })

  const tagProd = repos.tags.create({ name: 'produção', color: '#ef4444' })
  const tagLinux = repos.tags.create({ name: 'linux', color: '#f59e0b' })
  const tagDb = repos.tags.create({ name: 'database', color: '#8b5cf6' })
  const tagBastion = repos.tags.create({ name: 'bastion', color: '#64748b' })

  const bastion = repos.connections.create({
    groupId: acmeEdge.id,
    name: 'Bastion Staging',
    description: 'Jump host para staging',
    protocol: 'ssh',
    host: 'bastion.staging.acme.local',
    port: 22,
    username: 'ubuntu',
    authMethod: 'key',
    os: 'Ubuntu 24.04',
    owner: 'Platform',
    vpnRequired: true,
    isFavorite: true,
    links: [{ label: 'Runbook', url: 'https://wiki.acme.local/bastion' }]
  })

  const web1 = repos.connections.create({
    groupId: acmeApp.id,
    name: 'web-01',
    description: 'Frontend API',
    protocol: 'ssh',
    host: 'web-01.prod.acme.local',
    port: 22,
    username: 'deploy',
    authMethod: 'agent',
    jumpHostId: bastion.id,
    os: 'Ubuntu 22.04',
    owner: 'App Team',
    vpnRequired: true,
    isFavorite: true,
    checklist: [
      { id: '11111111-1111-4111-8111-111111111111', text: 'VPN ligada', done: false },
      { id: '22222222-2222-4222-8222-222222222222', text: 'Checar status nginx', done: false }
    ]
  })

  const web2 = repos.connections.create({
    groupId: acmeApp.id,
    name: 'web-02',
    protocol: 'ssh',
    host: 'web-02.prod.acme.local',
    port: 22,
    username: 'deploy',
    authMethod: 'agent',
    jumpHostId: bastion.id,
    os: 'Ubuntu 22.04',
    vpnRequired: true
  })

  const dbPrimary = repos.connections.create({
    groupId: acmeDb.id,
    name: 'pg-primary',
    description: 'PostgreSQL primary',
    protocol: 'ssh',
    host: 'pg-01.prod.acme.local',
    port: 22,
    username: 'dbadmin',
    authMethod: 'key',
    os: 'Debian 12',
    owner: 'Data',
    vpnRequired: true,
    defaultCommand: 'sudo -iu postgres'
  })

  const dbReplica = repos.connections.create({
    groupId: acmeDb.id,
    name: 'pg-replica',
    protocol: 'ssh',
    host: 'pg-02.prod.acme.local',
    port: 22,
    username: 'dbadmin',
    authMethod: 'key',
    vpnRequired: true
  })

  const rdpJump = repos.connections.create({
    groupId: acmeApp.id,
    name: 'Win Jump',
    protocol: 'rdp',
    host: 'jump.prod.acme.local',
    port: 3389,
    username: 'acme\\ops',
    authMethod: 'password',
    os: 'Windows Server 2022',
    vpnRequired: true
  })

  const stagingApi = repos.connections.create({
    groupId: acmeEdge.id,
    name: 'api-staging',
    protocol: 'ssh',
    host: 'api.staging.acme.local',
    port: 22,
    username: 'deploy',
    authMethod: 'agent',
    jumpHostId: bastion.id
  })

  const labApp = repos.connections.create({
    groupId: globexApp.id,
    name: 'lab-app-01',
    protocol: 'ssh',
    host: '10.20.0.10',
    port: 22,
    username: 'lab',
    authMethod: 'password',
    os: 'Alpine',
    owner: 'Labs'
  })

  repos.connections.create({
    groupId: globexApp.id,
    name: 'Grafana Lab',
    protocol: 'https',
    host: 'grafana.lab.globex.local',
    port: 443,
    authMethod: 'none',
    links: [{ label: 'Dashboards', url: 'https://grafana.lab.globex.local' }]
  })

  repos.connections.create({
    groupId: globexApp.id,
    name: 'sftp-inbox',
    protocol: 'sftp',
    host: 'files.lab.globex.local',
    port: 22,
    username: 'inbox',
    authMethod: 'key'
  })

  repos.tags.setForConnection({
    connectionId: bastion.id,
    tagIds: [tagBastion.id, tagLinux.id]
  })
  repos.tags.setForConnection({
    connectionId: web1.id,
    tagIds: [tagProd.id, tagLinux.id]
  })
  repos.tags.setForConnection({
    connectionId: web2.id,
    tagIds: [tagProd.id, tagLinux.id]
  })
  repos.tags.setForConnection({
    connectionId: dbPrimary.id,
    tagIds: [tagProd.id, tagDb.id, tagLinux.id]
  })
  repos.tags.setForConnection({
    connectionId: dbReplica.id,
    tagIds: [tagProd.id, tagDb.id]
  })
  repos.tags.setForConnection({
    connectionId: rdpJump.id,
    tagIds: [tagProd.id]
  })
  repos.tags.setForConnection({
    connectionId: stagingApi.id,
    tagIds: [tagLinux.id]
  })
  repos.tags.setForConnection({
    connectionId: labApp.id,
    tagIds: [tagLinux.id]
  })
}
