const CACHE='oris-v6-ultimate-1';
const CORE=['./','./index.html','./style.css?v=6','./script.js?v=6','./logo-oris-bat-pro.svg','./favicon.svg','./hero-1.webp','./hero-2.webp','./fleet-real.webp','./studio-360.html','./passeport-projet.html','./devis.html','./contact.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request))) });
