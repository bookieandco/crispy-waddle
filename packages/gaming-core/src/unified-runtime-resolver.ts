import {isRuntimeCompatible, type GameRuntimeRequirements, type RuntimeCompatibility} from './runtime-compatibility.js';
import {selectRuntime, type RuntimeCandidate, type RuntimeSelectionPolicy} from './runtime-selection.js';
export interface UnifiedRuntimeCandidate extends RuntimeCandidate, RuntimeCompatibility { }
export interface UnifiedRuntimeRequest {requirements:GameRuntimeRequirements;selectionPolicy:RuntimeSelectionPolicy;}
export function resolveRuntime(candidates:readonly UnifiedRuntimeCandidate[],request:UnifiedRuntimeRequest):UnifiedRuntimeCandidate|undefined{const compatible=candidates.filter(c=>isRuntimeCompatible(request.requirements,c));return selectRuntime(compatible,request.selectionPolicy) as UnifiedRuntimeCandidate|undefined;}
