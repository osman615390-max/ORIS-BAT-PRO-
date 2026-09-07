
const CACHE='oris-v5-signature';
const ASSETS=[
'./','./index.html','./style.css?v=4','./script.js?v=4','./logo-oris-bat-pro.svg','./favicon.svg',
'./hero-1.webp','./hero-2.webp','./fleet-real.webp',
'./terrassement.html','./maconnerie.html','./facades-isolation.html','./amenagement-exterieur.html',
'./realisations.html','./zones.html','./entreprise.html','./contact.html','./devis.html'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).then(r=>{
    const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
    return r;
  }).catch(()=>caches.match(e.request)));
});
