const CACHE='ORIS-V8-ULTRA-PHOTOREAL';
const CORE=['./','./index.html','./style.css?v=8','./script.js?v=8','./logo-oris-bat-pro.svg','./favicon.svg','./hero-1.webp','./hero-2.webp','./fleet-real.webp','./reference-chantier.webp','./tex-block.webp','./tex-concrete.webp','./tex-soil.webp','./tex-glass.webp','./tex-roof.webp','./tex-render.webp','./tex-paver.webp','./studio-360.html','./viewer3d.js?v=6.4','./passeport-projet.html','./devis.html','./contact.html'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  // HTML/JS/CSS stay network-first so fixes are not trapped behind an old iPhone cache.
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});return response;
  }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
});
