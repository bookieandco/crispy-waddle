import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ArtifactAdmissionLedger,
  ArtifactAdmissionReceipt,
  RuntimeArtifactAttestation,
} from '@jhadina/reference-provenance';

type AdmissionRow={admission_id:string;receipt_hash:string;receipt_json:ArtifactAdmissionReceipt};
type AttestationRow={attestation_id:string;attestation_hash:string;attestation_json:RuntimeArtifactAttestation};

const isDuplicate=(error:{code?:string}|null|undefined)=>error?.code==='23505';

export class SupabaseArtifactAdmissionLedger implements ArtifactAdmissionLedger{
  constructor(private readonly client:SupabaseClient){}

  async appendAdmission(receipt:ArtifactAdmissionReceipt):Promise<void>{
    const {error}=await this.client.from('reference_artifact_admissions').insert({
      admission_id:receipt.admissionId,receipt_hash:receipt.receiptHash,
      artifact_id:receipt.artifactId,pin_id:receipt.pinId,
      runtime_instance_scope:receipt.runtime,admitted_at:receipt.admittedAt,receipt_json:receipt,
    });
    if(!error)return;
    if(!isDuplicate(error))throw new Error(`REF_PROV_06_ADMISSION_WRITE_FAILED:${error.message}`);
    const existing=await this.getAdmission(receipt.admissionId);
    if(!existing||existing.receiptHash!==receipt.receiptHash)throw new Error('REF_PROV_06_ADMISSION_IMMUTABLE');
  }

  async getAdmission(admissionId:string):Promise<ArtifactAdmissionReceipt|undefined>{
    const {data,error}=await this.client.from('reference_artifact_admissions')
      .select('admission_id,receipt_hash,receipt_json').eq('admission_id',admissionId).maybeSingle();
    if(error)throw new Error(`REF_PROV_06_ADMISSION_READ_FAILED:${error.message}`);
    if(!data)return undefined;
    const row=data as AdmissionRow;
    if(!row.receipt_json||row.receipt_json.admissionId!==row.admission_id||row.receipt_json.receiptHash!==row.receipt_hash){
      throw new Error('REF_PROV_06_ADMISSION_ROW_CORRUPT');
    }
    return row.receipt_json;
  }

  async appendAttestation(attestation:RuntimeArtifactAttestation):Promise<void>{
    const admission=await this.getAdmission(attestation.admissionId);
    if(!admission||admission.receiptHash!==attestation.admissionReceiptHash){
      throw new Error('REF_PROV_06_ATTESTATION_REQUIRES_DURABLE_ADMISSION');
    }
    const {error}=await this.client.from('reference_artifact_attestations').insert({
      attestation_id:attestation.attestationId,attestation_hash:attestation.attestationHash,
      admission_id:attestation.admissionId,admission_receipt_hash:attestation.admissionReceiptHash,
      artifact_id:attestation.artifactId,pin_id:attestation.pinId,
      runtime_instance_id:attestation.runtimeInstanceId,loaded_at:attestation.loadedAt,
      attestation_json:attestation,
    });
    if(!error)return;
    if(!isDuplicate(error))throw new Error(`REF_PROV_06_ATTESTATION_WRITE_FAILED:${error.message}`);
    const existing=await this.getAttestation(attestation.attestationId);
    if(!existing||existing.attestationHash!==attestation.attestationHash)throw new Error('REF_PROV_06_ATTESTATION_IMMUTABLE');
  }

  async getAttestation(attestationId:string):Promise<RuntimeArtifactAttestation|undefined>{
    const {data,error}=await this.client.from('reference_artifact_attestations')
      .select('attestation_id,attestation_hash,attestation_json').eq('attestation_id',attestationId).maybeSingle();
    if(error)throw new Error(`REF_PROV_06_ATTESTATION_READ_FAILED:${error.message}`);
    if(!data)return undefined;
    return this.checkedAttestation(data as AttestationRow);
  }

  async latestAttestationForRuntime(runtimeInstanceId:string,artifactId:string):Promise<RuntimeArtifactAttestation|undefined>{
    const {data,error}=await this.client.from('reference_artifact_attestations')
      .select('attestation_id,attestation_hash,attestation_json')
      .eq('runtime_instance_id',runtimeInstanceId).eq('artifact_id',artifactId)
      .order('loaded_at',{ascending:false}).order('attestation_id',{ascending:false}).limit(1).maybeSingle();
    if(error)throw new Error(`REF_PROV_06_ATTESTATION_READ_FAILED:${error.message}`);
    if(!data)return undefined;
    return this.checkedAttestation(data as AttestationRow);
  }

  private checkedAttestation(row:AttestationRow):RuntimeArtifactAttestation{
    if(!row.attestation_json||row.attestation_json.attestationId!==row.attestation_id||row.attestation_json.attestationHash!==row.attestation_hash){
      throw new Error('REF_PROV_06_ATTESTATION_ROW_CORRUPT');
    }
    return row.attestation_json;
  }
}
