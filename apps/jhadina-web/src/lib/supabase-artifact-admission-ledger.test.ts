import {describe,expect,it} from 'vitest';
import type {ArtifactAdmissionReceipt,RuntimeArtifactAttestation} from '@jhadina/reference-provenance';
import {SupabaseArtifactAdmissionLedger} from './supabase-artifact-admission-ledger';

const authority={runtimeAuthority:'NONE',policyAuthority:'NONE',executionAuthority:'NONE',factualAuthority:'NONE'} as const;
const runtime={runtimeName:'director-hunyuan',runtimeVersion:'1',platform:'linux',architecture:'x64',accelerator:'NVIDIA'};
const admission:ArtifactAdmissionReceipt={
 schemaVersion:'REF-PROV-05',admissionId:'admission:1',pinId:'pin:1',referenceId:'provider:hunyuan',
 artifactId:'hunyuan-video-1.5:runtime-model-bundle',artifactDigest:'sha256:'+'a'.repeat(64),
 pinHash:'pin-hash',sourceVerificationId:'source:1',sourceVerificationHash:'source-hash',
 compatibilityManifestId:'manifest:1',compatibilityManifestHash:'manifest-hash',runtime,
 activeProviderContractIds:[],providerContractDigests:{},licenseBasis:'EXPLICIT_REVIEW',
 licenseReviewReceiptId:'license:1',registryHash:'registry',admittedAt:'2026-10-03T20:00:00Z',
 receiptHash:'b'.repeat(64),authority,
};
const attestation:RuntimeArtifactAttestation={
 schemaVersion:'REF-PROV-05',attestationId:'attestation:1',admissionId:admission.admissionId,
 admissionReceiptHash:admission.receiptHash,pinId:admission.pinId,artifactId:admission.artifactId,
 artifactDigest:admission.artifactDigest,runtimeInstanceId:'runtime:pod:1',runtime,
 loadedAt:'2026-10-03T20:01:00Z',attestationHash:'c'.repeat(64),authority,
};

describe('SupabaseArtifactAdmissionLedger',()=>{
 it('reads a durable admission and validates row/hash binding',async()=>{
  const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{
   admission_id:admission.admissionId,receipt_hash:admission.receiptHash,receipt_json:admission,
  },error:null})};
  const ledger=new SupabaseArtifactAdmissionLedger({from:()=>query} as any);
  await expect(ledger.getAdmission(admission.admissionId)).resolves.toEqual(admission);
 });

 it('rejects a corrupt admission row',async()=>{
  const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{
   admission_id:admission.admissionId,receipt_hash:'d'.repeat(64),receipt_json:admission,
  },error:null})};
  const ledger=new SupabaseArtifactAdmissionLedger({from:()=>query} as any);
  await expect(ledger.getAdmission(admission.admissionId)).rejects.toThrow('REF_PROV_06_ADMISSION_ROW_CORRUPT');
 });

 it('reads the latest runtime attestation',async()=>{
  const query:any={
   select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,
   maybeSingle:async()=>({data:{attestation_id:attestation.attestationId,attestation_hash:attestation.attestationHash,attestation_json:attestation},error:null}),
  };
  const ledger=new SupabaseArtifactAdmissionLedger({from:()=>query} as any);
  await expect(ledger.latestAttestationForRuntime(attestation.runtimeInstanceId,attestation.artifactId))
   .resolves.toEqual(attestation);
 });
});
