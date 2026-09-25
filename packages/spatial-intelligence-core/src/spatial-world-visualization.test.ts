import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpatialWorldVisualizationSeed } from './spatial-world-visualization.js';

const context={
  subject:'LAX area',
  geographicScope:{lat:33.94,lon:-118.4,radiusKm:5},
  temporalScope:{from:null,to:null,asOf:'2026-09-25T16:00:00Z'},
  observations:[{id:'obs:1',source:'gev',observedAt:'2026-09-25T16:00:00Z',summary:'aircraft observation',immutable:true}],
  evidence:[{id:'gev:evidence:1',source:'OpenSky Network',observedAt:'2026-09-25T16:00:00Z',summary:'grounded evidence',immutable:true}],
  claims:[],
  reality:[{id:'reality:1',source:'spatial-reality-admission',observedAt:'2026-09-25T16:00:00Z',summary:'admitted reality',immutable:true}],
  patterns:[],predictions:[],scenarios:[],hypotheses:[],
  sourceHealth:['aircraft:ok'],conflicts:[],uncertainty:[],
  limitations:['Spatial context is intelligence only.'],
  workspaceRef:'spatial:w1',investigationRef:null,
  provenance:[{id:'gev:evidence:1',source:'OpenSky Network',observedAt:'2026-09-25T16:00:00Z',summary:'grounded evidence',immutable:true}],
};

test('GEV can seed a synthetic world without granting the generated world reality authority',()=>{
  const seed=createSpatialWorldVisualizationSeed({id:'world-seed:lax',context,requireAdmittedReality:true});
  assert.equal(seed.authority,'INTELLIGENCE_ONLY');
  assert.equal(seed.syntheticOutputPolicy,'MUST_NOT_REENTER_SPATIAL_REALITY');
  assert.deepEqual(seed.realityRefs,['reality:1']);
  assert.match(seed.limitations.join(' '),/must never be admitted back into Spatial Reality/i);
});

test('real-world visualization can require explicit Reality admission',()=>{
  assert.throws(
    ()=>createSpatialWorldVisualizationSeed({
      id:'world-seed:no-reality',
      context:{...context,reality:[]},
      requireAdmittedReality:true,
    }),
    /SPATIAL_WORLD_SEED_ADMITTED_REALITY_REQUIRED/,
  );
});
