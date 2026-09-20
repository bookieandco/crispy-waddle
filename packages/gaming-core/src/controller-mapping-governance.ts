import type {CanonicalButton} from './controller.js';

export interface ControllerMappingReference {
  id:string;
  repository:string;
  role:'device-database'|'remap-ux-reference';
  mayInjectRuntimeInput:false;
}

export const CONTROLLER_MAPPING_REFERENCES:readonly ControllerMappingReference[]=Object.freeze([
  {id:'sdl-gamecontrollerdb',repository:'mdqinc/SDL_GameControllerDB',role:'device-database',mayInjectRuntimeInput:false},
  {id:'antimicrox',repository:'AntiMicroX/antimicrox',role:'remap-ux-reference',mayInjectRuntimeInput:false},
]);

export interface ExternalControllerMapping {
  mappingId:string;
  sourceId:string;
  deviceGuid:string;
  platform:string;
  sourceHash:string;
  buttons:Readonly<Partial<Record<string,CanonicalButton>>>;
  macros?:never;
  scripts?:never;
  executables?:never;
}

export class ControllerMappingGovernance {
  private readonly references=new Map(CONTROLLER_MAPPING_REFERENCES.map(ref=>[ref.id,ref]));
  private readonly mappings=new Map<string,ExternalControllerMapping>();

  ingest(mapping:ExternalControllerMapping):void{
    const source=this.references.get(mapping.sourceId);
    if(!source)throw new Error('Unknown controller mapping source');
    if(!mapping.mappingId.trim()||!mapping.deviceGuid.trim()||!mapping.platform.trim()||!mapping.sourceHash.trim()){
      throw new Error('Controller mapping provenance is incomplete');
    }
    for(const target of Object.values(mapping.buttons)){
      if(target&&!this.isCanonical(target))throw new Error(`Unsupported canonical controller target: ${target}`);
    }
    this.mappings.set(mapping.mappingId,Object.freeze({...mapping,buttons:Object.freeze({...mapping.buttons})}));
  }

  resolve(deviceGuid:string,platform:string):ExternalControllerMapping|undefined{
    return [...this.mappings.values()].find(mapping=>mapping.deviceGuid===deviceGuid&&mapping.platform===platform);
  }

  assertRuntimeInputPath(sourceId:string):void{
    if(this.references.has(sourceId))throw new Error('External controller mapper may not inject runtime input after G13');
  }

  private isCanonical(value:string):value is CanonicalButton{
    return new Set<CanonicalButton>([
      'a','b','x','y','l1','r1','l2','r2','l3','r3',
      'dpad_up','dpad_down','dpad_left','dpad_right','start','select','home','menu',
    ]).has(value as CanonicalButton);
  }
}
