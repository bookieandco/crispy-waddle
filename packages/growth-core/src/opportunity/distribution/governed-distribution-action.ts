import type { ActionExecutor, ActionHandler, ActionRequest } from '@jhadina/action-core'
import type { DistributionProviderRegistry } from './provider-adapter.js'
import type { DistributionJob } from './distribution-job.js'
import { dispatchDistributionJobToProvider } from './distribution-dispatcher.js'
import { createDistributionMeasurementEvent, type DistributionMeasurementSink } from './measurement-event.js'

export const DISTRIBUTION_PUBLISH_ACTION = 'growth.distribution.publish'

export type GovernedDistributionAction = {
  job: DistributionJob
  content: string
}

export type GovernedDistributionResult = DistributionJob

export class GovernedDistributionHandler implements ActionHandler<GovernedDistributionAction, GovernedDistributionResult> {
  constructor(private readonly registry: DistributionProviderRegistry, private readonly measurementSink?: DistributionMeasurementSink) {}

  supports(type: string): boolean {
    return type === DISTRIBUTION_PUBLISH_ACTION
  }

  async execute(action: GovernedDistributionAction): Promise<GovernedDistributionResult> {
    const result = await dispatchDistributionJobToProvider(action.job, action.content, this.registry)
    if (this.measurementSink && result.status === 'published') {
      await this.measurementSink.emit(createDistributionMeasurementEvent(result, {
        status: 'published',
        externalPostId: result.providerPostId,
        canonicalUrl: result.canonicalUrl,
        measurementId: result.measurementId,
      }, `${result.id}:published`))
    }
    return result
  }
}

export async function executeGovernedDistribution(
  executor: ActionExecutor<GovernedDistributionAction, GovernedDistributionResult>,
  request: ActionRequest<GovernedDistributionAction>,
): Promise<GovernedDistributionResult> {
  return executor.execute(request)
}
