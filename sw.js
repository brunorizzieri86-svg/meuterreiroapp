const CACHE='meuterreiro-v0494';
const ASSETS=[
  './','./index.html','./manifest.json',
  './assets/logo-meu-terreiro.png',
  './icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/favicon-64.png','./assets/app-icon-meu-terreiro.png'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
});
self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>(k.startsWith('casadeaxe-')||k.startsWith('meuterreiro-'))&&k!==CACHE).map(k=>caches.delete(k))
    ))
  ]));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const isNav=e.request.mode==='navigate'||new URL(e.request.url).pathname.endsWith('/index.html');
  if(isNav){
    e.respondWith(
      fetch(e.request).then(r=>{
        const cp=r.clone();
        caches.open(CACHE).then(c=>c.put('./index.html',cp)).catch(()=>{});
        return r;
      }).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
      const cp=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});
      return r;
    }))
  );
});
