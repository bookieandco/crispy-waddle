import {createHash} from 'node:crypto'
import {constants} from 'node:fs'
import {open,stat} from 'node:fs/promises'
import {join,isAbsolute} from 'node:path'
import type {PumpOwnerDeliveryClaim} from './pump-owner-telegram-sender'

/** A minimal, local-only, at-most-once attempt claim.
 * The operator must create an existing owner-private mode-0700 directory on a
 * persistent volume. Never use tmp/CI/Vercel ephemeral fs for commissioning.
 * A claimed-but-failed send remains UNCERTAIN and must not be retried blindly.
 */
export function createPumpLocalAlertClaims(directory:string):PumpOwnerDeliveryClaim {
  if(!isAbsolute(directory))throw new Error('shark_pump_claim_directory_absolute_required')
  return async key=>{
    if(!/^shark-graduation:[1-9A-HJ-NP-Za-km-z]{32,44}:[A-Z_]+$/.test(key))
      return 'UNAVAILABLE' as const
    const dir=await stat(directory)
    if(!dir.isDirectory()||(dir.mode&0o077)!==0)
      return 'UNAVAILABLE' as const
    const file=join(directory,createHash('sha256').update(key).digest('hex')+'.claim')
    try{
      const handle=await open(file,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600)
      try{await handle.writeFile(key+'\n',{encoding:'utf8'});await handle.sync()}
      finally{await handle.close()}
      return 'CLAIMED' as const
    }catch(e){
      if((e as NodeJS.ErrnoException).code==='EEXIST')return 'ALREADY_CLAIMED' as const
      return 'UNAVAILABLE' as const
    }
  }
}
