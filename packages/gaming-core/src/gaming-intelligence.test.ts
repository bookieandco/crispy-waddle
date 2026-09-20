import {describe,expect,it} from 'vitest';
import {GamingAssistantPlanner,GamingIntelligenceLedger} from './gaming-intelligence.js';

describe('G24/G25 gaming intelligence and assistant',()=>{
  it('grounds advice in recorded observations and never grants controller injection',()=>{
    const ledger=new GamingIntelligenceLedger();
    ledger.record({observationId:'o1',sessionId:'s1',gameId:'g1',kind:'death',observedAtMs:100,summary:'Player was hit during recovery frames',evidenceRefs:['frame:100']});
    expect(ledger.advise('g1','Delay the punish until recovery ends.',['o1'])).toMatchObject({controllerInjectionAllowed:false,basedOnObservationIds:['o1']});
  });

  it('requires authorization for state-changing assistant commands but not analysis',()=>{
    const planner=new GamingAssistantPlanner();
    expect(planner.plan({intent:'switch-display',gameId:'g1',targetId:'tv'})).toMatchObject({requiresAuthorization:true,controllerInjectionAllowed:false});
    expect(planner.plan({intent:'explain-death',gameId:'g1'})).toMatchObject({requiresAuthorization:false,controllerInjectionAllowed:false});
  });
});
