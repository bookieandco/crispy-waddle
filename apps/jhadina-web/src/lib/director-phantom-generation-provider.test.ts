import { describe, expect, it, vi } from 'vitest';
import type { GenerationRequest } from '@jhadina/director-core';
import { DirectorPhantomVideoProvider } from './director-phantom-video-provider';
import { PhantomDirectorGenerationProvider, phantomModelRecords } from './director-phantom-generation-provider';

function request():GenerationRequest{
  const model=phantomModelRecords()[1]!;
  return {
    requestId:'director:film:take:1',
    projectId:'film:1',
    modality:'video',
    prompt:'The locked hero picks up the exact product and turns toward camera.',
    model,
    references:[
      {
        assetId:'character:hero',
        role:'character',
        media:'image',
        uri:'https://signed.example/hero.png',
        sha256:'a'.repeat(64),
        semanticLabel:'canonical hero',
        evidenceIds:['cast:hero'],
      },
      {
        assetId:'product:shirt',
        role:'product',
        media:'image',
        uri:'https://signed.example/shirt.png',
        sha256:'b'.repeat(64),
        semanticLabel:'exact shirt',
        evidenceIds:['product-bible:shirt'],
      },
    ],
    parameters:{targetRuntimeSeconds:5,seed:42},
  };
}

describe('PhantomDirectorGenerationProvider',()=>{
  it('maps canonical Director references into the Phantom shot worker',async()=>{
    const worker=new DirectorPhantomVideoProvider({baseUrl:'https://phantom.example'});
    const submit=vi.spyOn(worker,'submit').mockResolvedValue({
      providerJobId:'phantom-job-1',
      status:'queued',
      requestId:'director:film:take:1',
      projectId:'film:1',
      model:'phantom-wan-14b',
      modelVersion:'14b',
    });
    const provider=new PhantomDirectorGenerationProvider(worker);
    await expect(provider.submit(request(),{idempotencyKey:'idem:1'})).resolves.toMatchObject({
      providerId:'phantom-wan',
      providerJobId:'phantom-job-1',
      status:'queued',
    });
    expect(submit).toHaveBeenCalledOnce();
    const [input,key]=submit.mock.calls[0]!;
    expect(key).toBe('idem:1');
    expect(input).toMatchObject({
      projectId:'film:1',
      purpose:'final-take',
      model:'phantom-wan-14b',
      durationSeconds:5,
      seed:42,
      references:[
        {role:'character',assetId:'character:hero',sha256:'a'.repeat(64)},
        {role:'product',assetId:'product:shirt',sha256:'b'.repeat(64)},
      ],
    });
  });

  it('refuses a reference that lost its digest before provider submission',async()=>{
    const worker=new DirectorPhantomVideoProvider({baseUrl:'https://phantom.example'});
    const provider=new PhantomDirectorGenerationProvider(worker);
    const broken=request();
    broken.references=[{...broken.references![0]!,sha256:undefined}];
    await expect(provider.submit(broken,{idempotencyKey:'idem:2'}))
      .rejects.toThrow('DIRECTOR_PHANTOM_REFERENCE_HASH_REQUIRED');
  });

  it('registers production-capable subject-consistency models explicitly',()=>{
    const [draft,final]=phantomModelRecords();
    expect(draft?.capabilities).toContain('identity-preserving-video');
    expect(final?.capabilities).toContain('product-reference-video');
    expect(final?.metadata?.maximumReferenceImages).toBe(4);
  });
});
