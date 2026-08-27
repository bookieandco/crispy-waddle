import type { ExperienceEvent, ExperienceScope } from './experience.js';

export interface ExperienceStore {
  append(event: ExperienceEvent): Promise<{ accepted: boolean; duplicate: boolean; conflict: boolean; eventId: string }>;
  listByScope(scope: ExperienceScope): Promise<ExperienceEvent[]>;
}

export function assertExperienceScopeMatch(event: ExperienceEvent, scope: ExperienceScope): void {
  if (event.scope.type !== scope.type || event.scope.ownerId !== scope.ownerId) {
    throw new Error('Experience scope mismatch');
  }
}
