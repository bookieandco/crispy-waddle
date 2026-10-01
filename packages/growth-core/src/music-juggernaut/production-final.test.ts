import {describe,expect,it} from 'vitest';
import {
  assessPaidScaleHealth,
  assessPromotionTrafficQuality,
  certifyMusicJuggernautProductionFinal,
} from './production-final.js';

describe('MUSIC-JUGGERNAUT.PRODUCTION.FINAL',()=>{
  it('passes every adversarial production check',()=>{
    const report=certifyMusicJuggernautProductionFinal();
    expect(report.passed).toBe(true);
    expect(report.corePassed).toBe(true);
    expect(report.externalActionsStarted).toBe(false);
    expect(report.checks.every((check)=>check.passed)).toBe(true);
    expect(report.checks.map((check)=>check.name)).toContain('fake-viral-traffic-cannot-open-attack');
    expect(report.checks.map((check)=>check.name)).toContain('consequential-actions-remain-human-authorized');
  });

  it('blocks suspicious traffic from learning',()=>{
    const result=assessPromotionTrafficQuality({
      exposures:10000,clicks:500,songActions:0,repeatListeners:0,directFanCaptures:0,
      botRisk:0.8,attributionConfidence:0.2,evidenceRefs:['traffic:test'],
    });
    expect(result.status).toBe('BLOCK');
    expect(result.learningEligible).toBe(false);
  });

  it('stops paid scale when conversion falls and CAC rises',()=>{
    const result=assessPaidScaleHealth({
      priorConversionRate:0.1,currentConversionRate:0.04,
      priorAcquisitionCostMinor:400,currentAcquisitionCostMinor:700,
      sampleSize:500,minimumSampleSize:100,evidenceRefs:['paid:test'],
    });
    expect(result.action).toBe('STOP');
    expect(result.canIncreaseBudget).toBe(false);
  });
});
