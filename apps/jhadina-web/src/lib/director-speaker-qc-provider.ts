export interface DirectorSpeakerQcConfig {
  baseUrl:string;
  token?:string;
}

export interface DirectorSpeakerFingerprintReceipt {
  sourceSha256:string;
  normalizedAudioSha256:string;
  modelId:string;
  modelRevision:string;
  embeddingDimensions:number;
  embeddingSha256:string;
  fingerprintRef:string;
  quantization:string;
  sampleRateHz:number;
  durationSeconds:number;
  qualityClaim:boolean;
}

export interface DirectorSpeakerVerificationReceipt {
  similarity:number;
  modelId:string;
  modelRevision:string;
  referenceSha256:string;
  candidateSha256:string;
  referenceDurationSeconds:number;
  candidateDurationSeconds:number;
  qualityClaim:boolean;
}

function cleanBaseUrl(value:string){
  return value.replace(/\/+$/,'');
}

export class DirectorSpeakerQcProvider {
  private readonly endpoint:string;

  constructor(private readonly config:DirectorSpeakerQcConfig){
    this.endpoint=cleanBaseUrl(config.baseUrl);
  }

  private headers(extra:Record<string,string>={}):Record<string,string>{
    return {
      ...extra,
      ...(this.config.token?{authorization:`Bearer ${this.config.token}`}:{}),
    };
  }

  async health():Promise<Readonly<Record<string,unknown>>>{
    const response=await fetch(`${this.endpoint}/health`,{
      headers:this.headers(),
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_SPEAKER_QC_HEALTH_FAILED:${response.status}`);
    return await response.json() as Readonly<Record<string,unknown>>;
  }

  async fingerprint(input:{
    audioBase64:string;
    mimeType:string;
    expectedSourceSha256?:string;
  }):Promise<DirectorSpeakerFingerprintReceipt>{
    const response=await fetch(`${this.endpoint}/v1/fingerprint`,{
      method:'POST',
      headers:this.headers({'content-type':'application/json'}),
      body:JSON.stringify({
        mimeType:input.mimeType,
        audioBase64:input.audioBase64,
        ...(input.expectedSourceSha256?{expectedSourceSha256:input.expectedSourceSha256}:{}),
      }),
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_SPEAKER_QC_FINGERPRINT_FAILED:${response.status}`);
    const body=await response.json() as DirectorSpeakerFingerprintReceipt;
    if(!body.fingerprintRef||!body.embeddingSha256||!body.modelRevision){
      throw new Error('DIRECTOR_SPEAKER_QC_FINGERPRINT_RECEIPT_INVALID');
    }
    return body;
  }

  async verify(input:{
    referenceAudioBase64:string;
    referenceMimeType:string;
    candidateAudioBase64:string;
    candidateMimeType:string;
  }):Promise<DirectorSpeakerVerificationReceipt>{
    const response=await fetch(`${this.endpoint}/v1/verify`,{
      method:'POST',
      headers:this.headers({'content-type':'application/json'}),
      body:JSON.stringify(input),
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_SPEAKER_QC_VERIFY_FAILED:${response.status}`);
    const body=await response.json() as DirectorSpeakerVerificationReceipt;
    if(!Number.isFinite(body.similarity)||!body.modelRevision){
      throw new Error('DIRECTOR_SPEAKER_QC_VERIFY_RECEIPT_INVALID');
    }
    return body;
  }
}

export function createConfiguredDirectorSpeakerQcProvider():DirectorSpeakerQcProvider|undefined{
  const url=process.env.DIRECTOR_SPEAKER_QC_URL?.trim();
  if(!url) return undefined;
  return new DirectorSpeakerQcProvider({
    baseUrl:url,
    token:process.env.DIRECTOR_SPEAKER_QC_TOKEN?.trim()||undefined,
  });
}
