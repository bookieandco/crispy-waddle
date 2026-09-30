import { planPlacement } from './placement-planner.js';
import type { AcceleratorInventory, ComputeNode, ComputeWorkload } from './resource-contract.js';

export type BatchAdmission={
  workloadId:string;
  admitted:boolean;
  nodeId?:string;
  reasons:readonly string[];
};

export type BatchAdmissionPlan={
  admissions:readonly BatchAdmission[];
  remainingNodes:readonly ComputeNode[];
};

function cloneAccelerator(accelerator:AcceleratorInventory):AcceleratorInventory{
  return {
    ...accelerator,
    features:accelerator.features?[...accelerator.features]:undefined,
  };
}

function cloneNode(node:ComputeNode):ComputeNode{
  return {
    ...node,
    accelerators:node.accelerators.map(cloneAccelerator),
    networkFabrics:node.networkFabrics?.map(fabric=>({...fabric})),
    localityKeys:node.localityKeys?[...node.localityKeys]:undefined,
    labels:node.labels?{...node.labels}:undefined,
  };
}

function consumeGpu(node:ComputeNode,workload:ComputeWorkload):void{
  const request=workload.resources.gpu;
  if(!request)return;
  let remaining=request.count;
  for(const accelerator of node.accelerators){
    if(remaining<=0)break;
    if(accelerator.vendor==='cpu')continue;
    if(request.vendor&&accelerator.vendor!==request.vendor)continue;
    const available=accelerator.count;
    if(available<=0)continue;
    const take=Math.min(remaining,available);
    accelerator.count-=take;
    remaining-=take;
  }
}

function consumeNode(node:ComputeNode,workload:ComputeWorkload):void{
  node.cpuCoresFree=Math.max(0,node.cpuCoresFree-workload.resources.cpuCores);
  node.ramGiBFree=Math.max(0,node.ramGiBFree-workload.resources.ramGiB);
  node.scratchGiBFree=Math.max(0,node.scratchGiBFree-workload.resources.scratchGiB);
  if(workload.resources.networkMbps!==undefined){
    if(workload.resources.networkFabric&&node.networkFabrics){
      const fabric=node.networkFabrics.find(item=>item.fabric===workload.resources.networkFabric);
      if(fabric)fabric.bandwidthMbpsAvailable=Math.max(0,fabric.bandwidthMbpsAvailable-workload.resources.networkMbps);
    }else if(node.networkMbpsAvailable!==undefined){
      node.networkMbpsAvailable=Math.max(0,node.networkMbpsAvailable-workload.resources.networkMbps);
    }
  }
  consumeGpu(node,workload);
}

export function planBatchAdmission(
  nodes:readonly ComputeNode[],
  workloads:readonly ComputeWorkload[],
):BatchAdmissionPlan{
  const mutable=nodes.map(cloneNode);
  const ordered=[...workloads].sort((a,b)=>{
    if(b.priority!==a.priority)return b.priority-a.priority;
    const byCreated=a.createdAt.localeCompare(b.createdAt);
    return byCreated!==0?byCreated:a.id.localeCompare(b.id);
  });
  const admissions:BatchAdmission[]=[];
  for(const workload of ordered){
    const placement=planPlacement(mutable,workload);
    if(!placement.selectedNodeId){
      const reasons=placement.rejected.flatMap(item=>item.codes);
      admissions.push({
        workloadId:workload.id,
        admitted:false,
        reasons:Object.freeze([...new Set(reasons)]),
      });
      continue;
    }
    const node=mutable.find(candidate=>candidate.id===placement.selectedNodeId);
    if(!node)throw new Error('BATCH_ADMISSION_SELECTED_NODE_MISSING');
    consumeNode(node,workload);
    admissions.push({
      workloadId:workload.id,
      admitted:true,
      nodeId:node.id,
      reasons:Object.freeze(placement.candidates[0]?.reasons??[]),
    });
  }
  return {
    admissions:Object.freeze(admissions),
    remainingNodes:Object.freeze(mutable.map(cloneNode)),
  };
}
