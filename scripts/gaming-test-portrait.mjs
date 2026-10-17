import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const root='apps/jhadina-web/public/';
const page=readFileSync(root+'gaming/gameboy/index.html','utf8');
const player=readFileSync(root+'gaming/gameboy/player.html','utf8');
const runtime=readFileSync(root+'vendor/binjgb/approved/jhadina-simple.js','utf8');
for(const [name,source] of [['Game Boy shell',page],['Game Boy player',player]]) {
  const inline=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  for(const [i,block] of inline.entries())if(block[1].trim())new Script(block[1],{filename:name+' inline '+i});
}
assert(page.includes('Jhadina Pocket'),'Dedicated pocket-player shell missing');
assert(page.includes('id="libraryDrawer"'),'Game catalog drawer missing');
assert(page.includes('id="catalog"'),'Existing library cards missing');
assert(page.indexOf('id="player"')<page.indexOf('id="catalog"'),'Live player must stay above library');
assert(page.includes('class="quickBar"'),'Save/stop controls are not accessible outside the library');
assert(page.includes('height:clamp(490px,76svh,680px)'),'Portrait-first handheld sizing missing');
assert(!page.includes('aspect-ratio:16/9'),'Old landscape game layout should be removed');
assert(page.includes('aria-expanded')&&page.includes("syncLibraryButton()"),'Library accessibility state is not wired');
assert(page.includes("$('libraryDrawer').open=false;syncLibraryButton();"),'Catalog must collapse on game launch');
assert(page.includes('activeGameId') && page.includes('pendingSwitch'), 'Save-before-switch must survive redesign');
assert(page.includes("key('gbstate',activeGameId)")&&page.includes('gameId:activeGameId'),'Save ownership protection missing');
assert(page.includes("window.JhadinaGameBoyZip.extractSingleGameBoyRom"),'Offline ZIP import must remain');
assert(player.includes('id="screenShell"')&&player.includes('id="controller_dpad"'),'Screen and d-pad missing');
for(const id of ['controller_up','controller_down','controller_left','controller_right','controller_a','controller_b','controller_start','controller_select']){
 assert(player.includes('id="'+id+'"'),id+' control missing');
}
assert(player.includes('image-rendering:pixelated'),'Pixel display should preserve crisp pixels');
assert(player.includes("if(connected)requestAnimationFrame(poll);"),'Active-pad sampling frequency must remain responsive');
assert(player.includes("else setTimeout(poll,200);"),'Unpaired controllers must not consume a second 60fps polling loop');
assert(player.includes('setTimeout(poll,200);'),'Frame ready and pad polling startup missing');
assert(!player.includes('requestAnimationFrame(poll);\naddEventListener'),'Old continuously running idle polling remains');
assert(runtime.includes("addEventListener('touchcancel',this.boundButtonTouchEnd)") &&
 runtime.includes("removeEventListener('touchcancel',this.boundButtonTouchEnd)"),
 'Cancelled iPhone A/B/Start/Select touches must release cleanly');
assert(runtime.includes("addEventListener('touchcancel',this.boundDpadTouchEnd)") &&
 runtime.includes("removeEventListener('touchcancel',this.boundDpadTouchEnd)"),
 'Cancelled iPhone D-pad touches must release cleanly');
for(const id of ['player','play','saveState','stop','quick2048','rom','library','backup','persist','restore','catalog']){
 assert.equal((page.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'Expected exactly one #'+id);
}
assert(!page.includes('1uHImEAjQpSM8DCEJpYDCPTSZ_m8SauxR') &&
 !page.includes('1mzM0N24LPo3LaHq_jNXP4tBpQ38TD0eG'),
 'Owner-private Google Drive ROM identifiers leaked into public page');
console.log('PASS: portrait handheld shell, display + 8 touch controls, idle pad efficiency, library persistence, correct save ownership and safe touchcancel semantics');
