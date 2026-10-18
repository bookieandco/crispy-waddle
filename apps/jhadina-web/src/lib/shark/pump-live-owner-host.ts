import {
  PumpLiveResearchEngine, PumpSolanaLogsSession,
  nativePumpSocketFactory,realPumpSchedule,
  readPumpRpcReplay,createReadOnlyPumpRpcSender,
  type PumpLiveResearchDependencies,type PumpStreamHealth,type PumpLiveCounters,
  type PumpReplayReceipt,type PumpSocket,type PumpSessionOptions,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {createPumpTelegramOwnerSender,type PumpOwnerDeliveryClaim} from './pump-owner-telegram-sender'

/** Read-only, operator-controlled always-on Node host composition.
 * No background process is created merely by importing this file.
 * Requires a separately commissioned owner-controlled runtime (not a Vercel request).
 */
export type PumpOwnerHostConfig=Readonly<{
  ownerCommissioned:boolean
  wssUrl:string
  rpcUrl:string
  now?:()=>string
  socketFactory?:(url:string)=>PumpSocket
  schedule?:PumpSessionOptions['schedule']
  riskResearch?:PumpLiveResearchDependencies['riskResearch']
  quoteResearch?:PumpLiveResearchDependencies['quoteResearch']
  onDecision?:PumpLiveResearchDependencies['onDecision']
  telegram?:Readonly<{
    explicitlyEnabled:boolean
    ownerAuthenticated:boolean
    botToken:string
    ownerChatId:string
    claim:PumpOwnerDeliveryClaim
    fetcher?:typeof fetch
  }>
}>
export function createPumpLiveOwnerHost(config:PumpOwnerHostConfig){
  if(config.ownerCommissioned!==true)throw new Error('shark_pump_owner_host_not_commissioned')
  const now=config.now??(()=>new Date().toISOString())
  const sender=config.telegram?.explicitlyEnabled?createPumpTelegramOwnerSender({
    enabled:true,ownerAuthenticated:config.telegram.ownerAuthenticated,
    botToken:config.telegram.botToken,ownerChatId:config.telegram.ownerChatId,
    claim:config.telegram.claim,fetcher:config.telegram.fetcher,
  }):undefined
  const engine=new PumpLiveResearchEngine({
    now,riskResearch:config.riskResearch,quoteResearch:config.quoteResearch,
    onDecision:config.onDecision,ownerAuthenticated:config.telegram?.ownerAuthenticated===true,
    notificationsEnabled:config.telegram?.explicitlyEnabled===true,onOwnerMessage:sender,
  })
  const gapReceipts:{reason:string;lastReceivedAt?:string}[]=[]
  const session=new PumpSolanaLogsSession({
    endpoint:config.wssUrl,socketFactory:config.socketFactory??nativePumpSocketFactory,
    now,schedule:config.schedule??realPumpSchedule,
    onNotification:async(payload,receivedAt)=>{
      await engine.acceptNotification(payload,receivedAt,'LIVE')
    },
    onGap:gap=>{
      gapReceipts.push({reason:gap.reason,lastReceivedAt:gap.lastReceivedAt})
      if(gapReceipts.length>100)gapReceipts.shift()
    },
  })
  const rpc=createReadOnlyPumpRpcSender(config.rpcUrl)
  return Object.freeze({
    start:()=>session.start(),
    stop:()=>session.stop(),
    health:():Readonly<{socket:PumpStreamHealth;research:PumpLiveCounters;gaps:number;gapCoverageVerified:false;canTrade:false}>=>
      Object.freeze({socket:session.health(),research:engine.counters(),
        gaps:gapReceipts.length,gapCoverageVerified:false as const,canTrade:false as const}),
    /** Explicit offline recovery only, bounded max 64, never an early push.
     * Stop the socket before calling to prevent live/replay reordering. */
    recoverOffline:async(limit=32):Promise<PumpReplayReceipt>=>{
      if(session.health().status!=='STOPPED')throw new Error('shark_pump_recovery_requires_stopped_socket')
      const receipt=await readPumpRpcReplay({
        request:rpc,afterSlot:engine.counters().lastSlot,receivedAt:now(),limit,
      })
      for(const item of receipt.notifications)
        await engine.acceptNotification(item,now(),'RETROSPECTIVE')
      return receipt
    },
  })
}
