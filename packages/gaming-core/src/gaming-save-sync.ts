import type {SaveKind} from './save.js';

export interface ManagedGamingSave {
  saveId:string;
  gameId:string;
  ownerId:string;
  runtimeId:string;
  kind:SaveKind|'remote-session';
  uri:string;
  slot?:number;
  revision:number;
  updatedAtMs:number;
  sourceSessionId?:string;
}

export interface GamingSaveStore {
  get(saveId:string):Promise<ManagedGamingSave|undefined>;
  list(gameId:string,ownerId:string):Promise<readonly ManagedGamingSave[]>;
  put(save:ManagedGamingSave):Promise<void>;
}

export class InMemoryGamingSaveStore implements GamingSaveStore {
  private readonly saves=new Map<string,ManagedGamingSave>();
  async get(saveId:string):Promise<ManagedGamingSave|undefined>{const save=this.saves.get(saveId);return save?{...save}:undefined;}
  async list(gameId:string,ownerId:string):Promise<readonly ManagedGamingSave[]>{
    return [...this.saves.values()].filter(save=>save.gameId===gameId&&save.ownerId===ownerId).map(save=>({...save}));
  }
  async put(save:ManagedGamingSave):Promise<void>{this.saves.set(save.saveId,Object.freeze({...save}));}
}

export interface WriteGamingSaveRequest {
  saveId:string;
  gameId:string;
  ownerId:string;
  runtimeId:string;
  kind:ManagedGamingSave['kind'];
  uri:string;
  slot?:number;
  sourceSessionId?:string;
  expectedRevision:number;
  nowMs?:number;
}

export class GamingSaveCoordinator {
  constructor(private readonly store:GamingSaveStore){}

  async write(request:WriteGamingSaveRequest):Promise<ManagedGamingSave>{
    this.requireId(request.saveId,'saveId');
    this.requireId(request.gameId,'gameId');
    this.requireId(request.ownerId,'ownerId');
    this.requireId(request.runtimeId,'runtimeId');
    this.requireId(request.uri,'uri');
    if(!Number.isInteger(request.expectedRevision)||request.expectedRevision<0)throw new Error('expectedRevision must be a non-negative integer');
    const existing=await this.store.get(request.saveId);
    const actualRevision=existing?.revision??0;
    if(actualRevision!==request.expectedRevision){
      throw new Error(`Save conflict: expected revision ${request.expectedRevision}, current revision ${actualRevision}`);
    }
    if(existing&&(existing.gameId!==request.gameId||existing.ownerId!==request.ownerId)){
      throw new Error('Save ownership cannot change');
    }
    const nowMs=request.nowMs??Date.now();
    if(!Number.isFinite(nowMs))throw new Error('nowMs must be finite');
    if(existing&&nowMs<existing.updatedAtMs)throw new Error('Save timestamp would move backwards');
    const save:ManagedGamingSave={
      saveId:request.saveId,
      gameId:request.gameId,
      ownerId:request.ownerId,
      runtimeId:request.runtimeId,
      kind:request.kind,
      uri:request.uri,
      slot:request.slot,
      revision:actualRevision+1,
      updatedAtMs:nowMs,
      sourceSessionId:request.sourceSessionId,
    };
    await this.store.put(save);
    return{...save};
  }

  async latest(gameId:string,ownerId:string,kind?:ManagedGamingSave['kind']):Promise<ManagedGamingSave|undefined>{
    const saves=await this.store.list(gameId,ownerId);
    return [...saves].filter(save=>!kind||save.kind===kind).sort((a,b)=>b.updatedAtMs-a.updatedAtMs||b.revision-a.revision)[0];
  }

  private requireId(value:string,label:string):void{if(!value.trim())throw new Error(`${label} is required`);}
}
