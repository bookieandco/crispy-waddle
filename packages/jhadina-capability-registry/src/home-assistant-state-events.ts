export type HomeAssistantStateValue = string | number | boolean | null;

export interface HomeAssistantStateChangedInput {
  readonly entity_id: string;
  readonly old_state?: HomeAssistantStateValue;
  readonly new_state: HomeAssistantStateValue;
  readonly occurred_at?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface CanonicalHomeStateEvent {
  readonly id: string;
  readonly type: 'home.entity.state_changed';
  readonly occurredAt: string;
  readonly entityId: string;
  readonly deviceId: string;
  readonly state: HomeAssistantStateValue;
  readonly previousState: HomeAssistantStateValue;
  readonly changed: boolean;
  readonly provenance: {
    readonly source: 'home-assistant';
    readonly sourceEntityId: string;
  };
}

function canonicalEntityId(entityId: string): string {
  const normalized = entityId.trim().toLowerCase();
  if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(normalized)) {
    throw new Error('invalid-home-assistant-entity-id');
  }
  return `ha:entity:${normalized}`;
}

function canonicalDeviceId(entityId: string): string {
  return `ha:device:${entityId}`;
}

function safeOccurredAt(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('invalid-home-assistant-event-time');
  return parsed.toISOString();
}

export function normalizeHomeAssistantStateChanged(
  input: HomeAssistantStateChangedInput,
): CanonicalHomeStateEvent {
  const sourceEntityId = input.entity_id.trim().toLowerCase();
  const entityId = canonicalEntityId(sourceEntityId);
  const deviceId = canonicalDeviceId(sourceEntityId);
  const previousState = input.old_state ?? null;
  const changed = previousState !== input.new_state;

  return Object.freeze({
    id: `ha-state:${sourceEntityId}:${safeOccurredAt(input.occurred_at)}`,
    type: 'home.entity.state_changed',
    occurredAt: safeOccurredAt(input.occurred_at),
    entityId,
    deviceId,
    state: input.new_state,
    previousState,
    changed,
    provenance: Object.freeze({
      source: 'home-assistant',
      sourceEntityId,
    }),
  });
}
