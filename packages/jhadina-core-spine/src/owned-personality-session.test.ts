import { describe, expect, it } from 'vitest';
import { advanceOwnedPersonalitySession, createOwnedPersonalitySession, eligibleSessionCallback } from './owned-personality-session.js';

const now = '2026-10-17T18:00:00Z';
const scope = (revision: number, extra: Partial<{ verifiedOwnerUserId: string; verifiedSessionId: string; now: string }> = {}) => ({
  verifiedOwnerUserId: 'owner-A', verifiedSessionId: 'session-one', expectedRevision: revision, now, ...extra,
});

describe('LIVE.4–5 owner-scoped ephemeral expression lifecycle', () => {
  it('requires exact owner/session/revision and rejects replay and expiration', () => {
    const first = createOwnedPersonalitySession('owner-A', 'session-one', now);
    const event = { kind: 'build-bit' as const, eventId: 'e1', turn: 1, bitId: 'bit1', phrase: 'toaster', humor: 0.9 };
    expect(advanceOwnedPersonalitySession(first, scope(0, { verifiedOwnerUserId: 'owner-B' }), event)).toMatchObject({status:'blocked',reason:'scope'});
    expect(advanceOwnedPersonalitySession(first, scope(0, { verifiedSessionId: 'other' }), event)).toMatchObject({status:'blocked',reason:'scope'});
    const update = advanceOwnedPersonalitySession(first, scope(0), event);
    expect(update.status).toBe('accepted');
    if (update.status !== 'accepted') throw Error('expected accepted');
    expect(update.state.banter?.stage).toBe('notice');
    expect(update.state.expression.bits).toHaveLength(1);
    expect(update.state.expression.bits[0]?.durable).toBe(false);
    expect(advanceOwnedPersonalitySession(update.state, scope(1), event)).toMatchObject({status:'blocked',reason:'replay'});
    expect(advanceOwnedPersonalitySession(update.state, scope(0), {kind:'stop',eventId:'e2'})).toMatchObject({status:'blocked',reason:'revision'});
    expect(advanceOwnedPersonalitySession(update.state, scope(1,{now:'2026-10-17T18:31:01Z'}), {kind:'stop',eventId:'e2'})).toMatchObject({status:'blocked',reason:'expired'});
  });
  it('stops the bit on request; a substantive topic change exits without sticky discomfort', () => {
    const initial = createOwnedPersonalitySession('owner-A','session-one',now);
    const a = advanceOwnedPersonalitySession(initial,scope(0),{kind:'build-bit',eventId:'1',turn:1,bitId:'x',phrase:'toast',humor:0.9});
    if (a.status !== 'accepted') throw Error('start');
    const stopped = advanceOwnedPersonalitySession(a.state,scope(1),{kind:'stop',eventId:'2'});
    if (stopped.status !== 'accepted') throw Error('stop');
    expect(stopped.state.stopped).toBe(true);
    expect(stopped.state.banter).toBeUndefined();
    expect(stopped.state.expression.discomfortDetected).toBe(true);
    expect(advanceOwnedPersonalitySession(stopped.state,scope(2),{kind:'build-bit',eventId:'3',turn:2,bitId:'x',phrase:'toast',humor:0.9}).status).toBe('blocked');
    const switched = advanceOwnedPersonalitySession(stopped.state,scope(2),{kind:'topic-change',eventId:'4'});
    if(switched.status!=='accepted') throw Error('switch');
    expect(switched.state.stopped).toBe(false);
    expect(switched.state.expression.discomfortDetected).toBe(false);
    expect(switched.state.expression.bits).toHaveLength(0);
  });
  it('caps callback fatigue and retains revocations independently of conversation replay', () => {
    let state = createOwnedPersonalitySession('owner-A','session-one',now);
    for(let i=0;i<2;i++){
      const step=advanceOwnedPersonalitySession(state,scope(state.revision),{kind:'callback-used',eventId:'use-'+i,callback:'Red Chair'});
      if(step.status!=='accepted') throw Error('used');
      state=step.state;
    }
    expect(eligibleSessionCallback(state,'red chair',now)).toBe(false);
    const exhausted=advanceOwnedPersonalitySession(state,scope(state.revision),{kind:'callback-used',eventId:'use-three',callback:'red chair'});
    expect(exhausted.status).toBe('blocked');
    const revoke=advanceOwnedPersonalitySession(state,scope(state.revision),{kind:'callback-revoked',eventId:'forget',callback:'red chair'});
    if(revoke.status!=='accepted') throw Error('revoke');
    expect(revoke.state.callbackUsage).toHaveLength(0);
    expect(revoke.state.revokedCallbacks).toContain('red chair');
    expect(eligibleSessionCallback(revoke.state,'red chair',now)).toBe(false);
  });
});
