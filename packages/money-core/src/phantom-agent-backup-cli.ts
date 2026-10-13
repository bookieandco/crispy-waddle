import { constants } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import {
  createEncryptedPhantomStudyBackup, restoreEncryptedPhantomStudyBackup,
} from './phantom-agent-encrypted-backup.js'

/**
 * OWNER-HOST ONLY. Never upload a secret, never auto-fund or unlock a wallet.
 * backup: writes encrypted archive O_EXCL to the requested private filesystem
 * location. restore: requires trusted head+hash from an independent channel,
 * and writes ONLY to a new isolated path.
 */
async function main() {
  const phase=process.argv[2]
  const env=process.env
  if (phase!=='backup' && phase!=='restore') throw new Error('PHANTOM_BACKUP_PHASE_INVALID')
  if (env.PHANTOM_AGENT_OWNER_HOST_ENABLED!=='OWNER_CONFIRMED_READ_ONLY') {
    throw new Error('PHANTOM_BACKUP_OWNER_CONFIRMATION_REQUIRED')
  }
  const path=env.PHANTOM_AGENT_STUDY_JOURNAL_PATH ?? ''
  const hmacKey=env.PHANTOM_AGENT_STUDY_HMAC_KEY ?? ''
  const expectedWalletId=env.PHANTOM_AGENT_PIN_WALLET_ID ?? ''
  const expectedAddress=env.PHANTOM_AGENT_PIN_SOLANA_ADDRESS ?? ''
  const encryptionKeyHex=env.PHANTOM_AGENT_BACKUP_KEY_HEX ?? ''
  const archivePath=env.PHANTOM_AGENT_BACKUP_ARCHIVE_PATH ?? ''
  if (!isAbsolute(path)||!isAbsolute(archivePath)||!expectedWalletId||!expectedAddress||
      hmacKey.length<32||encryptionKeyHex.length!==64) {
    throw new Error('PHANTOM_BACKUP_OPERATOR_CONFIG_INVALID')
  }
  const study={path,hmacKey,expectedWalletId,expectedAddress}
  if (phase==='backup') {
    if (archivePath===path) throw new Error('PHANTOM_BACKUP_OVERWRITE_SOURCE_DENIED')
    const result=await createEncryptedPhantomStudyBackup({options:study,encryptionKeyHex})
    const file=await open(archivePath,
      constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600)
    try {await file.writeFile(result.bytes);await file.sync()}
    catch(error){await file.close();await unlink(archivePath);throw error}
    await file.close()
    // Copy these hashes out of band to owner-controlled external archive/
    // independent write-once anchor, with receipt of actual off-host upload.
    process.stdout.write(JSON.stringify({
      status:'LOCAL_ENCRYPTED_ARCHIVE_CREATED',
      archiveSha256:result.receipt.archiveSha256,
      studyHead:result.receipt.head,count:result.receipt.count,
      offHostCertified:false,canExecute:false,
    })+'\n')
  } else {
    const destinationPath=env.PHANTOM_AGENT_RESTORE_DESTINATION ?? ''
    const trustedArchiveSha256=env.PHANTOM_AGENT_TRUSTED_ARCHIVE_SHA256 ?? ''
    const trustedHeadDigest=env.PHANTOM_AGENT_TRUSTED_HEAD_DIGEST ?? ''
    if (!isAbsolute(destinationPath)||destinationPath===path||destinationPath===archivePath) {
      throw new Error('PHANTOM_BACKUP_ISOLATED_RESTORE_PATH_REQUIRED')
    }
    const source=await open(archivePath,constants.O_RDONLY|constants.O_NOFOLLOW)
    let archiveBytes:Buffer
    try {
      const info=await source.stat()
      if(!info.isFile()||(info.mode&0o077)!==0||info.size>25*1024*1024){
        throw new Error('PHANTOM_BACKUP_ARCHIVE_FILE_UNSAFE')
      }
      archiveBytes=await source.readFile()
    } finally {await source.close()}
    const result=await restoreEncryptedPhantomStudyBackup({
      archiveBytes,encryptionKeyHex,trustedArchiveSha256,trustedHeadDigest,
      destination:{...study,path:destinationPath},
    })
    process.stdout.write(JSON.stringify({
      status:'ISOLATED_LOCAL_RESTORE_VERIFIED',head:result.headDigest,
      count:result.count,canExecute:false,offHostCertified:false,
    })+'\n')
  }
}
void main().catch(()=>{
  // Avoid leaking local filesystem paths, bearer credentials or key material.
  process.stderr.write('PHANTOM_BACKUP_OR_RESTORE_BLOCKED\n')
  process.exitCode=1
})
