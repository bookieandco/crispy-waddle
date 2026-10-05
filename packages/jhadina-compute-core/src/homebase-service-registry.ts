export type HomebaseServiceRole=
  |'database'|'object-storage'|'queue'|'cache'|'api'|'scheduler'|'worker'|'backup'|'observability';

export type HomebaseServiceRecord={
  id:string;
  role:HomebaseServiceRole;
  endpoint:string;
  health:'ready'|'degraded'|'offline';
  canonical:boolean;
  local:boolean;
  dependencies:readonly string[];
};

export class HomebaseServiceRegistry{
  readonly #services=new Map<string,HomebaseServiceRecord>();

  register(service:HomebaseServiceRecord):void{
    if(!service.id.trim())throw new Error('HOMEBASE_SERVICE_ID_REQUIRED');
    if(this.#services.has(service.id))throw new Error('HOMEBASE_SERVICE_DUPLICATE:'+service.id);
    if(service.canonical&&!service.local)throw new Error('HOMEBASE_CANONICAL_SERVICE_MUST_BE_LOCAL');
    this.#services.set(service.id,Object.freeze({...service,dependencies:[...service.dependencies]}));
  }

  get(id:string):HomebaseServiceRecord|undefined{return this.#services.get(id);}

  list():readonly HomebaseServiceRecord[]{
    return Object.freeze([...this.#services.values()].sort((a,b)=>a.id.localeCompare(b.id)));
  }

  validate(requiredRoles:readonly HomebaseServiceRole[]=['database','object-storage','queue','backup']):readonly string[]{
    const r:string[]=[];
    const all=this.list();
    for(const role of requiredRoles){
      const matches=all.filter(s=>s.role===role&&s.canonical&&s.local);
      if(matches.length!==1)r.push('HOMEBASE_CANONICAL_ROLE_COUNT_INVALID:'+role);
      if(matches[0]&&matches[0].health!=='ready')r.push('HOMEBASE_CANONICAL_ROLE_NOT_READY:'+role);
    }
    for(const service of all){
      for(const dep of service.dependencies){
        if(!this.#services.has(dep))r.push('HOMEBASE_SERVICE_DEPENDENCY_MISSING:'+service.id+':'+dep);
      }
    }
    return Object.freeze([...new Set(r)]);
  }

  startupOrder():readonly string[]{
    const pending=new Map(this.list().map(s=>[s.id,s]));
    const ready:string[]=[];
    while(pending.size){
      const candidates=[...pending.values()]
        .filter(s=>s.dependencies.every(d=>ready.includes(d)))
        .sort((a,b)=>a.id.localeCompare(b.id));
      if(!candidates.length)throw new Error('HOMEBASE_SERVICE_DEPENDENCY_CYCLE');
      for(const c of candidates){ready.push(c.id);pending.delete(c.id);}
    }
    return Object.freeze(ready);
  }
}
