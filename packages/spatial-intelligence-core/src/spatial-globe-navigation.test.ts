import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSpatialGlobeNavigationEvent,
  GITGLOBE_INSPIRED_GEV_RENDERER_PROFILE,
  parseSpatialGlobeCommand,
} from './spatial-globe-navigation.js';

const allowed=new Set(['camera:cam-1','aircraft:abc123','satellite:iss']);

test('GitGlobe-inspired navigation accepts stable refs and never agent coordinates',()=>{
  assert.deepEqual(parseSpatialGlobeCommand({op:'fly-to',refs:['aircraft:abc123','satellite:iss']},allowed),{
    op:'fly-to',refs:['aircraft:abc123','satellite:iss']
  });
  assert.throws(
    ()=>parseSpatialGlobeCommand({op:'fly-to',refs:['aircraft:abc123'],lat:33.94,lon:-118.4},allowed),
    /SPATIAL_GLOBE_RAW_GEOMETRY_REJECTED:lat/,
  );
  assert.equal(GITGLOBE_INSPIRED_GEV_RENDERER_PROFILE.externalCoordinateCommands,false);
  assert.equal(GITGLOBE_INSPIRED_GEV_RENDERER_PROFILE.geometryOwner,'renderer');
});

test('navigation fails closed on ungrounded refs',()=>{
  assert.throws(
    ()=>parseSpatialGlobeCommand({op:'focus',ref:'aircraft:hallucinated'},allowed),
    /SPATIAL_GLOBE_REF_UNKNOWN/,
  );
});

test('renderer events preserve GEV evidence/reality lineage without gaining authority',()=>{
  const workspace={
    workspaceId:'spatial:w1',ownerId:'u',geographicScope:null,
    selectedRefs:['aircraft:abc123'],activeLayers:['aircraft'],filters:{},
    routes:[],annotations:[],measurements:[],timeCursor:null,replayState:'LIVE' as const,
    investigationRefs:[],activeClaimRefs:[],evidenceRefs:['gev:evidence:flight-1'],
    realityRefs:['reality:flight-1'],janetPreferences:{},deliaContext:{},marisaContext:{},
    createdAt:'2026-09-25T00:00:00Z',updatedAt:'2026-09-25T00:00:00Z',
  };
  const command=parseSpatialGlobeCommand({op:'focus',ref:'aircraft:abc123'},allowed);
  const event=buildSpatialGlobeNavigationEvent({id:'nav:1',workspace,command});
  assert.equal(event.authority,'PRESENTATION_ONLY');
  assert.deepEqual(event.evidenceRefs,['gev:evidence:flight-1']);
  assert.deepEqual(event.realityRefs,['reality:flight-1']);
  assert.match(event.limitations.join(' '),/cannot create observations/i);
});
