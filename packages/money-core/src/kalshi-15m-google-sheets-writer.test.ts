import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {Kalshi15mStudySession,KalshiStudyJsonlStore} from './kalshi-15m-study-recorder.js';
import {
  KalshiGoogleSheetsResearchWriter,readKalshiStudyLedger,
  JHADINA_KALSHI_SHEET_ID,
} from './kalshi-15m-google-sheets-writer.js';

const close=Date.UTC(2026,9,13,17,0,0);
const ticker='KXBTC15M-26OCT131700-00';
function session(sink:{append:(r:import('./kalshi-15m-study-recorder.js').KalshiStudyReceipt)=>Promise<void>}) {
  const market={
    ticker,eventTicker:'KXBTC15M-26OCT131700',closesAtMs:close,
    targetUsd:83531.59,rulesPrimary:'BRTI >= target',
    rulesSecondary:'Official 60-second average',
    status:'open' as const,providerEvidenceHash:'f'.repeat(64),
  };
  return new Kalshi15mStudySession(market,sink);
}
test('Drive export appends receipts once with no Google-side price or outcome invention',async()=>{
  const journal:import('./kalshi-15m-study-recorder.js').KalshiStudyReceipt[]=[];
  const at=close-600_000;
  const receipt=await session({append:async r=>{journal.push(r);}}).checkpoint({nowMs:at});
  assert.ok(receipt);
  let saved:unknown[][]=[];
  const calls:{method:string;url:string}[]=[];
  const fetchImpl=(async(input:URL|string|Request,init?:RequestInit)=>{
    const method=init?.method??'GET';const url=String(input);
    calls.push({method,url});
    if(method==='GET') return new Response(JSON.stringify({values:saved}));
    if(method==='POST') {
      const body=JSON.parse(String(init?.body));
      const v=body.values?.[0];
      assert.equal(body.majorDimension,'ROWS');
      assert.equal(body.values.length,1);
      assert.equal(v[10],'ABSTAIN');
      assert.equal(v[14],''); // no made-up outcome
      assert.equal(v[16],'PENDING');
      assert.equal(init?.headers && 'Content-Type' in init.headers,true);
      saved.push(v);
      return new Response('{}',{status:200});
    }
    throw new Error('unexpected method');
  }) as typeof fetch;
  const writer=new KalshiGoogleSheetsResearchWriter({
    tokens:{accessToken:async()=> 'test-oauth-token'},
    fetchImpl,
  });
  assert.equal(writer.spreadsheetId,JHADINA_KALSHI_SHEET_ID);
  assert.deepEqual(await writer.flush([receipt!]),{
    saved:1,alreadyPresent:0,total:1,paperOnly:true,
  });
  assert.deepEqual(await writer.flush([receipt!]),{
    saved:0,alreadyPresent:1,total:1,paperOnly:true,
  });
  assert.equal(calls.filter(x=>x.method==='POST').length,1);
  assert.ok(calls.every(x=>x.url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/')));
});

test('Drive cannot replace existing evidence or accept altered receipts',async()=>{
  const at=close-600_000;
  const receipt=await session({append:async()=>{}}).checkpoint({nowMs:at});
  assert.ok(receipt);
  const writer=new KalshiGoogleSheetsResearchWriter({
    tokens:{accessToken:async()=> 'test-token'},
    fetchImpl:(async()=>new Response(JSON.stringify({values:[[ticker,receipt!.observedAt,600,
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'another-sha']]}))) as typeof fetch,
  });
  await assert.rejects(()=>writer.flush([receipt!]),/EVIDENCE_CONFLICT/);
  await assert.rejects(()=>writer.flush([{...receipt!,brtiUsd:12345}]),/UNVERIFIED_RECEIPT/);
});

test('SHA journal decoder verifies actual disk bytes and partial writes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'kalshi-drive-'));
  const path=join(dir,'receipts.jsonl');
  try{
    const store=await KalshiStudyJsonlStore.open(path);
    const at=close-600_000;
    const receipt=await session(store).checkpoint({nowMs:at});
    assert.ok(receipt);
    const records=await readKalshiStudyLedger(path);
    assert.equal(records.length,1);
    assert.equal(records[0]!.observationHash,receipt!.observationHash);
    const contents=await readFile(path,'utf8');
    await writeFile(path,contents.trimEnd());
    await assert.rejects(()=>readKalshiStudyLedger(path),/PARTIAL_JOURNAL/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
