/* Nonsecret offline shell status. Never uses background sync or uploads. */
(function(){
'use strict';
const info=document.getElementById('offlineState');
if(!info)return;
const CACHE_NAME='jhadina-neon-run-shell-v1-20261010';
const FILES=['index.html','engine.js','app.js','offline.js','manifest.webmanifest','icon.svg'];
let ready=false;
function paint(){
 info.textContent=ready
  ?(navigator.onLine===false?'Playing from the cached game shell':'Offline-ready on this device (browser may evict cache)')
  :(navigator.onLine===false?'Offline cache not verified':'Preparing offline game files…');
}
async function prepare(){
 if(!window.isSecureContext||!('serviceWorker' in navigator)||!('caches' in window)){
  info.textContent='Offline install unsupported here; gameplay needs a connection to load';
  return;
 }
 try{
  await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  // Verify the exact pre-cached public assets before claiming "offline ready."
  const cache=await caches.open(CACHE_NAME);
  const entries=await Promise.all(FILES.map(name=>cache.match(new URL(name,location.href).href)));
  ready=entries.every(Boolean);
  if(!ready){info.textContent='Offline game files incomplete; retry while online';return;}
  paint();
 }catch{
  info.textContent='Offline install unavailable; gameplay still works online';
 }
}
window.addEventListener('online',paint);
window.addEventListener('offline',paint);
prepare();
})();
