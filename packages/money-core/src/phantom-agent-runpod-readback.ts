import { createHash } from 'node:crypto'
import { readPhantomAgentResearchInbox, type PhantomResearchInboxOptions } from './phantom-agent-research-inbox.js'
import { verifyPhantomAgentStudyLedger } from './phantom-agent-study-ledger.js'
import type { PhantomResearchDb } from './phantom-agent-runpod-research-ingest.js'

/** PURSE-MCP.25–.26: Read after write; a successful INSERT is not durability
 * evidence until the independent research-only principal can read back every
 * observed case and no unexpected/mutated case exists for this pinned wallet.
 */
const stable=(v:unknown):string=>JSON.stringify(v,(_,value)=>{
  if(value!==null&&typeof value==='object'&&!Array.isArray(value)){
    return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)))
  }
  return value
})
const hash=(v:unknown)=>createHash('sha256').update(stable(v)).digest('hex')
export async function verifyRunpodPhantomResearchReadback(input:Readonly<{
  db:PhantomResearchDb
  inbox:PhantomResearchInboxOptions
}>){
  const expected=await readPhantomAgentResearchInbox(input.inbox)
  const study=await verifyPhantomAgentStudyLedger(input.inbox.study)
  if(expected.length!==study.count ||
     (study.count>0 && expected[expected.length-1]?.caseId!=='phantom-agent-native-sol:'+study.headDigest)){
    throw Error('PHANTOM_RUNPOD_READBACK_SOURCE_NOT_AT_HEAD')
  }
  const reply=await input.db.query(
    `SELECT case_id,parent_case_id,observation_json,authority,can_execute,can_authorize_live,chain_id
       FROM public.runpod_phantom_agent_research_observations
      WHERE wallet_id=$1 ORDER BY slot ASC,observed_at ASC,case_id ASC`,
    [input.inbox.study.expectedWalletId],
  )
  if(reply.rows.length!==expected.length) throw Error('PHANTOM_RUNPOD_READBACK_CARDINALITY_MISMATCH')
  for(let i=0;i<reply.rows.length;i++){
    const row=reply.rows[i]!,wanted=expected[i]!
    if(row.case_id!==wanted.caseId || row.parent_case_id!==wanted.parentCaseId ||
       row.authority!=='SHADOW_LEARNING_ONLY' || row.can_execute!==false ||
       row.can_authorize_live!==false || row.chain_id!=='solana-mainnet-beta' ||
       hash(row.observation_json)!==hash(wanted)){
      throw Error('PHANTOM_RUNPOD_READBACK_CONTENT_OR_AUTHORITY_MISMATCH')
    }
  }
  return Object.freeze({
    verifiedCases:expected.length,
    studyHead:study.headDigest,
    authority:'RESEARCH_READBACK_ONLY' as const,
    canExecute:false as const,
    canAuthorizeLive:false as const,
    databaseCommissioned:false as const,
  })
}
