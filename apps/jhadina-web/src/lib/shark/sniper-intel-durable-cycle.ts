import {runSniperPaperCycle} from './sniper-paper-cycle'
import {archiveSniperIntel,buildSniperArchiveRow,type SniperArchiveStore} from './sniper-intel-journal'

/** The only supported bridge between canonical SHARK/Money paper decisions and
 * an injected, separately approved durable archive. Research only.
 *
 * A failed archive MUST bubble up: callers cannot claim recorded paper
 * learning when the receipt failed to persist. No wallet connection is used.
 */
export async function runSniperPaperCycleWithArchive(input:{
 cycle:Parameters<typeof runSniperPaperCycle>[0]
 archive:SniperArchiveStore
}){
 const result=runSniperPaperCycle(input.cycle)
 const row=buildSniperArchiveRow({
  tradeId:input.cycle.tradeId,informationCutoff:input.cycle.now,result,
 })
 const archive=await archiveSniperIntel(input.archive,row)
 return Object.freeze({
  cycle:result,archive,
  authority:'SHARK_MONEY_ARCHIVE_ONLY' as const,
  canExecute:false as const,canSign:false as const,
  canCreditPurse:false as const,canMutateModel:false as const,
 })
}
