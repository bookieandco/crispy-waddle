import type { FulfillmentProvider, FulfillmentProviderEvidenceKind } from './fulfillment-provider.js'

export type ProviderFreshnessPolicy = {
  defaultMaxAgeDays: number
  maxAgeDaysByEvidenceKind?: Partial<Record<FulfillmentProviderEvidenceKind, number>>
  requireFreshCapacity: boolean
  requireUnexpiredCredentials: boolean
}

export type ProviderFreshnessIssue = {
  kind: 'stale_evidence' | 'expired_credential' | 'missing_capacity_evidence' | 'invalid_timestamp'
  ref: string
  blocking: boolean
  message: string
}

export type ProviderFreshnessResult = {
  providerId: string
  checkedAt: string
  status: 'fresh' | 'refresh_required' | 'blocked'
  issues: ProviderFreshnessIssue[]
  staleEvidenceIds: string[]
  expiredCredentialIds: string[]
}

const DAY=86_400_000
export const DEFAULT_PROVIDER_FRESHNESS_POLICY:ProviderFreshnessPolicy={
  defaultMaxAgeDays:90,
  maxAgeDaysByEvidenceKind:{sam_registration:30,insurance_record:30,bond_record:30,license_record:30,capacity_record:14,certification_record:60},
  requireFreshCapacity:true,
  requireUnexpiredCredentials:true,
}

export function evaluateProviderFreshness(
  provider:FulfillmentProvider,
  now=new Date().toISOString(),
  policy:ProviderFreshnessPolicy=DEFAULT_PROVIDER_FRESHNESS_POLICY,
):ProviderFreshnessResult{
  const nowMs=Date.parse(now)
  if(!Number.isFinite(nowMs)) throw new Error('Freshness check time is invalid')
  const issues:ProviderFreshnessIssue[]=[]
  const staleEvidenceIds:string[]=[]
  const expiredCredentialIds:string[]=[]

  for(const evidence of provider.evidence){
    const captured=Date.parse(evidence.capturedAt)
    if(!Number.isFinite(captured)){
      issues.push({kind:'invalid_timestamp',ref:evidence.id,blocking:true,message:`Evidence has invalid capturedAt: ${evidence.id}`});continue
    }
    const maxDays=policy.maxAgeDaysByEvidenceKind?.[evidence.kind]??policy.defaultMaxAgeDays
    if((nowMs-captured)/DAY>maxDays){
      staleEvidenceIds.push(evidence.id)
      issues.push({kind:'stale_evidence',ref:evidence.id,blocking:['sam_registration','insurance_record','bond_record','license_record','capacity_record','certification_record'].includes(evidence.kind),message:`Evidence exceeds freshness window: ${evidence.id}`})
    }
  }

  if(policy.requireUnexpiredCredentials){
    for(const credential of provider.credentials){
      if(credential.expiresAt && Date.parse(credential.expiresAt)<=nowMs){
        expiredCredentialIds.push(credential.id)
        issues.push({kind:'expired_credential',ref:credential.id,blocking:true,message:`Credential is expired: ${credential.id}`})
      }
    }
  }

  if(policy.requireFreshCapacity){
    if(provider.capacity.evidenceRefs.length===0){
      issues.push({kind:'missing_capacity_evidence',ref:provider.id,blocking:true,message:'Provider capacity lacks evidence.'})
    }else if(provider.capacity.evidenceRefs.every(ref=>staleEvidenceIds.includes(ref))){
      issues.push({kind:'stale_evidence',ref:provider.id,blocking:true,message:'All provider capacity evidence is stale.'})
    }
  }

  const blocking=issues.some(i=>i.blocking)
  const status:ProviderFreshnessResult['status']=blocking?'blocked':issues.length?'refresh_required':'fresh'
  return {providerId:provider.id,checkedAt:now,status,issues,staleEvidenceIds:[...new Set(staleEvidenceIds)],expiredCredentialIds:[...new Set(expiredCredentialIds)]}
}

export function providerIsFreshForContracting(result:ProviderFreshnessResult):boolean{
  return result.status==='fresh' && result.issues.length===0
}
