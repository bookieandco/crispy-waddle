import type { Sport } from './contracts.js';
import type { PlayerSimulationProfile } from './player-simulation.js';

export interface PlayerMatchupRule { readonly sport: Sport; readonly attackerAttribute: string; readonly defenderAttribute: string; readonly weight: number; readonly label: string; }
export interface ResolvedPlayerMatchupRule extends PlayerMatchupRule { readonly attackerValue: number; readonly defenderValue: number; readonly adjustment: number; }

const RULES: Record<Sport, readonly PlayerMatchupRule[]> = {
  NBA: [
    { sport: 'NBA', attackerAttribute: 'shot_creation', defenderAttribute: 'perimeter_defense', weight: .35, label: 'Shot creation vs perimeter defense' },
    { sport: 'NBA', attackerAttribute: 'finishing', defenderAttribute: 'interior_defense', weight: .35, label: 'Finishing vs interior defense' },
    { sport: 'NBA', attackerAttribute: 'rebounding', defenderAttribute: 'strength', weight: .20, label: 'Rebounding vs strength' },
    { sport: 'NBA', attackerAttribute: 'ball_security', defenderAttribute: 'steal', weight: .10, label: 'Ball security vs steal pressure' },
  ],
  NFL: [
    { sport: 'NFL', attackerAttribute: 'separation', defenderAttribute: 'coverage', weight: .35, label: 'Receiver separation vs coverage' },
    { sport: 'NFL', attackerAttribute: 'catching', defenderAttribute: 'coverage', weight: .15, label: 'Catching vs coverage' },
    { sport: 'NFL', attackerAttribute: 'throw_accuracy', defenderAttribute: 'pass_rush', weight: .25, label: 'Throw accuracy vs pass rush' },
    { sport: 'NFL', attackerAttribute: 'explosiveness', defenderAttribute: 'tackling', weight: .25, label: 'Explosiveness vs tackling' },
  ],
  MLB: [
    { sport: 'MLB', attackerAttribute: 'contact', defenderAttribute: 'pitch_control', weight: .20, label: 'Contact vs pitch control' },
    { sport: 'MLB', attackerAttribute: 'power', defenderAttribute: 'pitch_velocity', weight: .20, label: 'Power vs pitch velocity' },
    { sport: 'MLB', attackerAttribute: 'pitch_recognition', defenderAttribute: 'pitch_movement', weight: .30, label: 'Pitch recognition vs movement' },
    { sport: 'MLB', attackerAttribute: 'plate_discipline', defenderAttribute: 'pitch_command', weight: .30, label: 'Plate discipline vs command' },
  ],
  NHL: [
    { sport: 'NHL', attackerAttribute: 'shooting', defenderAttribute: 'goaltending', weight: .30, label: 'Shooting vs goaltending' },
    { sport: 'NHL', attackerAttribute: 'finishing', defenderAttribute: 'rebound_control', weight: .20, label: 'Finishing vs rebound control' },
    { sport: 'NHL', attackerAttribute: 'puck_control', defenderAttribute: 'checking', weight: .25, label: 'Puck control vs checking' },
    { sport: 'NHL', attackerAttribute: 'deking', defenderAttribute: 'defensive_positioning', weight: .25, label: 'Deking vs defensive positioning' },
  ],
  SOCCER: [
    { sport: 'SOCCER', attackerAttribute: 'dribbling', defenderAttribute: 'tackling', weight: .25, label: 'Dribbling vs tackling' },
    { sport: 'SOCCER', attackerAttribute: 'finishing', defenderAttribute: 'positioning', weight: .30, label: 'Finishing vs defensive positioning' },
    { sport: 'SOCCER', attackerAttribute: 'chance_creation', defenderAttribute: 'interceptions', weight: .20, label: 'Chance creation vs interceptions' },
    { sport: 'SOCCER', attackerAttribute: 'pace', defenderAttribute: 'positioning', weight: .25, label: 'Pace vs positioning' },
  ],
  TENNIS: [
    { sport: 'TENNIS', attackerAttribute: 'serve_power', defenderAttribute: 'return', weight: .30, label: 'Serve power vs return' },
    { sport: 'TENNIS', attackerAttribute: 'serve_accuracy', defenderAttribute: 'return', weight: .20, label: 'Serve accuracy vs return' },
    { sport: 'TENNIS', attackerAttribute: 'forehand', defenderAttribute: 'defense', weight: .25, label: 'Forehand vs defense' },
    { sport: 'TENNIS', attackerAttribute: 'backhand', defenderAttribute: 'defense', weight: .25, label: 'Backhand vs defense' },
  ],
  OTHER: [],
};

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function playerMatchupRules(sport: Sport): readonly PlayerMatchupRule[] {
  return Object.freeze(RULES[sport].map((rule) => Object.freeze({ ...rule })));
}

export function resolveSportMatchup(attacker: PlayerSimulationProfile, defender: PlayerSimulationProfile): readonly ResolvedPlayerMatchupRule[] {
  if (attacker.sport !== defender.sport) throw new Error('Player matchup requires the same sport');
  return Object.freeze(playerMatchupRules(attacker.sport).map((rule) => {
    const attackerValue = clamp(attacker.sliders[rule.attackerAttribute] ?? 50);
    const defenderValue = clamp(defender.sliders[rule.defenderAttribute] ?? 50);
    return Object.freeze({ ...rule, attackerValue, defenderValue, adjustment: (attackerValue - defenderValue) * 0.25 * rule.weight });
  }));
}

export function aggregateMatchupAdjustment(rules: readonly ResolvedPlayerMatchupRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.adjustment, 0);
}
