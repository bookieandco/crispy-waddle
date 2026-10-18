import {describe,expect,it,vi} from 'vitest'
import {admitApprovedSocialAlpha,normalizePublicBlueskyPosts,normalizeApprovedRedditPosts,
  normalizeApprovedXPosts,readPublicBlueskySearch} from './social-alpha-sources'

const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const permission={source:'bluesky' as const,access:'PUBLIC_APPVIEW' as const,
  termsApproved:true,ownerEnabled:true}
const post={uri:'at://did:plc:abcdef/app.bsky.feed.post/4asdasd',
  author:{did:'did:plc:abcdef',handle:'example.bsky.social'},
  record:{text:'token address '+mint,createdAt:'2026-10-17T19:00:00Z'},
  indexedAt:'2026-10-17T19:00:01Z'}
describe('permission-gated public social alpha ingestion',()=>{
 it('reads bounded official public Bluesky AppView and preserves actual receipt clock',async()=>{
   const fetcher=vi.fn(async(url:unknown)=>{
     expect(String(url)).toContain('public.api.bsky.app/xrpc/app.bsky.feed.searchPosts')
     expect(String(url)).toContain('sort=latest')
     return {ok:true,text:async()=>JSON.stringify({posts:[post]})} as Response
   })
   const times=['2026-10-17T19:00:02Z','2026-10-17T19:00:03Z']
   const result=await readPublicBlueskySearch({
     query:'solana',permission,now:()=>times.shift()!,limit:10,fetcher:fetcher as typeof fetch,
   })
   expect(result.received).toBe(1)
   expect(result.signals[0]?.platform).toBe('BLUESKY')
   expect(result.signals[0]?.availableAt).toBe('2026-10-17T19:00:03Z')
   expect(result.signals[0]?.provenance.receivedAt).toBe('2026-10-17T19:00:02Z')
   expect(result.signals[0]?.provenance.authority).toBe('EVIDENCE_ONLY')
   expect(result.canTrade).toBe(false)
 })
 it('fails closed for unapproved or disabled provider reads without touching network',async()=>{
   const fetcher=vi.fn(async()=>{throw new Error('should not call')})
   await expect(readPublicBlueskySearch({
     query:'solana',permission:{...permission,termsApproved:false},now:()=>new Date().toISOString(),
     fetcher:fetcher as typeof fetch,
   })).rejects.toThrow('not_approved')
   expect(fetcher).not.toHaveBeenCalled()
   expect(()=>admitApprovedSocialAlpha({permission:{source:'reddit',access:'APPROVED_READ_ONLY',
     termsApproved:false,ownerEnabled:true},posts:[],collectedAt:'2026-10-17T19:00:01Z',
     availableAt:'2026-10-17T19:00:02Z'})).toThrow('not_approved')
 })
 it('refuses late rewritten publication and duplicate/bad URLs',()=>{
   const normalized=normalizePublicBlueskyPosts({posts:[post]})
   const result=admitApprovedSocialAlpha({permission,posts:[
     ...normalized,normalized[0]!,{...normalized[0]!,id:'another',sourceUrl:'http://evil.test'},
     {...normalized[0]!,id:'future',publishedAt:'2026-10-18T19:00:00Z'},
   ],collectedAt:'2026-10-17T19:00:02Z',availableAt:'2026-10-17T19:00:03Z'})
   expect(result.received).toBe(4)
   expect(result.signals).toHaveLength(1)
   expect(result.ignored).toBe(3)
 })
 it('normalizes only approved X/Reddit REST shapes without making a provider request',()=>{
   const x=normalizeApprovedXPosts({data:[{id:'123456',author_id:'9876',
     text:'mint '+mint,created_at:'2026-10-17T19:00:00Z'}]})
   expect(x[0]?.sourceUrl).toBe('https://x.com/i/status/123456')
   const r=normalizeApprovedRedditPosts({data:{children:[{data:{
     id:'abc12',author:'poster',title:'Meme mint',selftext:mint,
     created_utc:1792263600,permalink:'/r/solana/comments/abc12/meme_mint/',
   }}]}})
   expect(r).toHaveLength(1)
   const admitted=admitApprovedSocialAlpha({permission:{
      source:'x',access:'APPROVED_READ_ONLY',termsApproved:true,ownerEnabled:true,
     },posts:x,collectedAt:'2026-10-17T19:00:02Z',availableAt:'2026-10-17T19:00:03Z'})
   expect(admitted.signals[0]?.canAuthorizeTrade).toBe(false)
 })
})
