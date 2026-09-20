export interface PredictionRecord{predictionId:string;subjectId:string;probability:number;modelId:string;modelVersion:string;informationCutoff:string;issuedAt:string;evidenceRefs:readonly string[];evidenceSnapshotHash:string}
export interface ResolutionRecord{predictionId:string;authority:string;ruleVersion:string;outcome:string;resolvedAt:string;evidenceRefs:readonly string[]}
export function assertPrediction(p:PredictionRecord){if(p.probability<0||p.probability>1)throw new Error('MONEY_PREDICTION_PROBABILITY_INVALID');if(!p.evidenceSnapshotHash)throw new Error('MONEY_PREDICTION_UNPROVEN')}
export function brierScore(p:number,outcome:0|1){return(p-outcome)**2}
