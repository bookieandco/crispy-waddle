import { describe, expect, it } from 'vitest';
import { RuntimeResolver, type GameRuntimeAdapter } from './runtime.js';
const game={id:'1',title:'Test',platform:'pc' as const,contentUri:'game://1'};
const adapter=(id:string,kind:'native'|'cloud'='native',caps:string[]=[]):GameRuntimeAdapter=>({runtime:{id,name:id,platform:'pc',kind,capabilities:caps},canLaunch:async()=>true,launch:async()=>({id:'s',gameId:'1',runtimeId:id,startedAt:'now'})});
describe('Runtime capability policy',()=>{
 it('filters runtimes missing required capabilities',async()=>{const r=new RuntimeResolver([adapter('basic'),adapter('hdr','native',['hdr'])]);expect((await r.resolve(game,{device:{requiredCapabilities:['hdr']}})).runtime.id).toBe('hdr');});
 it('penalizes high-latency remote runtimes',async()=>{const r=new RuntimeResolver([adapter('local'),adapter('remote','cloud')]);expect((await r.resolve(game,{device:{networkLatencyMs:150}})).runtime.id).toBe('local');});
});
