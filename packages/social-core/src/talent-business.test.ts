import {describe,expect,it} from 'vitest';
import {calculateTalentPnl,routeAudienceInteraction,validateContentAllocation} from './talent-business.js';

describe('talent business',()=>{
  it('optimizes character economics instead of raw views',()=>{
    const pnl=calculateTalentPnl('character:mike',[{id:'r',characterRef:'character:mike',contentRef:'video:1',offerRef:'product:hoodie',rail:'pod',amountUsd:120,occurredAt:'2026-09-26T00:00:00Z',evidenceRefs:['order:1']}],[{id:'c',characterRef:'character:mike',contentRef:'video:1',category:'generation',amountUsd:35,occurredAt:'2026-09-26T00:00:00Z',evidenceRefs:['cost:1']}]);
    expect(pnl.contributionMarginUsd).toBe(85);
  });
  it('requires MORE/BETTER/NEW to be an actual allocation',()=>{
    expect(()=>validateContentAllocation({more:.5,better:.3,new:.3,lifecycle:'EXPLORE',evidenceRefs:['experiment:1']})).toThrow('SOCIAL_TALENT_ALLOCATION_MUST_SUM_TO_ONE');
  });
  it('routes observed product intent without granting message execution authority',()=>{
    const decision=routeAudienceInteraction({id:'i',characterRef:'character:mike',accountRef:'ig:1',audienceRef:'a',contentRef:'v',kind:'comment',text:'where can I buy that shirt?',occurredAt:'2026-09-26T00:00:00Z',observedFacts:{askedWhereToBuy:true},evidenceRefs:['comment:1']},{interactionId:'i',intent:'product',confidence:.96,evidenceRefs:['intent:1']},{minimumAutomationConfidence:.9,allowAutomatedRoutes:['owned-product','follow']});
    expect(decision.route).toBe('owned-product');expect(decision.automated).toBe(true);
  });
});
