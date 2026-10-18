/** Progressive audio NDJSON consumer. Does not certify in-flight GPU cancellation. */
export type NativeVoiceAudioEvent={type:'audio';audioBase64:string;mimeType:string;voiceIdentityId?:string}
export async function consumeNativeVoiceStream(stream:ReadableStream<Uint8Array>,signal:AbortSignal,play:(e:NativeVoiceAudioEvent)=>Promise<void>):Promise<number>{
 const reader=stream.getReader(),decoder=new TextDecoder();
 let buffer='',doneEvent=false,played=0;
 const cancel=()=>{void reader.cancel('barge-in').catch(()=>{})};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  while(!doneEvent){
   if(signal.aborted)throw new DOMException('Speech interrupted','AbortError');
   const {done,value}=await reader.read();
   if(signal.aborted)throw new DOMException('Speech interrupted','AbortError');
   buffer+=decoder.decode(value??new Uint8Array(),{stream:!done});
   if(buffer.length>8_000_000)throw new Error('VOICE_STREAM_FRAME_LIMIT');
   let at=buffer.indexOf('\n');
   while(at>=0){
    const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);
    if(line){
     const e=JSON.parse(line) as {type?:string;audioBase64?:unknown;mimeType?:unknown;voiceIdentityId?:unknown;detail?:unknown};
     if(e.type==='error')throw new Error(typeof e.detail==='string'?e.detail:'VOICE_STREAM_ERROR');
     if(e.type==='done'){doneEvent=true;break;}
     if(e.type!=='audio')throw new Error('VOICE_STREAM_EVENT_INVALID');
     if(typeof e.audioBase64!=='string'||!e.audioBase64||e.audioBase64.length>7_500_000)throw new Error('VOICE_STREAM_AUDIO_INVALID');
     if(e.mimeType!=='audio/wav'&&e.mimeType!=='audio/mpeg'&&e.mimeType!=='audio/mp4')throw new Error('VOICE_STREAM_MIME_INVALID');
     if(e.voiceIdentityId!==undefined&&e.voiceIdentityId!=='voice:jhadina:canonical:v1')throw new Error('VOICE_STREAM_IDENTITY_MISMATCH');
     await play({type:'audio',audioBase64:e.audioBase64,mimeType:e.mimeType,voiceIdentityId:typeof e.voiceIdentityId==='string'?e.voiceIdentityId:undefined});
     played++;
    }
    if(signal.aborted)throw new DOMException('Speech interrupted','AbortError');
    at=buffer.indexOf('\n');
   }
   if(done)break;
  }
  if(signal.aborted)throw new DOMException('Speech interrupted','AbortError');
  if(!doneEvent)throw new Error('VOICE_STREAM_EOF_WITHOUT_DONE');
  return played;
 }finally{
  signal.removeEventListener('abort',cancel);
  if(!doneEvent||signal.aborted)await reader.cancel('stream-finalize').catch(()=>{});
  reader.releaseLock();
 }
}
