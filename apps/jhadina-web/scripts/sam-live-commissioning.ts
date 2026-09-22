import { createClient } from '@supabase/supabase-js'
import { certifySamUsableFinal } from '@jhadina/opportunity-core'
import { runSamMarketBootstrap } from '../src/lib/money-opportunities/sam-wide-runtime'
import { runSamEnrichment, collectSamUsableEvidence } from '../src/lib/money-opportunities/sam-usable-runtime'

function required(name:string){
  const value=process.env[name]?.trim()
  if(!value)throw new Error(`${name} is not configured`)
  return value
}
async function main(){
  console.log(JSON.stringify({phase:'sam-live-commissioning',version:1,runtimeBound:false}))
  // SAM_GOV_API_KEY is consumed by the existing server-side SAM client.
  required('SAM_GOV_API_KEY')
  const supabaseUrl=required('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey=required('SUPABASE_SERVICE_ROLE_KEY')
  const client=createClient(supabaseUrl,serviceRoleKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  })

  const bootstrap=await runSamMarketBootstrap(client,{
    historyDays:365,
    windowDays:7,
    maxWindows:1,
    pageSize:1000,
    maxPages:20,
  })

  const enrichment=await runSamEnrichment(client,{
    limit:10,
    maxDocuments:80,
    maxProvidersPerNotice:8,
  })

  // This execution surface is GitHub Actions, not the deployed Vercel runtime.
  // Keep runtimeBound=false so SAM-USABLE.FINAL cannot be falsely certified.
  const evidence=await collectSamUsableEvidence(client,false)
  const certification=certifySamUsableFinal(evidence)

  const result={
    executionSurface:'github_actions_commissioning',
    runtimeBound:false,
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
    },
    evidence,
    certification,
  }
  console.log(JSON.stringify(result,null,2))
}

main().catch(error=>{
  console.error(JSON.stringify({
    executionSurface:'github_actions_commissioning',
    runtimeBound:false,
    error:error instanceof Error?error.message:'unknown commissioning failure',
  }))
  process.exitCode=1
})
