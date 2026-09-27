import { certifySamUsableFinal } from '@jhadina/opportunity-core'
import { runSamMarketBootstrap } from '../src/lib/money-opportunities/sam-wide-runtime'
import { runSamEnrichment, collectSamUsableEvidence } from '../src/lib/money-opportunities/sam-usable-runtime'
import { createRemoteSamSupabaseClient, samRuntimeGatewayHealth } from '../src/lib/money-opportunities/sam-runtime-gateway-client'
import { samUpstreamHealth } from '../src/lib/money-opportunities/sam-upstream-client'

function required(name:string){
  const value=process.env[name]?.trim()
  if(!value)throw new Error(`${name} is not configured`)
  return value
}
async function main(){
  console.log(JSON.stringify({phase:'sam-live-commissioning',version:3,runtimeBound:true,executionSurface:'github_actions_production'}))
  required('SAM_RUNTIME_OIDC_TOKEN')
  required('SAM_UPSTREAM_OIDC_TOKEN')
  const [health,upstream]=await Promise.all([
    samRuntimeGatewayHealth(),
    samUpstreamHealth(),
  ])
  if(!health.serviceRoleConfigured)throw new Error('SAM runtime gateway service role is unavailable')
  if(!upstream.samKeyConfigured)throw new Error('Vercel sam_key is unavailable')
  const client=createRemoteSamSupabaseClient()

  const bootstrap=await runSamMarketBootstrap(client,{
    historyDays:365,
    source:'bulk',
    // API settings remain bounded fallback parameters. Historical coverage is
    // established from SAM.gov's public bulk snapshot, not by spending the
    // low-quota personal sam_key across hundreds of paginated requests.
    windowDays:7,
    maxWindows:4,
    pageSize:1000,
    maxPages:20,
  })

  const enrichment=await runSamEnrichment(client,{
    limit:10,
    maxDocuments:80,
    maxProvidersPerNotice:8,
  })

  // GitHub Actions is the canonical production ingestion runtime. It runs on
  // main/schedule, writes to the production SWLC ledger, and emits receipts.
  // Vercel remains the authenticated presentation surface and reads through
  // the narrow OIDC SAM gateway instead of holding privileged secrets.
  const evidence=await collectSamUsableEvidence(client,true)
  const certification=certifySamUsableFinal(evidence)

  const result={
    executionSurface:'github_actions_production',
    runtimeBound:true,
    bootstrap:{
      complete:bootstrap.complete,
      coverage:bootstrap.coverage,
      successfulWindows:bootstrap.successfulWindows,
      attempts:bootstrap.attempts,
      scanReceipts:bootstrap.receipts.map(scan=>({
        runId:scan.runId,
        pages:scan.pages,
        totalRecords:scan.totalRecords,
        seenRecords:scan.seenRecords,
        newRecords:scan.newRecords,
        amendedRecords:scan.amendedRecords,
        unchangedRecords:scan.unchangedRecords,
        resourceLinks:scan.resourceLinks,
        changedNoticeCount:scan.changedNoticeIds.length,
      })),
    },
    enrichment:{
      noticeCount:enrichment.noticeIds.length,
      documents:enrichment.documents,
      analyzed:enrichment.analysis.analyzed,
      providerNotices:enrichment.providers.notices,
      providerCandidates:enrichment.providers.candidates,
      providerErrors:enrichment.providers.errors,
      pursuitGenerated:enrichment.pursuit.generated,
      pursuitTeamCovered:enrichment.pursuit.teamCovered,
      pursuitReadyForQuote:enrichment.pursuit.readyForQuote,
      pursuitErrors:enrichment.pursuit.errors,
    },
    evidence,
    certification,
  }
  console.log(JSON.stringify(result,null,2))
}

main().catch(error=>{
  console.error(JSON.stringify({
    executionSurface:'github_actions_production',
    runtimeBound:true,
    error:error instanceof Error?error.message:'unknown commissioning failure',
  }))
  process.exitCode=1
})
