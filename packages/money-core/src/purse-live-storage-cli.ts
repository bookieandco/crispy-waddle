/**
 * Run on an OWNER-AUTHORIZED existing Homebase or other persistent database host.
 * Connection URL is read from process env and is never printed or uploaded.
 * No schema mutations, money movement, secrets, exports or paid compute.
 */
import {Pool} from 'pg'
import {inspectPurseLiveStorage} from './purse-live-storage-readiness.js'

async function main(){
 const url=process.env.PURSE_LIVE_DATABASE_URL?.trim()
 if(!url){
  process.stdout.write(JSON.stringify({status:'BLOCKED',blockers:['PURSE_LIVE_DATABASE_URL_NOT_CONFIGURED'],
   storageCertified:false,liveTradingEnabled:false})+'\n')
  process.exitCode=2
  return
 }
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000,
  application_name:'purse-live-readonly-probe',idleTimeoutMillis:1000})
 try{
  const status=await inspectPurseLiveStorage(pool)
  process.stdout.write(JSON.stringify({status:status.state,observedAt:status.observedAt,databaseName:status.databaseName,
   blockers:status.blockers,tablePresent:status.tablePresent,
   independentEncryptedRestoreVerified:false,hostRestartVerified:false,storageCertified:false,
   liveTradingEnabled:false})+'\n')
  if(status.state!=='READABLE_BUT_UNCERTIFIED')process.exitCode=2
 }catch{
  process.stdout.write(JSON.stringify({status:'BLOCKED',blockers:['DATABASE_UNAVAILABLE'],
   storageCertified:false,liveTradingEnabled:false})+'\n')
  process.exitCode=2
 }finally{await pool.end()}
}
await main()
