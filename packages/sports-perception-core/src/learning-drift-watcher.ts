export interface DriftWindow{metric:string;baseline:number;current:number;tolerance:number;}
export interface DriftReport{drifted:boolean;signals:readonly string[];}
export function detectLearningDrift(windows:readonly DriftWindow[]):DriftReport{const signals=windows.filter(x=>Number.isFinite(x.baseline)&&Number.isFinite(x.current)&&Math.abs(x.current-x.baseline)>x.tolerance).map(x=>x.metric).sort();return Object.freeze({drifted:signals.length>0,signals:Object.freeze(signals)});}
