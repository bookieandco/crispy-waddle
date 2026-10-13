/**
 * JHADINA-KALSHI.04 — explicitly authorized backend-to-Google-Sheets
 * snapshot exporter. Never used in hot tick path.
 *
 * A host-scoped OAuth access-token supplier is required. The owner's
 * interactive ChatGPT Google Drive connection is NOT a worker OAuth grant.
 * This module has no permission to move money or place Kalshi orders.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {KalshiStudyReceipt} from './kalshi-15m-study-recorder.js';
import {KALSHI_STUDY_SCHEMA,kalshiStudySheetRows} from './kalshi-15m-study-recorder.js';

export const JHADINA_KALSHI_SHEET_ID =
  '1l-heS5CLxx-TyucPa6jQNIZt06axoWiqBB73M5utdPo';
const TAB='Horizon Receipts';
const ORIGIN='https://sheets.googleapis.com/v4/spreadsheets';
function hash(input:unknown):string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
function validReceipt(input:unknown):input is KalshiStudyReceipt {
  if(!input||typeof input!=='object')return false;
  const r=input as Record<string,unknown>;
  if(r.schema!==KALSHI_STUDY_SCHEMA || r.paperOnly!==true ||
    r.canSubmitOrders!==false || r.settlementStatus!=='PENDING' ||
    r.officialOutcome!==null || r.officialSettlementValueUsd!==null ||
    typeof r.id!=='string'||typeof r.observationHash!=='string'||
    typeof r.marketTicker!=='string' || typeof r.horizonSeconds!=='number')return false;
  const {observationHash,...withoutHash}=r;
  return hash(withoutHash)===observationHash &&
    r.id===r.marketTicker+':'+r.horizonSeconds;
}

/** Decode only previously committed immutable records; reject partial journal. */
export async function readKalshiStudyLedger(path:string):Promise<KalshiStudyReceipt[]> {
  const contents=await readFile(path,'utf8');
  if(contents && !contents.endsWith('\n'))throw new Error('KALSHI_DRIVE_PARTIAL_JOURNAL');
  const ids=new Set<string>();
  const parsed:KalshiStudyReceipt[]=[];
  for(const line of contents.split('\n').filter(Boolean)){
    const r:unknown=JSON.parse(line);
    if(!validReceipt(r))throw new Error('KALSHI_DRIVE_LEDGER_INVALID');
    if(ids.has(r.id))throw new Error('KALSHI_DRIVE_LEDGER_DUPLICATE');
    ids.add(r.id);
    parsed.push(r);
  }
  return parsed;
}

export interface KalshiGoogleAuthorizedTokenProvider {
  /** OAuth or service-account token resolved on the trusted server only. */
  accessToken():Promise<string>;
}
export type KalshiGoogleReportResult = Readonly<{
  saved:number;
  alreadyPresent:number;
  total:number;
  paperOnly:true;
}>;

export class KalshiGoogleSheetsResearchWriter {
  readonly spreadsheetId:string;
  private readonly tokens:KalshiGoogleAuthorizedTokenProvider;
  private readonly fetchImpl:typeof fetch;
  private readonly apiBase:string;
  constructor(options:{
    tokens:KalshiGoogleAuthorizedTokenProvider;
    fetchImpl?:typeof fetch;
    spreadsheetId?:string;
  }){
    this.spreadsheetId=options.spreadsheetId??JHADINA_KALSHI_SHEET_ID;
    if(!/^[A-Za-z0-9_-]{20,}$/.test(this.spreadsheetId))
      throw new Error('KALSHI_DRIVE_SHEET_ID_INVALID');
    this.tokens=options.tokens;
    this.fetchImpl=options.fetchImpl??fetch;
    this.apiBase=ORIGIN+'/'+this.spreadsheetId+'/values';
  }

  /**
   * Reconciles all official report rows prior to any append. Intended for one
   * uploader process only. Conflicts never overwrite remote history.
   * Ambiguous transport errors should be retried after a new read pass.
   */
  async flush(receipts:readonly KalshiStudyReceipt[]):Promise<KalshiGoogleReportResult> {
    for(const r of receipts)if(!validReceipt(r))
      throw new Error('KALSHI_DRIVE_UNVERIFIED_RECEIPT');
    const token=await this.tokens.accessToken();
    if(!token||/\s/.test(token))throw new Error('KALSHI_DRIVE_TOKEN_MISSING');
    const headers={Authorization:'Bearer '+token,Accept:'application/json'};
    // Use RAW to avoid interpreting provider values as spreadsheet formulas.
    const range=encodeURIComponent("'"+TAB+"'!A2:R10000");
    const get=await this.fetchImpl(this.apiBase+'/'+range+'?valueRenderOption=UNFORMATTED_VALUE',{
      method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(15_000),
    });
    if(!get.ok)throw new Error('KALSHI_DRIVE_READ_FAILED_'+get.status);
    const body:unknown=await get.json();
    if(!body||typeof body!=='object'||Array.isArray(body))
      throw new Error('KALSHI_DRIVE_SHEET_RESPONSE_INVALID');
    const remoteRows=(body as {values?:unknown}).values??[];
    if(!Array.isArray(remoteRows))throw new Error('KALSHI_DRIVE_SHEET_ROWS_INVALID');
    const known=new Map<string,string>();
    for(const row of remoteRows){
      if(!Array.isArray(row)||row.length<18 ||
         typeof row[0]!=='string'||typeof row[2]!=='string'&&typeof row[2]!=='number' ||
         typeof row[17]!=='string')throw new Error('KALSHI_DRIVE_REMOTE_ROW_INVALID');
      const id=row[0]+':'+String(row[2]);
      if(known.has(id))throw new Error('KALSHI_DRIVE_REMOTE_DUPLICATE');
      known.set(id,row[17]);
    }
    let saved=0,alreadyPresent=0;
    const sorted=[...receipts].sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
    for(const r of sorted){
      const remote=known.get(r.id);
      if(remote){
        if(remote!==r.observationHash)throw new Error('KALSHI_DRIVE_EVIDENCE_CONFLICT');
        alreadyPresent++;
        continue;
      }
      const row=kalshiStudySheetRows([r])[1];
      if(!row||row.length!==19)throw new Error('KALSHI_DRIVE_FORMAT_INVALID');
      const appendRange=encodeURIComponent("'"+TAB+"'!A:S")+
        ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
      const result=await this.fetchImpl(this.apiBase+'/'+appendRange,{
        method:'POST',
        headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({majorDimension:'ROWS',values:[row]}),
        cache:'no-store',signal:AbortSignal.timeout(15_000),
      });
      if(!result.ok)throw new Error('KALSHI_DRIVE_APPEND_FAILED_'+result.status);
      known.set(r.id,r.observationHash);
      saved++;
    }
    return Object.freeze({saved,alreadyPresent,total:receipts.length,paperOnly:true});
  }
}
