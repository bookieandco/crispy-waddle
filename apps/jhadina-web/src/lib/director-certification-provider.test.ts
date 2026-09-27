import { afterEach, describe, expect, it } from 'vitest';
import { createConfiguredWholeVideoProviders } from './director-whole-video-providers';

const envKeys=[
  'DIRECTOR_COMFYUI_URL',
  'DIRECTOR_REFERENCE_VIDEO_PROVIDER_URL',
  'DIRECTOR_PRODUCT_VIDEO_PROVIDER_URL',
  'DIRECTOR_AGNES_VIDEO_URL',
  'DIRECTOR_SHORT_VIDEO_MAKER_URL',
] as const;
const original=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));

afterEach(()=>{
  for(const key of envKeys){
    const value=original[key];
    if(value===undefined) delete process.env[key];
    else process.env[key]=value;
  }
});

describe('Director certification provider isolation',()=>{
  it('does not expose the smoke renderer to ordinary provider selection',()=>{
    for(const key of envKeys) delete process.env[key];
    const providers=createConfiguredWholeVideoProviders();
    expect(providers.map(provider=>provider.descriptor.id)).not.toContain('director-certification-smoke');
  });

  it('admits the smoke renderer only when certification is explicit',()=>{
    for(const key of envKeys) delete process.env[key];
    const providers=createConfiguredWholeVideoProviders({includeCertification:true});
    expect(providers.map(provider=>provider.descriptor.id)).toEqual(['director-certification-smoke']);
    expect(providers[0]?.descriptor.costClass).toBe('free-local');
  });
});
