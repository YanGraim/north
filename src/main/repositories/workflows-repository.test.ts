import {
  cloneWorkflowDefinition,
  emptyWorkflowDefinition,
  normalizeWorkflowName
} from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'

describe('workflow repositories', () => {
  function seedGroup() {
    const { repos } = createTestRepositories()
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const connection = repos.connections.create({
      groupId: group.id,
      name: 'web',
      protocol: 'ssh',
      host: '10.0.0.1',
      port: 22,
      authMethod: 'password',
      credentialRef: null
    })
    return { repos, group, connection }
  }

  it('CRUDs workflows with definition JSON', () => {
    const { repos, group } = seedGroup()
    const created = repos.workflows.create({
      groupId: group.id,
      name: 'Deploy API',
      definition: {
        schemaVersion: 1,
        inputs: [
          {
            id: crypto.randomUUID(),
            key: 'version',
            label: 'Version',
            type: 'string',
            required: true
          }
        ],
        steps: [
          {
            id: crypto.randomUUID(),
            type: 'ssh.exec',
            name: 'Deploy',
            policy: { onFailure: 'stop' },
            config: { command: 'echo {{version}}' }
          }
        ]
      }
    })

    expect(repos.workflows.listByGroup(group.id)).toHaveLength(1)
    expect(repos.workflows.get(created.id)?.definition.inputs[0]?.key).toBe('version')

    const updated = repos.workflows.update(created.id, { name: 'Deploy' })
    expect(updated?.name).toBe('Deploy')
    expect(repos.workflows.delete(created.id)).toBe(true)
    expect(repos.workflows.listByGroup(group.id)).toHaveLength(0)
  })

  it('CRUDs group variables', () => {
    const { repos, group } = seedGroup()
    const variable = repos.groupVariables.create({
      groupId: group.id,
      key: 'PROJECT_PATH',
      value: '/var/www/app'
    })
    expect(repos.groupVariables.toRecord(group.id)).toEqual({
      PROJECT_PATH: '/var/www/app'
    })
    repos.groupVariables.update(variable.id, { value: '/opt/app' })
    expect(repos.groupVariables.get(variable.id)?.value).toBe('/opt/app')
    expect(repos.groupVariables.delete(variable.id)).toBe(true)
  })

  it('creates workflow runs with immutable snapshots', () => {
    const { repos, group, connection } = seedGroup()
    const workflow = repos.workflows.create({
      groupId: group.id,
      name: 'W',
      definition: emptyWorkflowDefinition()
    })
    const definitionSnapshot = {
      schemaVersion: 1 as const,
      inputs: [],
      steps: [
        {
          id: crypto.randomUUID(),
          type: 'ssh.exec',
          name: 'A',
          policy: { onFailure: 'stop' as const },
          config: { command: 'echo 1' }
        }
      ]
    }
    const run = repos.workflowRuns.create({
      workflowId: workflow.id,
      groupId: group.id,
      mode: 'live',
      targets: [{ connectionId: connection.id }],
      definitionSnapshot,
      variablesSnapshot: { PROJECT_PATH: '/tmp' },
      inputValues: {}
    })

    repos.workflows.update(workflow.id, {
      definition: emptyWorkflowDefinition()
    })

    const stored = repos.workflowRuns.get(run.id)
    expect(stored?.definitionSnapshot.steps).toHaveLength(1)
    expect(stored?.variablesSnapshot.PROJECT_PATH).toBe('/tmp')

    repos.workflowRuns.updateStatus(run.id, 'succeeded', new Date().toISOString())
    expect(repos.workflowRuns.get(run.id)?.status).toBe('succeeded')
  })

  it('upserts connection secrets by kind', () => {
    const { repos, connection } = seedGroup()
    const first = repos.connectionSecrets.upsert(connection.id, 'password', crypto.randomUUID())
    const second = repos.connectionSecrets.upsert(connection.id, 'password', crypto.randomUUID())
    expect(second.id).toBe(first.id)
    expect(second.credentialRef).not.toBe(first.credentialRef)
    expect(repos.connectionSecrets.listByConnection(connection.id)).toHaveLength(1)
    repos.connectionSecrets.upsert(connection.id, 'sudo', crypto.randomUUID())
    expect(repos.connectionSecrets.listByConnection(connection.id)).toHaveLength(2)
  })

  it('clones a workflow into another group without preferred connection', () => {
    const { repos, group, connection } = seedGroup()
    const groupB = repos.groups.create({ environmentId: group.environmentId, name: 'G2' })
    const stepId = crypto.randomUUID()
    const source = repos.workflows.create({
      groupId: group.id,
      name: 'Deploy',
      preferredConnectionId: connection.id,
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: stepId,
            type: 'ssh.exec',
            name: 'Git pull',
            policy: { onFailure: 'stop' },
            config: { command: 'git pull', authHints: ['git'] }
          }
        ]
      }
    })

    const copy = repos.workflows.create({
      groupId: groupB.id,
      name: source.name,
      preferredConnectionId: null,
      definition: cloneWorkflowDefinition(source.definition)
    })

    expect(copy.groupId).toBe(groupB.id)
    expect(copy.preferredConnectionId).toBeNull()
    expect(copy.definition.steps[0]?.name).toBe('Git pull')
    expect(copy.definition.steps[0]?.id).not.toBe(stepId)
    expect(repos.workflows.listByGroup(group.id)).toHaveLength(1)
    expect(repos.workflows.listByGroup(groupB.id)).toHaveLength(1)
  })

  it('detects same-name collision when copying back to a group', () => {
    const { repos, group } = seedGroup()
    const groupB = repos.groups.create({ environmentId: group.environmentId, name: 'G2' })
    repos.workflows.create({
      groupId: group.id,
      name: 'teste',
      definition: emptyWorkflowDefinition()
    })
    const inB = repos.workflows.create({
      groupId: groupB.id,
      name: 'teste',
      definition: emptyWorkflowDefinition()
    })

    const sourceKey = normalizeWorkflowName(inB.name)
    const conflicts = repos.workflows
      .listByGroup(group.id)
      .filter((w) => normalizeWorkflowName(w.name) === sourceKey)
    expect(conflicts).toHaveLength(1)
  })
})
