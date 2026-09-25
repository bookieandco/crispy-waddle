import {objectDetectionsToVisualEvidence,type ObjectDetectionPrediction} from './object-detection-observation.js';
import {ROBOFLOW_PEOPLE_DETECTION_O4RDR_V12} from './vision-model-profile.js';
import type {VisualAnnotationEvidence} from './visual-observation-evidence.js';

export interface RoboflowPredictionLike {
  class?:string;
  class_name?:string;
  confidence:number;
  x:number;
  y:number;
  width:number;
  height:number;
}

export interface RoboflowPeopleResultLike {
  predictions?:readonly RoboflowPredictionLike[];
  image?:{width?:number;height?:number};
}

export interface RoboflowPeopleObservationInput {
  id:string;
  projectId:string;
  assetId:string;
  observedAt:string;
  frame:number;
  fps:number;
  imageWidth:number;
  imageHeight:number;
  result:RoboflowPeopleResultLike;
  evidenceRefs:readonly string[];
}

export function roboflowPeopleToVisualEvidence(
  input:RoboflowPeopleObservationInput,
):VisualAnnotationEvidence{
  const predictions:ObjectDetectionPrediction[]=(input.result.predictions??[])
    .flatMap(prediction=>{
      const label=(prediction.class??prediction.class_name??'').trim().toLowerCase();
      if(!isPersonLabel(label)) return [];
      return [{
        className:'person',
        confidence:prediction.confidence,
        x:prediction.x,
        y:prediction.y,
        width:prediction.width,
        height:prediction.height,
      }];
    });

  return objectDetectionsToVisualEvidence({
    id:input.id,
    projectId:input.projectId,
    assetId:input.assetId,
    provider:ROBOFLOW_PEOPLE_DETECTION_O4RDR_V12.provider,
    modelId:ROBOFLOW_PEOPLE_DETECTION_O4RDR_V12.modelId,
    observedAt:input.observedAt,
    frame:input.frame,
    fps:input.fps,
    imageWidth:input.imageWidth,
    imageHeight:input.imageHeight,
    predictions,
    allowedClasses:ROBOFLOW_PEOPLE_DETECTION_O4RDR_V12.classes,
    evidenceRefs:input.evidenceRefs,
    limitations:[
      'Person detection provides presence and region evidence only.',
      'It does not establish identity, demographics, intent or continuity across frames.',
      'Temporal identity and masks require a governed tracking provider such as SAM2.',
    ],
  });
}

function isPersonLabel(label:string):boolean{
  return label==='person'||label==='people'||label==='human';
}
