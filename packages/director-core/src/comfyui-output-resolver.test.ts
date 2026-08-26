import { describe, expect, it } from 'vitest';
import { resolveComfyUIHistoryOutputs } from './comfyui-output-resolver';

describe('resolveComfyUIHistoryOutputs', () => {
  it('normalizes images, gifs, and audio from ComfyUI history', () => {
    const outputs = resolveComfyUIHistoryOutputs(
      {
        outputs: {
          '9': {
            images: [{ filename: 'hero.png', subfolder: 'shots', type: 'output' }],
            gifs: [{ filename: 'take.gif', subfolder: 'video', type: 'output' }],
            audio: [{ filename: 'mix.wav', subfolder: 'audio', type: 'output' }],
          },
        },
      },
      { baseUrl: 'http://localhost:8188' },
    );

    expect(outputs).toEqual([
      { uri: 'http://localhost:8188/view?filename=hero.png&subfolder=shots&type=output', mediaType: 'image' },
      { uri: 'http://localhost:8188/view?filename=take.gif&subfolder=video&type=output', mediaType: 'video' },
      { uri: 'http://localhost:8188/view?filename=mix.wav&subfolder=audio&type=output', mediaType: 'audio' },
    ]);
  });

  it('returns no assets for an empty history response', () => {
    expect(resolveComfyUIHistoryOutputs({}, { baseUrl: 'http://localhost:8188' })).toEqual([]);
  });
});
