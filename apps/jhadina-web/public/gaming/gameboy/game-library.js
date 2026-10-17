/*
 * Owner-controlled Game Boy library catalog.
 * Entries here are DISPLAY-ONLY hints, not ROMs, URLs, Drive IDs, or promises
 * that Jhadina may redistribute proprietary Nintendo game content.
 * All executable cartridges must be separately and locally imported by owner.
 */
(function (root) {
  'use strict';
  const hints = Object.freeze([
    Object.freeze({id:'pokemon-red',title:'Pokémon Red',system:'Game Boy',driveName:'Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb'}),
    Object.freeze({id:'super-mario-land',title:'Super Mario Land',system:'Game Boy',driveName:'Super Mario Land (World) (Rev 1).gb'})
  ]);
  function match(name) {
    if(typeof name !== 'string')return null;
    const t=name.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(t.startsWith('pokemonredversion') || t.startsWith('pokemonred'))return 'pokemon-red';
    if(t.startsWith('supermarioland'))return 'super-mario-land';
    return null;
  }
  function view(installed) {
    const records=Array.isArray(installed)?installed.filter(x=>x&&x.platform==='gameboy'&&
      typeof x.contentUri==='string'&&x.contentUri.startsWith('gameboy-local://')&&
      typeof x.id==='string'&&typeof x.title==='string'):[];
    const known=hints.map(h=>{
      const game=records.find(x=>match(x.title)===h.id);
      return {id:h.id,title:h.title,system:h.system,driveName:h.driveName,
        installed:Boolean(game),gameId:game?.id||null,source:'owner-private-drive'};
    });
    const additional=records.filter(x=>!match(x.title)).map(x=>({
      id:x.id,title:x.title,system:'Game Boy',driveName:null,
      installed:true,gameId:x.id,source:'local'
    }));
    return [...known,...additional];
  }
  root.JhadinaGameLibrary=Object.freeze({hints,match,view});
})(globalThis);
