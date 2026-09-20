import type { DecisionProposal, EvidenceRef } from '@jhadina/core-spine';
import type { CompiledIntelligenceContext, IntelligenceProposalVerifier } from './intelligence-fabric.js';
export class EvidenceVerificationError extends Error { constructor(public readonly reason:string, public readonly detail?:string){super(`EVIDENCE_VERIFICATION_FAILED:${reason}${detail?':'+detail:''}`);this.name='EvidenceVerificationError';} }
export class EvidenceBoundProposalVerifier implements IntelligenceProposalVerifier {
 constructor(private readonly options:{unknownEvidenceBehavior?:'reject'|'defer'}={}){}
 async verify(proposal:DecisionProposal,context:CompiledIntelligenceContext):Promise<DecisionProposal>{
  if(proposal.contextId!==context.packet.id) throw new EvidenceVerificationError('context_mismatch',proposal.contextId);
  const canonical=indexEvidence(context);
  const unknown=proposal.evidence.map(r=>r.id).filter(id=>!canonical.has(id));
  if(unknown.length){
   const ids=[...new Set(unknown)].sort();
   if((this.options.unknownEvidenceBehavior??'reject')==='defer') return Object.freeze({...proposal,disposition:'DEFER',evidence:proposal.evidence.filter(r=>canonical.has(r.id)).map(r=>canonical.get(r.id)!),uncertainty:[...proposal.uncertainty,`Unverified evidence references: ${ids.join(', ')}`]});
   throw new EvidenceVerificationError('unknown_evidence',ids.join(','));
  }
  return Object.freeze({...proposal,evidence:proposal.evidence.map(r=>canonical.get(r.id)!),uncertainty:[...proposal.uncertainty],alternatives:[...proposal.alternatives]});
 }
}
function indexEvidence(context:CompiledIntelligenceContext):Map<string,EvidenceRef>{
 const map=new Map<string,EvidenceRef>(); const add=(refs:readonly EvidenceRef[])=>refs.forEach(ref=>{if(context.evidenceIds.includes(ref.id))map.set(ref.id,Object.freeze({...ref}));});
 const p=context.packet; add(p.relevantMemories);add(p.knowledge);for(const x of p.patterns){add(x.evidence);add(x.contradictions)}for(const x of p.personality.traits){add(x.evidence);add(x.contradictions)}
 const s=p.domainContext?.spatial;if(s){add(s.observations);add(s.evidence);add(s.claims);add(s.reality);add(s.attention);add(s.provenance)}return map;
}