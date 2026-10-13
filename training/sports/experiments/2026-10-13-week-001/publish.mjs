import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPublication} from './publish-check.mjs';

export async function publishManifest(manifest,{token,repository,branch='main',fetchImpl=fetch}={}){
  const summary=checkPublication(manifest);
  if(repository!=='bookieandco/crispy-waddle'||branch!=='main'||!token)throw Error('PUBLISH_NOT_AUTHORIZED');
  const [owner,repo]=repository.split('/');
  let created=0,idempotent=0;
  for(const file of manifest.files){
    const endpoint=`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
    const headers={'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
    const res=await fetchImpl(endpoint,{method:'PUT',headers,body:JSON.stringify({message:'sports(paper): append-only evidence '+file.path,branch,content:Buffer.from(file.content).toString('base64')})});
    if(res.status===201){created++;continue;}
    if(res.status===422){
      const current=await fetchImpl(endpoint+'?ref='+encodeURIComponent(branch),{headers});
      if(!current.ok)throw Error('LEDGER_READ_FAILED_'+current.status);
      const raw=await current.json();
      const old=Buffer.from(String(raw.content||'').replace(/\s/g,''),'base64').toString('utf8');
      if(old===file.content){idempotent++;continue;}
      throw Error('IMMUTABLE_LEDGER_CONFLICT_'+file.path);
    }
    throw Error('LEDGER_WRITE_FAILED_'+res.status+'_'+file.path);
  }
  return {...summary,created,idempotent,committed:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.env.GITHUB_ACTIONS!=='true')throw Error('GITHUB_ACTIONS_REQUIRED');
    const p=process.argv[2];if(!p)throw Error('PUBLICATION_FILE_REQUIRED');
    const pub=JSON.parse(readFileSync(p,'utf8'));
    console.log(JSON.stringify(await publishManifest(pub,{token:process.env.GITHUB_TOKEN,repository:process.env.GITHUB_REPOSITORY,branch:process.env.GITHUB_REF_NAME})));
  }catch(e){console.error('PUBLISH_FAILED:',e.message);process.exitCode=1;}
}
