import { describe, expect, it } from 'vitest';
import {
  chooseBestProductReference,
  evaluateProductDerivedReference,
  planProductReferenceBootstrap,
} from './product-reference-bootstrap.js';

describe('product reference bootstrap',()=>{
  it('plans a product sheet from one owned reference and exact label text',()=>{
    const plan=planProductReferenceBootstrap({
      id:'bootstrap:zesta',
      projectId:'ad-project',
      productId:'zesta:lime',
      displayName:'Zesta Lime + Chili Chips',
      uploads:[{
        id:'upload:front',
        assetId:'asset:zesta-front',
        sha256:'a'.repeat(64),
        view:'front',
        rightsRef:'rights:brand-owned',
        evidenceIds:['upload:verified'],
      }],
      requiredLabelText:['FRESH ZESTY LIME','BOLD CHILI KICK','CRUNCHY POTATO CHIPS'],
    });

    expect(plan.canonicalUploadId).toBe('upload:front');
    expect(plan.buildLabelCloseups).toBe(true);
    expect(plan.stages).toContain('label-closeups');
    expect(plan.targetViews).toContain('back');
  });

  it('rejects attractive output when packaging geometry or label text drifts',()=>{
    const result=evaluateProductDerivedReference({
      id:'candidate:bad',
      productId:'zesta:lime',
      assetId:'asset:candidate',
      sha256:'b'.repeat(64),
      view:'front',
      parentReferenceAssetIds:['asset:zesta-front'],
      identityScore:0.96,
      geometryScore:0.71,
      labelAccuracyScore:0.55,
      qualityScore:0.98,
      evidenceIds:['vision:identity','ocr:label'],
      generationAttemptId:'attempt:1',
    },{
      minimumIdentity:0.9,
      minimumGeometry:0.9,
      minimumLabelAccuracy:0.9,
      minimumQuality:0.8,
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain('DIRECTOR_PRODUCT_GEOMETRY_LOW');
    expect(result.reasons).toContain('DIRECTOR_PRODUCT_LABEL_ACCURACY_LOW');
  });

  it('selects the strongest identity-preserving product reference',()=>{
    const policy={
      minimumIdentity:0.85,
      minimumGeometry:0.85,
      minimumLabelAccuracy:0.9,
      minimumQuality:0.8,
    };
    const base={
      productId:'zesta:lime',
      view:'detail' as const,
      parentReferenceAssetIds:['asset:zesta-front'],
      evidenceIds:['vision:1','ocr:1'],
    };
    const best=chooseBestProductReference([
      {...base,id:'a',assetId:'asset:a',sha256:'a'.repeat(64),identityScore:0.91,geometryScore:0.9,labelAccuracyScore:0.94,qualityScore:0.88,generationAttemptId:'attempt:a'},
      {...base,id:'b',assetId:'asset:b',sha256:'b'.repeat(64),identityScore:0.97,geometryScore:0.95,labelAccuracyScore:0.98,qualityScore:0.94,generationAttemptId:'attempt:b'},
    ],policy);
    expect(best?.id).toBe('b');
  });
});
