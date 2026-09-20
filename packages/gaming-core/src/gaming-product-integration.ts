import type {GamingLibraryCard,GamingResumePointer,GamingRuntimePathCandidate,GamingRuntimePathPolicy} from './gaming-product-fabric.js';
import {selectGamingRuntimePath} from './gaming-product-fabric.js';

export interface GamingHomeModel{cards:readonly GamingLibraryCard[];activeGameId?:string;controllerProfileId?:string;displayTarget?:string;}
export interface GamingPlayDecisionReceipt{gameId:string;runtimeId:string;pathId:string;controllerProfileId?:string;saveId?:string;authorizationRequired:true;reasons:readonly string[];}

export class GamingProductFacade{
 home(cards:readonly GamingLibraryCard[],state?:{activeGameId?:string;controllerProfileId?:string;displayTarget?:string}):GamingHomeModel{return{cards:[...cards],...state};}
 play(gameId:string,candidates:readonly GamingRuntimePathCandidate[],policy:GamingRuntimePathPolicy,resume?:GamingResumePointer,controllerProfileId?:string):GamingPlayDecisionReceipt{
   const decision=selectGamingRuntimePath(candidates,policy);
   return{gameId,runtimeId:decision.selected.runtimeId,pathId:decision.selected.id,controllerProfileId:controllerProfileId??resume?.controllerProfileId,saveId:resume?.saveId,authorizationRequired:true,reasons:decision.rejected.map(x=>`${x.id}:${x.reason}`)};
 }
}
export const G29_PRODUCT_ACCEPTANCE=Object.freeze([
 'unified-home','unified-library','single-play-action','automatic-runtime-selection','controller-profile',
 'controller-remap-before-g13','display-handoff','save-resume','session-history','latency-health',
 'runtime-switch','recovery-state','gaming-intelligence','assistant-authorization','zero-resource-stop',
] as const);
