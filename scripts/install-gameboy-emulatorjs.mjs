#!/usr/bin/env node
/**
 * GAME-FINISH.07 operator-only EmulatorJS installer.
 * Requires an independently acquired release archive. Never downloads ROMs,
 * BIOS, or emulator packages automatically.
 */
import {createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, lstatSync, cpSync, renameSync, rmSync, writeFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, resolve, dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';

const RELEASE='v4.2.3';
const EXPECTED_ARCHIVE_SHA='07d451bc06fa3ad04ab30d9b94eb63ac34ad0babee52d60357b002bde8f3850b';
const DEST=resolve('apps/jhadina-web/public/vendor/emulatorjs/approved');
const archiveArg=process.argv[2];
if(!archiveArg||process.argv.length!==3){
 console.error('Usage: node scripts/install-gameboy-emulatorjs.mjs /absolute/path/to/4.2.3.7z');
 console.error('Source: https://github.com/EmulatorJS/EmulatorJS/releases/tag/v4.2.3');
 process.exitCode=2;
}else{
 await install(resolve(archiveArg));
}
async function sha256File(path){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(path))hash.update(chunk);
 return hash.digest('hex');
}
function locateData(root,depth=0){
 if(depth>4)return [];
 const found=[];
 for(const dirent of readdirSync(root,{withFileTypes:true})){
  const p=join(root,dirent.name);
  if(dirent.isSymbolicLink())throw new Error('Archive contains a symlink: '+p);
  if(!dirent.isDirectory())continue;
  if(dirent.name==='data'&&existsSync(join(p,'loader.js')))found.push(p);
  else found.push(...locateData(p,depth+1));
 }
 return found;
}
async function install(archive){
 if(!existsSync(archive))throw new Error('Release archive not found');
 if(existsSync(DEST))throw new Error('Destination exists. Inspect or remove the previous installation manually; no overwrite');
 const digest=await sha256File(archive);
 if(digest!==EXPECTED_ARCHIVE_SHA)throw new Error('EmulatorJS release archive SHA-256 mismatch');
 const exe=['7zz','7z'].find(candidate=>{
  const r=spawnSync(candidate,['-h'],{stdio:'ignore'});
  return !r.error;
 });
 if(!exe)throw new Error('7z/7zz is required for extracting a verified .7z release');
 const temp=mkdtempSync(join(tmpdir(),'jhadina-emulatorjs-'));
 const stage=DEST+'.staging-'+process.pid;
 try{
  const result=spawnSync(exe,['x','-y','-o'+temp,archive],{stdio:'inherit',timeout:300000});
  if(result.error||result.status!==0)throw new Error('7z extraction failed');
  const directories=locateData(temp);
  if(directories.length!==1)throw new Error('Expected exactly one bundled EmulatorJS data directory');
  const source=directories[0];
  if(!existsSync(join(source,'cores')))throw new Error('Missing EmulatorJS cores directory');
  mkdirSync(dirname(DEST),{recursive:true});
  if(existsSync(stage))throw new Error('Staging path already exists');
  cpSync(source,join(stage,'data'),{recursive:true,errorOnExist:true,force:false,dereference:false});
  const loader=join(stage,'data','loader.js');
  const loaderHash=await sha256File(loader);
  const manifest={
   schema:'jhadina.gaming.emulatorjs.approved.v1',
   version:RELEASE,
   source:'https://github.com/EmulatorJS/EmulatorJS/releases/tag/'+RELEASE,
   archiveSha256:EXPECTED_ARCHIVE_SHA,
   loaderSha256:loaderHash,
   dataPath:'/vendor/emulatorjs/approved/data/',
   coreIds:['gb'],
   commissionedByHardware:false,
  };
  writeFileSync(join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  if(existsSync(DEST))throw new Error('Concurrent install detected');
  renameSync(stage,DEST);
  console.log('Staged verified EmulatorJS release; loader SHA-256: '+loaderHash);
  console.log('NOT certified on a phone and NOT proof of an approved browser runtime');
 }finally{
  if(existsSync(stage))rmSync(stage,{recursive:true,force:true});
  rmSync(temp,{recursive:true,force:true});
 }
}
