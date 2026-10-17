import { advanceBanterBit, type BanterBitRuntime } from './banter-bit-engine.js';
import { createSessionExpressionState, updateSessionExpressionState, type SessionExpressionState } from './session-expression.js';

export type PersonalitySessionEvent =
  | { kind: 'build-bit'; eventId: string; turn: number; bitId: string; phrase: string; humor: number }
  | { kind: 'stop'; eventId: string }
  | { kind: 'topic-change'; eventId: string }
  | { kind: 'callback-used'; eventId: string; callback: string }
  | { kind: 'callback-revoked'; eventId: string; callback: string };

export interface OwnedPersonalitySession {
  readonly ownerUserId: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly expiresAt: string;
  readonly consumedEventIds: readonly string[];
  readonly expression: SessionExpressionState;
  readonly banter?: BanterBitRuntime;
  readonly stopped: boolean;
  readonly callbackUsage: readonly { callback: string; count: number; lastUsedAt: string }[];
  readonly revokedCallbacks: readonly string[];
}

export type SessionTransitionResult =
  | { readonly status: 'accepted'; readonly state: OwnedPersonalitySession }
  | { readonly status: 'blocked'; readonly reason: 'scope' | 'expired' | 'revision' | 'replay' | 'invalid'; readonly state: OwnedPersonalitySession };

const TTL_MS = 30 * 60 * 1000;
const MAX_REPLAY_IDS = 64;
const MAX_CALLBACKS = 16;
const MAX_CALLBACK_USES = 2;
const normalize = (value: string) => value.trim().toLowerCase();

export function createOwnedPersonalitySession(
  ownerUserId: string, sessionId: string, now: string,
): OwnedPersonalitySession {
  if (!ownerUserId.trim() || !sessionId.trim() || !Number.isFinite(Date.parse(now))) {
    throw new Error('owner, session and time required');
  }
  return {
    ownerUserId, sessionId, revision: 0,
    expiresAt: new Date(Date.parse(now) + TTL_MS).toISOString(),
    consumedEventIds: [],
    expression: createSessionExpressionState(),
    stopped: false, callbackUsage: [], revokedCallbacks: [],
  };
}

/**
 * Pure, fail-closed ephemeral reducer. The caller MUST authenticate owner and
 * session before passing scope; this function is not authentication or storage.
 * Persist via an authenticated TTL store with expectedRevision CAS; never
 * promote these snapshots into durable Personality or approved Memory.
 */
export function advanceOwnedPersonalitySession(
  state: OwnedPersonalitySession,
  scope: { verifiedOwnerUserId: string; verifiedSessionId: string; expectedRevision: number; now: string },
  event: PersonalitySessionEvent,
): SessionTransitionResult {
  const reject = (reason: 'scope' | 'expired' | 'revision' | 'replay' | 'invalid'): SessionTransitionResult =>
    ({ status: 'blocked', reason, state });
  if (!scope.verifiedOwnerUserId || scope.verifiedOwnerUserId !== state.ownerUserId ||
      !scope.verifiedSessionId || scope.verifiedSessionId !== state.sessionId) return reject('scope');
  const nowMs = Date.parse(scope.now);
  if (!Number.isFinite(nowMs) || !Number.isFinite(Date.parse(state.expiresAt)) ||
      nowMs >= Date.parse(state.expiresAt)) return reject('expired');
  if (scope.expectedRevision !== state.revision) return reject('revision');
  if (!event.eventId.trim() || event.eventId.length > 128) return reject('invalid');
  if (state.consumedEventIds.includes(event.eventId)) return reject('replay');

  let expression = state.expression;
  let banter = state.banter;
  let stopped = state.stopped;
  let callbackUsage = [...state.callbackUsage];
  let revokedCallbacks = [...state.revokedCallbacks];

  if (event.kind === 'stop' || event.kind === 'topic-change') {
    stopped = event.kind === 'stop';
    expression = updateSessionExpressionState(createSessionExpressionState(), {
      discomfortDetected: stopped,
      userBuildingBit: false,
      conversationTemperature: stopped ? 0 : 0.5,
    });
    banter = undefined;
  } else if (event.kind === 'build-bit') {
    if (stopped) return reject('invalid');
    if (!event.bitId.trim() || !event.phrase.trim() ||
        !Number.isSafeInteger(event.turn) || event.turn < 1 ||
        !Number.isFinite(event.humor) || event.humor < 0 || event.humor > 1) return reject('invalid');
    expression = updateSessionExpressionState(expression, { userBuildingBit: true, role: 'play' });
    const transition = advanceBanterBit(expression, banter, {
      bitId: event.bitId, phrase: event.phrase.slice(0, 100),
      turn: event.turn, origin: 'shared', humor: event.humor, strategyCap: 3,
    });
    expression = transition.session;
    banter = transition.runtime;
    if (transition.shouldReturnToTask) {
      expression = updateSessionExpressionState(expression, { userBuildingBit: false, role: 'balanced' });
    }
  } else {
    const callback = normalize(event.callback);
    if (!callback || callback.length > 120) return reject('invalid');
    if (event.kind === 'callback-revoked') {
      revokedCallbacks = [...new Set([...revokedCallbacks, callback])].slice(-MAX_CALLBACKS);
      callbackUsage = callbackUsage.filter(item => item.callback !== callback);
    } else {
      if (stopped || revokedCallbacks.includes(callback)) return reject('invalid');
      const used = callbackUsage.find(item => item.callback === callback);
      if (used && used.count >= MAX_CALLBACK_USES) return reject('invalid');
      callbackUsage = [...callbackUsage.filter(item => item.callback !== callback), {
        callback, count: (used?.count ?? 0) + 1, lastUsedAt: scope.now,
      }].slice(-MAX_CALLBACKS);
    }
  }
  return {
    status: 'accepted',
    state: {
      ...state,
      revision: state.revision + 1,
      expiresAt: new Date(nowMs + TTL_MS).toISOString(),
      consumedEventIds: [...state.consumedEventIds, event.eventId].slice(-MAX_REPLAY_IDS),
      expression, ...(banter ? { banter } : { banter: undefined }), stopped,
      callbackUsage, revokedCallbacks,
    },
  };
}

export function eligibleSessionCallback(
  state: OwnedPersonalitySession, callback: string, now: string,
): boolean {
  if (state.stopped || Date.parse(now) >= Date.parse(state.expiresAt)) return false;
  const key = normalize(callback);
  if (!key || state.revokedCallbacks.includes(key)) return false;
  const usage = state.callbackUsage.find(item => item.callback === key);
  return !usage || usage.count < MAX_CALLBACK_USES;
}
