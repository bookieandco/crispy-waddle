export type WorkSessionLineageNodeKind =
  |'task'
  |'artifact'
  |'product'
  |'campaign'
  |'publication'
  |'order'
  |'revenue'
  |'opportunity'
  |'contract'
  |'position'
  |'bet'
  |'evidence'
  |'other';

export type WorkSessionLineageRelation =
  |'generated-by'
  |'derived-from'
  |'used-by'
  |'promoted-as'
  |'sold-as'
  |'fulfilled-by'
  |'measured-by'
  |'attributed-to'
  |'linked-to';

export interface WorkSessionLineageNode {
  id:string;
  workSessionId:string;
  ownerUserId:string;
  domain:string;
  kind:WorkSessionLineageNodeKind;
  /** Canonical identifier in the owning subsystem. This graph never replaces it. */
  sourceRef:string;
  contentHash?:string;
  evidenceRefs:readonly string[];
  createdAt:string;
}

export interface WorkSessionLineageEdge {
  id:string;
  workSessionId:string;
  ownerUserId:string;
  fromNodeId:string;
  toNodeId:string;
  relation:WorkSessionLineageRelation;
  evidenceRefs:readonly string[];
  createdAt:string;
  authority:'REFERENCE_ONLY';
}

export interface WorkSessionLineageSnapshot {
  workSessionId:string;
  nodes:readonly WorkSessionLineageNode[];
  edges:readonly WorkSessionLineageEdge[];
}

export class InMemoryWorkSessionLineageIndex {
  private readonly nodes=new Map<string,WorkSessionLineageNode>();
  private readonly sourceRefs=new Map<string,string>();
  private readonly edges=new Map<string,WorkSessionLineageEdge>();

  addNode(input:WorkSessionLineageNode):WorkSessionLineageNode{
    validateNode(input);
    const idKey=nodeKey(input.workSessionId,input.id);
    if(this.nodes.has(idKey))throw new Error('WORK_SESSION_LINEAGE_NODE_EXISTS');
    const sourceKey=sourceRefKey(input);
    const existing=this.sourceRefs.get(sourceKey);
    if(existing)throw new Error(`WORK_SESSION_LINEAGE_SOURCE_REF_CONFLICT:${existing}`);
    const frozen=freezeNode(input);
    this.nodes.set(idKey,frozen);
    this.sourceRefs.set(sourceKey,input.id);
    return frozen;
  }

  addEdge(input:Omit<WorkSessionLineageEdge,'authority'>):WorkSessionLineageEdge{
    validateEdgeInput(input);
    const from=this.requireNode(input.workSessionId,input.fromNodeId);
    const to=this.requireNode(input.workSessionId,input.toNodeId);
    if(from.ownerUserId!==input.ownerUserId||to.ownerUserId!==input.ownerUserId)throw new Error('WORK_SESSION_LINEAGE_OWNER_MISMATCH');
    if(input.fromNodeId===input.toNodeId)throw new Error('WORK_SESSION_LINEAGE_SELF_EDGE');
    const edgeKey=edgeIdentity(input);
    if(this.edges.has(edgeKey))throw new Error('WORK_SESSION_LINEAGE_EDGE_EXISTS');
    if(input.relation!=='linked-to'&&this.hasDirectedPath(input.workSessionId,input.toNodeId,input.fromNodeId)){
      throw new Error('WORK_SESSION_LINEAGE_CYCLE');
    }
    const edge=freezeEdge({...input,authority:'REFERENCE_ONLY'});
    this.edges.set(edgeKey,edge);
    return edge;
  }

  getNode(workSessionId:string,nodeId:string):WorkSessionLineageNode|undefined{
    return this.nodes.get(nodeKey(workSessionId,nodeId));
  }

  findBySourceRef(input:{workSessionId:string;ownerUserId:string;domain:string;sourceRef:string}):WorkSessionLineageNode|undefined{
    const id=this.sourceRefs.get(`${input.ownerUserId}:${input.workSessionId}:${input.domain}:${input.sourceRef}`);
    return id?this.getNode(input.workSessionId,id):undefined;
  }

  descendants(workSessionId:string,nodeId:string,maxDepth=32):readonly WorkSessionLineageNode[]{
    return this.traverse(workSessionId,nodeId,'out',maxDepth);
  }

  ancestors(workSessionId:string,nodeId:string,maxDepth=32):readonly WorkSessionLineageNode[]{
    return this.traverse(workSessionId,nodeId,'in',maxDepth);
  }

  snapshot(workSessionId:string):WorkSessionLineageSnapshot{
    const nodes=[...this.nodes.values()].filter(node=>node.workSessionId===workSessionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    const edges=[...this.edges.values()].filter(edge=>edge.workSessionId===workSessionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    return Object.freeze({workSessionId,nodes:Object.freeze(nodes),edges:Object.freeze(edges)});
  }

  private requireNode(workSessionId:string,nodeId:string):WorkSessionLineageNode{
    const node=this.getNode(workSessionId,nodeId);
    if(!node)throw new Error(`WORK_SESSION_LINEAGE_NODE_NOT_FOUND:${nodeId}`);
    return node;
  }

  private hasDirectedPath(workSessionId:string,start:string,target:string):boolean{
    const seen=new Set<string>();
    const stack=[start];
    while(stack.length){
      const id=stack.pop()!;
      if(id===target)return true;
      if(seen.has(id))continue;
      seen.add(id);
      for(const edge of this.edges.values()){
        if(edge.workSessionId===workSessionId&&edge.relation!=='linked-to'&&edge.fromNodeId===id)stack.push(edge.toNodeId);
      }
    }
    return false;
  }

  private traverse(workSessionId:string,nodeId:string,direction:'in'|'out',maxDepth:number):readonly WorkSessionLineageNode[]{
    if(!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>128)throw new Error('WORK_SESSION_LINEAGE_DEPTH_INVALID');
    this.requireNode(workSessionId,nodeId);
    const result:WorkSessionLineageNode[]=[];
    const seen=new Set<string>([nodeId]);
    let frontier=[nodeId];
    let depth=0;
    while(frontier.length&&depth<maxDepth){
      const next:string[]=[];
      for(const current of frontier){
        for(const edge of this.edges.values()){
          if(edge.workSessionId!==workSessionId)continue;
          const neighbor=direction==='out'
            ?(edge.fromNodeId===current?edge.toNodeId:undefined)
            :(edge.toNodeId===current?edge.fromNodeId:undefined);
          if(!neighbor||seen.has(neighbor))continue;
          seen.add(neighbor);
          const node=this.requireNode(workSessionId,neighbor);
          result.push(node);
          next.push(neighbor);
        }
      }
      frontier=next;
      depth+=1;
    }
    return Object.freeze(result);
  }
}

function validateNode(node:WorkSessionLineageNode):void{
  if([node.id,node.workSessionId,node.ownerUserId,node.domain,node.sourceRef,node.createdAt].some(value=>!value.trim())){
    throw new Error('WORK_SESSION_LINEAGE_NODE_REQUIRED_FIELDS');
  }
  if(Number.isNaN(Date.parse(node.createdAt)))throw new Error('WORK_SESSION_LINEAGE_NODE_TIME_INVALID');
  if(node.contentHash!==undefined&&!/^[a-f0-9]{64}$/i.test(node.contentHash))throw new Error('WORK_SESSION_LINEAGE_HASH_INVALID');
  if(node.evidenceRefs.some(value=>!value.trim()))throw new Error('WORK_SESSION_LINEAGE_EVIDENCE_INVALID');
}

function validateEdgeInput(edge:Omit<WorkSessionLineageEdge,'authority'>):void{
  if([edge.id,edge.workSessionId,edge.ownerUserId,edge.fromNodeId,edge.toNodeId,edge.createdAt].some(value=>!value.trim())){
    throw new Error('WORK_SESSION_LINEAGE_EDGE_REQUIRED_FIELDS');
  }
  if(Number.isNaN(Date.parse(edge.createdAt)))throw new Error('WORK_SESSION_LINEAGE_EDGE_TIME_INVALID');
  if(edge.evidenceRefs.some(value=>!value.trim()))throw new Error('WORK_SESSION_LINEAGE_EVIDENCE_INVALID');
}

function freezeNode(node:WorkSessionLineageNode):WorkSessionLineageNode{
  return Object.freeze({...node,evidenceRefs:Object.freeze([...new Set(node.evidenceRefs)])});
}
function freezeEdge(edge:WorkSessionLineageEdge):WorkSessionLineageEdge{
  return Object.freeze({...edge,evidenceRefs:Object.freeze([...new Set(edge.evidenceRefs)])});
}
function nodeKey(workSessionId:string,nodeId:string):string{return `${workSessionId}:${nodeId}`;}
function sourceRefKey(node:WorkSessionLineageNode):string{return `${node.ownerUserId}:${node.workSessionId}:${node.domain}:${node.sourceRef}`;}
function edgeIdentity(edge:Omit<WorkSessionLineageEdge,'authority'>):string{return `${edge.workSessionId}:${edge.fromNodeId}:${edge.relation}:${edge.toNodeId}`;}
