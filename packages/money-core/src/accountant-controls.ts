import type { CofferAccountantDecision } from './coffer-accountant.js'

export type MoneyLedgerSide='DEBIT'|'CREDIT'
export type MoneyLedgerLine=Readonly<{
 account:string
 side:MoneyLedgerSide
 amountMinor:bigint
 currency:string
 memo:string
}>

export type ProfitSweepJournalCandidate=Readonly<{
 journalId:string
 cofferId:string
 classification:'OWNER_CASH_TRANSFER'
 amountMinor:bigint
 currency:string
 lines:readonly MoneyLedgerLine[]
 balanced:true
 reconciliationRequired:true
 approvalRequired:true
 authority:'JOURNAL_CANDIDATE_ONLY'
 canPost:false
}>

export type AccountantControlResult=Readonly<{
 passed:boolean
 reasonCodes:readonly string[]
 authority:'CONTROL_RESULT_ONLY'
}>

export function buildProfitSweepJournalCandidate(input:{
 journalId:string
 decision:Pick<CofferAccountantDecision,'cofferId'|'sweepStatus'|'proposedSweepMinor'>
 currency:string
 sourceAccount:string
 destinationAccount:string
}):ProfitSweepJournalCandidate{
 const d=input.decision
 if(d.sweepStatus!=='READY_FOR_GOVERNED_EXECUTION'||d.proposedSweepMinor<=0n)throw new Error('MONEY_LIVE1_SWEEP_NOT_ELIGIBLE')
 if(!input.journalId||!input.sourceAccount||!input.destinationAccount)throw new Error('MONEY_LIVE1_JOURNAL_BINDING_REQUIRED')
 const amount=d.proposedSweepMinor
 const lines=Object.freeze<MoneyLedgerLine[]>([
  Object.freeze({account:input.destinationAccount,side:'DEBIT',amountMinor:amount,currency:input.currency,memo:'Proposed Coffer profit sweep destination'}),
  Object.freeze({account:input.sourceAccount,side:'CREDIT',amountMinor:amount,currency:input.currency,memo:'Proposed Coffer profit sweep source'}),
 ])
 return Object.freeze({journalId:input.journalId,cofferId:d.cofferId,classification:'OWNER_CASH_TRANSFER',amountMinor:amount,currency:input.currency,lines,balanced:true as const,reconciliationRequired:true as const,approvalRequired:true as const,authority:'JOURNAL_CANDIDATE_ONLY' as const,canPost:false as const})
}

export function validateDoubleEntry(lines:readonly MoneyLedgerLine[]):AccountantControlResult{
 const reasons:string[]=[]
 if(!lines.length)reasons.push('JOURNAL_LINES_REQUIRED')
 const currencies=new Set(lines.map(x=>x.currency))
 if(currencies.size>1)reasons.push('JOURNAL_CURRENCY_MISMATCH')
 if(lines.some(x=>x.amountMinor<=0n))reasons.push('JOURNAL_AMOUNT_INVALID')
 const debit=lines.filter(x=>x.side==='DEBIT').reduce((n,x)=>n+x.amountMinor,0n)
 const credit=lines.filter(x=>x.side==='CREDIT').reduce((n,x)=>n+x.amountMinor,0n)
 if(debit!==credit)reasons.push('JOURNAL_OUT_OF_BALANCE')
 return Object.freeze({passed:reasons.length===0,reasonCodes:Object.freeze(reasons),authority:'CONTROL_RESULT_ONLY' as const})
}

export function certifyProfitSweepReconciliation(input:{
 journal:ProfitSweepJournalCandidate
 sourceSettledCashBeforeMinor:bigint
 sourceSettledCashAfterMinor:bigint
 destinationSettledCashBeforeMinor:bigint
 destinationSettledCashAfterMinor:bigint
 providerFeeMinor:bigint
 evidenceIds:readonly string[]
}):AccountantControlResult{
 const reasons:string[]=[]
 const j=input.journal
 const journalControl=validateDoubleEntry(j.lines)
 if(!journalControl.passed)reasons.push(...journalControl.reasonCodes)
 if(!input.evidenceIds.length)reasons.push('RECONCILIATION_EVIDENCE_REQUIRED')
 if(input.providerFeeMinor<0n)reasons.push('PROVIDER_FEE_INVALID')
 const sourceDelta=input.sourceSettledCashBeforeMinor-input.sourceSettledCashAfterMinor
 const destinationDelta=input.destinationSettledCashAfterMinor-input.destinationSettledCashBeforeMinor
 if(sourceDelta!==j.amountMinor+input.providerFeeMinor)reasons.push('SOURCE_CASH_DOES_NOT_TIE')
 if(destinationDelta!==j.amountMinor)reasons.push('DESTINATION_CASH_DOES_NOT_TIE')
 return Object.freeze({passed:reasons.length===0,reasonCodes:Object.freeze([...new Set(reasons)]),authority:'CONTROL_RESULT_ONLY' as const})
}
