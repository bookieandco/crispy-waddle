export type HomeAutomationAvailability = 'available' | 'unavailable' | 'unknown';

export interface CanonicalHomeEntity {
  readonly entityId: string;
  readonly deviceId: string;
  readonly domain: string;
  readonly state: string | number | null;
  readonly availability: HomeAutomationAvailability;
  readonly friendlyName: string | null;
  readonly deviceClass: string | null;
  readonly unitOfMeasurement: string | null;
  readonly supportedFeatures: number | null;
}

export interface CanonicalHomeDevice {
  readonly deviceId: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly entities: readonly string[];
  readonly provenance: {
    readonly source: 'home-assistant';
    readonly sourceDeviceId: string | null;
  };
}

export interface HomeAutomationModel {
  readonly entities: readonly CanonicalHomeEntity[];
  readonly devices: readonly CanonicalHomeDevice[];
}

export function normalizeHomeEntity(entity: CanonicalHomeEntity): CanonicalHomeEntity {
  if (!/^ha:entity:[a-z0-9_]+\.[a-z0-9_]+$/.test(entity.entityId)) {
    throw new Error('invalid-canonical-home-entity');
  }
  if (!/^ha:device:[^\s:]+$/.test(entity.deviceId)) {
    throw new Error('invalid-canonical-home-device');
  }
  return Object.freeze({ ...entity });
}

export function normalizeHomeDevice(device: CanonicalHomeDevice): CanonicalHomeDevice {
  if (!/^ha:device:[^\s:]+$/.test(device.deviceId)) {
    throw new Error('invalid-canonical-home-device');
  }
  const entities = [...new Set(device.entities)].sort();
  if (entities.some(entityId => !/^ha:entity:[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId))) {
    throw new Error('invalid-canonical-home-entity');
  }
  return Object.freeze({ ...device, entities: Object.freeze(entities) });
}

export function buildHomeAutomationModel(
  entities: readonly CanonicalHomeEntity[],
  devices: readonly CanonicalHomeDevice[],
): HomeAutomationModel {
  const normalizedEntities = [...entities]
    .map(normalizeHomeEntity)
    .sort((a, b) => a.entityId.localeCompare(b.entityId));
  const normalizedDevices = [...devices]
    .map(normalizeHomeDevice)
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  return Object.freeze({
    entities: Object.freeze(normalizedEntities),
    devices: Object.freeze(normalizedDevices),
  });
}
