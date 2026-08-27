import { describe, expect, it } from 'vitest';
import { getDirectorExperienceMetadata } from './experience-director.js';

describe('getDirectorExperienceMetadata', () => {
  it('accepts a valid DirectorOS experience with project scope metadata', () => {
    expect(getDirectorExperienceMetadata({ domain: 'directoros', metadata: { projectId: 'project-a', shotId: 'shot-1', takeId: 'take-1', reaction: 'love' } } as any))
      .toMatchObject({ projectId: 'project-a', shotId: 'shot-1', takeId: 'take-1', reaction: 'love' });
  });

  it('rejects DirectorOS events without a projectId', () => {
    expect(getDirectorExperienceMetadata({ domain: 'directoros', metadata: {} } as any)).toBeNull();
  });

  it('ignores non-DirectorOS experiences', () => {
    expect(getDirectorExperienceMetadata({ domain: 'music', metadata: { projectId: 'project-a' } } as any)).toBeNull();
  });
});
