/**
 * BIZ-PURSE.14 disposable owner RLS test launcher. No production support.
 * Creates no databases; never imports credentials from a Supabase project.
 * Launches ONLY the repository's fixed, transactional owner-isolation SQL.
 */
import {spawnSync} from 'node:child_process'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
export function parseDisposablePostgresUrl(value){
 if(!value||typeof value!=='string')throw new Error('BIZ_PURSE_LOCAL_DB_URL_REQUIRED')
 let url
 try {url=new URL(value)}catch{throw new Error('BIZ_PURSE_LOCAL_DB_URL_INVALID')}
 if(!['postgresql:','postgres:'].includes(url.protocol))throw new Error('BIZ_PURSE_LOCAL_DB_PROTOCOL_INVALID')
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('BIZ_PURSE_LOCAL_DB_NOT_LOOPBACK')
 if(!/^biz_purse_recovery_[a-z0-9_]+$/.test(decodeURIComponent(url.pathname.slice(1))))throw new Error('BIZ_PURSE_LOCAL_DB_NAME_INVALID')
 if(url.username!=='postgres'||!url.port||!/^[0-9]+$/.test(url.port))throw new Error('BIZ_PURSE_LOCAL_DB_AUTH_OR_PORT_INVALID')
 const port=Number(url.port)
 if(!Number.isSafeInteger(port)||port<1025||port>65535)throw new Error('BIZ_PURSE_LOCAL_DB_PORT_INVALID')
 if([...url.searchParams.keys()].some(x=>x!=='sslmode')||url.searchParams.get('sslmode')&&url.searchParams.get('sslmode')!=='disable')throw new Error('BIZ_PURSE_LOCAL_DB_OPTIONS_INVALID')
 return Object.freeze({host:url.hostname==='[::1]'?'::1':url.hostname,port:String(port),database:decodeURIComponent(url.pathname.slice(1)),username:url.username,password:decodeURIComponent(url.password)})
}
export function buildDisposableSqlTestPlan(input){
 if(input?.confirmation!=='YES_DISPOSABLE_DB_ONLY')throw new Error('BIZ_PURSE_LOCAL_DB_EXPLICIT_CONFIRMATION_REQUIRED')
 const db=parseDisposablePostgresUrl(input.databaseUrl)
 const file=resolve(dirname(fileURLToPath(import.meta.url)),'../supabase/tests/biz-purse-14-two-owner-local-only.sql')
 return Object.freeze({
  file,command:'psql',
  args:Object.freeze(['-X','--no-psqlrc','-v','ON_ERROR_STOP=1','--host',db.host,'--port',db.port,'--username',db.username,'--dbname',db.database,'--file',file]),
  envPassword:db.password,
  productionAuthorized:false,
  authority:'LOCAL_ISOLATION_TEST_ONLY',
 })
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {
  const plan=buildDisposableSqlTestPlan({databaseUrl:process.env.BIZ_PURSE_DISPOSABLE_DATABASE_URL,confirmation:process.env.BIZ_PURSE_LOCAL_CONFIRMATION})
  if(process.argv[2]!=='--execute-local-test')throw new Error('BIZ_PURSE_LOCAL_EXECUTE_FLAG_REQUIRED')
  // Clear ambient PG connection overrides; only the parsed loopback URL
  // determines the target. Do not print database URLs or secrets.
  const env={...process.env,PGPASSWORD:plan.envPassword,PGHOST:'',PGDATABASE:'',PGSERVICE:'',PGOPTIONS:'',PGSSLMODE:'disable'}
  const output=spawnSync(plan.command,plan.args,{stdio:'inherit',env,timeout:120000})
  if(output.error)throw output.error
  process.exitCode=output.status===0?0:1
 }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=2}
}
