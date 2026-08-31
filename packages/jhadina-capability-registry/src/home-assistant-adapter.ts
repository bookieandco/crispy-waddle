import type { CapabilityDefinition, CapabilityRisk } from './index.js';

export interface HomeAssistantEntityInput {
  readonly entity_id: string;
  readonly device_id?: string | null;
  readonly state: string | number | null;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface HomeAssistantServiceInput {
  readonly domain: string;
  readonly service: string;
  readonly description?: string;
}

export interface JhadinaEntityProvenance {
  readonly source: 'home-assistant';
  readonly sourceEntityId: string;
  readonly sourceDeviceId: string | null;
  readonly domain: string;
}

export interface JhadinaEntityCapability extends CapabilityDefinition {
  readonly sourceService: string;
}

export interface JhadinaHomeEntity {
  readonly entityId: string;
  readonly deviceId: string;
  readonly domain: string;
  readonly state: string | number | null;
  readonly available: boolean;
  readonly friendlyName: string | null;
  readonly deviceClass: string | null;
  readonly unitOfMeasurement: string | null;
  readonly supportedFeatures: number | null;
  readonly capabilities: readonly JhadinaEntityCapability[];
  readonly provenance: JhadinaEntityProvenance;
}

export interface HomeAssistantAdapter {
  normalizeEntity(
    entity: HomeAssistantEntityInput,
    services: readonly HomeAssistantServiceInput[],
  ): JhadinaHomeEntity;
}

const SECRET_KEY = /token|secret|password|authorization|credential|api[_-]?key/i;

function entityDomain(entityId: string): string {
  const [domain] = entityId.trim().split('.', 1);
  if (!domain) throw new Error('invalid-home-assistant-entity-id');
  return domain;
}

function canonicalEntityId(entityId: string): string {
  const normalized = entityId.trim().toLowerCase();
  if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(normalized)) {
    throw new Error('invalid-home-assistant-entity-id');
  }
  return `ha:entity:${normalized}`;
}

function canonicalDeviceId(entity: HomeAssistantEntityInput, canonicalEntity: string): string {
  const sourceDeviceId = entity.device_id?.trim();
  return sourceDeviceId ? `ha:device:${sourceDeviceId}` : `ha:entity:${canonicalEntity.slice('ha:entity:'.length)}`;
}

function safeAttribute<T>(attributes: Readonly<Record<string, unknown>> | undefined, key: string): T | null {
  const value = attributes?.[key];
  if (value === undefined || value === null || SECRET_KEY.test(key)) return null;
  return value as T;
}

function capabilityRisk(service: string): CapabilityRisk {
  return /delete|remove|unlock|open_cover|close_cover|lock|turn_off/i.test(service) ? 'destructive' : 'write';
}

export class DeterministicHomeAssistantAdapter implements HomeAssistantAdapter {
  normalizeEntity(
    entity: HomeAssistantEntityInput,
    services: readonly HomeAssistantServiceInput[],
  ): JhadinaHomeEntity {
    const canonicalEntity = canonicalEntityId(entity.entity_id);
    const domain = entityDomain(entity.entity_id);
    const deviceId = canonicalDeviceId(entity, canonicalEntity);
    const attributes = entity.attributes;
    const domainServices = services
      .filter(service => service.domain.trim().toLowerCase() === domain)
      .filter(service => service.service.trim())
      .sort((a, b) => a.service.localeCompare(b.service));

    const capabilities = domainServices.map(service => {
      const action = service.service.trim().toLowerCase();
      return Object.freeze({
        name: `homeassistant.${domain}.${action}`,
        description: service.description?.trim() || `Home Assistant ${domain}.${action}`,
        risk: capabilityRisk(action),
        version: 1,
        sourceService: `${domain}.${action}`,
      });
    });

    return Object.freeze({
      entityId: canonicalEntity,
      deviceId,
      domain,
      state: entity.state,
      available: entity.state !== 'unavailable' && entity.state !== 'unknown',
      friendlyName: safeAttribute<string>(attributes, 'friendly_name'),
      deviceClass: safeAttribute<string>(attributes, 'device_class'),
      unitOfMeasurement: safeAttribute<string>(attributes, 'unit_of_measurement'),
      supportedFeatures: safeAttribute<number>(attributes, 'supported_features'),
      capabilities,
      provenance: Object.freeze({
        source: 'home-assistant',
        sourceEntityId: entity.entity_id.trim(),
        sourceDeviceId: entity.device_id?.trim() || null,
        domain,
      }),
    });
  }
}
