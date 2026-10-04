export type HomebaseSubsystemMode='LOCAL_AUTHORITY'|'LOCAL_WITH_RUNPOD_RESEARCH'|'LOCAL_WITH_RUNPOD_GPU'|'LOCAL_WITH_RUNPOD_BOTH';

export type HomebaseSubsystemMigration={
  subsystem:string;
  mode:HomebaseSubsystemMode;
  canonicalState:'HOMEBASE';
  cloudAuthority:false;
  externalExecutionIndependent:boolean;
};

export const HOMEBASE_SUBSYSTEMS:readonly HomebaseSubsystemMigration[]=Object.freeze([
  {subsystem:'jllm',mode:'LOCAL_WITH_RUNPOD_GPU',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'memory',mode:'LOCAL_AUTHORITY',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'director',mode:'LOCAL_WITH_RUNPOD_GPU',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'music',mode:'LOCAL_WITH_RUNPOD_GPU',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'money',mode:'LOCAL_WITH_RUNPOD_RESEARCH',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'shark',mode:'LOCAL_WITH_RUNPOD_RESEARCH',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'sports',mode:'LOCAL_WITH_RUNPOD_BOTH',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'opportunity',mode:'LOCAL_WITH_RUNPOD_RESEARCH',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'overage',mode:'LOCAL_WITH_RUNPOD_RESEARCH',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'crm',mode:'LOCAL_AUTHORITY',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'pupsonstuff',mode:'LOCAL_WITH_RUNPOD_GPU',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'campaign',mode:'LOCAL_WITH_RUNPOD_RESEARCH',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'safety',mode:'LOCAL_AUTHORITY',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'social-growth',mode:'LOCAL_WITH_RUNPOD_BOTH',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
  {subsystem:'jhadina-tv',mode:'LOCAL_AUTHORITY',canonicalState:'HOMEBASE',cloudAuthority:false,externalExecutionIndependent:true},
]);

export function validateHomebaseSubsystemMigrations(items:readonly HomebaseSubsystemMigration[]):readonly string[]{
  const r:string[]=[];
  const seen=new Set<string>();
  for(const item of items){
    if(seen.has(item.subsystem))r.push('HOMEBASE_SUBSYSTEM_DUPLICATE:'+item.subsystem);
    seen.add(item.subsystem);
    if(item.canonicalState!=='HOMEBASE')r.push('HOMEBASE_SUBSYSTEM_AUTHORITY_INVALID:'+item.subsystem);
    if(item.cloudAuthority!==false)r.push('HOMEBASE_SUBSYSTEM_CLOUD_AUTHORITY_FORBIDDEN:'+item.subsystem);
  }
  return Object.freeze([...new Set(r)]);
}
