import {describe,expect,it} from 'vitest';
import {assessMusicRightsCoverage,perceptionStageComplete} from './music-autopilot-completion';

describe('JH-CLOSE.02D Music coverage acceptance',()=>{
  it('does not complete merely because the restoration runtime is ready and bindings exist',()=>{
    const base={runtimeReady:true,bindingCount:2,validBindings:2,waitingBindings:0,failedBindings:0,missingSongBindings:0};
    expect(perceptionStageComplete(base)).toBe(true);
    expect(perceptionStageComplete({...base,validBindings:1,failedBindings:1})).toBe(false);
    expect(perceptionStageComplete({...base,validBindings:1,waitingBindings:1})).toBe(false);
    expect(perceptionStageComplete({...base,missingSongBindings:1})).toBe(false);
    expect(perceptionStageComplete({...base,bindingCount:0,validBindings:0})).toBe(false);
    expect(perceptionStageComplete({...base,runtimeReady:false})).toBe(false);
  });
  it('rejects zero or incomplete per-song rights even with revenue evidence elsewhere',()=>{
    const clean={song_id:'song-1',master_ownership_known:true,publishing_known:true,
      sample_status:'clear',third_party_usage_status:'clear'};
    expect(assessMusicRightsCoverage([],[]).complete).toBe(false);
    expect(assessMusicRightsCoverage(['song-1'],[]).complete).toBe(false);
    expect(assessMusicRightsCoverage(['song-1','song-2'],[clean]).missingSongIds).toEqual(['song-2']);
    expect(assessMusicRightsCoverage(['song-1'],[{...clean,sample_status:'review_required'}]).complete).toBe(false);
    expect(assessMusicRightsCoverage(['song-1'],[{...clean,master_ownership_known:false}]).complete).toBe(false);
    expect(assessMusicRightsCoverage(['song-1'],[clean]).complete).toBe(true);
  });
});
