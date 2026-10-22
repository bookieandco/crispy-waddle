/**
 * Device audit registry, not hardware diagnosis. The owner's M1 MacBook is
 * quarantined as a JLLM inference host until independent on-device acceptance.
 * Source: GitHub issue #1486. Other hosts can be prepared separately.
 */
export const MACBOOK_AUDIT = Object.freeze({
 hostId: "owner-m1-macbook",
 status: "AUDIT_REPAIR_PENDING" as const,
 issue: "https://github.com/bookieandco/crispy-waddle/issues/1486",
 diagnosisVerified: false,
 inferenceReady: false,
})

export type LocalHostReadiness =
 | "AUDIT_REPAIR_PENDING"
 | "HOST_ID_REQUIRED"
 | "ALTERNATE_HOST_IDENTIFIED_UNVERIFIED"

const HOST_ID_PATTERN=/^[a-z][a-z0-9-]{2,63}$/

/** No inference endpoint is authorized just because it has a URL or credentials. */
export function assessLocalModelHost(hostId: unknown):{
 readonly readiness:LocalHostReadiness
 readonly permittedForCandidateConfiguration:boolean
 readonly auditIssue:string|null
}{
 if(typeof hostId!=="string"||!HOST_ID_PATTERN.test(hostId))
  return {readiness:"HOST_ID_REQUIRED",permittedForCandidateConfiguration:false,auditIssue:null}
 if(hostId===MACBOOK_AUDIT.hostId)
  return {readiness:"AUDIT_REPAIR_PENDING",permittedForCandidateConfiguration:false,auditIssue:MACBOOK_AUDIT.issue}
 return {readiness:"ALTERNATE_HOST_IDENTIFIED_UNVERIFIED",permittedForCandidateConfiguration:true,auditIssue:null}
}
