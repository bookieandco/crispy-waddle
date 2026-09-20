import type { MoneyTransaction } from "@jhadina/money-core"
import type { FinancialAttention } from "./financial-attention"

export type TransactionIntelligence={attention:readonly FinancialAttention[];recurringMerchants:readonly string[];totalOutflow:number;currency:string|null}
export function analyzeMoneyTransactions(transactions:readonly MoneyTransaction[]):TransactionIntelligence{
  const currencies=new Set(transactions.map(t=>t.currency));const groups=new Map<string,MoneyTransaction[]>();
  for(const t of transactions){const key=(t.description??"unknown").trim().toLowerCase();groups.set(key,[...(groups.get(key)??[]),t])}
  const attention:FinancialAttention[]=[];const recurring:string[]=[];
  for(const [merchant,rows] of groups){if(rows.length>=2){recurring.push(merchant);attention.push({id:`recurring:${merchant}`,type:"SUBSCRIPTION",title:`Recurring activity: ${rows[0].description??merchant}`,amount:rows[rows.length-1].amount,currency:rows[rows.length-1].currency,severity:"REVIEW",action:"Review recurring charge",requiresApproval:true})}}
  const seen=new Map<string,MoneyTransaction>();for(const t of transactions){const key=`${t.accountId}|${t.amount}|${t.currency}|${t.occurredAt}|${t.description??""}`;if(seen.has(key))attention.push({id:`duplicate:${t.id}`,type:"OTHER",title:`Possible duplicate: ${t.description??"transaction"}`,amount:t.amount,currency:t.currency,severity:"URGENT",action:"Review possible duplicate",requiresApproval:true});else seen.set(key,t)}
  return Object.freeze({attention,totalOutflow:transactions.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),currency:currencies.size===1?[...currencies][0]??null:null,recurringMerchants:recurring})
}
