import { describe, expect, it } from 'vitest';
import {
  assessAdLandingMessageMatch,
  assessTrackingSignalQuality,
  calculateAcquisitionEconomics,
  createCreativeExperimentVariant,
  createRetargetingSequence,
} from './funnel-learning.js';

describe('paid social funnel learning',()=>{
  it('measures ad-to-landing congruence instead of assuming a click is enough',()=>{
    const result=assessAdLandingMessageMatch({
      adHeadline:'Create a personalized dog portrait gift',
      adPromise:'Turn one pet photo into a custom gift',
      landingHeadline:'Turn your pet photo into a personalized gift',
      landingLead:'Upload one pet photo and create a custom product',
      evidenceRefs:['ad:1','landing:v3'],
    });
    expect(result.status).not.toBe('weak');
    expect(result.score).toBeGreaterThan(0);
  });

  it('treats tracking quality as a diagnostic rather than causal proof',()=>{
    const result=assessTrackingSignalQuality({
      browserPurchaseEvents:90,serverPurchaseEvents:95,deduplicatedPurchases:98,actualOrders:100,
      eventIdsWithMatchKeys:190,totalEventIds:200,
    });
    expect(result.status).toBe('healthy');
    expect(result.interpretation).toContain('not proof');
  });

  it('requires a control for creative variations but not a genuinely net-new concept',()=>{
    expect(()=>createCreativeExperimentVariant({
      id:'v1',axis:'hook_variation',hypothesis:'Different hook improves qualified clicks',evidenceRefs:['learning:1'],
    })).toThrow('CONTROL_REQUIRED');
    expect(createCreativeExperimentVariant({
      id:'v2',axis:'net_new_concept',hypothesis:'New concept reaches a different use case',evidenceRefs:['research:2'],
    }).axis).toBe('net_new_concept');
  });

  it('builds retargeting as evidence-backed proposals, never automatic outreach',()=>{
    const sequence=createRetargetingSequence({
      id:'retarget:1',sourceAudienceId:'audience:nonbuyers',
      steps:[
        {id:'step:1',kind:'objection_answer',hypothesis:'Answer the top observed checkout objection',evidenceRefs:['survey:1']},
        {id:'step:2',kind:'proof',hypothesis:'Add verified customer proof',evidenceRefs:['review:1'],creativeAssetIds:['asset:proof']},
        {id:'step:3',kind:'alternate_offer',hypothesis:'Test a lower-friction adjacent offer',evidenceRefs:['catalog:1'],offerId:'offer:2'},
      ],
    });
    expect(sequence.authority).toBe('PROPOSAL_ONLY');
    expect(sequence.steps).toHaveLength(3);
  });

  it('optimizes business contribution economics instead of ad-platform ROAS alone',()=>{
    const result=calculateAcquisitionEconomics({
      adSpend:1000,newCustomers:50,grossRevenue:5000,refunds:200,variableCosts:1800,paymentFees:150,fulfillmentCosts:350,
    });
    expect(result.cac).toBe(20);
    expect(result.contributionProfit).toBe(1500);
    expect(result.breakEvenCpa).toBe(50);
  });
});
