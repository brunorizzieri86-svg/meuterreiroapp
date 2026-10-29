const CACHE='meuterreiro-v21500';
const ASSETS=[
  './','./index.html','./manifest.json','./manual.html','./privacidade.html','./termos.html',
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
  // Nunca guardar em cache chamadas a outros domínios (Supabase: login, agenda, avisos)
  if(new URL(e.request.url).origin!==self.location.origin)return;
  const path=new URL(e.request.url).pathname,isIndex=/\/(index\.html)?$/.test(path);
  if(e.request.mode==='navigate'&&!isIndex){
    // outras páginas (cadastro.html, questionario.html, manual…): sempre da rede; nunca mexem no cache do app
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)||caches.match('./index.html')));
    return;
  }
  const isNav=e.request.mode==='navigate'||path.endsWith('/index.html');
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
