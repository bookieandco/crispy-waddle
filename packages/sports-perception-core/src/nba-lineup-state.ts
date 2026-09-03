export interface NBAActivePlayer {
  playerId: string;
  teamId: string;
  targetMinutes?: number;
  minutesPlayed: number;
  personalFouls: number;
  fatigue: number;
  eligible: boolean;
}

export interface NBALineupState {
  teamId: string;
  onCourt: readonly NBAActivePlayer[];
  bench: readonly NBAActivePlayer[];
  substitutions: number;
}

export interface NBARotationPolicy {
  maxPersonalFouls: number;
  fatigueThreshold: number;
  minimumOnCourt: number;
}

export interface NBARotationDecision {
  playerOut?: string;
  playerIn?: string;
  reason: 'NONE' | 'FOUL_TROUBLE' | 'FATIGUE' | 'INELIGIBLE' | 'MINUTES_MANAGEMENT';
}

const DEFAULT_POLICY: NBARotationPolicy = {
  maxPersonalFouls: 6,
  fatigueThreshold: 85,
  minimumOnCourt: 5,
};

export function validateNBALineup(lineup: NBALineupState): void {
  if (!lineup.teamId.trim()) throw new Error('NBA lineup team ID is required');
  if (lineup.onCourt.length !== 5) throw new Error('NBA lineup must contain exactly five on-court players');
  const ids = lineup.onCourt.map((player) => player.playerId);
  if (new Set(ids).size !== ids.length) throw new Error('NBA lineup cannot contain duplicate on-court players');
  for (const player of lineup.onCourt) {
    if (!player.eligible) throw new Error(`Ineligible player on court: ${player.playerId}`);
    if (player.personalFouls >= 6) throw new Error(`Fouled-out player on court: ${player.playerId}`);
  }
}

export function chooseNBARotation(
  lineup: NBALineupState,
  policy: NBARotationPolicy = DEFAULT_POLICY,
): NBARotationDecision {
  validateNBALineup(lineup);

  const foulTrouble = lineup.onCourt.find((player) => player.personalFouls >= policy.maxPersonalFouls - 1);
  if (foulTrouble) {
    const replacement = lineup.bench
      .filter((player) => player.eligible && player.personalFouls < policy.maxPersonalFouls)
      .sort((a, b) => (b.targetMinutes ?? 0) - (a.targetMinutes ?? 0))[0];
    if (replacement) return { playerOut: foulTrouble.playerId, playerIn: replacement.playerId, reason: 'FOUL_TROUBLE' };
  }

  const fatigued = lineup.onCourt
    .filter((player) => player.fatigue >= policy.fatigueThreshold)
    .sort((a, b) => b.fatigue - a.fatigue)[0];
  if (fatigued) {
    const replacement = lineup.bench
      .filter((player) => player.eligible && player.personalFouls < policy.maxPersonalFouls)
      .sort((a, b) => (b.targetMinutes ?? 0) - (a.targetMinutes ?? 0))[0];
    if (replacement) return { playerOut: fatigued.playerId, playerIn: replacement.playerId, reason: 'FATIGUE' };
  }

  const ineligible = lineup.onCourt.find((player) => !player.eligible || player.personalFouls >= policy.maxPersonalFouls);
  if (ineligible) {
    const replacement = lineup.bench.find((player) => player.eligible && player.personalFouls < policy.maxPersonalFouls);
    if (replacement) return { playerOut: ineligible.playerId, playerIn: replacement.playerId, reason: 'INELIGIBLE' };
  }

  return { reason: 'NONE' };
}

export function applyNBASubstitution(
  lineup: NBALineupState,
  decision: NBARotationDecision,
): NBALineupState {
  if (!decision.playerOut || !decision.playerIn) return lineup;
  const outgoing = lineup.onCourt.find((player) => player.playerId === decision.playerOut);
  const incoming = lineup.bench.find((player) => player.playerId === decision.playerIn);
  if (!outgoing || !incoming) throw new Error('NBA substitution references players not present in lineup');

  const onCourt = lineup.onCourt.map((player) => player.playerId === outgoing.playerId ? incoming : player);
  const bench = lineup.bench.map((player) => player.playerId === incoming.playerId ? outgoing : player);
  const next = { ...lineup, onCourt, bench, substitutions: lineup.substitutions + 1 };
  validateNBALineup(next);
  return Object.freeze(next);
}
