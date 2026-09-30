import type { ComputeNode } from './resource-contract.js';

export type ComputeNodeEvidenceRecord={
  node:ComputeNode;
  sourceRef:string;
  observedAt:string;
  expiresAt:string;
  recordedAt:string;
};

export function validateNodeEvidenceRecord(
  record:ComputeNodeEvidenceRecord,
  nowIso:string,
):readonly string[]{
  const reasons:string[]=[];
  const now=Date.parse(nowIso);
  const observed=Date.parse(record.observedAt);
  const expires=Date.parse(record.expiresAt);
  if(!record.node.id.trim())reasons.push('NODE_EVIDENCE_NODE_REQUIRED');
  if(!record.sourceRef.trim())reasons.push('NODE_EVIDENCE_SOURCE_REQUIRED');
  if(!Number.isFinite(now)||!Number.isFinite(observed)||!Number.isFinite(expires)){
    reasons.push('NODE_EVIDENCE_TIME_INVALID');
  }else{
    if(observed>now)reasons.push('NODE_EVIDENCE_FROM_FUTURE');
    if(expires<=observed)reasons.push('NODE_EVIDENCE_WINDOW_INVALID');
  }
  if(record.node.evidenceObservedAt&&record.node.evidenceObservedAt!==record.observedAt){
    reasons.push('NODE_EVIDENCE_OBSERVED_AT_MISMATCH');
  }
  if(record.node.evidenceExpiresAt&&record.node.evidenceExpiresAt!==record.expiresAt){
    reasons.push('NODE_EVIDENCE_EXPIRES_AT_MISMATCH');
  }
  return Object.freeze([...new Set(reasons)]);
}

export class InMemoryComputeNodeInventory{
  private readonly records=new Map<string,ComputeNodeEvidenceRecord>();

  upsert(record:ComputeNodeEvidenceRecord,nowIso:string):void{
    const reasons=validateNodeEvidenceRecord(record,nowIso);
    if(reasons.length)throw new Error(`NODE_EVIDENCE_INVALID:${reasons.join(',')}`);
    const current=this.records.get(record.node.id);
    if(current&&Date.parse(record.observedAt)<Date.parse(current.observedAt)){
      throw new Error('NODE_EVIDENCE_STALE_WRITE');
    }
    this.records.set(record.node.id,Object.freeze({
      ...record,
      node:Object.freeze({
        ...record.node,
        accelerators:record.node.accelerators.map(accelerator=>({...accelerator})),
      }),
    }));
  }

  listFresh(nowIso:string):readonly ComputeNode[]{
    const now=Date.parse(nowIso);
    if(!Number.isFinite(now))throw new Error('NODE_INVENTORY_TIME_INVALID');
    return Object.freeze(
      [...this.records.values()]
        .filter(record=>Date.parse(record.expiresAt)>now)
        .map(record=>record.node)
        .sort((a,b)=>a.id.localeCompare(b.id)),
    );
  }

  listEvidence():readonly ComputeNodeEvidenceRecord[]{
    return Object.freeze([...this.records.values()].sort((a,b)=>a.node.id.localeCompare(b.node.id)));
  }
}
