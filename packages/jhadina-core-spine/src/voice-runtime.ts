export type JhadinaVoiceStage = 'decode'|'asr'|'reason'|'tts'|'viseme';

export interface JhadinaVoiceProfile {
  id:string;
  displayName:string;
  primaryLanguage:string;
  supportedLanguages:readonly string[];
  delivery:{
    defaultRate:number;
    pauseScale:number;
    expressiveness:number;
    interruptionPolicy:'barge-in';
  };
  providerPriority:readonly string[];
}

export interface VoiceTurnAudio {
  mimeType:string;
  bytesBase64:string;
  languageHint?:string;
}

export interface VoiceTranscriptSegment {
  startMs:number;
  endMs:number;
  text:string;
  speaker?:string;
}

export interface VoiceTranscript {
  language:string;
  text:string;
  segments:readonly VoiceTranscriptSegment[];
  provider:string;
}

export interface VoiceAcousticSignals {
  utteranceDurationMs?:number;
  speakingRateWpm?:number;
  pauseRatio?:number;
  rmsMean?:number;
  rmsPeak?:number;
  energyVariance?:number;
  pitchMeanHz?:number;
  pitchVariance?:number;
}

export interface JhadinaVoiceTurn {
  transcript:VoiceTranscript;
  acousticSignals?:VoiceAcousticSignals;
}

export interface VoiceSynthesisRequest {
  text:string;
  language:string;
  profile:JhadinaVoiceProfile;
  delivery?:{
    rate?:number;
    pauseScale?:number;
    emphasis?:readonly string[];
    style?:string;
  };
}

export interface VoiceSynthesisResult {
  provider:string;
  mimeType:string;
  audioBase64:string;
  durationMs?:number;
  wordTimings?:readonly {word:string;startMs:number;endMs:number}[];
}

export interface JhadinaAsrProvider {
  readonly id:string;
  supports(language?:string):boolean;
  transcribe(audio:VoiceTurnAudio,signal?:AbortSignal):Promise<VoiceTranscript>;
}

export interface JhadinaTtsProvider {
  readonly id:string;
  supports(language:string):boolean;
  synthesize(request:VoiceSynthesisRequest,signal?:AbortSignal):Promise<VoiceSynthesisResult>;
}

export interface ConversationSignalObserver {
  observe(audio:VoiceTurnAudio,transcript:VoiceTranscript,signal?:AbortSignal):Promise<VoiceAcousticSignals>;
}

export class JhadinaVoiceRuntime {
  constructor(
    private readonly asr:readonly JhadinaAsrProvider[],
    private readonly tts:readonly JhadinaTtsProvider[],
    private readonly observer?:ConversationSignalObserver,
  ){}

  async listen(audio:VoiceTurnAudio,signal?:AbortSignal):Promise<JhadinaVoiceTurn>{
    const candidates=this.asr.filter(item=>item.supports(audio.languageHint));
    if(!candidates.length)throw new Error('JHADINA_VOICE_ASR_UNAVAILABLE');
    const failures:string[]=[];
    for(const provider of candidates){
      try{
        const transcript=await provider.transcribe(audio,signal);
        const acousticSignals=this.observer?await this.observer.observe(audio,transcript,signal):undefined;
        return Object.freeze({transcript,...(acousticSignals?{acousticSignals}: {})});
      }catch(error){
        if(signal?.aborted)throw error;
        failures.push(`${provider.id}:${error instanceof Error?error.message:'failed'}`);
      }
    }
    throw new Error(`JHADINA_VOICE_ASR_FAILED:${failures.join('|')}`);
  }

  async speak(request:VoiceSynthesisRequest,signal?:AbortSignal):Promise<VoiceSynthesisResult>{
    const preferred=request.profile.providerPriority
      .map(id=>this.tts.find(item=>item.id===id))
      .find((item):item is JhadinaTtsProvider=>Boolean(item?.supports(request.language)));
    const ordered=[
      ...(preferred?[preferred]:[]),
      ...this.tts.filter(item=>item!==preferred && item.supports(request.language)),
    ];
    if(!ordered.length)throw new Error('JHADINA_VOICE_TTS_UNAVAILABLE');
    const failures:string[]=[];
    for(const provider of ordered){
      try{return await provider.synthesize(request,signal);}
      catch(error){
        if(signal?.aborted)throw error;
        failures.push(`${provider.id}:${error instanceof Error?error.message:'failed'}`);
      }
    }
    throw new Error(`JHADINA_VOICE_TTS_FAILED:${failures.join('|')}`);
  }
}

export const JHADINA_CANONICAL_VOICE_PROFILE:JhadinaVoiceProfile=Object.freeze({
  id:'jhadina:canonical',
  displayName:'Jhadina',
  primaryLanguage:'en-US',
  supportedLanguages:Object.freeze(['en-US','es-US','fr-FR','de-DE','pt-BR','it-IT','ar-SA','hi-IN','ja-JP','ko-KR','zh-CN','ru-RU','vi-VN']),
  delivery:Object.freeze({defaultRate:1,pauseScale:1,expressiveness:.72,interruptionPolicy:'barge-in'}),
  providerPriority:Object.freeze(['voxcpm2','qwen3-tts','cosyvoice','f5-tts','vibevoice-fusion','browser-tts']),
});
