import {describe,expect,it} from 'vitest';
import {DurableGameLibrary,DurableGamingSaveStore,DurableGamingHistory,DurableGamingObservations,DurableGamingRoutes,InMemoryGamingRecordStore} from './gaming-durable.js';
import {GamingSaveCoordinator} from './gaming-save-sync.js';
describe('GAME-FINISH.05 durable contract',()=>{
 it('recovers library entries after rebuilding a repository',async()=>{
   const backend=new InMemoryGamingRecordStore();
   await new DurableGameLibrary(backend).save({id:'gb1',title:'Owned game',platform:'gameboy',contentUri:'content://gb1'});
   const afterRestart=new DurableGameLibrary(backend);
   expect(await afterRestart.get('gb1')).toMatchObject({title:'Owned game'});
   expect((await afterRestart.list('gameboy')).length).toBe(1);
   await afterRestart.remove('gb1');
   expect(await new DurableGameLibrary(backend).get('gb1')).toBeUndefined();
 });
 it('rejects stale save revisions and preserves last written state',async()=>{
   const backend=new InMemoryGamingRecordStore();
   const a=new GamingSaveCoordinator(new DurableGamingSaveStore(backend));
   const b=new GamingSaveCoordinator(new DurableGamingSaveStore(backend));
   await a.write({saveId:'slot-1',gameId:'g',ownerId:'u',runtimeId:'gb',kind:'state',uri:'vault://1',expectedRevision:0,nowMs:1});
   await expect(b.write({saveId:'slot-1',gameId:'g',ownerId:'u',runtimeId:'gb',kind:'state',uri:'vault://old',expectedRevision:0,nowMs:2})).rejects.toThrow(/conflict/i);
   expect((await b.latest('g','u'))?.uri).toBe('vault://1');
   await a.write({saveId:'slot-1',gameId:'g',ownerId:'u',runtimeId:'gb',kind:'state',uri:'vault://2',expectedRevision:1,nowMs:2});
   expect((await b.latest('g','u'))?.revision).toBe(2);
 });
 it('keeps history and observations across repository re-instantiation',async()=>{
   const db=new InMemoryGamingRecordStore();
   await new DurableGamingHistory(db).append({sessionId:'s',gameId:'g',runtimeId:'gb',startedAtMs:1,finishedAtMs:2,status:'stopped'});
   await new DurableGamingObservations(db).record({observationId:'o',sessionId:'s',gameId:'g',kind:'player-note',observedAtMs:2,summary:'checkpoint',evidenceRefs:[]});
   expect(await new DurableGamingHistory(db).forGame('g')).toHaveLength(1);
   expect((await new DurableGamingObservations(db).forGame('g'))[0]?.summary).toBe('checkpoint');
 });
 it('rejects fabricated route measurements and concurrent record revisions',async()=>{
   const db=new InMemoryGamingRecordStore();
   await expect(new DurableGamingRoutes(db).record('x',{gameId:'g',runtimeId:'gb',deviceId:'phone',displayId:'phone',controllerProfileId:'touch',networkClass:'offline',compatible:true,measured:false,inputLatencyMs:1,frameTimeMs:16,crashed:false,saveRoundTripPassed:true})).rejects.toThrow(/genuine/);
   const first=await db.write('key',{n:1},0);
   expect(first.revision).toBe(1);
   await expect(db.write('key',{n:2},0)).rejects.toThrow(/conflict/);
   expect((await db.read<{n:number}>('key'))?.payload.n).toBe(1);
 });
});
