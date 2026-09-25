import {describe,expect,it} from 'vitest';
import {evaluateActionSequenceRisk,evaluateReferenceIterationQuality} from './action-sequence-control';

const policy={
  id:'fight-risk:v1',
  highRiskThreshold:.65,
  severeRiskThreshold:.85,
  weights:{subjectMotion:1.5,cameraMotion:1,effectsDensity:1,interactionComplexity:1.5},
};

describe('action sequence control',()=>{
  it('flags fast multi-character effects shots for stricter deformation and detail QC',()=>{
    const result=evaluateActionSequenceRisk({
      id:'risk:fight-1',projectId:'p',shotId:'fight-1',
      subjectMotion:.95,cameraMotion:.85,effectsDensity:.9,interactionComplexity:.95,
      identityCritical:true,evidenceIds:['board:fight','motion-plan:1'],
    },policy);
    expect(result.level).toBe('severe');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_ACTION_DEFORMATION_RISK_HIGH',
      'DIRECTOR_ACTION_IDENTITY_RISK_REQUIRES_STRICT_QC',
    ]));
    expect(result.requiredQcMetrics).toEqual(expect.arrayContaining([
      'identity-stability','body-structure','temporal-flicker','motion-plausibility','detail-retention',
    ]));
  });

  it('keeps slower low-effect action at lower risk without inventing a universal threshold',()=>{
    const result=evaluateActionSequenceRisk({
      id:'risk:slow',projectId:'p',shotId:'slow',
      subjectMotion:.25,cameraMotion:.1,effectsDensity:.1,interactionComplexity:.2,
      identityCritical:true,evidenceIds:['board:slow'],
    },policy);
    expect(result.level).toBe('low');
    expect(result.requiredQcMetrics).toEqual(['motion-plausibility','identity-stability']);
  });

  it('rejects iterated reference images once configured edit depth or quality bounds are exceeded',()=>{
    expect(evaluateReferenceIterationQuality({
      id:'edit:7',projectId:'p',assetId:'character-edit-7',parentAssetId:'character-edit-6',
      editDepth:7,identityScore:.86,detailScore:.58,evidenceIds:['qc:face','qc:detail'],
    },{
      id:'reference-edit:v1',maximumEditDepth:5,minimumIdentityScore:.8,minimumDetailScore:.7,
    })).toEqual(expect.objectContaining({
      admissible:false,
      reasons:expect.arrayContaining([
        'DIRECTOR_REFERENCE_ITERATION_DEPTH_EXCEEDED',
        'DIRECTOR_REFERENCE_ITERATION_DETAIL_LOSS',
      ]),
    }));
  });

  it('requires provenance parentage for edited references',()=>{
    expect(evaluateReferenceIterationQuality({
      id:'edit:1',projectId:'p',assetId:'edit-1',
      editDepth:1,identityScore:.9,detailScore:.9,evidenceIds:['qc:1'],
    },{
      id:'reference-edit:v1',maximumEditDepth:5,minimumIdentityScore:.8,minimumDetailScore:.7,
    }).reasons).toContain('DIRECTOR_REFERENCE_ITERATION_PARENT_REQUIRED');
  });
});
