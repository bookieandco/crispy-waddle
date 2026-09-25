import type { SpatialWorkspace } from './spatial-pipeline.js';

export type SpatialGlobeCommand =
  | { op:'fly-to'; refs:readonly string[] }
  | { op:'focus'; ref:string }
  | { op:'highlight'; refs:readonly string[]; tone?:'accent'|'warn' }
  | { op:'draw-relations'; ref:string; kind:'source'|'corroboration'|'conflict'|'route'|'semantic'; depth?:1|2 }
  | { op:'set-filter'; filters:Readonly<Record<string,unknown>> }
  | { op:'reset-view' };

export interface SpatialGlobeNavigationEvent {
  id:string;
  workspaceId:string;
  command:SpatialGlobeCommand;
  evidenceRefs:readonly string[];
  realityRefs:readonly string[];
  limitations:readonly string[];
  authority:'PRESENTATION_ONLY';
}

export interface SpatialGlobeRendererProfile {
  id:string;
  geometryOwner:'renderer';
  externalCoordinateCommands:false;
  entitySelection:'stable-ref';
  spatialIndex:'S2';
  picking:'GPU_ID_BUFFER';
  relationLoading:'ON_DEMAND';
  notes:readonly string[];
  sourceRefs:readonly string[];
  authority:'SPATIAL_PRESENTATION_PROFILE';
}

export const GITGLOBE_INSPIRED_GEV_RENDERER_PROFILE:SpatialGlobeRendererProfile=Object.freeze({
  id:'gev-globe:gitglobe-pattern:v1',
  geometryOwner:'renderer',
  externalCoordinateCommands:false,
  entitySelection:'stable-ref',
  spatialIndex:'S2',
  picking:'GPU_ID_BUFFER',
  relationLoading:'ON_DEMAND',
  notes:Object.freeze([
    'The model/agent emits stable spatial refs, never raw camera/world coordinates.',
    'The renderer resolves refs to grounded geometry from the active spatial workspace/graph.',
    'Camera state and renderer geometry are presentation state and never become Spatial Reality.',
    'GitGlobe semantic coordinates are not imported; only its ID-based control and scalable-rendering patterns are reused.',
  ]),
  sourceRefs:Object.freeze(['https://github.com/yamantaka-singh/GitGlobe']),
  authority:'SPATIAL_PRESENTATION_PROFILE',
});

export function parseSpatialGlobeCommand(
  raw:unknown,
  allowedRefs:ReadonlySet<string>,
):SpatialGlobeCommand{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('SPATIAL_GLOBE_COMMAND_INVALID');
  const value=raw as Record<string,unknown>;
  rejectRawGeometry(value);

  const op=value.op;
  if(op==='reset-view') return Object.freeze({op});

  if(op==='set-filter'){
    if(!value.filters||typeof value.filters!=='object'||Array.isArray(value.filters)) throw new Error('SPATIAL_GLOBE_FILTER_INVALID');
    rejectRawGeometry(value.filters as Record<string,unknown>);
    return Object.freeze({op,filters:Object.freeze({...value.filters as Record<string,unknown>})});
  }

  if(op==='focus'||op==='draw-relations'){
    const ref=typeof value.ref==='string'?value.ref.trim():'';
    assertAllowedRef(ref,allowedRefs);
    if(op==='focus') return Object.freeze({op,ref});
    const kind=value.kind;
    if(!['source','corroboration','conflict','route','semantic'].includes(String(kind))) throw new Error('SPATIAL_GLOBE_RELATION_KIND_INVALID');
    const depth=value.depth===undefined?undefined:Number(value.depth);
    if(depth!==undefined&&depth!==1&&depth!==2) throw new Error('SPATIAL_GLOBE_RELATION_DEPTH_INVALID');
    return Object.freeze({
      op,
      ref,
      kind:kind as 'source'|'corroboration'|'conflict'|'route'|'semantic',
      ...(depth?{depth:depth as 1|2}:{})
    });
  }

  if(op==='fly-to'||op==='highlight'){
    if(!Array.isArray(value.refs)||value.refs.length===0) throw new Error('SPATIAL_GLOBE_REFS_REQUIRED');
    const refs=value.refs.map(item=>typeof item==='string'?item.trim():'');
    for(const ref of refs) assertAllowedRef(ref,allowedRefs);
    const unique=Object.freeze([...new Set(refs)]);
    if(op==='fly-to') return Object.freeze({op,refs:unique});
    const tone=value.tone===undefined?undefined:String(value.tone);
    if(tone!==undefined&&tone!=='accent'&&tone!=='warn') throw new Error('SPATIAL_GLOBE_HIGHLIGHT_TONE_INVALID');
    return Object.freeze({op,refs:unique,...(tone?{tone:tone as 'accent'|'warn'}:{})});
  }

  throw new Error('SPATIAL_GLOBE_OPERATION_UNSUPPORTED');
}

export function buildSpatialGlobeNavigationEvent(input:{
  id:string;
  workspace:SpatialWorkspace;
  command:SpatialGlobeCommand;
}):SpatialGlobeNavigationEvent{
  if(!input.id.trim()) throw new Error('SPATIAL_GLOBE_EVENT_ID_REQUIRED');
  return Object.freeze({
    id:input.id,
    workspaceId:input.workspace.workspaceId,
    command:input.command,
    evidenceRefs:Object.freeze([...new Set(input.workspace.evidenceRefs)].sort()),
    realityRefs:Object.freeze([...new Set(input.workspace.realityRefs)].sort()),
    limitations:Object.freeze([
      'Globe navigation is presentation-only and cannot create observations, evidence, claims, or reality.',
      'Renderer-resolved positions must come from grounded spatial refs; agent-supplied coordinates are rejected.',
    ]),
    authority:'PRESENTATION_ONLY',
  });
}

function assertAllowedRef(ref:string,allowedRefs:ReadonlySet<string>):void{
  if(!ref) throw new Error('SPATIAL_GLOBE_REF_REQUIRED');
  if(!allowedRefs.has(ref)) throw new Error(`SPATIAL_GLOBE_REF_UNKNOWN:${ref}`);
}

function rejectRawGeometry(value:Record<string,unknown>):void{
  const banned=new Set(['lat','lon','lng','latitude','longitude','x','y','z','theta','phi','cameraPosition','targetPosition']);
  for(const [key,child] of Object.entries(value)){
    if(banned.has(key)) throw new Error(`SPATIAL_GLOBE_RAW_GEOMETRY_REJECTED:${key}`);
    if(child&&typeof child==='object'&&!Array.isArray(child)) rejectRawGeometry(child as Record<string,unknown>);
  }
}
