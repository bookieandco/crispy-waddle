/** SHARK-ALPHA.FABRIC.08 — default-off Telegram owner delivery for PUBLIC Pump
 * evidence only. No getUpdates, personal chats, channel access, ML training, or trades.
 * An operator-owned *durable* claim is required to suppress replay after restarts.
 */
export type PumpOwnerDeliveryClaim=(key:string)=>Promise<'CLAIMED'|'ALREADY_CLAIMED'|'UNAVAILABLE'>
export type PumpTelegramNotifierConfig=Readonly<{
  enabled:boolean
  ownerAuthenticated:boolean
  botToken:string
  ownerChatId:string
  claim:PumpOwnerDeliveryClaim
  fetcher?:typeof fetch
}>
const positiveId=(v:string)=>/^[1-9][0-9]{0,19}$/.test(v)
export function createPumpTelegramOwnerSender(config:PumpTelegramNotifierConfig){
  if(config.enabled!==true||config.ownerAuthenticated!==true)
    throw new Error('shark_pump_owner_delivery_not_commissioned')
  if(!positiveId(config.ownerChatId)||!/^[0-9]{5,20}:[A-Za-z0-9_-]{20,}$/.test(config.botToken))
    throw new Error('shark_pump_owner_delivery_credentials_invalid')
  const fetcher=config.fetcher??fetch
  return async(message:string,key:string):Promise<void>=>{
    if(!/^shark-graduation:[1-9A-HJ-NP-Za-km-z]{32,44}:(?:NEAR_CURVE|IMMINENT_CURVE|CURVE_COMPLETE_POOL_UNVERIFIED|POOL_MIGRATION_OBSERVED|RISK_BLOCKED)$/.test(key)||
      !message.startsWith('SHARK | Pump graduation research alert')||
      !message.includes('NO TRADE AUTHORITY')||message.length>2900)
      throw new Error('shark_pump_owner_delivery_payload_invalid')
    // Claim BEFORE sending. An uncertain transport result is never automatically
    // retried: the claim stays held. The caller must own and test durable claims.
    const status=await config.claim(key)
    if(status==='ALREADY_CLAIMED')return
    if(status!=='CLAIMED')throw new Error('shark_pump_owner_delivery_claim_unavailable')
    try{
      const response=await fetcher('https://api.telegram.org/bot'+config.botToken+'/sendMessage',{
        method:'POST',headers:{'Content-Type':'application/json'},
        signal:AbortSignal.timeout(8000),
        body:JSON.stringify({
          chat_id:config.ownerChatId,
          text:message,
          disable_web_page_preview:true,
          protect_content:true,
        }),
      })
      if(!response.ok)throw new Error('send_failed')
      // A 200 alone does not certify Bot API success.
      const raw=await response.text()
      if(raw.length>10_000||JSON.parse(raw)?.ok!==true)
        throw new Error('send_unverified')
    }catch{
      // Never print a bot token, chat ID, or response body.
      throw new Error('shark_pump_owner_delivery_uncertain_no_retry')
    }
  }
}
