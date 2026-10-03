import type {SupabaseClient} from '@supabase/supabase-js';
import type {ArtifactDeploymentRequirement,ArtifactRuntimeDescriptor} from '@jhadina/reference-provenance';
import {SupabaseArtifactAdmissionLedger} from './supabase-artifact-admission-ledger';

export const DIRECTOR_GENERATION_DEPLOYMENT_REQUIREMENT_KEY='director_generation_artifact_deployment_requirement';

const req=(v:unknown,code:string):string=>{
 if(typeof v!=='string'||!v.trim())throw new Error(code);
 return v.trim();
};
const runtime=(v:unknown):ArtifactRuntimeDescriptor=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_RUNTIME_INVALID');
 const o=v as Record<string,unknown>;
 const accelerator=o.accelerator;
 if(accelerator!==undefined&&typeof accelerator!=='string')throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_RUNTIME_ACCELERATOR_INVALID');
 return {
  runtimeName:req(o.runtimeName,'DIRECTOR_ARTIFACT_DEPLOYMENT_RUNTIME_NAME_REQUIRED'),
  runtimeVersion:req(o.runtimeVersion,'DIRECTOR_ARTIFACT_DEPLOYMENT_RUNTIME_VERSION_REQUIRED'),
  platform:req(o.platform,'DIRECTOR_ARTIFACT_DEPLOYMENT_RUNTIME_PLATFORM_REQUIRED'),
  architecture:req(o.architecture,'DIRECTOR_ARTIFACT_DEPLOYMENT_RUNTIME_ARCH_REQUIRED'),
  ...(typeof accelerator==='string'&&accelerator.trim()?{accelerator:accelerator.trim()}:{}),
 };
};

export function parseDirectorGenerationDeploymentRequirement(v:unknown):ArtifactDeploymentRequirement{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_REQUIREMENT_INVALID');
 const o=v as Record<string,unknown>;
 const result:ArtifactDeploymentRequirement={
  deploymentId:req(o.deploymentId,'DIRECTOR_ARTIFACT_DEPLOYMENT_ID_REQUIRED'),
  subsystem:req(o.subsystem,'DIRECTOR_ARTIFACT_DEPLOYMENT_SUBSYSTEM_REQUIRED'),
  runtimeInstanceId:req(o.runtimeInstanceId,'DIRECTOR_ARTIFACT_DEPLOYMENT_RUNTIME_INSTANCE_REQUIRED'),
  runtime:runtime(o.runtime),
  artifactId:req(o.artifactId,'DIRECTOR_ARTIFACT_DEPLOYMENT_ARTIFACT_ID_REQUIRED'),
  pinId:req(o.pinId,'DIRECTOR_ARTIFACT_DEPLOYMENT_PIN_ID_REQUIRED'),
  admissionId:req(o.admissionId,'DIRECTOR_ARTIFACT_DEPLOYMENT_ADMISSION_ID_REQUIRED'),
  attestationId:req(o.attestationId,'DIRECTOR_ARTIFACT_DEPLOYMENT_ATTESTATION_ID_REQUIRED'),
 };
 if(result.subsystem!=='director')throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_SUBSYSTEM_MISMATCH');
 return result;
}

export async function loadDirectorGenerationArtifactDeployment(client:SupabaseClient){
 const {data,error}=await client.from('director_runtime_config').select('key,value')
  .eq('key',DIRECTOR_GENERATION_DEPLOYMENT_REQUIREMENT_KEY).maybeSingle();
 if(error)throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_CONFIG_READ_FAILED:'+error.message);
 if(!data?.value)throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_REQUIREMENT_NOT_CONFIGURED');
 let parsed:unknown;
 try{parsed=JSON.parse(String(data.value));}catch{throw new Error('DIRECTOR_ARTIFACT_DEPLOYMENT_REQUIREMENT_JSON_INVALID');}
 return {ledger:new SupabaseArtifactAdmissionLedger(client),requirement:parseDirectorGenerationDeploymentRequirement(parsed),verifiedAt:new Date().toISOString()};
}
