import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPublication} from './publish-check.mjs';
import {verifyResearchForecast} from './core.mjs';

const API='https://api.github.com/repos/bookieandco/crispy-waddle';
async function request(fetchImpl,endpoint,{method='GET',token,body,allow404=false}={}){
  const r=await fetchImpl(API+endpoint,{method,headers:{
    Accept:'application/vnd.github+json',
    Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28',
    ...(body?{'Content-Type':'application/json'}:{})
  },...(body?{body:JSON.stringify(body)}:{})});
  if(allow404&&r.status===404)return null;
  if(!r.ok)throw Error('GITHUB_API_'+method+'_'+r.status+'_'+endpoint.split('?')[0]);
  return await r.json();
}

// One append-only Git commit per batch. Unlike PUT contents, this does not
// trigger unrelated CI for every individual forecast receipt.
export async function publishBatch(manifest,{token,repository,branch='main',fetchImpl=fetch,maxAttempts=3}={}){
  const summary=checkPublication(manifest);
  if(repository!=='bookieandco/crispy-waddle'||branch!=='main'||!token)throw Error('PUBLISH_NOT_AUTHORIZED');
  const attempts=Math.max(1,Math.min(maxAttempts,3));
  for(let attempt=1;attempt<=attempts;attempt++){
    const ref=await request(fetchImpl,'/git/ref/heads/main',{token});
    const parent=ref?.object?.sha;
    if(!/^[a-f0-9]{40}$/.test(parent||''))throw Error('INVALID_HEAD');
    const pending=[];
    const suppressed=[];
    let idempotent=0;
    for(const file of manifest.files){
      const exists=await request(fetchImpl,'/contents/'+file.path+'?ref=main',{token,allow404:true});
      if(exists!==null){
        if(exists.encoding!=='base64'||typeof exists.content!=='string')throw Error('LEDGER_READ_UNVERIFIED_'+file.path);
        const old=Buffer.from(exists.content.replace(/\s/g,''),'base64').toString('utf8');
        if(old!==file.content){
          // Two runs can observe the same event before either has published.
          // The first cryptographically valid forecast wins; newer candidates
          // are never overwritten, admitted to training, or called predictions.
          if(!file.path.includes('/forecasts/'))throw Error('IMMUTABLE_LEDGER_CONFLICT_'+file.path);
          let canonical,candidate;
          try{
            canonical=JSON.parse(old);candidate=JSON.parse(file.content);
            verifyResearchForecast(canonical);verifyResearchForecast(candidate);
          }catch{throw Error('INVALID_FORECAST_CONFLICT_'+file.path);}
          if(canonical.event_id!==candidate.event_id||canonical.sha256===candidate.sha256)
            throw Error('IMMUTABLE_LEDGER_CONFLICT_'+file.path);
          suppressed.push({
            event_id:candidate.event_id,original_sha256:canonical.sha256,
            discarded_candidate_sha256:candidate.sha256,ledger_path:file.path
          });
          continue;
        }
        idempotent++;
      }else pending.push({...file});
    }
    if(suppressed.length){
      const reportFile=pending.find(f=>f.path.includes('/runs/')&&f.path.endsWith('.json'));
      if(!reportFile)throw Error('SUPPRESSED_WITHOUT_NEW_RUN_RECEIPT');
      const report=JSON.parse(reportFile.content);
      const accepted=pending.filter(f=>f.path.includes('/forecasts/')).length;
      report.publication_resolution={
        status:'FIRST_WRITER_WINS_DUPLICATE_CANDIDATES_SUPPRESSED',
        candidates_dropped:suppressed.length,
        forecast_receipts_accepted:accepted,
        original_report_forecast_candidates:report.research_forecasts_created,
        conflicts:suppressed,
        note:'Canonical forecasts remain immutable. Dropped candidates were NOT published or evaluated.'
      };
      reportFile.content=JSON.stringify(report,null,2)+'\n';
      const lines=[
        '## Jhadina Sports Lab — Week 001',
        '',
        '**Publication review:** Earlier runs sealed some of the same events. This run kept the canonical first-writer forecast and suppressed '+suppressed.length+' later candidates.',
        '',
        '- New research forecasts published by this run: **'+accepted+'**',
        '- Suppressed duplicate candidates: **'+suppressed.length+'**',
        '- Real bets: **0**; staked: **$0**, simulated bankroll: **$3,100**',
        '',
        '| Event | Canonical SHA-256 | Discarded candidate SHA-256 |',
        '|---|---|---|',
        ...suppressed.map(x=>'| '+x.event_id+' | '+x.original_sha256+' | '+x.discarded_candidate_sha256+' |'),
        '',
        'No verified betting market prices or official settlement. No automated training updates.',
        ''
      ];
      for(const summaryFile of pending.filter(f=>f.path.includes('/summaries/')&&f.path.endsWith('.md')))
        summaryFile.content=lines.join('\n');
      // Recheck every modified file against the same publication admission
      // gates before constructing the Git tree.
      checkPublication({schema_version:manifest.schema_version,files:pending});
    }
    if(pending.length===0)return {...summary,created:0,idempotent,suppressed_forecasts:suppressed.length,committed:true,commit_sha:null,attempts:attempt};
    const parentCommit=await request(fetchImpl,'/git/commits/'+parent,{token});
    if(!/^[a-f0-9]{40}$/.test(parentCommit?.tree?.sha||''))throw Error('INVALID_BASE_TREE');
    const tree=await request(fetchImpl,'/git/trees',{token,method:'POST',body:{
      base_tree:parentCommit.tree.sha,
      tree:pending.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.content}))
    }});
    if(!/^[a-f0-9]{40}$/.test(tree?.sha||''))throw Error('INVALID_NEW_TREE');
    const commit=await request(fetchImpl,'/git/commits',{token,method:'POST',body:{
      message:'sports(paper): append-only batch '+pending.length+' evidence records',
      tree:tree.sha,parents:[parent]
    }});
    if(!/^[a-f0-9]{40}$/.test(commit?.sha||''))throw Error('INVALID_NEW_COMMIT');
    try{
      await request(fetchImpl,'/git/refs/heads/main',{token,method:'PATCH',body:{sha:commit.sha,force:false}});
      return {...summary,created:pending.length,idempotent,suppressed_forecasts:suppressed.length,
        accepted_forecasts:pending.filter(f=>f.path.includes('/forecasts/')).length,
        committed:true,commit_sha:commit.sha,attempts:attempt};
    }catch(err){
      // Other workflows may commit in parallel. Start fresh from current HEAD,
      // recheck every path, and never force-update the branch.
      if(!/GITHUB_API_PATCH_(409|422)_/.test(err.message)||attempt===attempts)throw err;
    }
  }
  throw Error('BATCH_COMMIT_RETRY_EXHAUSTED');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.env.GITHUB_ACTIONS!=='true')throw Error('GITHUB_ACTIONS_REQUIRED');
    if(!process.argv[2])throw Error('PUBLICATION_FILE_REQUIRED');
    const pub=JSON.parse(readFileSync(process.argv[2],'utf8'));
    const out=await publishBatch(pub,{token:process.env.GITHUB_TOKEN,repository:process.env.GITHUB_REPOSITORY,branch:process.env.GITHUB_REF_NAME});
    console.log(JSON.stringify(out));
  }catch(error){console.error('BATCH_PUBLISH_FAILED:',error.message);process.exitCode=1;}
}
