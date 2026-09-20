export type ExactMoney=Readonly<{coefficient:bigint;scale:number;currency:string}>
export type PositionSide='LONG'|'SHORT'
export interface CashState{accountId:string;cash:ExactMoney;settled:ExactMoney;unsettled:ExactMoney;reserved:ExactMoney;available:ExactMoney;buyingPower:ExactMoney;asOf:string;evidenceRefs:readonly string[]}
export interface TaxLot{lotId:string;accountId:string;instrumentId:string;side:PositionSide;originalQuantity:string;remainingQuantity:string;unitCost:ExactMoney;acquiredAt:string;acquisitionEventId:string;evidenceRefs:readonly string[]}
export interface PositionState{accountId:string;instrumentId:string;side:PositionSide;quantity:string;lotIds:readonly string[];asOf:string;evidenceRefs:readonly string[]}
export interface PortfolioState{portfolioId:string;accountId:string;cash:CashState;positions:readonly PositionState[];lots:readonly TaxLot[];asOf:string;sourceEventIds:readonly string[];stateHash:string}
export function assertCanonicalPortfolio(s:PortfolioState){if(!s.stateHash||!s.sourceEventIds.length)throw new Error('MONEY_CANONICAL_STATE_UNPROVEN');if(s.positions.some(p=>p.accountId!==s.accountId)||s.lots.some(l=>l.accountId!==s.accountId))throw new Error('MONEY_CANONICAL_ACCOUNT_MISMATCH')}
