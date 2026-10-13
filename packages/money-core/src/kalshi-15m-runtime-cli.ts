/**
 * JHADINA-KALSHI.05 — opt-in process runner for the PAPER-ONLY observer.
 * Never runs via import of Money Core or Vercel. No automatic paid deployment.
 *
 * Host-only runtime prerequisite:
 * install audited/pinned `ws` in a dedicated local package directory, then
 * point KALSHI_WS_PACKAGE_DIR to that absolute directory. This keeps the
 * existing frozen pnpm workspace lock untouched until host commissioning.
 */
import {createRequire} from 'node:module';
import {join,isAbsolute} from 'node:path';
import {runKalshi15mStudyServer} from './kalshi-15m-server-compose.js';
import {kalshiGoogleServiceAccountTokens} from './kalshi-15m-google-host-auth.js';
import type {KalshiServerSocketFactory,KalshiServerWebSocket} from './kalshi-15m-wss-transport.js';

function envPem(env:NodeJS.ProcessEnv):string {
  const encoded=env.KALSHI_PRIVATE_KEY_BASE64?.trim();
  if(encoded){
    const pem=Buffer.from(encoded,'base64').toString('utf8');
    if(!pem.includes('BEGIN PRIVATE KEY') && !pem.includes('BEGIN RSA PRIVATE KEY'))
      throw new Error('KALSHI_HOST_PRIVATE_KEY_INVALID');
    return pem;
  }
  throw new Error('KALSHI_HOST_PRIVATE_KEY_BASE64_REQUIRED');
}

/** Refuse hidden runtime downloads or an unapproved package search path. */
export function kalshiHostSocketFactory(runtimeDir:string):KalshiServerSocketFactory {
  if(!isAbsolute(runtimeDir))throw new Error('KALSHI_WS_RUNTIME_DIR_ABSOLUTE_REQUIRED');
  const requireFrom=createRequire(join(runtimeDir,'kalshi-runtime.js'));
  let Ws:unknown;
  try{Ws=requireFrom('ws');}
  catch{throw new Error('KALSHI_WS_PACKAGE_NOT_INSTALLED');}
  if(typeof Ws!=='function')
    throw new Error('KALSHI_WS_RUNTIME_INVALID');
  const Ctor=Ws as new(url:string,options:{
    headers:Readonly<Record<string,string>>;
    handshakeTimeout:number;
    perMessageDeflate:false;
    rejectUnauthorized:true;
    maxPayload:number;
  })=>KalshiServerWebSocket;
  return(url,opts)=>{
    if(!url.startsWith('wss://external-api-ws.kalshi.com/') &&
       !url.startsWith('wss://external-api-ws.demo.kalshi.co/'))
      throw new Error('KALSHI_WS_HOST_FORBIDDEN');
    return new Ctor(url,{...opts,rejectUnauthorized:true,maxPayload:1_000_000});
  };
}

/** No side effects until explicitly invoked on an approved persistent host. */
export async function launchKalshi15mPaperHost(env:NodeJS.ProcessEnv=process.env):Promise<void>{
  if(env.KALSHI_PAPER_ONLY!=='true')throw new Error('KALSHI_HOST_PAPER_ONLY_REQUIRED');
  if(env.KALSHI_LIVE_EXECUTION==='true')throw new Error('KALSHI_HOST_LIVE_EXECUTION_FORBIDDEN');
  const environment=env.KALSHI_ENV;
  if(environment!=='demo'&&environment!=='production')throw new Error('KALSHI_HOST_ENV_INVALID');
  const keyId=env.KALSHI_API_KEY_ID?.trim()||'';
  if(!keyId)throw new Error('KALSHI_HOST_KEY_ID_REQUIRED');
  const journalPath=env.KALSHI_JOURNAL_PATH?.trim()||'';
  if(!isAbsolute(journalPath))throw new Error('KALSHI_HOST_JOURNAL_ABSOLUTE_REQUIRED');
  const runtimeDir=env.KALSHI_WS_PACKAGE_DIR?.trim()||'';
  const socketFactory=kalshiHostSocketFactory(runtimeDir);
  const privateKeyPem=envPem(env);
  const googleTokens=env.KALSHI_GOOGLE_SYNC_ENABLED==='true'
    ?kalshiGoogleServiceAccountTokens({
      runtimeDir:env.KALSHI_GOOGLE_PACKAGE_DIR||'',
      credentialsPath:env.KALSHI_GOOGLE_CREDENTIALS_PATH||'',
    }):undefined;
  const shutdown=new AbortController();
  const stop=()=>shutdown.abort();
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  try{
    await runKalshi15mStudyServer({
      environment,keyId,privateKeyPem,journalPath,socketFactory,
      googleTokens,signal:shutdown.signal,
      onHealth:state=>{process.stdout.write(JSON.stringify({
        type:'KALSHI_PAPER_HEALTH',...state,at:new Date().toISOString(),
      })+'\n');},
      onNonFatalError:code=>{
        process.stderr.write(JSON.stringify({type:'KALSHI_PAPER_WARNING',code})+'\n');
      },
      // Background Drive sync remains OFF until explicit host secrets and
      // KALSHI_GOOGLE_SYNC_ENABLED=true are provisioned.
    });
  }finally{
    process.off('SIGINT',stop);
    process.off('SIGTERM',stop);
  }
}

if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  launchKalshi15mPaperHost().catch(error=>{
    const code=error instanceof Error?error.message:'KALSHI_HOST_UNKNOWN_ERROR';
    // Never log the error object: it may contain auth/session details.
    process.stderr.write(JSON.stringify({type:'KALSHI_PAPER_FATAL',code})+'\n');
    process.exitCode=1;
  });
}
