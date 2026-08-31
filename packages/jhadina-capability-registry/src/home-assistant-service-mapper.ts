import type { JhadinaEntityCapability } from './home-assistant-adapter.js';

export interface HomeAssistantActionRequest {
  readonly capability: string;
  readonly deviceId: string;
  readonly entityId: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface HomeAssistantServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly target: { readonly entity_id: string };
  readonly data: Readonly<Record<string, unknown>>;
}

export interface HomeAssistantServiceMapper {
  map(
    request: HomeAssistantActionRequest,
    capabilities: readonly JhadinaEntityCapability[],
  ): HomeAssistantServiceCall;
}

const SAFE_DATA_KEYS = new Set(['brightness', 'brightness_pct', 'color_temp', 'temperature', 'hvac_mode', 'volume_level', 'media_content_id', 'media_content_type']);

function parseCapability(capability: string): { domain: string; service: string } {
  const match = /^homeassistant\.([a-z0-9_]+)\.([a-z0-9_]+)$/.exec(capability.trim().toLowerCase());
  if (!match) throw new Error('invalid-home-assistant-capability');
  return { domain: match[1], service: match[2] };
}

export class DeterministicHomeAssistantServiceMapper implements HomeAssistantServiceMapper {
  map(
    request: HomeAssistantActionRequest,
    capabilities: readonly JhadinaEntityCapability[],
  ): HomeAssistantServiceCall {
    const { domain, service } = parseCapability(request.capability);
    const capability = capabilities.find(item => item.name === `homeassistant.${domain}.${service}`);
    if (!capability || capability.sourceService !== `${domain}.${service}`) {
      throw new Error('capability-not-supported-by-entity');
    }
    if (!/^ha:entity:[a-z0-9_]+\.[a-z0-9_]+$/.test(request.entityId)) {
      throw new Error('invalid-canonical-home-entity');
    }
    if (!/^ha:device:[^\s:]+$/.test(request.deviceId)) {
      throw new Error('invalid-canonical-home-device');
    }

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(request.data ?? {})) {
      if (!SAFE_DATA_KEYS.has(key)) throw new Error(`unsupported-service-data:${key}`);
      data[key] = value;
    }

    return Object.freeze({
      domain,
      service,
      target: Object.freeze({ entity_id: request.entityId.slice('ha:entity:'.length) }),
      data: Object.freeze(data),
    });
  }
}
