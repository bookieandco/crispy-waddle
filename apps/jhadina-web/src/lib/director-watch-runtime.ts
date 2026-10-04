import {resolveDirectorHunyuanRuntimeConfig} from './director-hunyuan-video-provider'
import {currentVercelOidcToken} from './vercel-oidc-runtime'

export type DirectorWatchRuntimeConfig=Readonly<{
  dispatchUrl:string
  healthUrl:string
  authorizationToken:string
  callbackUrl:string
  callbackSecret:string
  source:'environment'|'director-runpod-sidecar'
}>

function clean(value:string):string{return value.replace(/\/+$/,'')}

function admittedHttpsUrl(value:unknown):string|undefined{
  if(typeof value!=='string'||!value.trim())return undefined
  try{
    const parsed=new URL(value.trim())
    if(parsed.protocol!=='https:'||parsed.username||parsed.password)return undefined
    parsed.hash=''
    return clean(parsed.toString())
  }catch{return undefined}
}

function productionOrigin():string|undefined{
  const explicit=admittedHttpsUrl(process.env.JHADINA_PRODUCTION_ORIGIN)
  if(explicit)return explicit
  const vercel=process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if(vercel){
    const candidate=admittedHttpsUrl(vercel.startsWith('http')?vercel:'https://'+vercel)
    if(candidate)return candidate
  }
  return 'https://crispy-waddle-jhadina-web.vercel.app'
}

export async function resolveDirectorWatchRuntimeConfig():Promise<DirectorWatchRuntimeConfig|undefined>{
  const callbackSecret=(
    process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET?.trim()||
    process.env.DIRECTOR_API_SECRET?.trim()||
    ''
  )
  if(!callbackSecret)return undefined

  const callbackUrl=admittedHttpsUrl(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_URL)||
    (productionOrigin()?productionOrigin()!+'/api/director/watch-jobs/callback':undefined)
  if(!callbackUrl)return undefined

  const explicit=admittedHttpsUrl(process.env.JHADINA_DIRECTOR_WATCH_WORKER_URL)
  const explicitToken=process.env.JHADINA_DIRECTOR_WATCH_WORKER_TOKEN?.trim()??''
  if(explicit){
    const oidc=(await currentVercelOidcToken())||''
    const authorizationToken=explicitToken||oidc
    if(!authorizationToken)return undefined
    return Object.freeze({
      dispatchUrl:explicit.endsWith('/v1/jobs')?explicit:explicit+'/v1/jobs',
      healthUrl:explicit.endsWith('/v1/jobs')?explicit.slice(0,-'/v1/jobs'.length)+'/health':explicit+'/health',
      authorizationToken,
      callbackUrl,
      callbackSecret,
      source:'environment',
    })
  }

  const hunyuan=await resolveDirectorHunyuanRuntimeConfig()
  if(hunyuan.source==='legacy-default')return undefined
  const authorizationToken=hunyuan.config.token||await currentVercelOidcToken()
  if(!authorizationToken)return undefined
  const base=clean(hunyuan.config.baseUrl)
  return Object.freeze({
    dispatchUrl:base+'/watch/v1/jobs',
    healthUrl:base+'/watch/health',
    authorizationToken,
    callbackUrl,
    callbackSecret,
    source:'director-runpod-sidecar',
  })
}

export async function directorWatchRuntimeHealth():Promise<Readonly<{
  configured:boolean
  reachable:boolean
  source?:DirectorWatchRuntimeConfig['source']
  productionReady?:boolean
  error?:string
}>>{
  const config=await resolveDirectorWatchRuntimeConfig()
  if(!config)return Object.freeze({configured:false,reachable:false,error:'DIRECTOR_WATCH_RUNTIME_NOT_CONFIGURED'})
  try{
    const response=await fetch(config.healthUrl,{
      headers:{authorization:'Bearer '+config.authorizationToken},
      cache:'no-store',
    })
    if(!response.ok)return Object.freeze({
      configured:true,reachable:false,source:config.source,error:'DIRECTOR_WATCH_HEALTH_FAILED:'+response.status,
    })
    const body=await response.json() as {productionReady?:boolean}
    return Object.freeze({
      configured:true,reachable:true,source:config.source,productionReady:body.productionReady===true,
    })
  }catch(error){
    return Object.freeze({
      configured:true,reachable:false,source:config.source,
      error:error instanceof Error?error.message:'DIRECTOR_WATCH_HEALTH_FAILED',
    })
  }
}


export async function resolveDirectorWatchHomebaseRuntimeConfig():Promise<DirectorWatchRuntimeConfig|undefined>{
  const base=admittedHttpsUrl(process.env.JHADINA_DIRECTOR_WATCH_HOMEBASE_URL)
  const token=process.env.JHADINA_DIRECTOR_WATCH_HOMEBASE_TOKEN?.trim()??''
  const callbackSecret=(
    process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_SECRET?.trim()||
    process.env.DIRECTOR_API_SECRET?.trim()||
    ''
  )
  if(!base||!token||!callbackSecret)return undefined
  const callbackUrl=admittedHttpsUrl(process.env.JHADINA_DIRECTOR_WATCH_CALLBACK_URL)||
    (productionOrigin()?productionOrigin()!+'/api/director/watch-jobs/callback':undefined)
  if(!callbackUrl)return undefined
  return Object.freeze({
    dispatchUrl:base.endsWith('/v1/jobs')?base:base+'/v1/jobs',
    healthUrl:base.endsWith('/v1/jobs')?base.slice(0,-'/v1/jobs'.length)+'/health':base+'/health',
    authorizationToken:token,
    callbackUrl,
    callbackSecret,
    source:'environment',
  })
}

export async function directorWatchHomebaseRuntimeHealth():Promise<Readonly<{
  configured:boolean
  reachable:boolean
  productionReady?:boolean
  error?:string
}>>{
  const config=await resolveDirectorWatchHomebaseRuntimeConfig()
  if(!config)return Object.freeze({
    configured:false,reachable:false,error:'DIRECTOR_WATCH_HOMEBASE_RUNTIME_NOT_CONFIGURED',
  })
  try{
    const response=await fetch(config.healthUrl,{
      headers:{authorization:'Bearer '+config.authorizationToken},
      cache:'no-store',
    })
    if(!response.ok)return Object.freeze({
      configured:true,reachable:false,error:'DIRECTOR_WATCH_HOMEBASE_HEALTH_FAILED:'+response.status,
    })
    const body=await response.json() as {productionReady?:boolean}
    return Object.freeze({
      configured:true,reachable:true,productionReady:body.productionReady===true,
    })
  }catch(error){
    return Object.freeze({
      configured:true,reachable:false,
      error:error instanceof Error?error.message:'DIRECTOR_WATCH_HOMEBASE_HEALTH_FAILED',
    })
  }
}
