import type { JhadinaWorkSession, WorkSessionRepository } from '@jhadina/core-spine';

export interface WorkSessionStorage {
  get<T>(key:string):Promise<T|null>;
  set<T>(key:string,value:T):Promise<void>;
}

/**
 * Durable adapter over Jhadina's canonical storage boundary.
 * Ownership is checked on every read/write; session state never grants execution authority.
 */
export class StorageWorkSessionRepository implements WorkSessionRepository {
  constructor(private readonly storage:WorkSessionStorage,private readonly ownerUserId:string){}

  async get(id:string):Promise<JhadinaWorkSession|null>{
    const session=await this.storage.get<JhadinaWorkSession>(this.key(id));
    if(!session)return null;
    if(session.ownerUserId!==this.ownerUserId)throw new Error('WORK_SESSION_OWNER_MISMATCH');
    return session;
  }

  async save(session:JhadinaWorkSession):Promise<void>{
    if(session.ownerUserId!==this.ownerUserId)throw new Error('WORK_SESSION_OWNER_MISMATCH');
    await this.storage.set(this.key(session.id),session);
  }

  private key(id:string){return `jhadina:work-session:${this.ownerUserId}:${id}`;}
}
