import {describe,expect,it} from 'vitest';
import {GamingRecoveryPolicy} from './gaming-reliability.js';

describe('G22 reliability drills',()=>{
  it('never resolves a failure by replaying uncertain controller input',()=>{
    expect(new GamingRecoveryPolicy().drillMatrix().every(plan=>plan.replayInput===false)).toBe(true);
  });

  it('preserves conflicting/corrupt save revisions instead of silently overwriting them',()=>{
    const policy=new GamingRecoveryPolicy();
    expect(policy.plan('save-conflict')).toMatchObject({requiresUserDecision:true,actions:['preserve-both-revisions','request-save-choice']});
    expect(policy.plan('crash-during-save-flush').actions).toContain('preserve-previous-revision');
  });
});
