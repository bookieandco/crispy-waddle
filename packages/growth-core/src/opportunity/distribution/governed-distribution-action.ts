import type { ActionExecutor, ActionHandler, ActionRequest } from '@jhadina/action-core'
import type { DistributionProviderRegistry, DistributionProviderResult } from './provider-adapter.js'
import type { DistributionJob } from './distribution-job.js'
import { dispatchDistributionJobToProvider } from './distribution-dispatcher.js'

export const DISTRIBUTION_PUBLISH_ACTION = 'growth.distribution.publish'

export type GovernedDistributionAction = {
  job: DistributionJob
  content: string
}

export type GovernedDistributionResult = DistributionJob

export class GovernedDistributionHandler implements ActionHandler<GovernedDistributionAction, GovernedDistributionResult> {
  constructor(private readonly registry: DistributionProviderRegistry) {}

  supports(type: string): boolean {
    return type === DISTRIBUTION_PUBLISH_ACTION
  }

  async execute(action: GovernedDistributionAction): Promise<GovernedDistributionResult> {
    return dispatchDistributionJobToProvider(action.job, action.content, this.registry)
  }
}

export async function executeGovernedDistribution(
  executor: ActionExecutor<GovernedDistributionAction, GovernedDistributionResult>,
  request: ActionRequest<GovernedDistributionAction>,
): Promise<DistributionProviderResult | GovernedDistributionResult> {
  return executor.execute(request)
}
