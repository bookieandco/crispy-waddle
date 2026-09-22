import { describe, expect, it } from 'vitest';
import { assessCreativeAbExperiment } from './creative-ab-testing';

describe('Growth creative A/B testing',()=>{
  it('does not promote a tiny-sample apparent win',()=>{
    const result=assessCreativeAbExperiment({
      id:'ab:tiny',
      controlVariantId:'control',
      treatmentVariantIds:['horse-hook'],
      observations:[
        {variantId:'control',exposures:40,conversions:2,spend:40,contributionMargin:60},
        {variantId:'horse-hook',exposures:40,conversions:6,spend:40,contributionMargin:90},
      ],
      minimumExposuresPerVariant:500,
      minimumRelativeLift:0.1,
      minimumContributionRoas:1,
    });
    expect(result.status).toBe('insufficient-data');
    expect(result.bestSupportedTreatmentId).toBeUndefined();
    expect(result.comparisons[0]?.reasonCodes).toContain('GROWTH_AB_SAMPLE_INSUFFICIENT');
  });

  it('supports a material conversion lift only when statistical and economic evidence agree',()=>{
    const result=assessCreativeAbExperiment({
      id:'ab:supported',
      controlVariantId:'control',
      treatmentVariantIds:['story-hook'],
      observations:[
        {variantId:'control',exposures:5000,conversions:250,spend:2500,revenue:7500,contributionMargin:4000},
        {variantId:'story-hook',exposures:5000,conversions:360,spend:2600,revenue:10000,contributionMargin:5900},
      ],
      minimumExposuresPerVariant:1000,
      significanceLevel:0.05,
      minimumRelativeLift:0.15,
      minimumContributionRoas:1.5,
      maximumCac:10,
    });
    expect(result.status).toBe('supported-lift');
    expect(result.bestSupportedTreatmentId).toBe('story-hook');
    expect(result.comparisons[0]?.statisticallySignificant).toBe(true);
    expect(result.comparisons[0]?.economicsAdmissible).toBe(true);
  });

  it('rejects a statistically better creative when contribution economics fail',()=>{
    const result=assessCreativeAbExperiment({
      id:'ab:bad-economics',
      controlVariantId:'control',
      treatmentVariantIds:['expensive-hook'],
      observations:[
        {variantId:'control',exposures:5000,conversions:250,spend:1500,contributionMargin:3000},
        {variantId:'expensive-hook',exposures:5000,conversions:400,spend:7000,contributionMargin:3500},
      ],
      minimumExposuresPerVariant:1000,
      significanceLevel:0.05,
      minimumRelativeLift:0.1,
      minimumContributionRoas:1,
      maximumCac:15,
    });
    expect(result.status).toBe('no-supported-lift');
    expect(result.bestSupportedTreatmentId).toBeUndefined();
    expect(result.comparisons[0]?.reasonCodes).toContain('GROWTH_AB_CONTRIBUTION_ROAS_BELOW_FLOOR');
  });

  it('applies a multiple-comparison correction when testing several mutations',()=>{
    const result=assessCreativeAbExperiment({
      id:'ab:multi',
      controlVariantId:'control',
      treatmentVariantIds:['hook-a','hook-b','hook-c'],
      observations:[
        {variantId:'control',exposures:3000,conversions:150},
        {variantId:'hook-a',exposures:3000,conversions:165},
        {variantId:'hook-b',exposures:3000,conversions:175},
        {variantId:'hook-c',exposures:3000,conversions:158},
      ],
      minimumExposuresPerVariant:1000,
      significanceLevel:0.05,
      minimumRelativeLift:0.05,
    });
    expect(result.comparisons).toHaveLength(3);
    expect(result.comparisons.every(item=>item.confidenceLevel>0.98)).toBe(true);
    expect(result.authority).toBe('LEARNING_EVIDENCE_ONLY');
  });
});
