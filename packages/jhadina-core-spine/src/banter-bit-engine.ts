import {
  markSessionBitUsed,
  rememberSessionBit,
  sessionBitDepth,
  type SessionBitOrigin,
  type SessionExpressionState,
} from './session-expression.js';

export type BanterBitStage = 'notice' | 'twist' | 'escalate' | 'peak' | 'callback' | 'exit';

export interface BanterBitRuntime {
  bitId: string;
  stage: BanterBitStage;
  depth: 0 | 1 | 2 | 3;
  startedAtTurn: number;
  lastAdvancedTurn: number;
  advances: number;
  exited: boolean;
}

export interface BanterBitInput {
  turn: number;
  bitId: string;
  phrase: string;
  origin: SessionBitOrigin;
  humor: number;
  strategyCap: 0 | 1 | 2 | 3;
  callbackAvailable?: boolean;
}

export interface BanterBitTransition {
  session: SessionExpressionState;
  runtime: BanterBitRuntime;
  shouldReturnToTask: boolean;
}

function nextStage(
  current: BanterBitStage,
  depth: 0 | 1 | 2 | 3,
  userBuildingBit: boolean,
  callbackAvailable: boolean,
): BanterBitStage {
  if (depth === 0 || current === 'exit') return 'exit';
  if (current === 'notice') return depth >= 1 ? 'twist' : 'exit';
  if (current === 'twist') {
    if (!userBuildingBit || depth < 2) return callbackAvailable ? 'callback' : 'exit';
    return 'escalate';
  }
  if (current === 'escalate') {
    if (!userBuildingBit || depth < 3) return callbackAvailable ? 'callback' : 'exit';
    return 'peak';
  }
  if (current === 'peak') return callbackAvailable ? 'callback' : 'exit';
  if (current === 'callback') return 'exit';
  return 'exit';
}

/**
 * Stateful but ephemeral banter progression. It never promotes a bit into
 * durable Memory or Relationship state.
 */
export function advanceBanterBit(
  session: SessionExpressionState,
  runtime: BanterBitRuntime | undefined,
  input: BanterBitInput,
): BanterBitTransition {
  const depth = sessionBitDepth(session, input.strategyCap, input.humor);

  if (session.discomfortDetected || depth === 0) {
    return {
      session,
      runtime: Object.freeze({
        bitId: input.bitId,
        stage: 'exit',
        depth: 0,
        startedAtTurn: runtime?.startedAtTurn ?? input.turn,
        lastAdvancedTurn: input.turn,
        advances: runtime?.advances ?? 0,
        exited: true,
      }),
      shouldReturnToTask: true,
    };
  }

  let nextSession = session;
  if (!session.bits.some((bit) => bit.id === input.bitId)) {
    nextSession = rememberSessionBit(session, {
      id: input.bitId,
      phrase: input.phrase,
      origin: input.origin,
      createdAtTurn: input.turn,
    });
  }

  if (!runtime || runtime.exited || runtime.bitId !== input.bitId) {
    return {
      session: nextSession,
      runtime: Object.freeze({
        bitId: input.bitId,
        stage: 'notice',
        depth,
        startedAtTurn: input.turn,
        lastAdvancedTurn: input.turn,
        advances: 0,
        exited: false,
      }),
      shouldReturnToTask: false,
    };
  }

  const stage = nextStage(
    runtime.stage,
    depth,
    nextSession.userBuildingBit,
    input.callbackAvailable === true,
  );

  if (stage !== 'exit') {
    nextSession = markSessionBitUsed(nextSession, input.bitId, input.turn);
  }

  return {
    session: nextSession,
    runtime: Object.freeze({
      ...runtime,
      stage,
      depth,
      lastAdvancedTurn: input.turn,
      advances: runtime.advances + 1,
      exited: stage === 'exit',
    }),
    shouldReturnToTask: stage === 'exit',
  };
}
