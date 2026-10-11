import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext, Script} from 'node:vm';
const source=readFileSync('apps/jhadina-web/public/gaming/gameboy/game-library.js','utf8');
new Script(source,{filename:'game-library.js'});
const env={};
runInNewContext(source,env);
const lib=env.JhadinaGameLibrary;
assert.equal(lib.hints.length,2);
assert.equal(lib.match('Pokemon - Red Version (USA, Europe) (SGB Enhanced)'), 'pokemon-red');
assert.equal(lib.match('Super Mario Land (World) (Rev 1)'), 'super-mario-land');
assert.equal(lib.match('Pokemon - Blue Version'), null);
const local=[
 {id:'gb-pokemon',title:'Pokemon - Red Version (USA, Europe) (SGB Enhanced)',platform:'gameboy',contentUri:'gameboy-local://gb-pokemon'},
 {id:'gb-2048',title:'2048',platform:'gameboy',contentUri:'gameboy-local://gb-2048'},
 {id:'not-local',title:'Fake',platform:'gameboy',contentUri:'https://example.com/rom.gb'}
];
const view=lib.view(local);
assert.equal(view.length,3);
assert.equal(view[0].title,'Pokémon Red');
assert.equal(view[0].installed,true);
assert.equal(view[0].gameId,'gb-pokemon');
assert.equal(view[1].title,'Super Mario Land');
assert.equal(view[1].installed,false);
assert.equal(view[1].gameId,null);
assert.equal(view[2].title,'2048');
assert.equal(view[2].installed,true);
assert(!source.includes('drive.google.com/file/d/'), 'Private Drive ROM IDs must never appear in public JS');
assert(!source.includes('https://www.romsgames.net/'), 'No automatic commercial game download links');
const html=readFileSync('apps/jhadina-web/public/gaming/gameboy/index.html','utf8');
assert(html.includes('My Game Library') && html.includes('game-library.js'));
assert(html.includes("activeGameId"),'Current game's ID must be independent of selected library entry');
assert(html.includes("pendingSwitch"),'Game switches must first save the current session');
assert(html.includes("key('gbstate',activeGameId)"),'Save states must never load for newly selected title while another runs');
assert(html.includes("gameId:activeGameId"),'Save bridge must use active emulator identity');
assert(html.indexOf('id="player"')<html.indexOf('id="catalog"'),'Game Boy player remains visible above game library in portrait');
assert(!html.includes("fetch('https://drive"), 'Never fetch private Drive ROM files through an anonymous browser session');
console.log('PASS: private-Drive catalog hints have no ROM payload or file IDs; local install recognition, safe game-switch routing and sticky emulator UI');
