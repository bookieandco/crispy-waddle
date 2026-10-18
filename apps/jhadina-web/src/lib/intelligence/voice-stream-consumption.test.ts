import {describe,it,expect,vi} from 'vitest';
import {consumeNativeVoiceStream} from './voice-stream-consumption';
const enc=new TextEncoder();
const stream=(s:string)=>new ReadableStream<Uint8Array>({start(c){c.enqueue(enc.encode(s));c.close();}});
describe('native voice progressive stream',()=>{
 it('plays one canonical audio chunk and requires terminal done',async()=>{
  const play=vi.fn(async()=>{});
  expect(await consumeNativeVoiceStream(stream('{"type":"audio","mimeType":"audio/wav","audioBase64":"UklGRg==","voiceIdentityId":"voice:jhadina:canonical:v1"}\n{"type":"done"}\n'),new AbortController().signal,play)).toBe(1);
  expect(play).toHaveBeenCalledTimes(1);
 });
 it('premature EOF fails closed',async()=>{
  await expect(consumeNativeVoiceStream(stream('{"type":"audio","mimeType":"audio/wav","audioBase64":"UklGRg=="}\n'),new AbortController().signal,async()=>{})).rejects.toThrow(/EOF_WITHOUT_DONE/);
 });
 it('foreign speaker metadata stops playback',async()=>{
  const play=vi.fn(async()=>{});
  await expect(consumeNativeVoiceStream(stream('{"type":"audio","mimeType":"audio/wav","audioBase64":"x","voiceIdentityId":"foreign"}\n'),new AbortController().signal,play)).rejects.toThrow(/IDENTITY_MISMATCH/);
  expect(play).not.toHaveBeenCalled();
 });
 it('barge-in during playback prevents the next audio event',async()=>{
  const ctl=new AbortController(),play=vi.fn(async()=>ctl.abort());
  await expect(consumeNativeVoiceStream(stream('{"type":"audio","mimeType":"audio/wav","audioBase64":"UklGRg=="}\n{"type":"audio","mimeType":"audio/wav","audioBase64":"UklGRg=="}\n{"type":"done"}\n'),ctl.signal,play)).rejects.toMatchObject({name:'AbortError'});
  expect(play).toHaveBeenCalledTimes(1);
 });
});
