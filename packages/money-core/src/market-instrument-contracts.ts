export type SessionStatus='OPEN'|'CLOSED'|'PRE_OPEN'|'AUCTION'|'POST_MARKET'|'HALTED'|'SUSPENDED'|'HOLIDAY'|'EXPIRED'|'UNKNOWN'
export interface MarketSession{sessionId:string;marketId:string;venue:string;timezone:string;opensAt:string;closesAt:string;status:SessionStatus;observedAt:string;effectiveAt:string;evidenceRefs:readonly string[]}
export type ResolutionStatus='RESOLVED'|'AMBIGUOUS'|'UNRESOLVED'|'CONFLICTING'|'RETIRED'
export interface CanonicalInstrument{instrumentId:string;assetClass:string;instrumentType:string;venue:string;identifiers:readonly string[];quoteCurrency:string;settlementCurrency:string;status:string;provenanceHash:string}
export function assertExecutableInstrument(i:CanonicalInstrument,status:ResolutionStatus){if(status!=='RESOLVED'||!i.provenanceHash)throw new Error('MONEY_INSTRUMENT_NOT_EXECUTABLE')}
