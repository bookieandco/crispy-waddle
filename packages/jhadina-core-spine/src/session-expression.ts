export type SessionBitOrigin = 'user' | 'jhadina' | 'shared';
export type SessionBitRole = 'play' | 'straight' | 'balanced';

export interface SessionBit {
  id: string;
  phrase: string;
  origin: SessionBitOrigin;
  createdAtTurn: number;
  lastUsedTurn: number;
  uses: number;
  strength: number;
  durable: false;
}

export interface SessionExpressionState {
  bits: readonly SessionBit[];
  activeStoryAnchor?: string;
  activeTangents: readonly string[];
  conversationTemperature: number;
  userBuildingBit: boolean;
  discomfortDetected: boolean;
  role: SessionBitRole;
}

export function createSessionExpressionState(): SessionExpressionState {
  return Object.freeze({
    bits: Object.freeze([]),
    activeTangents: Object.freeze([]),
    conversationTemperature: 0.5,
    userBuildingBit: false,
    discomfortDetected: false,
    role: 'balanced',
  });
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('session expression values must be finite');
  return Math.max(0, Math.min(1, value));
}

export function rememberSessionBit(
  state: SessionExpressionState,
  input: Omit<SessionBit, 'uses' | 'strength' | 'lastUsedTurn' | 'durable'> & {
    strength?: number;
  },
): SessionExpressionState {
  const phrase = input.phrase.trim();
  if (!phrase) return state;
  const next: SessionBit = Object.freeze({
    id: input.id,
    phrase,
    origin: input.origin,
    createdAtTurn: input.createdAtTurn,
    lastUsedTurn: input.createdAtTurn,
    uses: 0,
    strength: clamp(input.strength ?? 0.5),
    durable: false,
  });
  return Object.freeze({
    ...state,
    bits: Object.freeze([...state.bits.filter((bit) => bit.id !== next.id), next]),
  });
}

export function markSessionBitUsed(
  state: SessionExpressionState,
  bitId: string,
  turn: number,
): SessionExpressionState {
  const bits = state.bits.map((bit) => bit.id === bitId
    ? Object.freeze({
        ...bit,
        lastUsedTurn: turn,
        uses: bit.uses + 1,
        strength: clamp(bit.strength + 0.1),
        durable: false as const,
      })
    : bit);
  return Object.freeze({ ...state, bits: Object.freeze(bits) });
}

export function updateSessionExpressionState(
  state: SessionExpressionState,
  update: Partial<Pick<
    SessionExpressionState,
    'activeStoryAnchor' | 'conversationTemperature' | 'userBuildingBit' | 'discomfortDetected' | 'role'
  >> & { activeTangents?: readonly string[] },
): SessionExpressionState {
  const next = {
    ...state,
    ...update,
    ...(update.conversationTemperature !== undefined
      ? { conversationTemperature: clamp(update.conversationTemperature) }
      : {}),
    ...(update.activeTangents
      ? { activeTangents: Object.freeze([...update.activeTangents]) }
      : {}),
  };
  return Object.freeze(next);
}

/**
 * Session bits are strictly ephemeral. This helper selects only how deep the
 * current bit may run; it never promotes a phrase into durable Memory.
 */
export function sessionBitDepth(
  state: SessionExpressionState | undefined,
  strategyCap: 0 | 1 | 2 | 3,
  humor: number,
): 0 | 1 | 2 | 3 {
  if (strategyCap === 0 || humor < 0.25) return 0;
  if (!state) return Math.min(strategyCap, 1) as 0 | 1 | 2 | 3;
  if (state.discomfortDetected) return 0;
  const desired = state.userBuildingBit
    ? Math.min(strategyCap, humor >= 0.75 ? 3 : 2)
    : Math.min(strategyCap, 1);
  return desired as 0 | 1 | 2 | 3;
}
