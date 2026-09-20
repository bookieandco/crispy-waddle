export interface CanonicalKnowledgeEntity {
  nodeId:string; nodeType:string; label:string; ownerId?:string; scope:string; canonicalKey?:string;
  aliases:string[]; externalIds:Record<string,string>; confidence:number; verificationState:string;
  provenanceRefs:string[]; validFrom?:string; validTo?:string; supersededBy?:string;
}
export interface CanonicalKnowledgeRelation {
  relationId:string; fromNodeId:string; toNodeId:string; relationType:string; ownerId?:string; scope:string;
  confidence:number; verificationState:string; provenanceRefs:string[]; validFrom?:string; validTo?:string; supersededBy?:string;
}
export type EntityResolution = {kind:"resolved";entity:CanonicalKnowledgeEntity}|{kind:"ambiguous";candidates:CanonicalKnowledgeEntity[]}|{kind:"missing"}
export function canonicalEntityKey(type:string,label:string){return `${type.trim().toLowerCase()}:${label.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}`}
export function resolveEntity(label:string,type:string,candidates:CanonicalKnowledgeEntity[],threshold=.82):EntityResolution{
 const norm=(x:string)=>x.toLowerCase().replace(/[^a-z0-9]/g,""); const target=norm(label)
 const scored=candidates.filter(x=>x.nodeType===type&&!x.supersededBy).map(entity=>{const labels=[entity.label,...entity.aliases].map(norm);const score=labels.includes(target)?1:labels.some(x=>x.includes(target)||target.includes(x))?.86:0;return {entity,score}}).filter(x=>x.score>=threshold).sort((a,b)=>b.score-a.score||b.entity.confidence-a.entity.confidence||a.entity.nodeId.localeCompare(b.entity.nodeId))
 if(!scored.length)return {kind:"missing"}; if(scored.length>1&&scored[0].score===scored[1].score)return {kind:"ambiguous",candidates:scored.map(x=>x.entity)};return {kind:"resolved",entity:scored[0].entity}
}
export function relationAdmissible(r:CanonicalKnowledgeRelation,asOf=new Date().toISOString()){
 const t=Date.parse(asOf);return !r.supersededBy&&r.provenanceRefs.length>0&&r.verificationState==="verified"&&(!r.validFrom||Date.parse(r.validFrom)<=t)&&(!r.validTo||Date.parse(r.validTo)>=t)
}
export function graphGapToResearchIntent(g:{gapKind:string;subject:string;reason:string;nodeOrRelationId:string}){
 return {intentType:g.gapKind==="stale_relation"?"knowledge_revalidation":"fact_verification",objective:`Resolve graph gap: ${g.subject}`,questions:[g.reason],claimsToTest:[],trigger:"knowledge_graph_gap",graphRef:g.nodeOrRelationId}
}
