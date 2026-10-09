import {createServer} from 'node:http'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {createRunpodShadowPool,createRunpodShadowStore} from './shark-shadow-runpod-store.js'
import {runRunpodShadowCycle} from './shark-shadow-runpod-runtime.js'
import {parseRunpodShadowReplayRecord,runRunpodShadowAutoReplay,runRunpodShadowReplay} from './shark-shadow-runpod-replay.js'
import {certifyRunpodShadowLive} from './shark-shadow-live-certification.js'
import {runRunpodShadowLegacyCorrectionReview} from './shark-shadow-legacy-corrections.js'
import {bearerToken,verifyGithubShadowOidc} from './shark-shadow-github-oidc.js'
import {classifyShadowServiceReadiness} from './shark-shadow-service-readiness.js'

const intEnv=(name:string,fallback:number,min:number,max:number)=>{
  const n=Number(process.env[name]??fallback)
  return Number.isInteger(n)&&n>=min&&n<=max?n:fallback
}
async function readJsonBody(req:import('node:http').IncomingMessage,maxBytes=65536):Promise<any>{
  let size=0
  const chunks:Buffer[]=[]
  for await(const chunk of req){
    const buf=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)
    size+=buf.length
    if(size>maxBytes)throw new Error('SHADOW_SYNC_BODY_TOO_LARGE')
    chunks.push(buf)
  }
  if(!chunks.length)return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const store=createRunpodShadowStore(createRunpodShadowPool())
let running=false
let lastError:string|undefined

async function cycle(){
  if(running)return
  running=true
  try{
    const receipt=await runRunpodShadowCycle({store})
    let replay
    try{replay=await runRunpodShadowAutoReplay({store})}catch(error){
      process.stderr.write('RUNPOD_SHADOW_AUTO_REPLAY_FAILED:'+(error instanceof Error?error.message:String(error))+'\n')
    }
    lastError=undefined
    await store.putRuntimeState('service-status',{
      status:'ready',updatedAt:new Date().toISOString(),lastCycle:receipt,lastReplay:replay,
      authority:'SHADOW_LEARNING_ONLY',canExecute:false,canSign:false,canBroadcast:false,
    })
    process.stdout.write(JSON.stringify({cycle:receipt,replay})+'\n')
  }catch(error){
    lastError=error instanceof Error?error.message:String(error)
    await store.putRuntimeState('service-status',{
      status:'degraded',updatedAt:new Date().toISOString(),reason:'SHADOW_CYCLE_FAILED',
      authority:'SHADOW_LEARNING_ONLY',canExecute:false,canSign:false,canBroadcast:false,
    }).catch(()=>undefined)
    process.stderr.write('RUNPOD_SHADOW_CYCLE_FAILED:'+lastError+'\n')
  }finally{running=false}
}

async function serve(){
  await store.probe()
  const port=intEnv('SHARK_SHADOW_HEALTH_PORT',8094,1024,65535)
  const intervalMs=intEnv('SHARK_SHADOW_INTERVAL_SECONDS',300,60,3600)*1000
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url??'/',`http://127.0.0.1:${port}`)
    res.setHeader('content-type','application/json')
    res.setHeader('cache-control','no-store')
    if(url.pathname==='/sync/export'){
      try{
        if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'method_not_allowed'}));return}
        await verifyGithubShadowOidc(bearerToken(req.headers.authorization))
        const limit=Math.max(1,Math.min(500,Number(url.searchParams.get('limit')??200)))
        const records=await store.pendingSync({limit})
        res.statusCode=200
        res.end(JSON.stringify({
          records,count:records.length,authority:'SHADOW_EXPORT_ONLY',
          canExecute:false,canAuthorizeLive:false,
        }))
      }catch(error){
        res.statusCode=401
        res.end(JSON.stringify({error:'unauthorized',reason:error instanceof Error?error.message:'invalid'}))
      }
      return
    }
    if(url.pathname==='/sync/ack'){
      try{
        if(req.method!=='POST'){res.statusCode=405;res.end(JSON.stringify({error:'method_not_allowed'}));return}
        await verifyGithubShadowOidc(bearerToken(req.headers.authorization))
        const body=await readJsonBody(req)
        const syncIds=Array.isArray(body?.syncIds)?body.syncIds.map(Number).filter((x:number)=>Number.isInteger(x)&&x>0).slice(0,500):[]
        if(!syncIds.length){res.statusCode=400;res.end(JSON.stringify({error:'sync_ids_required'}));return}
        const acknowledged=await store.acknowledgeSync(syncIds,new Date().toISOString())
        res.statusCode=200
        res.end(JSON.stringify({
          acknowledged,authority:'LOCAL_QUEUE_ACK_ONLY',
          canExecute:false,canAuthorizeLive:false,
        }))
      }catch(error){
        res.statusCode=401
        res.end(JSON.stringify({error:'unauthorized',reason:error instanceof Error?error.message:'invalid'}))
      }
      return
    }

    if(url.pathname==='/health/live'){
      res.statusCode=200
      res.end(JSON.stringify({status:'live',authority:'SHADOW_LEARNING_ONLY',canExecute:false}))
      return
    }
    if(url.pathname==='/health'){
      try{
        await store.probe()
        const [counts,lastLive,lastOutcomes,status,certification,lastReplay,storage]=await Promise.all([
          store.counts(),
          store.getRuntimeState('last-live-cycle'),
          store.getRuntimeState('last-outcome-cycle'),
          store.getRuntimeState('service-status'),
          store.liveCertificationSnapshot(),
          store.getRuntimeState('last-replay'),
          store.getRuntimeState<any>('storage-status'),
        ])
        const report=certifyRunpodShadowLive({
          observedAt:new Date().toISOString(),
          snapshot:certification,
          lastLive,lastOutcomes,service:status,lastReplay,
          networkVolumeAttached:Boolean(storage?.networkVolumeAttached),
          swlcSyncReady:Boolean(storage?.swlcSyncReady),
        })
        const readiness=classifyShadowServiceReadiness({
          now:new Date().toISOString(),service:status,lastError,intervalSeconds:intervalMs/1000,
        })
        res.statusCode=readiness.httpStatus
        res.end(JSON.stringify({
          status:readiness.status,readinessCode:readiness.code,
          counts,lastLive,lastOutcomes,service:status,certification,report,lastReplay,storage,
          authority:'SHADOW_LEARNING_ONLY',canExecute:false,canSign:false,canBroadcast:false,canAuthorizeLive:false,
        }))
      }catch{
        res.statusCode=503
        res.end(JSON.stringify({
          status:'blocked',reasonCode:'SHADOW_LEDGER_UNAVAILABLE',
          authority:'SHADOW_LEARNING_ONLY',canExecute:false,canSign:false,canBroadcast:false,canAuthorizeLive:false,
        }))
      }
      return
    }
    res.statusCode=404
    res.end(JSON.stringify({error:'not_found'}))
  })
  server.listen(port,'0.0.0.0',()=>process.stdout.write(`RUNPOD_SHADOW_HEALTH_LISTENING:${port}\n`))
  await cycle()
  const timer=setInterval(()=>{void cycle()},intervalMs)
  const stop=async()=>{
    clearInterval(timer)
    await new Promise<void>(resolveClose=>server.close(()=>resolveClose()))
    await store.close()
    process.exit(0)
  }
  process.on('SIGTERM',()=>{void stop()})
  process.on('SIGINT',()=>{void stop()})
}

async function replay(path:string){
  const absolute=resolve(path)
  const raw=await readFile(absolute,'utf8')
  let values:any[]
  if(raw.trim().startsWith('[')){
    const parsed=JSON.parse(raw)
    if(!Array.isArray(parsed))throw new Error('RUNPOD_SHADOW_REPLAY_ARRAY_REQUIRED')
    values=parsed
  }else{
    values=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>JSON.parse(line))
  }
  const records=values.map(parseRunpodShadowReplayRecord)
  const receipt=await runRunpodShadowReplay({store,records,source:absolute})
  process.stdout.write(JSON.stringify(receipt,null,2)+'\n')
}

async function exportSync(path:string){
  const absolute=resolve(path)
  const rows=await store.pendingSync({limit:intEnv('SHARK_SHADOW_EXPORT_LIMIT',5000,1,50000)})
  await mkdir(dirname(absolute),{recursive:true})
  const body=rows.map(row=>JSON.stringify(row)).join('\n')+(rows.length?'\n':'')
  await writeFile(absolute,body,{encoding:'utf8',mode:0o600})
  if(rows.length&&process.env.SHARK_SHADOW_EXPORT_MARK!=='false'){
    await store.markExported(rows.map(x=>x.syncId),new Date().toISOString())
  }
  process.stdout.write(JSON.stringify({path:absolute,records:rows.length,authority:'EXPORT_ONLY',canExecute:false})+'\n')
}

async function main(){
  const [command,arg]=process.argv.slice(2)
  try{
    switch(command){
      case 'serve': await serve();return
      case 'cycle': await cycle();await store.close();return
      case 'recheck-legacy': {
        if(process.env.SHARK_SHADOW_CORRECTION_APPROVED!=='PAPER_ONLY'){
          throw new Error('SHADOW_CORRECTION_EXPLICIT_PAPER_APPROVAL_REQUIRED')
        }
        const receipt=await runRunpodShadowLegacyCorrectionReview({store})
        process.stdout.write(JSON.stringify(receipt,null,2)+'\\n')
        await store.close()
        return
      }
      case 'replay': if(!arg)throw new Error('RUNPOD_SHADOW_REPLAY_PATH_REQUIRED');await replay(arg);await store.close();return
      case 'export-sync': if(!arg)throw new Error('RUNPOD_SHADOW_EXPORT_PATH_REQUIRED');await exportSync(arg);await store.close();return
      case 'health':
      case 'certify-live': {
        await store.probe()
        const [counts,lastLive,lastOutcomes,status,certification,lastReplay,storage]=await Promise.all([
          store.counts(),
          store.getRuntimeState('last-live-cycle'),
          store.getRuntimeState('last-outcome-cycle'),
          store.getRuntimeState('service-status'),
          store.liveCertificationSnapshot(),
          store.getRuntimeState('last-replay'),
          store.getRuntimeState<any>('storage-status'),
        ])
        const report=certifyRunpodShadowLive({
          observedAt:new Date().toISOString(),
          snapshot:certification,lastLive,lastOutcomes,service:status,lastReplay,
          networkVolumeAttached:Boolean(storage?.networkVolumeAttached),
          swlcSyncReady:Boolean(storage?.swlcSyncReady),
        })
        const readiness=classifyShadowServiceReadiness({
          now:new Date().toISOString(),service:status,
          intervalSeconds:intEnv('SHARK_SHADOW_INTERVAL_SECONDS',300,60,3600),
        })
        process.stdout.write(JSON.stringify({status:readiness.status,readinessCode:readiness.code,
          counts,lastLive,lastOutcomes,certification,lastReplay,storage,report,
          authority:'SHADOW_LEARNING_ONLY',canExecute:false},null,2)+'\n')
        if(readiness.httpStatus!==200)process.exitCode=1
        await store.close();return
      }
      default: throw new Error('usage: shark-shadow-runpod <serve|cycle|replay FILE|recheck-legacy|export-sync FILE|health|certify-live>')
    }
  }catch(error){
    process.stderr.write((error instanceof Error?error.message:String(error))+'\n')
    await store.close().catch(()=>undefined)
    process.exitCode=1
  }
}
void main()
