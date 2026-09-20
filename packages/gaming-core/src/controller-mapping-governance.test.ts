import {describe,expect,it} from 'vitest';
import {ControllerMappingGovernance,CONTROLLER_MAPPING_REFERENCES} from './controller-mapping-governance.js';

describe('controller mapper references',()=>{
  it('admits SDL-style device mappings only with provenance into canonical controls',()=>{
    const registry=new ControllerMappingGovernance();
    registry.ingest({
      mappingId:'map1',sourceId:'sdl-gamecontrollerdb',deviceGuid:'0300',platform:'iOS',
      sourceHash:'sha256:abc',buttons:{south:'a',east:'b',start:'start'},
    });
    expect(registry.resolve('0300','iOS')?.buttons.south).toBe('a');
  });

  it('keeps AntiMicroX and SDL mapping sources outside the post-G13 runtime input path',()=>{
    const registry=new ControllerMappingGovernance();
    for(const ref of CONTROLLER_MAPPING_REFERENCES){
      expect(ref.mayInjectRuntimeInput).toBe(false);
      expect(()=>registry.assertRuntimeInputPath(ref.id)).toThrow('may not inject runtime input');
    }
  });
});
