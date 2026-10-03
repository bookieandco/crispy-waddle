import {afterEach,describe,expect,it,vi} from 'vitest';
import {AgnesVideoProductionProvider} from './director-whole-video-providers';
import type {WholeVideoProductionBrief} from '@jhadina/director-core/whole-video-provider';

afterEach(()=>{
  vi.restoreAllMocks();
  delete process.env.DIRECTOR_AGNES_VIDEO_SUPPORTS_CANONICAL_NARRATION;
});

function brief():WholeVideoProductionBrief{
  return {
    jobId:'job-jhadina-voice',
    projectId:'project-jhadina-voice',
    prompt:'Jhadina narrates the update.',
    intent:{
      mode:'short',
      prompt:'Jhadina narrates the update.',
      aspectRatio:'16:9',
      targetDurationSeconds:12,
      narration:true,
      captions:true,
      foley:true,
      commercialSafeOnly:true,
      providerPolicy:{localFreeFirst:true,allowPaidWithoutApproval:false},
    },
    creativeName:'Jhadina voice surface test',
    narration:{
      speakerIdentityRef:'voice:jhadina:canonical:v1',
      voiceProfileRef:'brand-voice:jhadinatv',
      language:'en-US',
      authority:'CANONICAL_VOICE_REFERENCE',
    },
  };
}

describe('Director whole-video canonical narration transport',()=>{
  it('defaults Agnes to not canonical-narration capable',()=>{
    const provider=new AgnesVideoProductionProvider({baseUrl:'https://agnes.example'});
    expect(provider.descriptor.supportsCanonicalNarrationIdentity).toBe(false);
  });

  it('preserves exact speaker identity and expression profile when an admitted deployment opts in',async()=>{
    process.env.DIRECTOR_AGNES_VIDEO_SUPPORTS_CANONICAL_NARRATION='true';
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(
      new Response(JSON.stringify({task_id:'task-1'}),{status:200,headers:{'content-type':'application/json'}}),
    );
    const provider=new AgnesVideoProductionProvider({baseUrl:'https://agnes.example',token:'secret'});
    expect(provider.descriptor.supportsCanonicalNarrationIdentity).toBe(true);

    await provider.submit(brief(),'idem-1');
    const init=fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const form=init?.body as FormData;
    expect(form.get('narration_speaker_identity_ref')).toBe('voice:jhadina:canonical:v1');
    expect(form.get('narration_voice_profile_ref')).toBe('brand-voice:jhadinatv');
    expect(form.get('narration_language')).toBe('en-US');
  });
});
