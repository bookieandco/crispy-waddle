import {describe,expect,it} from 'vitest';
import {
  authorityForMusicAutopilotAction,
  buildMusicAutopilotActionPlan,
  certifyMusicAutopilotSource,
  defaultMusicAutopilotCharter,
  musicAutopilotActionKey,
  recoveryPlanForMusicAutopilotFailure,
  validateMusicAutopilotCharter,
} from './autopilot.js';

describe('music autopilot',()=>{
  it('certifies all thirteen source stages',()=>{
    const report=certifyMusicAutopilotSource();
    expect(report.passed).toBe(true);
    expect(report.stages).toHaveLength(13);
    expect(report.version).toBe('MUSIC-AUTO.13-v1');
  });

  it('is disabled and zero-spend by default',()=>{
    const charter=defaultMusicAutopilotCharter();
    expect(charter.enabled).toBe(false);
    expect(charter.allowPreapprovedPaidTests).toBe(false);
    expect(charter.maxPreapprovedPaidMinorPerRun).toBe(0);
    expect(charter.maxPreapprovedPaidMinorPerDay).toBe(0);
  });

  it('requires coherent paid limits',()=>{
    expect(()=>validateMusicAutopilotCharter({
      ...defaultMusicAutopilotCharter(),
      allowPreapprovedPaidTests:true,
    })).toThrow('MUSIC_AUTOPILOT_PAID_LIMIT_REQUIRED');
    expect(()=>validateMusicAutopilotCharter({
      ...defaultMusicAutopilotCharter(),
      maxPreapprovedPaidMinorPerRun:200,
      maxPreapprovedPaidMinorPerDay:100,
    })).toThrow('MUSIC_AUTOPILOT_RUN_LIMIT_EXCEEDS_DAILY_LIMIT');
  });

  it('dedupes social account scope and normalizes currency',()=>{
    const charter=validateMusicAutopilotCharter({
      ...defaultMusicAutopilotCharter(),
      enabled:true,
      allowedSocialAccountIds:['a','a','b'],
      currency:' usd ',
    });
    expect(charter.allowedSocialAccountIds).toEqual(['a','b']);
    expect(charter.currency).toBe('USD');
  });

  it('keeps external publication and contracts outside the autopilot charter',()=>{
    const charter=defaultMusicAutopilotCharter();
    expect(authorityForMusicAutopilotAction('SOCIAL_PROPOSAL',charter).authority).toBe('AUTONOMOUS_WITHIN_CHARTER');
    expect(authorityForMusicAutopilotAction('SOCIAL_DISPATCH_APPROVED',charter).authority).toBe('AUTONOMOUS_WITHIN_CHARTER');
    // This action is only the scheduling/dispatch of content that is already
    // approved by the canonical Social approval receipt. It cannot create that
    // receipt or approve new public content.
    expect(authorityForMusicAutopilotAction('PAID_PREAPPROVED_TEST',charter).authority).toBe('APPROVAL_REQUIRED');
  });

  it('creates stable idempotency keys from lineage',()=>{
    const a=musicAutopilotActionKey({projectId:'Project 1',kind:'DIRECTOR_PRODUCTION',lineageKey:'exp:1:brief:2'});
    const b=musicAutopilotActionKey({projectId:'Project 1',kind:'DIRECTOR_PRODUCTION',lineageKey:'exp:1:brief:2'});
    expect(a).toBe(b);
    expect(a).toContain('director_production');
  });

  it('builds evidence-preserving action plans',()=>{
    const plan=buildMusicAutopilotActionPlan({
      projectId:'p1',
      stage:'MUSIC-AUTO.2',
      kind:'DIRECTOR_PRODUCTION',
      lineageKey:'exp-1',
      charter:defaultMusicAutopilotCharter(),
      reason:'replicated creative opportunity',
      evidenceRefs:['e1','e1','e2'],
    });
    expect(plan.evidenceRefs).toEqual(['e1','e2']);
    expect(plan.stage).toBe('MUSIC-AUTO.2');
  });

  it('never repeats an ambiguous external call',()=>{
    const recovery=recoveryPlanForMusicAutopilotFailure({
      actionKey:'a',
      kind:'SOCIAL_DISPATCH_APPROVED',
      errorCode:'timeout-after-post',
      sideEffectState:'AMBIGUOUS',
      attempt:1,
    });
    expect(recovery.disposition).toBe('RECONCILE');
    expect(recovery.mayRepeatExternalCall).toBe(false);
  });

  it('marks a confirmed side effect complete instead of retrying',()=>{
    const recovery=recoveryPlanForMusicAutopilotFailure({
      actionKey:'a',
      kind:'DIRECTOR_PRODUCTION',
      errorCode:'receipt-write-failed',
      sideEffectState:'CONFIRMED',
      attempt:1,
      providerReference:'provider-job-1',
    });
    expect(recovery.disposition).toBe('COMPLETE');
    expect(recovery.mayRepeatExternalCall).toBe(false);
  });

  it('allows bounded retry only when no side effect occurred',()=>{
    const retry=recoveryPlanForMusicAutopilotFailure({
      actionKey:'a',kind:'SYNC_SOCIAL_OBSERVATIONS',errorCode:'read-timeout',sideEffectState:'NONE',attempt:1,
    },{maxAttempts:3});
    const stop=recoveryPlanForMusicAutopilotFailure({
      actionKey:'a',kind:'SYNC_SOCIAL_OBSERVATIONS',errorCode:'read-timeout',sideEffectState:'NONE',attempt:3,
    },{maxAttempts:3});
    expect(retry.disposition).toBe('RETRY');
    expect(retry.nextAttempt).toBe(2);
    expect(stop.disposition).toBe('STOP');
  });
});
