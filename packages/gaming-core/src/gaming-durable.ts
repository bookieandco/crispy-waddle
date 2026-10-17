import type {GameLibraryEntry,GameLibraryRepository} from './game-library.js';
import type {GamePlatform} from './runtime.js';
import type {GamingSaveStore,ManagedGamingSave} from './gaming-save-sync.js';
import type {GamingObservation} from './gaming-intelligence.js';
import type {GamingRouteObservation} from './gaming-g43-g50-production.js';

export interface GamingRecord<T>{
  key:string;
  revision:number;
  payload:T;
}
export interface GamingRecordStore {
  read<T>(key:string):Promise<GamingRecord<T>|undefined>;
  scan<T>(prefix:string):Promise<readonly GamingRecord<T>[]>;
  write<T>(key:string,payload:T,expectedRevision:number):Promise<GamingRecord<T>>;
  delete(key:string,expectedRevision:number):Promise<void>;
}
const copy=<T>(value:T):T=>{
  // IndexedDB uses structured cloning and can preserve Uint8Array, unlike JSON.
  if(typeof structuredClone!=='function')throw new Error('Structured clone is required for gaming persistence');
  return structuredClone(value);
};
function validateKey(key:string):void{
  if(!key.trim()||key.length>400)throw new Error('Invalid gaming record key');
}
function validateRevision(revision:number):void{
  if(!Number.isSafeInteger(revision)||revision<0)throw new Error('Invalid gaming record revision');
}
const key=(kind:string,id:string)=>{if(!id.trim())throw new Error('Gaming record id is required');return kind+':'+encodeURIComponent(id);};
const prefix=(kind:string)=>kind+':';

/** Test/reference implementation; never interpret this as durable across process restarts. */
export class InMemoryGamingRecordStore implements GamingRecordStore{
  private readonly records=new Map<string,GamingRecord<unknown>>();
  async read<T>(id:string):Promise<GamingRecord<T>|undefined>{
    const item=this.records.get(id);return item?copy(item) as GamingRecord<T>:undefined;
  }
  async scan<T>(startsWith:string):Promise<readonly GamingRecord<T>[]>{
    return [...this.records.values()].filter(v=>v.key.startsWith(startsWith))
      .sort((a,b)=>a.key.localeCompare(b.key)).map(v=>copy(v) as GamingRecord<T>);
  }
  async write<T>(id:string,payload:T,expectedRevision:number):Promise<GamingRecord<T>>{
    validateKey(id);validateRevision(expectedRevision);
    const current=this.records.get(id)?.revision??0;
    if(current!==expectedRevision)throw new Error('Gaming record revision conflict');
    const next={key:id,revision:current+1,payload:copy(payload)};
    this.records.set(id,next);return copy(next);
  }
  async delete(id:string,expectedRevision:number):Promise<void>{
    validateKey(id);validateRevision(expectedRevision);
    const current=this.records.get(id)?.revision??0;
    if(current!==expectedRevision)throw new Error('Gaming record revision conflict');
    this.records.delete(id);
  }
}

/** Browser-owned IndexedDB. Each write uses one readwrite transaction for cross-tab CAS. */
export class IndexedDbGamingRecordStore implements GamingRecordStore{
  private connection?:Promise<IDBDatabase>;
  constructor(private readonly databaseName='jhadina-game-core-v1',private readonly indexedDb:IDBFactory=globalThis.indexedDB){
    if(!indexedDb)throw new Error('IndexedDB is unavailable: persistent gaming storage is required');
  }
  private open():Promise<IDBDatabase>{
    if(!this.connection){
      this.connection=new Promise((resolve,reject)=>{
        const request=this.indexedDb.open(this.databaseName,1);
        request.onupgradeneeded=()=>{request.result.createObjectStore('records',{keyPath:'key'});};
        request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
        request.onerror=()=>reject(request.error??new Error('Failed to open gaming storage'));
        request.onblocked=()=>reject(new Error('Gaming database upgrade blocked by another tab'));
      });
    }
    return this.connection;
  }
  async read<T>(id:string):Promise<GamingRecord<T>|undefined>{
    validateKey(id);
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('records','readonly');
      const req=tx.objectStore('records').get(id);
      req.onsuccess=()=>resolve(req.result?copy(req.result as GamingRecord<T>):undefined);
      req.onerror=()=>reject(req.error??new Error('Gaming read failed'));
    });
  }
  async scan<T>(startsWith:string):Promise<readonly GamingRecord<T>[]>{
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('records','readonly').objectStore('records').getAll();
      req.onsuccess=()=>resolve((req.result as GamingRecord<T>[]).filter(v=>v.key.startsWith(startsWith))
        .sort((a,b)=>a.key.localeCompare(b.key)).map(v=>copy(v)));
      req.onerror=()=>reject(req.error??new Error('Gaming scan failed'));
    });
  }
  async write<T>(id:string,payload:T,expectedRevision:number):Promise<GamingRecord<T>>{
    validateKey(id);validateRevision(expectedRevision);
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('records','readwrite');
      const store=tx.objectStore('records');
      let next:GamingRecord<T>|undefined;
      tx.oncomplete=()=>resolve(copy(next!));
      tx.onabort=()=>reject(tx.error??new Error('Gaming write failed or conflicted'));
      tx.onerror=()=>reject(tx.error??new Error('Gaming write failed'));
      const read=store.get(id);
      read.onsuccess=()=>{
        const current=(read.result as GamingRecord<T>|undefined)?.revision??0;
        if(current!==expectedRevision){tx.abort();return;}
        next={key:id,revision:current+1,payload:copy(payload)};
        store.put(next);
      };
    });
  }
  async delete(id:string,expectedRevision:number):Promise<void>{
    validateKey(id);validateRevision(expectedRevision);
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(tx.error??new Error('Gaming delete failed or conflicted'));
      tx.onerror=()=>reject(tx.error??new Error('Gaming delete failed'));
      const read=store.get(id);
      read.onsuccess=()=>{
        const current=(read.result as GamingRecord<unknown>|undefined)?.revision??0;
        if(current!==expectedRevision){tx.abort();return;}
        store.delete(id);
      };
    });
  }
}

export class DurableGameLibrary implements GameLibraryRepository{
  constructor(private readonly storage:GamingRecordStore){}
  async save(game:GameLibraryEntry):Promise<void>{
    if(!game.id.trim()||!game.title.trim()||!game.contentUri.trim())throw new Error('Incomplete game library entry');
    const id=key('library',game.id);
    const existing=await this.storage.read<GameLibraryEntry>(id);
    await this.storage.write(id,game,existing?.revision??0);
  }
  async get(gameId:string):Promise<GameLibraryEntry|undefined>{
    return (await this.storage.read<GameLibraryEntry>(key('library',gameId)))?.payload;
  }
  async list(platform?:GamePlatform):Promise<readonly GameLibraryEntry[]>{
    return (await this.storage.scan<GameLibraryEntry>(prefix('library'))).map(x=>x.payload)
      .filter(g=>!platform||g.platform===platform);
  }
  async remove(gameId:string):Promise<void>{
    const id=key('library',gameId),prior=await this.storage.read(id);
    if(prior)await this.storage.delete(id,prior.revision);
  }
}

/** Uses the coordinator's revision contract; rejects stale writes across tabs. */
export class DurableGamingSaveStore implements GamingSaveStore{
  constructor(private readonly storage:GamingRecordStore){}
  async get(saveId:string):Promise<ManagedGamingSave|undefined>{
    return (await this.storage.read<ManagedGamingSave>(key('save',saveId)))?.payload;
  }
  async list(gameId:string,ownerId:string):Promise<readonly ManagedGamingSave[]>{
    return (await this.storage.scan<ManagedGamingSave>(prefix('save'))).map(x=>x.payload)
      .filter(s=>s.gameId===gameId&&s.ownerId===ownerId);
  }
  async put(save:ManagedGamingSave):Promise<void>{
    if(!save.saveId.trim()||!save.gameId.trim()||!save.ownerId.trim()||!save.uri.trim())
      throw new Error('Incomplete gaming save');
    validateRevision(save.revision-1);
    await this.storage.write(key('save',save.saveId),save,save.revision-1);
  }
}

export interface StoredGamingSession{
  sessionId:string;gameId:string;runtimeId:string;startedAtMs:number;
  finishedAtMs:number;status:'stopped'|'failed';saveId?:string;
}
export class DurableGamingHistory{
  constructor(private readonly storage:GamingRecordStore){}
  async append(session:StoredGamingSession):Promise<void>{
    if(!session.sessionId.trim()||!session.gameId.trim()||!Number.isFinite(session.startedAtMs)
       ||!Number.isFinite(session.finishedAtMs)||session.finishedAtMs<session.startedAtMs)
      throw new Error('Invalid gaming session history');
    await this.storage.write(key('session',session.sessionId),session,0);
  }
  async forGame(gameId:string):Promise<readonly StoredGamingSession[]>{
    return (await this.storage.scan<StoredGamingSession>(prefix('session'))).map(x=>x.payload)
      .filter(x=>x.gameId===gameId).sort((a,b)=>a.startedAtMs-b.startedAtMs);
  }
}

export class DurableGamingObservations{
  constructor(private readonly storage:GamingRecordStore){}
  async record(item:GamingObservation):Promise<void>{
    if(!item.observationId.trim()||!item.gameId.trim()||!item.sessionId.trim()||!item.summary.trim()
      ||!Number.isFinite(item.observedAtMs))throw new Error('Invalid gaming observation');
    await this.storage.write(key('observation',item.observationId),item,0);
  }
  async forGame(gameId:string):Promise<readonly GamingObservation[]>{
    return (await this.storage.scan<GamingObservation>(prefix('observation'))).map(x=>x.payload)
      .filter(x=>x.gameId===gameId).sort((a,b)=>a.observedAtMs-b.observedAtMs);
  }
}

export class DurableGamingRoutes{
  constructor(private readonly storage:GamingRecordStore){}
  async record(observationId:string,row:GamingRouteObservation):Promise<void>{
    if(!row.measured||!row.gameId.trim()||![row.inputLatencyMs,row.frameTimeMs].every(n=>Number.isFinite(n)&&n>=0))
      throw new Error('Gaming route observation requires genuine nonnegative measurements');
    await this.storage.write(key('route',observationId),row,0);
  }
  async forGame(gameId:string):Promise<readonly GamingRouteObservation[]>{
    return (await this.storage.scan<GamingRouteObservation>(prefix('route'))).map(x=>x.payload)
      .filter(x=>x.gameId===gameId);
  }
}
