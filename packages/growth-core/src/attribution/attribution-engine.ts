import type { Conversion, Touchpoint } from './touchpoint.js';
import type { GrowthId } from '../domain/types.js';

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear';

export interface AttributionCredit {
  touchpointId: GrowthId;
  campaignId?: GrowthId;
  creativeId?: GrowthId;
  channelId?: GrowthId;
  credit: number;
}

export interface AttributionResult {
  conversionId: GrowthId;
  model: AttributionModel;
  credits: AttributionCredit[];
  confidence: number;
  sourceTouchpointIds: GrowthId[];
}

export class AttributionEngine {
  attribute(conversion: Conversion, touchpoints: readonly Touchpoint[], model: AttributionModel): AttributionResult {
    const ordered = touchpoints
      .filter((touchpoint) => touchpoint.occurredAt <= conversion.occurredAt)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    if (ordered.length === 0) {
      return { conversionId: conversion.id, model, credits: [], confidence: 0, sourceTouchpointIds: [] };
    }

    const selected = model === 'first_touch'
      ? [ordered[0]]
      : model === 'last_touch'
        ? [ordered[ordered.length - 1]]
        : ordered;

    const credit = 1 / selected.length;
    const credits = selected.map((touchpoint) => ({
      touchpointId: touchpoint.id,
      campaignId: touchpoint.campaignId,
      creativeId: touchpoint.creativeId,
      channelId: touchpoint.channelId,
      credit,
    }));

    return {
      conversionId: conversion.id,
      model,
      credits,
      confidence: Math.min(1, selected.length > 1 ? 0.8 : 0.9),
      sourceTouchpointIds: selected.map((touchpoint) => touchpoint.id),
    };
  }
}
