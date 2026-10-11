#!/usr/bin/env node
/* Patch only the exact reviewed Jgenesis commit, on a PRISTINE private checkout.
 * This is source preparation, never binary approval or deployment.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
if(process.argv.length!==3)throw Error('Usage: node scripts/sega-prepare-jgenesis-bridge.mjs /private/jgenesis');
const dir=resolve(process.argv[2]);
const git=(...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==PIN)throw Error('Unpinned Jgenesis source');
if(git('status','--porcelain','--untracked-files=no'))throw Error('Source must be pristine');
const path=name=>join(dir,'frontend/jgenesis-web/src',name);
function replaceOnce(str,from,to,label){
 if(str.split(from).length!==2)throw Error('Upstream source changed: '+label);
 return str.replace(from,to);
}
const methodBlock=[
 '    pub fn request_open_verified_rom(&self, rom_file_name: &str, rom: js_sys::Uint8Array) -> bool {',
 '        let Some(digest)=rom_file_name.strip_prefix("gen-").and_then(|s| s.strip_suffix(".md")) else {return false};',
 '        if digest.len()!=24 || !digest.bytes().all(|c| c.is_ascii_hexdigit()) || rom.length()<512 || rom.length()>16*1024*1024 {return false;}',
 '        self.commands.borrow_mut().push_back(EmulatorCommand::OpenVerifiedRom {rom:rom.to_vec(),rom_file_name:rom_file_name.to_string()});',
 '        true',
 '    }',
 '    pub fn request_genesis_input(&self, button:&str, pressed:bool)->bool {',
 '        if !matches!(button,"up"|"down"|"left"|"right"|"a"|"b"|"c"|"x"|"y"|"z"|"start"|"mode"){return false;}',
 '        self.commands.borrow_mut().push_back(EmulatorCommand::GenesisInput{button:button.into(),pressed});',
 '        true',
 '    }',
 ''
].join('\n');
let config=readFileSync(path('config.rs'),'utf8');
config=replaceOnce(config,'pub enum EmulatorCommand {\n    OpenFile,',
 'pub enum EmulatorCommand {\n    OpenVerifiedRom {rom:Vec<u8>,rom_file_name:String},\n    GenesisInput {button:String,pressed:bool},\n    OpenFile,','command variants');
config=replaceOnce(config,'    pub fn request_open_file(&self) {',
 methodBlock+'    pub fn request_open_file(&self) {','public bridge');
let lib=readFileSync(path('lib.rs'),'utf8');
lib=replaceOnce(lib,'use genesis_core::{GenesisEmulator, GenesisInputs};',
 'use genesis_core::{GenesisEmulator, GenesisInputs, GenesisButton};\nuse jgenesis_common::input::Player;','button and player imports');
lib=replaceOnce(lib,'    AudioOutput, Color, ConstantInputPoller, EmulatorTrait, FrameSize, RenderFrameOptions,',
 '    AudioOutput, Color, ConstantInputPoller, EmulatorTrait, FrameSize, MappableInputs, RenderFrameOptions,','input trait');
const commandBlock=[
 '                EmulatorCommand::OpenVerifiedRom {rom,rom_file_name} => {',
 '                    let proxy=event_loop_proxy.clone();',
 '                    wasm_bindgen_futures::spawn_local(async move {',
 '                        let save_files=save::load_all(&rom_file_name).await;',
 '                        let _=proxy.send_event(JgenesisUserEvent::FileOpen{rom,bios_rom:None,rom_file_name,save_files});',
 '                    });',
 '                }',
 '                EmulatorCommand::GenesisInput {button,pressed} => {',
 '                    if let Emulator::Genesis(_,inputs)=&mut self.emulator {',
 '                        let mapped=match button.as_str(){',
 ...['Up','Down','Left','Right','A','B','C','X','Y','Z','Start','Mode'].map(n=>
 '                            "'+n.toLowerCase()+'"=>Some(GenesisButton::'+n+'),'),
 '                            _=>None',
 '                        };',
 '                        if let Some(mapped)=mapped {inputs.set_field(mapped,Player::One,pressed);}',
 '                    }',
 '                }',
 ''
].join('\n');
lib=replaceOnce(lib,'            match command {\n                EmulatorCommand::OpenFile => {',
 '            match command {\n'+commandBlock+'                EmulatorCommand::OpenFile => {','emulator command');
// wasm-bindgen module="/js/name.js" is a COMPILE-TIME crate-relative
// filesystem import, not a browser URL. Keep original Rust module paths,
// swap those source modules for reviewed same-origin Jhadina adapters, and
// let wasm-pack emit its generated pkg/snippets modules.
const sourceDir=resolve(dirname(fileURLToPath(import.meta.url)),'../apps/jhadina-web/public/gaming/sega/vendor/js');
const ownerUi=readFileSync(join(sourceDir,'ui.js'),'utf8');
const ownerIdb=readFileSync(join(sourceDir,'idb.js'),'utf8');
if(!ownerUi.includes('export function showUi')||!ownerIdb.includes('export async function writeSaveFile'))
 throw Error('Owner integration modules missing expected exports');
const upstreamUi=join(dir,'frontend/jgenesis-web/js/ui.js');
const upstreamIdb=join(dir,'frontend/jgenesis-web/js/idb.js');
if(!readFileSync(upstreamUi,'utf8').includes('export function showUi')||
   !readFileSync(upstreamIdb,'utf8').includes('export function writeSaveFile'))
 throw Error('Unexpected pinned Jgenesis frontend JS inputs');
let audio=readFileSync(path('audio.rs'),'utf8');
audio=replaceOnce(audio,'"./js/audio-processor.js?r={}"',
 '"/gaming/sega/vendor/js/audio-processor.js?r={}"','audio worklet runtime URL');
// Polyfill keeps module="/js/polyfill.js" because wasm-bindgen compiles it
// into pkg/snippets. Only audio-worklet loading uses a runtime URL.
for(const [file,out] of [
 [path('config.rs'),config],[path('lib.rs'),lib],[path('audio.rs'),audio],
 [upstreamUi,ownerUi],[upstreamIdb,ownerIdb]
])writeFileSync(file,out);
console.log('Reviewed source bridge staged; checkout deliberately modified. Build/test/license review still required.');
