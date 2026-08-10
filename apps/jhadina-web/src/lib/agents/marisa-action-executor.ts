import type { ActionRequest } from "../../../../packages/jhadina-action-core/src/action-executor"

export interface GovernedActionExecutor<TResult = unknown> {
  execute(request: ActionRequest<unknown>): Promise<TResult>
}

export interface MarisaExecutionRequest {
  id: string
  userId: string
  type: string
  action: unknown
  requestedAt: string
}

/** MARISA's side-effect boundary. It cannot execute directly; it delegates to Jhadina's governed executor. */
export class MarisaActionExecutor {
  constructor(private readonly executor: GovernedActionExecutor) {}

  async execute(request: MarisaExecutionRequest): Promise<unknown> {
    const actionRequest: ActionRequest = {
      id: request.id,
      userId: request.userId,
      type: request.type,
      action: request.action,
      requestedAt: request.requestedAt,
    }
    return this.executor.execute(actionRequest)
  }
}
