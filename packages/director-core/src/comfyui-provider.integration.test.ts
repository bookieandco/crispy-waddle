import { describe, expect, it } from 'vitest';
import { resolveComfyUIHistoryOutputs } from './comfyui-output-resolver';

describe('ComfyUI provider contract fixture', () => {
  it('models the prompt -> history -> asset boundary without requiring a GPU', () => {
    const promptResponse = { prompt_id: 'director-job-001' };
    const historyResponse = {
      'director-job-001': {
        outputs: {
          '42': { images: [{ filename: 'shot-001.png', subfolder: 'director', type: 'output' }] },
        },
      },
    };

    expect(promptResponse.prompt_id).toBe('director-job-001');
    const outputs = resolveComfyUIHistoryOutputs(historyResponse['director-job-001'], {
      baseUrl: 'http://comfyui.test',
    });

    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      mediaType: 'image',
      uri: 'http://comfyui.test/view?filename=shot-001.png&subfolder=director&type=output',
    });
  });
});
