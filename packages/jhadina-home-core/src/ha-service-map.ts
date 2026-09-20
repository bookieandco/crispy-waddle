/**
 * Deterministic Home Assistant domain → service/action mapping.
 *
 * B&W-6.1 FINDING 2 — replaces the ad-hoc `remote.power → homeassistant.toggle`
 * pattern.  Every Jhadina capability for a Home Assistant entity resolves to
 * a concrete HA service call through this table rather than through ad-hoc
 * branching.  New domains extend the table; they do not add new branches to
 * caller code.
 *
 * Architecture contract:
 * - Each HA domain has a set of named Jhadina actions.
 * - Each action maps to a canonical { domain, service } pair that is passed
 *   to the HA REST API `POST /api/services/<domain>/<service>`.
 * - Actions that require entity-state context (e.g. toggle vs turn_on) are
 *   represented as separate named actions so callers are explicit.
 * - No action is "guessed" from an abstract power concept; execution is
 *   always deterministic given a (haEntityDomain, jhadinaAction) pair.
 */

export interface HaServiceCall {
  /** Home Assistant domain for the service call */
  readonly domain: string;
  /** Home Assistant service name */
  readonly service: string;
  /**
   * Additional service data fields merged with entity_id at call time.
   * Values are safe defaults; callers may override at the action-execution
   * boundary but must pass through the policy gate first.
   */
  readonly serviceData?: Readonly<Record<string, unknown>>;
}

/**
 * Named Jhadina actions supported for a given HA entity domain.
 *
 * The string keys are stable Jhadina action names used as capability
 * identifiers; the values are the deterministic HA service calls they map to.
 */
export type DomainActionMap = Readonly<Record<string, HaServiceCall>>;

/**
 * Full deterministic mapping from HA entity domain to supported actions.
 *
 * FINDING 2 FIX: remote.power is replaced by explicit `remote.turn_on`,
 * `remote.turn_off`, and `remote.toggle` entries that map to the exact
 * homeassistant or remote service rather than a single ad-hoc branch.
 */
export const HA_DOMAIN_ACTION_MAP: Readonly<Record<HomeAssistantDomain, DomainActionMap>> = {
  light: {
    'light.turn_on':  { domain: 'light', service: 'turn_on' },
    'light.turn_off': { domain: 'light', service: 'turn_off' },
    'light.toggle':   { domain: 'light', service: 'toggle' },
    'light.set_brightness': {
      domain: 'light',
      service: 'turn_on',
      serviceData: { brightness_pct: 100 },
    },
  },
  switch: {
    'switch.turn_on':  { domain: 'switch', service: 'turn_on' },
    'switch.turn_off': { domain: 'switch', service: 'turn_off' },
    'switch.toggle':   { domain: 'switch', service: 'toggle' },
  },
  media_player: {
    'media_player.play':         { domain: 'media_player', service: 'media_play' },
    'media_player.pause':        { domain: 'media_player', service: 'media_pause' },
    'media_player.stop':         { domain: 'media_player', service: 'media_stop' },
    'media_player.next_track':   { domain: 'media_player', service: 'media_next_track' },
    'media_player.prev_track':   { domain: 'media_player', service: 'media_previous_track' },
    'media_player.set_volume':   { domain: 'media_player', service: 'volume_set' },
    'media_player.mute':         { domain: 'media_player', service: 'volume_mute' },
    'media_player.turn_on':      { domain: 'media_player', service: 'turn_on' },
    'media_player.turn_off':     { domain: 'media_player', service: 'turn_off' },
  },
  climate: {
    'climate.set_temperature': { domain: 'climate', service: 'set_temperature' },
    'climate.set_hvac_mode':   { domain: 'climate', service: 'set_hvac_mode' },
    'climate.turn_on':         { domain: 'climate', service: 'turn_on' },
    'climate.turn_off':        { domain: 'climate', service: 'turn_off' },
  },
  lock: {
    'lock.lock':   { domain: 'lock', service: 'lock' },
    'lock.unlock': { domain: 'lock', service: 'unlock' },
  },
  cover: {
    'cover.open':       { domain: 'cover', service: 'open_cover' },
    'cover.close':      { domain: 'cover', service: 'close_cover' },
    'cover.stop':       { domain: 'cover', service: 'stop_cover' },
    'cover.set_position': { domain: 'cover', service: 'set_cover_position' },
  },
  remote: {
    /**
     * B&W-6.1 FINDING 2 FIX:
     * Old code had only `remote.power → homeassistant.toggle` (ad-hoc).
     * The three entries below are deterministic and domain-correct:
     *   - turn_on / turn_off use the remote domain service directly
     *   - toggle uses homeassistant.toggle as the HA-native stateless toggle
     * Callers must choose explicitly which action to invoke; the mapping
     * produces a deterministic HA service call in every case.
     */
    'remote.turn_on':  { domain: 'remote', service: 'turn_on' },
    'remote.turn_off': { domain: 'remote', service: 'turn_off' },
    'remote.toggle':   { domain: 'homeassistant', service: 'toggle' },
    'remote.send_command': { domain: 'remote', service: 'send_command' },
  },
  scene: {
    'scene.turn_on': { domain: 'scene', service: 'turn_on' },
  },
  script: {
    'script.turn_on':  { domain: 'script', service: 'turn_on' },
    'script.turn_off': { domain: 'script', service: 'turn_off' },
  },
  automation: {
    'automation.trigger':  { domain: 'automation', service: 'trigger' },
    'automation.turn_on':  { domain: 'automation', service: 'turn_on' },
    'automation.turn_off': { domain: 'automation', service: 'turn_off' },
  },
  sensor: {},        // sensors are read-only; no service calls
  binary_sensor: {}, // sensors are read-only; no service calls
} as const;

export type HomeAssistantDomain = keyof typeof HA_DOMAIN_ACTION_MAP;

/**
 * Resolves the deterministic HA service call for a (domain, jhadinaAction) pair.
 *
 * Returns undefined when:
 * - the domain is not in the mapping table (unsupported domain)
 * - the action is not in the domain's action map (unsupported action)
 * Callers MUST treat undefined as an explicit failure; they must not fall
 * back to ad-hoc branches or guess a service name.
 */
export function resolveHaServiceCall(
  domain: string,
  jhadinaAction: string,
): HaServiceCall | undefined {
  const domainMap = HA_DOMAIN_ACTION_MAP[domain as HomeAssistantDomain];
  if (!domainMap) return undefined;
  return domainMap[jhadinaAction];
}

/**
 * Returns all supported Jhadina action names for a given HA domain.
 * An empty array means the domain is read-only (e.g. sensor, binary_sensor).
 */
export function supportedActionsForDomain(domain: string): readonly string[] {
  const domainMap = HA_DOMAIN_ACTION_MAP[domain as HomeAssistantDomain];
  if (!domainMap) return [];
  return Object.keys(domainMap);
}
