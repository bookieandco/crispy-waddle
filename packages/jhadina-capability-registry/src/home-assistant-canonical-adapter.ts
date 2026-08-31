import type {
  HomeAssistantEntityInput,
  HomeAssistantServiceInput,
  JhadinaHomeEntity,
} from './home-assistant-adapter.js';
import {
  DeterministicHomeAssistantAdapter,
} from './home-assistant-adapter.js';
import type {
  CanonicalHomeDevice,
  CanonicalHomeEntity,
  HomeAutomationModel,
} from './home-automation-model.js';
import { buildHomeAutomationModel } from './home-automation-model.js';

export interface HomeAssistantCanonicalAdapter {
  normalizeEntity(
    entity: HomeAssistantEntityInput,
    services: readonly HomeAssistantServiceInput[],
  ): CanonicalHomeEntity;

  normalizeModel(
    entities: readonly HomeAssistantEntityInput[],
    services: readonly HomeAssistantServiceInput[],
  ): HomeAutomationModel;
}

function availability(entity: JhadinaHomeEntity): CanonicalHomeEntity['availability'] {
  if (entity.state === 'unavailable') return 'unavailable';
  if (entity.state === 'unknown' || entity.state === null) return 'unknown';
  return entity.available ? 'available' : 'unknown';
}

export class DeterministicHomeAssistantCanonicalAdapter
  implements HomeAssistantCanonicalAdapter {
  private readonly source = new DeterministicHomeAssistantAdapter();

  normalizeEntity(
    entity: HomeAssistantEntityInput,
    services: readonly HomeAssistantServiceInput[],
  ): CanonicalHomeEntity {
    const normalized = this.source.normalizeEntity(entity, services);
    return Object.freeze({
      entityId: normalized.entityId,
      deviceId: normalized.deviceId,
      domain: normalized.domain,
      state: normalized.state,
      availability: availability(normalized),
      friendlyName: normalized.friendlyName,
      deviceClass: normalized.deviceClass,
      unitOfMeasurement: normalized.unitOfMeasurement,
      supportedFeatures: normalized.supportedFeatures,
    });
  }

  normalizeModel(
    entities: readonly HomeAssistantEntityInput[],
    services: readonly HomeAssistantServiceInput[],
  ): HomeAutomationModel {
    const normalizedEntities = entities.map(entity => this.normalizeEntity(entity, services));
    const byDevice = new Map<string, CanonicalHomeDevice>();

    for (const entity of normalizedEntities) {
      const existing = byDevice.get(entity.deviceId);
      if (existing) {
        byDevice.set(entity.deviceId, {
          ...existing,
          entities: [...existing.entities, entity.entityId],
        });
        continue;
      }

      const sourceDeviceId = entity.deviceId.startsWith('ha:device:')
        ? entity.deviceId.slice('ha:device:'.length)
        : null;
      byDevice.set(entity.deviceId, {
        deviceId: entity.deviceId,
        name: null,
        manufacturer: null,
        model: null,
        entities: [entity.entityId],
        provenance: {
          source: 'home-assistant',
          sourceDeviceId,
        },
      });
    }

    return buildHomeAutomationModel(normalizedEntities, [...byDevice.values()]);
  }
}
