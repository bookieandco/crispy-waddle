import {readFileSync} from 'node:fs';
import {hash, verifyResearchForecast} from './core.mjs';
export function checkPublication(pub){
 if(pub?.schema_version!=='sports.publication.v1'||!Array.isArray(pub.files)||pub.files.length<1||pub.files.length>128)throw Error('PUBLICATION_SCHEMA');
 const names=new Set();let forecasts=0,preliminary=0,runs=0,summaries=0;
 for(const file of pub.files){
  const isJson=typeof file.path==='string'&&/^training\/sports\/paper-ledger\/week001\/(?:forecasts|preliminary|runs)\/[a-zA-Z0-9_.-]+\.json$/.test(file.path);
  const isSummary=typeof file.path==='string'&&/^training\/sports\/paper-ledger\/week001\/summaries\/[0-9]{1,20}(?:-[0-9]{1,4})?\.md$/.test(file.path);
  if((!isJson&&!isSummary)||names.has(file.path)||typeof file.content!=='string'||Buffer.byteLength(file.content,'utf8')>180000)throw Error('PUBLICATION_FILE_INVALID');
  names.add(file.path);
  if(isSummary){
    if(!file.content.startsWith('## Jhadina Sports Lab')||
       !file.content.includes('Real bets: **0**')||
       !file.content.includes('No verified betting market prices'))throw Error('SUMMARY_UNSAFE_OR_INVALID');
    summaries++;continue;
  }
  const obj=JSON.parse(file.content);
  if(file.path.includes('/forecasts/')){verifyResearchForecast(obj);forecasts++;}
  else if(file.path.includes('/preliminary/')){
    const {sha256,...data}=obj;
    if(hash(data)!==sha256||obj.status!=='PRELIMINARY_UNOFFICIAL_NOT_SETTLED'||obj.eligible_for_training!==false||obj.real_bet!==false)throw Error('GRADE_INVALID');
    preliminary++;
  } else {
    if(obj.schema_version!=='jhadina.sports.week001_run.v2'||obj.placed_bets!==0||obj.virtual_bankroll_usd!==3100||obj.training_updates!==0)throw Error('RUN_REPORT_INVALID');runs++;
  }
 }
 if(runs!==1)throw Error('RUN_RECEIPT_REQUIRED');
 return {files:pub.files.length,forecasts,preliminary,run_receipts:runs,markdown_summaries:summaries,all_paper_only:true};
}
if(process.argv[1]?.endsWith('/publish-check.mjs')){
 const p=process.argv[2];if(!p)throw Error('MANIFEST_REQUIRED');
 console.log(JSON.stringify(checkPublication(JSON.parse(readFileSync(p,'utf8')))));
}
