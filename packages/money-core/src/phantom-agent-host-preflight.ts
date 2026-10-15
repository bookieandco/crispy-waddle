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
  // Inspect ALL ancestors, not only the immediate parent: a symlinked
  // ancestor or writable directory could redirect the reviewed executable.
  let folderPath=dirname(path)
  while (true) {
    const folder=await lstat(folderPath)
    const writable=(folder.mode&0o022)!==0
    // Root-owned sticky directories such as /tmp are permitted for isolated
    // regression fixtures; the file's direct parent must still be private.
    const rootSticky=folder.uid===0 && (folder.mode&0o1000)!==0
    if (!folder.isDirectory() || folder.isSymbolicLink() ||
        (folder.uid!==0 && folder.uid!==uid) ||
        (writable && (!rootSticky || folderPath===dirname(path)))) {
      throw new Error('PHANTOM_HOST_DIRECTORY_UNSAFE')
    }
    if(folderPath==='/')break
    folderPath=dirname(folderPath)
  }
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  try {
    const s=await file.stat()
    if(!s.isFile() || (s.mode&0o022)!==0 || s.uid!==uid ||
       (checkExecutable ? (s.mode&0o100)===0 : (s.mode&0o077)!==0) ||
       s.size<=0 || s.size>64*1024*1024) {
      throw new Error('PHANTOM_HOST_FILE_UNSAFE')
    }
    return checkExecutable ? await file.readFile() : null
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
  if(binary===null)throw new Error('PHANTOM_HOST_BINARY_INVALID')
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
