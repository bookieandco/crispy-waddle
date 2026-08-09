export type FinancialSnapshot = {
  accounts: Array<{ id:string; name:string; type:string; subtype?:string; current:number; available?:number; currency:string }>
  transactions: Array<{ id:string; accountId:string; merchant?:string; amount:number; currency:string; date:string; pending?:boolean; category?:string }>
  bills?: Array<{ id:string; name:string; amount:number; currency:string; dueAt:string }>
  subscriptions?: Array<{ id:string; merchant:string; amount:number; currency:string; nextChargeAt:string }>
}

export type AttentionItem = {
  id:string
  type:"CREDIT_CARD"|"BILL"|"SUBSCRIPTION"|"TRANSACTION"
  title:string
  detail:string
  amount?:number
  currency?:string
  dueAt?:string
  severity:"URGENT"|"SOON"|"REVIEW"|"INFO"
  action:string
  requiresApproval:boolean
}

const dayMs=86400000
function daysUntil(iso:string,now:number){return Math.ceil((new Date(iso).getTime()-now)/dayMs)}

export function buildNeedsAttention(snapshot:FinancialSnapshot, now=new Date()):AttentionItem[]{
  const result:AttentionItem[]=[]
  const nowMs=now.getTime()
  for(const a of snapshot.accounts){
    if(a.type==="credit"||a.subtype?.toLowerCase().includes("credit")){
      const available=a.available ?? a.current
      result.push({id:`card_${a.id}`,type:"CREDIT_CARD",title:`Review ${a.name}`,detail:`Current balance ${a.current.toFixed(2)}; available ${available.toFixed(2)} ${a.currency}.`,amount:a.current,currency:a.currency,severity:a.current>0?"REVIEW":"INFO",action:"Review credit card",requiresApproval:true})
    }
  }
  for(const b of snapshot.bills||[]){
    const d=daysUntil(b.dueAt,nowMs)
    result.push({id:`bill_${b.id}`,type:"BILL",title:`${b.name} due ${d<=0?"now":`in ${d} day${d===1?"":"s"}`}`,detail:"Review and prepare payment.",amount:b.amount,currency:b.currency,dueAt:b.dueAt,severity:d<=0?"URGENT":d<=3?"SOON":"INFO",action:"Review bill payment",requiresApproval:true})
  }
  for(const s of snapshot.subscriptions||[]){
    const d=daysUntil(s.nextChargeAt,nowMs)
    result.push({id:`sub_${s.id}`,type:"SUBSCRIPTION",title:`${s.merchant} renews in ${Math.max(d,0)} day${d===1?"":"s"}`,detail:"Review recurring charge before renewal.",amount:s.amount,currency:s.currency,dueAt:s.nextChargeAt,severity:d<=3?"SOON":"REVIEW",action:"Review subscription",requiresApproval:true})
  }
  for(const t of snapshot.transactions){
    if(t.pending && t.amount>500) result.push({id:`txn_${t.id}`,type:"TRANSACTION",title:`Large pending transaction${t.merchant?` at ${t.merchant}`:""}`,detail:"Verify this transaction before it posts.",amount:t.amount,currency:t.currency,severity:"REVIEW",action:"Review transaction",requiresApproval:false})
  }
  const rank=(s:AttentionItem["severity"])=>s==="URGENT"?0:s==="SOON"?1:s==="REVIEW"?2:3
  return result.sort((a,b)=>rank(a.severity)-rank(b.severity))
}
