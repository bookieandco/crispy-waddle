import type { NBALivePlayerState } from './nba-live-state.js';
import type { NBAEventGameState } from './nba-event-state-machine.js';
import { applyNBASubstitution, chooseNBARotation, type NBARotationDecision, type NBARotationPolicy, type NBALineupState } from './nba-lineup-state.js';

export interface NBARotationFeedbackResult {
  offenseLineup?: NBALineupState;
  defenseLineup?: NBALineupState;
  players: Readonly<Record<string, NBALivePlayerState>>;
  decisions: readonly NBARotationDecision[];
}

const DEFAULT_POLICY: NBARotationPolicy = Object.freeze({
  maxPersonalFouls: 6,
  fatigueThreshold: 85,
  minimumOnCourt: 5,
});

function syncLineupWithLiveState(
  lineup: NBALineupState,
  players: Readonly<Record<string, NBALivePlayerState>>,
): NBALineupState {
  const sync = (player: NBALineupState['onCourt'][number]) => {
    const live = players[player.playerId];
    return live
      ? Object.freeze({
          ...player,
          fatigue: live.fatigue.fatigue,
          minutesPlayed: live.fatigue.minutesPlayed,
          personalFouls: player.personalFouls,
          eligible: player.eligible && live.fatigue.playerId === player.playerId,
        })
      : player;
  };
  return Object.freeze({
    ...lineup,
    onCourt: Object.freeze(lineup.onCourt.map(sync)),
    bench: Object.freeze(lineup.bench.map(sync)),
  });
}

function applyDecisionToLivePlayers(
  players: Readonly<Record<string, NBALivePlayerState>>,
  decision: NBARotationDecision,
): Readonly<Record<string, NBALivePlayerState>> {
  if (!decision.playerOut || !decision.playerIn) return players;
  const outgoing = players[decision.playerOut];
  const incoming = players[decision.playerIn];
  if (!outgoing || !incoming) return players;
  return Object.freeze({
    ...players,
    [decision.playerOut]: Object.freeze({ ...outgoing, confidence: outgoing.confidence }),
    [decision.playerIn]: Object.freeze({ ...incoming }),
  });
}

export function resolveNBARotationFeedback(
  gameState: NBAEventGameState,
  players: Readonly<Record<string, NBALivePlayerState>>,
  policy: NBARotationPolicy = DEFAULT_POLICY,
): NBARotationFeedbackResult {
  let livePlayers = players;
  let offenseLineup = gameState.offenseLineup ? syncLineupWithLiveState(gameState.offenseLineup, livePlayers) : undefined;
  let defenseLineup = gameState.defenseLineup ? syncLineupWithLiveState(gameState.defenseLineup, livePlayers) : undefined;
  const decisions: NBARotationDecision[] = [];

  if (offenseLineup) {
    const decision = chooseNBARotation(offenseLineup, policy);
    if (decision.playerOut && decision.playerIn) {
      offenseLineup = applyNBASubstitution(offenseLineup, decision);
      livePlayers = applyDecisionToLivePlayers(livePlayers, decision);
      decisions.push(decision);
    }
  }

  if (defenseLineup) {
    const decision = chooseNBARotation(defenseLineup, policy);
    if (decision.playerOut && decision.playerIn) {
      defenseLineup = applyNBASubstitution(defenseLineup, decision);
      livePlayers = applyDecisionToLivePlayers(livePlayers, decision);
      decisions.push(decision);
    }
  }

  return Object.freeze({
    offenseLineup,
    defenseLineup,
    players: livePlayers,
    decisions: Object.freeze(decisions),
  });
}
