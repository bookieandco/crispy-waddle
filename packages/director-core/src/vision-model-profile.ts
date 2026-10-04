export interface DirectorVisionModelProfile {
  provider: string;
  modelId: string;
  task: 'object-detection' | 'segmentation' | 'keypoints' | 'classification';
  classes: readonly string[];
  license: string;
  sourceRef: string;
  intendedUse: string;
  authority: 'OBSERVATION_ONLY';
}

export const ROBOFLOW_CARTOON_56LLR_V11: DirectorVisionModelProfile = Object.freeze({
  provider: 'roboflow-serverless',
  modelId: 'cartoon-56llr/11',
  task: 'object-detection',
  classes: Object.freeze(['donald', 'mickey', 'minion', 'olaf', 'pooh', 'pumba']),
  license: 'CC BY 4.0',
  sourceRef: 'roboflow-universe:dddddddddddddxdddd/cartoon-56llr',
  intendedUse: 'Narrow cartoon-character presence/location evidence. Not general animation or scene understanding.',
  authority: 'OBSERVATION_ONLY',
});

export const ULTRALYTICS_YOLO26N_COCO: DirectorVisionModelProfile = Object.freeze({
  provider: 'ultralytics-external',
  modelId: 'yolo26n',
  task: 'object-detection',
  classes: Object.freeze([
    'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat',
    'traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat',
    'dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack',
    'umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball',
    'kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket',
    'bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple',
    'sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair',
    'couch','potted plant','bed','dining table','toilet','tv','laptop','mouse',
    'remote','keyboard','cell phone','microwave','oven','toaster','sink',
    'refrigerator','book','clock','vase','scissors','teddy bear','hair drier',
    'toothbrush',
  ]),
  license: 'AGPL-3.0 unless separately licensed by Ultralytics for the deployment',
  sourceRef: 'github:ultralytics/ultralytics',
  intendedUse: 'External/self-hosted automatic object detection and tracking evidence. Never canonical truth or identity evidence.',
  authority: 'OBSERVATION_ONLY',
});

export const ROBOFLOW_PEOPLE_DETECTION_O4RDR_V12: DirectorVisionModelProfile = Object.freeze({
  provider: 'roboflow-serverless',
  modelId: 'people-detection-o4rdr/12',
  task: 'object-detection',
  classes: Object.freeze(['person']),
  license: 'Upstream Roboflow Universe project terms; verify before redistribution',
  sourceRef: 'roboflow-universe:leo-ueno/people-detection-o4rdr',
  intendedUse: 'Person presence and bounding-region evidence only. No identity, demographic inference or temporal identity claims.',
  authority: 'OBSERVATION_ONLY',
});

export function visionModelAllowsClass(
  profile: DirectorVisionModelProfile,
  className: string,
): boolean {
  return profile.classes.includes(className);
}
