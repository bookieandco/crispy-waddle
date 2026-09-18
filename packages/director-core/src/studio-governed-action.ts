import type { ActionExecutor, ActionHandler, ActionRequest } from '@jhadina/action-core'

export type DirectorStudioCapability =
  | 'tracking'
  | 'character-replace'
  | 'voice-sync'
  | 'rig'
  | 'physics'
  | 'render'
  | 'qc'

export type DirectorStudioAction = {
  projectId: string
  capability: DirectorStudioCapability
  inputAssetIds: string[]
  parameters?: Readonly<Record<string, unknown>>
}

export type DirectorStudioResult = {
  capability: DirectorStudioCapability
  projectId: string
  outputAssetIds: string[]
  evidenceIds: string[]
  requiresAssetApproval: true
}

export interface DirectorStudioCapabilityProvider {
  supports(capability: DirectorStudioCapability): boolean
  execute(action: DirectorStudioAction, request: ActionRequest<DirectorStudioAction>): Promise<Omit<DirectorStudioResult, 'requiresAssetApproval'>>
}

export function createDirectorStudioAction(input: {
  id: string
  userId: string
  requestedAt: string
  projectId: string
  capability: DirectorStudioCapability
  inputAssetIds: string[]
  parameters?: Readonly<Record<string, unknown>>
  approvalReceiptId?: string
}): ActionRequest<DirectorStudioAction> {
  return {
    id: input.id,
    userId: input.userId,
    type: `director.studio.${input.capability}`,
    requestedAt: input.requestedAt,
    approvalReceiptId: input.approvalReceiptId,
    action: {
      projectId: input.projectId,
      capability: input.capability,
      inputAssetIds: [...input.inputAssetIds],
      parameters: input.parameters,
    },
  }
}

/**
 * This is the only Director Studio handler boundary. Providers are deliberately
 * downstream of ActionExecutor policy/approval; callers must never invoke a
 * provider as a substitute for executor.execute().
 */
export function createDirectorStudioHandler(
  providers: readonly DirectorStudioCapabilityProvider[],
): ActionHandler<DirectorStudioAction, DirectorStudioResult> {
  return {
    supports: type => type.startsWith('director.studio.'),
    async execute(action, request) {
      const expectedType = `director.studio.${action.capability}`
      if (request.type !== expectedType) throw new Error(`Studio capability/type mismatch: ${request.type}`)
      const provider = providers.find(candidate => candidate.supports(action.capability))
      if (!provider) throw new Error(`No Director Studio provider for ${action.capability}`)
      const result = await provider.execute(action, request)
      return { ...result, requiresAssetApproval: true }
    },
  }
}

export async function executeGovernedDirectorStudioAction(
  executor: ActionExecutor<DirectorStudioAction, DirectorStudioResult>,
  request: ActionRequest<DirectorStudioAction>,
): Promise<DirectorStudioResult> {
  return executor.execute(request)
}
