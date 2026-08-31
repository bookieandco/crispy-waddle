import type { DataBoundary, UserInteractionEvent } from './data-boundary';

export interface PersonalLearningSignal {
  readonly signalId: string;
  readonly userId: string;
  readonly appId: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly signal: unknown;
}

export interface PersonalLearningSink {
  ingest(signal: PersonalLearningSignal): void | Promise<void>;
}

export function toPersonalLearningSignal(
  event: UserInteractionEvent,
  boundary: DataBoundary,
): PersonalLearningSignal | null {
  if (!boundary.learning.observeUserInteractions) return null;
  if (!boundary.learning.contributeToPersonalPatterns && !boundary.learning.createMemoryCandidates) return null;

  return {
    signalId: event.eventId,
    userId: event.userId,
    appId: event.appId,
    type: event.type,
    occurredAt: event.occurredAt,
    signal: event.signal,
  };
}

export async function learnFromInteraction(
  event: UserInteractionEvent,
  boundary: DataBoundary,
  sink: PersonalLearningSink,
): Promise<boolean> {
  const signal = toPersonalLearningSignal(event, boundary);
  if (!signal) return false;

  // Deliberately pass only the interaction signal. App/customer data is never
  // implicitly forwarded through this path.
  await sink.ingest(signal);
  return true;
}
