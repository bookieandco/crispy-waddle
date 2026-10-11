/* Jhadina private owner-test Sega asset mount.
 * No emulator bytes are shipped with this web application.
 * Only handles explicitly imported, same-origin, hash-pinned local artifacts.
 * This service worker NEVER fetches or serves owner ROMs or saves.
 */
'use strict';
const CACHE='jhadina-sega-private-owner-test-80e12df2-v1';
const PREFIX='/gaming/sega/vendor/';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||
    !url.pathname.startsWith(PREFIX))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const hit=await cache.match(event.request,{ignoreSearch:true});
  if(hit)return hit;
  // The normal approved runtime path (if any) is not overridden. No remote CDN.
  return fetch(event.request);
 })());
});
