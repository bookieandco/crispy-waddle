import {describe,expect,it} from 'vitest';
import {evaluateEditorialCutDecision,EDITORIAL_RULE_OF_SIX_ORDER} from './editorial-cut-decision';

const assessment=(criterion:(typeof EDITORIAL_RULE_OF_SIX_ORDER)[number],disposition:'supports'|'neutral'|'conflicts'|'intentional-disruption')=>({
  criterion,
  disposition,
  rationale:disposition==='intentional-disruption'
    ? 'Intentional disruption supports the scene effect.'
    : 'Observed against the current edit.',
  evidenceIds:[`evidence:${criterion}`],
});

describe('editorial cut decision',()=>{
  it('prioritizes emotion story and rhythm while allowing intentional lower-order disruption',()=>{
    const result=evaluateEditorialCutDecision({
      id:'cut:1',
      projectId:'p',
      timelineVersionId:'timeline:v1',
      beforeClipId:'clip:a',
      afterClipId:'clip:b',
      positiveReasonToCut:'Move from realization to reaction at the emotional beat.',
      assessments:[
        assessment('emotion','supports'),
        assessment('story','supports'),
        assessment('rhythm','supports'),
        assessment('eye-trace','intentional-disruption'),
        assessment('screen-plane','neutral'),
        assessment('spatial-continuity','neutral'),
      ],
      evidenceIds:['editor:review'],
      authority:'DIRECTOR_EDITORIAL_CUT_DECISION',
    });
    expect(result.admissible).toBe(true);
    expect(result.reviewRequired).toBe(false);
  });

  it('rejects a cut that conflicts with the primary emotional/story/rhythm layer',()=>{
    const result=evaluateEditorialCutDecision({
      id:'cut:2',
      projectId:'p',
      timelineVersionId:'timeline:v1',
      beforeClipId:'clip:a',
      afterClipId:'clip:b',
      positiveReasonToCut:'Technical continuity only.',
      assessments:[
        assessment('emotion','conflicts'),
        assessment('story','supports'),
        assessment('rhythm','supports'),
        assessment('eye-trace','supports'),
        assessment('screen-plane','supports'),
        assessment('spatial-continuity','supports'),
      ],
      evidenceIds:['editor:review'],
      authority:'DIRECTOR_EDITORIAL_CUT_DECISION',
    });
    expect(result.reasons).toContain('DIRECTOR_EDITORIAL_CUT_PRIMARY_CONFLICT:emotion');
  });

  it('requires all six observations rather than cutting on a fixed timer',()=>{
    const result=evaluateEditorialCutDecision({
      id:'cut:3',
      projectId:'p',
      timelineVersionId:'timeline:v1',
      beforeClipId:'clip:a',
      afterClipId:'clip:b',
      positiveReasonToCut:'',
      assessments:[assessment('emotion','supports')],
      evidenceIds:['editor:review'],
      authority:'DIRECTOR_EDITORIAL_CUT_DECISION',
    });
    expect(result.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_EDITORIAL_CUT_POSITIVE_REASON_REQUIRED',
      'DIRECTOR_EDITORIAL_CUT_CRITERION_REQUIRED:story',
      'DIRECTOR_EDITORIAL_CUT_CRITERION_REQUIRED:rhythm',
    ]));
  });
});
