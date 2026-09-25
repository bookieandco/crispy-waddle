export type EditorialStage =
  | 'raw'
  | 'synced-interview'
  | 'selected'
  | 'scene'
  | 'master'
  | 'final';

export interface EditorialSequenceNode {
  id:string;
  projectId:string;
  stage:EditorialStage;
  parentIds:readonly string[];
  assetIds:readonly string[];
  timelineVersionId?:string;
  description:string;
  evidenceIds:readonly string[];
}

export interface EditorialReductionGraph {
  id:string;
  projectId:string;
  nodes:readonly EditorialSequenceNode[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_EDITORIAL_REDUCTION';
}

export interface EditorialReductionDecision {
  valid:boolean;
  reasons:readonly string[];
  authority:'DIRECTOR_EDITORIAL_REDUCTION_QC';
}

const allowedParents:Readonly<Record<EditorialStage,readonly EditorialStage[]>>=Object.freeze({
  raw:[],
  'synced-interview':['raw'],
  selected:['raw','synced-interview'],
  scene:['selected'],
  master:['scene'],
  final:['master'],
});

export function validateEditorialReductionGraph(
  graph:EditorialReductionGraph,
):EditorialReductionDecision{
  const reasons:string[]=[];
  if(!graph.id.trim()||!graph.projectId.trim()) reasons.push('DIRECTOR_EDITORIAL_GRAPH_IDENTITY_REQUIRED');
  if(!graph.nodes.length) reasons.push('DIRECTOR_EDITORIAL_GRAPH_NODES_REQUIRED');
  if(!graph.evidenceIds.length) reasons.push('DIRECTOR_EDITORIAL_GRAPH_EVIDENCE_REQUIRED');

  const byId=new Map<string,EditorialSequenceNode>();
  for(const node of graph.nodes){
    if(!node.id.trim()||byId.has(node.id)) reasons.push(`DIRECTOR_EDITORIAL_NODE_ID_INVALID:${node.id||'unknown'}`);
    byId.set(node.id,node);
    if(node.projectId!==graph.projectId) reasons.push(`DIRECTOR_EDITORIAL_NODE_PROJECT_MISMATCH:${node.id}`);
    if(!node.assetIds.length) reasons.push(`DIRECTOR_EDITORIAL_NODE_ASSETS_REQUIRED:${node.id}`);
    if(!node.description.trim()||!node.evidenceIds.length) reasons.push(`DIRECTOR_EDITORIAL_NODE_EVIDENCE_REQUIRED:${node.id}`);
    if(node.stage!=='raw'&&!node.parentIds.length) reasons.push(`DIRECTOR_EDITORIAL_NODE_PARENT_REQUIRED:${node.id}`);
    if(node.stage==='raw'&&node.parentIds.length) reasons.push(`DIRECTOR_EDITORIAL_RAW_PARENT_FORBIDDEN:${node.id}`);
  }

  for(const node of graph.nodes){
    const allowed=new Set(allowedParents[node.stage]);
    for(const parentId of node.parentIds){
      const parent=byId.get(parentId);
      if(!parent){
        reasons.push(`DIRECTOR_EDITORIAL_PARENT_UNKNOWN:${node.id}:${parentId}`);
        continue;
      }
      if(!allowed.has(parent.stage)){
        reasons.push(`DIRECTOR_EDITORIAL_STAGE_TRANSITION_INVALID:${parent.stage}->${node.stage}`);
      }
    }
  }

  const hasMaster=graph.nodes.some(node=>node.stage==='master');
  const hasFinal=graph.nodes.some(node=>node.stage==='final');
  if(hasFinal&&!hasMaster) reasons.push('DIRECTOR_EDITORIAL_FINAL_WITHOUT_MASTER');

  return Object.freeze({
    valid:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    authority:'DIRECTOR_EDITORIAL_REDUCTION_QC',
  });
}
