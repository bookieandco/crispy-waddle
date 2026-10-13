/**
 * Opt-in Google Sheets worker OAuth via a separately installed and pinned
 * google-auth-library runtime. Credentials never enter source, stdout,
 * Google Sheet cells, or Kalshi market WebSocket messages.
 */
import {createRequire} from 'node:module';
import {isAbsolute,join} from 'node:path';
import type {KalshiGoogleAuthorizedTokenProvider} from './kalshi-15m-google-sheets-writer.js';

type GoogleAuthLike={getClient():Promise<{
  getAccessToken():Promise<{token?:string|null}|string|null>;
}>};

export function kalshiGoogleServiceAccountTokens(options:{
  runtimeDir:string;
  credentialsPath:string;
}):KalshiGoogleAuthorizedTokenProvider{
  if(!isAbsolute(options.runtimeDir)||!isAbsolute(options.credentialsPath))
    throw new Error('KALSHI_GOOGLE_HOST_PATH_ABSOLUTE_REQUIRED');
  const requireFrom=createRequire(join(options.runtimeDir,'kalshi-google.js'));
  let ctor:unknown;
  try{
    const library=requireFrom('google-auth-library') as Record<string,unknown>;
    ctor=library.GoogleAuth;
  }catch{throw new Error('KALSHI_GOOGLE_AUTH_LIBRARY_NOT_INSTALLED');}
  if(typeof ctor!=='function')throw new Error('KALSHI_GOOGLE_AUTH_LIBRARY_INVALID');
  const Auth=ctor as new(options:{keyFile:string;scopes:string[]})=>GoogleAuthLike;
  const auth=new Auth({
    keyFile:options.credentialsPath,
    scopes:['https://www.googleapis.com/auth/spreadsheets'],
  });
  let cachedClient:ReturnType<GoogleAuthLike['getClient']>|null=null;
  return Object.freeze({
    accessToken:async()=>{
      cachedClient??=auth.getClient();
      let client:Awaited<ReturnType<GoogleAuthLike['getClient']>>;
      try{client=await cachedClient;}
      catch{cachedClient=null;throw new Error('KALSHI_GOOGLE_AUTH_CLIENT_UNAVAILABLE');}
      const grant=await client.getAccessToken();
      const token=typeof grant==='string'?grant:grant?.token;
      if(typeof token!=='string'||!token||/\s/.test(token))
        throw new Error('KALSHI_GOOGLE_OAUTH_TOKEN_UNAVAILABLE');
      return token;
    },
  });
}
