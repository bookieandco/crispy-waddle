import type { PatternPort } from './spine.js';
import { CompositePatternDetectionStrategy } from './composite-pattern-strategy.js';
import { DeterministicPatternPort, RecurrencePatternStrategy } from './pattern-engine.js';
import { RelationshipContextPatternStrategy } from './relationship-context-pattern.js';
import { CommunicationDirectnessPatternStrategy } from './communication-directness-pattern.js';
import { CommunicationConcisionPatternStrategy } from './communication-concision-pattern.js';

/**
 * Canonical Strategy composition for the current PatternPort.
 * Additional detectors can be injected without changing PatternPort callers.
 */
export function createCanonicalPatternPort(): PatternPort {
  const strategy = new CompositePatternDetectionStrategy([
    new RecurrencePatternStrategy(),
    new RelationshipContextPatternStrategy(),
    new CommunicationDirectnessPatternStrategy(),
    new CommunicationConcisionPatternStrategy(),
  ]);
  return new DeterministicPatternPort(strategy);
}
