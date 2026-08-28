import { describe, expect, it } from 'vitest';
import { applySituationalDirectorState } from './director-situational-controls.js';

describe('applySituationalDirectorState', () => {
  it('uses serious emotional weight to select restrained camera language', () => {
    const result = applySituationalDirectorState(
      {},
      { mode: 'serious', sliders: { humor: 90, seriousness: 30 }, domain: 'directoros' },
      { emotionalWeight: 90, storyIntent: 'drama' },
    );
    expect(result).toMatchObject({ cameraMovement: 'slow', framing: 'close-up' });
  });

  it('does not overwrite explicit controls', () => {
    const result = applySituationalDirectorState(
      { framing: 'wide', cameraMovement: 'dolly' },
      { mode: 'urgent', sliders: { humor: 2, seriousness: 100 }, domain: 'directoros' },
      { emotionalWeight: 100 },
    );
    expect(result).toMatchObject({ framing: 'wide', cameraMovement: 'dolly' });
  });
});
