/**
 * Composition entry point, not an auto-start side effect or deployment.
 * Runs ONLY when the owner commissions a persistent host and provides:
 * - signed handshake custom-header WebSocket factory
 * - Kalshi read-only API credentials (server secrets)
 * - durable host volume
 * - OPTIONAL separately authorized Google Sheets OAuth supplier.
 */
import {isAbsolute} from 'node:path';
import {acquireKalshiJournalLease} from './kalshi-15m-journal-lease.js';
import {
  Kalshi15mContinuousStudyWorker, type KalshiStudyWorkerHealth,
} from './kalshi-15m-study-worker.js';
import {
  KalshiStudyJsonlStore, fetchKalshi15mMarkets,
} from './kalshi-15m-study-recorder.js';
import {
  KalshiSignedStudyFeed, type KalshiServerSocketFactory,
  type KalshiFeedEnv,
} from './kalshi-15m-wss-transport.js';
import {
  KalshiGoogleSheetsResearchWriter,
  readKalshiStudyLedger,
  type KalshiGoogleAuthorizedTokenProvider,
} from './kalshi-15m-google-sheets-writer.js';

export type KalshiStudyServerConfig=Readonly<{
  environment:KalshiFeedEnv;
  keyId:string;
  privateKeyPem:string;
  socketFactory:KalshiServerSocketFactory;
  journalPath:string; // local durable disk, NOT Drive
  googleTokens?:KalshiGoogleAuthorizedTokenProvider;
  onHealth?: (value:KalshiStudyWorkerHealth)=>void;
  onNonFatalError?: (reason:string)=>void;
  signal:AbortSignal;
  now?:()=>number;
  fetchImpl?:typeof fetch;
  syncIntervalMs?:number;
}>;

/**
 * One worker per journal path; duplicate host instances are forbidden.
 * The process writes the local journal first and exports only after commit.
 * Prediction model deliberately absent: the initial run will record honest
 * ABSTAIN plus naive baseline until separately evidenced model is admitted.
 */
export async function runKalshi15mStudyServer(config:KalshiStudyServerConfig):Promise<void>{
  if(!isAbsolute(config.journalPath))
    throw new Error('KALSHI_WORKER_DURABLE_ABSOLUTE_PATH_REQUIRED');
  if(!config.keyId||!config.privateKeyPem||!config.socketFactory)
    throw new Error('KALSHI_WORKER_AUTH_NOT_CONFIGURED');
  if(config.signal.aborted)return;
  const lease=await acquireKalshiJournalLease(config.journalPath);
  try {
  const now=config.now??Date.now;
  const journal=await KalshiStudyJsonlStore.open(config.journalPath);
  const feed=new KalshiSignedStudyFeed({
    environment:config.environment,apiKeyId:config.keyId,
    privateKeyPem:config.privateKeyPem,socketFactory:config.socketFactory,
    now,
  });
  const worker=new Kalshi15mContinuousStudyWorker({
    now,feed,sink:journal,
    listMarkets:async at=>fetchKalshi15mMarkets({
      nowMs:at,fetchImpl:config.fetchImpl,
      baseUrl:config.environment==='demo'
        ? 'https://external-api.demo.kalshi.co/trade-api/v2'
        : 'https://external-api.kalshi.com/trade-api/v2',
    }),
    report:()=>config.onHealth?.(worker.health()),
  });
  const writer=config.googleTokens
    ?new KalshiGoogleSheetsResearchWriter({tokens:config.googleTokens,fetchImpl:config.fetchImpl})
    :null;
  const interval=config.syncIntervalMs??60_000;
  if(!Number.isInteger(interval)||interval<15_000)
    throw new Error('KALSHI_WORKER_SYNC_INTERVAL_INVALID');
  // Drive is an eventually consistent derived report, never the hot ledger.
  // Failed upload does not rewrite/delete committed predictions.
  let inflightSync:Promise<void>|null=null;
  const sync=():Promise<void>=>{
    if(!writer)return Promise.resolve();
    if(inflightSync)return inflightSync;
    const running=(async()=>{
      try{
        const records=await readKalshiStudyLedger(config.journalPath);
        await writer.flush(records);
      }catch{
        config.onNonFatalError?.('KALSHI_DRIVE_SYNC_REQUIRES_RETRY');
      }
    })();
    inflightSync=running;
    void running.finally(()=>{if(inflightSync===running)inflightSync=null;});
    return running;
  };
  let syncTimer:ReturnType<typeof setInterval>|undefined;
  let healthTimer:ReturnType<typeof setInterval>|undefined;
  try{
    if(writer)syncTimer=setInterval(()=>{void sync();},interval);
    healthTimer=setInterval(()=>config.onHealth?.(worker.health()),10_000);
    await worker.run(config.signal);
  }finally{
    if(syncTimer)clearInterval(syncTimer);
    if(healthTimer)clearInterval(healthTimer);
    // Wait for an existing in-flight export, then run a final reconciliation.
    // The authoritative journal remains intact if Google refuses the write.
    if(inflightSync)await inflightSync;
    await sync();
    await worker.stop();
  }
  } finally {
    // Stale locks remain after abnormal power loss and need manual review.
    // A clean shutdown removes only this process's exact lease.
    await lease.release();
  }
}
