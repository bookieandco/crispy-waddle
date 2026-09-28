import { describe, expect, it } from 'vitest';
import {
  buildHunyuanVideo15Request,
  hunyuanVideo15CliArguments,
  validateHunyuanVideo15Request,
  type HunyuanVideo15Reference,
} from './hunyuan-video-15-provider.js';

const reference:HunyuanVideo15Reference={
  assetId:'character:hero',
  uri:'https://signed.example/hero.png',
  sha256:'a'.repeat(64),
  semanticLabel:'locked hero first frame',
  evidenceIds:['cast:hero'],
};

describe('HunyuanVideo-1.5 Director contract',()=>{
  it('defaults the fast local primary to 480p I2V step distilled at 12 steps',()=>{
    const request=buildHunyuanVideo15Request({
      requestId:'req:1',
      projectId:'film:1',
      model:'hunyuan-video-1.5-480p-i2v-step-distilled',
      prompt:'The locked hero walks toward camera in warm window light.',
      reference,
      seed:42,
    });
    expect(request).toMatchObject({
      mode:'i2v',
      resolution:'480p',
      videoLength:121,
      numInferenceSteps:12,
      cfgDistilled:true,
      enableStepDistill:true,
      offloading:true,
      source:{minimumGpuMemoryGb:14,territoryRestricted:true},
    });
    expect(validateHunyuanVideo15Request(request)).toEqual([]);
  });

  it('keeps T2V and I2V reference semantics separate',()=>{
    expect(()=>buildHunyuanVideo15Request({
      requestId:'req:2',
      projectId:'film:1',
      model:'hunyuan-video-1.5-720p-t2v',
      prompt:'Wide exterior establishing shot.',
      reference,
      seed:2,
    })).toThrow('DIRECTOR_HUNYUAN_REQUEST_INVALID');
    expect(()=>buildHunyuanVideo15Request({
      requestId:'req:3',
      projectId:'film:1',
      model:'hunyuan-video-1.5-720p-i2v',
      prompt:'Reference-preserving shot.',
      seed:3,
    })).toThrow('DIRECTOR_HUNYUAN_REQUEST_INVALID');
  });

  it('restricts step-distilled inference to upstream-supported step counts',()=>{
    expect(()=>buildHunyuanVideo15Request({
      requestId:'req:4',
      projectId:'film:1',
      model:'hunyuan-video-1.5-480p-i2v-step-distilled',
      prompt:'shot',
      reference,
      seed:4,
      numInferenceSteps:20,
    })).toThrow('DIRECTOR_HUNYUAN_STEP_DISTILL_STEPS_INVALID');
  });

  it('emits only upstream generate.py flags and preserves deterministic lineage',()=>{
    const request=buildHunyuanVideo15Request({
      requestId:'req:5',
      projectId:'film:1',
      model:'hunyuan-video-1.5-480p-i2v-step-distilled',
      prompt:'Product hero shot with a slow dolly in.',
      negativePrompt:'deformed hands',
      reference,
      seed:99,
      enableSuperResolution:true,
    });
    expect(hunyuanVideo15CliArguments(request,{
      modelPath:'/models/HunyuanVideo-1.5',
      referencePath:'/work/reference.png',
      outputPath:'/work/output.mp4',
    })).toEqual(expect.arrayContaining([
      'generate.py',
      '--resolution','480p',
      '--image_path','/work/reference.png',
      '--num_inference_steps','12',
      '--video_length','121',
      '--seed','99',
      '--cfg_distilled','true',
      '--enable_step_distill','true',
      '--output_path','/work/output.mp4',
    ]));
  });
});
