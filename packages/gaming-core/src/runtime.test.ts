import { describe, expect, it } from 'vitest';
import { RuntimeResolver, type GameRuntimeAdapter } from './runtime.js';
const game={id:'1',title:'Test',platform:'pc' as const,contentUri:'game://1'};
const adapter=(id:string,scorePlatform='pc' as const,capabilities:string[]=[]):GameRuntimeAdapter=>({runtime:{id,name:id,platform:scorePlatform,kind:'native',capabilities},canLaunch:async()=>true,launch:async()=>({id:'s',gameId:game.id,runtimeId:id,startedAt:'now'})});
describe('RuntimeResolver',()=>{
 it('ranks exact platform matches',async()=>{const r=new RuntimeResolver([adapter('other','cloud'),adapter('pc')]);expect((await r.resolve(game)).runtime.id).toBe('pc');});
 it('honors explicit runtime preference',async()=>{const r=new RuntimeResolver([adapter('a'),adapter('preferred')]);expect((await r.resolve(game,{preferredRuntimeIds:['preferred']})).runtime.id).toBe('preferred');});
 it('uses capabilities as a deterministic tie breaker',async()=>{const r=new RuntimeResolver([adapter('basic','pc'),adapter('capable','pc',['hdr'])]);expect((await r.resolve(game,{availableCapabilities:['hdr']})).runtime.id).toBe('capable');});
});
