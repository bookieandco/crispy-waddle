import {describe,it,expect} from "vitest"
import {clearLocalConversation,loadLocalConversation,localConversationKey,saveLocalConversation,searchLocalConversation} from "./local-conversation-history"

function memory(){
 const m=new Map<string,string>()
 return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v)},removeItem:(k:string)=>{m.delete(k)}}
}
const line=(id:string,text:string)=>({id,speaker:"user" as const,text,turnId:id,createdAt:"2026-10-22T12:00:00Z"})
describe("browser-local JLLM conversation continuity",()=>{
 it("restores only the authenticated owner/session key",()=>{
  const storage=memory()
  expect(saveLocalConversation(storage,"ownerA","session1",[line("t1","alpha")])).toBe(true)
  expect(loadLocalConversation(storage,"ownerA","session1")).toHaveLength(1)
  expect(loadLocalConversation(storage,"ownerB","session1")).toEqual([])
  expect(loadLocalConversation(storage,"ownerA","session2")).toEqual([])
 })
 it("redacts keys, bounds retention, and supports local search",()=>{
  const storage=memory()
  saveLocalConversation(storage,"owner","session",Array.from({length:55},(_,i)=>line(String(i),"prompt "+i)))
  const data=loadLocalConversation(storage,"owner","session")
  expect(data).toHaveLength(40)
  expect(searchLocalConversation(data,"prompt 54")).toHaveLength(1)
  saveLocalConversation(storage,"owner","secrets",[line("k","Bearer abcdefghijklmnopqrst")])
  expect(loadLocalConversation(storage,"owner","secrets")[0].text).toBe("[REDACTED]")
 })
 it("fails closed on arbitrary storage corruption and can clear local cache",()=>{
  const storage=memory()
  storage.setItem(localConversationKey("owner","session")!,"not-json")
  expect(loadLocalConversation(storage,"owner","session")).toEqual([])
  expect(clearLocalConversation(storage,"owner","session")).toBe(true)
  expect(localConversationKey("../x","session")).toBeNull()
 })
})
