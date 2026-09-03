import type { SportsEvent } from './sports-event.js';
import { freezeSportsEvent } from './sports-event.js';

export interface SportsEventTransition {
  event: SportsEvent;
  previousSequence: number;
}

export interface SportsEventLedgerSnapshot {
  gameId: string;
  sport: SportsEvent['sport'];
  transitions: readonly SportsEventTransition[];
  finalSequence: number;
  finalEvent?: SportsEvent;
}

export class SportsEventLedger {
  readonly gameId: string;
  readonly sport: SportsEvent['sport'];
  private readonly transitions: SportsEventTransition[] = [];

  constructor(gameId: string, sport: SportsEvent['sport']) {
    if (!gameId.trim()) throw new Error('Sports event ledger game ID is required');
    this.gameId = gameId;
    this.sport = sport;
  }

  append(event: SportsEvent): SportsEventTransition {
    const frozen = freezeSportsEvent(event);
    if (frozen.gameId !== this.gameId) throw new Error(`Sports event ${frozen.eventId} belongs to ${frozen.gameId}, expected ${this.gameId}`);
    if (frozen.sport !== this.sport) throw new Error(`Sports event ${frozen.eventId} belongs to ${frozen.sport}, expected ${this.sport}`);

    const previous = this.transitions[this.transitions.length - 1]?.event;
    const expectedSequence = previous ? previous.sequence + 1 : 1;
    if (frozen.sequence !== expectedSequence) throw new Error(`Sports event sequence must advance exactly by one; expected ${expectedSequence}, received ${frozen.sequence}`);
    if (this.transitions.some((transition) => transition.event.eventId === frozen.eventId)) throw new Error(`Duplicate sports event ID: ${frozen.eventId}`);

    const transition = Object.freeze({ event: frozen, previousSequence: previous?.sequence ?? 0 });
    this.transitions.push(transition);
    return transition;
  }

  snapshot(): SportsEventLedgerSnapshot {
    const finalEvent = this.transitions[this.transitions.length - 1]?.event;
    return Object.freeze({
      gameId: this.gameId,
      sport: this.sport,
      transitions: Object.freeze([...this.transitions]),
      finalSequence: finalEvent?.sequence ?? 0,
      ...(finalEvent ? { finalEvent } : {}),
    });
  }
}

export function replaySportsEvents(gameId: string, sport: SportsEvent['sport'], events: readonly SportsEvent[]): SportsEventLedgerSnapshot {
  const ledger = new SportsEventLedger(gameId, sport);
  for (const event of events) ledger.append(event);
  return ledger.snapshot();
}
