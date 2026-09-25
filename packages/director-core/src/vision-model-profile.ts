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
