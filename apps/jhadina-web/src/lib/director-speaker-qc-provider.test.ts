import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  DirectorSpeakerQcProvider,
  createConfiguredDirectorSpeakerQcProvider,
} from './director-speaker-qc-provider';

afterEach(()=>{
  vi.restoreAllMocks();
  delete process.env.DIRECTOR_SPEAKER_QC_URL;
  delete process.env.DIRECTOR_SPEAKER_QC_TOKEN;
});

describe('Director speaker QC provider',()=>{
  it('stays unconfigured without an explicit private endpoint',()=>{
    expect(createConfiguredDirectorSpeakerQcProvider()).toBeUndefined();
  });

  it('passes bearer auth and validates a fingerprint receipt',async()=>{
    const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      sourceSha256:'a'.repeat(64),
      normalizedAudioSha256:'b'.repeat(64),
      modelId:'speechbrain/spkrec-ecapa-voxceleb',
      modelRevision:'ff989f88e92ccc120569763824f8eedd5afc9039',
      embeddingDimensions:192,
      embeddingSha256:'c'.repeat(64),
      fingerprintRef:'speaker-embedding:ecapa-voxceleb:ff989f88e92c:sha256:'+'c'.repeat(64),
      quantization:'l2-int16-v1',
      sampleRateHz:16000,
      durationSeconds:9.04,
      qualityClaim:false,
    }),{status:200,headers:{'content-type':'application/json'}}));
    const provider=new DirectorSpeakerQcProvider({baseUrl:'https://speaker.example/',token:'secret'});
    const receipt=await provider.fingerprint({
      audioBase64:'YXVkaW8=',
      mimeType:'audio/mpeg',
      expectedSourceSha256:'a'.repeat(64),
    });
    expect(receipt.embeddingDimensions).toBe(192);
    expect(receipt.qualityClaim).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://speaker.example/v1/fingerprint',
      expect.objectContaining({
        method:'POST',
        headers:expect.objectContaining({authorization:'Bearer secret'}),
      }),
    );
  });

  it('fails closed on malformed verification receipts',async()=>{
    vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({
      similarity:'not-a-number',
    }),{status:200,headers:{'content-type':'application/json'}}));
    const provider=new DirectorSpeakerQcProvider({baseUrl:'https://speaker.example'});
    await expect(provider.verify({
      referenceAudioBase64:'YQ==',
      referenceMimeType:'audio/mpeg',
      candidateAudioBase64:'Yg==',
      candidateMimeType:'audio/mpeg',
    })).rejects.toThrow('DIRECTOR_SPEAKER_QC_VERIFY_RECEIPT_INVALID');
  });
});
