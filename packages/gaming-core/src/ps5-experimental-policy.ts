import type {Ps5ExperimentalReference,Ps5ExperimentalSafetyClass} from './ps5-experimental-catalog.js';

export type Ps5ExperimentalAction=
  |'catalog-read'
  |'state-observe'
  |'emulator-launch'
  |'home-integration'
  |'homebrew-metadata'
  |'payload-execute'
  |'exploit-run'
  |'privilege-escalate'
  |'auto-load-payload';

export interface Ps5ExperimentalAuthorizationContext {
  experimentalModeEnabled:boolean;
  explicitUserApproval:boolean;
  action:Ps5ExperimentalAction;
  reference:Ps5ExperimentalReference;
}

export interface Ps5ExperimentalAuthorizationResult {
  allowed:boolean;
  reason:
    |'authorized'
    |'experimental-mode-disabled'
    |'explicit-approval-required'
    |'restricted-action'
    |'reference-safety-class-mismatch';
}

const RESTRICTED_ACTIONS=new Set<Ps5ExperimentalAction>([
  'payload-execute',
  'exploit-run',
  'privilege-escalate',
  'auto-load-payload',
]);

const ALLOWED_BY_CLASS:Readonly<Record<Ps5ExperimentalSafetyClass,readonly Ps5ExperimentalAction[]>>={
  'metadata-only':['catalog-read','homebrew-metadata'],
  observation:['catalog-read','state-observe','home-integration'],
  'emulator-runtime':['catalog-read','emulator-launch'],
  'restricted-execution':['catalog-read','homebrew-metadata'],
};

export function authorizePs5ExperimentalAction(
  context:Ps5ExperimentalAuthorizationContext,
):Ps5ExperimentalAuthorizationResult{
  if(!context.experimentalModeEnabled)return{allowed:false,reason:'experimental-mode-disabled'};
  if(RESTRICTED_ACTIONS.has(context.action))return{allowed:false,reason:'restricted-action'};
  if(!context.explicitUserApproval)return{allowed:false,reason:'explicit-approval-required'};
  if(!ALLOWED_BY_CLASS[context.reference.safetyClass].includes(context.action)){
    return{allowed:false,reason:'reference-safety-class-mismatch'};
  }
  return{allowed:true,reason:'authorized'};
}

export function assertPs5ExperimentalAuthorized(context:Ps5ExperimentalAuthorizationContext):void{
  const result=authorizePs5ExperimentalAction(context);
  if(!result.allowed)throw new Error(`PS5 experimental action denied: ${result.reason}`);
}
