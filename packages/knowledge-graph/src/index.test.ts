import { strict as assert } from 'node:assert'
import test from 'node:test'
import { InMemoryKnowledgeGraph } from './index.js'

test('canonical graph requires endpoints and preserves provenance', () => {
  const graph = new InMemoryKnowledgeGraph()
  graph.registerNode({ nodeId: 'place:lax', nodeType: 'LOCATION', label: 'LAX', provenanceRefs: ['evidence:lax'] })
  graph.registerNode({ nodeId: 'camera:1', nodeType: 'CAMERA', label: 'Camera 1', provenanceRefs: ['evidence:camera'] })
  graph.registerRelation({ relationId: 'r1', fromNodeId: 'camera:1', toNodeId: 'place:lax', relationType: 'OBSERVED_BY', provenanceRefs: ['evidence:camera'] })
  assert.equal(graph.getNode('place:lax')?.provenanceRefs?.[0], 'evidence:lax')
  assert.equal(graph.getRelations('place:lax')[0]?.relationType, 'OBSERVED_BY')
})

test('canonical graph rejects relation to an unknown node', () => {
  const graph = new InMemoryKnowledgeGraph()
  graph.registerNode({ nodeId: 'place:lax', nodeType: 'LOCATION', label: 'LAX' })
  assert.throws(() => graph.registerRelation({ relationId: 'r1', fromNodeId: 'place:lax', toNodeId: 'missing', relationType: 'NEAR' }), /KNOWLEDGE_RELATION_NODE_MISSING/)
})
