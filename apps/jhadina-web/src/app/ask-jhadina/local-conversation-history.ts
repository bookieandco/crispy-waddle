import type {JhadinaConversationLine} from "./interactive-runtime"
import {redactSecrets} from "@/lib/context/redact"

export type LocalChatStorage=Pick<Storage,"getItem"|"setItem"|"removeItem">
const PREFIX="jhadina:ask-history:v1"
const MAX_LINES=40
const MAX_CHARS=2000
const SESSION_ID=/^[a-zA-Z0-9_-]{1,128}$/

/** Browser-local convenience history, not a synced or encrypted medical/financial
 * record and never a source of factual evidence or action authorization.
 */
export function localConversationKey(owner:string,session:string):string|null{
 if(!SESSION_ID.test(session)||!SESSION_ID.test(owner))return null
 return `${PREFIX}:${owner}:${session}`
}
export function normalizeLocalConversation(input:unknown):JhadinaConversationLine[]{
 if(!Array.isArray(input))return []
 return input.slice(-MAX_LINES).flatMap((raw):JhadinaConversationLine[]=>{
  if(!raw||typeof raw!=="object")return []
  const line=raw as Record<string,unknown>
  if(line.speaker!=="user"&&line.speaker!=="jhadina")return []
  if(typeof line.id!=="string"||typeof line.text!=="string"||
     typeof line.turnId!=="string"||typeof line.createdAt!=="string")return []
  if(!line.text.trim()||line.text.length>MAX_CHARS*3)return []
  return [{id:line.id.slice(0,160),speaker:line.speaker,
   text:redactSecrets(line.text.slice(0,MAX_CHARS)).redacted,
   createdAt:line.createdAt.slice(0,40),turnId:line.turnId.slice(0,160)}]
 })
}
export function loadLocalConversation(storage:LocalChatStorage|undefined,owner:string,session:string):JhadinaConversationLine[]{
 const key=localConversationKey(owner,session)
 if(!storage||!key)return []
 try{
  const text=storage.getItem(key)
  if(!text||text.length>250_000)return []
  return normalizeLocalConversation(JSON.parse(text))
 }catch{return []}
}
export function saveLocalConversation(storage:LocalChatStorage|undefined,owner:string,session:string,lines:readonly JhadinaConversationLine[]):boolean{
 const key=localConversationKey(owner,session)
 if(!storage||!key)return false
 try{
  storage.setItem(key,JSON.stringify(normalizeLocalConversation(lines)))
  return true
 }catch{return false}
}
export function clearLocalConversation(storage:LocalChatStorage|undefined,owner:string,session:string):boolean{
 const key=localConversationKey(owner,session)
 if(!storage||!key)return false
 try{storage.removeItem(key);return true}catch{return false}
}
export function searchLocalConversation(lines:readonly JhadinaConversationLine[],query:string):JhadinaConversationLine[]{
 const term=query.trim().toLocaleLowerCase()
 return (term?lines.filter(line=>line.text.toLocaleLowerCase().includes(term)):lines).slice(-MAX_LINES)
}
