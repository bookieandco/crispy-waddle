export const PAPER_REALISM_SCHEMA_VERSION = 'MONEY-PAPER-REALISM-01' as const;

export type PaperCommissionModel =
  | Readonly<{ kind: 'NONE' }>
  | Readonly<{ kind: 'FIXED_PER_ORDER'; amountMinor: bigint }>
  | Readonly<{ kind: 'BPS_OF_NOTIONAL'; bps: number }>;

export type PaperRealismProfile = Readonly<{
  schemaVersion: typeof PAPER_REALISM_SCHEMA_VERSION;
  profileId: string;
  startingEquityMinor: bigint;
  currency: string;
  leverageBps: number;
  marginEnabled: boolean;
  commission: PaperCommissionModel;
  slippageBps: number;
  requireProtectiveExitPlan: boolean;
  maximumRiskPerTradeBps: number;
  warmupExecutionCount: number;
  paperSuccessCanAuthorizeLive: false;
  psychologicalEquivalenceToLive: false;
  authority: 'SIMULATION_CONFIG_ONLY';
}>;

export type PaperRealismAssessment = Readonly<{
  profileId: string;
  status: 'PASS' | 'REVIEW' | 'FAIL';
  reasonCodes: readonly string[];
  authority: 'SIMULATION_REVIEW_ONLY';
  canAuthorizeLive: false;
}>;

function bps(value:number,code:string):void{
  if(!Number.isInteger(value)||value<0||value>10000)throw new Error(code)
}

export function createPaperRealismProfile(input:Readonly<{
  profileId:string;
  startingEquityMinor:bigint;
  currency:string;
  leverageBps?:number;
  marginEnabled?:boolean;
  commission?:PaperCommissionModel;
  slippageBps?:number;
  requireProtectiveExitPlan?:boolean;
  maximumRiskPerTradeBps?:number;
  warmupExecutionCount?:number;
}>):PaperRealismProfile{
  if(!input.profileId.trim()||!input.currency.trim())throw new Error('MONEY_PAPER_REALISM_IDENTITY_REQUIRED')
  if(input.startingEquityMinor<=0n)throw new Error('MONEY_PAPER_REALISM_EQUITY_INVALID')
  const leverageBps=input.leverageBps??10000
  if(!Number.isInteger(leverageBps)||leverageBps<10000||leverageBps>100000)throw new Error('MONEY_PAPER_REALISM_LEVERAGE_INVALID')
  const marginEnabled=input.marginEnabled??false
  if(!marginEnabled&&leverageBps!==10000)throw new Error('MONEY_PAPER_REALISM_MARGIN_LEVERAGE_MISMATCH')
  const commission=input.commission??Object.freeze({kind:'NONE' as const})
  if(commission.kind==='FIXED_PER_ORDER'&&commission.amountMinor<0n)throw new Error('MONEY_PAPER_REALISM_COMMISSION_INVALID')
  if(commission.kind==='BPS_OF_NOTIONAL')bps(commission.bps,'MONEY_PAPER_REALISM_COMMISSION_INVALID')
  const slippageBps=input.slippageBps??5
  bps(slippageBps,'MONEY_PAPER_REALISM_SLIPPAGE_INVALID')
  const maximumRiskPerTradeBps=input.maximumRiskPerTradeBps??100
  bps(maximumRiskPerTradeBps,'MONEY_PAPER_REALISM_RISK_INVALID')
  const warmupExecutionCount=input.warmupExecutionCount??10
  if(!Number.isInteger(warmupExecutionCount)||warmupExecutionCount<0||warmupExecutionCount>1000)throw new Error('MONEY_PAPER_REALISM_WARMUP_INVALID')
  return Object.freeze({
    schemaVersion:PAPER_REALISM_SCHEMA_VERSION,
    profileId:input.profileId,
    startingEquityMinor:input.startingEquityMinor,
    currency:input.currency,
    leverageBps,
    marginEnabled,
    commission,
    slippageBps,
    requireProtectiveExitPlan:input.requireProtectiveExitPlan??true,
    maximumRiskPerTradeBps,
    warmupExecutionCount,
    paperSuccessCanAuthorizeLive:false,
    psychologicalEquivalenceToLive:false,
    authority:'SIMULATION_CONFIG_ONLY',
  })
}

export function assessPaperRealism(input:Readonly<{
  profile:PaperRealismProfile;
  currentEquityMinor:bigint;
  requestedNotionalMinor:bigint;
  plannedMaximumLossMinor?:bigint;
  hasProtectiveExitPlan:boolean;
}>):PaperRealismAssessment{
  const {profile}=input
  const reasons:string[]=[]
  if(input.currentEquityMinor<=0n)reasons.push('NON_POSITIVE_EQUITY')
  if(input.requestedNotionalMinor<=0n)reasons.push('NON_POSITIVE_NOTIONAL')
  if(!profile.marginEnabled&&input.requestedNotionalMinor>input.currentEquityMinor)reasons.push('UNLEVERED_NOTIONAL_EXCEEDS_EQUITY')
  if(profile.requireProtectiveExitPlan&&!input.hasProtectiveExitPlan)reasons.push('PROTECTIVE_EXIT_REQUIRED')
  if(input.plannedMaximumLossMinor!==undefined){
    if(input.plannedMaximumLossMinor<0n)reasons.push('MAXIMUM_LOSS_INVALID')
    else if(input.currentEquityMinor>0n){
      const riskBps=Number(input.plannedMaximumLossMinor*10000n/input.currentEquityMinor)
      if(riskBps>profile.maximumRiskPerTradeBps)reasons.push('RISK_PER_TRADE_EXCEEDED')
    }
  } else {
    reasons.push('MAXIMUM_LOSS_UNKNOWN')
  }
  const hard=new Set(['NON_POSITIVE_EQUITY','NON_POSITIVE_NOTIONAL','UNLEVERED_NOTIONAL_EXCEEDS_EQUITY','PROTECTIVE_EXIT_REQUIRED','RISK_PER_TRADE_EXCEEDED'])
  const status:PaperRealismAssessment['status']=reasons.some(r=>hard.has(r))?'FAIL':reasons.length?'REVIEW':'PASS'
  return Object.freeze({
    profileId:profile.profileId,
    status,
    reasonCodes:Object.freeze(reasons),
    authority:'SIMULATION_REVIEW_ONLY',
    canAuthorizeLive:false,
  })
}
