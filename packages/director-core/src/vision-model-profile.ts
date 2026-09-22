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

export function visionModelAllowsClass(
  profile: DirectorVisionModelProfile,
  className: string,
): boolean {
  return profile.classes.includes(className);
}
