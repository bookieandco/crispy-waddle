import { describe,it,expect } from 'vitest';
import { JHADINA_CANONICAL_VOICE_PROFILE,JhadinaVoiceRuntime,createWorkSession,evolveWorkSession } from './index.js';

describe('JLLM runtime acceptance contracts',()=>{
  it('preserves one canonical Jhadina identity across provider fallback',async()=>{
    const calls:string[]=[];
    const runtime=new JhadinaVoiceRuntime([],[
      {id:'fallback',supports:()=>true,synthesize:async(req)=>{calls.push(req.profile.id);return{provider:'fallback',mimeType:'audio/wav',audioBase64:'AA=='}}},
    ]);
    const result=await runtime.speak({text:'hola',language:'es-US',profile:{...JHADINA_CANONICAL_VOICE_PROFILE,providerPriority:['missing']}});
    expect(result.provider).toBe('fallback');
    expect(calls).toEqual(['jhadina:canonical']);
  });

  it('falls through a failed TTS provider without changing canonical identity',async()=>{
    const identities:string[]=[];
    const runtime=new JhadinaVoiceRuntime([],[
      {id:'voxcpm2',supports:()=>true,synthesize:async()=>{throw new Error('offline')}},
      {id:'qwen3-tts',supports:()=>true,synthesize:async(req)=>{identities.push(req.profile.id);return{provider:'qwen3-tts',mimeType:'audio/wav',audioBase64:'AA=='}}},
    ]);
    const result=await runtime.speak({text:'hola',language:'es-US',profile:JHADINA_CANONICAL_VOICE_PROFILE});
    expect(result.provider).toBe('qwen3-tts');
    expect(identities).toEqual(['jhadina:canonical']);
  });

  it('falls through a failed ASR provider',async()=>{
    const runtime=new JhadinaVoiceRuntime([
      {id:'faster-whisper',supports:()=>true,transcribe:async()=>{throw new Error('offline')}},
      {id:'whisper-timestamped',supports:()=>true,transcribe:async()=>({language:'es-US',text:'hola',segments:[{startMs:0,endMs:500,text:'hola'}],provider:'whisper-timestamped'})},
    ],[]);
    const result=await runtime.listen({mimeType:'audio/wav',bytesBase64:'AA==',languageHint:'es-US'});
    expect(result.transcript.provider).toBe('whisper-timestamped');
  });

  it('keeps transcript and acoustic observations separate',async()=>{
    const runtime=new JhadinaVoiceRuntime([
      {id:'whisper',supports:()=>true,transcribe:async()=>({language:'en-US',text:'Jhadina, look at this',segments:[{startMs:0,endMs:1000,text:'Jhadina, look at this'}],provider:'whisper'})},
    ],[],{observe:async()=>({pauseRatio:.2,rmsMean:.1})});
    const turn=await runtime.listen({mimeType:'audio/wav',bytesBase64:'AA=='});
    expect(turn.transcript.text).toContain('look at this');
    expect(turn.acousticSignals?.pauseRatio).toBe(.2);
  });

  it('maintains a durable-session-shaped task envelope without granting authority',()=>{
    const session=createWorkSession({id:'ws-1',ownerUserId:'u-1',goal:'Fix Sports'});
    const next=evolveWorkSession(session,{activeSubsystems:['sports'],decisionRefs:['proposal:1']});
    expect(next.activeSubsystems).toEqual(['sports']);
    expect(next.decisionRefs).toEqual(['proposal:1']);
    expect((next as any).approved).toBeUndefined();
  });
});
