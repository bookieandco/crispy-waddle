import {describe,expect,it} from 'vitest';
import {evaluateFinalExportInspection} from './final-export-inspection';

describe('final export inspection',()=>{
  it('admits a watched-through publish and clean export with no observed defects',()=>{
    expect(evaluateFinalExportInspection({
      id:'final-qc:p',
      projectId:'p',
      variants:[
        {id:'publish',assetId:'render:subtitled',purpose:'publish',evidenceIds:['probe:publish']},
        {id:'clean',assetId:'render:clean',purpose:'clean-no-subtitles',evidenceIds:['probe:clean']},
      ],
      watchedStartToFinish:true,
      watchPasses:2,
      defects:[],
      evidenceIds:['reviewer:final-watch'],
      authority:'DIRECTOR_FINAL_EXPORT_INSPECTION',
    }).admissible).toBe(true);
  });

  it('fails when a black frame or offline-media card is seen',()=>{
    const result=evaluateFinalExportInspection({
      id:'final-qc:p',
      projectId:'p',
      variants:[{id:'publish',assetId:'render:1',purpose:'publish',evidenceIds:['probe:1']}],
      watchedStartToFinish:true,
      watchPasses:1,
      defects:[
        {id:'defect:1',variantId:'publish',kind:'black-frame',startSeconds:12,endSeconds:12.04,note:'single unexpected black frame',evidenceIds:['frame:300']},
        {id:'defect:2',variantId:'publish',kind:'media-offline',startSeconds:44,endSeconds:45,note:'offline placeholder visible',evidenceIds:['frame:1056']},
      ],
      evidenceIds:['reviewer:watch'],
      authority:'DIRECTOR_FINAL_EXPORT_INSPECTION',
    });
    expect(result.admissible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_FINAL_EXPORT_DEFECT_PRESENT:black-frame',
      'DIRECTOR_FINAL_EXPORT_DEFECT_PRESENT:media-offline',
    ]));
  });
});
