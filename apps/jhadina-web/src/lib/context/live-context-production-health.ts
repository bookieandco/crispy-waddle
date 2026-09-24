import {
  certifyLiveContextContract,
  JHADINA_LIVE_CONTEXT_CONTRACT_VERSION,
  JHADINA_LIVE_CONTEXT_LIMITS,
} from "@jhadina/core-spine"

export interface LiveContextProductionHealth {
  status:"READY"|"DEGRADED"
  contractVersion:typeof JHADINA_LIVE_CONTEXT_CONTRACT_VERSION
  commitSha:string|null
  environment:string|null
  certification:ReturnType<typeof certifyLiveContextContract>
  limits:typeof JHADINA_LIVE_CONTEXT_LIMITS
}

export function checkLiveContextProductionHealth():LiveContextProductionHealth{
  const certification=certifyLiveContextContract()
  return{
    status:certification.status,
    contractVersion:JHADINA_LIVE_CONTEXT_CONTRACT_VERSION,
    commitSha:process.env.VERCEL_GIT_COMMIT_SHA??null,
    environment:process.env.VERCEL_ENV??null,
    certification,
    limits:JHADINA_LIVE_CONTEXT_LIMITS,
  }
}
