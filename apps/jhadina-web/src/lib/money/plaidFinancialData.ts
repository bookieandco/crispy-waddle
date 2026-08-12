export type FinancialAccount = { id:string; name:string; type:string; subtype?:string; currentBalance:number; availableBalance?:number; currency:string; mask?:string }
export type FinancialTransaction = { id:string; accountId:string; merchant?:string; name:string; amount:number; currency:string; date:string; pending:boolean; category?:string[] }
export type FinancialSnapshot = { provider:"PLAID"; connected:boolean; accounts:FinancialAccount[]; transactions:FinancialTransaction[]; fetchedAt:string }

const PLAID_ENV = process.env.PLAID_ENV === "production" ? "production" : "sandbox"
const BASE = PLAID_ENV === "production" ? "https://production.plaid.com" : "https://sandbox.plaid.com"

async function plaid(path:string, body:Record<string,unknown>) {
  const token = process.env.PLAID_ACCESS_TOKEN
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  if (!token || !clientId || !secret) throw new Error("Plaid is not configured")
  const response = await fetch(`${BASE}${path}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({client_id:clientId,secret,...body}) , cache:"no-store"})
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_message || data.error_code || "Plaid request failed")
  return data
}

export async function getPlaidFinancialSnapshot():Promise<FinancialSnapshot> {
  const accounts = await plaid("/accounts/balance/get", { access_token:process.env.PLAID_ACCESS_TOKEN })
  const transactions = await plaid("/transactions/get", { access_token:process.env.PLAID_ACCESS_TOKEN, start_date:new Date(Date.now()-90*86400000).toISOString().slice(0,10), end_date:new Date().toISOString().slice(0,10), options:{count:100} })
  return {
    provider:"PLAID", connected:true,
    accounts:(accounts.accounts || []).map((a:any)=>({id:a.account_id,name:a.name,type:a.type,subtype:a.subtype,currentBalance:a.balances?.current ?? 0,availableBalance:a.balances?.available ?? undefined,currency:a.balances?.iso_currency_code || "USD",mask:a.mask})),
    transactions:(transactions.transactions || []).map((t:any)=>({id:t.transaction_id,accountId:t.account_id,merchant:t.merchant_name,name:t.name,amount:t.amount,currency:t.iso_currency_code || "USD",date:t.date,pending:Boolean(t.pending),category:t.personal_finance_category?.detailed ? [t.personal_finance_category.detailed] : t.category || []})),
    fetchedAt:new Date().toISOString()
  }
}
