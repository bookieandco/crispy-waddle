export type ComputeTelemetrySample={
  observedAt:string;
  workloadId:string;
  nodeId:string;
  queueWaitMs?:number;
  runtimeMs?:number;
  gpuUtilizationPercent?:number;
  gpuVramUsedGiB?:number;
  gpuVramTotalGiB?:number;
  cpuUtilizationPercent?:number;
  ramUsedGiB?:number;
  cacheHitBytes?:number;
  cacheMissBytes?:number;
  modelLoadMs?:number;
  durableReadBytes?:number;
  durableWriteBytes?:number;
  checkpointLocalWriteMs?:number;
  checkpointDurableFlushMs?:number;
  estimatedCostUsd?:number;
};

export type ComputeTelemetrySummary={
  workloadId:string;
  sampleCount:number;
  maxGpuUtilizationPercent?:number;
  maxGpuVramUsedGiB?:number;
  averageQueueWaitMs?:number;
  averageRuntimeMs?:number;
  cacheHitRate?:number;
  totalDurableReadBytes:number;
  totalDurableWriteBytes:number;
  estimatedCostUsd:number;
};

function average(values:number[]):number|undefined{
  if(values.length===0)return undefined;
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}

export function summarizeComputeTelemetry(
  workloadId:string,
  samples:readonly ComputeTelemetrySample[],
):ComputeTelemetrySummary{
  const scoped=samples.filter(sample=>sample.workloadId===workloadId);
  const hits=scoped.reduce((sum,sample)=>sum+(sample.cacheHitBytes??0),0);
  const misses=scoped.reduce((sum,sample)=>sum+(sample.cacheMissBytes??0),0);
  const totalCache=hits+misses;
  const queue=average(scoped.flatMap(sample=>sample.queueWaitMs===undefined?[]:[sample.queueWaitMs]));
  const runtime=average(scoped.flatMap(sample=>sample.runtimeMs===undefined?[]:[sample.runtimeMs]));
  const gpuUtils=scoped.flatMap(sample=>sample.gpuUtilizationPercent===undefined?[]:[sample.gpuUtilizationPercent]);
  const vram=scoped.flatMap(sample=>sample.gpuVramUsedGiB===undefined?[]:[sample.gpuVramUsedGiB]);
  return {
    workloadId,
    sampleCount:scoped.length,
    maxGpuUtilizationPercent:gpuUtils.length?Math.max(...gpuUtils):undefined,
    maxGpuVramUsedGiB:vram.length?Math.max(...vram):undefined,
    averageQueueWaitMs:queue===undefined?undefined:Number(queue.toFixed(3)),
    averageRuntimeMs:runtime===undefined?undefined:Number(runtime.toFixed(3)),
    cacheHitRate:totalCache?Number((hits/totalCache).toFixed(6)):undefined,
    totalDurableReadBytes:scoped.reduce((sum,sample)=>sum+(sample.durableReadBytes??0),0),
    totalDurableWriteBytes:scoped.reduce((sum,sample)=>sum+(sample.durableWriteBytes??0),0),
    estimatedCostUsd:Number(scoped.reduce((sum,sample)=>sum+(sample.estimatedCostUsd??0),0).toFixed(6)),
  };
}

export type ComputeSloThresholds={
  interactiveQueueWaitMs:number;
  creativeQueueWaitMs:number;
  renderQueueWaitMs:number;
  minCacheHitRate?:number;
  maxModelLoadMs?:number;
};

export type ComputeSloEvaluation={
  pass:boolean;
  reasons:readonly string[];
};

export function evaluateComputeSlo(
  queue:'interactive'|'creative'|'render'|'background'|'maintenance',
  summary:ComputeTelemetrySummary,
  thresholds:ComputeSloThresholds,
):ComputeSloEvaluation{
  const reasons:string[]=[];
  const queueLimit=
    queue==='interactive'?thresholds.interactiveQueueWaitMs:
    queue==='creative'?thresholds.creativeQueueWaitMs:
    queue==='render'?thresholds.renderQueueWaitMs:
    undefined;
  if(queueLimit!==undefined&&summary.averageQueueWaitMs!==undefined&&summary.averageQueueWaitMs>queueLimit){
    reasons.push('COMPUTE_QUEUE_WAIT_SLO_EXCEEDED');
  }
  if(
    thresholds.minCacheHitRate!==undefined&&
    summary.cacheHitRate!==undefined&&
    summary.cacheHitRate<thresholds.minCacheHitRate
  )reasons.push('COMPUTE_CACHE_HIT_SLO_MISSED');
  return {pass:reasons.length===0,reasons:Object.freeze(reasons)};
}
