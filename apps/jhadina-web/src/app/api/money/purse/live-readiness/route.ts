import {NextResponse} from 'next/server'
import {readSessionMoneyWorkspace} from '@/lib/money/workspace-read-runtime'
import {readSessionFundingReadiness} from '@/lib/money/funding-readiness-runtime'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const revalidate=0
/** Owner-authenticated facts only. Never a payment, mandate activation or live-order API. */
export async function GET(){
 try{
  const workspace=await readSessionMoneyWorkspace()
  const funding=await readSessionFundingReadiness()
  if(workspace.userId!==funding.userId)throw new Error('PURSE_OWNER_CONTEXT_MISMATCH')
  const db=createServiceRoleClient()
  if(!db)throw new Error('PURSE_DB_UNAVAILABLE')
  const {data:mandates,error}=await db.from('money_autonomous_trading_mandates')
   .select('mandate_id,provider,account_id').eq('user_id',workspace.userId)
   .eq('status','ACTIVE').gt('expires_at',new Date().toISOString()).limit(20)
  if(error)throw new Error('PURSE_MANDATE_LEDGER_UNAVAILABLE')
  const blockers:string[]=[]
  if(!workspace.coffer)blockers.push('OWNER_PURSE_NOT_CONFIGURED')
  else if(workspace.coffer.state!=='ACTIVE')blockers.push('PROTECTED_CAPITAL_STATE_NOT_ACTIVE')
  if(!workspace.sweepPolicy?.verifiedOwnerDestinationId)blockers.push('VERIFIED_OWNER_PAYOUT_DESTINATION_MISSING')
  if(!funding.canExecuteAnyLiveMovement)blockers.push('CERTIFIED_LIVE_FUNDING_RAIL_MISSING')
  if(funding.unresolvedAttemptCount>0||funding.unsettledAttemptCount>0)blockers.push('FUNDING_ATTEMPT_NEEDS_RECONCILIATION')
  if(!mandates?.length)blockers.push('APPROVED_AUTONOMOUS_MANDATE_NOT_PRESENT')
  if(!workspace.connectors.some(c=>c.admission==='CONTROLLED_CANARY'||c.admission==='LIVE'))
   blockers.push('LIVE_MARKET_EXECUTION_PROVIDER_NOT_COMMISSIONED')
  const activePurseWallet=workspace.wallets.some(w=>w.mode==='COFFER_EXECUTION_WALLET'&&w.status==='ACTIVE')
  if(!activePurseWallet)blockers.push('ISOLATED_PURSE_EXECUTION_WALLET_NOT_VERIFIED')
  // Neither a linked wallet nor a policy target is proof of a funded settled custody account.
  blockers.push('INDEPENDENT_SETTLED_CUSTODY_AND_RESTORE_NOT_CERTIFIED')
  return NextResponse.json({success:true,data:{
   treasury:workspace.coffer?{state:workspace.coffer.state,currency:workspace.coffer.currency}:null,
   ownerPayoutDestinationRecorded:Boolean(workspace.sweepPolicy?.verifiedOwnerDestinationId),
   fundingRailExecutable:funding.canExecuteAnyLiveMovement,
   activeMandateRecordCount:mandates?.length??0,
   configuredExecutionWallet:activePurseWallet,
   marketProviderAdmitted:workspace.connectors.some(c=>c.admission==='CONTROLLED_CANARY'||c.admission==='LIVE'),
   blockers:[...new Set(blockers)].sort(),liveAutomatedTradingCertified:false,
   authority:'READINESS_ONLY',canExecute:false,canMoveMoney:false,canActivateMandate:false,
  }},{headers:{'Cache-Control':'no-store'}})
 }catch{
  return NextResponse.json({success:false,error:'PURSE_LIVE_READINESS_STORAGE_OR_SESSION_UNAVAILABLE',
   liveAutomatedTradingCertified:false,canExecute:false},{status:503,headers:{'Cache-Control':'no-store'}})
 }
}
