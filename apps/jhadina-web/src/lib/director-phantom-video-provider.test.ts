import { afterEach, describe, expect, it, vi } from 'vitest';
import { DirectorPhantomVideoProvider } from './director-phantom-video-provider';

afterEach(()=>vi.restoreAllMocks());

const reference={
  id:'ref-1',
  role:'character' as const,
  assetId:'asset:ref-1',
  uri:'https://signed.example/ref-1.png',
  sha256:'a'.repeat(64),
  description:'locked hero reference',
  evidenceIds:['lock:1'],
};

describe('Director Phantom video provider',()=>{
  it('submits a governed shot request with exact model/reference lineage',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      providerJobId:'phantom-job-1',
      status:'queued',
      modelVersion:'phantom-wan-14b:checkpoint-a',
      runtimeReceiptId:'runtime:1',
    }),{status:200,headers:{'content-type':'application/json'}}));
    const provider=new DirectorPhantomVideoProvider({baseUrl:'https://phantom.example/',token:'secret'});
    await expect(provider.submit({
      requestId:'request:1',
      projectId:'project:1',
      purpose:'final-take',
      prompt:'The locked hero turns toward camera.',
      references:[reference],
      durationSeconds:5,
      seed:42,
    },'idem:1')).resolves.toMatchObject({
      providerJobId:'phantom-job-1',
      status:'queued',
      runtimeReceiptId:'runtime:1',
    });
    const [url,init]=fetchMock.mock.calls[0]!;
    expect(url).toBe('https://phantom.example/v1/jobs');
    expect(init?.headers).toMatchObject({
      'content-type':'application/json',
      'idempotency-key':'idem:1',
      authorization:'Bearer secret',
    });
    const body=JSON.parse(String(init?.body));
    expect(body.request).toMatchObject({
      model:'phantom-wan-14b',
      task:'s2v-14B',
      seed:42,
      references:[{assetId:'asset:ref-1',sha256:'a'.repeat(64)}],
    });
  });

  it('refuses to use Phantom as a hidden long-form one-shot renderer',async()=>{
    const provider=new DirectorPhantomVideoProvider({baseUrl:'https://phantom.example'});
    await expect(provider.submit({
      requestId:'request:2',
      projectId:'project:1',
      purpose:'final-take',
      prompt:'Do not synthesize an entire movie as one diffusion request.',
      references:[reference],
      durationSeconds:600,
      seed:7,
    },'idem:2')).rejects.toThrow('DIRECTOR_PHANTOM_SHOT_DURATION_INVALID');
  });
});
