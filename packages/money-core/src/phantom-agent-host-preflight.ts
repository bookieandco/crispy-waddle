import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open, lstat } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

/**
 * Read-only owner-host admission. The trusted SHA must be obtained from
 * independent installation review, not computed and accepted in one step.
 * This preflight does not replace a process sandbox, syscall policy, TLS
 * gateway, supply-chain signature verification or actual Phantom login.
 */
const SHA=/^[0-9a-f]{64}$/
async function checkedFile(path:string,uid:number,checkExecutable:boolean){
  if (!isAbsolute(path) || resolve(path)!==path) throw new Error('PHANTOM_HOST_FILE_ABSOLUTE_REQUIRED')
  const folder=await lstat(dirname(path))
  if (!folder.isDirectory() || folder.isSymbolicLink() ||
      (folder.mode&0o022)!==0) throw new Error('PHANTOM_HOST_DIRECTORY_UNSAFE')
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  try {
    const s=await file.stat()
    if(!s.isFile() || (s.mode&0o022)!==0 || s.uid!==uid ||
       (checkExecutable ? (s.mode&0o100)===0 : (s.mode&0o077)!==0) ||
       s.size<=0 || s.size>64*1024*1024) {
      throw new Error('PHANTOM_HOST_FILE_UNSAFE')
    }
    return await file.readFile()
  }finally{await file.close()}
}
export async function auditPhantomOwnerHostFiles(input:Readonly<{
  binaryPath:string
  expectedBinarySha256:string
  sessionPath:string
  ownerUid:number
}>) {
  if (!Number.isSafeInteger(input.ownerUid) || input.ownerUid<=0 ||
      !SHA.test(input.expectedBinarySha256) ||
      input.binaryPath===input.sessionPath) throw new Error('PHANTOM_HOST_ATTESTATION_INVALID')
  const binary=await checkedFile(input.binaryPath,input.ownerUid,true)
  const computed=createHash('sha256').update(binary).digest('hex')
  if(computed!==input.expectedBinarySha256) throw new Error('PHANTOM_HOST_BINARY_DIGEST_CHANGED')
  // Do not parse, log, or forward Phantom session bytes. Check permissions only.
  await checkedFile(input.sessionPath,input.ownerUid,false)
  return Object.freeze({
    binaryDigestSha256:computed,
    binaryPathVerified:true as const,
    ownerSessionPermissionsVerified:true as const,
    signerIsolationCertified:false as const,
    tlsGatewayVerified:false as const,
    financialAuthority:'NONE' as const,
    canSign:false as const,
    canExecute:false as const,
  })
}
