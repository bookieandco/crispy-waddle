import {strict as assert} from 'node:assert'
import test from 'node:test'
import {SIDE_HUSTLE_DEFINITIONS} from './side-hustles.js'
import {
  getSideHustleRelationshipScope,
  relationshipPipelinesForSideHustle,
} from './side-hustle-relationships.js'

test('every Side Hustle family has a separated relationship scope',()=>{
  for(const definition of SIDE_HUSTLE_DEFINITIONS){
    const scope=getSideHustleRelationshipScope(definition.family,definition.label)
    assert.equal(scope.family,definition.family)
    assert.equal(scope.label,definition.label)
    assert.ok(scope.lanes.length>0)
    assert.equal(scope.canonicalEntityAuthority,'RELATIONSHIP_CORE')
    assert.equal(scope.opportunityAuthority,'OPPORTUNITY_CORE')
    assert.equal(scope.externalActionAuthorized,false)
  }
})

test('procurement/subcontracting exposes buyers primes and subcontractors separately',()=>{
  const scope=getSideHustleRelationshipScope('procurement_subcontracting')
  assert.deepEqual(scope.lanes.map(row=>row.id),['buyers','primes','subcontractors','partners'])
  assert.deepEqual(new Set(relationshipPipelinesForSideHustle('procurement_subcontracting')),new Set([
    'public_buyer','sam_teaming','subcontractor_acquisition',
  ]))
})
