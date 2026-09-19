import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

/** A user-defined Kanban column for the agent board (e.g. Backlog, Em andamento, Concluído). */
export const AgentBoardColumnSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  sortOrder: z.number().int(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type AgentBoardColumn = z.infer<typeof AgentBoardColumnSchema>

export const CreateAgentBoardColumnInputSchema = z.object({
  name: z.string().min(1)
})
export type CreateAgentBoardColumnInput = z.infer<typeof CreateAgentBoardColumnInputSchema>

export const UpdateAgentBoardColumnInputSchema = z.object({
  name: z.string().min(1)
})
export type UpdateAgentBoardColumnInput = z.infer<typeof UpdateAgentBoardColumnInputSchema>

/**
 * A local git worktree + agent CLI pairing, tracked on a Kanban board.
 * Not part of the Client→Environment→Group→Connection hierarchy — global,
 * user-picked repo path, no vault/credential involvement.
 */
export const AgentWorkspaceSchema = z.object({
  id: IdSchema,
  repoPath: z.string().min(1),
  repoName: z.string().min(1),
  branch: z.string().min(1),
  worktreePath: z.string().min(1),
  agentCommand: z.string().min(1),
  taskNote: z.string().nullable(),
  columnId: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type AgentWorkspace = z.infer<typeof AgentWorkspaceSchema>

export const CreateAgentWorkspaceInputSchema = z.object({
  repoPath: z.string().min(1),
  branch: z.string().min(1),
  agentCommand: z.string().min(1),
  taskNote: z.string().nullable().default(null),
  columnId: z.string().nullable().default(null)
})
export type CreateAgentWorkspaceInput = z.infer<typeof CreateAgentWorkspaceInputSchema>

export const UpdateAgentWorkspaceInputSchema = z.object({
  taskNote: z.string().nullable().optional(),
  columnId: z.string().nullable().optional()
})
export type UpdateAgentWorkspaceInput = z.infer<typeof UpdateAgentWorkspaceInputSchema>
