import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPublication} from './publish-check.mjs';

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
    let idempotent=0;
    for(const file of manifest.files){
      const exists=await request(fetchImpl,'/contents/'+file.path+'?ref=main',{token,allow404:true});
      if(exists!==null){
        if(exists.encoding!=='base64'||typeof exists.content!=='string')throw Error('LEDGER_READ_UNVERIFIED_'+file.path);
        const old=Buffer.from(exists.content.replace(/\s/g,''),'base64').toString('utf8');
        if(old!==file.content)throw Error('IMMUTABLE_LEDGER_CONFLICT_'+file.path);
        idempotent++;
      }else pending.push(file);
    }
    if(pending.length===0)return {...summary,created:0,idempotent,committed:true,commit_sha:null,attempts:attempt};
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
      return {...summary,created:pending.length,idempotent,committed:true,commit_sha:commit.sha,attempts:attempt};
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
