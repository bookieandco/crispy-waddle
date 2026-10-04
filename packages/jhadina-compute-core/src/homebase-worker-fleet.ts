export type HomebaseWorkerLane='research'|'gpu';

export type HomebaseWorkerProfile={
  id:string;
  lane:HomebaseWorkerLane;
  provider:'homebase'|'runpod';
  capabilities:readonly string[];
  disposable:boolean;
  canonicalWriteAllowed:false;
  defaultForLane:boolean;
};

export function createHomebaseWorkerFleet():readonly HomebaseWorkerProfile[]{
  return Object.freeze([
    {
      id:'runpod-research-cpu',lane:'research',provider:'runpod',
      capabilities:['crawl','pdf','ocr','document-analysis','entity-resolution','bulk-classification'],
      disposable:true,canonicalWriteAllowed:false,defaultForLane:true,
    },
    {
      id:'runpod-gpu-burst',lane:'gpu',provider:'runpod',
      capabilities:['vision','transcription','embedding','llm-batch','image','video','audio','training'],
      disposable:true,canonicalWriteAllowed:false,defaultForLane:true,
    },
    {
      id:'homebase-local-worker',lane:'research',provider:'homebase',
      capabilities:['local-research','private-data','small-batch','scheduler'],
      disposable:false,canonicalWriteAllowed:false,defaultForLane:false,
    },
    {
      id:'homebase-gpu-worker',lane:'gpu',provider:'homebase',
      capabilities:['private-gpu','interactive-inference','local-models'],
      disposable:false,canonicalWriteAllowed:false,defaultForLane:false,
    },
  ]);
}

export function validateWorkerFleet(fleet:readonly HomebaseWorkerProfile[]):readonly string[]{
  const r:string[]=[];
  const ids=new Set<string>();
  for(const worker of fleet){
    if(ids.has(worker.id))r.push('HOMEBASE_WORKER_DUPLICATE:'+worker.id);
    ids.add(worker.id);
    if(worker.canonicalWriteAllowed!==false)r.push('HOMEBASE_WORKER_CANONICAL_WRITE_FORBIDDEN:'+worker.id);
    if(worker.provider==='runpod'&&!worker.disposable)r.push('RUNPOD_WORKER_MUST_BE_DISPOSABLE:'+worker.id);
  }
  for(const lane of ['research','gpu'] as const){
    if(fleet.filter(w=>w.lane===lane&&w.defaultForLane).length!==1)r.push('HOMEBASE_WORKER_DEFAULT_INVALID:'+lane);
  }
  return Object.freeze([...new Set(r)]);
}
