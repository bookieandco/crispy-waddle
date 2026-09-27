import {describe,expect,it} from 'vitest';
import {InMemoryWorkSessionLineageIndex,type WorkSessionLineageNode} from './work-session-lineage.js';

function node(id:string,domain:string,kind:WorkSessionLineageNode['kind'],sourceRef:string):WorkSessionLineageNode{
  return {
    id,workSessionId:'ws-lineage',ownerUserId:'u1',domain,kind,sourceRef,evidenceRefs:[`evidence:${id}`],
    createdAt:'2026-09-26T00:00:00.000Z',
  };
}

describe('WorkSession lineage index',()=>{
  it('traces a Director artifact through product, campaign, order and revenue without owning those records',()=>{
    const index=new InMemoryWorkSessionLineageIndex();
    index.addNode({...node('asset','director','artifact','director:asset-1'),contentHash:'a'.repeat(64)});
    index.addNode(node('product','pupsonstuff','product','pupson:product-1'));
    index.addNode(node('campaign','growth','campaign','growth:campaign-1'));
    index.addNode(node('order','commerce','order','order:1'));
    index.addNode(node('revenue','money','revenue','revenue:1'));

    index.addEdge({id:'e1',workSessionId:'ws-lineage',ownerUserId:'u1',fromNodeId:'asset',toNodeId:'product',relation:'derived-from',evidenceRefs:['e1'],createdAt:'2026-09-26T00:00:01.000Z'});
    index.addEdge({id:'e2',workSessionId:'ws-lineage',ownerUserId:'u1',fromNodeId:'product',toNodeId:'campaign',relation:'promoted-as',evidenceRefs:['e2'],createdAt:'2026-09-26T00:00:02.000Z'});
    index.addEdge({id:'e3',workSessionId:'ws-lineage',ownerUserId:'u1',fromNodeId:'campaign',toNodeId:'order',relation:'attributed-to',evidenceRefs:['e3'],createdAt:'2026-09-26T00:00:03.000Z'});
    index.addEdge({id:'e4',workSessionId:'ws-lineage',ownerUserId:'u1',fromNodeId:'order',toNodeId:'revenue',relation:'measured-by',evidenceRefs:['e4'],createdAt:'2026-09-26T00:00:04.000Z'});

    expect(index.descendants('ws-lineage','asset').map(x=>x.id)).toEqual(['product','campaign','order','revenue']);
    expect(index.ancestors('ws-lineage','revenue').map(x=>x.id)).toEqual(['order','campaign','product','asset']);
    expect(index.snapshot('ws-lineage').edges.every(edge=>edge.authority==='REFERENCE_ONLY')).toBe(true);
  });

  it('rejects duplicate canonical refs, missing nodes and directional cycles',()=>{
    const index=new InMemoryWorkSessionLineageIndex();
    index.addNode(node('a','director','artifact','asset:1'));
    expect(()=>index.addNode(node('b','director','artifact','asset:1'))).toThrow(/SOURCE_REF_CONFLICT/);
    expect(()=>index.addEdge({id:'missing',workSessionId:'ws-lineage',ownerUserId:'u1',fromNodeId:'a',toNodeId:'z',relation:'derived-from',evidenceRefs:[],createdAt:'2026-09-26T00:00:01.000Z'})).toThrow(/NODE_NOT_FOUND/);

    index.addNode(node('b','growth','campaign','campaign:1'));
    index.addEdge({id:'ab',workSessionId:'ws-lineage',ownerUserId:'u1',fromNodeId:'a',toNodeId:'b',relation:'derived-from',evidenceRefs:[],createdAt:'2026-09-26T00:00:01.000Z'});
    expect(()=>index.addEdge({id:'ba',workSessionId:'ws-lineage',ownerUserId:'u1',fromNodeId:'b',toNodeId:'a',relation:'derived-from',evidenceRefs:[],createdAt:'2026-09-26T00:00:02.000Z'})).toThrow(/LINEAGE_CYCLE/);
  });

  it('finds canonical records by owning subsystem reference',()=>{
    const index=new InMemoryWorkSessionLineageIndex();
    index.addNode(node('sam-1','sam','opportunity','sam:notice:123'));
    expect(index.findBySourceRef({workSessionId:'ws-lineage',ownerUserId:'u1',domain:'sam',sourceRef:'sam:notice:123'})?.id).toBe('sam-1');
  });
});
