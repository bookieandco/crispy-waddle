import type { GrowthId } from '../domain/types.js';
import type { ResolvedAttributionPath } from './event-resolution.js';

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear';

export interface AttributionCredit {
  customerId: GrowthId;
  touchpointEventId: GrowthId;
  campaignId?: GrowthId;
  assetId?: GrowthId;
  creativeConceptId?: GrowthId;
  audienceId?: GrowthId;
  offerId?: GrowthId;
  attributedRevenue: number;
  model: AttributionModel;
}

export function attributeRevenue(
  paths: readonly ResolvedAttributionPath[],
  model: AttributionModel,
): AttributionCredit[] {
  return paths.flatMap((path) => {
    const events = path.advertisingEventIds;
    if (!events.length || path.resolution === 'unresolved') return [];
    const weights = model === 'linear'
      ? events.map(() => 1 / events.length)
      : events.map((_, index) => model === 'first_touch' && index === 0 || model === 'last_touch' && index === events.length - 1 ? 1 : 0);

    return events.flatMap((eventId, index) => weights[index] > 0 ? [{
      customerId: path.customerId,
      touchpointEventId: eventId,
      campaignId: path.campaignId,
      assetId: path.assetId,
      creativeConceptId: path.creativeConceptId,
      audienceId: path.audienceId,
      offerId: path.offerId,
      attributedRevenue: path.revenue * weights[index],
      model,
    }] : []);
  });
}
