import {describe,expect,it} from 'vitest';
import {
  DIRECTOR_GENERATION_DEPLOYMENT_REQUIREMENT_KEY,
  loadDirectorGenerationArtifactDeployment,
  parseDirectorGenerationDeploymentRequirement,
} from './director-generation-artifact-deployment';

const requirement={
  deploymentId:'deployment:director:hunyuan:1',
  subsystem:'director',
  runtimeInstanceId:'runtime:runpod:pod-1',
  runtime:{
    runtimeName:'director-hunyuan-video-1.5',
    runtimeVersion:'1.0.0',
    platform:'linux',
    architecture:'x64',
    accelerator:'NVIDIA',
  },
  artifactId:'hunyuan-video-1.5:runtime-model-bundle',
  pinId:'artifact:hunyuan-video-1.5:model-bundle',
  admissionId:'admission:hunyuan:1',
  attestationId:'attestation:hunyuan:1',
};

describe('Director generation artifact deployment config',()=>{
  it('parses an exact Director deployment requirement',()=>{
    expect(parseDirectorGenerationDeploymentRequirement(requirement)).toEqual(requirement);
  });

  it('rejects a cross-subsystem requirement',()=>{
    expect(()=>parseDirectorGenerationDeploymentRequirement({...requirement,subsystem:'music'}))
      .toThrow('DIRECTOR_ARTIFACT_DEPLOYMENT_SUBSYSTEM_MISMATCH');
  });

  it('loads the service-role-only requirement from Director runtime config',async()=>{
    const query:any={
      select:()=>query,
      eq:(key:string,value:string)=>{
        expect(key).toBe('key');
        expect(value).toBe(DIRECTOR_GENERATION_DEPLOYMENT_REQUIREMENT_KEY);
        return query;
      },
      maybeSingle:async()=>({data:{key:DIRECTOR_GENERATION_DEPLOYMENT_REQUIREMENT_KEY,value:JSON.stringify(requirement)},error:null}),
    };
    const loaded=await loadDirectorGenerationArtifactDeployment({from:()=>query} as any);
    expect(loaded.requirement).toEqual(requirement);
    expect(loaded.ledger).toBeDefined();
    expect(Number.isNaN(Date.parse(loaded.verifiedAt))).toBe(false);
  });

  it('fails closed when no durable requirement is configured',async()=>{
    const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error:null})};
    await expect(loadDirectorGenerationArtifactDeployment({from:()=>query} as any))
      .rejects.toThrow('DIRECTOR_ARTIFACT_DEPLOYMENT_REQUIREMENT_NOT_CONFIGURED');
  });
});
