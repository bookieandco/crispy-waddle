import { describe, expect, it } from 'vitest';
import {
  buildIsolatedAdCreativeExperimentPlan,
  createAdCreativeVariantLineage,
} from './ad-creative-lineage.js';

function variant(input:{
  id:string;
  axis:'hook'|'product_variant'|'visual_treatment';
  control?:string;
  product?:string;
  style?:string;
  mutationRef?:string;
}) {
  return createAdCreativeVariantLineage({
    id:input.id,
    contentProjectId:'content:ad-1',
    conceptId:'concept:focus',
    platform:'instagram',
    productIdentityRef:input.product??'product:zesta:lime',
    styleIdentityRef:input.style??'style:zesta:cinematic',
    mutationAxis:input.axis,
    mutationRef:input.mutationRef??`mutation:${input.id}`,
    ...(input.control?{controlVariantId:input.control}:{}),
    fixedDimensionRefs:{
      storyStructure:'story:focus-v1',
      audience:'audience:snackers',
      offer:'offer:base',
      cta:'cta:shop-now',
    },
    director:{
      directorProjectId:'director:ad-project',
      directorArtifactId:`artifact:${input.id}`,
      artifactSha256:input.id==='control'
        ?'a'.repeat(64)
        :input.id==='hook-b'?'b'.repeat(64):'c'.repeat(64),
      reviewDecisionId:`review:${input.id}`,
      evidenceRefs:[`director-qc:${input.id}`],
    },
    evidenceRefs:[`growth-brief:${input.id}`],
    createdAt:'2026-09-22T19:00:00.000Z',
  });
}

describe('ad creative lineage experiments',()=>{
  it('builds an isolated one-axis experiment with exact Director artifact lineage',()=>{
    const control=variant({id:'control',axis:'hook'});
    const hookB=variant({id:'hook-b',axis:'hook',control:'control'});
    const hookC=variant({id:'hook-c',axis:'hook',control:'control'});

    const plan=buildIsolatedAdCreativeExperimentPlan({
      id:'ad-exp:hook',
      control,
      treatments:[hookB,hookC],
      hypotheses:{
        'hook-b':'Immediate surreal interruption improves conversion rate.',
        'hook-c':'Immediate product demonstration improves conversion rate.',
      },
      evidenceRefs:['experiment-plan:1'],
    });

    expect(plan.mutationAxis).toBe('hook');
    expect(plan.binaryExperiments).toHaveLength(2);
    expect(plan.binaryExperiments[0]?.alpha).toBeCloseTo(0.025);
    expect(plan.variantLineageRefs['hook-b']).toContain('artifact:hook-b');
    expect(plan.authority).toBe('LEARNING_PLAN_ONLY');
  });

  it('fails when a supposedly fixed dimension drifts',()=>{
    const control=variant({id:'control',axis:'hook'});
    const treatment=createAdCreativeVariantLineage({
      ...variant({id:'hook-b',axis:'hook',control:'control'}),
      fixedDimensionRefs:{
        storyStructure:'story:focus-v2',
        audience:'audience:snackers',
        offer:'offer:base',
        cta:'cta:shop-now',
      },
    });

    expect(()=>buildIsolatedAdCreativeExperimentPlan({
      id:'ad-exp:bad',
      control,
      treatments:[treatment],
      hypotheses:{'hook-b':'Hook B improves conversion.'},
      evidenceRefs:['experiment-plan:bad'],
    })).toThrow(/GROWTH_AD_EXPERIMENT_INVARIANT_DRIFT:storyStructure/);
  });

  it('permits product identity to change only when product variant is the declared axis',()=>{
    const control=variant({id:'control',axis:'product_variant',product:'product:zesta:lime'});
    const treatment=variant({
      id:'hook-b',
      axis:'product_variant',
      control:'control',
      product:'product:zesta:mango',
    });

    const plan=buildIsolatedAdCreativeExperimentPlan({
      id:'ad-exp:flavor',
      control,
      treatments:[treatment],
      hypotheses:{'hook-b':'Mango variant performs differently for this audience.'},
      evidenceRefs:['catalog:flavor-test'],
    });
    expect(plan.mutationAxis).toBe('product_variant');
  });

  it('rejects visual-style drift during a hook-only test',()=>{
    const control=variant({id:'control',axis:'hook'});
    const treatment=variant({
      id:'hook-b',
      axis:'hook',
      control:'control',
      style:'style:zesta:neon',
    });

    expect(()=>buildIsolatedAdCreativeExperimentPlan({
      id:'ad-exp:style-drift',
      control,
      treatments:[treatment],
      hypotheses:{'hook-b':'Hook B improves conversion.'},
      evidenceRefs:['experiment-plan:style-drift'],
    })).toThrow(/GROWTH_AD_EXPERIMENT_STYLE_IDENTITY_DRIFT/);
  });
});
