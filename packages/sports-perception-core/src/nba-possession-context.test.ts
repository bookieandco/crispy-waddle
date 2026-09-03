import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NBAActivePlayer, NBALineupState } from './nba-lineup-state.js';
import { resolveNBAPossessionContext } from './nba-possession-context.js';

const player = (id: string, teamId: string, overrides: Partial<NBAActivePlayer> = {}): NBAActivePlayer => ({
  playerId: id,
  teamId,
  minutesPlayed: 20,
  personalFouls: 0,
  fatigue: 20,
  eligible: true,
  ...overrides,
});

const lineup = (teamId: string, overrides: Partial<NBAActivePlayer> = {}): NBALineupState => ({
  teamId,
  onCourt: Array.from({ length: 5 }, (_, i) => player(`${teamId}-${i}`, teamId, i === 0 ? overrides : {})),
  bench: [],
  substitutions: 0,
});

describe('resolveNBAPossessionContext', () => {
  it('requires the handler and defender to be on court', () => {
    assert.throws(() => resolveNBAPossessionContext({
      offense: lineup('A'),
      defense: lineup('B'),
      ballHandlerId: 'A-bench',
      primaryDefenderId: 'B-0',
    }));
  });

  it('raises turnover pressure as offensive fatigue increases', () => {
    const fresh = resolveNBAPossessionContext({
      offense: lineup('A', { fatigue: 10 }),
      defense: lineup('B'),
      ballHandlerId: 'A-0',
      primaryDefenderId: 'B-0',
    });
    const tired = resolveNBAPossessionContext({
      offense: lineup('A', { fatigue: 90 }),
      defense: lineup('B'),
      ballHandlerId: 'A-0',
      primaryDefenderId: 'B-0',
    });
    assert.ok(tired.turnoverFactor > fresh.turnoverFactor);
    assert.ok(tired.offensiveLineupFactor < fresh.offensiveLineupFactor);
  });
});
