import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComfyUIReferenceVideoProductionProvider, ReferenceCharacterVideoProductionProvider } from './director-whole-video-providers';

const intent = {
  mode: 'standard' as const,
  prompt: 'Create a full video',
  aspectRatio: '16:9' as const,
  targetDurationSeconds: 30,
  narration: true,
  captions: true,
  foley: true,
  commercialSafeOnly: true as const,
  providerPolicy: { localFreeFirst: true as const, allowPaidWithoutApproval: false as const },
};

afterEach(() => vi.restoreAllMocks());

describe('ReferenceCharacterVideoProductionProvider', () => {
  it('refuses submission if character references were lost before the provider boundary', async () => {
    const provider = new ReferenceCharacterVideoProductionProvider({ baseUrl: 'https://provider.example' });
    await expect(provider.submit({
      jobId: 'job-1',
      projectId: 'project-a',
      prompt: 'Make a video',
      intent,
      creativeName: 'Movie',
      character: {
        characterId: 'ela',
        continuityRef: 'character:ela:v1',
        appearanceVariantId: 'appearance:ela:base',
        referenceUris: [],
        referenceSha256s: ['sha-ref'],
      },
    }, 'idem-1')).rejects.toThrow('DIRECTOR_REFERENCE_VIDEO_CHARACTER_REQUIRED');
  });

  it('sends the exact locked character lineage and signed reference inputs', async () => {
    const fetchMock = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      providerJobId: 'provider-job-1',
      status: 'queued',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const provider = new ReferenceCharacterVideoProductionProvider({
      baseUrl: 'https://provider.example/',
      token: 'secret-token',
    });
    await expect(provider.submit({
      jobId: 'job-1',
      projectId: 'project-a',
      prompt: 'Make a video',
      intent,
      creativeName: 'Movie',
      character: {
        characterId: 'ela',
        continuityRef: 'character:ela:v1',
        appearanceVariantId: 'appearance:ela:base',
        referenceUris: ['https://signed.example/ref.png'],
        referenceSha256s: ['sha-ref'],
      },
    }, 'idem-1')).resolves.toMatchObject({
      providerJobId: 'provider-job-1',
      status: 'queued',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://provider.example/jobs');
    expect(init?.headers).toMatchObject({
      'content-type': 'application/json',
      'idempotency-key': 'idem-1',
      authorization: 'Bearer secret-token',
    });
    const body = JSON.parse(String(init?.body));
    expect(body.character).toEqual({
      characterId: 'ela',
      continuityRef: 'character:ela:v1',
      appearanceVariantId: 'appearance:ela:base',
      referenceUris: ['https://signed.example/ref.png'],
      referenceSha256s: ['sha-ref'],
    });
  });
});


describe('ComfyUIReferenceVideoProductionProvider', () => {
  it('uploads the locked reference and injects Director identity into the ComfyUI workflow', async () => {
    let queuedPrompt: Record<string,unknown> | undefined;
    const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async (input,init) => {
      const url=String(input);
      if(url==='https://comfy.example/history') {
        return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
      }
      if(url==='https://signed.example/ref.png') {
        return new Response(new Uint8Array([137,80,78,71]),{
          status:200,
          headers:{'content-type':'image/png'},
        });
      }
      if(url==='https://comfy.example/upload/image') {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeInstanceOf(FormData);
        return new Response(JSON.stringify({name:'director-sha-ref.png',subfolder:'input'}),{
          status:200,
          headers:{'content-type':'application/json'},
        });
      }
      if(url==='https://comfy.example/prompt') {
        const body=JSON.parse(String(init?.body));
        queuedPrompt=body.prompt;
        expect(body.client_id).toBe('idem-comfy-1');
        return new Response(JSON.stringify({prompt_id:'prompt-1'}),{
          status:200,
          headers:{'content-type':'application/json'},
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const provider=new ComfyUIReferenceVideoProductionProvider({
      baseUrl:'https://comfy.example/',
      workflow:{
        load:{inputs:{image:'{{DIRECTOR_REFERENCE_IMAGE}}'}},
        prompt:{inputs:{text:'{{DIRECTOR_PROMPT}}'}},
        identity:{inputs:{
          character:'{{DIRECTOR_CHARACTER_ID}}',
          continuity:'{{DIRECTOR_CONTINUITY_REF}}',
          appearance:'{{DIRECTOR_APPEARANCE_VARIANT_ID}}',
          references:'{{DIRECTOR_REFERENCE_IMAGES}}',
          width:'{{DIRECTOR_WIDTH}}',
          height:'{{DIRECTOR_HEIGHT}}',
          duration:'{{DIRECTOR_DURATION_SECONDS}}',
          seed:'{{DIRECTOR_SEED}}',
        }},
      },
    });

    await expect(provider.submit({
      jobId:'job-comfy-1',
      projectId:'project-a',
      prompt:'Ela opens the package and walks toward the hives.',
      intent,
      creativeName:'Ela Movie',
      character:{
        characterId:'ela',
        continuityRef:'character:ela:v1',
        appearanceVariantId:'appearance:ela:base',
        referenceUris:['https://signed.example/ref.png'],
        referenceSha256s:['sha-ref'],
      },
    },'idem-comfy-1')).resolves.toMatchObject({
      providerJobId:'prompt-1',
      status:'queued',
    });

    expect(queuedPrompt).toMatchObject({
      load:{inputs:{image:'input/director-sha-ref.png'}},
      prompt:{inputs:{text:'Ela opens the package and walks toward the hives.'}},
      identity:{inputs:{
        character:'ela',
        continuity:'character:ela:v1',
        appearance:'appearance:ela:base',
        references:['input/director-sha-ref.png'],
        width:1152,
        height:768,
        duration:30,
      }},
    });
    expect(typeof (queuedPrompt as any).identity.inputs.seed).toBe('number');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('recognizes a completed ComfyUI video output', async () => {
    vi.spyOn(globalThis,'fetch').mockImplementation(async (input) => {
      const url=String(input);
      if(url==='https://comfy.example/history/prompt-1') {
        return new Response(JSON.stringify({
          'prompt-1':{
            outputs:{
              '99':{
                gifs:[{filename:'ela-final.mp4',type:'output'}],
              },
            },
          },
        }),{status:200,headers:{'content-type':'application/json'}});
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const provider=new ComfyUIReferenceVideoProductionProvider({
      baseUrl:'https://comfy.example',
      workflow:{},
    });
    await expect(provider.status('prompt-1')).resolves.toMatchObject({
      providerJobId:'prompt-1',
      status:'ready',
      resultUri:'https://comfy.example/view?filename=ela-final.mp4&type=output',
    });
  });
});
