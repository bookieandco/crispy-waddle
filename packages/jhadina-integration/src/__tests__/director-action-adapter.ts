import { createDirectorShotlistActionAdapters } from '../director-shotlist-action-adapter';
import type { GenerationAdapter } from '@jhadina/shotlist-core';
import type { Shot } from '@jhadina/shotlist-core';

export async function directorActionAdapterSmokeTest() {
  let seenPrompt = '';
  const generation: GenerationAdapter = {
    name: 'test-generator',
    async generateClip(ctx, renderedPrompt) {
      seenPrompt = renderedPrompt;
      return { shotId: ctx.shot.id, uri: 'memory://take.mp4', provider: 'test-generator', durationSec: ctx.shot.durationSec };
    },
  };

  const shot: Shot = {
    id: 'shot-1', projectId: 'project-1', sceneScriptOrder: 1, ordinal: 1,
    shotType: 'medium', durationSec: 5, action: 'Character enters the room', entityHandles: [], status: 'approved',
    director: { lens: '35mm', cameraMovement: 'slow dolly', lightingMood: 'warm', lookPreset: 'cinematic' },
  };

  const [generate, regenerate] = createDirectorShotlistActionAdapters(generation);
  const first = await generate.execute({ projectId: shot.projectId, shot, instruction: 'Keep the same pacing.' }, { requestId: 'r1', domain: 'directoros', capability: 'take.generate' });
  const second = await regenerate.execute({ projectId: shot.projectId, shot, instruction: 'Add a glance toward camera.', priorTake: { takeId: first.takeId, clipUri: first.clipUri, provider: first.provider } }, { requestId: 'r2', domain: 'directoros', capability: 'take.regenerate' });

  if (!seenPrompt.includes('glance toward camera')) throw new Error('Regeneration instruction did not reach the Director prompt.');
  if (second.continuity.priorTakeId !== first.takeId) throw new Error('Prior take continuity was not preserved.');
  return { generated: true, regenerated: true, priorTakeId: first.takeId, provider: second.provider };
}
