/* Jhadina Neon Run: only the original, public, immutable game shell.
 * Scope /gaming/neon-run/ cannot intercept other Jhadina worlds, backups or ROMs.
 * Bump CACHE_NAME when any asset changes; never cache private gameplay data. */
'use strict';
const CACHE_NAME='jhadina-neon-run-shell-v1-20261010';
const PREFIX='jhadina-neon-run-shell-';
const FILES=['index.html','engine.js','app.js','offline.js','manifest.webmanifest','icon.svg']
  .map(path=>new URL(path,self.registration.scope).href);
const ALLOW=new Set(FILES);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  // addAll rejects on missing assets; do not claim an incomplete offline install.
  await cache.addAll(FILES);
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const name of await caches.keys())
   if(name.startsWith(PREFIX)&&name!==CACHE_NAME)await caches.delete(name);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.search||url.hash||!ALLOW.has(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const hit=await cache.match(request);
  // Misses are allowed to fail normally when offline; never forge a success.
  return hit||fetch(request);
 })());
});
