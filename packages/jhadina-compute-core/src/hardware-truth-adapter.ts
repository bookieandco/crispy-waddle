import type {
  AcceleratorInventory,
  AcceleratorVendor,
  ComputeNode,
  ComputeProvider,
  NetworkFabricInventory,
  ComputeNetworkFabric,
} from './resource-contract.js';

export type HardwareTruthSeverity='ok'|'info'|'warning'|'critical'|'unknown';
export type HardwareTruthConfidence='high'|'medium'|'low';

export type HardwareTruthComponent={
  id:string;
  category:string;
  name:string;
  status:HardwareTruthSeverity;
  confidence:HardwareTruthConfidence;
  evidence:Record<string,unknown>;
  signals?:readonly string[];
  recommendations?:readonly string[];
};

export type HardwareTruthDiagnostic={
  name:string;
  status:'passed'|'warning'|'critical'|'limited'|'not_run'|'unavailable';
  evidence:string;
  nextStep:string;
};

export type HardwareTruthScanReport={
  scanner:string;
  generatedAt:string;
  host:string;
  os:string;
  summary?:{
    overallStatus?:HardwareTruthSeverity;
    criticalCount?:number;
    warningCount?:number;
    unknownCount?:number;
  };
  components:readonly HardwareTruthComponent[];
  diagnostics?:readonly HardwareTruthDiagnostic[];
  coverageLimits?:readonly string[];
};

export type HardwareTruthFabricMapping={
  fabric:ComputeNetworkFabric;
  adapterNameIncludes:string;
};

export type HardwareTruthNodeConfig={
  nodeId:string;
  provider:ComputeProvider;
  zone:string;
  maxEvidenceAgeMs:number;
  scratchGiBFree:number;
  reservedCpuCores?:number;
  labels?:Record<string,string>;
  fabricMappings?:readonly HardwareTruthFabricMapping[];
};

export type HardwareTruthNodeEvidence={
  node:ComputeNode;
  observedAt:string;
  freshUntil:string;
  confidence:'high'|'medium'|'low';
  coverageLimits:readonly string[];
  diagnostics:readonly HardwareTruthDiagnostic[];
  source:string;
};

function asNumber(value:unknown):number|undefined{
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value==='string'&&value.trim()&&Number.isFinite(Number(value)))return Number(value);
  return undefined;
}

function findEvidenceNumber(
  components:readonly HardwareTruthComponent[],
  keys:readonly string[],
  predicate?:(component:HardwareTruthComponent)=>boolean,
):number|undefined{
  for(const component of components){
    if(predicate&&!predicate(component))continue;
    for(const key of keys){
      const value=asNumber(component.evidence[key]);
      if(value!==undefined)return value;
    }
  }
  return undefined;
}

function componentBad(component:HardwareTruthComponent):boolean{
  return component.status==='critical';
}

function vendorForName(name:string):AcceleratorVendor{
  const normalized=name.toLowerCase();
  if(normalized.includes('nvidia'))return 'nvidia';
  if(normalized.includes('radeon')||normalized.includes('amd'))return 'amd';
  if(normalized.includes('apple'))return 'apple';
  return 'cpu';
}

function gpuInventory(components:readonly HardwareTruthComponent[]):AcceleratorInventory[]{
  const rows:AcceleratorInventory[]=[];
  for(const component of components){
    const category=component.category.toLowerCase();
    const name=component.name.toLowerCase();
    if(componentBad(component))continue;
    if(!category.includes('gpu')&&!category.includes('display')&&!name.includes('nvidia')&&!name.includes('radeon'))continue;
    const total=
      asNumber(component.evidence.NvidiaMemoryTotalGB) ??
      asNumber(component.evidence.MemoryTotalGB) ??
      asNumber(component.evidence.WmiAdapterRamGB);
    if(total===undefined||total<=0)continue;
    const free=
      asNumber(component.evidence.NvidiaMemoryFreeGB) ??
      asNumber(component.evidence.MemoryFreeGB);
    const utilization=
      asNumber(component.evidence.NvidiaUtilizationPercent) ??
      asNumber(component.evidence.UtilizationPercent);
    const temperature=
      asNumber(component.evidence.NvidiaTemperatureC) ??
      asNumber(component.evidence.TemperatureC);
    const vendor=vendorForName(component.name);
    if(vendor==='cpu')continue;
    rows.push({
      vendor,
      model:component.name,
      count:1,
      vramGiBPerDevice:total,
      vramGiBFreePerDevice:free,
      utilizationPercent:utilization,
      temperatureC:temperature,
      features:[],
    });
  }
  return rows;
}

function networkFabrics(
  components:readonly HardwareTruthComponent[],
  mappings:readonly HardwareTruthFabricMapping[],
):NetworkFabricInventory[]{
  const rows:NetworkFabricInventory[]=[];
  for(const mapping of mappings){
    const match=components.find(component=>{
      if(component.category.toLowerCase()!=='network')return false;
      return component.name.toLowerCase().includes(mapping.adapterNameIncludes.toLowerCase());
    });
    if(!match||componentBad(match)){
      rows.push({fabric:mapping.fabric,bandwidthMbpsAvailable:0,status:'offline'});
      continue;
    }
    const speed=asNumber(match.evidence.SpeedMbps)??0;
    rows.push({
      fabric:mapping.fabric,
      bandwidthMbpsAvailable:speed,
      status:match.status==='warning'||match.status==='unknown'?'degraded':'ready',
    });
  }
  return rows;
}

function confidenceFor(report:HardwareTruthScanReport):'high'|'medium'|'low'{
  if(report.summary?.overallStatus==='critical')return 'low';
  const limited=(report.diagnostics??[]).filter(item=>
    item.status==='limited'||item.status==='not_run'||item.status==='unavailable'
  ).length;
  if(limited>0||report.summary?.overallStatus==='unknown')return 'medium';
  return 'high';
}

export function computeNodeFromHardwareTruth(
  report:HardwareTruthScanReport,
  config:HardwareTruthNodeConfig,
  nowIso:string,
):HardwareTruthNodeEvidence{
  const observedAt=Date.parse(report.generatedAt);
  const now=Date.parse(nowIso);
  if(!Number.isFinite(observedAt)||!Number.isFinite(now))throw new Error('HARDWARE_TRUTH_TIME_INVALID');
  if(!Number.isFinite(config.maxEvidenceAgeMs)||config.maxEvidenceAgeMs<=0)throw new Error('HARDWARE_TRUTH_MAX_AGE_INVALID');
  if(!Number.isFinite(config.scratchGiBFree)||config.scratchGiBFree<0)throw new Error('HARDWARE_TRUTH_SCRATCH_INVALID');

  const cpu=findEvidenceNumber(
    report.components,
    ['LogicalProcessors','TotalLogicalProcessors'],
    component=>component.category.toLowerCase().includes('cpu'),
  );
  const ramMb=findEvidenceNumber(report.components,['AvailableMemoryMB']);
  if(cpu===undefined||cpu<=0)throw new Error('HARDWARE_TRUTH_CPU_EVIDENCE_REQUIRED');
  if(ramMb===undefined||ramMb<0)throw new Error('HARDWARE_TRUTH_RAM_EVIDENCE_REQUIRED');

  const ageMs=now-observedAt;
  const stale=ageMs<0||ageMs>config.maxEvidenceAgeMs;
  const critical=report.summary?.overallStatus==='critical'||report.components.some(componentBad);
  const warning=report.summary?.overallStatus==='warning'||report.components.some(component=>component.status==='warning');
  const accelerators=gpuInventory(report.components);
  const fabrics=networkFabrics(report.components,config.fabricMappings??[]);
  const bestNetwork=fabrics
    .filter(fabric=>fabric.status!=='offline')
    .reduce((best,fabric)=>Math.max(best,fabric.bandwidthMbpsAvailable),0);

  const reserved=Math.max(config.reservedCpuCores??0,0);
  const node:ComputeNode={
    id:config.nodeId,
    provider:config.provider,
    zone:config.zone,
    status:stale||critical?'offline':warning?'draining':'ready',
    cpuCoresFree:Math.max(cpu-reserved,0),
    ramGiBFree:Number((ramMb/1024).toFixed(3)),
    scratchGiBFree:config.scratchGiBFree,
    networkMbpsAvailable:bestNetwork||undefined,
    networkFabrics:fabrics.length?fabrics:undefined,
    accelerators,
    localityKeys:[],
    labels:{
      ...(config.labels??{}),
      'jhadina.ai/hardware-evidence':'hardware-truth-scanner',
      'jhadina.ai/hardware-observed-at':report.generatedAt,
    },
  };

  return {
    node,
    observedAt:report.generatedAt,
    freshUntil:new Date(observedAt+config.maxEvidenceAgeMs).toISOString(),
    confidence:confidenceFor(report),
    coverageLimits:Object.freeze([...(report.coverageLimits??[])]),
    diagnostics:Object.freeze([...(report.diagnostics??[])]),
    source:report.scanner,
  };
}
