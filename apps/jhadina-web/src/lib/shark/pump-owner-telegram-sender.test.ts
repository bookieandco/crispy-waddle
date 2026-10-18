import {describe,expect,it,vi} from 'vitest'
import {createPumpTelegramOwnerSender} from './pump-owner-telegram-sender'

const token='123456789:'+'A'.repeat(35)
const id='123456789'
const key='shark-graduation:'+'3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'+':NEAR_CURVE'
const message='SHARK | Pump graduation research alert\nNO TRADE AUTHORITY. No automatic snipe.'
describe('owner-only public Pump Telegram alert adapter',()=>{
 it('requires deliberate opt-in, valid owner credentials and a durable claim function',()=>{
  const claim=vi.fn(async()=> 'CLAIMED' as const)
  expect(()=>createPumpTelegramOwnerSender({enabled:false,ownerAuthenticated:true,botToken:token,ownerChatId:id,claim})).toThrow('not_commissioned')
  expect(()=>createPumpTelegramOwnerSender({enabled:true,ownerAuthenticated:false,botToken:token,ownerChatId:id,claim})).toThrow('not_commissioned')
  expect(()=>createPumpTelegramOwnerSender({enabled:true,ownerAuthenticated:true,botToken:token,ownerChatId:'evil',claim})).toThrow('credentials_invalid')
 })
 it('delivers only to configured owner and prevents replay when previously claimed',async()=>{
  const claim=vi.fn(async()=> 'CLAIMED' as const)
  const fetcher=vi.fn(async(_url:unknown,_options?:unknown)=>({ok:true,text:async()=>JSON.stringify({ok:true})}) as Response)
  const send=createPumpTelegramOwnerSender({enabled:true,ownerAuthenticated:true,botToken:token,ownerChatId:id,claim,fetcher:fetcher as unknown as typeof fetch})
  await send(message,key)
  expect(claim).toHaveBeenCalledWith(key)
  expect(fetcher).toHaveBeenCalledTimes(1)
  const args=fetcher.mock.calls[0] as unknown as [string,RequestInit]
  expect(args[0]).toContain('https://api.telegram.org/bot')
  expect(JSON.parse(String(args[1].body)).chat_id).toBe(id)
  expect(JSON.parse(String(args[1].body)).protect_content).toBe(true)
  const replay=createPumpTelegramOwnerSender({enabled:true,ownerAuthenticated:true,botToken:token,ownerChatId:id,
    claim:async()=> 'ALREADY_CLAIMED',fetcher:fetcher as unknown as typeof fetch})
  await replay(message,key)
  expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it('blocks arbitrary content, rejects missing durable claim and makes failures uncertain/no-retry',async()=>{
  const fetcher=vi.fn(async()=>{throw new Error('sensitive response '+token)}) as unknown as typeof fetch
  const sender=createPumpTelegramOwnerSender({enabled:true,ownerAuthenticated:true,botToken:token,ownerChatId:id,
    claim:async()=> 'UNAVAILABLE',fetcher})
  await expect(sender(message,key)).rejects.toThrow('claim_unavailable')
  expect(fetcher).not.toHaveBeenCalled()
  await expect(sender('BUY NOW',key)).rejects.toThrow('payload_invalid')
  const sender2=createPumpTelegramOwnerSender({enabled:true,ownerAuthenticated:true,botToken:token,ownerChatId:id,
    claim:async()=> 'CLAIMED',fetcher})
  await expect(sender2(message,key)).rejects.toThrow('uncertain_no_retry')
 })
})
