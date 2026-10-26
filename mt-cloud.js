/* ===========================================================================
   MEU TERREIRO · Acessos por módulo + integração Supabase · V0.6.0.2
   Módulos: Pai/Mãe da casa · Filhos da casa · Cambonos/Apoio · Consulentes
   Cliente enxuto (fetch) para Supabase Auth, PostgREST e Storage.
   =========================================================================== */
(function(){
'use strict';

/* ---- CONFIGURAÇÃO DA NUVEM (feita pelo desenvolvedor, não pelo usuário) ----
   URL do projeto e chave pública (anon / publishable) do Supabase.
   Nunca use a chave service_role aqui. Quem protege os dados são as regras
   (RLS) criadas por supabase/01_schema.sql e supabase/02_integracao.sql. */
const MT_SUPABASE={url:'',anonKey:''};
/* -------------------------------------------------------------------------- */

const K={ses:'mt_cloud_session',prof:'mt_cloud_profile',cache:'mt_cloud_cache',mod:'mt_last_module',pub:'mt_cloud_last_publish',sync:'mt_cloud_last_sync',sigE:'mt_sig_events',sigM:'mt_sig_fees'};
/* Nome comercial do plano online (troque aqui para mudar em todo o app). */
const MT_PLANO='Terreiro Conectado';
/* WhatsApp para pedir código/assinatura, com DDI+DDD. Vazio = botões ocultos. */
const MT_CONTATO={whatsapp:'5511953525141',exibe:'(11) 95352-5141'};
const MODS={
  pai_mae:{label:'Pai/Mãe da casa',desc:'Administração completa: pessoas, agenda, financeiro e acessos.',icon:'shield',cor:'#13261d'},
  filho:{label:'Filhos da casa',desc:'Agenda, calendário, mensalidade, avisos e o seu cadastro.',icon:'users',cor:'#3d7452'},
  cambono:{label:'Cambonos e apoio',desc:'Agenda e materiais dos trabalhos, mensalidade e avisos.',icon:'star',cor:'#a65f3d'},
  consulente:{label:'Consulentes',desc:'Dias de gira, orientações e banhos enviados para você.',icon:'msg',cor:'#536f8f'}
};
const MEMBERS_LABEL={pai_mae:'Pai/Mãe',filho:'Filho(a)',cambono:'Cambono',consulente:'Consulente'};
const STATUS_LABEL={pendente:'Aguardando',ativo:'Ativo',recusado:'Recusado',inativo:'Inativo'};
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const jget=(k,d=null)=>{try{const v=ls.get(k);return v?JSON.parse(v):d}catch(e){return d}};
const E=s=>esc(s);
const ico=n=>(typeof ICON!=='undefined'&&ICON[n])||'';

/* ---------------------------------------------------------------- CLIENTE -- */
function cfg(){return {url:String(MT_SUPABASE.url||'').trim().replace(/\/+$/,''),anonKey:String(MT_SUPABASE.anonKey||'').trim()}}
const configured=()=>{const c=cfg();return /^https:\/\/[^\s/]+$/i.test(c.url)&&c.anonKey.length>20};
class CloudError extends Error{constructor(m,code,status){super(m);this.code=code||'';this.status=status||0}}
function friendly(msg,code,status){
  const m=String(msg||'').toLowerCase();
  if(code==='invalid_credentials'||m.includes('invalid login'))return 'E-mail ou senha incorretos.';
  if(code==='email_not_confirmed'||m.includes('not confirmed'))return 'Confirme seu e-mail antes de entrar. Procure a mensagem de confirmação (olhe também o spam).';
  if(code==='user_already_exists'||m.includes('already registered'))return 'Este e-mail já tem cadastro. Use Entrar ou Esqueci minha senha.';
  if(code==='weak_password'||m.includes('password should be')||m.includes('weak'))return 'Senha fraca. Use pelo menos 6 caracteres, de preferência com letras e números.';
  if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit'||m.includes('rate limit')||status===429)return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
  if(m.includes('same password')||m.includes('different from the old'))return 'Escolha uma senha diferente da atual.';
  if(m.includes('jwt')||code==='bad_jwt')return 'Sua sessão expirou. Entre novamente.';
  if(m.includes('signups not allowed')||m.includes('signup is disabled'))return 'Novos cadastros estão desativados no servidor.';
  if(m.includes('not authorized')||m.includes('error sending')||m.includes('sending recovery')||m.includes('sending confirmation'))return 'Não foi possível enviar o e-mail agora. Fale com o suporte do MEU TERREIRO para recuperar o acesso.';
  if(m.includes('valid email')||m.includes('invalid email'))return 'Informe um e-mail válido.';
  if(m.includes('payload too large')||status===413)return 'O arquivo é grande demais (máximo 5 MB).';
  if(m.includes('mime')||m.includes('not supported'))return 'Tipo de arquivo não aceito. Envie foto (JPG/PNG) ou PDF.';
  return String(msg||'Erro inesperado.');
}
let S=null;
function loadS(){S=jget(K.ses)}
function saveS(s){S=s;if(s)ls.set(K.ses,JSON.stringify(s));else{ls.del(K.ses);ls.del(LK);try{sessionStorage.removeItem('mt_unlocked')}catch(e){}}}
/* ---- Senha a cada abertura: a sessão fica guardada, mas só abre depois de digitar a senha ---- */
const LK='mt_cloud_lock';
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
async function pwHash(pass,salt){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);return b64(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:150000},k,256))}
async function lockSave(email,pass){try{if(!S||!S.user||!crypto||!crypto.subtle)return;const salt=crypto.getRandomValues(new Uint8Array(16));ls.set(LK,JSON.stringify({u:S.user.id,e:email,s:b64(salt),h:await pwHash(pass,salt)}))}catch(e){}}
async function lockCheck(pass){try{const L=jget(LK);if(!L||!S||!S.user||L.u!==S.user.id||!crypto||!crypto.subtle)return null;return (await pwHash(pass,unb64(L.s)))===L.h}catch(e){return null}}
const isUnlocked=()=>{try{return sessionStorage.getItem('mt_unlocked')==='1'}catch(e){return true}};
const markUnlocked=()=>{try{sessionStorage.setItem('mt_unlocked','1')}catch(e){}};
let UNLOCK_FAIL={n:0,until:0};
/* Aparelho de convidado: depois de entrar como Filho, Cambono ou Consulente, o aparelho fica travado nesse módulo */
const DLK='mt_dev_lock';
const devLock=()=>{const v=ls.get(DLK);return ['filho','cambono','consulente'].includes(v)?v:''};
function normSession(j,fallbackUser){
  const exp=j.expires_at?j.expires_at*1000:Date.now()+(Number(j.expires_in)||3600)*1000;
  const u=j.user||fallbackUser||(S&&S.user)||null;
  return {access_token:j.access_token,refresh_token:j.refresh_token,expires_at:exp,user:u?{id:u.id,email:u.email,meta:u.user_metadata||u.meta||{}}:null};
}
async function http(path,o={}){
  const c=cfg();const h={apikey:c.anonKey};
  if(!o.rawBody)h['Content-Type']='application/json';
  const bearer=o.token||(/^sb_/.test(c.anonKey)?'':c.anonKey);
  if(bearer)h.Authorization='Bearer '+bearer;
  if(o.prefer)h.Prefer=o.prefer;
  if(o.headers)Object.assign(h,o.headers);
  let r;
  try{r=await fetch(c.url+path,{method:o.method||'GET',headers:h,body:o.rawBody!==undefined?o.rawBody:(o.body===undefined?undefined:JSON.stringify(o.body))})}
  catch(e){throw new CloudError('Sem conexão com a internet.','offline',0)}
  if(o.blob){if(!r.ok)throw new CloudError('Arquivo indisponível.','nofile',r.status);return r.blob()}
  const t=await r.text();let j=null;
  if(t){try{j=JSON.parse(t)}catch(e){j=t}}
  if(!r.ok){
    const code=(j&&(j.error_code||(typeof j.code==='string'?j.code:'')))||'';
    const msg=(j&&(j.msg||j.message||j.error_description||j.error))||('Erro '+r.status);
    throw new CloudError(friendly(msg,code,r.status),code,r.status);
  }
  return j;
}
async function refreshS(){
  if(!S||!S.refresh_token)throw new CloudError('Sem sessão.','nosession',401);
  try{const j=await http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:S.refresh_token}});saveS(normSession(j))}
  catch(e){if(e.code!=='offline'&&e.status!==0&&e.status!==500&&e.status!==502&&e.status!==503)saveS(null);throw e}
}
async function tok(){
  if(!S)throw new CloudError('Sem sessão.','nosession',401);
  if(Date.now()>S.expires_at-60000)await refreshS();
  return S.access_token;
}
const redirectTo=()=>encodeURIComponent(location.origin+location.pathname);
const api={
  async signUp(email,password,meta){
    const j=await http('/auth/v1/signup?redirect_to='+redirectTo(),{method:'POST',body:{email,password,data:meta}});
    const user=j&&(j.user||(j.id?j:null));
    if(user&&Array.isArray(user.identities)&&user.identities.length===0)throw new CloudError(friendly('already registered','user_already_exists',400),'user_already_exists',400);
    if(j&&j.access_token){saveS(normSession(j,user));return {session:S}}
    return {session:null};
  },
  async signIn(email,password){const j=await http('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});saveS(normSession(j));return S},
  async recover(email){await http('/auth/v1/recover?redirect_to='+redirectTo(),{method:'POST',body:{email}})},
  async setPassword(pw){return http('/auth/v1/user',{method:'PUT',token:await tok(),body:{password:pw}})},
  async getUser(token){return http('/auth/v1/user',{token})},
  async signOut(){try{if(S)await http('/auth/v1/logout',{method:'POST',token:S.access_token})}catch(e){}saveS(null)},
  async select(t,qs){return http('/rest/v1/'+t+(qs?'?'+qs:''),{token:await tok()})},
  async insert(t,rows){return http('/rest/v1/'+t,{method:'POST',token:await tok(),body:rows,prefer:'return=representation'})},
  async patch(t,qs,body){return http('/rest/v1/'+t+'?'+qs,{method:'PATCH',token:await tok(),body,prefer:'return=representation'})},
  async del(t,qs){return http('/rest/v1/'+t+'?'+qs,{method:'DELETE',token:await tok()})},
  async rpc(n,args,anon){return http('/rest/v1/rpc/'+n,{method:'POST',body:args||{},token:anon?null:await tok()})},
  async upload(path,blob){
    return http('/storage/v1/object/comprovantes/'+path,{method:'POST',token:await tok(),rawBody:blob,headers:{'Content-Type':blob.type||'application/octet-stream','x-upsert':'false'}});
  },
  async download(path){return http('/storage/v1/object/authenticated/comprovantes/'+path,{token:await tok(),blob:true})}
};

/* ------------------------------------------------------------- UTILIDADES -- */
const isEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const WD=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today=()=>iso(new Date());
const dLong=s=>{if(!s)return '';const [y,m,d]=s.split('-').map(Number);const dt=new Date(y,m-1,d);return WD[dt.getDay()]+', '+d+' de '+MONTHS[m-1]};
const hh=(a,b)=>a?(b?a+' às '+b:a):'';
const nl=s=>E(s).replace(/\n/g,'<br>');
const when=t=>{try{const d=new Date(t);return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
const brl=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const compLabel=c=>{const [y,m]=String(c).split('-');return (MONTHS[Number(m)-1]||c)+' de '+y};
const compShort=c=>{const [y,m]=String(c).split('-');return m+'/'+y};
const hash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h>>>0)};
const centsFrom=v=>{const n=Number(String(v||'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?Math.round(n*100):0};
let MEM=null;
let CURMOD='pai_mae';
const cacheProfile=p=>ls.set(K.prof,JSON.stringify(p));
const cachedProfile=()=>jget(K.prof);
const val=id=>(document.getElementById(id)?.value||'').trim();
const busy=(btn,on,txt)=>{if(!btn)return;if(on){btn.dataset.t=btn.innerHTML;btn.disabled=true;btn.textContent=txt||'Aguarde…'}else{btn.disabled=false;if(btn.dataset.t)btn.innerHTML=btn.dataset.t}};
const UNAVAILABLE='O acesso online está indisponível no momento. Tente novamente mais tarde ou fale com a administração da casa.';

/* ------------------------------------------------------------ TELAS (GATE) -- */
function gateHost(){let g=document.getElementById('mtGate');if(!g){g=document.createElement('div');g.id='mtGate';document.body.appendChild(g)}return g}
function closeGate(){const g=document.getElementById('mtGate');if(g)g.remove()}
function heroBlock(){return `<div class="auth-brand"><span class="auth-kicker">O CAMINHO DA FÉ COMEÇA AQUI</span><div class="auth-quote">A Umbanda é luz que acolhe, orienta e fortalece o caminhar.</div><div class="auth-lead">Cada pessoa com o seu acesso: Pai/Mãe da casa, filhos, cambonos e consulentes.</div></div>`}
function panel(inner){
  const img=(typeof authImage==='function')?authImage():'';
  gateHost().innerHTML=`<div class="auth-screen"><section class="auth-visual">${img?`<img src="${img}" alt="Altar do MEU TERREIRO">`:''}${heroBlock()}</section><section class="auth-panel"><div class="auth-card mtg-card-wrap">${inner}</div></section></div>`;
  const f=gateHost().querySelector('input:not([type=hidden]):not([type=checkbox]):not([readonly])');
  if(f&&window.innerWidth>760)setTimeout(()=>{try{f.focus()}catch(e){}},50);
}
const errBox=()=>`<div id="mtErr" class="auth-error" role="alert"></div>`;
function showErr(m,ok){const el=document.getElementById('mtErr');if(!el){toast(m);return}el.textContent=m;el.classList.add('show');el.classList.toggle('mtok',!!ok)}
function clearErr(){const el=document.getElementById('mtErr');if(el){el.classList.remove('show');el.textContent=''}}
const pwField=(id,label,ac)=>(typeof authPasswordField==='function'?authPasswordField(id,label,ac):`<label>${label}<input id="${id}" type="password" autocomplete="${ac||'current-password'}" minlength="6"></label>`);
const inApp=()=>{try{return !!(state&&state.settings&&state.settings.authConfigured&&safeSessionGet('cda_authenticated'))}catch(e){return false}};
const back=(to,label)=>`${(INV||devLock())?'':`<button type="button" class="mtg-link" data-mt="screen" data-a="${to}">${label||'← Trocar de módulo'}</button>`}${inApp()?`<button type="button" class="mtg-link center" data-mt="closegate">Voltar ao app</button>`:''}`;
const legalCheck=()=>`<label class="legal-check"><input id="mt_legal" type="checkbox"><span>Li e aceito os <button type="button" data-action="legal-terms">Termos de Uso</button> e a <button type="button" data-action="legal-privacy">Política de Privacidade</button> do MEU TERREIRO APP.</span></label>`;
let INV=null;
let CUR={name:'modules',mod:'pai_mae'};
let SOBRE_BACK='modules';
function screen(name,mod,extra){
  if(name==='sobre'&&CUR.name!=='sobre')SOBRE_BACK=CUR.name||'modules';
  CUR={name,mod:mod||CUR.mod,extra};
  if(mod)CURMOD=mod;
  const m=MODS[CURMOD];
  const S_={
    modules:()=>`<span class="eyebrow">Bem-vindo</span><h2>Como você quer entrar?</h2><p>Escolha o seu módulo. Cada um tem login e cadastro próprios.</p>
      <div class="mtg-how"><button type="button" class="mtg-how-i act" data-mt="local"><b>Só neste aparelho (offline)</b><small>Para o Pai/Mãe que quer apenas o controle interno da casa. Sem internet, com 30 dias grátis.</small><em>Toque para entrar ›</em></button><button type="button" class="mtg-how-i on act" data-mt="module" data-a="pai_mae"><b>${MT_PLANO} (online)</b><small>Para a casa toda: o Pai/Mãe contrata e libera filhos, cambonos e consulentes.</small><em>Toque para entrar ou criar cadastro ›</em></button></div>
      <div class="mtg-modules">${Object.keys(MODS).map(k=>`<button type="button" class="mtg-mod ${ls.get(K.mod)===k?'last':''}" data-mt="module" data-a="${k}" style="--mc:${MODS[k].cor}"><span class="mtg-ic">${ico(MODS[k].icon)}</span><span class="mtg-tx"><b>${MODS[k].label}</b><small>${MODS[k].desc}</small>${k==='pai_mae'?'<span class="mtg-req ok">Online ou só neste aparelho</span>':'<span class="mtg-req">Precisa do convite do Pai/Mãe</span>'}</span><span class="mtg-ch">›</span></button>`).join('')}</div>
      <p class="mtg-note">Filhos, cambonos e consulentes só conseguem entrar com o convite do Pai/Mãe da casa, e só enquanto a casa estiver com a <b>${MT_PLANO}</b> ativa. Quem decide e libera tudo é o Pai/Mãe.</p>
      <button type="button" class="btn mtg-about" data-mt="screen" data-a="sobre">Como funciona o MEU TERREIRO</button>
      ${inApp()?`<button type="button" class="mtg-link center" data-mt="closegate">Voltar ao app</button>`:''}`,
    login:()=>{
      const adm=CURMOD==='pai_mae';
      return `<span class="eyebrow">${E(m.label)}</span><h2>Entrar</h2>${adm?`<div class="mtg-lead"><b>${MT_PLANO} · online</b><small>Entre com a conta da casa para liberar acessos, publicar a agenda, validar mensalidades e enviar orientações.</small></div><div class="mtg-note"><b>Atenção:</b> esta é a conta <b>online</b>, diferente do acesso local deste aparelho. O e-mail e a senha do acesso local <b>não valem aqui</b>. Se ainda não criou a conta online, toque em <b>Criar meu cadastro</b> e use o código de liberação do ${MT_PLANO}.</div>`:`<p>${E(m.desc)}</p>`}${configured()?'':`<div class="auth-error show">${UNAVAILABLE}</div>`}
      <label>E-mail<input id="mt_email" type="email" autocomplete="username" inputmode="email" value="${E(ls.get('mt_last_email')||'')}"></label>${pwField('mt_pass','Senha','current-password')}${errBox()}
      <button class="btn primary" data-mt="login" data-mt-primary>${ico('lock')}Entrar como ${E(m.label)}</button>
      <div class="mtg-row"><button type="button" class="mtg-link" data-mt="screen" data-a="signup">Criar meu cadastro</button><button type="button" class="mtg-link" data-mt="screen" data-a="forgot">Esqueci minha senha</button></div>
      <p class="mtg-help">${adm?`<b>Primeira vez?</b> Use o botão de cadastro e o código de liberação recebido ao contratar a ${MT_PLANO}. `:`<b>Primeira vez?</b> Peça o código de convite ao Pai/Mãe da casa, que precisa estar com a ${MT_PLANO} ativa. `}<b>Esqueceu a senha?</b> Enviamos um link de redefinição para o seu e-mail (não é enviado por WhatsApp).</p>
      ${adm?`<button type="button" class="btn mtg-about" data-mt="screen" data-a="sobre">Como funciona o MEU TERREIRO</button><div class="mtg-off"><h3>Somente neste aparelho (offline)</h3><p class="small muted" style="margin:0">Para quem quer usar o app só no controle interno da casa.</p><ul><li>Funciona sem internet; os dados ficam guardados neste aparelho.</li><li>30 dias grátis para testar tudo. Depois, é preciso ativar o plano PRO.</li><li>Não libera acesso online para filhos, cambonos e consulentes.</li><li>Faça backup com frequência (Configurações → Backup).</li></ul><button type="button" class="mtg-offbtn" data-mt="local"><span>Entrar no app offline<small>Usar somente neste aparelho</small></span><i aria-hidden="true">›</i></button>${MT_CONTATO.whatsapp?`<div class="mtg-ask"><span>Já quer o plano PRO?</span><select class="mtg-plan" aria-label="Plano"><option value="1">1 mês</option><option value="6" selected>6 meses</option><option value="12">12 meses</option></select><button type="button" class="btn sm" data-mt="ask" data-k="pro">Quero assinar o PRO (WhatsApp)</button></div>`:''}</div>`:''}
      ${back('modules')}`},
    signup:()=>{
      const adm=CURMOD==='pai_mae',cons=CURMOD==='consulente';
      const intro=adm?`<div class="mtg-explain"><h3>O que é este cadastro?</h3><ul><li>Cria a conta online da sua casa na <b>${MT_PLANO}</b>.</li><li>Com ela você libera filhos, cambonos e consulentes, publica a agenda e as giras, valida mensalidades e envia orientações e banhos.</li><li>Os dados do terreiro continuam neste aparelho; a nuvem guarda só o que você compartilha.</li></ul></div>`:cons?'Cadastre-se para acompanhar os dias de gira e receber as orientações da casa. O Pai/Mãe da casa confirma o seu acesso.':'Preencha seus dados e o código da casa. O Pai/Mãe da casa confirma o seu acesso.';
      return `<span class="eyebrow">${E(m.label)} · Cadastro</span><h2>Criar cadastro</h2>${configured()?'':`<div class="auth-error show">${UNAVAILABLE}</div>`}${adm?`<button type="button" class="btn mtg-about" data-mt="screen" data-a="sobre">Como funciona o MEU TERREIRO</button>`+intro:`<p>${intro}</p>`}
      <label>${adm?'Nome do responsável':'Nome completo'}<input id="mt_nome" autocomplete="name"></label>
      ${adm?`<label>Nome da casa<input id="mt_casa" placeholder="Ex.: Casa de Oxum"></label><label>Código de liberação<input id="mt_lib" autocapitalize="characters" autocomplete="off" maxlength="14" placeholder="MT-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:.1em"></label><div id="mt_lib_ok" class="mtg-casa"></div><div class="mtg-code-help"><b>O que é o código de liberação?</b><br>É um código de uso único (MT-XXXX-XXXX) que você recebe ao contratar a ${MT_PLANO} por 1, 6 ou 12 meses. Ele cria a sua casa online e define por quanto tempo ela fica ativa; para renovar, basta usar um novo código.<br><b>Sem o código não é possível criar a casa online</b> e, sem ela, filhos, cambonos e consulentes não conseguem se cadastrar.${MT_CONTATO.whatsapp?`<div class="mtg-ask"><span>Ainda não tem código?</span><select class="mtg-plan" aria-label="Plano"><option value="1">1 mês</option><option value="6" selected>6 meses</option><option value="12">12 meses</option></select><button type="button" class="btn sm primary" data-mt="ask" data-k="conectado">Quero assinar o ${MT_PLANO} (WhatsApp)</button></div>`:''}</div>`:`<label>Código da casa<input id="mt_codigo" autocapitalize="characters" autocomplete="off" maxlength="12" placeholder="${cons?'Código de consulentes (com a casa)':'Pedido ao Pai/Mãe da casa'}" value="${E(INV&&(INV.escolher?CURMOD!=='consulente':INV.modulo===CURMOD)?INV.codigo:'')}" ${INV&&INV.codigo&&(INV.escolher?CURMOD!=='consulente':INV.modulo===CURMOD)?'readonly class="mtg-lock" title="Código recebido no convite"':''} style="text-transform:uppercase;letter-spacing:.12em"></label><div id="mt_casa_ok" class="mtg-casa"></div>`}
      <label>WhatsApp <span class="small muted">(com DDD)</span><input id="mt_tel" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999"></label>
      ${adm?'':`<label>Data de nascimento <span class="small muted">(opcional)</span><input id="mt_nasc" type="date"></label>`}
      <label>E-mail<input id="mt_email" type="email" autocomplete="email" inputmode="email"></label>${pwField('mt_pass','Crie uma senha (mínimo 6 caracteres)','new-password')}${pwField('mt_pass2','Confirme a senha','new-password')}${legalCheck()}${errBox()}
      <button class="btn primary" data-mt="signup" data-mt-primary>${ico('lock')}Criar cadastro</button>
      <div class="mtg-row"><button type="button" class="mtg-link" data-mt="screen" data-a="login">Já possuo cadastro · Entrar</button></div>
      ${adm?`<div class="mtg-or">ou</div><div class="mtg-off" style="margin-top:6px"><h3>Não quer a ${MT_PLANO}?</h3><p class="small muted" style="margin:0 0 10px">Use o app só neste aparelho, sem código e sem internet, com 30 dias grátis. Você poderá contratar a ${MT_PLANO} depois.</p><button type="button" class="mtg-offbtn" data-mt="local"><span>Entrar no app offline<small>Usar somente neste aparelho</small></span><i aria-hidden="true">›</i></button></div>`:''}
      ${back('login','← Já tenho cadastro')}`;
    },
    forgot:()=>`<span class="eyebrow">${E(m.label)}</span><h2>Recuperar senha</h2><p>Informe o e-mail do cadastro. Enviaremos um link para criar uma nova senha, <b>por e-mail</b> (não por WhatsApp). Confira também a caixa de spam.</p>
      <label>E-mail<input id="mt_email" type="email" autocomplete="username" inputmode="email" value="${E(ls.get('mt_last_email')||'')}"></label>${errBox()}
      <button class="btn primary" data-mt="forgot" data-mt-primary>Enviar link</button>${back('login','← Voltar')}`,
    newpass:()=>`<span class="eyebrow">Nova senha</span><h2>Crie sua nova senha</h2><p>Use pelo menos 6 caracteres.</p>${pwField('mt_pass','Nova senha','new-password')}${pwField('mt_pass2','Confirme a nova senha','new-password')}${errBox()}
      <button class="btn primary" data-mt="newpass" data-mt-primary>Salvar nova senha</button>`,
    sobre:()=>`<span class="eyebrow">Guia rápido</span><h2>Como funciona o MEU TERREIRO</h2>
      <p>Um app para organizar a sua casa de Umbanda: pessoas, agenda de giras, financeiro, mensalidades, trabalhos espirituais, mensagens e backup.</p>
      <div class="mtg-explain"><h3>Duas formas de usar</h3>
        <div class="mtg-how"><div class="mtg-how-i"><b>Somente neste aparelho (offline)</b><small>Controle completo da casa pelo Pai/Mãe, sem internet. Os dados ficam guardados neste aparelho.<br><b>30 dias grátis</b>; depois, plano PRO de 1, 6 ou 12 meses.</small></div><div class="mtg-how-i on"><b>${MT_PLANO} (online)</b><small>Tudo do modo offline <b>mais</b> acesso próprio para filhos, cambonos e consulentes.<br>Contratado por <b>1, 6 ou 12 meses</b> e liberado por um código.</small></div></div></div>
      <div class="mtg-explain"><h3>O que cada módulo traz</h3><ul><li><b>Pai/Mãe da casa:</b> pessoas, agenda, financeiro, acessos, avisos, orientações e banhos.</li><li><b>Filhos da casa:</b> agenda e calendário, mensalidade (envia o comprovante), avisos e o próprio cadastro.</li><li><b>Cambonos e apoio:</b> agenda e materiais dos trabalhos, mensalidade e avisos.</li><li><b>Consulentes:</b> dias de gira abertos, orientações e banhos enviados individualmente, e avisos.</li></ul></div>
      <div class="mtg-explain"><h3>Como convidar as pessoas</h3><ul><li>O Pai/Mãe abre <b>Acessos &amp; Nuvem</b> e envia o convite pelo WhatsApp.</li><li>A pessoa toca no link, preenche os dados e <b>cria a própria senha</b>.</li><li>O Pai/Mãe aprova o cadastro e pode <b>desativar ou remover</b> o acesso quando quiser.</li><li>Na mensalidade, o filho envia o comprovante e o Pai/Mãe valida: o lançamento entra no financeiro sozinho.</li></ul></div>
      <div class="mtg-explain"><h3>Planos e códigos</h3><ul><li><b>${MT_PLANO}:</b> código de liberação (MT-XXXX-XXXX), de uso único. Renova com um novo código.</li><li><b>PRO (aparelho):</b> código ligado ao ID do aparelho, para continuar usando o app neste aparelho depois dos 30 dias grátis.</li><li>Se o ${MT_PLANO} vencer, filhos, cambonos e consulentes ficam com acesso suspenso; o app do Pai/Mãe continua funcionando.</li></ul></div>
      ${MT_CONTATO.whatsapp?`<div class="mtg-code-help"><b>Quer assinar?</b> Escolha o plano e fale com a gente pelo WhatsApp ${E(MT_CONTATO.exibe||'')}.<div class="mtg-ask"><select class="mtg-plan" aria-label="Plano"><option value="1">1 mês</option><option value="6" selected>6 meses</option><option value="12">12 meses</option></select><button type="button" class="btn sm primary" data-mt="ask" data-k="conectado">Quero assinar o ${MT_PLANO}</button><button type="button" class="btn sm" data-mt="ask" data-k="pro">Quero assinar o PRO</button></div></div>`:''}
      <button type="button" class="btn primary" data-mt="screen" data-a="${SOBRE_BACK}">← Voltar</button>`,
    escolha:()=>`<span class="eyebrow">Convite recebido</span><h2>Você entra como…</h2><p>A casa convidou você. Escolha a sua função para criar o cadastro. O Pai/Mãe da casa confirma o seu acesso.</p>
      <div class="mtg-modules">${['filho','cambono'].map(k=>`<button type="button" class="mtg-mod" data-mt="pick" data-a="${k}" style="--mc:${MODS[k].cor}"><span class="mtg-ic">${ico(MODS[k].icon)}</span><span class="mtg-tx"><b>${MODS[k].label}</b><small>${MODS[k].desc}</small></span><span class="mtg-ch">›</span></button>`).join('')}</div><div class="mtg-row" style="justify-content:center"><button type="button" class="mtg-link" data-mt="screen" data-a="login">Já possuo cadastro · Entrar</button></div>`,
    unlock:()=>{const c=cachedProfile(),nm=(c&&S&&c.user_id===S.user.id&&c.nome)||'';return `<span class="eyebrow">${E(m.label)}</span><h2>Digite sua senha</h2><p>Por segurança, o MEU TERREIRO pede a senha toda vez que o app é aberto.</p><div class="mtg-lead"><b>${E(nm||(S&&S.user&&S.user.email)||'')}</b><small>${E((S&&S.user&&S.user.email)||'')}</small></div>${pwField('mt_pass','Senha','current-password')}${errBox()}<button class="btn primary" data-mt="unlock" data-mt-primary>${ico('lock')}Entrar</button>${c&&c.papel==='pai_mae'?'<button type="button" class="mtg-link center" data-mt="otheraccount">Não sou eu · entrar com outra conta</button>':''}`},
    pending:()=>`<span class="eyebrow">Cadastro enviado</span><h2>Aguardando aprovação</h2><p><b>${E(MEM?.nome||'')}</b>, seu cadastro na casa <b>${E(MEM?.casas?.nome||'')}</b> foi enviado como <b>${E(MEMBERS_LABEL[MEM?.papel]||'')}</b>. O Pai/Mãe da casa precisa liberar o seu acesso.</p>${errBox()}
      <button class="btn primary" data-mt="recheck">Verificar novamente</button><button type="button" class="mtg-link center" data-mt="logout">Sair</button>`,
    blocked:()=>`<span class="eyebrow">Acesso indisponível</span><h2>Acesso não liberado</h2><p>O seu acesso à casa <b>${E(MEM?.casas?.nome||'')}</b> está <b>${E((STATUS_LABEL[MEM?.status]||'').toLowerCase())}</b>. Fale com o Pai/Mãe da casa.</p><button class="btn primary" data-mt="recheck">Verificar novamente</button><button type="button" class="mtg-link center" data-mt="logout">Sair</button>`,
    suspenso:()=>`<span class="eyebrow">Acesso suspenso</span><h2>Acesso online da casa suspenso</h2><p>O plano online da casa <b>${E(MEM?.casas?.nome||'')}</b> está vencido. Fale com o Pai/Mãe da casa para renovar. Seus dados continuam guardados.</p><button class="btn primary" data-mt="recheck">Verificar novamente</button><button type="button" class="mtg-link center" data-mt="logout">Sair</button>`,
    incomplete:()=>`<span class="eyebrow">Cadastro incompleto</span><h2>Não encontramos o seu cadastro</h2><p>A conta existe, mas não foi vinculada a uma casa${extra?': '+E(extra):'.'} Refaça o cadastro com o código correto da casa ou fale com o Pai/Mãe.</p>${errBox()}
      <button class="btn primary" data-mt="recheck">Tentar novamente</button><button type="button" class="mtg-link center" data-mt="logout">Sair e usar outro e-mail</button>`
  };
  panel((S_[name]||S_.modules)());
  if(name==='signup'&&CURMOD==='pai_mae'){
    const c=document.getElementById('mt_lib'),o=document.getElementById('mt_lib_ok');let t=null;
    c.addEventListener('input',()=>{c.value=c.value.toUpperCase().replace(/[^A-Z0-9-]/g,'');o.textContent='';o.className='mtg-casa';const n=c.value.replace(/-/g,'');if(n.length<10||!configured())return;clearTimeout(t);t=setTimeout(async()=>{try{const ok=await api.rpc('mt_validar_liberacao',{p_codigo:c.value},true);o.textContent=ok?'Código válido.':'Código inválido ou já utilizado.';o.className='mtg-casa '+(ok?'ok':'bad')}catch(e){o.textContent=e.message;o.className='mtg-casa bad'}},350)});
  }
  if(name==='signup'&&CURMOD!=='pai_mae'){
    const c=document.getElementById('mt_codigo'),o=document.getElementById('mt_casa_ok');
    let t=null;
    const check=()=>{o.textContent='';o.className='mtg-casa';if(c.value.length<8)return;clearTimeout(t);t=setTimeout(async()=>{try{const n=await api.rpc('mt_validar_codigo',{p_codigo:c.value,p_papel:CURMOD},true);o.textContent=n?('Casa encontrada: '+n):'Código não encontrado para este módulo.';o.className='mtg-casa '+(n?'ok':'bad')}catch(e){o.textContent=e.message;o.className='mtg-casa bad'}},300)};
    c.addEventListener('input',()=>{c.value=c.value.toUpperCase().replace(/[^A-Z0-9]/g,'');check()});
    if(c.value&&configured())check();
  }
}

function askLink(kind,root){
  const sel=root&&root.querySelector('select.mtg-plan'),meses=[1,6,12].includes(+(sel&&sel.value))?+sel.value:6,lab=meses===1?'1 mês':meses+' meses';
  const nome=val('mt_nome'),casa=val('mt_casa'),tel=val('mt_tel');
  const dados=[nome?'Meu nome: '+nome:'',casa?'Nome da casa: '+casa:'',tel?'WhatsApp: '+tel:''].filter(Boolean).join('\n');
  let msg;
  if(kind==='pro'){
    let dev='',preco='';try{dev=typeof mtDeviceDisplay==='function'?mtDeviceDisplay():'';preco=(typeof MT_PRICES!=='undefined'&&MT_PRICES[meses])||''}catch(e){}
    msg=`Olá! Esta mensagem foi enviada pelo app MEU TERREIRO.\n\nQuero assinar o plano PRO (uso do app neste aparelho).\n\nPlano: ${lab}${preco?'\nValor: '+preco:''}${dev?'\nID do aparelho: '+dev:''}${dados?'\n'+dados:''}\n\nPor favor, envie o código de ativação PRO para este aparelho.`;
  }else{
    msg=`Olá! Esta mensagem foi enviada pelo app MEU TERREIRO (tela de cadastro).\n\nQuero assinar o TERREIRO CONECTADO (acesso online para os filhos, cambonos e consulentes da minha casa) e receber o meu código de liberação.\n\nPlano: ${lab}${dados?'\n'+dados:''}\n\nPor favor, me envie as informações de pagamento e o código.`;
  }
  window.open('https://wa.me/'+String(MT_CONTATO.whatsapp).replace(/\D/g,'')+'?text='+encodeURIComponent(msg),'_blank');
}
/* ---------------------------------------------------------------- FLUXOS --- */
function showLocal(){
  closeGate();showAuthGate();
  const card=document.querySelector('#lock .auth-card');
  if(card&&!card.querySelector('.mtg-backmods')){const b=document.createElement('button');b.type='button';b.className='mtg-link center mtg-backmods';b.dataset.mt='switch';b.textContent='← Trocar de módulo (Filhos, Cambonos, Consulentes)';card.appendChild(b)}
}
async function doLogin(btn){
  clearErr();const email=val('mt_email').toLowerCase(),pass=document.getElementById('mt_pass')?.value||'';
  if(!isEmail(email))return bad('mt_email','E-mail: use um endereço válido, com @ e domínio. Ex.: nome@gmail.com.');
  if(!pass)return bad('mt_pass','Senha: digite a senha do seu cadastro.');
  if(!configured()){showErr(UNAVAILABLE);return}
  busy(btn,true,'Entrando…');
  try{await api.signIn(email,pass);ls.set('mt_last_email',email);ls.set(K.mod,CURMOD);await enter({pass,viaMod:CURMOD})}
  catch(e){showErr(e.message)}finally{busy(btn,false)}
}
function markBad(id,msg){
  document.querySelectorAll('.mt-invalid').forEach(x=>x.classList.remove('mt-invalid'));
  document.querySelectorAll('.mt-fielderr').forEach(x=>x.remove());
  const el=document.getElementById(id);if(!el)return;
  el.classList.add('mt-invalid');(el.closest('.password-wrap')||el).classList.add('mt-invalid');(el.closest('.legal-check')||el).classList.add('mt-invalid');
  if(msg){const d=document.createElement('div');d.className='mt-fielderr';d.setAttribute('role','alert');d.textContent=msg;const anchor=el.closest('label')||el;anchor.insertAdjacentElement('afterend',d)}
  try{el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true})}catch(e){}
}
function bad(id,msg){showErr(msg);markBad(id,msg);return false}
document.addEventListener('input',e=>{if(e.target.classList)e.target.classList.remove('mt-invalid');const fe=e.target.closest&&e.target.closest('label');if(fe&&fe.nextElementSibling&&fe.nextElementSibling.classList.contains('mt-fielderr'))fe.nextElementSibling.remove();const w=e.target.closest&&e.target.closest('.password-wrap');if(w)w.classList.remove('mt-invalid')});
async function doSignup(btn){
  clearErr();
  const adm=CURMOD==='pai_mae',nome=val('mt_nome'),email=val('mt_email').toLowerCase(),tel=val('mt_tel'),pass=document.getElementById('mt_pass')?.value||'',pass2=document.getElementById('mt_pass2')?.value||'';
  if(nome.length<3||!/\s/.test(nome)&&nome.length<3){return bad('mt_nome','Nome: informe o nome completo (nome e sobrenome). Ex.: Maria da Silva.')}
  if(adm&&val('mt_casa').length<2)return bad('mt_casa','Nome da casa: informe o nome do terreiro. Ex.: Casa de Oxum.');
  if(adm&&val('mt_lib').replace(/-/g,'').length<10)return bad('mt_lib','Código de liberação: digite o código completo recebido, no formato MT-XXXX-XXXX. Ex.: MT-7KQ2-M9XA.');
  if(!adm&&val('mt_codigo').length<8)return bad('mt_codigo','Código da casa: digite os 8 caracteres (letras e números) que o Pai/Mãe da casa enviou. Ex.: K7M2QX9A.');
  if(digits(tel).length<10||digits(tel).length>13)return bad('mt_tel','WhatsApp: digite com DDD, só números ou com parênteses. Ex.: (11) 99999-9999.');
  if(!isEmail(email))return bad('mt_email','E-mail: use um endereço válido, com @ e domínio. Ex.: nome@gmail.com.');
  if(pass.length<6)return bad('mt_pass','Senha: use no mínimo 6 caracteres (letras e números). Ex.: terreiro2026.');
  if(pass!==pass2)return bad('mt_pass2','Confirmar senha: repita exatamente a mesma senha digitada acima.');
  if(!document.getElementById('mt_legal')?.checked)return bad('mt_legal','Aceite obrigatório: marque a caixa "Li e aceito os Termos de Uso e a Política de Privacidade".');
  if(!configured()){showErr(UNAVAILABLE);return}
  busy(btn,true,'Criando cadastro…');
  try{
    if(adm){const ok=await api.rpc('mt_validar_liberacao',{p_codigo:val('mt_lib')},true);if(!ok){bad('mt_lib','Código de liberação: inválido ou já utilizado. Confira se digitou igual ao recebido ou peça um novo código.');return}}
    if(!adm){const n=await api.rpc('mt_validar_codigo',{p_codigo:val('mt_codigo'),p_papel:CURMOD},true);if(!n){showErr('Código da casa não encontrado para este módulo. Confira com o Pai/Mãe da casa.');return}}
    const meta={mt_papel:CURMOD,mt_nome:nome,mt_telefone:tel,mt_aceite:new Date().toISOString()};
    if(adm){meta.mt_casa=val('mt_casa');meta.mt_liberacao=val('mt_lib')}else{meta.mt_codigo=val('mt_codigo');if(val('mt_nasc'))meta.mt_nascimento=val('mt_nasc')}
    const r=await api.signUp(email,pass,meta);
    ls.set('mt_last_email',email);ls.set(K.mod,CURMOD);INV=null;
    if(r.session){await enter({pass,viaMod:CURMOD,fresh:true,legal:true})}
    else{screen('login',CURMOD);showErr('Cadastro criado! Enviamos uma mensagem para '+email+'. Confirme o e-mail e depois entre aqui.',true);const i=document.getElementById('mt_email');if(i)i.value=email}
  }catch(e){showErr(e.message);
    if(e.code==='user_already_exists'||/já tem cadastro|already/i.test(e.message||'')){const eb=document.getElementById('mtErr');if(eb)eb.insertAdjacentHTML('beforeend','<br><button type="button" class="mtg-link" data-mt="gotologin">Já possuo cadastro · entrar com este e-mail</button>')}
  }finally{busy(btn,false)}
}
async function doUnlock(btn){
  clearErr();const pass=document.getElementById('mt_pass')?.value||'';
  if(!pass)return bad('mt_pass','Senha: digite a senha da sua conta.');
  if(Date.now()<UNLOCK_FAIL.until){showErr('Muitas tentativas. Aguarde alguns segundos e tente de novo.');return}
  busy(btn,true,'Verificando…');
  try{
    const r=await lockCheck(pass);
    if(r===true){UNLOCK_FAIL.n=0;markUnlocked();await enter({})}
    else if(r===false){UNLOCK_FAIL.n++;if(UNLOCK_FAIL.n>=5){UNLOCK_FAIL.until=Date.now()+30000;UNLOCK_FAIL.n=0}showErr('Senha incorreta.')}
    else{if(!S||!S.user){saveS(null);screen('modules');return}await api.signIn(S.user.email,pass);await enter({pass})}
  }catch(e){showErr(e.message)}finally{busy(btn,false)}
}
async function doForgot(btn){
  clearErr();const email=val('mt_email').toLowerCase();
  if(!isEmail(email)){showErr('Informe um e-mail válido.');return}
  busy(btn,true,'Enviando…');
  try{await api.recover(email);showErr('Se houver cadastro com este e-mail, o link chegará em instantes. Veja também o spam.',true)}
  catch(e){showErr(e.message)}finally{busy(btn,false)}
}
async function doNewPass(btn){
  clearErr();const p=document.getElementById('mt_pass')?.value||'',p2=document.getElementById('mt_pass2')?.value||'';
  if(p.length<6){showErr('A senha deve ter pelo menos 6 caracteres.');return}
  if(p!==p2){showErr('As senhas não conferem.');return}
  busy(btn,true,'Salvando…');
  try{await api.setPassword(p);toast('✓ Senha atualizada.');await enter({pass:p})}
  catch(e){showErr(e.message)}finally{busy(btn,false)}
}
async function logout(){
  stopTimers();await api.signOut();ls.del(K.prof);ls.del(K.cache);MEM=null;
  try{sessionStorage.removeItem('cda_authenticated');sessionStorage.removeItem('cda_unlocked')}catch(e){}
  location.reload();
}
async function fetchProfile(){
  if(!S||!S.user){const e=new Error('Sessão encerrada. Entre de novo.');e.code='nosession';throw e}
  const r=await api.select('membros','user_id=eq.'+encodeURIComponent(S.user.id)+'&select=*,casas(id,nome,plano_ate)');
  return r&&r[0]||null;
}
async function enter(o={}){
  if(o.pass&&S&&S.user){markUnlocked();await lockSave(S.user.email,o.pass)}
  try{
    let p=null;
    try{
      p=await fetchProfile();
      if(!p){await api.rpc('mt_concluir_cadastro');p=await fetchProfile()}
    }catch(e){
      if(e.code==='offline'){const c=cachedProfile();if(c&&S&&c.user_id===S.user.id)p=c;else throw e}
      else if(e.code==='nosession'||e.status===401){saveS(null);screen('modules');return}
      else if(!p){screen('incomplete',null,(e.status||e.code)?userErr(e.message):'');return}
    }
    if(!p){screen('incomplete');return}
    cacheProfile(p);MEM=p;
    if(p.papel!=='pai_mae'&&!devLock())ls.set(DLK,p.papel==='consulente'?'consulente':p.papel);
    if(p.papel==='pai_mae'&&devLock()){await api.signOut();MEM=null;ls.del(K.prof);ls.del(K.cache);screen('login',devLock());showErr('Este aparelho foi configurado só para convidados. A conta do Pai/Mãe da casa não entra por aqui.');return}
    if(o.viaMod&&o.viaMod!==p.papel)toast('Seu cadastro é de '+(MODS[p.papel]?.label||'outro módulo')+'. Abrindo o módulo correto.');
    if(p.status==='pendente'){screen('pending');return}
    if(p.status!=='ativo'){screen('blocked');return}
    if(p.papel!=='pai_mae'&&planExpired(p)){screen('suspenso');return}
    if(p.papel==='pai_mae')await openAdmin(p,o);else openPortal(p);
    setTimeout(presPending,700);
  }catch(e){screen('login',CURMOD);showErr(e.message)}
}
const planExpired=p=>!!(p&&p.casas&&p.casas.plano_ate&&p.casas.plano_ate<today());
let TIMERS=[];
const REV={pending:false,before:null};
const SY={t:null,busy:false,at:ls.get(K.sync)||'',err:''};
function stopTimers(){TIMERS.forEach(clearInterval);TIMERS=[];clearTimeout(SY.t)}

/* ------------------------------------------------------ MÓDULO PAI/MÃE ----- */
async function openAdmin(p,o={}){
  closeGate();closePortal();document.body.classList.remove('mt-portal');stopTimers();
  try{
    const st=state.settings;
    if(!st.authConfigured){
      st.authConfigured=true;st.loginName=S?.user?.email||'';
      st.passwordHash=o.pass?await hashPin(o.pass):await hashPin('x'+Math.random()+Date.now());
      state.house.responsible=p.nome;
      if(p.casas?.nome&&(!state.house.name||state.house.name==='MEU TERREIRO')){state.house.name=p.casas.nome;state.house.short=p.casas.nome}
      if(p.whatsapp&&!state.house.whatsapp)state.house.whatsapp=p.whatsapp;
      if(typeof mtStartTrialIfNeeded==='function')mtStartTrialIfNeeded();
    }
    if(o.legal||!st.termsAcceptedAt){st.termsAcceptedAt=st.termsAcceptedAt||new Date().toISOString();st.privacyAcceptedAt=st.privacyAcceptedAt||st.termsAcceptedAt;if(typeof MT_LEGAL_VERSION!=='undefined')st.legalVersion=MT_LEGAL_VERSION}
    st.cloudEmail=S?.user?.email||'';
    await persist(false);
  }catch(e){console.error('Falha ao sincronizar acesso local',e)}
  safeSessionSet('cda_authenticated','1');
  const lk=document.getElementById('lock');if(lk)lk.innerHTML='';
  ensureAdminNav();
  try{await render()}catch(e){console.error(e)}
  if(state.settings.pinEnabled&&!safeSessionGet('cda_unlocked')&&typeof showLock==='function')showLock();
  if(typeof mtHasAccess==='function'&&!mtHasAccess())setTimeout(()=>{try{mtLicenseModal(true)}catch(e){}},250);
  toast('✓ Bem-vindo(a), '+p.nome.split(' ')[0]+'.');
  try{
    AX.plano=await api.rpc('mt_meu_plano');AX.expired=!!(AX.plano&&AX.plano<today());
    const d=AX.plano?Math.ceil((new Date(AX.plano+'T23:59:59')-new Date())/86400000):99;
    if(AX.expired)toast('⚠ O plano online da casa venceu. Renove em Acessos & Nuvem.');else if(d<=15)toast('⏳ O plano online vence em '+Math.max(d,0)+' dia(s). Renove em Acessos & Nuvem.');
  }catch(e){}
  syncSoon(900);adminPoll();
  if(route==='access'){AX.membros=null;axPaint()}
  TIMERS.push(setInterval(()=>{if(document.visibilityState==='visible'){adminPoll();syncSoon(200)}},60000));
}
function ensureAdminNav(){
  if(!ROUTES.access)ROUTES.access=['Acessos & Nuvem','shield'];
  const side=document.getElementById('sideNav');
  if(side&&!side.querySelector('[data-route="access"]')){
    const b=document.createElement('button');b.className='nav-btn';b.dataset.route='access';
    const anchor=side.querySelector('[data-route="protection"]');
    side.insertBefore(b,anchor||null);
    try{configureNav()}catch(e){b.innerHTML=ico('shield')+'<span>Acessos &amp; Nuvem</span>'}
  }
  if(side&&!side.querySelector('[data-mt="switch"]')){
    const b=document.createElement('button');b.className='nav-btn';b.dataset.mt='switch';b.innerHTML=ico('users')+'<span>Trocar de módulo</span>';
    side.appendChild(b);
  }
}
function setBadge(n){
  const b=document.querySelector('#sideNav [data-route="access"]');if(!b)return;
  let s=b.querySelector('.mt-badge');
  if(n>0){if(!s){s=document.createElement('span');s.className='mt-badge';b.appendChild(s)}s.textContent=n>9?'9+':String(n)}else if(s)s.remove();
}

/* ---- Sincronização automática (agenda e mensalidades) ---- */
const adminActive=()=>!!(!AX.expired&&S&&MEM&&MEM.papel==='pai_mae'&&MEM.status==='ativo'&&configured()&&!window.__MT_DEMO_MODE&&typeof state!=='undefined'&&state);
function consTypes(){const t=state.settings&&state.settings.consulenteTypes;return Array.isArray(t)?t:['Gira']}
function isoOrNull(v){if(!v)return null;const d=new Date(v);return isNaN(d)?null:d.toISOString()}
const inWindow=(x,now=Date.now())=>(!x.visivel_de||new Date(x.visivel_de).getTime()<=now)&&(!x.visivel_ate||new Date(x.visivel_ate).getTime()>now);
function pubEvents(){
  const ct=consTypes().map(x=>String(x).toLowerCase());
  const resp=id=>{const m=(state.members||[]).find(x=>x.id===id);return m?m.name:''};
  return (state.events||[]).filter(e=>e&&e.date&&e.title&&e.publish!=='rascunho').map(e=>({local_id:String(e.id),titulo:e.title,tipo:e.type||'',data:e.date,hora:e.time||'',hora_fim:e.endTime||'',local:e.location||'',status:e.status||'',aberto:e.publish==='todos'?true:e.publish==='equipe'?false:ct.includes(String(e.type||'').toLowerCase()),notas:e.notes||'',materiais:e.materials||'',responsavel:resp(e.responsibleId),visivel_de:isoOrNull(e.showFrom),visivel_ate:isoOrNull(e.showUntil)}));
}
function pubFees(links){
  const items=[],now=new Date(),tdy=today(),months=[];
  for(let i=0;i<3;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(iso(d).slice(0,7))}
  for(const l of links){
    const m=(state.members||[]).find(x=>x.id===l.pessoa_local_id);if(!m)continue;
    const mode=typeof memberFeeMode==='function'?memberFeeMode(m):'Nenhuma';
    if(mode==='Isento'){items.push({pessoa_local_id:m.id,competencia:months[0],valor_centavos:0,vencimento:null,situacao:'isento'});continue}
    if(mode!=='Mensalidade'||!(state.settings&&state.settings.monthlyFees))continue;
    for(const mk of months){
      if(m.since&&mk<String(m.since).slice(0,7))continue;
      const tx=(state.transactions||[]).find(t=>t.personId===m.id&&t.category==='Mensalidade'&&t.type==='Receita'&&t.competence===mk&&t.status==='Recebido');
      const valor=tx?Number(tx.value)||0:(typeof memberFeeValue==='function'?memberFeeValue(m):0);
      if(!tx&&!(valor>0))continue;
      const due=(typeof mtFeeDueDate==='function'?mtFeeDueDate(m,mk):'')||null;
      items.push({pessoa_local_id:m.id,competencia:mk,valor_centavos:Math.max(0,Math.round(valor)),vencimento:due,situacao:tx?'paga':(due&&due<tdy?'atrasada':'pendente')});
    }
  }
  return items;
}
async function loadMembers(){
  const r=await api.select('membros','casa_id=eq.'+MEM.casa_id+'&select=*&order=criado_em.asc');AX.membros=r;return r;
}
function syncSoon(ms=2500){if(!adminActive())return;clearTimeout(SY.t);SY.t=setTimeout(()=>syncAll(false),ms)}
async function agendaPull(){
  if(!adminActive())return 0;
  const r=await api.select('eventos','casa_id=eq.'+MEM.casa_id+'&editado_por=not.is.null&select=*,eventos_filhos(notas)');
  const novos=(r||[]).filter(x=>!x.visto_em||x.visto_em<x.editado_em);
  if(!novos.length)return 0;
  novos.forEach(x=>{
    const nt=Array.isArray(x.eventos_filhos)?x.eventos_filhos[0]:x.eventos_filhos,notes=(nt&&nt.notas)||'';
    const campos={title:x.titulo,type:x.tipo||'',date:x.data,time:x.hora||'',endTime:x.hora_fim||'',location:x.local||'',status:x.status||'Confirmado',notes};
    const ev=(state.events||[]).find(e=>String(e.id)===x.local_id);
    if(ev)Object.assign(ev,campos);
    else state.events.push(Object.assign({id:x.local_id,responsibleId:'',participants:[],materials:''},campos));
    audit('Agenda','Alterado pelo app por '+(x.editado_nome||'filho/cambono'),x.titulo);
    {const e2=(state.events||[]).find(e=>String(e.id)===x.local_id);if(e2){e2.lastBy=x.editado_nome||'filho/cambono';e2.lastAt=x.editado_em||new Date().toISOString()}}
  });
  await persist();
  await api.rpc('mt_agenda_visto',{p_ids:novos.map(x=>x.id)});
  toast('📅 '+novos.length+' alteração(ões) de agenda vieram do app e já estão na sua Agenda.');
  if(typeof render==='function'&&['agenda','home'].includes(route))render();
  return novos.length;
}
const nrm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const dig=t=>String(t||'').replace(/\D/g,'').slice(-9);
function userErr(m){m=String(m||'');if(!/function|relation|schema cache|PGRST|permission denied|does not exist|42883|42P01|column|rpc|policy|jwt|syntax/i.test(m))return m;return (typeof MEM!=='undefined'&&MEM&&MEM.papel==='pai_mae')?'Esta parte ainda está sendo ativada na nuvem. Avise o suporte do Meu Terreiro.':'Esta parte ainda não está disponível. Avise o Pai/Mãe da casa.'}
function acharLocal(c){
  const L=(typeof state!=='undefined'&&state.members)||[];
  return L.find(l=>c.pessoa_local_id&&l.id===c.pessoa_local_id)||L.find(l=>nrm(l.name)&&nrm(l.name)===nrm(c.nome))||L.find(l=>dig(c.whatsapp||c.telefone).length>=8&&dig(l.whatsapp||l.phone)===dig(c.whatsapp||c.telefone))||null;
}
async function aplicarPlanejadas(mem){
  let n=0;
  for(const c of mem){
    if((c.papel!=='filho'&&c.papel!=='cambono')||c.status!=='ativo'||(c.acessos&&Object.keys(c.acessos).length))continue;
    const l=acharLocal(c);if(!l||!l.perms||!l.perms.acessos)continue;
    await api.rpc('mt_definir_acessos',{p_user:c.user_id,p_funcao:l.perms.funcao||'',p_acessos:l.perms.acessos});
    c.acessos=l.perms.acessos;c.funcao=l.perms.funcao||c.funcao;n++;
  }
  return n;
}
async function syncAll(force){
  mtEnsureTypes();
  if(!adminActive()||SY.busy||(REV.pending&&!force))return;
  SY.busy=true;if(route==='access')axPaint();
  try{
    try{await agendaPull()}catch(e){if(e.code==='offline')throw e}
    try{await estPull()}catch(e){if(e.code==='offline')throw e}
    try{await finPull()}catch(e){if(e.code==='offline')throw e}
    try{await eqmPull()}catch(e){if(e.code==='offline')throw e}
    const ev=pubEvents(),sigE=hash(JSON.stringify(ev));
    if(force||sigE!==ls.get(K.sigE)){
      if(ev.length||force||ls.get(K.pub)){await api.rpc('mt_publicar_agenda',{p_eventos:ev});ls.set(K.sigE,sigE);ls.set(K.pub,new Date().toISOString())}
    }
    const mem=await loadMembers();
    try{await aplicarPlanejadas(mem)}catch(e){if(e.code==='offline')throw e}
    try{const pa=pubAreas(AX.membros||mem),sigA=hash(JSON.stringify(pa));
      if(force||sigA!==ls.get('mt_cloud_sigA')){
        if(Object.keys(pa.pub).length)await api.rpc('mt_publicar_areas',{p_areas:pa.pub});
        for(const k of pa.rem)await api.rpc('mt_remover_area',{p_area:k});
        ls.set(PUBK,JSON.stringify([...new Set(pubList().concat(Object.keys(pa.pub)))].filter(k=>!pa.rem.includes(k))));
        ls.set('mt_cloud_sigA',sigA);AX.areaAt=new Date().toISOString();
      }
      AX.areas=await api.select('areas_publicadas','select=area,dados,atualizado_em').catch(()=>AX.areas||[]);
      AX.areaErr=''}catch(e){if(e.code==='offline')throw e;AX.areaErr=e.message}
    try{await estPush(force)}catch(e){if(e.code==='offline')throw e}
    try{await finPush(force)}catch(e){if(e.code==='offline')throw e}
    try{await eqmPush(force)}catch(e){if(e.code==='offline')throw e}
    const links=mem.filter(m=>m.pessoa_local_id&&m.status==='ativo'&&m.papel!=='consulente').map(m=>({pessoa_local_id:m.pessoa_local_id,user_id:m.user_id}));
    const it=pubFees(links),sigM=hash(JSON.stringify(it)+'|'+links.length);
    if(force||sigM!==ls.get(K.sigM)){await api.rpc('mt_publicar_mensalidades',{p_itens:it});ls.set(K.sigM,sigM)}
    SY.at=new Date().toISOString();ls.set(K.sync,SY.at);SY.err='';
  }catch(e){
    SY.err=e.message;
    if(e.code==='nosession'){saveS(null)}
    else{clearTimeout(SY.t);SY.t=setTimeout(()=>syncAll(false),e.code==='offline'?30000:90000)}
  }finally{SY.busy=false;if(route==='access')axPaint()}
}
/* ---- Áreas do app: cópia somente leitura das áreas liberadas por pessoa ---- */
const dfm=d=>{d=String(d||'').slice(0,10);return /^\d{4}-\d\d-\d\d$/.test(d)?d.split('-').reverse().join('/'):''};
const cents=v=>brl(Number(v||0));
function areaData(k){
  const st=state,ar=a=>Array.isArray(a)?a:[];
  const sort=(a,f)=>a.slice().sort((x,y)=>String(f(y)).localeCompare(String(f(x))));
  switch(k){
    case 'pessoas':return {cols:['Nome','Função','Grupo','Situação','Aniversário','WhatsApp'],rows:ar(st.members).map(m=>[m.name,m.role,m.group,m.status,dfm(m.birth),m.whatsapp||m.phone||''])};
    case 'financeiro':{let r='';try{const f=finMetrics();r='Mês atual · recebido '+cents(f.received)+' · pago '+cents(f.paid)}catch(e){}
      return {resumo:r,cols:['Data','Descrição','Tipo','Categoria','Valor','Situação'],rows:sort(ar(st.transactions),t=>t.date).slice(0,200).map(t=>[dfm(t.date),t.description,t.type,t.category,cents(t.value),t.status])}}
    case 'estoque':return {cols:['Item','Categoria','Quantidade','Mínimo','Situação'],rows:ar(st.stock).map(i=>[i.name,i.category,(i.qty??'')+' '+(i.unit||''),i.min,Number(i.qty)<Number(i.min)?'Baixo':'OK'])};
    case 'fornecedores':return {cols:['Nome','Categoria','Contato','Situação'],rows:ar(st.suppliers).map(f=>[f.name,f.category,f.phone||f.whatsapp||'',f.status])};
    case 'patrimonio':return {cols:['Bem','Categoria','Código','Local','Condição','Valor'],rows:ar(st.assets).map(a=>[a.name,a.category,a.code,a.location,a.condition,cents(a.value)])};
    case 'documentos':return {cols:['Título','Categoria','Data'],rows:sort(ar(st.documents),d=>d.date).map(d=>[d.title,d.category,dfm(d.date)])};
    case 'comunicacao':return {cols:['Título','Para','Data','Mensagem'],rows:sort(ar(st.messages),m=>m.date).slice(0,80).map(m=>[m.title,m.audience,dfm(m.date),String(m.text||'').slice(0,300)])};
    case 'trabalhos':return {cols:['Trabalho','Código','Data','Local','Situação'],rows:sort(ar(st.spiritualWorks),w=>w.date).slice(0,200).map(w=>[w.title,w.code,dfm(w.date),w.location,w.status])};
    case 'festas':return {cols:['Evento','Tipo','Data','Hora','Local','Situação'],rows:sort(ar(st.events).filter(e=>/festa|evento|bazar|palestra|a[cç][aã]o social|curso|voluntári/i.test(e.type||'')),e=>e.date).slice(0,200).map(e=>[e.title,e.type,dfm(e.date),e.time,e.location,e.status])};
    case 'relatorios':{let f={received:0,paid:0};try{f=finMetrics()}catch(e){}
      return {cols:['Indicador','Valor'],rows:[['Pessoas cadastradas',ar(st.members).length],['Recebido no mês',cents(f.received)],['Pago no mês',cents(f.paid)],['Itens com estoque baixo',ar(st.stock).filter(i=>Number(i.qty)<Number(i.min)).length],['Bens cadastrados',ar(st.assets).length],['Fornecedores',ar(st.suppliers).length],['Trabalhos espirituais',ar(st.spiritualWorks).length]]}}
  }
  return {cols:[],rows:[]};
}
const PUBK='mt_cloud_pubareas';
const pubList=()=>{try{return JSON.parse(ls.get(PUBK)||'[]')}catch(e){return[]}};
const areaOn=k=>!!(state.settings&&state.settings.mtAreasCloud&&state.settings.mtAreasCloud[k]);
function pubAreas(mem){
  /* Só este aparelho publica o que ele tem. Um aparelho novo e vazio nunca apaga o que já está na nuvem. */
  const was=pubList(),pub={},want=[];
  AREAS.forEach(([k])=>{
    const granted=mem.some(m=>(m.papel==='filho'||m.papel==='cambono')&&m.status==='ativo'&&m.acessos&&m.acessos[k]===true);
    if(!(areaOn(k)||granted))return;
    want.push(k);
    const d=areaData(k);if(!(d.rows&&d.rows.length)&&!was.includes(k))return;
    pub[k]=d;
  });
  return {pub,rem:was.filter(k=>!want.includes(k))};
}
/* ---- Instalar o aplicativo + tutorial curto por módulo ---- */
const standalone=()=>{try{return typeof isStandalone==='function'&&isStandalone()}catch(e){return false}};
const instDismissed=()=>{const t=Number(ls.get('mt_inst_dismiss')||0);return t&&Date.now()-t<3*864e5};
function installCard(compact){
  if(standalone()||instDismissed())return '';
  return `<div class="mtg-install"><div class="grow"><b>📲 Instale o aplicativo</b><small>Fica com ícone na tela do celular e abre como um app, sem digitar o endereço.</small></div><button type="button" class="btn sm primary" data-mt="install">Instalar</button>${compact?'':'<button type="button" class="btn sm" data-mt="instno">Agora não</button>'}</div>`;
}
function tourSteps(){
  const cons=MEM&&MEM.papel==='consulente';
  const st=[];
  if(cons){
    st.push(['Giras','Veja os dias de gira abertos ao público, com data, horário e local. Quando a casa marcar uma gira nova, ela aparece aqui sozinha.']);
    st.push(['Orientações','Aqui chegam as orientações e os banhos que o Pai/Mãe enviar só para você. Você é avisado ao abrir o app.']);
    st.push(['Cadastro','Seus dados e a troca de senha ficam na aba Cadastro.']);
  }else{
    st.push(['Início','Recados e avisos da casa, o que está por vir e notificações enviadas para você.']);
    const ed=MEM&&MEM.acessos&&MEM.acessos.agenda_editar;
    st.push(['Agenda',ed?'Veja as giras e compromissos. Você também pode criar e alterar compromissos: o Pai/Mãe aprova antes de aparecer para todos (ou aparece na hora, se ele liberou).':'Veja as giras e compromissos da casa com data, horário e local.']);
    st.push(['Mensalidade','Veja os meses em aberto e pagos. Para pagar, envie o comprovante pelo próprio app.']);
    if(canAreas())st.push(['Áreas',`O Pai/Mãe liberou para você: ${areaOkList().map(a=>a[1]).join(', ')}. É só consultar, sem alterar.`]);
    if(canConv()||canCad())st.push(['Convites',[canConv()?'enviar o convite da casa pelo WhatsApp':'',canCad()?'aprovar ou recusar novos cadastros':''].filter(Boolean).join(' e ').replace(/^./,c=>'Você pode '+c.toLowerCase())+'.']);
    st.push(['Cadastro','Seus dados, a troca de senha e a saída da conta ficam na aba Cadastro.']);
  }
  if(!standalone())st.push(['Instale o aplicativo','Para abrir mais rápido, instale o app no celular. No Android toque em Instalar; no iPhone use Compartilhar → Adicionar à Tela de Início.','install']);
  return st;
}
function portalTour(i){
  const st=tourSteps();i=Math.max(0,Math.min(i||0,st.length-1));const [t,x,act]=st[i],last=i===st.length-1;
  showModal(`${t} · ${i+1} de ${st.length}`,`<p style="line-height:1.6;font-size:15px">${E(x)}</p>${act==='install'?'<p><button class="btn primary" id="mtTourInst">Instalar agora</button></p>':''}`,`${i>0?'<button class="btn" id="mtTourPrev">Voltar</button>':'<button class="btn" data-action="close-modal">Pular</button>'}<button class="btn primary" id="mtTourNext">${last?'Concluir':'Próximo'}</button>`);
  const g=id=>document.getElementById(id);
  if(g('mtTourPrev'))g('mtTourPrev').onclick=()=>portalTour(i-1);
  g('mtTourNext').onclick=()=>{if(last){closeModal()}else portalTour(i+1)};
  if(g('mtTourInst'))g('mtTourInst').onclick=()=>{closeModal();if(typeof promptInstall==='function')promptInstall()};
}
function maybeTour(){
  try{
    if(!MEM||!document.getElementById('mtPortal'))return;
    const k='mt_tour_'+MEM.user_id;if(ls.get(k))return;ls.set(k,'1');
    setTimeout(()=>{if(document.getElementById('mtPortal')&&!document.querySelector('#modalRoot .overlay'))portalTour(0)},700);
  }catch(e){}
}
function injectInstallGate(){
  try{
    if(!INV||!['escolha','signup'].includes(CUR.name))return;
    const w=gateHost().querySelector('.mtg-card-wrap');if(!w||w.querySelector('.mtg-install'))return;
    const h=installCard(true);if(!h)return;w.insertAdjacentHTML('afterbegin',h);
  }catch(e){}
}
const _screenBase=screen;
screen=function(name){
  /* convite trava o módulo: quem veio por um convite não escolhe outro módulo nem entra como outro tipo de conta */
  if(!INV&&devLock()&&['modules','escolha','sobre'].includes(name))return _screenBase.call(this,'login',devLock());
  if(INV&&name==='modules')return _screenBase.call(this,INV.escolher&&!INV.picked?'escolha':'signup',INV.modulo);
  const r=_screenBase.apply(this,arguments);injectInstallGate();return r};
/* Termos/Privacidade: leitura completa com botão "Li e aceito" quando aberto de uma tela de cadastro */
if(typeof openLegalDocument==='function'){
  const _old=openLegalDocument;
  openLegalDocument=function(kind){
    const box=document.getElementById('mt_legal')||document.getElementById('setup_accept_legal');
    if(!box)return _old.apply(this,arguments);
    const isT=kind==='terms';
    showModal(isT?'Termos de Uso':'Política de Privacidade',(isT?MT_TERMS_HTML:MT_PRIVACY_HTML)+'<p class="small muted" style="margin-top:14px">Leia até o fim. Ao tocar em <b>Li e aceito</b>, a caixa de aceite é marcada (vale para os Termos de Uso e a Política de Privacidade).</p>','<button class="btn" data-action="close-modal">Voltar</button><button class="btn primary" id="mtLegalOk">Li e aceito</button>',true);
    const ok=document.getElementById('mtLegalOk');
    if(ok)ok.addEventListener('click',()=>{box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));const c=box.closest('.legal-check');if(c)c.classList.remove('mt-invalid');closeModal();toast('✓ Aceite registrado. Você já pode continuar.')});
  };
}
/* ---- Aniversários automáticos na Agenda (ano atual e o próximo) ---- */
function bdaySync(){
  if(typeof state==='undefined'||!state||!Array.isArray(state.events))return false;
  const y=new Date().getFullYear(),want={};
  (state.members||[]).forEach(m=>{
    if(!m||!m.birth||/^Inativ/.test(m.status||''))return;
    const r=/^(\d{4})-(\d{2})-(\d{2})/.exec(m.birth);if(!r)return;
    [y,y+1].forEach(yy=>{
      let mo=+r[2],d=+r[3];if(mo===2&&d===29&&!(yy%4===0&&(yy%100!==0||yy%400===0)))d=28;
      want['bd_'+m.id+'_'+yy]={id:'bd_'+m.id+'_'+yy,auto:'aniversario',memberId:m.id,title:'🎂 Aniversário de '+String(m.name||'').split(' ')[0]+(String(m.name||'').includes(' ')?' ('+m.name+')':''),type:'Aniversário',status:'Confirmado',date:yy+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'),time:'',endTime:'',location:'',notes:'Aniversário automático, vindo do cadastro. Para mudar, edite a data de nascimento da pessoa.',publish:'equipe'};
    });
  });
  let changed=false;
  const keep=[];
  state.events.forEach(e=>{
    if(e&&e.auto==='aniversario'){
      const w=want[e.id];
      if(!w){changed=true;return}
      if(e.date!==w.date||e.title!==w.title||e.publish!=='equipe'){Object.assign(e,{date:w.date,title:w.title,publish:'equipe'});changed=true}
      delete want[e.id];
    }
    keep.push(e);
  });
  const add=Object.values(want);
  if(add.length)changed=true;
  if(changed)state.events=keep.concat(add);
  return changed;
}
window.mtBdaySync=bdaySync;
const _persist=persist;
persist=async function(){try{bdaySync()}catch(e){}const r=await _persist.apply(this,arguments);try{if(!REV.pending)syncSoon()}catch(e){}return r};
setTimeout(()=>{try{if(bdaySync()){persist(false).catch(()=>{});if(typeof render==='function')render()}}catch(e){}},2500);
window.addEventListener('online',()=>{syncSoon(500);if(document.getElementById('mtPortal'))portalLoad(true)});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible')return;
  if(document.getElementById('mtPortal')&&Date.now()-(PT.lastLoad||0)>20000)portalLoad(true);
  if(adminActive())adminPoll();
});

/* --- Tela "Acessos & Nuvem" (dentro do app do Pai/Mãe) --- */
const AX={expired:false,plano:null,membros:null,avisos:null,codigos:{equipe:null,consulente:null},pagamentos:null,orient:null,props:[],hist:[],loading:false,err:'',pend:-1};
const axBadge=()=>(AX.pagamentos||[]).filter(p=>p.situacao==='enviado').length+(AX.props||[]).filter(p=>p.situacao==='pendente').length;
async function adminPoll(){
  if(!adminActive())return;
  try{
    const pg=await api.select('pagamentos','casa_id=eq.'+MEM.casa_id+'&select=*&order=criado_em.desc&limit=60');
    const pr=await api.select('agenda_propostas','casa_id=eq.'+MEM.casa_id+'&select=*&order=criada_em.desc&limit=60');
    const nPg=pg.filter(p=>p.situacao==='enviado').length,nPr=pr.filter(p=>p.situacao==='pendente').length,n=nPg+nPr;
    if(AX.pend>=0&&n>AX.pend)toast(nPr>(AX.props||[]).filter(p=>p.situacao==='pendente').length?'📅 Nova alteração de agenda para aprovar.':'💬 Novo comprovante de mensalidade para validar.');
    AX.pend=n;AX.pagamentos=pg;AX.props=pr;setBadge(n);
    if(route==='access'&&!AX.loading)axPaint();
  }catch(e){if(e.code==='nosession')saveS(null)}
}
async function axLoad(){
  if(!S||!MEM||MEM.papel!=='pai_mae'){AX.err='';return}
  AX.loading=true;AX.err='';
  try{
    AX.plano=await api.rpc('mt_meu_plano');AX.expired=!!(AX.plano&&AX.plano<today());
    if(AX.expired){AX.membros=[];AX.loading=false;if(route==='access')axPaint();return}
    const q='casa_id=eq.'+MEM.casa_id;
    const [m,a,ce,cc,pg,or,pl,pr,hi]=await Promise.all([
      api.select('membros',q+'&select=*&order=criado_em.asc'),
      api.select('avisos',q+'&select=*&order=criado_em.desc&limit=30'),
      api.rpc('mt_codigo_da_casa',{p_tipo:'equipe'}),
      api.rpc('mt_codigo_da_casa',{p_tipo:'consulente'}),
      api.select('pagamentos',q+'&select=*&order=criado_em.desc&limit=60'),
      api.select('orientacoes',q+'&select=*&order=criada_em.desc&limit=30'),
      api.rpc('mt_meu_plano'),
      api.select('agenda_propostas',q+'&select=*&order=criada_em.desc&limit=60'),
      api.select('agenda_historico',q+'&select=*&order=em.desc&limit=40')
    ]);
    AX.plano=pl;
    try{AX.areas=await api.select('areas_publicadas','select=area,dados,atualizado_em')}catch(e){AX.areas=AX.areas||[]}
    AX.membros=m;AX.avisos=a;AX.codigos={equipe:ce,consulente:cc};AX.pagamentos=pg;AX.orient=or;AX.props=pr;AX.hist=hi;
    AX.pend=axBadge();setBadge(AX.pend);
  }catch(e){AX.err=e.message;if(e.code==='nosession'){saveS(null)}}
  AX.loading=false;
  if(route==='access')axPaint();
}
function inviteText(tp,nome){
  const cons=tp==='consulente',casaN=(MEM&&MEM.casas&&MEM.casas.nome)||'';
  const t=cons?`Olá! A casa ${casaN} convida você para o app MEU TERREIRO: aqui você acompanha os dias de gira e recebe orientações e banhos enviados para você.\n\nComo entrar:\n1) Toque no link abaixo\n2) Preencha os seus dados e crie a sua própria senha\n3) Aguarde a liberação do Pai/Mãe da casa\n(Se você já tem cadastro, toque em "Já possuo cadastro · Entrar")\n4) Depois de entrar, toque em "Instalar" para ter o app na tela do celular\n\n${inviteLink(tp)}\n\n(Se pedir, o código da casa é ${codeOf(tp)})`:`Olá! A casa ${casaN} convida você para o app MEU TERREIRO: agenda das giras, mensalidade, avisos e o seu cadastro.\n\nComo entrar:\n1) Toque no link abaixo\n2) Escolha se você é Filho(a) ou Cambono, preencha os seus dados e crie a sua própria senha\n3) Aguarde a liberação do Pai/Mãe da casa\n(Se você já tem cadastro, toque em "Já possuo cadastro · Entrar")\n4) Depois de entrar, toque em "Instalar" para ter o app na tela do celular\n\n${inviteLink(tp)}\n\n(Se pedir, o código da casa é ${codeOf(tp)})`;
  return nome?t.replace(/^Olá!/,'Olá, '+nome.split(' ')[0]+'!'):t;
}
function codeOf(tp){return (AX.codigos&&AX.codigos[tp])||(PT.data&&PT.data.codes&&PT.data.codes[tp])||''}
function inviteLink(tipo,mod){
  const base=location.origin+location.pathname,code=codeOf(tipo);
  return base+'?modulo='+(mod||(tipo==='consulente'?'consulente':'equipe'))+'&convite='+encodeURIComponent(code);
}
const MT_TIPOS_EXTRA=['Trabalho voluntário','Ação social','Curso e estudo','Palestra','Bazar','Avulso (pontual)'];
function mtEnsureTypes(){
  try{
    if(!state||!state.settings||state.settings.mtTypesV630)return;
    const cur=Array.isArray(state.settings.eventTypes)?state.settings.eventTypes:[];
    const low=new Set(cur.map(x=>String(x).toLowerCase()));
    const add=MT_TIPOS_EXTRA.filter(x=>!low.has(x.toLowerCase()));
    const i=cur.indexOf('Outro');const out=cur.slice();
    if(i>=0)out.splice(i,0,...add);else out.push(...add);
    state.settings.eventTypes=out;state.settings.mtTypesV630=true;
    persist(false).catch(()=>{});
  }catch(e){}
}
function eventTypes(){
  const set=new Set(['Gira','Festa','Reunião']);
  (state.settings&&state.settings.eventTypes||[]).forEach(t=>{if(t&&t!=='Outro'&&t!=='Compra'&&t!=='Tarefa'&&t!=='Manutenção'&&t!=='Administrativo')set.add(t)});
  MT_TIPOS_EXTRA.forEach(t=>set.add(t));
  (state.events||[]).forEach(e=>{if(e.type&&e.type!=='Outro')set.add(e.type)});
  return [...set];
}

const dLongBR=iso=>{try{const [y,m,d]=iso.split('-');return d+'/'+m+'/'+y}catch(e){return iso}};
function axView(){
  const head=`<div class="screen-head"><div class="screen-title"><h1>Acessos &amp; Nuvem</h1><p>Terreiro Conectado: convide, aprove e controle quem acessa. Agenda, mensalidades, avisos e orientações.</p></div></div>`;
  if(!configured())return head+`<div class="card mtx"><h3>Acesso online não ativado</h3><p class="small muted">Esta versão do app ainda não foi conectada ao serviço online. Fale com o desenvolvedor do app.</p></div>`;
  if(!S||!MEM||MEM.papel!=='pai_mae')return head+`<div class="card mtx"><h3>Conecte a conta de Pai/Mãe da casa</h3><p class="small muted">Este aparelho usa o <b>acesso local</b>. Para convidar filhos, cambonos e consulentes você precisa da conta online do ${MT_PLANO}, que é uma conta <b>diferente</b> e é criada com um código de liberação. Os dados que você já tem neste aparelho continuam aqui.</p><div class="mtx-btns"><button class="btn primary" data-mt="connectnew">Criar conta online (tenho o código)</button><button class="btn" data-mt="connect">Já tenho conta online</button>${MT_CONTATO.whatsapp?`<span class="mtg-ask" style="margin:0"><select class="mtg-plan" aria-label="Plano"><option value="1">1 mês</option><option value="6" selected>6 meses</option><option value="12">12 meses</option></select><button class="btn" data-mt="ask" data-k="conectado">Quero assinar (WhatsApp)</button></span>`:''}</div></div>`;
  if(AX.membros===null&&!AX.err){axLoad();return head+`<div class="card mtx"><p class="small muted">Carregando…</p></div>`}
  const dias=AX.plano?Math.ceil((new Date(AX.plano+'T23:59:59')-new Date())/86400000):null;
  const planCard=`<div class="card mtx ${AX.expired?'err':dias!==null&&dias<=15?'mtx-alert':''}"><h3>Plano online ${AX.expired?'<span class="pill bad">Vencido</span>':dias!==null&&dias<=15?`<span class="pill warn">vence em ${Math.max(dias,0)} dia(s)</span>`:'<span class="pill ok">Ativo</span>'}</h3><p class="small muted">${AX.plano?(AX.expired?'Venceu em ':'Válido até ')+E(brDate(AX.plano))+'.':'Sem data de validade.'} ${AX.expired?'Com o plano vencido, filhos, cambonos e consulentes ficam sem acesso online e a agenda para de sincronizar. Seus dados continuam guardados.':'Ao vencer, o acesso online de todos é suspenso até a renovação.'}</p><div class="form-grid"><label class="full">Código de liberação para renovar<input id="rn_cod" autocapitalize="characters" autocomplete="off" maxlength="14" placeholder="MT-XXXX-XXXX" style="text-transform:uppercase"></label></div><button class="btn primary" data-mt="renovar" style="margin-top:8px">Renovar plano</button></div>`;
  if(AX.expired)return head+planCard;
  const mem=AX.membros||[],pend=mem.filter(m=>m.status==='pendente'),others=mem.filter(m=>m.status!=='pendente');
  const pays=(AX.pagamentos||[]).filter(p=>p.situacao==='enviado');
  const nameOf=id=>(mem.find(m=>m.user_id===id)||{}).nome||'Pessoa';
  const localOpts=sel=>`<option value="">— escolha a pessoa —</option>${(state.members||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')).map(x=>`<option value="${E(x.id)}" ${x.id===sel?'selected':''}>${E(x.name)}</option>`).join('')}`;
  const vincInfo=m=>{
    const L=state.members||[];
    if(!m.pessoa_local_id){const sg=acharLocal({nome:m.nome,whatsapp:m.whatsapp});return `<div class="mtx-vw warn">⚠ <b>Sem vínculo.</b> Esta pessoa não vê a mensalidade. ${sg?`Parece ser <b>${E(sg.name)}</b>. <button class="btn sm primary" data-mt="vincsug" data-u="${m.user_id}" data-p="${E(sg.id)}">Vincular</button>`:`Escolha o cadastro dela em Pessoas. <button class="btn sm primary" data-mt="focusvinc" data-u="${m.user_id}">Escolher agora</button>`}</div>`}
    const lm=L.find(x=>x.id===m.pessoa_local_id);
    if(!lm)return `<div class="mtx-vw warn">⚠ O cadastro ligado não existe mais em Pessoas. Escolha outro acima.</div>`;
    const mode=typeof memberFeeMode==='function'?memberFeeMode(lm):'Nenhuma';
    if(mode==='Isento')return `<div class="mtx-vw ok">✓ Ligada a ${E(lm.name)}. Isenta de mensalidade.</div>`;
    if(mode!=='Mensalidade')return `<div class="mtx-vw warn">✓ Ligada a ${E(lm.name)}, mas o cadastro não está como <b>Mensalidade</b>. <button class="btn sm primary" data-mt="fixpessoa" data-p="${E(lm.id)}">Corrigir mensalidade</button></div>`;
    if(!(state.settings&&state.settings.monthlyFees))return `<div class="mtx-vw warn">✓ Ligada a ${E(lm.name)}, mas a cobrança de mensalidades está desligada nas configurações. <button class="btn sm primary" data-mt="fixconfig">Abrir Configurações</button></div>`;
    const v=typeof memberFeeValue==='function'?memberFeeValue(lm):0;
    if(!(v>0))return `<div class="mtx-vw warn">✓ Ligada a ${E(lm.name)}, mas falta o <b>valor</b> da mensalidade no cadastro. <button class="btn sm primary" data-mt="fixpessoa" data-p="${E(lm.id)}">Corrigir mensalidade</button></div>`;
    return `<div class="mtx-vw ok">✓ Ligada a ${E(lm.name)}. Mensalidade ${brl(v)}.</div>`;
  };
  const semVinc=mem.filter(m=>m.status==='ativo'&&m.papel!=='pai_mae'&&m.papel!=='consulente'&&!m.pessoa_local_id).length;
  const li=m=>{
    const me=m.user_id===MEM.user_id;
    const vinc=(m.status==='ativo'&&m.papel!=='pai_mae'&&m.papel!=='consulente')?`<label class="mtx-vinc">Vínculo com Pessoas<select data-mt-vinc="${m.user_id}">${localOpts(m.pessoa_local_id)}</select></label><div class="small muted" style="margin-top:4px">Liga a conta online desta pessoa ao cadastro dela em Pessoas. É por esse vínculo que a mensalidade chega ao celular dela. Confira se é o nome certo.</div>${vincInfo(m)}`:'';
    return `<div class="mtx-row"><div class="grow"><b>${E(m.nome)}</b> ${me?'<span class="pill">você</span>':''}<div class="small muted">${E(m.funcao||MEMBERS_LABEL[m.papel])}${m.funcao&&m.papel!=='pai_mae'?' · '+E(MEMBERS_LABEL[m.papel]):''} · ${E(m.email||'')}${m.whatsapp?' · '+E(m.whatsapp):''}</div>${m.aprovado_por&&m.aprovado_por!==MEM.user_id&&m.status!=='pendente'?`<div class="small muted">${m.status==='recusado'?'Recusado':'Aprovado'} por ${E(nameOf(m.aprovado_por))}${m.aprovado_em?' · '+E(when(m.aprovado_em)):''}</div>`:''}${vinc}</div><span class="mtx-st st-${m.status}">${STATUS_LABEL[m.status]}</span>${me?'':`<div class="mtx-act">${m.status==='pendente'||m.status==='ativo'?`<button class="btn sm" data-mt="resend" data-u="${m.user_id}">Reenviar link</button>`:''}${m.status==='pendente'?`<button class="btn sm primary" data-mt="decide" data-u="${m.user_id}" data-s="ativo">Aprovar</button><button class="btn sm" data-mt="decide" data-u="${m.user_id}" data-s="recusado">Recusar</button>`:m.status==='ativo'?`${m.papel==='consulente'?`<button class="btn sm primary" data-mt="orient" data-u="${m.user_id}">Enviar orientação/banho</button>`:''}${m.papel==='filho'||m.papel==='cambono'?`<button class="btn sm" data-mt="acessos" data-u="${m.user_id}">Cargo e acessos</button>`:''}<button class="btn sm" data-mt="decide" data-u="${m.user_id}" data-s="inativo">Desativar</button>`:`<button class="btn sm" data-mt="decide" data-u="${m.user_id}" data-s="ativo">Reativar</button>`}<button class="btn sm danger" data-mt="remove" data-u="${m.user_id}">Remover</button></div>`}</div>`};
  const payRow=p=>{const m=mem.find(x=>x.user_id===p.user_id);const linked=m&&m.pessoa_local_id;return `<div class="mtx-row"><div class="grow"><b>${E(nameOf(p.user_id))}</b> <span class="pill warn">${E(compShort(p.competencia))}</span><div class="small">${brl(p.valor_centavos)}${p.forma?' · '+E(p.forma):''} · enviado ${E(when(p.criado_em))}</div>${p.observacao?`<div class="small muted">“${E(p.observacao)}”</div>`:''}${linked?'':`<div class="small" style="color:var(--red)">Falta ligar esta pessoa a um cadastro de Pessoas antes de validar. <button class="btn sm primary" data-mt="axtab" data-a="pessoas">Ligar agora</button></div>`}</div><div class="mtx-act"><button class="btn sm" data-mt="comprov" data-p="${E(p.comprovante||'')}">Ver comprovante</button><button class="btn sm primary" data-mt="validar" data-u="${p.id}" ${linked?'':'disabled'}>Validar e dar como pago</button><button class="btn sm danger" data-mt="recusarpg" data-u="${p.id}">Recusar</button></div></div>`};
  const last=SY.at;const cts=consTypes();
  const codeCard=(tipo,titulo,desc)=>`<div class="card mtx"><h3>${titulo}</h3><p class="small muted">${desc}</p><div class="mtx-code">${E(AX.codigos[tipo]||'········')}</div><div class="mtx-send"><label class="small"><b>Enviar para uma pessoa cadastrada</b></label><div class="mtx-sendrow"><input id="inv_p_${tipo}" list="inv_dl" autocomplete="off" placeholder="Buscar pelo nome em Pessoas…"><button class="btn sm primary" data-mt="sharepessoa" data-t="${tipo}">Enviar convite (WhatsApp)</button></div><p class="small muted" style="margin:6px 0 0">Ou, para quem ainda não está cadastrado (ex.: um consulente), abra o WhatsApp e escolha o contato na sua lista:</p></div><div class="mtx-btns"><button class="btn sm" data-mt="copylink" data-t="${tipo}">Copiar link de convite</button><button class="btn sm primary" data-mt="sharecode" data-t="${tipo}">Escolher contato no WhatsApp</button><button class="btn sm" data-mt="newcode" data-t="${tipo}">Gerar novo código</button></div><p class="small muted" style="margin-top:8px;word-break:break-all">${E(inviteLink(tipo))}</p></div>`;
  const recent=(AX.orient||[]).slice(0,12);
  const props=(AX.props||[]).filter(p=>p.situacao==='pendente');
  const tab=AX.tab||(pend.length?'pessoas':props.length?'agenda':pays.length?'pag':'convidar'),pf=AX.pfilter||'todos';AX._tab=tab;
  const cnt=k=>mem.filter(m=>m.status===k).length;
  const tb=(k,l,n)=>`<button type="button" class="mtx-tab ${tab===k?'on':''}" data-mt="axtab" data-a="${k}">${l}${n?` <span class="pill warn">${n}</span>`:''}</button>`;
  const tabs=acnBanner()+`<div class="mtx-tabs">${tb('convidar','Convidar')}${tb('pessoas','Pessoas',pend.length)}${tb('permissoes','Permissões')}${tb('nuvem','Módulos na nuvem')}${tb('qr','Senhas e Presença')}${tb('registro','Quem fez o quê',(FIN.pend||[]).length)}${tb('agenda','Agenda',props.length)}${tb('pag','Pagamentos',pays.length)}${tb('avisos','Avisos e orientações')}${tb('plano','Plano e sincronização')}</div>`;
  const chip=(k,l,n)=>`<button type="button" class="btn sm ${pf===k?'primary':''}" data-mt="axfilter" data-a="${k}">${l} (${n})</button>`;
  const shown=mem.filter(m=>pf==='todos'||m.status===pf).sort((x,y)=>(x.status==='pendente'?0:1)-(y.status==='pendente'?0:1));
  const T={
    convidar:()=>`${pend.length?`<div class="card mtx mtx-alert"><b>${pend.length} cadastro(s) aguardando a sua aprovação.</b> <button class="btn sm primary" data-mt="axtab" data-a="pessoas">Ver e aprovar</button></div>`:''}<div class="card mtx"><h3>Como funciona o convite</h3><ol class="mtx-steps"><li>Escolha o convite abaixo e toque em <b>Enviar convite (WhatsApp)</b>. O WhatsApp abre com a mensagem e o link prontos; escolha o contato.</li><li>A pessoa toca no link, preenche os dados e <b>cria a própria senha</b>. Você nunca vê a senha.</li><li>O cadastro chega em <b>Pessoas → Aguardando</b>. Você aprova. Para filhos e cambonos, o app liga sozinho ao cadastro em Pessoas se o nome for igual; senão ele avisa e você escolhe (isso liga a mensalidade).</li><li>Pronto: a pessoa entra e vê agenda, mensalidade e avisos. Você pode <b>desativar</b> ou <b>remover</b> o acesso quando quiser.</li></ol></div><div class="mtx-grid"><datalist id="inv_dl">${(state.members||[]).filter(x=>x.name&&!/^(Inativ|Arquiv|Desligad)/i.test(x.status||'')).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')).map(x=>`<option value="${E(x.name)}">${E(x.whatsapp||x.phone||'sem WhatsApp')}</option>`).join('')}</datalist>
   ${codeCard('equipe','Convite · Filhos e cambonos','Envie o link ou o código. A pessoa se cadastra e você aprova.')}
   ${codeCard('consulente','Convite · Consulentes','Para quem visita a casa: dias de gira, orientações e banhos. Cadastro com aprovação.')}
  </div>`,
    pessoas:()=>`<div class="card mtx"><h3>Pessoas da casa</h3><p class="small muted"><b>Aprovar</b> libera o acesso. <b>Desativar</b> suspende o acesso sem apagar nada (dá para reativar). <b>Remover</b> apaga o cadastro online; para voltar, a pessoa precisa se cadastrar de novo.</p>${semVinc?`<div class="mtx-vw warn" style="margin:8px 0">⚠ <b>${semVinc} pessoa(s) sem vínculo</b> com o cadastro em Pessoas. Elas não veem a mensalidade. Veja o aviso amarelo em cada uma.</div>`:''}<div class="mtx-btns">${chip('todos','Todos',mem.length)}${chip('pendente','Aguardando',cnt('pendente'))}${chip('ativo','Ativos',cnt('ativo'))}${chip('inativo','Desativados',cnt('inativo'))}${chip('recusado','Recusados',cnt('recusado'))}</div><div style="margin-top:8px">${shown.length?shown.map(li).join(''):'<p class="small muted">Ninguém nesta lista.</p>'}</div></div>`,
    qr:()=>qrTab(),
    registro:()=>regTab(),
    nuvem:()=>{
      const pubs=AX.areas||[],hav=a=>pubs.find(x=>x.area===a);
      const list=AREAS.map(([k,t])=>{const p=hav(k);return `<label class="mtx-ac-i"><input type="checkbox" data-mt-area="${k}" ${areaOn(k)?'checked':''}><span><b>${E(t)}</b><small>${p?'Na nuvem · atualizado em '+E(new Date(p.atualizado_em).toLocaleString('pt-BR')):'Só neste aparelho'}</small></span></label>`}).join('');
      const cur=pubs.find(x=>x.area===AX.nArea)||pubs[0];
      const chips=pubs.map(x=>{const nm=(AREAS.find(a=>a[0]===x.area)||[])[1]||x.area;return `<button type="button" class="mtx-chip ${cur&&cur.area===x.area?'on':''}" data-mt="narea" data-a="${E(x.area)}">${E(nm)}</button>`}).join('');
      let view='<p class="small muted">Nenhum módulo na nuvem ainda. Marque acima o que você quer consultar de outro aparelho.</p>';
      if(cur){const dd=cur.dados||{},cols=dd.cols||[],rw=dd.rows||[];view=`${dd.resumo?`<p class="small"><b>${E(dd.resumo)}</b></p>`:''}${rw.length?`<div class="mtx-scroll"><table class="mtx-matrix mtx-areat"><thead><tr>${cols.map(c=>`<th>${E(c)}</th>`).join('')}</tr></thead><tbody>${rw.map(r=>`<tr>${r.map(v=>`<td>${E(v==null?'':v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Nada cadastrado nesta área.</p>'}<p class="small muted">Somente leitura · cópia de ${E(new Date(cur.atualizado_em).toLocaleString('pt-BR'))}</p>`}
      return `<div class="card mtx"><h3>Módulos na nuvem</h3><p class="small muted">Escolha quais módulos do seu aparelho principal ficam disponíveis na nuvem. Assim você consulta pelo celular, ou por outro computador, entrando com a conta do Pai/Mãe, e aprova cadastros em qualquer lugar. A nuvem guarda só uma <b>cópia para consulta</b> (sem arquivos e sem dados reservados). Para cadastrar e editar, use o aparelho principal.</p><div class="mtx-ac">${list}</div><div class="mtx-act" style="margin-top:10px"><button class="btn sm primary" data-mt="areasync">Atualizar agora</button></div>${AX.areaErr?`<p class="small" style="color:#b3423a">⚠ ${E(userErr(AX.areaErr))}</p>`:''}</div>
      <div class="card mtx"><h3>Ver na nuvem</h3><div class="mtx-chips" style="margin:6px 0 12px">${chips}</div>${view}</div>`;
    },
    permissoes:()=>{
      const cl=mem.filter(m=>(m.papel==='filho'||m.papel==='cambono')&&m.status==='ativo');
      const used=new Set(),rows=[];
      ((typeof state!=='undefined'&&state.members)||[]).filter(l=>!/inativ/i.test(l.status||'')).forEach(l=>{
        const c=cl.find(m=>!used.has(m.user_id)&&acharLocal(m)===l);if(c)used.add(c.user_id);
        const src=c&&c.acessos&&Object.keys(c.acessos).length?c.acessos:(l.perms&&l.perms.acessos)||null;
        rows.push({nome:l.name,fun:(c&&c.funcao)||(l.perms&&l.perms.funcao)||l.role||'',uid:c?c.user_id:'',lid:l.id,conta:!!c,src,papel:c?c.papel:'filho'});
      });
      cl.filter(m=>!used.has(m.user_id)).forEach(c=>rows.push({nome:c.nome,fun:c.funcao||MEMBERS_LABEL[c.papel],uid:c.user_id,lid:'',conta:true,src:c.acessos&&Object.keys(c.acessos).length?c.acessos:null,papel:c.papel}));
      rows.sort((x,y)=>String(x.nome).localeCompare(String(y.nome),'pt-BR'));
      const eff=(r,k)=>{const a=r.src||{};return Object.prototype.hasOwnProperty.call(a,k)?!!a[k]:k==='internos'?true:k==='materiais'?r.papel==='cambono':false};
      const list=rows.length?rows.map(r=>{const on=ACESSOS.filter(([k])=>eff(r,k));return `<div class="mtx-prow"><div class="mtx-pw"><b>${E(r.nome)}</b><small>${E(r.fun)}</small><span class="pill ${r.conta?'ok':'warn'}">${r.conta?'Com conta online':'Ainda sem conta'}</span></div><div class="mtx-chips">${on.length?on.map(([k])=>`<span class="mtx-chip">${E(ACESSOS_CURTO[k])}</span>`).join(''):'<span class="small muted">Nenhuma função liberada</span>'}</div><button class="btn sm primary" data-mt="acessos" data-u="${E(r.uid)}" data-l="${E(r.lid)}">Permissões</button></div>`}).join(''):'<p class="small muted">Nenhuma pessoa cadastrada ainda. Cadastre em Pessoas.</p>';
      let lg='';
      let gi=0;const fun=ACESSOS.map(([k,t,d,g])=>{let h='';if(g!==lg){gi=0;h=(lg?'</div>':'')+`<div class="mtx-grp ${/^👁/.test(g)?'ver':'alt'}"><h4 class="mtx-ac-g">${E(g)}</h4>`}lg=g;gi++;return h+`<div class="mtx-fn ${gi%2?'z1':'z0'}"><b>${E(t)}</b><small>${E(d)}</small></div>`}).join('')+(lg?'</div>':'');
      return admLessonsCard()+`<div class="card mtx"><h3>Permissões por pessoa</h3><p class="small muted">Todas as pessoas cadastradas. Toque em <b>Permissões</b> para escolher o que cada uma pode ver ou fazer. Quem ainda não tem conta recebe as permissões assim que entrar pelo convite. Você, Pai/Mãe, tem todas as funções.</p>${AX.areaErr?`<p class="small" style="color:#b3423a">⚠ As áreas ainda não puderam ser publicadas: ${E(userErr(AX.areaErr))}</p>`:''}<div class="mtx-plist">${list}</div></div>
      <div class="card mtx"><h3>O que você pode liberar</h3>${fun}</div>
      <div class="card mtx"><h3>Como funciona</h3><p class="small muted">As áreas liberadas aparecem na aba <b>Áreas</b> do portal da pessoa, sempre atualizadas. Em «só ver» a pessoa apenas consulta; em «pode alterar» ela mexe, e cada mudança chega ao seu app com o nome de quem fez. Quem não tem a permissão não recebe nem os dados: o servidor bloqueia. Backup e Configurações ficam só com você.</p></div>`;
    },
    agenda:()=>{
      const LAB={criar:'Novo compromisso',editar:'Alteração',cancelar:'Cancelamento'};
      const det=d=>[d.data?dLongBR(d.data):'',d.hora?d.hora+(d.hora_fim?'–'+d.hora_fim:''):'',d.local||''].filter(Boolean).join(' · ');
      const row=p=>`<div class="mtx-row"><div class="grow"><span class="pill warn">${LAB[p.acao]}</span> <b>${E((p.dados&&p.dados.titulo)||'Compromisso')}</b><div class="small muted">${E(p.por_nome||'')} · ${E(when(p.criada_em))}</div>${p.acao!=='cancelar'?`<div class="small">${E(det(p.dados||{}))}</div>`:''}${p.dados&&p.dados.notas?`<div class="small muted">${nl(p.dados.notas)}</div>`:''}</div><div class="mtx-act"><button class="btn sm primary" data-mt="agok" data-u="${p.id}">Aprovar</button><button class="btn sm" data-mt="agno" data-u="${p.id}">Recusar</button></div></div>`;
      const HL={criou:'criou',editou:'alterou',cancelou:'cancelou'};
      const hrow=h=>`<div class="mtx-row"><div class="grow"><b>${E(h.titulo||'Compromisso')}</b><div class="small muted">${E(h.por_nome||'Alguém')} ${HL[h.acao]||E(h.acao)} · ${E(when(h.em))}</div></div></div>`;
      const dec=(AX.props||[]).filter(p=>p.situacao!=='pendente').slice(0,8);
      return `<div class="card mtx ${props.length?'mtx-alert':''}"><h3>Aguardando a sua aprovação ${props.length?`<span class="pill warn">${props.length}</span>`:''}</h3><p class="small muted">Filhos e cambonos com permissão propõem mudanças na agenda. Ao aprovar, o compromisso aparece para todos e entra na sua Agenda.</p>${props.length?props.map(row).join(''):'<p class="small muted">Nenhuma alteração aguardando.</p>'}</div>${dec.length?`<div class="card mtx"><h3>Decididas recentemente</h3>${dec.map(p=>`<div class="mtx-row"><div class="grow"><b>${E((p.dados&&p.dados.titulo)||'Compromisso')}</b><div class="small muted">${E(p.por_nome||'')} · ${LAB[p.acao]} · ${p.situacao==='aprovada'?'aprovada':'recusada'}${p.motivo?' ('+E(p.motivo)+')':''}</div></div></div>`).join('')}</div>`:''}<div class="card mtx"><h3>Histórico da agenda</h3><p class="small muted">Quem criou, alterou ou cancelou compromissos pelo app, do mais recente para o mais antigo.</p>${(AX.hist||[]).length?AX.hist.map(hrow).join(''):'<p class="small muted">Ainda não há alterações feitas pelo app.</p>'}</div>`;
    },
    pag:()=>`<div class="card mtx ${pays.length?'mtx-alert':''}"><h3>Pagamentos para validar ${pays.length?`<span class="pill warn">${pays.length}</span>`:''}</h3>${pays.length?pays.map(payRow).join(''):'<p class="small muted">Nenhum comprovante aguardando. Quando um filho enviar, aparece aqui e no menu.</p>'}</div>`,
    avisos:()=>`<div class="card mtx"><h3>Avisos</h3>
    <div class="form-grid"><label class="full">Título<input id="av_t" maxlength="140"></label><label class="full">Mensagem<textarea id="av_x" rows="3" maxlength="4000"></textarea></label>
    <div class="full"><span class="small"><b>Para quem aparece</b></span><div class="mtx-types"><label class="mtx-chk"><input type="checkbox" id="av_pf" checked> Filhos</label><label class="mtx-chk"><input type="checkbox" id="av_pc" checked> Cambonos</label><label class="mtx-chk"><input type="checkbox" id="av_pn"> Consulentes</label></div></div>
    <label>Aparece a partir de <span class="small muted">(opcional)</span><input type="datetime-local" id="av_de"></label><label>Some em <span class="small muted">(opcional)</span><input type="datetime-local" id="av_ate"></label>
    <div class="full mtx-types"><label class="mtx-chk"><input type="checkbox" id="av_fix"> Fixar no topo do quadro</label></div></div>
    <p class="small muted">O quadro de avisos só aparece para a pessoa enquanto houver aviso ativo para ela. Passou da data de "Some em", ele sai sozinho.</p>
    <button class="btn primary" data-mt="aviso">Publicar aviso</button>
    <div style="margin-top:14px">${(AX.avisos||[]).map(a=>`<div class="mtx-row"><div class="grow"><b>${E(a.titulo)}</b><div class="small muted">${avStatus(a)}${a.fixado?' · 📌 fixado':''} · ${E(when(a.criado_em))} · ${E((a.publico||[]).map(x=>MEMBERS_LABEL[x]).join(', '))}</div><div class="small">${nl(a.texto)}</div></div><button class="btn sm danger" data-mt="delaviso" data-u="${a.id}" aria-label="Apagar">×</button></div>`).join('')||'<p class="small muted">Nenhum aviso publicado.</p>'}</div></div><div class="card mtx"><h3>Orientações e banhos enviados</h3>${recent.length?recent.map(o=>`<div class="mtx-row"><div class="grow"><b>${o.tipo==='banho'?'🌿 ':''}${E(o.titulo)}</b><div class="small muted">Para ${E(nameOf(o.user_id))} · ${E(when(o.criada_em))} · ${o.lida_em?'lida':'não lida'}</div></div><button class="btn sm danger" data-mt="delorient" data-u="${o.id}" aria-label="Apagar">×</button></div>`).join(''):'<p class="small muted">Nada enviado ainda. Em Pessoas com acesso, use “Enviar orientação/banho” em um consulente.</p>'}</div>`,
    plano:()=>`${planCard}<div class="card mtx"><h3>Agenda e mensalidades · sincronização automática</h3><p class="small muted">Ao salvar um compromisso ou registrar uma mensalidade neste app, a nuvem é atualizada sozinha e todos veem. Use sempre o mesmo aparelho principal para administrar.</p>
    <p class="small"><b>${SY.busy?'Sincronizando…':SY.err?'Falha: '+E(userErr(SY.err)):last?'Sincronizado em '+E(when(last)):'Ainda não sincronizado'}</b></p>
    <div class="mtx-types"><span class="small muted">Tipos de compromisso abertos a consulentes:</span>${eventTypes().map(t=>`<label class="mtx-chk"><input type="checkbox" data-mt-ctype="${E(t)}" ${cts.map(x=>String(x).toLowerCase()).includes(String(t).toLowerCase())?'checked':''}> ${E(t)}</label>`).join('')}</div>
    <div class="mtx-newtype"><label class="small"><b>Criar um novo tipo de compromisso</b> <span class="muted">(ex.: Mutirão, Passeio, Feijoada)</span></label><div class="mtx-sendrow"><input id="nt_name" maxlength="40" placeholder="Nome do tipo"><label class="mtx-chk"><input type="checkbox" id="nt_open"> Aberto a consulentes</label><button class="btn sm primary" data-mt="addtype">Adicionar</button></div></div>
    <button class="btn" data-mt="publish" ${SY.busy?'disabled':''}>Sincronizar agora</button></div><div class="card mtx"><h3>Conta online</h3><p class="small muted">${E(MEM.nome)} · ${E(S.user.email)} · casa ${E(MEM.casas?.nome||'')}</p><div class="mtx-btns"><button class="btn sm" data-mt="chpass">Alterar senha</button><button class="btn sm danger" data-mt="logout">Sair da conta online</button></div></div>`
  };
  return head+(AX.err?`<div class="card mtx err">${E(userErr(AX.err))} <button class="btn sm" data-mt="axreload">Tentar de novo</button></div>`:'')+tabs+(T[tab]||T.convidar)();
}
function axPaint(){const v=document.getElementById('view');if(v&&route==='access'){const y=window.scrollY;v.innerHTML=axView();window.scrollTo(0,y)}}

async function validarPagamento(id,btn){
  const p=(AX.pagamentos||[]).find(x=>x.id===id),m=(AX.membros||[]).find(x=>x.user_id===p?.user_id);
  if(!p||!m||!m.pessoa_local_id){toast('⚠ Vincule a pessoa a um cadastro de Pessoas antes de validar.');return}
  const pessoa=(state.members||[]).find(x=>x.id===m.pessoa_local_id);
  if(!pessoa){toast('⚠ O cadastro vinculado não existe mais em Pessoas. Refaça o vínculo.');return}
  if(!confirm('Validar o pagamento de '+brl(p.valor_centavos)+' de '+m.nome+' ('+compShort(p.competencia)+')?\nO Financeiro lança como Recebido e a pessoa é avisada.'))return;
  busy(btn,true,'Validando…');
  try{
    state.settings.cloudPaid=state.settings.cloudPaid||{};
    if(!state.settings.cloudPaid[id]){
      const nota='Validado pelo app a partir do comprovante enviado em '+brDate(String(p.criado_em).slice(0,10))+'.';
      let tx=(state.transactions||[]).find(t=>t.personId===pessoa.id&&t.category==='Mensalidade'&&t.type==='Receita'&&t.competence===p.competencia&&t.status!=='Recebido'&&t.status!=='Cancelado');
      if(tx){Object.assign(tx,{status:'Recebido',date:today(),value:p.valor_centavos,payment:p.forma||tx.payment||'',notes:(tx.notes?tx.notes+'\n':'')+nota})}
      else{
        const rx=p.forma?new RegExp(String(p.forma).replace(/[^a-zA-Z]/g,''),'i'):null;
        const acc=(rx&&(state.accounts||[]).find(a=>rx.test(a.name)))||(state.accounts||[])[0];
        tx={id:uid('t'),type:'Receita',date:today(),dueDate:(typeof mtFeeDueDate==='function'?mtFeeDueDate(pessoa,p.competencia):'')||'',competence:p.competencia,status:'Recebido',description:'Contribuição mensal · '+pessoa.name,category:'Mensalidade',subcategory:'',center:(state.settings.costCenters&&state.settings.costCenters[0])||'Administração',fundId:'',accountId:acc?acc.id:'',fromAccount:'',toAccount:'',value:p.valor_centavos,personId:pessoa.id,eventId:'',payment:p.forma||'',notes:nota};
        state.transactions.push(tx);
      }
      state.settings.cloudPaid[id]=tx.id;
      audit('Financeiro','Mensalidade validada pelo comprovante',pessoa.name);
      await persist();
    }
    await api.rpc('mt_decidir_pagamento',{p_id:id,p_situacao:'validado'});
    toast('✓ Pagamento validado. '+m.nome.split(' ')[0]+' foi avisado(a).');
    await syncAll(true);await axLoad();
  }catch(e){toast('⚠ '+userErr(e.message))}finally{busy(btn,false)}
}
async function verComprovante(path){
  if(!path){toast('Sem arquivo.');return}
  try{
    const b=await api.download(path),u=URL.createObjectURL(b);
    const body=b.type==='application/pdf'?`<iframe src="${u}" style="width:100%;height:70vh;border:0" title="Comprovante"></iframe>`:`<img src="${u}" alt="Comprovante de pagamento" style="max-width:100%;max-height:70vh;display:block;margin:auto;border-radius:10px">`;
    showModal('Comprovante',body,`<a class="btn" href="${u}" download="comprovante">Baixar</a><button class="btn primary" data-action="close-modal">Fechar</button>`,true);
  }catch(e){toast('⚠ '+userErr(e.message))}
}
const GR_NAME='👁 SÓ VER · Áreas do app (consulta no portal da pessoa)';
const ACESSOS=[
 ["internos", "Ver compromissos internos da casa", "Só ver. Reuniões, ensaios, mutirões e outros compromissos que não são giras abertas ao público. Sem isso, a pessoa vê só as giras abertas.", "👁 SÓ VER · a pessoa consulta, não altera nada"],
 ["materiais", "Ver materiais dos trabalhos", "Só ver. A lista de materiais e itens que cada gira ou trabalho vai usar (velas, ervas, bebidas…). Indicado para cambonos e quem prepara o material.", "👁 SÓ VER · a pessoa consulta, não altera nada"],
 ["agenda_editar", "Criar e editar compromissos na agenda", "Pode alterar. A pessoa cria, muda e cancela compromissos e giras, pelo celular dela. Se a opção abaixo estiver desmarcada, cada mudança espera a sua aprovação.", "✏️ PODE ALTERAR · Agenda e giras"],
 ["agenda_direto", "Publicar na agenda sem aprovação", "Pode alterar. Desmarcado: toda mudança fica pendente até você aprovar. Marcado: aparece para todos na hora. Só vale se a opção acima estiver marcada.", "✏️ PODE ALTERAR · Agenda e giras"],
 ["convites", "Enviar convites", "Pode agir. Vê o link e o código de convite (filhos, cambonos e consulentes) e envia pelo WhatsApp. Não consegue trocar o código.", "✏️ PODE ALTERAR · Convites e cadastros"],
 ["cadastros", "Validar novos cadastros", "Pode agir. Aprova ou recusa quem se cadastrou pelo convite. Não remove ninguém nem muda o acesso de outras pessoas.", "✏️ PODE ALTERAR · Convites e cadastros"],
 ["estoque_editar", "Estoque: dar entrada, saída e cadastrar itens", "Pode alterar. A pessoa dá entrada e saída, ajusta a quantidade e cadastra item novo, pelo celular. Tudo fica registrado com o nome dela e você é avisado quando algo está acabando. Também libera ver o estoque.", "✏️ PODE ALTERAR · Estoque"],
 ["fin_pagar_ver", "Contas a pagar · ver", "Só ver. Vê as contas a pagar (despesas) e se estão pagas. Não lança nem dá baixa.", "👁 SÓ VER · Financeiro por parte"],
 ["fin_receber_ver", "Contas a receber · ver", "Só ver. Vê doações, vendas e outros valores a receber. Não lança nem dá baixa.", "👁 SÓ VER · Financeiro por parte"],
 ["fin_mensal_ver", "Mensalidades · ver", "Só ver. Vê quem pagou e quem está em aberto. Não dá baixa.", "👁 SÓ VER · Financeiro por parte"],
 ["fin_saldo", "Saldo do caixa · ver", "Só ver. Mostra quanto entrou, saiu e o saldo. Dado delicado: dê só a quem precisa.", "👁 SÓ VER · Financeiro por parte"],
 ["fin_pagar", "Contas a pagar · lançar e dar baixa", "Pode alterar. Lança despesas, marca como paga e cancela (com motivo). Nada é apagado. Também libera ver essa parte.", "✏️ PODE ALTERAR · Financeiro (tesouraria)"],
 ["fin_receber", "Contas a receber · lançar e dar baixa", "Pode alterar. Lança doações e outros valores, marca como recebida e cancela (com motivo). Também libera ver essa parte.", "✏️ PODE ALTERAR · Financeiro (tesouraria)"],
 ["fin_mensal", "Mensalidades · lançar e dar baixa", "Pode alterar. Registra mensalidade recebida e dá baixa nas em aberto. Não mexe nas outras partes. Também libera ver essa parte.", "✏️ PODE ALTERAR · Financeiro (tesouraria)"],
 ["pessoas_editar", "Pessoas: cadastrar e atualizar (secretaria)", "Pode alterar. Cadastra gente nova e atualiza nome, função, telefone, WhatsApp, nascimento e situação. Endereço, documentos e mensalidade ficam só com você. Também libera ver Pessoas.", "✏️ PODE ALTERAR · Organização da casa (equipe)"],
 ["fornecedores_editar", "Fornecedores: cadastrar e atualizar", "Pode alterar. Cadastra fornecedores e atualiza contatos, categoria e observações. Também libera ver Fornecedores.", "✏️ PODE ALTERAR · Organização da casa (equipe)"],
 ["patrimonio_editar", "Patrimônio: cadastrar e atualizar bens", "Pode alterar. Cadastra bens e atualiza local, condição, código e valor. Também libera ver Patrimônio.", "✏️ PODE ALTERAR · Organização da casa (equipe)"],
 ["documentos_editar", "Documentos: registrar", "Pode alterar. Registra título, categoria, data e observações de documentos. Não envia nem vê os arquivos. Também libera ver Documentos.", "✏️ PODE ALTERAR · Organização da casa (equipe)"],
 ["comunicacao_editar", "Comunicação: programar mensagens", "Pode alterar. Escreve mensagens programadas para os irmãos. Quem envia é você. Também libera ver Comunicação.", "✏️ PODE ALTERAR · Organização da casa (equipe)"],
 ["trabalhos_editar", "Trabalhos espirituais: ajustar", "Pode alterar. Ajusta data, hora, local, responsável e observações dos trabalhos. Valores e itens ficam com você. Também libera ver Trabalhos.", "✏️ PODE ALTERAR · Organização da casa (equipe)"],
 ["festas_editar", "Festas e eventos: cadastrar e ajustar", "Pode alterar. Cadastra festas e eventos e ajusta data, hora, local e observações. Também libera ver Festas.", "✏️ PODE ALTERAR · Organização da casa (equipe)"],
 ["pessoas", "Pessoas", "Lista de cadastrados da casa, sem dados reservados (como endereço e documentos). Só consulta. Para a pessoa alterar, marque a opção «pode alterar» deste módulo, mais abaixo.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["financeiro", "Financeiro", "Cópia completa e só para consulta (resumo de lançamentos). Para a tesouraria trabalhar, use as opções «Financeiro por parte» acima: elas mostram ao vivo só o que você liberar.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["estoque", "Estoque & Compras", "Itens, quantidades e o que está baixo, ao vivo. Só ver: para dar entrada e saída marque também a opção «Estoque: dar entrada, saída…» (acima).", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["fornecedores", "Fornecedores", "Lista de fornecedores e contatos. Só consulta. Para a pessoa alterar, marque a opção «pode alterar» deste módulo, mais abaixo.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["patrimonio", "Patrimônio", "Bens da casa e onde estão guardados. Só consulta. Para a pessoa alterar, marque a opção «pode alterar» deste módulo, mais abaixo.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["documentos", "Documentos", "Lista de documentos da casa (títulos e datas, sem os arquivos). Só consulta. Para a pessoa alterar, marque a opção «pode alterar» deste módulo, mais abaixo.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["comunicacao", "Comunicação", "Mensagens e comunicados da casa. Só consulta. Para a pessoa alterar, marque a opção «pode alterar» deste módulo, mais abaixo.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["trabalhos", "Trabalhos Espirituais", "Trabalhos agendados e realizados. Só consulta. Para a pessoa alterar, marque a opção «pode alterar» deste módulo, mais abaixo.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["festas", "Festas & Eventos", "Festas e eventos da casa. Só consulta. Para a pessoa alterar, marque a opção «pode alterar» deste módulo, mais abaixo.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"],
 ["relatorios", "Relatórios", "Resumo com os principais números da casa. Só consulta.", "👁 SÓ VER · Áreas do app (consulta no portal da pessoa)"]
];
const AREAS=ACESSOS.filter(a=>a[3]===GR_NAME).map(a=>[a[0],a[1]]);
const ACESSOS_CURTO={internos:'Ver internos',materiais:'Ver materiais',agenda_editar:'Editar agenda',agenda_direto:'Publicar direto',convites:'Enviar convites',cadastros:'Validar cadastros',pessoas:'Pessoas',financeiro:'Financeiro',estoque:'Estoque & Compras',estoque_editar:'Mexer no estoque',fin_pagar_ver:'Ver contas a pagar',fin_pagar:'Lançar contas a pagar',fin_receber_ver:'Ver contas a receber',fin_receber:'Lançar contas a receber',fin_mensal_ver:'Ver mensalidades',fin_mensal:'Lançar mensalidades',fin_saldo:'Ver saldo',pessoas_editar:'Alterar Pessoas',fornecedores_editar:'Alterar Fornecedores',patrimonio_editar:'Alterar Patrimônio',documentos_editar:'Alterar Documentos',comunicacao_editar:'Alterar Comunicação',trabalhos_editar:'Alterar Trabalhos',festas_editar:'Alterar Festas',fornecedores:'Fornecedores',patrimonio:'Patrimônio',documentos:'Documentos',comunicacao:'Comunicação',trabalhos:'Trabalhos Espirituais',festas:'Festas & Eventos',relatorios:'Relatórios'};
const AREAS_OFF=Object.fromEntries(AREAS.map(a=>[a[0],false]));
const ACESSOS_PADRAO=f=>{const x=String(f||'').toLowerCase();const mat=/pequen|dirigente|ialorix|babalorix|iyaegb|babaegb|ialax|babalax|diretoria|cambono|zelador|ekedi|ogã|ogan|axogum|alabê|tesouraria|secretaria/.test(x);const ed=/pequen|dirigente|ialorix|babalorix|secretaria|diretoria/.test(x),dir=/pequen|dirigente|ialorix|babalorix/.test(x);const tes=/tesour/.test(x),sec=/secretar/.test(x),est=/zelador|ekedi|cambono/.test(x);return Object.assign({},AREAS_OFF,{internos:true,materiais:mat,agenda_editar:ed,agenda_direto:dir,convites:false,cadastros:false,financeiro:tes||dir,pessoas:sec||dir,documentos:sec||dir,comunicacao:sec||dir,estoque:est||tes||dir,fornecedores:tes||dir,patrimonio:dir,trabalhos:dir,festas:ed,relatorios:dir||tes})};
function acessosModal(uid_,lid_){
  const c=uid_?(AX.membros||[]).find(x=>x.user_id===uid_):null;
  const l=lid_?((state.members||[]).find(x=>x.id===lid_)||null):(c?acharLocal(c):null);
  if(!c&&!l)return;
  const nome=c?c.nome:l.name,papel=c?c.papel:(/cambon/i.test(l.role||'')?'cambono':'filho');
  const src=c&&c.acessos&&Object.keys(c.acessos).length?c.acessos:(l&&l.perms&&l.perms.acessos)||{};
  const fun0=(c&&c.funcao)||(l&&l.perms&&l.perms.funcao)||'';
  const cur=Object.assign({internos:true,materiais:papel==='cambono',agenda_editar:false,agenda_direto:false,convites:false,cadastros:false},AREAS_OFF,src);
  let lastG='';const acHtml=ACESSOS.map(([k,t,d,g])=>{const h=g!==lastG?`<h4 class="mtx-ac-g">${E(g)}</h4>`:'';lastG=g;return h+`<label class="mtx-ac-i"><input type="checkbox" id="ac_${k}" ${cur[k]?'checked':''}><span><b>${t}</b><small>${d}</small></span></label>`}).join('');
  const opts=`<option value="">— sem função definida —</option>`+MT_ROLE_GROUPS.map(([g,ls_])=>`<optgroup label="${E(g)}">${ls_.map(x=>`<option ${x===fun0?'selected':''}>${E(x)}</option>`).join('')}</optgroup>`).join('');
  showModal('Permissões · '+nome,`<p class="small muted">${c?'Esta pessoa já tem conta online: as mudanças valem na hora.':'Esta pessoa ainda não tem conta online. As permissões ficam salvas e passam a valer quando ela entrar pelo convite.'}</p><div class="form-grid"><label class="full">Função na casa<select id="ac_fun">${opts}</select></label></div><div class="mtx-leg"><b>Como ler esta tela</b><ul><li><b>👁 SÓ VER:</b> a pessoa só consulta. Não consegue criar, mudar nem apagar nada.</li><li><b>✏️ PODE ALTERAR:</b> a pessoa muda coisas de verdade (agenda e giras, convites, cadastros). Dê com cuidado.</li><li>Estoque, financeiro e as outras <b>áreas</b> ficam só para consulta no portal. A administração delas continua com o Pai/Mãe.</li><li><b>🎓 Aulas:</b> cada permissão liberada abre automaticamente a aula correspondente no app da pessoa.</li></ul></div><div class="mtx-ac">${acHtml}</div><p class="small muted">Ao escolher uma função, as permissões sugeridas são marcadas; você pode ajustar. Convites e cadastros nunca vêm marcados: só você libera.</p>`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-mt="acessossave" data-u="${E(uid_||'')}" data-l="${E(lid_||(l?l.id:''))}">Salvar</button>`);
  const f=document.getElementById('ac_fun'),ed=document.getElementById('ac_agenda_editar'),di=document.getElementById('ac_agenda_direto');
  const sync=()=>{di.disabled=!ed.checked;if(!ed.checked)di.checked=false};sync();ed.addEventListener('change',sync);
  {const ee=document.getElementById('ac_estoque_editar'),ev=document.getElementById('ac_estoque');if(ee&&ev)ee.addEventListener('change',()=>{if(ee.checked)ev.checked=true});[['fin_pagar','fin_pagar_ver'],['fin_receber','fin_receber_ver'],['fin_mensal','fin_mensal_ver'],['pessoas_editar','pessoas'],['fornecedores_editar','fornecedores'],['patrimonio_editar','patrimonio'],['documentos_editar','documentos'],['comunicacao_editar','comunicacao'],['trabalhos_editar','trabalhos'],['festas_editar','festas']].forEach(([a,b])=>{const x=document.getElementById('ac_'+a),y=document.getElementById('ac_'+b);if(x&&y)x.addEventListener('change',()=>{if(x.checked)y.checked=true})})}
  f.addEventListener('change',()=>{const p=ACESSOS_PADRAO(f.value);ACESSOS.forEach(([k])=>{document.getElementById('ac_'+k).checked=!!p[k]});sync()});
}
function orientModal(uid_){
  const m=(AX.membros||[]).find(x=>x.user_id===uid_);if(!m)return;
  showModal('Enviar para '+m.nome,`<div class="form-grid"><label>Tipo<select id="or_tipo"><option value="orientacao">Orientação</option><option value="banho">Banho</option><option value="outro">Outro</option></select></label><label class="full">Título<input id="or_t" maxlength="140" placeholder="Ex.: Banho de ervas para a semana"></label><label class="full">Orientação / explicação<textarea id="or_x" rows="4" maxlength="4000"></textarea></label><label class="full">Itens (ervas, materiais) <span class="small muted">— opcional</span><textarea id="or_i" rows="2" maxlength="2000"></textarea></label><label class="full">Modo de uso <span class="small muted">— opcional</span><textarea id="or_m" rows="2" maxlength="2000"></textarea></label></div><p class="small muted">Só esta pessoa vê este conteúdo, e ela é avisada ao abrir o app.</p>`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-mt="orientsend" data-u="${E(uid_)}">Enviar</button>`,true);
}

/* ------------------------------------------------------ PORTAL (filho / cambono / consulente) -- */
const PT={tab:'inicio',cursor:today().slice(0,7),day:today(),data:null,offline:false,loading:false,pay:false,evf:null,lastLoad:0,notifIds:null};
function closePortal(){const p=document.getElementById('mtPortal');if(p)p.remove()}
const isCons=()=>MEM&&MEM.papel==='consulente';
async function openPortal(p){
  closeGate();document.body.classList.add('mt-portal');stopTimers();
  MEM=p;PT.tab='inicio';PT.cursor=today().slice(0,7);PT.day=today();PT.pay=false;PT.notifIds=null;
  const c=jget(K.cache);PT.data=c&&c.user===p.user_id?c:null;PT.offline=false;
  let el=document.getElementById('mtPortal');if(!el){el=document.createElement('div');el.id='mtPortal';document.body.appendChild(el)}
  portalPaint();portalLoad();
  TIMERS.push(setInterval(()=>{if(document.visibilityState==='visible'&&!PT.pay&&!PT.evf)portalLoad(true)},60000));
}
function shiftDays(s,n){const [y,m,d]=s.split('-').map(Number);return iso(new Date(y,m-1,d+n))}
async function portalLoad(quiet){
  if(PT.loading||PT.evf)return;
  PT.loading=true;if(!quiet)portalPaint();else portalRefreshBtn();
  try{
    const t0=shiftDays(today(),-45),cons=isCons();
    const calls=[api.select('eventos','select=*&data=gte.'+t0+'&order=data.asc,hora.asc&limit=600'),api.select('avisos','select=*&order=criado_em.desc&limit=40'),api.select('notificacoes','select=*&order=criada_em.desc&limit=30')];
    calls.push(cons?api.select('orientacoes','select=*&order=criada_em.desc&limit=60'):api.select('eventos_filhos','select=*'));
    if(!cons)calls.push(api.select('mensalidades','select=*&order=competencia.desc&limit=24'),api.select('pagamentos','select=*&order=criado_em.desc&limit=24'));
    if(canMat())calls.push(api.select('eventos_equipe','select=*'));
    if(canAgenda())calls.push(api.select('agenda_propostas','select=*&order=criada_em.desc&limit=15'));
    const r=await Promise.all(calls);
    const map=arr=>{const o={};(arr||[]).forEach(x=>o[x.evento_id]=x);return o};
    const fil=cons?{}:map(r[3]),orient=cons?r[3]:[];
    const mens=cons?[]:r[4],pags=cons?[]:r[5];
    const eq=canMat()?map(r[6]):{};
    const props=canAgenda()?(r[canMat()?7:6]||[]):[];
    const p=await fetchProfile();
    if(p){MEM=Object.assign({},MEM,p);cacheProfile(MEM);if(p.status!=='ativo'){stopTimers();closePortal();document.body.classList.remove('mt-portal');PT.loading=false;screen(p.status==='pendente'?'pending':'blocked');return}}
    if(planExpired(MEM)){stopTimers();closePortal();document.body.classList.remove('mt-portal');PT.loading=false;screen('suspenso');return}
    const notifs=r[2];
    if(PT.notifIds){const nw=notifs.filter(n=>!n.lida_em&&!PT.notifIds.has(n.id));if(nw.length)toast('🔔 '+nw[0].titulo)}
    PT.notifIds=new Set(notifs.map(n=>n.id));
    let codes=null,pend=null;
    if(canConv()){try{codes={equipe:await api.rpc('mt_codigo_da_casa',{p_tipo:'equipe'}),consulente:await api.rpc('mt_codigo_da_casa',{p_tipo:'consulente'})}}catch(e){codes=null}}
    if(canCad()){try{pend=await api.rpc('mt_pendentes')}catch(e){pend=null}}
    let areas=[];if(canAreas()){try{areas=await api.select('areas_publicadas','select=area,dados,atualizado_em')}catch(e){areas=(PT.data&&PT.data.areas)||[]}}
    PT.data={areas,user:MEM.user_id,eventos:r[0],avisos:r[1],notifs,filhos:fil,orient,mens,pags,equipe:eq,props,codes,pend,at:new Date().toISOString()};
    ls.set(K.cache,JSON.stringify(PT.data));PT.offline=false;PT.lastLoad=Date.now();
  }catch(e){
    if(e.code==='nosession'||e.status===401){stopTimers();closePortal();document.body.classList.remove('mt-portal');saveS(null);PT.loading=false;screen('login',MEM?.papel||'filho');showErr('Sua sessão expirou. Entre novamente.');return}
    PT.offline=true;PT.err=e.message;
  }
  PT.loading=false;if(!PT.pay)portalPaint();else portalRefreshBtn();
  maybeTour();
  if(PT.tab==='inicio'||PT.tab==='orient')markRead();
}
function portalRefreshBtn(){const b=document.querySelector('#mtPortal .ptl-ref');if(b){b.disabled=PT.loading;b.textContent=PT.loading?'…':'↻'}}
let markT=null;
function markRead(){
  const d=PT.data;if(!d)return;
  const un=(d.notifs||[]).some(n=>!n.lida_em),uo=(d.orient||[]).some(o=>!o.lida_em)&&PT.tab==='orient';
  if(!un&&!uo)return;
  clearTimeout(markT);markT=setTimeout(async()=>{
    try{
      if((d.notifs||[]).some(n=>!n.lida_em))await api.rpc('mt_marcar_lidas');
      if(PT.tab==='orient'&&(d.orient||[]).some(o=>!o.lida_em))await api.rpc('mt_marcar_orientacoes_lidas');
      const t=new Date().toISOString();
      (d.notifs||[]).forEach(n=>{n.lida_em=n.lida_em||t});
      if(PT.tab==='orient')(d.orient||[]).forEach(o=>{o.lida_em=o.lida_em||t});
      ls.set(K.cache,JSON.stringify(d));
    }catch(e){}
  },2500);
}
function evCard(e,d){
  const x=(d.equipe||{})[e.id],f=(d.filhos||{})[e.id];
  return `<div class="ptl-ev"><div class="ptl-date"><b>${e.data.slice(8,10)}</b><small>${WD[new Date(e.data+'T12:00:00').getDay()]}</small></div><div class="grow"><b>${E(e.titulo)}</b>${e.tipo?` <span class="pill">${E(e.tipo)}</span>`:''}${e.status&&e.status!=='Confirmado'?` <span class="pill warn">${E(e.status)}</span>`:''}<div class="small muted">${E(hh(e.hora,e.hora_fim))}${e.local?' · '+E(e.local):''}</div>${f&&f.notas?`<div class="small">${nl(f.notas)}</div>`:''}${x&&x.materiais?`<div class="ptl-mat"><b>Materiais:</b> ${nl(x.materiais)}</div>`:''}${x&&x.responsavel?`<div class="small muted">Responsável: ${E(x.responsavel)}</div>`:''}${PT.tab==='agenda'&&canAgenda()?`<div class="mtx-btns"><button class="btn sm" data-mt="evedit" data-a="${e.id}">Editar</button><button class="btn sm danger" data-mt="evcancel" data-a="${e.id}">Cancelar compromisso</button></div>`:''}</div></div>`;
}
function avStatus(a){const n=Date.now();if(a.visivel_de&&new Date(a.visivel_de).getTime()>n)return '<span class="pill">Agendado · aparece '+E(when(a.visivel_de))+'</span>';if(a.visivel_ate&&new Date(a.visivel_ate).getTime()<=n)return '<span class="pill warn">Expirado</span>';return '<span class="pill ok">No quadro'+(a.visivel_ate?' até '+E(when(a.visivel_ate)):'')+'</span>'}
const avActive=(list)=>(list||[]).filter(a=>inWindow(a)).sort((x,y)=>(y.fixado?1:0)-(x.fixado?1:0)||String(y.criado_em).localeCompare(String(x.criado_em)));
const avCard=a=>`<div class="ptl-av ${a.fixado?'pin':''}"><b>${a.fixado?'📌 ':''}${E(a.titulo)}</b><div class="small muted">${E(when(a.criado_em))}${a.visivel_ate?' · até '+E(when(a.visivel_ate)):''}</div><div>${nl(a.texto)}</div></div>`;
function ptTypes(){const set=new Set(['Gira','Reunião','Festa','Evento']);((PT.data&&PT.data.eventos)||[]).forEach(e=>{if(e.tipo)set.add(e.tipo)});return [...set]}
function evForm(){
  const f=PT.evf,d=f.d||{};
  return `<h2 class="ptl-h">${f.id?'Editar compromisso':'Novo compromisso'}</h2><div class="ptl-sec"><div class="form-grid">
    <label class="full">Título<input id="ev_t" maxlength="200" value="${E(d.titulo||'')}"></label>
    <label>Tipo<select id="ev_tp">${ptTypes().map(x=>`<option ${x===d.tipo?'selected':''}>${E(x)}</option>`).join('')}</select></label>
    <label>Data<input id="ev_d" type="date" value="${E(d.data||PT.day||today())}"></label>
    <label>Início<input id="ev_h" type="time" value="${E(d.hora||'')}"></label>
    <label>Fim<input id="ev_f" type="time" value="${E(d.hora_fim||'')}"></label>
    <label class="full">Local<input id="ev_l" maxlength="200" value="${E(d.local||'')}"></label>
    <label class="full">Observações<textarea id="ev_n" rows="3" maxlength="4000">${E(d.notas||'')}</textarea></label></div>
    <p class="small muted">${canDireto()?'Ao salvar, o compromisso aparece para todos.':'Ao salvar, a alteração vai para a aprovação do Pai/Mãe da casa e só aparece para todos depois.'}</p>
    <div id="mtEvMsg" class="small" style="color:#a84c47"></div>
    <div class="mtx-btns"><button class="btn primary" data-mt="evsave">Salvar</button><button class="btn" data-mt="evback">Voltar</button></div></div>`;
}
function evFind(id){return ((PT.data&&PT.data.eventos)||[]).find(e=>e.id===id)}
async function evSave(btn,acao){
  const f=PT.evf;if(!f)return;
  const bad=t=>{const m=document.getElementById('mtEvMsg');if(m)m.textContent=t};
  let dados;
  if(acao==='cancelar'){const e=evFind(f.id);dados={titulo:e?e.titulo:''}}
  else{
    dados={titulo:val('ev_t'),tipo:val('ev_tp'),data:val('ev_d'),hora:val('ev_h'),hora_fim:val('ev_f'),local:val('ev_l'),notas:val('ev_n')};
    if(dados.titulo.length<2)return bad('Título: informe o nome do compromisso.');
    if(!dados.data)return bad('Data: escolha o dia do compromisso.');
  }
  busy(btn,true,'Salvando…');
  try{
    const r=await api.rpc('mt_agenda_salvar',{p_acao:acao,p_evento:f.id||null,p_dados:dados});
    PT.evf=null;
    toast(r==='aplicado'?'✓ Salvo. Já aparece para todos.':'✓ Enviado para a aprovação do Pai/Mãe da casa.');
    await portalLoad(true);portalPaint();
  }catch(er){bad(er.message);if(acao==='cancelar'){PT.evf=null;toast('⚠ '+userErr(er.message))}}finally{busy(btn,false)}
}
const canConv=()=>!!MEM&&(MEM.papel==='filho'||MEM.papel==='cambono')&&!!(MEM.acessos&&MEM.acessos.convites);
const canAreas=()=>!!MEM&&(MEM.papel==='filho'||MEM.papel==='cambono')&&(AREAS.some(([k])=>MEM.acessos&&MEM.acessos[k]===true)||hasFin());
const areaOkList=()=>AREAS.filter(([k])=>MEM.acessos[k]===true||(k==='financeiro'&&hasFin()));
const canCad=()=>!!MEM&&(MEM.papel==='filho'||MEM.papel==='cambono')&&!!(MEM.acessos&&MEM.acessos.cadastros);
function canAgenda(){return !!MEM&&(MEM.papel==='filho'||MEM.papel==='cambono')&&!!(MEM.acessos&&MEM.acessos.agenda_editar)}
function canDireto(){return canAgenda()&&!!MEM.acessos.agenda_direto}
function canMat(){return !!MEM&&(MEM.papel==='pai_mae'||(MEM.acessos&&Object.prototype.hasOwnProperty.call(MEM.acessos,'materiais')?!!MEM.acessos.materiais:MEM.papel==='cambono'))}
function portalTabsDef(){
  const first=[['inicio','Início','home'],['agenda',isCons()?'Giras':'Agenda','cal']];
  const mid=isCons()?[['orient','Orientações','file']]:[['mens','Mensalidade','wallet']];
  const conv=(canConv()||canCad())?[['conv','Convites','shield']]:[];
  const aul=lesList().length?[['aulas','Aulas','file']]:[];
  const are=canAreas()?[['areas','Áreas','file']]:[];
  const hasAv=avActive(PT.data&&PT.data.avisos).length>0||PT.tab==='avisos';
  return first.concat(mid,hasAv?[['avisos','Avisos','msg']]:[],are,conv,aul,[['perfil','Cadastro','users']]);
}
const MORE_ICO='<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
function portalTabsSplit(){
  const all=portalTabsDef();
  if(all.length<=5)return {shown:all,hidden:[]};
  return {shown:all.slice(0,4),hidden:all.slice(4)};
}
function portalTabs(){
  const d=PT.data||{},uo=(d.orient||[]).filter(o=>!o.lida_em).length,pd=(d.pend||[]).length;
  const {shown,hidden}=portalTabsSplit();
  const ln=lesNew().length,dot=k=>k==='orient'&&uo?`<i class="ptl-dot">${uo}</i>`:k==='conv'&&pd?`<i class="ptl-dot">${pd}</i>`:k==='aulas'&&ln?`<i class="ptl-dot">${ln}</i>`:'';
  const btn=([k,l,i])=>`<button class="${PT.tab===k?'on':''}" data-mt="tab" data-a="${k}">${ico(i)}<span>${l}</span>${dot(k)}</button>`;
  const hid=hidden.length?(()=>{const on=PT.tab==='mais'||hidden.some(h=>h[0]===PT.tab),n=hidden.reduce((x,h)=>x+(h[0]==='orient'?uo:h[0]==='conv'?pd:h[0]==='aulas'?ln:0),0);return `<button class="${on?'on':''}" data-mt="tab" data-a="mais">${MORE_ICO}<span>Mais</span>${n?`<i class="ptl-dot">${n}</i>`:''}</button>`})():'';
  const n=shown.length+(hidden.length?1:0);
  return `<nav class="ptl-nav" style="grid-template-columns:repeat(${n},1fr)">${shown.map(btn).join('')}${hid}</nav>`;
}
function feeBadge(m,pend){
  if(pend)return '<span class="pill warn">Em análise</span>';
  const t={paga:['Paga','ok'],pendente:['Pendente','warn'],atrasada:['Atrasada','bad'],isento:['Isento','']}[m.situacao]||[m.situacao,''];
  return `<span class="pill ${t[1]}">${t[0]}</span>`;
}
function portalBody(){
  const d=PT.data||{eventos:[],avisos:[],notifs:[],filhos:{},equipe:{},orient:[],mens:[],pags:[]},ev=(d.eventos||[]).filter(e=>e.status!=='Arquivado'&&inWindow(e));
  const cons=isCons();
  if(PT.tab==='aulas')return lesBody();
  if(PT.tab==='inicio'){
    const up=ev.filter(e=>e.data>=today()).slice(0,4),av=avActive(d.avisos).slice(0,5),nt=(d.notifs||[]).slice(0,5);
    return `<h2 class="ptl-h">Olá, ${E((MEM.nome||'').split(' ')[0])}</h2><p class="muted small">${E(MEM.casas?.nome||'')} · ${E(MODS[MEM.papel].label)} · <button type="button" class="mtg-link" data-mt="tour">Como usar o app</button></p>
      ${installCard()}
      ${presCard()}
      ${lesCard()}
      ${nt.length?`<div class="ptl-sec"><h3>Para você</h3>${nt.map(n=>`<div class="ptl-notif ${n.lida_em?'':'new'}"><b>${E(n.titulo)}</b>${n.texto?`<div class="small">${nl(n.texto)}</div>`:''}<div class="small muted">${E(when(n.criada_em))}</div></div>`).join('')}</div>`:''}
      <div class="ptl-sec"><h3>${cons?'Próximas giras':'Próximos compromissos'}</h3>${up.length?up.map(e=>evCard(e,d)).join(''):`<p class="muted small">${cons?'Nenhum dia de gira publicado ainda.':'Nenhum compromisso publicado pela casa.'}</p>`}${up.length?`<button class="mtg-link" data-mt="tab" data-a="agenda">Ver calendário completo →</button>`:''}</div>
      ${av.length?`<div class="ptl-sec ptl-board"><h3>📌 Quadro de avisos</h3>${av.map(avCard).join('')}</div>`:''}`;
  }
  if(PT.tab==='agenda'&&PT.evf)return evForm();
  if(PT.tab==='agenda'){
    const [y,m]=PT.cursor.split('-').map(Number),first=new Date(y,m-1,1),days=new Date(y,m,0).getDate(),by={};
    ev.forEach(e=>{(by[e.data]=by[e.data]||[]).push(e)});
    let cells=WD.map(w=>`<div class="ptl-wd">${w}</div>`).join('');
    for(let i=0;i<first.getDay();i++)cells+='<div></div>';
    for(let dd=1;dd<=days;dd++){const k=y+'-'+String(m).padStart(2,'0')+'-'+String(dd).padStart(2,'0');cells+=`<button class="ptl-day ${k===today()?'today':''} ${k===PT.day?'sel':''} ${by[k]?'has':''}" data-mt="day" data-a="${k}">${dd}${by[k]?`<i>${by[k].length>1?by[k].length:''}</i>`:''}</button>`}
    const sel=by[PT.day]||[];
    const myp=(d.props||[]).filter(x=>x.situacao==='pendente'||(Date.now()-new Date(x.decidida_em||x.criada_em))<7*864e5).slice(0,6);
    const PL={pendente:['Aguardando aprovação','warn'],aprovada:['Aprovada','ok'],recusada:['Não aprovada','bad']};
    const mine=canAgenda()?`<div class="ptl-sec"><button class="btn primary" data-mt="evnew">+ Novo compromisso</button>${myp.length?`<h3 style="margin-top:12px">Minhas alterações</h3>${myp.map(x=>`<div class="small"><span class="pill ${PL[x.situacao][1]}">${PL[x.situacao][0]}</span> ${E((x.dados&&x.dados.titulo)||'Compromisso')}${x.motivo?` <span class="muted">· ${E(x.motivo)}</span>`:''}</div>`).join('')}`:''}</div>`:'';
    return mine+`<div class="ptl-cal-head"><button class="btn sm" data-mt="mon" data-a="-1" aria-label="Mês anterior">‹</button><b>${MONTHS[m-1][0].toUpperCase()+MONTHS[m-1].slice(1)} de ${y}</b><button class="btn sm" data-mt="mon" data-a="1" aria-label="Próximo mês">›</button></div><div class="ptl-cal">${cells}</div>
      <div class="ptl-sec"><h3>${E(dLong(PT.day))}</h3>${sel.length?sel.map(e=>evCard(e,d)).join(''):'<p class="muted small">Nenhum compromisso neste dia.</p>'}</div>`;
  }
  if(PT.tab==='orient'){
    const o=d.orient||[];
    return `<h2 class="ptl-h">Orientações e banhos</h2><p class="muted small">Enviados pela casa especialmente para você.</p>${o.length?o.map(x=>`<div class="ptl-sec ptl-or ${x.lida_em?'':'new'}"><div class="small muted">${x.tipo==='banho'?'🌿 Banho':x.tipo==='orientacao'?'💬 Orientação':'Mensagem'} · ${E(when(x.criada_em))}</div><h3>${E(x.titulo)}</h3>${x.texto?`<div>${nl(x.texto)}</div>`:''}${x.itens?`<div class="ptl-mat"><b>Itens:</b> ${nl(x.itens)}</div>`:''}${x.modo_uso?`<div class="ptl-mat"><b>Modo de uso:</b> ${nl(x.modo_uso)}</div>`:''}</div>`).join(''):'<div class="ptl-sec"><p class="muted small">Quando a casa enviar uma orientação ou um banho para você, ele aparece aqui e você recebe um aviso.</p></div>'}`;
  }
  if(PT.tab==='mens'){
    const mens=d.mens||[],pags=d.pags||[],open=new Set(pags.filter(p=>p.situacao==='enviado').map(p=>p.competencia));
    if(!MEM.pessoa_local_id)return `<h2 class="ptl-h">Mensalidade</h2><div class="ptl-sec"><p class="muted small">Seu cadastro ainda não foi ligado ao cadastro da casa. Avise o Pai/Mãe ou a secretaria. Assim que ligarem, a sua mensalidade aparece aqui e você poderá enviar o comprovante.</p></div>`;
    const due=mens.filter(x=>(x.situacao==='pendente'||x.situacao==='atrasada')&&!open.has(x.competencia));
    const form=PT.pay?`<div class="ptl-sec"><h3>Informar pagamento</h3><div class="form-grid"><label>Mês<select id="py_comp">${due.map(x=>`<option value="${E(x.competencia)}" data-v="${x.valor_centavos}">${E(compLabel(x.competencia))}</option>`).join('')}</select></label><label>Valor pago (R$)<input id="py_val" inputmode="decimal" value="${due[0]?(due[0].valor_centavos/100).toFixed(2).replace('.',','):''}"></label><label>Forma<select id="py_forma"><option>Pix</option><option>Transferência</option><option>Dinheiro</option><option>Cartão</option><option>Outro</option></select></label><label class="full">Comprovante (foto ou PDF, até 5 MB)<input id="py_file" type="file" accept="image/*,application/pdf"></label><label class="full">Observação <span class="small muted">— opcional</span><input id="py_obs" maxlength="500"></label></div><div id="mtPyMsg" class="small" style="min-height:18px;margin:8px 0"></div><div class="mtx-btns"><button class="btn primary" data-mt="paysend">Enviar comprovante</button><button class="btn" data-mt="paycancel">Cancelar</button></div></div>`:'';
    return `<h2 class="ptl-h">Mensalidade</h2>${due.length&&!PT.pay?`<button class="btn primary" style="width:100%;margin:6px 0 10px" data-mt="payopen">Já paguei · enviar comprovante</button>`:''}${form}
      <div class="ptl-sec"><h3>Meses</h3>${mens.length?mens.map(x=>`<div class="ptl-fee"><div class="grow"><b>${E(compLabel(x.competencia))}</b><div class="small muted">${brl(x.valor_centavos)}${x.vencimento?' · vence '+E(brDate(x.vencimento)):''}</div></div>${feeBadge(x,open.has(x.competencia)&&x.situacao!=='paga')}</div>`).join(''):'<p class="muted small">Nenhuma mensalidade publicada ainda.</p>'}</div>
      <div class="ptl-sec"><h3>Meus envios</h3>${pags.length?pags.map(p=>`<div class="ptl-fee"><div class="grow"><b>${E(compShort(p.competencia))} · ${brl(p.valor_centavos)}</b><div class="small muted">${E(when(p.criado_em))}${p.forma?' · '+E(p.forma):''}${p.situacao==='recusado'&&p.motivo?'<br>Motivo: '+E(p.motivo):''}</div></div><span class="pill ${p.situacao==='validado'?'ok':p.situacao==='recusado'?'bad':'warn'}">${p.situacao==='validado'?'Validado':p.situacao==='recusado'?'Recusado':'Em análise'}</span></div>`).join(''):'<p class="muted small">Nenhum comprovante enviado.</p>'}</div>`;
  }
  if(PT.tab==='conv'&&(canConv()||canCad())){
    const pd=d.pend||[],cd=d.codes||{};
    const card=(tp,tt,ds)=>`<div class="ptl-sec"><h3>${tt}</h3><p class="muted small">${ds}</p><div class="mtx-code">${E(cd[tp]||'········')}</div><div class="mtx-btns"><button class="btn sm" data-mt="copylink" data-t="${tp}">Copiar link</button><button class="btn sm primary" data-mt="sharecode" data-t="${tp}">Enviar convite (WhatsApp)</button></div></div>`;
    const cad=canCad()?`<div class="ptl-sec"><h3>Aguardando aprovação ${pd.length?`<span class="pill warn">${pd.length}</span>`:''}</h3>${pd.length?pd.map(x=>`<div class="ptl-fee"><div class="grow"><b>${E(x.nome)}</b><div class="small muted">${E(MEMBERS_LABEL[x.papel]||x.papel)} · ${E(when(x.criado_em))}${x.whatsapp?' · '+E(x.whatsapp):''}</div></div><div class="mtx-act"><button class="btn sm primary" data-mt="pcad" data-u="${x.user_id}" data-s="1">Aprovar</button><button class="btn sm" data-mt="pcad" data-u="${x.user_id}" data-s="0">Recusar</button></div></div>`).join(''):'<p class="muted small">Nenhum cadastro aguardando.</p>'}<p class="small muted">Depois de aprovado, o Pai/Mãe da casa liga o cadastro à pessoa na lista de Pessoas.</p></div>`:'';
    const inv=canConv()?(cd.equipe||cd.consulente?card('equipe','Convite · Filhos e cambonos','Envie pelo WhatsApp: escolha o contato na sua lista.')+card('consulente','Convite · Consulentes','Para quem visita a casa. Cadastro com aprovação.'):'<div class="ptl-sec"><p class="muted small">Não foi possível carregar os convites agora. Toque em ↻ para tentar de novo.</p></div>'):'';
    return `<h2 class="ptl-h">Convites e cadastros</h2><p class="muted small">Funções liberadas pelo Pai/Mãe da casa para você.</p>${cad}${inv}`;
  }
  if(PT.tab==='mais'){
    const {hidden}=portalTabsSplit(),dsc={areas:canAreas()?areaOkList().map(a=>a[1]).join(', '):'',conv:'Convidar pessoas e aprovar cadastros',avisos:'Recados e orientações da casa',perfil:'Seus dados, senha e saída da conta',orient:'Orientações e banhos enviados para você',mens:'Mensalidade e comprovantes'};
    const uo=(d.orient||[]).filter(o=>!o.lida_em).length,pd=(d.pend||[]).length;
    return `<h2 class="ptl-h">Mais</h2><div class="ptl-more">${hidden.map(([k,l,i])=>`<button type="button" class="ptl-morecard" data-mt="tab" data-a="${k}"><span class="ptl-moreic">${ico(i)}</span><span class="grow"><b>${E(l)}</b><small>${E(dsc[k]||'')}</small></span>${(k==='orient'&&uo)||(k==='conv'&&pd)?`<i class="ptl-dot" style="position:static">${k==='orient'?uo:pd}</i>`:''}<span class="ptl-ch">›</span></button>`).join('')}</div>`;
  }
  if(PT.tab==='areas'&&canAreas()){
    const ok=areaOkList(),have=(d.areas||[]).filter(x=>ok.some(o=>o[0]===x.area));
    const selK=PT.area&&ok.some(o=>o[0]===PT.area)?PT.area:((have[0]&&have[0].area)||(ok[0]&&ok[0][0])||''),cur=have.find(x=>x.area===selK);
    const chips=ok.map(([k,t])=>`<button class="mtx-chip ${selK===k?'on':''}" data-mt="area" data-a="${k}">${E(t)}</button>`).join('');
    let body='<p class="muted small">Ainda não há dados publicados para as suas áreas. Peça ao Pai/Mãe para abrir o app no aparelho principal.</p>';
    if(cur){const dd=cur.dados||{},cols=dd.cols||[],rw=dd.rows||[];
      body=`${dd.resumo?`<p class="small"><b>${E(dd.resumo)}</b></p>`:''}${rw.length?`<div class="mtx-scroll"><table class="mtx-matrix mtx-areat"><thead><tr>${cols.map(c=>`<th>${E(c)}</th>`).join('')}</tr></thead><tbody>${rw.map(r=>`<tr>${r.map(v=>`<td>${E(v==null?'':v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="muted small">Nada cadastrado nesta área.</p>'}<p class="small muted">Somente leitura · atualizado em ${E(new Date(cur.atualizado_em).toLocaleString('pt-BR'))}</p>`}
    if(selK==='estoque')body=estBody();
    if(selK==='financeiro'&&hasFin())body=finBody();
    if(EQM[selK])body=eqBody(selK);
    return `<h2 class="ptl-h">Áreas da casa</h2><div class="mtx-chips" style="margin:6px 0 12px">${chips}</div><div class="ptl-sec">${body}</div>`;
  }
  if(PT.tab==='avisos'){
    const av=avActive(d.avisos);
    return `<h2 class="ptl-h">Quadro de avisos</h2>${av.length?av.map(avCard).join(''):'<p class="muted small">Nenhum aviso no quadro agora.</p>'}`;
  }
  const m=MEM;
  return `<h2 class="ptl-h">Meu cadastro</h2><div class="ptl-sec"><div class="mtx-row"><div class="grow"><b>${E(m.nome)}</b><div class="small muted">${E(MODS[m.papel].label)} · ${E(m.casas?.nome||'')}</div></div><span class="mtx-st st-ativo">Ativo</span></div>
   <div class="form-grid" style="margin-top:12px"><label class="full">Nome completo<input id="pf_nome" value="${E(m.nome)}"></label><label>WhatsApp<input id="pf_wa" inputmode="tel" value="${E(m.telefone||m.whatsapp||'')}"></label><label>Nascimento<input id="pf_nasc" type="date" value="${E(m.nascimento||'')}"></label><label class="full">Contato de emergência<input id="pf_em" value="${E(m.emergencia||'')}" placeholder="Nome · telefone"></label><label class="full">E-mail de acesso<input value="${E(S?.user?.email||m.email||'')}" disabled></label>${m.grupo?`<label class="full">Grupo<input value="${E(m.grupo)}" disabled></label>`:''}</div>
   <div id="mtPfMsg" class="small" style="min-height:18px;margin:8px 0"></div><button class="btn primary" data-mt="saveprofile">Salvar meus dados</button></div>
   <div class="ptl-sec"><h3>Senha</h3><div class="form-grid"><label>Nova senha<input id="pf_p1" type="password" autocomplete="new-password" minlength="6"></label><label>Confirmar<input id="pf_p2" type="password" autocomplete="new-password" minlength="6"></label></div><button class="btn" data-mt="pfpass" style="margin-top:10px">Alterar senha</button></div>
   <div class="ptl-sec"><button class="btn danger" data-mt="logout">Sair</button></div>`;
}
function portalPaint(){
  const el=document.getElementById('mtPortal');if(!el)return;
  const keep=el.querySelector('.ptl-main')?.scrollTop||0;
  const unread=((PT.data&&PT.data.notifs)||[]).filter(n=>!n.lida_em).length;
  el.innerHTML=`<header class="ptl-top"><div><b>${E(MEM?.casas?.nome||'MEU TERREIRO')}</b><small>${E(MODS[MEM?.papel]?.label||'')}</small></div><div class="ptl-tools"><button class="ptl-bell" data-mt="tab" data-a="inicio" aria-label="Avisos para você">🔔${unread?`<i>${unread>9?'9+':unread}</i>`:''}</button><button class="ptl-ref" data-mt="refresh" aria-label="Atualizar" ${PT.loading?'disabled':''}>${PT.loading?'…':'↻'}</button></div></header>
  ${PT.offline?`<div class="ptl-off">Sem conexão com a nuvem — mostrando a última versão salva${PT.data?.at?' ('+E(when(PT.data.at))+')':''}.</div>`:''}
  <main class="ptl-main">${portalBody()}</main>${portalTabs()}`;
  const m=el.querySelector('.ptl-main');if(m)m.scrollTop=keep;
}
async function shrinkImage(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size<350*1024)return file;
  try{
    const bmp=await createImageBitmap(file),max=1600,k=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
    return b&&b.size<file.size?new File([b],'comprovante.jpg',{type:'image/jpeg'}):file;
  }catch(e){return file}
}
async function sendPayment(btn){
  const msg=document.getElementById('mtPyMsg'),bad=t=>{msg.textContent=t;msg.style.color='#a84c47'};
  const comp=val('py_comp'),valor=centsFrom(val('py_val')),f=document.getElementById('py_file')?.files?.[0];
  if(!comp)return bad('Não há mês pendente para informar.');
  if(valor<=0)return bad('Informe o valor pago.');
  if(!f)return bad('Anexe o comprovante (foto ou PDF).');
  if(!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type))return bad('Use foto JPG/PNG ou PDF.');
  busy(btn,true,'Enviando…');
  try{
    const file=await shrinkImage(f);
    if(file.size>5*1024*1024)return bad('O arquivo passa de 5 MB. Tire uma foto menor ou use PDF mais leve.');
    const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=MEM.casa_id+'/'+MEM.user_id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
    await api.upload(path,file);
    await api.rpc('mt_enviar_pagamento',{p_competencia:comp,p_valor:valor,p_forma:val('py_forma'),p_obs:val('py_obs'),p_comprovante:path});
    PT.pay=false;toast('✓ Comprovante enviado. Avisaremos quando for validado.');
    await portalLoad();
  }catch(e){bad(e.message)}finally{busy(btn,false)}
}

/* ------------------------------------------------------------ EVENTOS (UI) -- */
document.addEventListener('change',async e=>{
  const v=e.target.closest('[data-mt-vinc]');
  if(v){
    try{await api.rpc('mt_vincular_pessoa',{p_user:v.dataset.mtVinc,p_pessoa:v.value||null});toast(v.value?'✓ Vínculo salvo.':'Vínculo removido.');await axLoad();syncSoon(300)}
    catch(er){toast('⚠ '+userErr(er.message));await axLoad()}
    return;
  }
  const ar=e.target.closest('[data-mt-area]');
  if(ar){
    state.settings.mtAreasCloud=Object.assign({},state.settings.mtAreasCloud||{});state.settings.mtAreasCloud[ar.dataset.mtArea]=ar.checked;
    try{await persist(false)}catch(er){}
    toast(ar.checked?'✓ Publicando na nuvem…':'✓ Removendo da nuvem…');ls.del('mt_cloud_sigA');try{await syncAll(true)}catch(er){toast('⚠ '+userErr(er.message))}axPaint();return;
  }
  const c=e.target.closest('[data-mt-ctype]');
  if(c){
    const set=new Set(consTypes());const t=c.dataset.mtCtype;
    [...set].forEach(x=>{if(String(x).toLowerCase()===String(t).toLowerCase())set.delete(x)});
    if(c.checked)set.add(t);
    state.settings.consulenteTypes=[...set];
    try{await persist(false)}catch(er){}
    toast('✓ Atualizado. Sincronizando…');return;
  }
  if(e.target.id==='py_comp'){const o=e.target.selectedOptions[0];const i=document.getElementById('py_val');if(o&&i)i.value=(Number(o.dataset.v||0)/100).toFixed(2).replace('.',',')}
});
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-mt]');if(!t)return;
  const a=t.dataset.mt,v=t.dataset.a;
  if(['decide','remove','agok','agnosave','acessossave','axfilter'].includes(a)&&!AX.tab)AX.tab=AX._tab;
  e.preventDefault();
  try{
    switch(a){
      case 'screen':screen(v,v==='modules'?undefined:CURMOD);break;
      case 'module':ls.set(K.mod,v);screen('login',v);break;
      case 'local':showLocal();break;
      case 'gotologin':{const em=(document.getElementById('mt_email')?.value||'').trim();if(em)ls.set('mt_last_email',em);screen('login');break}
      case 'resend':{
        const m=(AX.membros||[]).find(x=>x.user_id===t.dataset.u);if(!m)break;
        const tp=m.papel==='consulente'?'consulente':'equipe';
        if(!codeOf(tp)){toast('⚠ Código da casa indisponível. Atualize a tela e tente de novo.');break}
        const txt='Olá, '+String(m.nome||'').split(' ')[0]+'! Segue de novo o link de acesso ao app MEU TERREIRO da casa '+((MEM&&MEM.casas&&MEM.casas.nome)||'')+'.\n\n1) Toque no link abaixo\n2) Se você já tem cadastro (trocou de celular, por exemplo), toque em "Já possuo cadastro · Entrar" e use o seu e-mail e a sua senha\n3) Depois toque em "Instalar" para ter o app na tela do celular\n\n'+inviteLink(tp,m.papel)+'\n\n(Se pedir, o código da casa é '+codeOf(tp)+')';
        let n=String(m.whatsapp||m.telefone||'').replace(/\D/g,'');if(n&&n.length<=11)n='55'+n;
        window.open('https://wa.me/'+(n||'')+'?text='+encodeURIComponent(txt),'_blank');
        if(!n)toast('Sem WhatsApp no cadastro: escolha o contato na lista do WhatsApp.');break}
      case 'switch':if(devLock()){screen('login',devLock());break}if(INV){toast('Este convite é só para cadastro como '+(MODS[CURMOD]?MODS[CURMOD].label:'convidado')+'.');break}screen('modules');break;
      case 'closegate':closeGate();break;
      case 'login':await doLogin(t);break;
      case 'signup':await doSignup(t);break;
      case 'forgot':await doForgot(t);break;
      case 'ask':askLink(t.dataset.k,t.closest('.mtg-ask'));break;
      case 'pick':if(INV)INV.picked=true;screen('signup',v);break;
      case 'narea':AX.nArea=v;axPaint();break;
      case 'areasync':ls.del('mt_cloud_sigA');busy(t,true);try{await syncAll(true);toast('✓ Nuvem atualizada.')}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}axPaint();break;
      case 'axtab':AX.tab=v;axPaint();break;
      case 'axfilter':AX.pfilter=v;axPaint();break;
      case 'newpass':await doNewPass(t);break;
      case 'unlock':await doUnlock(t);break;
      case 'otheraccount':await logout();break;
      case 'logout':await logout();break;
      case 'recheck':busy(t,true,'Verificando…');try{await enter()}finally{busy(t,false)}break;
      case 'connect':screen('login','pai_mae');break;
      case 'connectnew':ls.set(K.mod,'pai_mae');screen('signup','pai_mae');break;
      case 'install':if(typeof promptInstall==='function')promptInstall();break;
      case 'instno':ls.set('mt_inst_dismiss',String(Date.now()));if(document.getElementById('mtPortal'))portalPaint();else document.querySelectorAll('.mtg-install').forEach(x=>x.remove());break;
      case 'tour':portalTour(0);break;
      case 'tab':PT.tab=v;PT.pay=false;portalPaint();if(v==='inicio'||v==='orient')markRead();break;
      case 'day':PT.day=v;portalPaint();break;
      case 'mon':{const [y,m]=PT.cursor.split('-').map(Number);const d=new Date(y,m-1+Number(v),1);PT.cursor=iso(d).slice(0,7);PT.day=PT.day.slice(0,7)===PT.cursor?PT.day:PT.cursor+'-01';portalPaint();break}
      case 'refresh':portalLoad();break;
      case 'payopen':PT.pay=true;portalPaint();break;
      case 'evnew':PT.evf={id:null,d:{}};portalPaint();break;
      case 'evedit':{const e=evFind(v);if(!e)break;const nt=((PT.data.filhos||{})[e.id]||{}).notas||'';PT.evf={id:e.id,d:{titulo:e.titulo,tipo:e.tipo,data:e.data,hora:e.hora,hora_fim:e.hora_fim,local:e.local,notas:nt}};portalPaint();break}
      case 'evback':PT.evf=null;portalPaint();break;
      case 'evsave':await evSave(t,PT.evf&&PT.evf.id?'editar':'criar');break;
      case 'evcancel':{if(!confirm('Cancelar este compromisso? '+(canDireto()?'Ele some da agenda de todos.':'O pedido vai para a aprovação do Pai/Mãe.')))break;PT.evf={id:v,d:{}};await evSave(t,'cancelar');break}
      case 'paycancel':PT.pay=false;portalPaint();break;
      case 'paysend':await sendPayment(t);break;
      case 'saveprofile':{
        const nome=val('pf_nome'),msg=document.getElementById('mtPfMsg');
        if(nome.length<3){msg.textContent='Informe o nome completo.';msg.style.color='#a84c47';return}
        busy(t,true,'Salvando…');
        try{const body={nome,telefone:val('pf_wa'),whatsapp:digits(val('pf_wa')),nascimento:val('pf_nasc')||null,emergencia:val('pf_em')};
          const r=await api.patch('membros','user_id=eq.'+MEM.user_id,body);
          if(r&&r[0]){MEM=Object.assign({},MEM,r[0]);cacheProfile(MEM)}
          portalPaint();toast('✓ Dados salvos.')}
        catch(er){msg.textContent=er.message;msg.style.color='#a84c47'}finally{busy(t,false)}
        break}
      case 'pfpass':{
        const p1=document.getElementById('pf_p1')?.value||'',p2=document.getElementById('pf_p2')?.value||'';
        if(p1.length<6){toast('⚠ A senha deve ter pelo menos 6 caracteres.');return}
        if(p1!==p2){toast('⚠ As senhas não conferem.');return}
        busy(t,true,'Salvando…');try{await api.setPassword(p1);await lockSave(S.user.email,p1);toast('✓ Senha alterada.');document.getElementById('pf_p1').value='';document.getElementById('pf_p2').value=''}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}
        break}
      case 'renovar':{
        const c=val('rn_cod');if(c.replace(/-/g,'').length<10)return markBad('rn_cod','Código de liberação: digite o código completo, no formato MT-XXXX-XXXX.');
        busy(t,true,'Renovando…');
        try{const nv=await api.rpc('mt_renovar_plano',{p_codigo:c});toast('✓ Plano renovado até '+brDate(nv)+'.');AX.expired=false;AX.membros=null;await axLoad();syncSoon(300)}
        catch(er){markBad('rn_cod',er.message);toast('⚠ '+userErr(er.message))}finally{busy(t,false)}
        break}
      case 'axreload':AX.membros=null;AX.err='';axPaint();break;
      case 'decide':
        busy(t,true,'…');
        try{await api.rpc('mt_decidir_membro',{p_user:t.dataset.u,p_status:t.dataset.s});toast('✓ Situação atualizada.');await axLoad();
          if(t.dataset.s==='ativo'){const mm=(AX.membros||[]).find(x=>x.user_id===t.dataset.u),lc=mm&&!mm.pessoa_local_id&&mm.papel!=='consulente'&&mm.papel!=='pai_mae'?acharLocal({nome:mm.nome,whatsapp:mm.whatsapp}):null;
            if(lc){await api.rpc('mt_vincular_pessoa',{p_user:mm.user_id,p_pessoa:lc.id});toast('✓ Ligada automaticamente a '+lc.name+'.');await axLoad()}}
          syncSoon(300)}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}
        break;
      case 'focusvinc':{const sl=document.querySelector('[data-mt-vinc="'+t.dataset.u+'"]');if(sl){sl.scrollIntoView({block:'center',behavior:'smooth'});sl.focus();try{sl.showPicker&&sl.showPicker()}catch(_){}}break}
      case 'fixconfig':if(typeof go==='function')go('settings');break;
      case 'fixpessoa':{if(typeof openMemberForm!=='function')break;openMemberForm(t.dataset.p);let n=0;const iv=setInterval(()=>{n++;const mr=document.getElementById('modalRoot');if(n>400||(mr&&!mr.innerHTML.trim())){clearInterval(iv);try{axPaint()}catch(_){}}},700);break}
      case 'vincsug':
        busy(t,true,'…');try{await api.rpc('mt_vincular_pessoa',{p_user:t.dataset.u,p_pessoa:t.dataset.p});toast('✓ Vínculo salvo.');await axLoad();syncSoon(300)}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}
        break;
      case 'remove':
        if(!confirm('Remover esta pessoa da casa? Ela perde o acesso e precisará se cadastrar de novo.'))return;
        try{await api.rpc('mt_remover_membro',{p_user:t.dataset.u});toast('✓ Pessoa removida.');await axLoad()}catch(er){toast('⚠ '+userErr(er.message))}
        break;
      case 'addtype':{
        const nm=val('nt_name').replace(/\s+/g,' ').trim();
        if(nm.length<2){toast('⚠ Digite o nome do tipo.');break}
        const cur=state.settings.eventTypes=state.settings.eventTypes||[];
        if(cur.some(x=>String(x).toLowerCase()===nm.toLowerCase())){toast('Esse tipo já existe.')}
        else{const i=cur.indexOf('Outro');if(i>=0)cur.splice(i,0,nm);else cur.push(nm)}
        if(document.getElementById('nt_open')&&document.getElementById('nt_open').checked){const set=new Set(consTypes());if(![...set].some(x=>String(x).toLowerCase()===nm.toLowerCase()))set.add(nm);state.settings.consulenteTypes=[...set]}
        try{await persist(false)}catch(er){}
        toast('✓ Tipo "'+nm+'" criado. Já aparece ao cadastrar compromissos.');axPaint();break}
      case 'openperms':{AX.tab='permissoes';if(typeof go==='function')go('access');break}
      case 'pubnow':{if(!adminActive()){toast('Conecte a conta online em Acessos & Nuvem para publicar.');break}busy(t,true,'Publicando…');try{await syncAll(true);if(SY.err)toast('⚠ '+SY.err);else toast('✓ Agenda publicada. Todos já podem ver.')}finally{busy(t,false)}break}
      case 'pcad':{
        const ok=t.dataset.s==='1';
        if(!ok&&!confirm('Recusar este cadastro?'))return;
        busy(t,true);try{await api.rpc('mt_decidir_cadastro',{p_user:t.dataset.u,p_aprovar:ok});toast(ok?'✓ Cadastro aprovado.':'Cadastro recusado.');await portalLoad(true);portalPaint()}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}break}
      case 'copylink':{const tp=t.dataset.t;logAcao('convite_copiado',tp==='consulente'?'Convite de consulentes':'Convite de filhos e cambonos');try{await navigator.clipboard.writeText(inviteLink(tp));toast('✓ Link de convite copiado.')}catch(er){toast('Link: '+inviteLink(tp))}break}
      case 'sharecode':{
        logAcao('convite_enviado',t.dataset.t==='consulente'?'Convite de consulentes (WhatsApp)':'Convite de filhos e cambonos (WhatsApp)');
        window.open('https://wa.me/?text='+encodeURIComponent(inviteText(t.dataset.t)),'_blank');break}
      case 'sharepessoa':{
        const tp=t.dataset.t,inp=document.getElementById('inv_p_'+tp),q=(inp&&inp.value||'').trim().toLowerCase();
        if(!q){toast('Escolha uma pessoa na lista.');break}
        const p=(state.members||[]).find(x=>String(x.name||'').toLowerCase()===q)||(state.members||[]).find(x=>String(x.name||'').toLowerCase().includes(q));
        if(!p){toast('Pessoa não encontrada em Pessoas.');break}
        let n=String(p.whatsapp||p.phone||'').replace(/\D/g,'');
        if(!n){toast('⚠ '+p.name+' está sem WhatsApp no cadastro. Use "Escolher contato no WhatsApp".');break}
        if(n.length<=11)n='55'+n;
        logAcao('convite_enviado',(tp==='consulente'?'Consulente · ':'Filho/cambono · ')+p.name);
        window.open('https://wa.me/'+n+'?text='+encodeURIComponent(inviteText(tp,p.name)),'_blank');break}
      case 'newcode':{
        const tp=t.dataset.t;
        if(!confirm('Gerar um novo código? O código atual deixa de funcionar para novos cadastros (quem já está cadastrado não é afetado) e os links já enviados deixam de valer.'))return;
        try{AX.codigos[tp]=await api.rpc('mt_trocar_codigo',{p_tipo:tp});toast('✓ Novo código gerado.');axPaint()}catch(er){toast('⚠ '+userErr(er.message))}break}
      case 'publish':busy(t,true,'Sincronizando…');try{await syncAll(true);if(SY.err)toast('⚠ '+SY.err);else toast('✓ Tudo sincronizado.')}finally{busy(t,false)}break;
      case 'aviso':{
        const ti=val('av_t'),tx=val('av_x');
        const pb=[];if(document.getElementById('av_pf').checked)pb.push('filho');if(document.getElementById('av_pc').checked)pb.push('cambono');if(document.getElementById('av_pn').checked)pb.push('consulente');
        const de=val('av_de'),ate=val('av_ate');
        if(!ti||!tx){toast('⚠ Informe título e mensagem.');return}
        if(!pb.length){toast('⚠ Escolha para quem o aviso aparece.');return}
        if(de&&ate&&new Date(ate)<=new Date(de)){toast('⚠ "Some em" precisa ser depois de "Aparece a partir de".');return}
        busy(t,true,'Publicando…');
        try{await api.insert('avisos',{casa_id:MEM.casa_id,titulo:ti,texto:tx,publico:pb,criado_por:MEM.user_id,visivel_de:isoOrNull(de),visivel_ate:isoOrNull(ate),fixado:!!document.getElementById('av_fix').checked});toast('✓ Aviso publicado no quadro.');await axLoad()}
        catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}
        break}
      case 'delaviso':
        if(!confirm('Apagar este aviso?'))return;
        try{await api.del('avisos','id=eq.'+t.dataset.u);toast('✓ Aviso apagado.');await axLoad()}catch(er){toast('⚠ '+userErr(er.message))}break;
      case 'chpass':{
        const p=prompt('Nova senha (mínimo 6 caracteres):');if(!p)return;
        if(p.length<6){toast('⚠ A senha deve ter pelo menos 6 caracteres.');return}
        try{await api.setPassword(p);await lockSave(S.user.email,p);toast('✓ Senha da conta online alterada.')}catch(er){toast('⚠ '+userErr(er.message))}break}
      case 'comprov':await verComprovante(t.dataset.p);break;
      case 'validar':await validarPagamento(t.dataset.u,t);break;
      case 'recusarpg':{
        const mot=prompt('Motivo da recusa (a pessoa verá esta mensagem):','Comprovante ilegível ou valor diferente.');if(mot===null)return;
        try{await api.rpc('mt_decidir_pagamento',{p_id:t.dataset.u,p_situacao:'recusado',p_motivo:mot});toast('✓ Comprovante recusado. A pessoa foi avisada.');await axLoad()}catch(er){toast('⚠ '+userErr(er.message))}break}
      case 'orient':orientModal(t.dataset.u);break;
      case 'area':PT.area=t.dataset.a;portalPaint();if(PT.area==='estoque')estLoad();if(PT.area==='financeiro')finLoad();if(EQM[PT.area])eqLoad();break;
      case 'acessos':acessosModal(t.dataset.u,t.dataset.l);break;
      case 'agok':{busy(t,true);try{await api.rpc('mt_agenda_decidir',{p_proposta:t.dataset.u,p_aprovar:true,p_motivo:null});toast('✓ Aprovado. O compromisso já aparece para todos.');await agendaPull();await axLoad()}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}break}
      case 'agno':{const id=t.dataset.u;showModal('Recusar alteração','<p class="small muted">Se quiser, explique o motivo. A pessoa recebe um aviso.</p><div class="form-grid"><label class="full">Motivo (opcional)<textarea id="ag_mot" rows="3" maxlength="300"></textarea></label></div>',`<button class="btn" data-action="close-modal">Voltar</button><button class="btn primary" data-mt="agnosave" data-u="${id}">Recusar</button>`);break}
      case 'agnosave':{busy(t,true);try{await api.rpc('mt_agenda_decidir',{p_proposta:t.dataset.u,p_aprovar:false,p_motivo:val('ag_mot')});document.getElementById('modalRoot').innerHTML='';toast('Alteração recusada.');await axLoad()}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}break}
      case 'acessossave':{const o={};ACESSOS.forEach(([k])=>{o[k]=document.getElementById('ac_'+k).checked});const fn=document.getElementById('ac_fun').value,uid2=t.dataset.u,lid2=t.dataset.l;busy(t,true);try{
        const c=uid2?(AX.membros||[]).find(x=>x.user_id===uid2):null,l=lid2?(state.members||[]).find(x=>x.id===lid2):(c?acharLocal(c):null);
        if(l){l.perms={funcao:fn,acessos:o};try{await persist()}catch(er){}}
        if(c){await api.rpc('mt_definir_acessos',{p_user:uid2,p_funcao:fn,p_acessos:o});c.acessos=o;c.funcao=fn||null}
        document.getElementById('modalRoot').innerHTML='';toast(c?'✓ Permissões salvas.':'✓ Permissões salvas. Valem quando a pessoa entrar pelo convite.');
        ls.del('mt_cloud_sigA');if(c){try{await syncAll(true)}catch(er){}}await axLoad()}catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}break}
      case 'orientsend':{
        const ti=val('or_t');if(!ti){toast('⚠ Informe o título.');return}
        busy(t,true,'Enviando…');
        try{await api.rpc('mt_enviar_orientacao',{p_user:t.dataset.u,p_tipo:val('or_tipo'),p_titulo:ti,p_texto:val('or_x'),p_itens:val('or_i'),p_modo:val('or_m')});closeModal();toast('✓ Enviado. A pessoa será avisada.');await axLoad()}
        catch(er){toast('⚠ '+userErr(er.message))}finally{busy(t,false)}
        break}
      case 'delorient':
        if(!confirm('Apagar esta orientação? A pessoa deixa de vê-la.'))return;
        try{await api.rpc('mt_apagar_orientacao',{p_id:t.dataset.u});toast('✓ Apagado.');await axLoad()}catch(er){toast('⚠ '+userErr(er.message))}break;
    }
  }catch(er){console.error(er);toast('⚠ '+(er.message||'Erro inesperado.'))}
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.target.tagName==='TEXTAREA')return;
  const g=e.target.closest('#mtGate');if(!g)return;
  const b=g.querySelector('[data-mt-primary]');if(b&&!b.disabled){e.preventDefault();b.click()}
});

/* ------------------------------------------------- GANCHOS NO APP EXISTENTE -- */
const _render=render;
render=function(){
  if(route==='access'&&!document.body.classList.contains('mt-portal')){
    try{updateNav();document.getElementById('topHouse').textContent=state.house.name;const ts=document.getElementById('topSub');if(ts)ts.textContent='Acessos & Nuvem'}catch(e){}
    const v=document.getElementById('view');if(v)v.innerHTML=axView();
    return Promise.resolve();
  }
  return _render.apply(this,arguments);
};
const _renderMore=renderMore;
renderMore=function(){
  let h=_renderMore.apply(this,arguments);
  const n=AX.pend>0?` <span class="pill warn">${AX.pend}</span>`:'';
  const card=`<button class="hub-card" data-route="access"><div class="hub-icon">${ico('shield')}</div><div class="grow"><b>Acessos &amp; Nuvem${n}</b><small>Convites, pagamentos a validar, agenda e orientações.</small></div><span class="more-chevron">${ico('chevron')}</span></button>`;
  const card2=`<button class="hub-card" data-mt="switch"><div class="hub-icon">${ico('users')}</div><div class="grow"><b>Trocar de módulo</b><small>Entrar como Filho, Cambono ou Consulente, com outro cadastro.</small></div><span class="more-chevron">${ico('chevron')}</span></button>`;
  const i=h.indexOf('<button class="hub-card danger-hub"');
  return i>0?h.slice(0,i)+card+card2+h.slice(i):h+card+card2;
};
const _go=go;
go=function(r){ if(r==='access'){ if(!ROUTES.access)ROUTES.access=['Acessos & Nuvem','shield']; AX.membros=null; } return _go.apply(this,arguments); };

/* ---------------------------------------------------------------- INÍCIO ---- */
async function bootHash(){
  const h=location.hash.replace(/^#/,'');
  if(!h||(!h.includes('access_token')&&!h.includes('error_description')))return null;
  const p=Object.fromEntries(new URLSearchParams(h));
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){location.hash=''}
  if(p.error_description)return {error:String(p.error_description).replace(/\+/g,' ')};
  if(!p.access_token||!configured())return null;
  try{
    const u=await api.getUser(p.access_token);
    saveS({access_token:p.access_token,refresh_token:p.refresh_token||'',expires_at:Date.now()+(Number(p.expires_in)||3600)*1000,user:{id:u.id,email:u.email,meta:u.user_metadata||{}}});
    return {type:p.type||''};
  }catch(e){return {error:e.message}}
}
function readInvite(){
  try{
    const q=new URLSearchParams(location.search),c=(q.get('convite')||'').toUpperCase().replace(/[^A-Z0-9]/g,''),m=q.get('modulo')||'';
    if(!c&&!m)return null;
    history.replaceState(null,'',location.pathname);
    const mod=['filho','cambono','consulente'].includes(m)?m:'filho';
    return {codigo:c,modulo:mod,escolher:m==='equipe'};
  }catch(e){return null}
}
window.mtGateway=async function(){
  loadS();
  ensureAdminNav();
  INV=readInvite();
  const tkn=readSenhaParam();
  if(tkn&&configured()){ticketPage(tkn);return}
  readPresParam();
  const h=await bootHash();
  if(!configured()){if(INV)screen(INV.escolher?'escolha':'signup',INV.modulo);else screen('modules');return}
  if(h&&h.error){screen('modules');toast('⚠ '+(h.error.includes('expired')?'O link expirou. Peça um novo.':h.error));return}
  if(h&&h.type==='recovery'){screen('newpass',CURMOD);return}
  if(S&&S.user&&h&&h.type==='signup')markUnlocked();
  if(S&&S.user&&!isUnlocked()){const c=cachedProfile();screen('unlock',(c&&c.user_id===S.user.id&&c.papel)||CURMOD);return}
  if(S&&S.user){
    panel(`<span class="eyebrow">Entrando…</span><h2>Abrindo seu acesso</h2><p>Um instante.</p>`);
    await enter({fresh:h&&h.type==='signup'});
    return;
  }
  if(INV){screen(INV.escolher?'escolha':'signup',INV.modulo);return}
  if(devLock()){screen('login',devLock());return}
  screen('modules');
};

/* ---- Botão de mostrar/ocultar senha (corrige erro da base) ---- */
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-action="toggle-password"]');if(!b)return;
  e.preventDefault();e.stopPropagation();
  const t=document.getElementById(b.dataset.target);if(!t)return;
  const show=t.type==='password';t.type=show?'text':'password';
  b.setAttribute('aria-pressed',show?'true':'false');b.classList.toggle('on',show);
},true);
/* ---- Primeiro acesso local: erro por campo + falha de gravação visível ---- */
function localBad(id,msg){const el=document.getElementById('authError');if(el){el.textContent=msg;el.classList.add('show')}markBad(id,msg);return false}
const _saveInitial=saveInitialAccess;
saveInitialAccess=async function(){
  const g=id=>(document.getElementById(id)?.value||'').trim();
  const name=g('setup_name'),wa=digits(g('setup_whatsapp')),login=g('setup_login'),p1=document.getElementById('setup_pass')?.value||'',p2=document.getElementById('setup_pass2')?.value||'';
  if(name.length<3)return localBad('setup_name','Nome do responsável: informe pelo menos 3 letras. Ex.: Maria da Silva.');
  if(g('setup_whatsapp')&&(wa.length<10||wa.length>13))return localBad('setup_whatsapp','WhatsApp: digite com DDD (10 ou 11 números). Ex.: (11) 99999-9999. Se não quiser informar agora, deixe em branco.');
  if(login.length<3)return localBad('setup_login','Login: use pelo menos 3 caracteres. Ex.: administrador.');
  if(/\s/.test(login))return localBad('setup_login','Login: não use espaços. Ex.: mae.joana.');
  if(p1.length<6)return localBad('setup_pass','Senha: use no mínimo 6 caracteres (letras e números). Ex.: terreiro2026.');
  if(p1!==p2)return localBad('setup_pass2','Confirme a senha: repita exatamente a mesma senha digitada acima.');
  if(!document.getElementById('setup_accept_legal')?.checked)return localBad('setup_accept_legal','Aceite obrigatório: marque a caixa "Li e aceito os Termos de Uso e a Política de Privacidade".');
  const btn=document.querySelector('[data-action="save-initial-access"]');
  try{await _saveInitial.apply(this,arguments)}
  catch(err){
    console.error(err);
    try{state.settings.authConfigured=false}catch(e2){}
    localBad('setup_name','Não foi possível salvar o acesso neste aparelho ('+(err&&err.message?err.message:'erro de gravação')+'). Isso costuma ocorrer quando o app é aberto em uma visualização de arquivo. Abra o endereço do app no navegador (Chrome ou Safari) e tente de novo.');
    return;
  }
  if(!state.settings.authConfigured)localBad('setup_name','O acesso não foi criado. Confira os campos e tente novamente.');
};

/* ---------------------------------------- ganchos: agenda (quem vê) e botões ---- */
(function(){
  const PUBL=[['','Automático (Gira = aberta ao público; os outros = fechados)'],['todos','🌐 ABERTO ao público — consulentes podem ver'],['equipe','🔒 FECHADO — só filhos e cambonos'],['rascunho','📝 Rascunho — não publicar ainda']];
  const inject=(html,btn)=>{if(typeof html!=='string'||!btn)return html;const i=html.indexOf('<button class="btn primary" data-action=');return i<0?html:html.slice(0,i)+btn+html.slice(i)};
  try{
    if(typeof eventForm==='function'){
      const _ef=eventForm;
      eventForm=function(e){
        const h=_ef.apply(this,arguments);if(!configured())return h;
        const cur=(e&&e.publish)||'';
        return h+`<div class="mtx-pubsel"><label>Gira, festa ou trabalho: aberto ou fechado ao público?<select id="e_publish">${PUBL.map(([v,l])=>`<option value="${v}" ${v===cur?'selected':''}>${l}</option>`).join('')}</select></label><small class="muted">Rascunho fica só neste aparelho até você mudar. Os outros são publicados automaticamente depois de Salvar.</small><div class="form-grid" style="margin-top:10px"><label>Aparece a partir de <span class="small muted">(opcional)</span><input type="datetime-local" id="e_show_from" value="${E((e&&e.showFrom)||'')}"></label><label>Some em <span class="small muted">(opcional)</span><input type="datetime-local" id="e_show_until" value="${E((e&&e.showUntil)||'')}"></label></div><small class="muted">Ex.: um trabalho voluntário na sexta que só aparece na segunda e some no sábado 01:00. Vazio = aparece assim que publicar e fica até acabar.</small></div>`;
      };
    }
    if(typeof saveEvent==='function'){
      const _se=saveEvent;
      saveEvent=async function(id){
        const before=new Set((state.events||[]).map(x=>x.id)),sel=document.getElementById('e_publish'),pv=sel?sel.value:undefined;
        const sf=(document.getElementById('e_show_from')||{}).value||'',su=(document.getElementById('e_show_until')||{}).value||'';
        if(sel&&sf&&su&&new Date(su)<=new Date(sf)){toast('⚠ "Some em" precisa ser depois de "Aparece a partir de".');return}
        const r=await _se.apply(this,arguments);
        if(pv===undefined)return r;
        const ev=id?(state.events||[]).find(x=>x.id===id):(state.events||[]).find(x=>!before.has(x.id));
        if(ev&&((ev.publish||'')!==pv||(ev.showFrom||'')!==sf||(ev.showUntil||'')!==su)){
          if(pv)ev.publish=pv;else delete ev.publish;
          if(sf)ev.showFrom=sf;else delete ev.showFrom;
          if(su)ev.showUntil=su;else delete ev.showUntil;
          try{await persist()}catch(er){}
        }
        return r;
      };
    }
    if(typeof agendaItem==='function'){
      const _ai=agendaItem;
      agendaItem=function(e){const h=_ai.apply(this,arguments);if(!e||typeof h!=='string'||e.auto==='aniversario')return h;
        let tag='';if(e.publish==='rascunho')tag='<span class="pill warn">Rascunho</span>';else if(configured()){const ab=e.publish==='todos'?true:e.publish==='equipe'?false:consTypes().map(x=>String(x).toLowerCase()).includes(String(e.type||'').toLowerCase());tag=ab?'<span class="pill ok">🌐 Aberta</span>':'<span class="pill">🔒 Fechada</span>'}
        if(e.lastBy)tag+=` <span class="pill" title="Última alteração vinda do app">✏️ ${E(e.lastBy)} · ${E(diaBR(String(e.lastAt||'').slice(0,10)))}</span>`;
        return tag?h.replace('</b>','</b> '+tag):h};
    }
    if(typeof renderAgenda==='function'){
      const _ra=renderAgenda;
      renderAgenda=function(){const h=_ra.apply(this,arguments);return configured()?inject(h,'<button class="btn" data-mt="pubnow" title="Envia agora a agenda para filhos, cambonos e consulentes">Publicar agora</button>'):h};
    }
    if(typeof renderMembersList==='function'){
      const _rm=renderMembersList;
      renderMembersList=function(){const h=_rm.apply(this,arguments);return configured()?inject(h,'<button class="btn" data-mt="openperms">Permissões</button>'):h};
    }
  }catch(e){console.warn('mt hooks',e)}
})();
/* ======================================================================
   AULAS DO PORTAL: cada permissão libera a sua aula automaticamente (V0.9.2.0)
   ====================================================================== */
const LS_AC=k=>!!(MEM&&MEM.acessos&&MEM.acessos[k]===true);
const LESSONS=[
 {k:'basico',icon:'📱',title:'Como usar o app',desc:'Início, agenda, mensalidade e cadastro.',need:()=>true,steps:[
  ['Início','Aqui chegam os recados e avisos da casa, o que está por vir e as notificações enviadas para você.',['O sino mostra o que ainda não foi lido.','Toque em atualizar (setinha no topo) se quiser ver as novidades agora.']],
  ['Agenda','Veja as giras e os compromissos da casa com data, horário e local.',['Dias com compromisso aparecem marcados no calendário.','Toque em um dia para ver o que acontece nele.','Os aniversários dos irmãos também aparecem na agenda.']],
  ['Mensalidade','Veja os meses em aberto e os pagos.',['Para pagar, toque no mês e envie a foto do comprovante.','O Pai/Mãe confere e confirma. Você recebe um aviso.','Se algo não aparecer, avise a casa: pode faltar ligar o seu cadastro ao da casa.']],
  ['Presença na casa','Ao chegar, leia o QR Code da parede com o botão "Ler QR Code" no Início. Sua presença do dia fica registrada.',['A casa pode abrir a chamada só em certos horários.','Lendo duas vezes no mesmo dia, conta uma presença só.']],
  ['Cadastro e senha','Seus dados e a troca de senha ficam na aba Cadastro.',['Mantenha o telefone atualizado.','Ao fechar o app, ele pede a senha de novo, para proteger seus dados.']]]},
 {k:'internos',icon:'🗓️',title:'Compromissos internos',desc:'Reuniões e atividades que não são giras abertas.',need:()=>LS_AC('internos'),steps:[
  ['O que são','São os compromissos só da casa: reuniões, ensaios, mutirões, limpeza, preparação. Não aparecem para o público.',[]],
  ['Como acompanhar','Na Agenda, os internos aparecem junto com as giras. Confira horário e local e confirme sua presença com o responsável.',['Em caso de falta, avise com antecedência.','Quem não pode ver compromissos internos vê só as giras abertas.']]]},
 {k:'materiais',icon:'🕯️',title:'Materiais dos trabalhos',desc:'Lista do que cada gira ou trabalho vai usar.',need:()=>LS_AC('materiais'),steps:[
  ['Onde ver','Abra um compromisso na Agenda. Se tiver materiais, a lista aparece nos detalhes.',[]],
  ['Como se preparar','Use a lista para separar tudo com antecedência: velas, ervas, bebidas, fitas, flores e o que mais for pedido.',['Confira o estoque com quem cuida do material.','Se faltar algo, avise o Pai/Mãe com pelo menos alguns dias de antecedência.']],
  ['Depois da gira','Avise o responsável do estoque o que foi usado e o que sobrou. Assim o estoque da casa fica certo.',[]]]},
 {k:'agenda_editar',icon:'✏️',title:'Criar e editar compromissos',desc:'Como cadastrar giras e compromissos pelo celular.',need:()=>LS_AC('agenda_editar'),steps:[
  ['Novo compromisso','Na Agenda, toque em "+ Novo compromisso". Informe título, tipo, data, horário e local.',['Use títulos claros: "Gira de Caboclos", não só "Gira".','Confira a data duas vezes antes de salvar.']],
  ['Editar ou cancelar','Abra o compromisso e use Editar ou Cancelar. Se mudar a data, todos os convidados passam a ver a data nova.',[]],
  ['Aprovação',()=>LS_AC('agenda_direto')?'O Pai/Mãe liberou a publicação direta: o que você salvar aparece para todos na hora. Por isso, confira tudo antes.':'O que você salva fica "aguardando aprovação". O Pai/Mãe confere e só então aparece para todos. Você acompanha em "Minhas alterações".',[]],
  ['Boas práticas','Antes de criar, veja se o compromisso já existe, para não duplicar. Avise a casa sobre mudanças de última hora.',[]]]},
 {k:'convites',icon:'💌',title:'Enviar convites',desc:'Como convidar novos filhos, cambonos e consulentes.',need:()=>canConv(),steps:[
  ['O que o convite faz','O convite leva a pessoa para se cadastrar no módulo certo (filho, cambono ou consulente). Ela só vê o que esse módulo permite.',[]],
  ['Como enviar','Na aba Convites, escolha o tipo e toque em enviar pelo WhatsApp. Escolha o contato e confirme o envio.',['Para quem já tem cadastro, o Pai/Mãe usa "Reenviar link".']],
  ['Cuidados','Convide só quem a casa conhece. Você não troca o código da casa, só envia. Quem se cadastrar fica aguardando aprovação.',[]]]},
 {k:'cadastros',icon:'✅',title:'Validar novos cadastros',desc:'Aprovar ou recusar quem entrou pelo convite.',need:()=>canCad(),steps:[
  ['Onde fica','Na aba Convites aparecem os cadastros aguardando. O número vermelho mostra quantos são.',[]],
  ['Antes de aprovar','Confira se você conhece a pessoa e se o módulo pedido faz sentido (filho, cambono ou consulente).',['Na dúvida, pergunte ao Pai/Mãe antes de aprovar.']],
  ['Depois de aprovar','A pessoa passa a entrar no app. Quem liga o cadastro dela às Pessoas da casa (mensalidade) é o Pai/Mãe.',[]]]},
 {k:'pessoas',icon:'👥',title:'Pessoas (consulta)',desc:'Como ler a lista de cadastrados com respeito.',need:()=>LS_AC('pessoas'),steps:[
  ['O que você vê','A lista de cadastrados da casa e a situação de cada um. Dados reservados (endereço, documentos) não aparecem.',[]],
  ['Sigilo','Os dados das pessoas são da casa. Não copie nem compartilhe a lista fora do terreiro, nem em grupos abertos.',['Use para contatar um irmão, organizar a gira ou conferir quem está ativo.']]]},
 {k:'financeiro',icon:'💰',title:'Financeiro (consulta)',desc:'Como ler as contas da casa.',need:()=>LS_AC('financeiro'),steps:[
  ['O que você vê','Os lançamentos de entrada e saída e a situação financeira da casa, só para consulta.',['Entradas: mensalidades, doações, contribuições de festa.','Saídas: materiais, contas fixas, manutenção.']],
  ['Como ler','Compare o que entrou com o que saiu no mês. Saldo positivo significa que sobrou; negativo, que a casa gastou mais do que recebeu.',[]],
  ['Sigilo','Informação financeira é sensível. Fale sobre ela só com a direção da casa. Para alterar ou lançar algo, fale com o Pai/Mãe.',[]]]},
 {k:'estoque',icon:'📦',title:'Estoque: aula completa',desc:'Como administrar bem o estoque de um terreiro.',need:()=>LS_AC('estoque'),steps:[
  ['Por que controlar o estoque','Faltar material no dia da gira atrapalha o trabalho. Comprar sem controle gasta dinheiro à toa.',['Itens de consumo: velas, ervas, pembas, fitas, flores, charutos e cigarros de palha, bebidas, carvão, incenso, limpeza e cozinha.','Com o estoque em dia você sabe o que comprar, quanto e quando.']],
  ['Como ver o estoque no app','Abra a aba Áreas e depois Estoque & Compras. Você vê cada item com a quantidade atual e o que está baixo.',['Com a permissão de mexer no estoque aparecem os botões Entrada, Saída e Editar. Sem ela, é só consulta.']],
  ['Mínimo e ideal','São os dois números que fazem o controle funcionar.',['Mínimo: o que se usa até a compra chegar. Abaixo dele, o item é alertado.','Ideal: quanto se quer ter logo depois de comprar. Ele define quanto comprar.','Exemplo, velas: 20 pacotes por gira, 4 giras no mês, compra mensal. Ideal 80, mínimo 30.']],
  ['Baixo, crítico e zerado','Baixo é abaixo do mínimo. Crítico é metade do mínimo ou menos. Zerado é quando acabou.',['Baixo: já dá para planejar a compra.','Crítico: comprar logo.','Zerado: urgente, se for essencial para a gira.']],
  ['Registrar entradas e saídas','Todo material que entra (compra, doação, sobra) e que sai (gira, perda, vencimento) deve ser registrado. É isso que mantém o saldo verdadeiro.',['Hábito que funciona: ao fim de cada gira, quem cuida do material registra as saídas.','Avise o Pai/Mãe o que foi usado, caso o registro seja feito por ele.']],
  ['Contagem mensal','Uma vez por mês, ou antes de uma festa grande, conte o que existe de verdade e compare com o app.',['Diferenças mostram desperdício, perda ou retirada sem registro.','Aproveite para ver a validade de bebidas e alimentos.']],
  ['Lista de compras e cotação','Com os itens baixos em mãos, monta-se a lista de compras, separada por fornecedor. Peça preço a dois ou três fornecedores e compare valor, frete e prazo.',['O mais barato nem sempre é o melhor.','Deixe uns 15 dias de antecedência para festas.']],
  ['Recebimento','Ao receber o pedido, confira quantidade e qualidade antes de dar entrada. Se vier só uma parte, registre o que chegou e acompanhe o que falta.',[]],
  ['Boas práticas de guarda','Estoque organizado dura mais e se perde menos.',['Local seco, limpo e ventilado, com etiqueta e data.','O que chegou primeiro, sai primeiro.','Separe o material da casa do material de uso pessoal.','Defina uma pessoa responsável e outra para conferir.']],
  ['Rotina simples','Resumo para o dia a dia:',['Após cada gira: registrar as saídas.','Toda semana: olhar o que está baixo.','Todo mês: contar o estoque e revisar mínimo e ideal.','Antes de festas: planejar, cotar e comprar com antecedência.']]]},
 {k:'fornecedores',icon:'🚚',title:'Fornecedores (consulta)',desc:'Quem fornece os materiais da casa.',need:()=>LS_AC('fornecedores'),steps:[
  ['O que você vê','A lista de fornecedores com contato e categorias. Ajuda a saber onde achar cada material.',[]],
  ['Como usar','Antes de pedir algo, veja se a casa já tem um fornecedor preferencial para o item. Combine as compras com o Pai/Mãe, para não duplicar pedidos.',[]]]},
 {k:'patrimonio',icon:'🏛️',title:'Patrimônio (consulta)',desc:'Os bens da casa e onde estão.',need:()=>LS_AC('patrimonio'),steps:[
  ['O que você vê','Objetos, imagens, instrumentos e equipamentos da casa, com a localização de cada um.',[]],
  ['Cuidados','Use com zelo e devolva ao lugar. Se algo quebrar ou sumir, avise o responsável para atualizar o registro.',[]]]},
 {k:'documentos',icon:'📄',title:'Documentos (consulta)',desc:'Atas, recibos e papéis da casa.',need:()=>LS_AC('documentos'),steps:[
  ['O que você vê','A lista de documentos da casa, com título e data. Os arquivos em si ficam com o Pai/Mãe.',[]],
  ['Como usar','Se precisar de algum documento, anote o título e peça à direção.',[]]]},
 {k:'comunicacao',icon:'💬',title:'Comunicação (consulta)',desc:'Mensagens e comunicados da casa.',need:()=>LS_AC('comunicacao'),steps:[
  ['O que você vê','Os comunicados e mensagens que a casa programou ou enviou aos irmãos.',[]],
  ['Como usar','Leia para ficar por dentro do que foi avisado e evitar repetir recados. Novos comunicados são feitos pelo Pai/Mãe.',[]]]},
 {k:'trabalhos',icon:'🕯️',title:'Trabalhos espirituais (consulta)',desc:'Trabalhos agendados e realizados.',need:()=>LS_AC('trabalhos'),steps:[
  ['O que você vê','Os trabalhos espirituais da casa: o que está agendado e o que já foi feito.',[]],
  ['Como usar','Use para saber a data e a preparação de cada trabalho. Os detalhes reservados continuam com a direção.',[]]]},
 {k:'festas',icon:'🎉',title:'Festas e eventos (consulta)',desc:'Festas e eventos da casa.',need:()=>LS_AC('festas'),steps:[
  ['O que você vê','As festas e eventos da casa, com data e situação.',[]],
  ['Como ajudar','Veja com antecedência e ofereça ajuda: material, cozinha, organização. Festa boa depende de muitas mãos.',[]]]},
 {k:'relatorios',icon:'📊',title:'Relatórios (consulta)',desc:'Os principais números da casa.',need:()=>LS_AC('relatorios'),steps:[
  ['O que você vê','Um resumo com os principais números da casa.',[]],
  ['Como ler','Use para acompanhar a saúde da casa: presença, contas e movimento. Em caso de dúvida, pergunte à direção.',[]]]}
];
const lesKey=()=>'mt_lessons_'+(MEM?MEM.user_id:'');
const lesSeen=()=>jget(lesKey())||{};
const lesList=()=>(!MEM||MEM.papel==='consulente'||MEM.papel==='pai_mae')?[]:LESSONS.filter(l=>{try{return l.need()}catch(e){return false}});
const lesNew=()=>{const s=lesSeen();return lesList().filter(l=>!s[l.k])};
function lesBody(){
  const L=lesList(),s=lesSeen();
  if(PT.lesson){
    const l=LESSONS.find(x=>x.k===PT.lesson);
    if(l){
      const i=Math.max(0,Math.min(PT.lstep||0,l.steps.length-1)),[t,x,pts]=l.steps[i],tx=typeof x==='function'?x():x,last=i===l.steps.length-1;
      return `<button class="btn sm" data-mt="les" data-a="close">‹ Todas as aulas</button><h2 class="ptl-h">${l.icon} ${E(l.title)}</h2><div class="mtq-prog"><i style="width:${Math.round((i+1)/l.steps.length*100)}%"></i></div><p class="small muted">Passo ${i+1} de ${l.steps.length}</p>
        <div class="ptl-sec"><h3>${E(t)}</h3><p style="line-height:1.6;font-size:15px">${E(tx)}</p>${pts&&pts.length?`<ul class="mtq-pts">${pts.map(p=>`<li>${E(p)}</li>`).join('')}</ul>`:''}</div>
        <div class="mtx-btns">${i>0?`<button class="btn" data-mt="les" data-a="step" data-n="${i-1}">Voltar</button>`:''}${last?`<button class="btn primary" data-mt="les" data-a="close">✓ Concluir aula</button>`:`<button class="btn primary" data-mt="les" data-a="step" data-n="${i+1}">Próximo</button>`}</div>`;
    }
  }
  return `<h2 class="ptl-h">🎓 Minhas aulas</h2><p class="muted small">As aulas aparecem de acordo com o que a casa liberou para você. Quando ganhar uma nova permissão, a aula dela aparece aqui sozinha.</p>
    ${L.map(l=>`<button class="ptl-sec mtq-les" data-mt="les" data-a="open" data-k="${l.k}"><span class="mtq-lico">${l.icon}</span><span class="grow"><b>${E(l.title)}</b><small>${E(l.desc)} · aula prática, ${l.steps.length} passos</small></span>${s[l.k]?'<span class="pill ok">Vista</span>':'<span class="pill warn">Nova</span>'}</button>`).join('')}`;
}
function lesCard(){
  const n=lesNew().length,t=lesList().length;if(!t)return '';
  return `<div class="ptl-sec mtq-pres"><h3>🎓 Aulas</h3><p class="small muted">${n?`Você tem <b>${n}</b> aula(s) nova(s), de acordo com as suas permissões.`:'Reveja as aulas quando quiser.'}</p><button class="btn ${n?'primary':''}" data-mt="les" data-a="list">Abrir minhas aulas</button></div>`;
}

/* ======================================================================
   SENHAS DE GIRA E PRESENÇA POR QR CODE  (V0.9.0.0)
   ====================================================================== */
const QR={tok:null,sessao:null,senhas:[],pres:[],err:'',timer:null,busy:false,at:0};
const QRU=k=>location.origin+location.pathname.replace(/index\.html$/,'')+'?'+(k==='senha'?'senha':'presenca')+'='+(QR.tok?QR.tok[k]:'');
function qrSvg(url,px){
  try{
    if(typeof qrcode!=='function')return '';
    const q=qrcode(0,'M');q.addData(url);q.make();
    return q.createSvgTag({cellSize:4,margin:2,scalable:true}).replace('<svg','<svg role="img" aria-label="QR Code" style="width:'+(px||220)+'px;height:'+(px||220)+'px;background:#fff"');
  }catch(e){return ''}
}
const digs=t=>String(t||'').replace(/\D/g,'');
const waNum=s=>{let n=digs(s);if(n&&n.length<=11)n='55'+n;return n};
const hm=t=>{try{return new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
const diaBR=s=>{const [y,m,d]=String(s).split('-');return d+'/'+m+'/'+y};
const todayBR=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())}catch(e){return today()}};

async function qrLoad(quiet){
  if(QR.busy)return;QR.busy=true;
  try{
    QR.tok=await api.rpc('mt_qr_tokens');
    const l=await api.rpc('mt_senha_listar');QR.sessao=l&&l.sessao||null;QR.senhas=(l&&l.senhas)||[];
    QR.pres=await api.rpc('mt_presenca_listar',{p_dias:31})||[];
    QR.err='';QR.at=Date.now();ls.set('mt_qr_used','1');
    try{if(mergePres(QR.pres))await persist(false)}catch(e){}
  }catch(e){QR.err=e.message||'Não foi possível carregar.'}
  finally{QR.busy=false}
  if(AX._tab==='qr'&&route==='access')axPaint();
  if(!QR.timer)QR.timer=setInterval(()=>{if(document.visibilityState==='visible'&&AX._tab==='qr'&&route==='access'&&!QR.busy&&!document.querySelector('#modalRoot .overlay'))qrLoad(true)},12000);
}
/* leva as presenças lidas por QR para a Frequência da gira do mesmo dia */
function mergePres(list){
  if(!Array.isArray(list)||!list.length||typeof state==='undefined'||!state.events)return false;
  state.settings.mtPresMerged=state.settings.mtPresMerged||{};
  const done=state.settings.mtPresMerged;let ch=false;
  list.forEach(p=>{
    const key=p.user_id+'|'+p.dia;if(done[key])return;
    const l=acharLocal({pessoa_local_id:p.pessoa_local_id,nome:p.nome});if(!l)return;
    const evs=state.events.filter(e=>e.date===p.dia&&e.status!=='Cancelado'&&!e.attendanceDone&&typeof mtEventCounts==='function'&&mtEventCounts(e));
    if(!evs.length)return;
    const e=evs.find(x=>x.type==='Gira')||evs[0];
    if(Array.isArray(e.rolls)&&e.rolls.length){
      const r=e.rolls.find(x=>!x.done)||e.rolls[0];
      if(r.done)return;
      if(!r.ids.includes(l.id))r.ids.push(l.id);
      r.map=r.map||{};if(!r.map[l.id])r.map[l.id]='P';
    }else{
      e.attendance=e.attendance||{};if(!e.attendance[l.id])e.attendance[l.id]='P';
    }
    done[key]=1;ch=true;
  });
  return ch;
}

const sTag={aguardando:['Aguardando',''],chamada:['Chamada agora','ok'],atendida:['Atendida','ok'],ausente:['Não veio','bad']};
function qrBlock(kind,titulo,texto){
  const url=QR.tok?QRU(kind):'';
  return `<div class="mtq-qr"><div class="mtq-img">${qrSvg(url,200)}</div><div class="grow"><b>${titulo}</b><p class="small muted">${texto}</p><div class="small mtq-url">${E(url)}</div>
    <div class="mtx-btns"><button class="btn sm primary" data-mt="qr" data-a="print" data-k="${kind}">🖨️ Imprimir cartaz</button><button class="btn sm" data-mt="qr" data-a="copy" data-k="${kind}">Copiar link</button><button class="btn sm" data-mt="qr" data-a="rot" data-k="${kind}">Gerar novo QR</button></div></div></div>`;
}
function qrTab(){
  if(!QR.tok&&!QR.err){qrLoad();return `<div class="card mtx"><p class="small muted">Carregando…</p></div>`}
  if(!QR.tok)return `<div class="card mtx err">${E(userErr(QR.err))}<button class="btn sm" data-mt="qr" data-a="reload">Tentar de novo</button></div>`;
  const s=QR.sessao,aberta=s&&s.aberta,L=QR.senhas;
  const wait=L.filter(x=>x.status==='aguardando').length;
  const rows=L.slice().sort((a,b)=>{const o={chamada:0,aguardando:1,atendida:2,ausente:3};return (o[a.status]-o[b.status])||(a.numero-b.numero)}).map(x=>`<div class="mtx-row"><div class="mtq-n">${x.numero}</div><div class="grow"><b>${E(x.nome)}</b> <span class="pill ${sTag[x.status][1]}">${sTag[x.status][0]}</span><div class="small muted">${E(x.whatsapp)} · pegou às ${E(hm(x.hora))}</div></div><div class="mtx-act">${aberta?`<button class="btn sm primary" data-mt="qr" data-a="call" data-n="${x.numero}">Chamar</button>`:''}<button class="btn sm" data-mt="qr" data-a="wa" data-n="${x.numero}" title="Avisar pelo WhatsApp">💬</button>${x.status!=='atendida'?`<button class="btn sm" data-mt="qr" data-a="mark" data-id="${E(x.id)}" data-s="atendida">Atendida</button>`:''}${x.status!=='ausente'?`<button class="btn sm" data-mt="qr" data-a="mark" data-id="${E(x.id)}" data-s="ausente">Não veio</button>`:''}</div></div>`).join('');
  const senhaCard=`<div class="card mtx"><h3>🎟️ Senhas da gira (ordem de chegada)</h3>
    <p class="small muted">Imprima o QR Code <b>uma vez só</b> e deixe na porta. Na gira aberta ao público, você toca em <b>Abrir senhas</b> e a numeração começa do 1. Cada pessoa lê o QR, informa nome e WhatsApp e recebe o número. O número nunca se repete, e quem tenta pegar de novo recebe a mesma senha.</p>
    ${aberta?`<div class="mtq-now"><div><small>Chamando agora</small><b>${s.chamando||'—'}</b></div><div><small>Senhas entregues</small><b>${s.emitidas}${s.limite?'/'+s.limite:''}</b></div><div><small>Aguardando</small><b>${wait}</b></div></div>
      <div class="mtx-btns"><button class="btn primary" data-mt="qr" data-a="call">Chamar a próxima</button><button class="btn" data-mt="qr" data-a="close">Encerrar senhas de hoje</button><button class="btn" data-mt="qr" data-a="reload">Atualizar</button></div>
      <p class="small muted">${E(s.titulo)} · atualiza sozinho a cada poucos segundos.</p>`
    :`<div class="form-grid"><label>Nome da gira<input id="qs_titulo" maxlength="80" value="${E((s&&s.titulo)||'Gira de hoje')}"></label><label>Limite de senhas <span class="small muted">(opcional)</span><input id="qs_lim" inputmode="numeric" placeholder="sem limite"></label></div><div class="mtx-btns"><button class="btn primary" data-mt="qr" data-a="open">▶ Abrir senhas agora</button></div>${s?`<p class="small muted">Última gira: ${E(s.titulo)} · ${s.emitidas} senha(s).</p>`:''}`}
    ${L.length?`<div class="mtq-list">${rows}</div>`:aberta?'<p class="small muted">Ninguém pegou senha ainda.</p>':''}
    ${qrBlock('senha','QR Code das senhas','Cartaz para a porta: “Aponte a câmera para pegar sua senha”.')}</div>`;
  const hoje=QR.pres.filter(p=>p.dia===todayBR()),modo=QR.tok.modo,ate=QR.tok.ate,aberto=modo==='sempre'||(ate&&new Date(ate)>new Date());
  const presCard=`<div class="card mtx"><h3>📍 Presença dos filhos (chamada por QR)</h3>
    <p class="small muted">Cole o QR Code na parede. Ao chegar, o filho (ou cambono) lê o QR com o próprio app, já cadastrado, e a presença do dia entra sozinha, como bater ponto. Se houver uma gira ou evento no dia, ela também é marcada na <b>Frequência</b>.</p>
    <div class="mtq-modo"><label><input type="radio" name="qp_modo" data-mt-qpmodo="janela" ${modo==='janela'?'checked':''}> Só quando eu abrir a chamada <small class="muted">(mais seguro: ninguém marca de casa)</small></label><label><input type="radio" name="qp_modo" data-mt-qpmodo="sempre" ${modo==='sempre'?'checked':''}> Sempre aberta</label></div>
    ${modo==='janela'?`<p class="small">${aberto?`<span class="pill ok">Chamada aberta até ${E(hm(ate))}</span>`:'<span class="pill warn">Chamada fechada</span>'}</p><div class="mtx-btns"><button class="btn primary" data-mt="qr" data-a="popen" data-h="6">Abrir chamada por 6 horas</button><button class="btn" data-mt="qr" data-a="popen" data-h="3">3 horas</button>${aberto?`<button class="btn" data-mt="qr" data-a="popen" data-h="0">Fechar agora</button>`:''}</div>`:''}
    <h3 style="margin-top:14px">Presentes hoje (${hoje.length})</h3>${hoje.length?hoje.map(p=>`<div class="mtx-row"><div class="grow"><b>${E(p.nome)}</b> <span class="small muted">${E(MEMBERS_LABEL[p.papel]||p.papel)}</span></div><span class="small">${E(hm(p.hora))}</span></div>`).join(''):'<p class="small muted">Ninguém leu o QR hoje.</p>'}
    ${QR.pres.length>hoje.length?`<details class="mtq-hist"><summary>Dias anteriores (${QR.pres.length-hoje.length} registros)</summary>${QR.pres.filter(p=>p.dia!==todayBR()).slice(0,120).map(p=>`<div class="small">${E(diaBR(p.dia))} · ${E(p.nome)} · ${E(hm(p.hora))}</div>`).join('')}</details>`:''}
    ${qrBlock('presenca','QR Code da chamada presencial','Cartaz para a parede: “Leia ao chegar para registrar a sua presença”.')}</div>`;
  return senhaCard+presCard;
}
async function qrAct(t){
  const a=t.dataset.a;
  try{
    switch(a){
      case 'reload':QR.err='';await qrLoad();break;
      case 'open':{
        const lim=parseInt(val('qs_lim'),10)||null;
        busy(t,true);await api.rpc('mt_senha_abrir',{p_titulo:val('qs_titulo')||'Gira',p_limite:lim,p_evento:null});
        await qrLoad();toast('✓ Senhas abertas. A numeração começou do 1.');break}
      case 'close':{if(!confirm('Encerrar as senhas de hoje? Ninguém mais conseguirá pegar senha nesta gira.'))break;await api.rpc('mt_senha_fechar');await qrLoad();toast('Senhas encerradas.');break}
      case 'call':{
        const n=t.dataset.n?parseInt(t.dataset.n,10):null;
        busy(t,true);const r=await api.rpc('mt_senha_chamar',{p_numero:n});
        await qrLoad();
        if(r&&r.ok){toast('📣 Chamando a senha '+r.numero+' · '+r.nome);try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}}else toast('⚠ '+((r&&r.erro)||'Ninguém aguardando.'));
        break}
      case 'mark':await api.rpc('mt_senha_marcar',{p_id:t.dataset.id,p_status:t.dataset.s});await qrLoad();break;
      case 'wa':{
        const x=QR.senhas.find(y=>String(y.numero)===t.dataset.n);if(!x)break;
        const txt='Olá, '+String(x.nome).split(' ')[0]+'! A sua senha '+x.numero+' na '+((MEM&&MEM.casas&&MEM.casas.nome)||'casa')+' está sendo chamada. Pode se dirigir ao atendimento.';
        window.open('https://wa.me/'+waNum(x.whatsapp)+'?text='+encodeURIComponent(txt),'_blank');break}
      case 'popen':busy(t,true);QR.tok=await api.rpc('mt_presenca_config',{p_modo:'janela',p_horas:parseInt(t.dataset.h,10)});await qrLoad();toast(t.dataset.h==='0'?'Chamada fechada.':'✓ Chamada aberta.');break;
      case 'copy':try{await navigator.clipboard.writeText(QRU(t.dataset.k));toast('✓ Link copiado.')}catch(e){toast(QRU(t.dataset.k))}break;
      case 'rot':{
        if(!confirm('Gerar um novo QR Code? O QR já impresso deixará de funcionar e será preciso imprimir de novo.'))break;
        QR.tok=await api.rpc('mt_qr_girar',{p_tipo:t.dataset.k});axPaint();toast('✓ Novo QR gerado. Imprima o cartaz novamente.');break}
      case 'print':{
        const k=t.dataset.k,casa=(MEM&&MEM.casas&&MEM.casas.nome)||'Casa';
        const tit=k==='senha'?'Pegue a sua senha':'Chamada presencial',sub=k==='senha'?'Aponte a câmera do celular para o QR Code e receba o seu número de atendimento por ordem de chegada.':'Filhos e cambonos: leia o QR Code com o app Meu Terreiro ao chegar para registrar a sua presença de hoje.';
        const body=`<div style="text-align:center;font-family:system-ui,sans-serif;padding:24px"><div style="font-size:22px;color:#555">${E(casa)}</div><h1 style="font-size:44px;margin:14px 0">${tit}</h1><div style="width:440px;max-width:90%;margin:18px auto">${qrSvg(QRU(k),440)}</div><p style="font-size:20px;max-width:560px;margin:10px auto">${sub}</p><p style="font-size:13px;color:#777">meuterreiroapp.com.br</p></div>`;
        if(typeof printDocument==='function')printDocument(tit+' · '+casa,body);break}
    }
  }catch(e){toast('⚠ '+(e.message||'Não foi possível concluir.'));if(a==='open'||a==='call'||a==='popen')busy(t,false)}
}
document.addEventListener('change',async e=>{
  const r=e.target.closest&&e.target.closest('[data-mt-qpmodo]');if(!r||!r.checked)return;
  try{QR.tok=await api.rpc('mt_presenca_config',{p_modo:r.dataset.mtQpmodo});axPaint()}catch(er){toast('⚠ '+userErr(er.message))}
});

/* ---------------------------------------- página pública da senha (sem login) */
const TKP={tok:null,info:null,tkt:null,err:'',timer:null,lastStatus:''};
const tkKey=()=>'mt_ticket_'+(TKP.tok||'').slice(0,10);
function readSenhaParam(){
  try{const q=new URLSearchParams(location.search),t=(q.get('senha')||'').replace(/[^A-Za-z0-9]/g,'');return t.length>=16?t:null}catch(e){return null}
}
async function ticketPage(tok){
  TKP.tok=tok;TKP.tkt=jget(tkKey());stopTimers();
  tkPaint('<h2>Senha de atendimento</h2><p>Um instante…</p>');
  await tkLoad();
  TKP.timer=setInterval(()=>{if(document.visibilityState==='visible')tkLoad(true)},12000);
}
function tkPaint(html){panel(`<span class="eyebrow">Senha de atendimento</span>${html}`)}
async function tkLoad(quiet){
  try{
    const info=await api.rpc('mt_senha_info',{p_token:TKP.tok},true);TKP.info=info;
    if(info&&info.ok&&TKP.tkt){
      const st=await api.rpc('mt_senha_status',{p_token:TKP.tok,p_whatsapp:TKP.tkt.w},true);
      if(st&&st.ok&&st.semsenha){TKP.tkt=null;ls.del(tkKey())}else if(st&&st.ok){
        TKP.tkt.st=st;
        if(st.status==='chamada'&&TKP.lastStatus!=='chamada'){try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}}
        TKP.lastStatus=st.status;
      }
    }
    TKP.err='';
  }catch(e){TKP.err=e.code==='offline'?'Sem internet no momento. Tentando de novo…':(e.message||'Falha ao consultar.')}
  tkRender();
}
function tkRender(){
  const i=TKP.info,t=TKP.tkt;
  if(TKP.err&&!i){tkPaint(`<h2>Não foi possível abrir</h2><p>${E(userErr(TKP.err))}</p><button class="btn primary" data-mt="tk" data-a="refresh">Tentar de novo</button>`);return}
  if(!i||!i.ok){tkPaint(`<h2>QR Code inválido</h2><p>${E((i&&i.erro)||'Peça informação na casa.')}</p>`);return}
  const casa=`<p class="muted">${E(i.casa)}</p>`;
  if(t&&t.st&&t.st.numero){
    const s=t.st,vez=s.status==='chamada';
    const msg=vez?'<b style="color:#2f7a4d">É a sua vez! Dirija-se ao atendimento.</b>':s.status==='atendida'?'Atendimento realizado. Que as bênçãos o acompanhem.':s.status==='ausente'?'Sua senha foi marcada como ausente. Fale com a casa.':!s.aberta?'As senhas desta gira foram encerradas.':s.afrente>0?`Faltam <b>${s.afrente}</b> pessoa(s) na sua frente.`:'Você é o próximo a ser chamado.';
    tkPaint(`<h2>Sua senha</h2>${casa}<div class="mtq-big ${vez?'on':''}">${s.numero}</div><p class="mtq-msg">${msg}</p><div class="mtq-now"><div><small>Chamando agora</small><b>${s.chamando||'—'}</b></div><div><small>${E(s.titulo||'')}</small><b>${E(t.nome.split(' ')[0])}</b></div></div><p class="small muted">Esta tela atualiza sozinha. Mantenha-a aberta ou volte a ler o QR Code depois.</p>${TKP.err?`<p class="small">${E(userErr(TKP.err))}</p>`:''}<button class="btn" data-mt="tk" data-a="refresh">Atualizar agora</button>`);
    return;
  }
  if(!i.aberta){tkPaint(`<h2>Senhas ainda não abertas</h2>${casa}<p>A casa ainda não abriu as senhas. Aguarde e atualize esta tela.</p><button class="btn primary" data-mt="tk" data-a="refresh">Atualizar</button>`);return}
  if(i.esgotada){tkPaint(`<h2>Senhas esgotadas</h2>${casa}<p>As senhas de hoje acabaram. Procure a organização da casa.</p>`);return}
  tkPaint(`<h2>${E(i.titulo||'Gira')}</h2>${casa}<p>Informe seus dados para receber o número de atendimento por ordem de chegada.</p>
    <div class="auth-error" id="mtErr" role="alert"></div>
    <label>Seu nome<input id="tk_nome" maxlength="80" autocomplete="name" placeholder="Nome e sobrenome"></label>
    <label>WhatsApp com DDD<input id="tk_w" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-0000"></label>
    <p class="small muted">Já foram entregues ${i.emitidas||0} senha(s). Cada WhatsApp recebe uma senha por gira.</p>
    <button class="btn primary" data-mt="tk" data-a="get">Pegar minha senha</button>`);
}
async function tkGet(t){
  const nome=val('tk_nome'),w=val('tk_w'),er=document.getElementById('mtErr'),bad=m=>{if(er){er.textContent=m;er.classList.add('show')}};
  if(nome.length<2)return bad('Informe o seu nome.');
  if(digs(w).length<10)return bad('Informe o WhatsApp com DDD.');
  busy(t,true,'Gerando…');
  try{
    const r=await api.rpc('mt_senha_pegar',{p_token:TKP.tok,p_nome:nome,p_whatsapp:w},true);
    if(!r||!r.ok){busy(t,false);return bad((r&&r.erro)||'Não foi possível gerar a senha.')}
    TKP.tkt={w:digs(w),nome:r.nome,numero:r.numero};ls.set(tkKey(),JSON.stringify({w:digs(w),nome:r.nome,numero:r.numero}));
    await tkLoad();
  }catch(e){busy(t,false);bad(e.code==='offline'?'Sem internet. Tente de novo.':(e.message||'Falha ao gerar a senha.'))}
}

/* -------------------------------------------- presença por QR (filho/cambono) */
function readPresParam(){
  try{
    const q=new URLSearchParams(location.search),t=(q.get('presenca')||'').replace(/[^A-Za-z0-9]/g,'');
    if(t.length<16)return null;
    history.replaceState(null,'',location.pathname);
    ls.set('mt_pres_pending',JSON.stringify({t,at:Date.now()}));return t;
  }catch(e){return null}
}
function presOverlay(html){
  let o=document.getElementById('mtPres');if(!o){o=document.createElement('div');o.id='mtPres';document.body.appendChild(o)}
  o.innerHTML=`<div class="mtq-ov"><div class="mtq-card">${html}</div></div>`;
}
function presClose(){const o=document.getElementById('mtPres');if(o)o.remove();stopScan()}
async function presMark(tok){
  presOverlay('<h2>Registrando presença…</h2><p>Um instante.</p>');
  try{
    const r=await api.rpc('mt_presenca_marcar',{p_token:tok});
    if(r&&r.ok){
      presOverlay(`<div class="mtq-ok">✓</div><h2>${r.ja?'Presença já registrada hoje':'Presença registrada!'}</h2><p>${E(r.nome||'')}<br>${E(diaBR(r.dia))} às ${E(hm(r.hora))}</p><button class="btn primary" data-mt="pres" data-a="close">Fechar</button>`);
      PT.pres=undefined;if(document.getElementById('mtPortal'))portalPaint();
    }else presOverlay(`<h2>Não foi possível registrar</h2><p>${E((r&&r.erro)||'Tente de novo.')}</p><button class="btn primary" data-mt="pres" data-a="close">Fechar</button>`);
  }catch(e){presOverlay(`<h2>Não foi possível registrar</h2><p>${E(e.code==='offline'?'Sem internet. Tente de novo.':(e.message||'Falha.'))}</p><button class="btn primary" data-mt="pres" data-a="close">Fechar</button>`)}
}
function presPending(){
  const p=jget('mt_pres_pending');if(!p)return;
  ls.del('mt_pres_pending');
  if(Date.now()-p.at>12*3600*1000||!S||!MEM)return;
  presMark(p.t);
}
let SCAN=null;
function stopScan(){if(SCAN){SCAN.stop=true;try{SCAN.stream&&SCAN.stream.getTracks().forEach(x=>x.stop())}catch(e){}SCAN=null}}
async function presScan(){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    presOverlay(`<h2>Ler o QR Code da parede</h2><p>Abra a <b>câmera do celular</b> e aponte para o QR Code da parede. O Meu Terreiro abre sozinho e registra a sua presença.</p><button class="btn primary" data-mt="pres" data-a="close">Entendi</button>`);return;
  }
  presOverlay(`<h2>Aponte para o QR Code</h2><video id="mtScanV" playsinline muted style="width:100%;border-radius:12px;background:#000"></video><p class="small muted" id="mtScanMsg">Abrindo a câmera…</p><button class="btn" data-mt="pres" data-a="close">Cancelar</button>`);
  SCAN={stop:false,stream:null};
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
    if(!SCAN||SCAN.stop){stream.getTracks().forEach(x=>x.stop());return}
    SCAN.stream=stream;const v=document.getElementById('mtScanV');v.srcObject=stream;await v.play();
    const det=new BarcodeDetector({formats:['qr_code']});const m=document.getElementById('mtScanMsg');if(m)m.textContent='Procurando o QR Code…';
    const loop=async()=>{
      if(!SCAN||SCAN.stop)return;
      try{
        const r=await det.detect(v);
        for(const c of r){
          let tk=null;try{tk=new URL(c.rawValue).searchParams.get('presenca')}catch(e){}
          if(tk){stopScan();presMark(tk.replace(/[^A-Za-z0-9]/g,''));return}
        }
      }catch(e){}
      setTimeout(loop,300);
    };loop();
  }catch(e){stopScan();presOverlay(`<h2>Câmera indisponível</h2><p>Permita o uso da câmera ou abra a câmera do celular e aponte para o QR Code da parede.</p><button class="btn primary" data-mt="pres" data-a="close">Fechar</button>`)}
}
async function presLoadMine(){
  if(PT.pres!==undefined)return;PT.pres=null;
  try{PT.pres=await api.rpc('mt_presenca_minhas')||[]}catch(e){PT.pres=[]}
  if(document.getElementById('mtPortal')&&PT.tab==='inicio')portalPaint();
}
function presCard(){
  if(isCons()||!MEM||MEM.papel==='pai_mae')return '';
  presLoadMine();
  const L=PT.pres||[],hoje=L.some(p=>p.dia===todayBR());
  return `<div class="ptl-sec mtq-pres"><h3>📍 Presença na casa</h3>${hoje?'<p class="small"><span class="pill ok">Presença de hoje registrada</span></p>':'<p class="small muted">Chegou na casa? Leia o QR Code da parede para registrar a sua presença.</p>'}<button class="btn primary" data-mt="pres" data-a="scan">${hoje?'Ler o QR novamente':'Ler QR Code da parede'}</button>${L.length?`<details class="mtq-hist"><summary>Minhas últimas presenças (${L.length})</summary>${L.slice(0,40).map(p=>`<div class="small">${E(diaBR(p.dia))} · ${E(hm(p.hora))}</div>`).join('')}</details>`:''}</div>`;
}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-mt="qr"],[data-mt="tk"],[data-mt="pres"],[data-mt="les"]');if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();
  const k=t.dataset.mt,a=t.dataset.a;
  if(k==='qr')qrAct(t);
  else if(k==='tk'){if(a==='get')tkGet(t);else if(a==='refresh')tkLoad()}
  else if(k==='pres'){if(a==='close')presClose();else if(a==='scan')presScan()}
  else if(k==='les'){
    const seen=()=>{const o=lesSeen();if(PT.lesson)o[PT.lesson]=1;ls.set(lesKey(),JSON.stringify(o))};
    if(a==='open'){const kk=t.dataset.k,o=lesSeen();o[kk]=1;ls.set(lesKey(),JSON.stringify(o));PT.tab='aulas';PT.lesson=null;setTimeout(()=>guiaLesson(kk),40)}
    else if(a==='list'){PT.tab='aulas';PT.lesson=null}
    else if(a==='close'){seen();PT.lesson=null}
    else if(a==='step'){PT.lstep=parseInt(t.dataset.n,10)||0}
    portalPaint();const m=document.querySelector('#mtPortal .ptl-main');if(m)m.scrollTop=0;
  }
},true);

/* ======================================================================
   CONFIRMAR ALTERAÇÕES: aviso com "Cancelar alterações" / "Salvar alterações" (V0.9.3.0)
   ====================================================================== */
const REV_KEYS=[['events','Agenda','compromisso'],['members','Pessoas','pessoa'],['transactions','Financeiro','lançamento'],['stock','Estoque','item de estoque'],['suppliers','Fornecedores','fornecedor'],['assets','Patrimônio','bem'],['documents','Documentos','documento'],['messages','Comunicação','mensagem']];
const REV_AREA={members:['pessoas','Pessoas'],transactions:['financeiro','Financeiro'],stock:['estoque','Estoque & Compras'],suppliers:['fornecedores','Fornecedores'],assets:['patrimonio','Patrimônio'],documents:['documentos','Documentos'],messages:['comunicacao','Comunicação']};
const REV_F={
 events:{title:'Título',type:'Tipo',date:'Data',time:'Hora',endTime:'Hora final',location:'Local',status:'Situação',responsibleId:'Responsável',publish:'Aberto ou fechado',notes:'Observações',materials:'Materiais',participants:'Convidados'},
 members:{name:'Nome',role:'Função',kind:'Tipo de pessoa',phone:'Telefone',whatsapp:'WhatsApp',email:'E-mail',birth:'Nascimento',status:'Situação',group:'Grupo',since:'Entrada',feeValue:'Valor da mensalidade',feeDueDay:'Dia de vencimento',contribMode:'Contribuição'},
 transactions:{description:'Descrição',type:'Tipo',date:'Data',value:'Valor',status:'Situação',category:'Categoria'},
 stock:{name:'Nome',category:'Categoria',unit:'Unidade',qty:'Quantidade',min:'Mínimo',ideal:'Ideal',cost:'Custo',supplierId:'Fornecedor'},
 suppliers:{name:'Nome',phone:'Telefone',category:'Categoria',status:'Situação'},
 assets:{name:'Nome',category:'Categoria',location:'Local',value:'Valor',status:'Estado'},
 documents:{title:'Título',category:'Categoria',date:'Data'},
 messages:{title:'Título',text:'Texto',date:'Data',audience:'Para quem'}
};
const REV_MONEY=new Set(['value','cost','feeValue']);
function revVal(k,f,v){
  if(v===undefined||v===null||v==='')return '(vazio)';
  if(f==='participants')return (Array.isArray(v)?v.length:0)+' pessoa(s)';
  if(f==='responsibleId'||f==='supplierId'){const L=f==='supplierId'?(state.suppliers||[]):(state.members||[]);const o=L.find(x=>x.id===v);return o?o.name:'(removido)'}
  if(f==='publish')return v==='todos'?'ABERTO ao público':v==='equipe'?'FECHADO (só equipe)':v==='rascunho'?'Rascunho':'Automático';
  if(REV_MONEY.has(f)&&typeof money==='function'&&!isNaN(Number(v)))return money(Number(v));
  if((f==='date'||f==='birth'||f==='since')&&/^\d{4}-\d{2}-\d{2}/.test(String(v)))return diaBR(String(v).slice(0,10));
  const t=String(v);return t.length>44?t.slice(0,42)+'…':t;
}
const revName=o=>String(o.title||o.name||o.description||'sem nome');
function evAberto(e){return e.publish==='todos'?true:e.publish==='equipe'?false:consTypes().map(x=>String(x).toLowerCase()).includes(String(e.type||'').toLowerCase())}
function revDiff(before){
  const out=[];
  REV_KEYS.forEach(([k,mod,nome])=>{
    const A=(before[k]||[]).filter(x=>!(x&&x.auto)),B=(state[k]||[]).filter(x=>!(x&&x.auto));
    const mA=new Map(A.map(x=>[x.id,x])),mB=new Map(B.map(x=>[x.id,x]));
    B.forEach(n=>{
      const o=mA.get(n.id);
      if(!o){out.push({k,mod,tipo:'novo',nome,item:n,lines:[]});return}
      const lines=[];Object.keys(REV_F[k]).forEach(f=>{
        if(JSON.stringify(o[f]??'')!==JSON.stringify(n[f]??''))lines.push(`<b>${E(REV_F[k][f])}:</b> ${E(revVal(k,f,o[f]))} → ${E(revVal(k,f,n[f]))}`);
      });
      if(lines.length)out.push({k,mod,tipo:'alterado',nome,item:n,lines,fields:Object.keys(REV_F[k]).filter(f=>JSON.stringify(o[f]??'')!==JSON.stringify(n[f]??''))});
    });
    A.forEach(o=>{if(!mB.has(o.id))out.push({k,mod,tipo:'excluido',nome,item:o,lines:[]})});
  });
  return out;
}
function revDest(d){
  if(!configured()||!adminActive())return '📱 Fica só neste aparelho.';
  const it=d.item;
  if(d.k==='events'){
    if(d.tipo==='excluido')return '☁️ Some da agenda de todos.';
    if(it.publish==='rascunho')return '📱 Rascunho: fica só neste aparelho.';
    return '☁️ Vai para todos (filhos e cambonos). '+(evAberto(it)?'🌐 Aberto: os consulentes também veem.':'🔒 Fechado: os consulentes não veem.');
  }
  let s='';
  if(d.k==='members'&&d.fields&&d.fields.some(f=>['feeValue','feeDueDay','contribMode'].includes(f)))s='☁️ A mensalidade desta pessoa atualiza no app dela. ';
  const a=REV_AREA[d.k];
  if(a&&areaOn(a[0]))return s+`☁️ Atualiza a área "${a[1]}" no app de quem tem acesso.`;
  return s+'📱 Os dados ficam só neste aparelho.';
}
function revShow(diff,beforeStr){
  REV.pending=true;REV.before=beforeStr;
  const T={novo:['➕','Novo(a)'],alterado:['✏️','Alterado(a)'],excluido:['🗑','Excluído(a)']};
  const html=diff.map(d=>`<div class="mtr-i"><b>${T[d.tipo][0]} ${T[d.tipo][1]} ${E(d.nome)} · ${E(d.mod)}: ${E(revName(d.item))}</b>${d.lines.length?`<ul>${d.lines.map(l=>`<li>${l}</li>`).join('')}</ul>`:''}<small>${revDest(d)}</small></div>`).join('');
  const o=document.createElement('div');o.id='mtRev';
  o.innerHTML=`<div class="mtq-ov"><div class="mtq-card mtr-card"><h2>Confirmar alterações</h2><p class="small muted">Confira o que você acabou de mudar. Ao salvar, o que está na nuvem é atualizado para todos. O que é só do aparelho fica no aparelho.</p><div class="mtr-list">${html}</div><label class="mtr-never"><input type="checkbox" id="mtRevOff"> Não mostrar este aviso de novo</label><div class="mtx-btns"><button class="btn" data-mt="rev" data-a="cancel">Cancelar alterações</button><button class="btn primary" data-mt="rev" data-a="save">Salvar alterações</button></div></div></div>`;
  const old=document.getElementById('mtRev');if(old)old.remove();
  document.body.appendChild(o);
}
async function revDone(save){
  const off=!!(document.getElementById('mtRevOff')||{}).checked;
  const hasCloud=configured()&&adminActive();
  const el=document.getElementById('mtRev');if(el)el.remove();
  try{
    if(save){
      if(off){state.settings.mtReview=false}
      REV.pending=false;REV.before=null;
      if(off)await persist(false);
      if(hasCloud){try{await syncAll(true)}catch(e){}}
      toast(hasCloud?'✓ Alterações salvas e enviadas para todos.':'✓ Alterações salvas neste aparelho.');
    }else{
      const o=JSON.parse(REV.before);
      Object.keys(state).forEach(k=>{if(!(k in o))delete state[k]});
      Object.assign(state,o);
      if(off)state.settings.mtReview=false;
      REV.pending=false;REV.before=null;
      await persist(false);
      if(typeof render==='function')render();
      toast('Alterações canceladas. Nada foi mudado.');
    }
  }catch(e){REV.pending=false;toast('⚠ '+(e.message||'Não foi possível concluir.'))}
}
function revWrap(name){
  const orig=window[name];if(typeof orig!=='function')return;
  window[name]=async function(){
    if(REV.pending||(state.settings&&state.settings.mtReview===false))return orig.apply(this,arguments);
    let str;try{str=JSON.stringify(state)}catch(e){return orig.apply(this,arguments)}
    const before=JSON.parse(str);REV.pending=true;
    let r;
    try{r=await orig.apply(this,arguments)}finally{REV.pending=false}
    let diff=[];try{diff=revDiff(before)}catch(e){}
    if(!diff.length){try{syncSoon()}catch(e){}return r}
    revShow(diff,str);
    return r;
  };
}
['saveEvent','saveMember','saveTransaction','saveStock','saveStockMove','saveSupplier','saveAsset','saveDocument','saveMessage'].forEach(revWrap);
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-mt="rev"]');if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();
  const b=t.dataset.a==='save'||t.dataset.a==='cancel'?t:null;if(!b)return;
  revDone(t.dataset.a==='save');
},true);

/* ---- Registro de ações (quem fez o quê) ---- */
function logAcao(acao,detalhe){
  try{if(!MEM||MEM.papel==='pai_mae'||!configured())return;api.rpc('mt_registrar_acao',{p_acao:acao,p_detalhe:detalhe||''}).catch(()=>{})}catch(e){}
}
const REG={list:null,err:'',busy:false};
const REG_LBL={convite_enviado:['📨','enviou convite'],convite_copiado:['🔗','copiou o link de convite'],cadastro_aprovado:['✅','aprovou o cadastro de'],cadastro_recusado:['🚫','recusou o cadastro de'],estoque_entrada:['📥','deu entrada no estoque:'],estoque_saida:['📤','deu saída no estoque:'],estoque_ajuste:['🧮','ajustou o estoque:'],estoque_item_novo:['🆕','cadastrou item no estoque:'],estoque_item_editado:['✏️','editou item do estoque:'],fin_lancou:['💰','lançou no Financeiro:'],fin_lancou_pendente:['⏳','lançou (aguarda sua aprovação):'],fin_baixa:['✔️','deu baixa no Financeiro:'],fin_cancelou:['✖️','cancelou no Financeiro:'],mod_criou:['🆕','cadastrou:'],mod_editou:['✏️','editou:']};
async function regLoad(){
  if(REG.busy)return;REG.busy=true;
  try{REG.list=await api.rpc('mt_registro_listar',{p_limite:150})||[];REG.err='';FIN.pend=await api.select('fin_lancamentos','aprovacao=eq.pendente&select=*&order=criado_em.asc').catch(()=>[]);const cf=await api.select('fin_config','select=*').catch(()=>[]);FIN.cfg=(cf&&cf[0])||null}
  catch(e){REG.err=e.message||'Não foi possível carregar.';REG.list=REG.list||[]}
  finally{REG.busy=false}
  if(AX._tab==='registro'&&route==='access')axPaint();
}
function finAdminCard(){
  const P=FIN.pend||[],lim=FIN.cfg?Number(FIN.cfg.limite_centavos||0):0;
  return `<div class="mtx-leg" style="margin:10px 0"><b>💰 Financeiro da tesouraria: aprovações e limite</b><p class="small">Lançamentos acima do limite esperam a sua aprovação. Deixe 0 para não ter limite.</p><div class="form-grid"><label>Limite por lançamento (R$)<input id="fin_lim" inputmode="decimal" value="${lim?String((lim/100).toFixed(2)).replace('.',','):''}" placeholder="0,00 (sem limite)"></label></div><div class="mtx-btns"><button class="btn sm primary" data-mt="fin" data-a="lim">Salvar limite</button></div>${P.length?`<h4 style="margin-top:10px">Aguardando a sua aprovação (${P.length})</h4>${P.map(r=>`<div class="mtx-row"><div class="grow"><b>${E(r.descricao)}</b> · ${E(finBR(r.valor))}<div class="small muted">${E(r.por_nome||'')} · ${E(r.tipo==='Despesa'?'a pagar':'a receber')}</div></div><button class="btn sm primary" data-mt="fin" data-a="ok" data-id="${r.id}">Aprovar</button><button class="btn sm" data-mt="fin" data-a="no" data-id="${r.id}">Recusar</button></div>`).join('')}`:'<p class="small muted">Nenhum lançamento esperando aprovação.</p>'}</div>`;
}
function regTab(){
  if(REG.list===null&&!REG.err){regLoad();return `<div class="card mtx"><p class="small muted">Carregando…</p></div>`}
  const fmt=d=>{try{return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
  const rows=(REG.list||[]).map(r=>({em:r.em,nome:r.nome,txt:(REG_LBL[r.acao]||['•','fez'])[1]+' '+(r.detalhe||''),ic:(REG_LBL[r.acao]||['•'])[0],pap:r.papel}));
  (AX.hist||[]).forEach(h=>rows.push({em:h.em,nome:h.por_nome||'Alguém',txt:({criou:'criou na agenda:',editou:'editou na agenda:',cancelou:'cancelou na agenda:'}[h.acao]||'mexeu na agenda:')+' '+(h.titulo||''),ic:'📅'}));
  rows.sort((a,b)=>String(b.em).localeCompare(String(a.em)));
  return `<div class="card mtx"><h3>Quem fez o quê</h3><p class="small muted">Tudo o que filhos e cambonos com permissão fizeram pelo celular: agenda, convites, cadastros, estoque e financeiro. O servidor grava o nome de quem fez, ninguém consegue apagar nem trocar.</p><div class="mtx-btns"><button class="btn sm" data-mt="reg" data-a="reload">↻ Atualizar</button></div>${finAdminCard()}${REG.err?`<p class="small" style="color:#a33">⚠ ${E(userErr(REG.err))}</p>`:''}<div style="margin-top:8px">${rows.length?rows.slice(0,120).map(r=>`<div class="mtx-row"><span style="font-size:20px">${r.ic}</span><div class="grow"><b>${E(r.nome)}</b> ${E(r.txt)}<div class="small muted">${E(fmt(r.em))}</div></div></div>`).join(''):'<p class="small muted">Ainda não há registros.</p>'}</div></div>`;
}

/* ---- Estoque na nuvem ---- */
const EST={itens:null,movs:[],err:'',busy:false,q:''};
const canEst=()=>!!MEM&&MEM.acessos&&MEM.acessos.estoque_editar===true;
const nfmt=n=>{n=Number(n||0);return Number.isInteger(n)?String(n):n.toFixed(2).replace(/\.?0+$/,'')};
function pubStock(){return (state.stock||[]).filter(s=>s&&s.id&&s.name).map(s=>({local_id:String(s.id),nome:s.name,categoria:s.category||'',unidade:s.unit||'un',qtd:Number(s.qty)||0,minimo:Number(s.min)||0,ideal:Number(s.ideal)||0}))}
async function estPush(force){
  const it=pubStock(),sig=hash(JSON.stringify(it));
  if(!force&&sig===ls.get('mt_cloud_sigS'))return;
  if(!it.length&&!force&&!ls.get('mt_cloud_sigS'))return;
  await api.rpc('mt_publicar_estoque',{p_itens:it});ls.set('mt_cloud_sigS',sig);
}
async function estPull(){
  if(!adminActive())return 0;
  let itens,movs;
  try{itens=await api.select('estoque_itens','casa_id=eq.'+MEM.casa_id+'&select=*');movs=await api.select('estoque_mov','casa_id=eq.'+MEM.casa_id+'&visto_em=is.null&select=*&order=em.asc')}
  catch(e){if(e.code==='offline')throw e;return 0}
  const byId={};(itens||[]).forEach(i=>byId[i.id]=i);
  const novosI=(itens||[]).filter(i=>i.editado_em&&!i.visto_em);
  if(!novosI.length&&!(movs||[]).length)return 0;
  state.stock=state.stock||[];state.stockMovements=state.stockMovements||[];
  novosI.forEach(i=>{
    const campos={name:i.nome,category:i.categoria||'',unit:i.unidade||'un',min:Number(i.minimo)||0,ideal:Math.max(Number(i.ideal)||0,Number(i.minimo)||0)};
    const loc=state.stock.find(x=>String(x.id)===i.local_id);
    if(loc)Object.assign(loc,campos);
    else state.stock.push(Object.assign({id:i.local_id,qty:Number(i.qtd)||0,cost:0,supplierId:''},campos));
    audit('Estoque',(loc?'Item editado':'Item criado')+' pelo app por '+(i.editado_nome||'filho/cambono'),i.nome);
  });
  (movs||[]).forEach(m=>{
    const it=byId[m.item_id],loc=it&&state.stock.find(x=>String(x.id)===it.local_id);
    if(!loc)return;
    loc.qty=Number(m.saldo_depois)||0;
    state.stockMovements.push({id:uid('sm'),date:String(m.em).slice(0,10),stockId:loc.id,itemName:loc.name,type:m.tipo,qty:Number(m.qtd)||0,reason:((m.motivo||'')+' · feito por '+m.por_nome+' pelo app').replace(/^ · /,'')});
    audit('Estoque','Movimento pelo app por '+m.por_nome+': '+m.tipo,loc.name+' · '+m.qtd);
  });
  await persist(false);
  await api.rpc('mt_estoque_visto',{p_mov:(movs||[]).map(x=>x.id),p_itens:novosI.map(x=>x.id)});
  ls.set('mt_cloud_sigS','');
  toast('📦 '+((movs||[]).length+novosI.length)+' alteração(ões) de estoque vieram do app e já estão no seu Estoque.');
  if(typeof render==='function'&&['stock','home'].includes(route))render();
  return (movs||[]).length+novosI.length;
}
async function estLoad(quiet){
  if(EST.busy||!MEM||!(MEM.acessos&&MEM.acessos.estoque===true)||MEM.papel==='pai_mae')return;
  EST.busy=true;
  try{
    EST.itens=await api.select('estoque_itens','select=*&order=nome.asc');
    EST.movs=await api.select('estoque_mov','select=*&order=em.desc&limit=15');EST.err='';
  }catch(e){EST.err=e.message||'Não foi possível carregar o estoque.';EST.itens=EST.itens||[]}
  finally{EST.busy=false}
  if(document.getElementById('mtPortal')&&PT.tab==='areas'&&PT.area==='estoque')portalPaint();
}
function estLevel(i){const q=Number(i.qtd||0),m=Number(i.minimo||0);if(q<=0)return ['Zerado','bad'];if(m>0&&q<=m*.5)return ['Crítico','bad'];if(q<m)return ['Baixo','warn'];return ['Em dia','ok']}
function estBody(){
  if(EST.itens===null&&!EST.err){estLoad();return '<p class="muted small">Carregando o estoque…</p>'}
  const L=(EST.itens||[]),ed=canEst(),q=EST.q.toLowerCase();
  const low=L.filter(i=>estLevel(i)[1]!=='ok');
  const rows=L.filter(i=>!q||(i.nome+' '+i.categoria).toLowerCase().includes(q)).sort((a,b)=>(estLevel(b)[1]==='ok'?0:1)-(estLevel(a)[1]==='ok'?0:1)||a.nome.localeCompare(b.nome));
  const fmt=d=>{try{return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
  return `${EST.err?`<p class="small" style="color:#a33">⚠ ${E(userErr(EST.err))}</p>`:''}
  <p class="small"><b>${L.length} item(ns)</b>${low.length?` · <span class="pill warn">${low.length} acabando ou zerado</span>`:' · <span class="pill ok">tudo em dia</span>'}</p>
  <p class="small muted">${ed?'Você pode dar entrada, saída e cadastrar itens. Cada mudança fica registrada com o seu nome e o Pai/Mãe é avisado quando algo está acabando.':'Só consulta. Atualizado ao vivo.'}</p>
  <div class="mtx-btns" style="margin:8px 0">${ed?'<button class="btn primary" data-mt="est" data-a="new">➕ Novo item</button>':''}<button class="btn" data-mt="est" data-a="reload">↻ Atualizar</button></div>
  <input class="mtq-search" id="estQ" placeholder="Buscar item" value="${E(EST.q)}" style="width:100%;margin-bottom:8px">
  ${rows.length?rows.map(i=>{const [lv,cl]=estLevel(i);return `<div class="mtx-row" style="align-items:flex-start"><div class="grow"><b>${E(i.nome)}</b> <span class="pill ${cl}">${lv}</span><div class="small muted">${E(i.categoria||'Sem categoria')} · mínimo ${E(nfmt(i.minimo))} ${E(i.unidade)}</div><div style="font-size:20px;font-weight:700;margin-top:2px">${E(nfmt(i.qtd))} <small>${E(i.unidade)}</small></div></div>${ed?`<div class="mtx-btns" style="flex-direction:column"><button class="btn sm primary" data-mt="est" data-a="mov" data-id="${i.id}" data-t="Entrada">➕ Entrada</button><button class="btn sm" data-mt="est" data-a="mov" data-id="${i.id}" data-t="Saída">➖ Saída</button><button class="btn sm" data-mt="est" data-a="edit" data-id="${i.id}">✏️ Editar</button></div>`:''}</div>`}).join(''):'<p class="muted small">Nenhum item encontrado.</p>'}
  ${(EST.movs||[]).length?`<h3 style="margin-top:14px">Últimas movimentações</h3>${EST.movs.map(m=>`<div class="small" style="padding:4px 0;border-bottom:1px solid rgba(0,0,0,.06)"><b>${E(m.por_nome)}</b> · ${E(m.tipo)} de ${E(nfmt(m.qtd))} em <b>${E(m.item_nome)}</b>${m.motivo?` (${E(m.motivo)})`:''}<br><span class="muted">${E(fmt(m.em))} · saldo ${E(nfmt(m.saldo_depois))}</span></div>`).join('')}`:''}`;
}
function estItemModal(id){
  const i=id?(EST.itens||[]).find(x=>x.id===id):null;
  showModal(i?'Editar item':'Novo item',`<div class="form-grid"><label class="full">Nome do item<input id="es_n" maxlength="120" value="${E(i?i.nome:'')}" placeholder="Ex.: Vela branca"></label><label>Categoria<input id="es_c" maxlength="60" value="${E(i?i.categoria:'')}" placeholder="Ex.: Velas"></label><label>Unidade<input id="es_u" maxlength="12" value="${E(i?i.unidade:'un')}" placeholder="un, cx, l, kg"></label>${i?'':'<label>Quantidade agora<input id="es_q" type="number" min="0" step="0.01" value="0"></label>'}<label>Mínimo (avisar abaixo disso)<input id="es_m" type="number" min="0" step="0.01" value="${i?nfmt(i.minimo):'0'}"></label><label>Ideal (quanto ter)<input id="es_i" type="number" min="0" step="0.01" value="${i?nfmt(i.ideal):'0'}"></label></div>${i?'<p class="small muted">Para mudar a quantidade use Entrada ou Saída.</p>':''}`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-mt="est" data-a="savei" data-id="${i?i.id:''}">Salvar</button>`);
}
function estMovModal(id,tipo){
  const i=(EST.itens||[]).find(x=>x.id===id);if(!i)return;
  showModal('Movimentar · '+i.nome,`<div class="notice">Saldo atual: <b>${E(nfmt(i.qtd))} ${E(i.unidade)}</b></div><div class="form-grid" style="margin-top:12px"><label>Movimento<select id="em_t"><option ${tipo==='Entrada'?'selected':''}>Entrada</option><option ${tipo==='Saída'?'selected':''}>Saída</option><option>Ajuste</option></select></label><label>Quantidade<input id="em_q" type="number" min="0" step="0.01" value="1"></label><label class="full">Motivo <span class="small muted">(opcional)</span><input id="em_r" maxlength="200" placeholder="Ex.: usado na gira de sábado"></label></div><p class="small muted"><b>Entrada</b> soma, <b>Saída</b> tira, <b>Ajuste</b> troca o saldo pelo número que você digitar (contagem física).</p>`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-mt="est" data-a="savem" data-id="${id}">Registrar</button>`);
}
async function estAct(t){
  const a=t.dataset.a,id=t.dataset.id;
  try{
    if(a==='reload'){await estLoad();toast('✓ Estoque atualizado.')}
    else if(a==='new')estItemModal('');
    else if(a==='edit')estItemModal(id);
    else if(a==='mov')estMovModal(id,t.dataset.t);
    else if(a==='savei'){
      const d={nome:val('es_n'),categoria:val('es_c'),unidade:val('es_u')||'un',minimo:Number(val('es_m')||0),ideal:Number(val('es_i')||0)};
      if(!id)d.qtd=Number(val('es_q')||0);
      if(!d.nome){toast('⚠ Informe o nome do item.');return}
      busy(t,true);await api.rpc('mt_estoque_salvar',{p_item:id||null,p_dados:d});closeModal();toast('✓ Item salvo.');await estLoad()
    }else if(a==='savem'){
      const q=Number(val('em_q')||0),tp=val('em_t');
      if(!(q>0)&&tp!=='Ajuste'){toast('⚠ Digite a quantidade.');return}
      busy(t,true);await api.rpc('mt_estoque_mover',{p_item:id,p_tipo:tp,p_qtd:q,p_motivo:val('em_r')});closeModal();toast('✓ Estoque atualizado.');await estLoad()
    }
  }catch(er){toast('⚠ '+(er.message||er));busy(t,false)}
}
document.addEventListener('input',e=>{if(e.target&&e.target.id==='estQ'){EST.q=e.target.value;const pos=e.target.selectionStart;portalPaint();const n=document.getElementById('estQ');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}}}});
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-mt="est"],[data-mt="reg"]');if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(t.dataset.mt==='est')estAct(t);else if(t.dataset.a==='reload'){REG.list=null;regLoad()}
},true);
{const _pl=portalLoad;portalLoad=async function(){const r=await _pl.apply(this,arguments);try{await estLoad(true)}catch(e){}return r}}

/* ---- Financeiro da tesouraria (por partes) ---- */
const FIN_KEYS=['fin_pagar_ver','fin_pagar','fin_receber_ver','fin_receber','fin_mensal_ver','fin_mensal','fin_saldo'];
const hasFin=()=>!!MEM&&MEM.papel!=='pai_mae'&&!!MEM.acessos&&FIN_KEYS.some(k=>MEM.acessos[k]===true);
const finNome=g=>g==='pagar'?'fin_pagar':g==='receber'?'fin_receber':'fin_mensal';
const finOK=(g,modo)=>{const a=(MEM&&MEM.acessos)||{},n=finNome(g);return modo==='editar'?a[n]===true:(a[n]===true||a[n+'_ver']===true)};
const FIN={itens:null,saldo:null,sub:'',filt:'aberto',err:'',busy:false,pend:null,cfg:null};
const FIN_GR=[['pagar','Contas a pagar'],['receber','Contas a receber'],['mensal','Mensalidades']];
const finGrupoDe=t=>t.type==='Despesa'?'pagar':(t.category==='Mensalidade'?'mensal':'receber');
function pubFin(){
  const lim=iso(new Date(Date.now()-400*864e5)),pn=id=>{const m=(state.members||[]).find(x=>x.id===id);return m?m.name:''};
  return (state.transactions||[]).filter(t=>t&&t.id&&(t.type==='Despesa'||t.type==='Receita')&&t.date&&Number(t.value)>0&&(String(t.date)>=lim||!['Pago','Recebido','Cancelado'].includes(t.status))).slice(-4000)
    .map(t=>({local_id:String(t.id),grupo:finGrupoDe(t),descricao:t.description||'',categoria:t.category||'',valor:Math.round(Number(t.value)||0),data:String(t.date).slice(0,10),vencimento:t.dueDate?String(t.dueDate).slice(0,10):'',competencia:t.competence||'',status:t.status||'Pendente',forma:t.payment||'',pessoa_nome:pn(t.personId),obs:String(t.notes||'').slice(0,300)}));
}
async function finPush(force){
  const it=pubFin(),sig=hash(JSON.stringify(it));
  if(!force&&sig===ls.get('mt_cloud_sigF'))return;
  if(!it.length&&!force&&!ls.get('mt_cloud_sigF'))return;
  await api.rpc('mt_publicar_fin',{p_itens:it});ls.set('mt_cloud_sigF',sig);
}
async function finPull(){
  if(!adminActive())return 0;
  let rows;
  try{rows=await api.select('fin_lancamentos','casa_id=eq.'+MEM.casa_id+'&visto_em=is.null&aprovacao=eq.ok&select=*&order=atualizado_em.asc')}
  catch(e){if(e.code==='offline')throw e;return 0}
  if(!(rows||[]).length)return 0;
  state.transactions=state.transactions||[];
  rows.forEach(r=>{
    const loc=state.transactions.find(x=>String(x.id)===r.local_id),by=r.editado_nome||r.por_nome||'tesouraria';
    if(loc){
      Object.assign(loc,{status:r.status,date:String(r.data).slice(0,10),payment:r.forma||loc.payment||''});
      if(r.motivo)loc.notes=((loc.notes||'')+' · Cancelado: '+r.motivo).trim();
      loc.lastBy=by;loc.lastAt=r.editado_em||new Date().toISOString();
      audit('Financeiro',(r.status==='Cancelado'?'Cancelado':'Baixa')+' pelo app por '+by,r.descricao);
    }else{
      const pm=r.pessoa_nome&&(state.members||[]).find(m=>nrm(m.name)===nrm(r.pessoa_nome));
      state.transactions.push({id:r.local_id,type:r.tipo,date:String(r.data).slice(0,10),dueDate:r.vencimento?String(r.vencimento).slice(0,10):'',competence:r.competencia||(r.grupo==='mensal'?String(r.data).slice(0,7):''),status:r.status,description:r.descricao,category:r.categoria||(r.grupo==='mensal'?'Mensalidade':'Outros'),subcategory:'',center:'',fundId:'',accountId:'',fromAccount:'',toAccount:'',value:Number(r.valor)||0,personId:pm?pm.id:'',eventId:'',payment:r.forma||'',notes:((r.obs||'')+' · Lançado por '+by+' pelo app'+(r.pessoa_nome&&!pm?' · pessoa: '+r.pessoa_nome:'')).replace(/^ · /,''),lastBy:by,lastAt:r.criado_em});
      audit('Financeiro','Lançamento criado pelo app por '+by,r.descricao);
    }
  });
  await persist(false);
  await api.rpc('mt_fin_visto',{p_ids:rows.map(x=>x.id)});
  ls.set('mt_cloud_sigF','');
  toast('💰 '+rows.length+' alteração(ões) do Financeiro vieram do app e já estão nos seus lançamentos.');
  if(typeof render==='function')render();
  return rows.length;
}
async function finLoad(){
  if(FIN.busy||!hasFin())return;FIN.busy=true;
  try{
    FIN.itens=await api.select('fin_lancamentos','select=*&order=data.desc&limit=400');
    FIN.saldo=(MEM.acessos&&MEM.acessos.fin_saldo)?await api.rpc('mt_fin_saldo').catch(()=>null):null;FIN.err='';
  }catch(e){FIN.err=e.message||'Não foi possível carregar o Financeiro.';FIN.itens=FIN.itens||[]}
  finally{FIN.busy=false}
  if(document.getElementById('mtPortal')&&PT.tab==='areas'&&PT.area==='financeiro')portalPaint();
}
const finAberto=r=>!['Pago','Recebido','Cancelado','Concluído'].includes(r.status);
const finBR=v=>brl(Number(v||0));
const finDia=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'';
function finBody(){
  if(FIN.itens===null&&!FIN.err){finLoad();return '<p class="muted small">Carregando o Financeiro…</p>'}
  const subs=FIN_GR.filter(([g])=>finOK(g,'ver')).map(([g,t])=>[g,t]);
  if(MEM.acessos&&MEM.acessos.fin_saldo)subs.push(['saldo','Saldo']);
  if(!subs.length)return '<p class="muted small">Nenhuma parte do Financeiro liberada.</p>';
  if(!subs.some(s=>s[0]===FIN.sub))FIN.sub=subs[0][0];
  const sub=FIN.sub,L=FIN.itens||[];
  const tabs=subs.map(([k,t])=>`<button class="mtx-chip ${sub===k?'on':''}" data-mt="fin" data-a="sub" data-k="${k}">${E(t)}</button>`).join('');
  let body='';
  if(sub==='saldo'){
    const s=FIN.saldo;
    body=s?`<div class="mtx-grid"><div class="card mtx"><small>Entrou (recebido)</small><h3>${E(finBR(s.entradas))}</h3></div><div class="card mtx"><small>Saiu (pago)</small><h3>${E(finBR(s.saidas))}</h3></div><div class="card mtx"><small>Saldo</small><h3>${E(finBR(s.entradas-s.saidas))}</h3></div><div class="card mtx"><small>A receber</small><h3>${E(finBR(s.a_receber))}</h3></div><div class="card mtx"><small>A pagar</small><h3>${E(finBR(s.a_pagar))}</h3></div></div><p class="small muted">Só consulta. Valores dos lançamentos já aprovados.</p>`:'<p class="muted small">Não foi possível carregar o saldo.</p>';
  }else{
    const ed=finOK(sub,'editar'),f=FIN.filt,feito=sub==='pagar'?'Pagas':'Recebidas';
    let rows=L.filter(r=>r.grupo===sub);
    rows=f==='aberto'?rows.filter(finAberto):f==='feito'?rows.filter(r=>['Pago','Recebido'].includes(r.status)):rows;
    rows=rows.slice().sort((a,b)=>f==='aberto'?String(a.vencimento||a.data).localeCompare(String(b.vencimento||b.data)):String(b.data).localeCompare(String(a.data)));
    const chip=(k,t)=>`<button class="mtx-chip ${f===k?'on':''}" data-mt="fin" data-a="filt" data-k="${k}">${t}</button>`;
    const pill=r=>r.aprovacao==='pendente'?'<span class="pill warn">⏳ Aguardando aprovação do Pai/Mãe</span>':r.status==='Cancelado'?'<span class="pill">Cancelado</span>':finAberto(r)?((r.vencimento&&String(r.vencimento)<today())?'<span class="pill bad">Atrasado</span>':'<span class="pill warn">Em aberto</span>'):'<span class="pill ok">'+(r.tipo==='Despesa'?'Paga':'Recebida')+'</span>';
    body=`<p class="small muted">${ed?'Você pode lançar, dar baixa e cancelar nesta parte. Tudo fica registrado com o seu nome e o Pai/Mãe é avisado na hora.':'Só consulta nesta parte.'}</p>
    <div class="mtx-btns" style="margin:8px 0">${ed?`<button class="btn primary" data-mt="fin" data-a="new" data-k="${sub}">➕ Lançar</button>`:''}<button class="btn" data-mt="fin" data-a="reload">↻ Atualizar</button></div>
    <div class="mtx-chips" style="margin-bottom:8px">${chip('aberto','Em aberto')}${chip('feito',feito)}${chip('todos','Todas')}</div>
    ${rows.length?rows.map(r=>`<div class="mtx-row" style="align-items:flex-start"><div class="grow"><b>${E(r.descricao)}</b> ${pill(r)}<div class="small muted">${E(r.categoria||'')}${r.pessoa_nome?' · '+E(r.pessoa_nome):''}${r.competencia?' · '+E(r.competencia):''}${r.vencimento?' · vence '+E(finDia(r.vencimento)):' · '+E(finDia(r.data))}</div>${r.por_nome||r.editado_nome?`<div class="small muted">${r.por_nome?'Lançado por '+E(r.por_nome):''}${r.editado_nome&&r.editado_nome!==r.por_nome?' · mexeu: '+E(r.editado_nome):''}</div>`:''}${r.motivo&&r.status==='Cancelado'?`<div class="small muted">Motivo: ${E(r.motivo)}</div>`:''}<div style="font-size:19px;font-weight:700;margin-top:2px">${E(finBR(r.valor))}</div></div>${ed&&r.aprovacao==='ok'&&finAberto(r)?`<div class="mtx-btns" style="flex-direction:column"><button class="btn sm primary" data-mt="fin" data-a="baixa" data-id="${r.id}">✔ ${r.tipo==='Despesa'?'Marcar paga':'Marcar recebida'}</button><button class="btn sm" data-mt="fin" data-a="cancel" data-id="${r.id}">✖ Cancelar</button></div>`:''}</div>`).join(''):'<p class="muted small">Nada por aqui.</p>'}`;
  }
  return `${FIN.err?`<p class="small" style="color:#a33">⚠ ${E(userErr(FIN.err))}</p>`:''}<div class="mtx-chips" style="margin-bottom:10px">${tabs}</div>${body}`;
}
function finLancarModal(g){
  const pg=g==='pagar',cats=pg?['Água','Luz','Aluguel','Material de gira','Limpeza','Manutenção','Outros']:g==='mensal'?['Mensalidade']:['Doação','Evento','Venda','Outros'];
  showModal(pg?'Nova conta a pagar':g==='mensal'?'Nova mensalidade':'Nova conta a receber',`<div class="form-grid"><label class="full">Descrição<input id="fl_d" maxlength="200" placeholder="${pg?'Ex.: Conta de luz de outubro':g==='mensal'?'Ex.: Mensalidade de outubro':'Ex.: Doação da festa'}"></label>${g==='mensal'?'<label class="full">Nome da pessoa<input id="fl_p" maxlength="120" placeholder="Nome como está em Pessoas"></label><label>Mês de referência<input id="fl_cp" type="month" value="'+today().slice(0,7)+'"></label>':''}<label>Categoria<input id="fl_c" list="fl_cl" value="${g==='mensal'?'Mensalidade':''}"><datalist id="fl_cl">${cats.map(c=>`<option>${E(c)}</option>`).join('')}</datalist></label><label>Valor (R$)<input id="fl_v" inputmode="decimal" placeholder="0,00"></label><label>Data<input id="fl_dt" type="date" value="${today()}"></label><label>Vencimento<input id="fl_vc" type="date"></label><label>Situação<select id="fl_s"><option value="Pendente">${pg?'Ainda não paga':'Ainda não recebida'}</option><option value="${pg?'Pago':'Recebido'}">${pg?'Já foi paga':'Já foi recebida'}</option></select></label><label>Forma<input id="fl_f" maxlength="40" placeholder="PIX, dinheiro, cartão"></label></div><p class="small muted">Se o valor passar do limite definido pelo Pai/Mãe, o lançamento espera a aprovação dele.</p>`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-mt="fin" data-a="savel" data-k="${g}">Lançar</button>`);
}
async function finAct(t){
  const a=t.dataset.a,id=t.dataset.id,k=t.dataset.k;
  try{
    if(a==='sub'){FIN.sub=k;portalPaint()}
    else if(a==='filt'){FIN.filt=k;portalPaint()}
    else if(a==='reload'){await finLoad();toast('✓ Financeiro atualizado.')}
    else if(a==='new')finLancarModal(k);
    else if(a==='savel'){
      const v=centsFromInput(val('fl_v'));
      if(!val('fl_d')){toast('⚠ Informe a descrição.');return}
      if(!(v>0)){toast('⚠ Informe o valor.');return}
      busy(t,true);
      const nid=await api.rpc('mt_fin_lancar',{p_dados:{grupo:k,descricao:val('fl_d'),categoria:val('fl_c'),valor:v,data:val('fl_dt')||today(),vencimento:val('fl_vc'),competencia:val('fl_cp'),status:val('fl_s'),forma:val('fl_f'),pessoa_nome:val('fl_p')}});
      closeModal();await finLoad();
      const r=(FIN.itens||[]).find(x=>x.id===nid);
      toast(r&&r.aprovacao==='pendente'?'⏳ Valor acima do limite: enviado para a aprovação do Pai/Mãe.':'✓ Lançado. O Pai/Mãe já foi avisado.');
    }
    else if(a==='baixa'){
      const r=(FIN.itens||[]).find(x=>x.id===id);if(!r)return;
      showModal(r.tipo==='Despesa'?'Marcar como paga':'Marcar como recebida',`<div class="notice"><b>${E(r.descricao)}</b><br>${E(finBR(r.valor))}</div><div class="form-grid" style="margin-top:12px"><label>Data<input id="fb_dt" type="date" value="${today()}"></label><label>Forma<input id="fb_f" maxlength="40" placeholder="PIX, dinheiro, cartão"></label></div>`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-mt="fin" data-a="saveb" data-id="${id}">Confirmar</button>`);
    }
    else if(a==='saveb'){busy(t,true);await api.rpc('mt_fin_baixa',{p_id:id,p_data:val('fb_dt')||today(),p_forma:val('fb_f')});closeModal();toast('✓ Baixa registrada. O Pai/Mãe já foi avisado.');await finLoad()}
    else if(a==='cancel'){
      const r=(FIN.itens||[]).find(x=>x.id===id);if(!r)return;
      showModal('Cancelar lançamento',`<div class="notice"><b>${E(r.descricao)}</b><br>${E(finBR(r.valor))}</div><p class="small muted">O lançamento não é apagado: fica como cancelado, com o seu nome e o motivo.</p><div class="form-grid"><label class="full">Motivo<input id="fc_m" maxlength="200" placeholder="Ex.: lançado em duplicidade"></label></div>`,`<button class="btn" data-action="close-modal">Voltar</button><button class="btn danger" data-mt="fin" data-a="savec" data-id="${id}">Cancelar lançamento</button>`);
    }
    else if(a==='savec'){if(val('fc_m').length<3){toast('⚠ Explique o motivo.');return}busy(t,true);await api.rpc('mt_fin_cancelar',{p_id:id,p_motivo:val('fc_m')});closeModal();toast('Lançamento cancelado.');await finLoad()}
    /* ---- Pai/Mãe: aprovações e limite ---- */
    else if(a==='ok'||a==='no'){
      if(a==='no'&&!confirm('Recusar este lançamento?'))return;
      busy(t,true);await api.rpc('mt_fin_decidir',{p_id:id,p_aprovar:a==='ok'});toast(a==='ok'?'✓ Aprovado. Já entra nos seus lançamentos.':'Lançamento recusado.');await regLoad();if(a==='ok')syncSoon(300)
    }
    else if(a==='lim'){const v=val('fin_lim')?centsFromInput(val('fin_lim')):0;busy(t,true);await api.rpc('mt_fin_limite',{p_centavos:v});toast(v>0?'✓ Limite definido em '+finBR(v)+'.':'✓ Sem limite de valor.');await regLoad()}
  }catch(er){toast('⚠ '+(er.message||er));busy(t,false)}
}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-mt="fin"]');if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();finAct(t);
},true);
{const _pl2=portalLoad;portalLoad=async function(){const r=await _pl2.apply(this,arguments);try{await finLoad()}catch(e){}return r}}

/* ---- Módulos que a equipe pode alterar (Pessoas, Fornecedores, Patrimônio, Documentos, Comunicação, Trabalhos, Festas) ---- */
const FESTA_RX=/festa|evento|bazar|palestra|a[cç][aã]o social|curso|voluntári/i;
const reaisTxt=c=>c?String((Number(c)/100).toFixed(2)).replace('.',','):'';
const EQM={
 pessoas:{label:'Pessoas',icon:'👥',arr:'members',tit:'name',subs:['role','phone'],
  fields:[['name','Nome','text',1],['role','Função','text'],['phone','Telefone','tel'],['whatsapp','WhatsApp','tel'],['birth','Nascimento','date'],['status','Situação','select',['Ativo','Inativo']]],
  out:m=>({name:m.name,role:m.role,phone:m.phone,whatsapp:m.whatsapp,birth:m.birth,status:/^Inativ/.test(m.status||'')?'Inativo':'Ativo'}),
  patch:(l,d)=>{['name','role','phone','whatsapp','birth'].forEach(k=>{if(k in d)l[k]=d[k]});if(d.status==='Inativo'&&!/^Inativ/.test(l.status||''))l.status='Inativo';if(d.status==='Ativo'&&/^Inativ/.test(l.status||''))l.status='Ativo'},
  mk:d=>({kind:'Convidado',contribMode:'Nenhuma',feeValue:0,since:todayISO(),status:'Ativo',group:'',email:'',restricted:'',emergency:'',trackAttendance:true,giraNotify:true})},
 fornecedores:{label:'Fornecedores',icon:'🚚',arr:'suppliers',tit:'name',subs:['category','phone'],
  fields:[['name','Nome','text',1],['company','Empresa','text'],['category','Categoria','text'],['phone','Telefone','tel'],['whatsapp','WhatsApp','tel'],['email','E-mail','email'],['status','Situação','select',['Ativo','Inativo']],['notes','Observações','area']],
  out:f=>({name:f.name,company:f.company,category:f.category,phone:f.phone,whatsapp:f.whatsapp,email:f.email,status:f.status==='Inativo'?'Inativo':'Ativo',notes:f.notes}),
  patch:(l,d)=>Object.assign(l,d),mk:()=>({status:'Ativo',preferred:false,minOrder:0})},
 patrimonio:{label:'Patrimônio',icon:'🏛️',arr:'assets',tit:'name',subs:['category','location'],
  fields:[['name','Bem','text',1],['category','Categoria','text'],['code','Código','text'],['location','Onde está','text'],['condition','Condição','select',['Ótimo','Bom','Regular','Ruim']],['acquired','Adquirido em','date'],['value','Valor (R$)','money']],
  out:a=>({name:a.name,category:a.category,code:a.code,location:a.location,condition:a.condition,acquired:a.acquired,value:reaisTxt(a.value)}),
  patch:(l,d)=>{['name','category','code','location','condition','acquired'].forEach(k=>{if(k in d)l[k]=d[k]});if('value' in d)l.value=centsFromInput(d.value)},mk:()=>({value:0})},
 documentos:{label:'Documentos',icon:'📄',arr:'documents',tit:'title',subs:['category','date'],
  fields:[['title','Título','text',1],['category','Categoria','text'],['date','Data','date'],['notes','Observações','area']],
  note:'Aqui fica só o registro do documento. O arquivo em si continua com o Pai/Mãe.',
  out:d=>({title:d.title,category:d.category,date:d.date,notes:d.notes}),patch:(l,d)=>Object.assign(l,d),mk:()=>({personId:'',eventId:'',filename:'',data:''})},
 comunicacao:{label:'Comunicação',icon:'💬',arr:'messages',tit:'title',subs:['audience','date'],
  fields:[['title','Título','text',1],['audience','Para quem','select',['Todos ativos','Pendentes']],['date','Data','date'],['time','Hora','time'],['text','Mensagem','area',1]],
  note:'A mensagem fica programada. Quem envia é o Pai/Mãe, no app dele.',
  out:m=>({title:m.title,audience:m.audience,date:m.date,time:m.time,text:m.text}),patch:(l,d)=>Object.assign(l,d),mk:()=>({memberId:'',eventId:'',status:'Programada'})},
 trabalhos:{label:'Trabalhos espirituais',icon:'🕯️',arr:'spiritualWorks',tit:'title',subs:['date','location'],canNew:false,
  fields:[['title','Trabalho','text',1],['date','Data','date'],['time','Hora','time'],['location','Local','text'],['responsible','Responsável','text'],['notes','Observações da equipe','area']],
  note:'Você ajusta data, hora, local, responsável e observações. Valores e itens do trabalho ficam com o Pai/Mãe.',
  out:w=>({title:w.title,category:w.category,date:w.date,time:w.time,location:w.location,responsible:w.responsible,status:'',notes:w.publicNotes}),
  patch:(l,d)=>{['title','date','time','location','responsible'].forEach(k=>{if(k in d)l[k]=d[k]});if('notes' in d)l.publicNotes=d.notes},mk:()=>({})},
 festas:{label:'Festas e eventos',icon:'🎉',arr:'events',tit:'title',subs:['type','date'],filter:e=>FESTA_RX.test(e.type||''),
  fields:[['title','Nome','text',1],['type','Tipo','select',['Festa','Evento','Bazar','Palestra','Ação social','Curso']],['date','Data','date',1],['time','Hora','time'],['location','Local','text'],['status','Situação','select',['Confirmado','Cancelado']],['notes','Observações','area']],
  out:e=>({title:e.title,type:e.type,date:e.date,time:e.time,location:e.location,status:e.status==='Cancelado'?'Cancelado':'Confirmado',notes:e.notes}),
  patch:(l,d)=>Object.assign(l,d),mk:()=>({responsibleId:'',participants:[],materials:'',publish:'equipe'})}
};
const eqmWanted=k=>!!(areaOn(k)||(AX.membros||[]).some(m=>m.acessos&&(m.acessos[k]===true||m.acessos[k+'_editar']===true))||((state.members||[]).some(l=>l.perms&&l.perms.acessos&&(l.perms.acessos[k]||l.perms.acessos[k+'_editar']))));
function eqmItems(k){const D=EQM[k];let a=Array.isArray(state[D.arr])?state[D.arr]:[];if(D.filter)a=a.filter(D.filter);return a.filter(x=>x&&x.id).slice(0,3000).map(x=>({local_id:String(x.id),dados:D.out(x)}))}
async function eqmPush(force){
  for(const k of Object.keys(EQM)){
    const want=eqmWanted(k),sk='mt_cloud_sigQ_'+k,prev=ls.get(sk);
    if(!want&&!prev)continue;
    const it=want?eqmItems(k):[],sig=want?hash(JSON.stringify(it)):'';
    if(!force&&sig===prev)continue;
    await api.rpc('mt_mod_publicar',{p_modulo:k,p_itens:it});ls.set(sk,sig);
  }
}
async function eqmPull(){
  if(!adminActive())return 0;
  let rows;
  try{rows=await api.select('mod_registros','casa_id=eq.'+MEM.casa_id+'&visto_em=is.null&select=*&order=atualizado_em.asc')}
  catch(e){if(e.code==='offline')throw e;return 0}
  if(!(rows||[]).length)return 0;
  rows.forEach(r=>{
    const D=EQM[r.modulo];if(!D)return;
    const by=r.editado_nome||r.por_nome||'equipe';state[D.arr]=state[D.arr]||[];
    let loc=state[D.arr].find(x=>String(x.id)===r.local_id);
    if(loc){D.patch(loc,r.dados||{});audit(D.label,'Alterado pelo app por '+by,(r.dados&&(r.dados.name||r.dados.title))||'')}
    else{loc=Object.assign({id:r.local_id},D.mk(r.dados||{}));D.patch(loc,r.dados||{});state[D.arr].push(loc);audit(D.label,'Criado pelo app por '+by,(r.dados&&(r.dados.name||r.dados.title))||'')}
    loc.lastBy=by;loc.lastAt=r.editado_em||new Date().toISOString();
  });
  await persist(false);
  await api.rpc('mt_mod_visto',{p_ids:rows.map(x=>x.id)});
  Object.keys(EQM).forEach(k=>ls.set('mt_cloud_sigQ_'+k,''));
  toast('🗂️ '+rows.length+' alteração(ões) de cadastros vieram do app e já estão no seu app.');
  if(typeof render==='function')render();
  return rows.length;
}
/* portal */
const EQ={rows:null,q:'',err:'',busy:false};
const eqCan=k=>!!MEM&&!!MEM.acessos&&MEM.acessos[k+'_editar']===true;
const eqAny=()=>!!MEM&&MEM.papel!=='pai_mae'&&!!MEM.acessos&&Object.keys(EQM).some(k=>MEM.acessos[k]===true||MEM.acessos[k+'_editar']===true);
async function eqLoad(){
  if(EQ.busy||!eqAny())return;EQ.busy=true;
  try{EQ.rows=await api.select('mod_registros','select=*&order=atualizado_em.desc&limit=3000');EQ.err=''}
  catch(e){EQ.err=e.message||'Não foi possível carregar.';EQ.rows=EQ.rows||[]}
  finally{EQ.busy=false}
  if(document.getElementById('mtPortal')&&PT.tab==='areas'&&EQM[PT.area])portalPaint();
}
function eqBody(k){
  const D=EQM[k];
  if(EQ.rows===null&&!EQ.err){eqLoad();return '<p class="muted small">Carregando…</p>'}
  const ed=eqCan(k),q=EQ.q.toLowerCase();
  const L=(EQ.rows||[]).filter(r=>r.modulo===k).sort((a,b)=>String((a.dados||{})[D.tit]||'').localeCompare(String((b.dados||{})[D.tit]||''),'pt-BR'));
  const rows=L.filter(r=>!q||JSON.stringify(r.dados).toLowerCase().includes(q));
  const lab=Object.fromEntries(D.fields.map(f=>[f[0],f[1]]));
  const sub=r=>D.subs.map(s=>{const v=(r.dados||{})[s];if(!v)return '';return /date/.test(s)?finDia(v):v}).filter(Boolean).join(' · ');
  const inat=r=>['Inativo','Cancelado'].includes((r.dados||{}).status);
  return `${EQ.err?`<p class="small" style="color:#a33">⚠ ${E(userErr(EQ.err))}</p>`:''}<p class="small"><b>${L.length}</b> registro(s)</p>
  <p class="small muted">${ed?'Você pode cadastrar e editar. Cada mudança fica com o seu nome e o Pai/Mãe é avisado. Nada é apagado: para tirar da lista, mude a situação.':'Só consulta. Atualizado ao vivo.'} ${D.note?E(D.note):''}</p>
  <div class="mtx-btns" style="margin:8px 0">${ed&&D.canNew!==false?`<button class="btn primary" data-mt="eq" data-a="new" data-k="${k}">➕ Novo</button>`:''}<button class="btn" data-mt="eq" data-a="reload">↻ Atualizar</button></div>
  <input class="mtq-search" id="eqQ" placeholder="Buscar" value="${E(EQ.q)}" style="width:100%;margin-bottom:8px">
  ${rows.length?rows.map(r=>`<div class="mtx-row" style="align-items:flex-start"><div class="grow"><b>${E((r.dados||{})[D.tit]||'(sem nome)')}</b> ${inat(r)?`<span class="pill">${E(r.dados.status)}</span>`:''}<div class="small muted">${E(sub(r))}</div>${r.editado_nome?`<div class="small muted">${r.origem==='nuvem'&&r.por_nome===r.editado_nome?'Cadastrado por ':'Alterado por '}${E(r.editado_nome)}</div>`:''}</div>${ed?`<button class="btn sm" data-mt="eq" data-a="edit" data-k="${k}" data-id="${r.id}">✏️ Editar</button>`:''}</div>`).join(''):'<p class="muted small">Nada por aqui.</p>'}`;
}
function eqForm(k,id){
  const D=EQM[k],r=id?(EQ.rows||[]).find(x=>x.id===id):null,d=(r&&r.dados)||{};
  const inp=([key,label,type,opt])=>{const v=d[key]??'',nm='eq_'+key;
    if(type==='select')return `<label>${E(label)}<select id="${nm}">${opt.map(o=>`<option ${String(v||opt[0])===o||(!v&&o===opt[0])?'selected':''}>${E(o)}</option>`).join('')}${v&&!opt.includes(v)?`<option selected>${E(v)}</option>`:''}</select></label>`;
    if(type==='area')return `<label class="full">${E(label)}<textarea id="${nm}" rows="3" maxlength="1500">${E(v)}</textarea></label>`;
    return `<label ${key===D.tit?'class="full"':''}>${E(label)}<input id="${nm}" type="${type==='money'?'text':type}" ${type==='money'?'inputmode="decimal"':''} maxlength="200" value="${E(v)}"></label>`};
  showModal((r?'Editar · ':'Novo · ')+D.label,`<div class="form-grid">${D.fields.map(inp).join('')}</div>${D.note?`<p class="small muted">${E(D.note)}</p>`:''}`,`<button class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" data-mt="eq" data-a="save" data-k="${k}" data-id="${id||''}">Salvar</button>`);
}
async function eqAct(t){
  const a=t.dataset.a,k=t.dataset.k,id=t.dataset.id;
  try{
    if(a==='reload'){await eqLoad();toast('✓ Atualizado.')}
    else if(a==='new')eqForm(k,'');
    else if(a==='edit')eqForm(k,id);
    else if(a==='save'){
      const D=EQM[k],d={};
      D.fields.forEach(f=>{const el=document.getElementById('eq_'+f[0]);if(el)d[f[0]]=(el.value||'').trim()});
      const req=D.fields.find(f=>f[3]===1&&!d[f[0]]);
      if(req){toast('⚠ Preencha: '+req[1]+'.');return}
      busy(t,true);await api.rpc('mt_mod_salvar',{p_modulo:k,p_id:id||null,p_dados:d});closeModal();toast('✓ Salvo. O Pai/Mãe já foi avisado.');await eqLoad();
    }
  }catch(er){toast('⚠ '+(er.message||er));busy(t,false)}
}
document.addEventListener('input',e=>{if(e.target&&e.target.id==='eqQ'){EQ.q=e.target.value;const pos=e.target.selectionStart;portalPaint();const n=document.getElementById('eqQ');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}}}});
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-mt="eq"]');if(!t)return;
  e.preventDefault();e.stopImmediatePropagation();eqAct(t);
},true);
{const _pl3=portalLoad;portalLoad=async function(){const r=await _pl3.apply(this,arguments);try{await eqLoad()}catch(e){}return r}}

/* ---- Aulas novas (V0.10.0.0): uma por permissão de alterar ---- */
{
 const mk=(k,icon,title,desc,need,steps)=>LESSONS.push({k,icon,title,desc,need,steps});
 LESSONS.forEach(l=>{if(EQM[l.k]){const o=l.need;l.need=()=>o()&&!LS_AC(l.k+'_editar')}});
 mk('estoque_cel','📦','Estoque pelo celular','Dar entrada, saída e cadastrar itens.',()=>LS_AC('estoque_editar'),[
  ['O que você pode fazer','Em Áreas → Estoque & Compras você dá entrada, dá saída, ajusta a quantidade e cadastra item novo. Tudo na hora, para a casa inteira.',['Cada mudança fica com o seu nome.','O Pai/Mãe é avisado quando um item fica abaixo do mínimo.']],
  ['Entrada, saída e ajuste','Toque no botão do item. Entrada soma, Saída tira e Ajuste troca o saldo pelo número que você contou.',['Use Ajuste só depois de contar o que existe de verdade.','Escreva o motivo: "gira de sábado", "compra do mercado".']],
  ['Item novo','Toque em Novo item. Informe nome, unidade, mínimo (avisar abaixo disso) e a quantidade de agora.',['Antes de criar, procure na lista para não duplicar.']],
  ['Boa prática','Registre as saídas logo depois da gira, enquanto você ainda lembra. Um estoque verdadeiro evita faltar material na hora H.',[]]]);
 mk('fin_tesouraria','💰','Tesouraria: como lançar com segurança','Contas a pagar, a receber e mensalidades.',()=>hasFin(),[
  ['O que você pode fazer',()=>{const o=[];if(LS_AC('fin_pagar'))o.push('lançar e dar baixa em contas a pagar');else if(LS_AC('fin_pagar_ver'))o.push('ver as contas a pagar');if(LS_AC('fin_receber'))o.push('lançar e dar baixa em contas a receber');else if(LS_AC('fin_receber_ver'))o.push('ver as contas a receber');if(LS_AC('fin_mensal'))o.push('registrar mensalidades recebidas');else if(LS_AC('fin_mensal_ver'))o.push('ver as mensalidades');if(LS_AC('fin_saldo'))o.push('ver o saldo do caixa');return 'O Pai/Mãe liberou para você: '+(o.join('; ')||'consulta')+'. O que não aparece não foi liberado.'},['Em Áreas → Financeiro.']],
  ['Lançar','Toque em Lançar. Preencha descrição clara, categoria, valor, data e vencimento. Escolha "Ainda não paga" ou "Já foi paga".',['Descrição que qualquer pessoa entende: "Conta de luz de outubro".','Confira o valor duas vezes: vírgula é centavo.']],
  ['Dar baixa','Quando a conta for paga (ou o valor recebido), toque em Marcar paga/recebida, informe a data e a forma (PIX, dinheiro).',['Guarde o comprovante.','Mensalidade: confira o nome e o mês antes de dar baixa.']],
  ['Cancelar','Errou ou lançou em duplicidade? Toque em Cancelar e explique o motivo. Nada é apagado: o lançamento fica como cancelado, com o seu nome.',[]],
  ['Valores altos','Se o Pai/Mãe definiu um limite, lançamentos acima dele esperam a aprovação dele. Você vê "Aguardando aprovação".',['Você é avisado quando ele aprovar ou recusar.']],
  ['Transparência','O Pai/Mãe recebe um aviso a cada lançamento, baixa ou cancelamento, e vê tudo em "Quem fez o quê". Isso protege você e a casa.',[]]]);
 const EQL={
  pessoas:['Pessoas: secretaria','Cadastrar e atualizar os dados dos irmãos.',[
   ['O que você pode fazer','Em Áreas → Pessoas você cadastra gente nova e atualiza nome, função, telefone, WhatsApp, nascimento e situação.',['Endereço, documentos e dados de mensalidade ficam só com o Pai/Mãe.']],
   ['Cadastrar','Toque em Novo. Nome completo é obrigatório. Anote o WhatsApp com DDD.',['Antes, procure pelo nome: evita cadastro duplicado.','O aniversário aparece sozinho na Agenda de todos.']],
   ['Atualizar','Mudou o telefone ou a função? Toque em Editar. Quem saiu da casa: troque a situação para Inativo, não apague.',[]],
   ['Sigilo','Os dados são da casa. Não passe a lista para fora do terreiro nem poste em grupos abertos. Cada alteração fica com o seu nome.',[]]]],
  fornecedores:['Fornecedores: manter a lista','Cadastrar e atualizar quem fornece à casa.',[
   ['O que você pode fazer','Em Áreas → Fornecedores você cadastra novos fornecedores e atualiza telefone, WhatsApp, e-mail, categoria e observações.',[]],
   ['Cadastrar bem','Informe o nome, o que ele vende (categoria) e um contato que funcione. Use as observações para prazo de entrega e forma de pagamento.',['Teste o número de WhatsApp antes de salvar.']],
   ['Quando deixar de comprar','Se a casa não compra mais dele, troque a situação para Inativo. O histórico fica guardado.',[]]]],
  patrimonio:['Patrimônio: conferir os bens','Registrar e atualizar onde estão os bens da casa.',[
   ['O que você pode fazer','Em Áreas → Patrimônio você cadastra bens e atualiza local, condição, código e valor.',[]],
   ['Inventário','Uma vez por ano, ou antes de festas grandes, percorra a casa conferindo cada bem: está no lugar? Em que condição?',['Atualize "Onde está" sempre que algo mudar de lugar.','Condição: Ótimo, Bom, Regular ou Ruim.']],
   ['Código','Dê um código curto a cada bem (ex.: ATA-01) e cole a etiqueta no objeto. Facilita achar e conferir.',[]],
   ['Se algo quebrar ou sumir','Registre na hora, mudando a condição, e avise o Pai/Mãe. Cada alteração fica com o seu nome.',[]]]],
  documentos:['Documentos: organizar o registro','Registrar os documentos da casa.',[
   ['O que você pode fazer','Em Áreas → Documentos você registra título, categoria, data e observações. O arquivo em si continua com o Pai/Mãe.',[]],
   ['Organização','Use categorias fixas (Ata, Recibo, Contrato, Licença) e títulos com data. Assim qualquer pessoa acha rápido.',['Exemplo: "Ata da reunião de março".']],
   ['Cuidados','Documento com dados pessoais é sigiloso. Registre só o título e deixe os detalhes com a direção.',[]]]],
  comunicacao:['Comunicação: programar mensagens','Preparar mensagens para os irmãos.',[
   ['O que você pode fazer','Em Áreas → Comunicação você escreve mensagens programadas: título, para quem, data, hora e texto.',['Quem envia de fato é o Pai/Mãe, no app dele.']],
   ['Escrever bem','Seja curto e claro: o que, quando e onde. Confira data e hora antes de salvar.',['Mensagem de gira: dia, horário, roupa e o que levar.']],
   ['Destinatários','Escolha Todos ativos ou Pendentes (quem tem mensalidade em aberto). Seja gentil nas mensagens de cobrança.',[]]]],
  trabalhos:['Trabalhos espirituais: organizar','Ajustar data, hora, local e responsável.',[
   ['O que você pode fazer','Em Áreas → Trabalhos espirituais você ajusta o nome, a data, a hora, o local, o responsável e as observações da equipe.',['Valores e itens do trabalho continuam com o Pai/Mãe.','Trabalhos novos são criados pelo Pai/Mãe.']],
   ['Antes do trabalho','Confirme data, hora e local com o responsável e avise a equipe. Se mudar algo, edite aqui para todos verem.',[]],
   ['Sigilo','Trabalhos espirituais pedem respeito e discrição. Use as observações só para o que a equipe precisa saber para organizar.',[]]]],
  festas:['Festas e eventos: organizar','Cadastrar e ajustar festas e eventos.',[
   ['O que você pode fazer','Em Áreas → Festas e eventos você cadastra festas, bazares, palestras e ações sociais e ajusta data, hora, local e observações.',['O evento também aparece na Agenda da casa.']],
   ['Planejar','Cadastre cedo, com data e local. Use as observações para tarefas: quem leva o quê, quem monta, quem limpa.',['Para festas grandes, avise o estoque e a tesouraria com antecedência.']],
   ['Se mudar ou cancelar','Mude a data aqui ou troque a situação para Cancelado. Nada é apagado e todos veem a mudança.',[]]]]
 };
 Object.keys(EQL).forEach(k=>mk('eq_'+k,EQM[k].icon,EQL[k][0],EQL[k][1],()=>LS_AC(k+'_editar'),EQL[k][2]));
}
/* ---- Aulas para o Pai/Mãe (V0.10.0.0) ---- */
const ADM_LESSONS=[
 ['delegar','🔑','Delegar com segurança',[
  ['Dê o mínimo','Em Permissões, marque só o que a pessoa precisa. Quem cuida do estoque não precisa ver o financeiro.',[]],
  ['Só ver ou pode alterar','Cada opção diz 👁 SÓ VER ou ✏️ PODE ALTERAR. Comece com "só ver" e passe a "pode alterar" quando houver confiança.',[]],
  ['Ninguém apaga','Quem altera não apaga nada: muda a situação (Inativo, Cancelado). Tudo fica com o nome de quem fez.',[]],
  ['Acompanhe','Em Acessos & Nuvem → Quem fez o quê você vê tudo. Se algo estranho aparecer, tire a permissão na hora.',[]]]],
 ['tesouraria','💰','Tesouraria passo a passo',[
  ['Por partes','Libere Contas a pagar, Contas a receber, Mensalidades e Saldo separadamente. Quem recebe só "contas a pagar" não vê o resto.',[]],
  ['Limite de valor','Em Quem fez o quê, defina um limite (ex.: R$ 500). Acima disso, o lançamento espera a sua aprovação. Deixe 0 para não ter limite.',[]],
  ['No seu app','Os lançamentos chegam sozinhos, com o nome de quem fez. Você recebe um aviso a cada lançamento, baixa ou cancelamento.',[]],
  ['Conferência','Todo mês, compare o saldo do app com o extrato do banco. Se tiver diferença, veja em Quem fez o quê.',[]]]],
 ['modulos','🗂️','Módulos que a equipe altera',[
  ['O que dá para delegar','Estoque, Pessoas (secretaria), Fornecedores, Patrimônio, Documentos (só o registro), Comunicação, Trabalhos (só ajustes) e Festas.',[]],
  ['O que fica com você','Endereços, documentos pessoais, valores e itens dos trabalhos, arquivos, backup e configurações.',[]],
  ['Como chega até você','As mudanças entram no seu app sozinhas (o app avisa). Dados novos de pessoas, como quem entrou como Convidado, ficam para você completar.',[]],
  ['Aulas junto das permissões','Cada permissão libera automaticamente a aula correspondente no celular da pessoa.',[]]]],
 ['registro','📋','Quem fez o quê',[
  ['Onde fica','Acessos & Nuvem → Quem fez o quê.',[]],
  ['O que aparece','Convites, cadastros aprovados, estoque, financeiro, cadastros dos módulos e mudanças de agenda, com nome e horário.',[]],
  ['Confiável','O nome é gravado pelo servidor. Ninguém consegue trocar nem apagar.',[]]]]
];
function admLesson(k){
  if(typeof guiaAdmLesson==='function'){guiaAdmLesson(k);return}
  const l=ADM_LESSONS.find(x=>x[0]===k);if(!l)return;
  showModal(l[1]+' '+l[2],l[3].map((s,i)=>`<div class="mtx-leg" style="margin:8px 0"><b>${i+1}. ${E(s[0])}</b><p class="small" style="margin:4px 0">${E(s[1])}</p>${s[2]&&s[2].length?`<ul class="small">${s[2].map(p=>`<li>${E(p)}</li>`).join('')}</ul>`:''}</div>`).join(''),'<button class="btn primary" data-action="close-modal">Entendi</button>',true);
}
function admLessonsCard(){
  return `<div class="card mtx"><h3>📘 Aulas para o Pai/Mãe</h3><p class="small muted">Aulas práticas: o app mostra os botões na tela e você aprende fazendo.</p><div class="mtx-btns"><button class="btn sm primary" data-mt="acn" data-a="go" data-n="-1">🎓 Aula prática: Acessos &amp; Nuvem</button>${ADM_LESSONS.map(l=>`<button class="btn sm" data-mt="admles" data-k="${l[0]}">${l[1]} ${E(l[2])}</button>`).join('')}</div></div>`;
}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-mt="admles"]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();admLesson(t.dataset.k)},true);

/* ---- Aula completa: Acessos & Nuvem (V0.11.1.0) ---- */
const ACN=[
 ['O que é o Terreiro Conectado','Tudo começa por uma ideia simples: o MEU TERREIRO guarda os dados no aparelho do Pai/Mãe (o aparelho principal). A nuvem é como uma mesa compartilhada onde você coloca só o que quer que os outros vejam.',[
  'Sem a nuvem, o app funciona 100% no seu aparelho, até sem internet.',
  'Com a nuvem, filhos, cambonos e consulentes entram no celular deles e veem (ou fazem) o que você liberou.',
  'Você decide o que vai para a nuvem e quem pode ver ou alterar cada coisa.',
  'Acessos & Nuvem é a sala de comando disso tudo. Só o Pai/Mãe entra nela.']],
 ['O que vai e o que nunca vai para a nuvem','Saber isso dá tranquilidade para delegar.',[
  'Sempre que você usa: agenda (menos rascunhos), mensalidades dos filhos, avisos, orientações e banhos, convites e cadastros, senhas e presença da gira.',
  'Só se você liberar: estoque, financeiro e os módulos (Pessoas, Fornecedores, Patrimônio, Documentos, Comunicação, Trabalhos, Festas).',
  'Nunca vão: backup, configurações, endereços e documentos pessoais, arquivos anexados, valores e itens dos trabalhos espirituais.',
  'Quem não tem permissão não recebe nem os dados: o servidor bloqueia, não é só esconder na tela.']],
 ['Quem é quem','Cada pessoa entra por um módulo, e isso define o ponto de partida do que ela vê.',[
  'Pai/Mãe da casa: administra tudo, no aparelho principal. Tem todas as funções.',
  'Filhos da casa e Cambonos: veem agenda, mensalidade e avisos. O que mais ver ou fazer depende das permissões que você der.',
  'Consulentes: pessoas de fora. Veem só as giras abertas ao público, orientações e banhos que você enviar.',
  'Cada um cria a própria conta (e-mail e senha). Você nunca vê a senha de ninguém.']],
 ['Aba Convidar: trazer pessoas','É onde a pessoa começa. Há dois convites: um para Filhos e cambonos e outro para Consulentes.',[
  'Toque em Enviar convite (WhatsApp): o WhatsApp abre com a mensagem e o link prontos. Escolha o contato e envie.',
  'Para quem já está cadastrado em Pessoas, use "Enviar para uma pessoa cadastrada": a mensagem já vai com o nome e o número dele.',
  'Copiar link e Compartilhar servem para outros aplicativos.',
  'Trocar o código invalida o antigo. Faça se o convite vazou para quem não devia.',
  'Convide só quem a casa conhece. Cada cadastro novo espera a sua aprovação.']],
 ['Aba Pessoas: aprovar e organizar','Quem se cadastra pelo convite aparece aqui, em "Aguardando". O número vermelho no menu mostra quantos são.',[
  'Aprovar libera o acesso. Recusar bloqueia. Confira se você conhece a pessoa antes.',
  'Desativar suspende o acesso sem apagar nada (dá para reativar). Remover apaga o cadastro online; para voltar, a pessoa precisa se cadastrar de novo.',
  'Para filhos e cambonos, ligue o cadastro online ao cadastro da pessoa em Pessoas do app. Isso liga a mensalidade e os dados dela.',
  'Se alguém com a permissão "Validar cadastros" aprovar, você é avisado e vê em Quem fez o quê.']],
 ['Aba Permissões: o coração da delegação','Aqui você escolhe, pessoa por pessoa, o que ela vê e o que ela pode fazer. Toque em Permissões ao lado do nome.',[
  '👁 SÓ VER: a pessoa consulta, não altera nada.',
  '✏️ PODE ALTERAR: a pessoa muda coisas de verdade. Dê com cuidado e comece só com o que ela precisa.',
  'Escolher a função (ex.: Tesoureira, Pequena de Santo) já sugere permissões. Você ajusta como quiser.',
  'Quem ainda não tem conta recebe as permissões assim que entrar pelo convite.',
  'Marcar "pode alterar" já libera o "ver" correspondente. Nada é apagado por quem altera: muda a situação.']],
 ['O que cada grupo de permissões libera','Resumo para escolher sem medo.',[
  'Agenda: ver internos e materiais; criar e editar compromissos; publicar direto (sem a sua aprovação).',
  'Convites e cadastros: enviar convites; validar novos cadastros.',
  'Estoque: ver ao vivo; dar entrada, saída e cadastrar itens pelo celular.',
  'Financeiro por parte: contas a pagar, contas a receber, mensalidades e saldo, cada uma só ver ou lançar e dar baixa.',
  'Organização da casa: alterar Pessoas (secretaria), Fornecedores, Patrimônio, Documentos, Comunicação, Trabalhos e Festas.',
  'Áreas só ver: cópia de leitura dos módulos, sem alterar.',
  'Cada permissão libera sozinha a aula dela no celular da pessoa.']],
 ['Aba Módulos na nuvem','Aqui você escolhe quais módulos do seu aparelho ficam disponíveis na nuvem.',[
  'Marcar publica uma cópia (e, se alguém puder alterar, as mudanças voltam para o seu app).',
  'Desmarcar remove da nuvem. Seus dados continuam no seu aparelho.',
  'Com isso você também consulta de outro aparelho, entrando com a conta do Pai/Mãe.',
  'Se aparecer o aviso "ainda está sendo ativada", avise o suporte do Meu Terreiro. Não precisa configurar nada.']],
 ['Aba Senhas e Presença','Duas ferramentas com QR Code para a gira.',[
  'Senhas da gira: abra as senhas do dia (com limite, se quiser). O QR Code impresso é fixo e ensina o consulente a pegar a senha pelo celular. Os números nunca se repetem.',
  'Chamar: toque em Chamar próxima. O consulente vê a senha dele sendo chamada. Marque atendida ou ausente.',
  'Encerrar as senhas ao fim da gira.',
  'Presença dos filhos: um QR Code fixo na parede. O filho lê ao chegar e a presença entra na Frequência do dia, como bater ponto.',
  'Chamada aberta por janela de horas (padrão) ou sempre aberta. Girar o QR invalida o impresso anterior.']],
 ['Aba Quem fez o quê','O livro de registro da casa. Só você vê.',[
  'Lista convites, cadastros aprovados, movimentos de estoque, lançamentos do financeiro, mudanças de módulos e da agenda, com nome e horário.',
  'O servidor grava o nome. Ninguém troca nem apaga.',
  'Aqui você também aprova lançamentos acima do limite do financeiro e define esse limite.',
  'Se algo parecer estranho, tire a permissão da pessoa na hora.']],
 ['Aba Agenda: aprovar mudanças','Quem tem "Criar e editar compromissos" propõe mudanças. Se não tiver "Publicar direto", elas esperam a sua aprovação aqui.',[
  'Aprovar publica para todos. Recusar avisa a pessoa, com o motivo que você escrever.',
  'Cada compromisso mostra se é 🌐 Aberta (consulentes veem) ou 🔒 Fechada (só a casa).',
  'Os aniversários aparecem sozinhos na agenda de todos os membros da casa (consulente não vê).',
  'Antes de enviar para a nuvem, o app mostra um aviso com Cancelar alterações e Salvar alterações. Confira e confirme.']],
 ['Aba Pagamentos','Os filhos enviam a foto do comprovante da mensalidade pelo celular. Ela chega aqui.',[
  'Toque em ver o comprovante, confira valor e mês e valide. O filho recebe um aviso.',
  'Recusar pede novo envio, com o motivo que você escrever.',
  'Se a mensalidade não aparece para o filho: confira se o cadastro online está ligado ao cadastro dele em Pessoas e se ele está como Mensalista.',
  'Quem tem a permissão Mensalidades também pode dar baixa pelo celular (aparece em Quem fez o quê).']],
 ['Aba Avisos e orientações','Dois jeitos de falar com o pessoal pela nuvem.',[
  'Quadro de avisos: escolha o público (filhos, cambonos, consulentes) e a data em que ele some sozinho. Dá para fixar um aviso importante.',
  'Orientações e banhos: mensagens individuais, normalmente para consulentes. Em Pessoas com acesso, use "Enviar orientação/banho".',
  'O aviso só aparece para quem é do público escolhido, enquanto estiver ativo.']],
 ['Aba Plano e sincronização','Mostra a conta online, o plano e se tudo está sincronizado.',[
  'A conta online é o seu e-mail de Pai/Mãe. Use sempre o mesmo aparelho principal para administrar.',
  'Ao salvar um compromisso, uma mensalidade, um item do estoque, etc., a nuvem atualiza sozinha. "Publicar agora" força o envio.',
  'Se o plano vencer, o acesso online de todos é suspenso até renovar. Seus dados no aparelho continuam seguros.',
  'Sem internet, o app guarda e envia depois, quando a conexão voltar.']],
 ['Segurança em poucas regras','Boas práticas para proteger a casa.',[
  'O app pede a senha toda vez que abre. Não deixe salva em aparelho emprestado.',
  'Nunca compartilhe a sua senha de Pai/Mãe. Para ajudar, use as permissões.',
  'Dê o mínimo necessário e revise as permissões de tempos em tempos.',
  'Pessoa saiu da casa? Desative o acesso.',
  'Se achar que alguém viu a sua senha, troque na hora em Plano e sincronização.']],
 ['Rotina recomendada','Um jeito simples de manter tudo em ordem.',[
  'Todo dia: ver o sino e os cadastros aguardando.',
  'Antes de cada gira: abrir as senhas e a chamada de presença; conferir a agenda.',
  'Depois da gira: encerrar as senhas, conferir a Frequência e o estoque usado.',
  'Toda semana: aprovar mudanças da agenda e validar comprovantes.',
  'Todo mês: olhar Quem fez o quê, rever permissões e conferir o saldo com o extrato do banco.']],
 ['Mensalidade: como ela chega ao filho','Entenda por que às vezes a mensalidade não aparece, e como evitar.',[
  'São duas coisas separadas: o cadastro da pessoa em Pessoas (nome, valor, vencimento) e a conta online dela (e-mail e senha). A mensalidade mora no cadastro. O filho entra com a conta.',
  'O vínculo é o que liga uma à outra. Sem o vínculo, o app não sabe de quem é a mensalidade e o filho não vê nada.',
  'Ao aprovar uma pessoa, o app liga sozinho se o nome ou o WhatsApp forem iguais aos do cadastro em Pessoas. Ele avisa na tela quando ligou.',
  'Se não ligou (nome escrito diferente, por exemplo), aparece um aviso amarelo "Sem vínculo" na aba Pessoas. Se o app achar um cadastro parecido, ele sugere: toque em Vincular. Senão, escolha o cadastro na lista.',
  'Depois de ligar, o app mostra se está tudo certo. Verde: "Mensalidade R$ 50,00, vence dia 10". Amarelo: diz o que falta.',
  'Para existir mensalidade, o cadastro em Pessoas precisa estar como Mensalidade (não Isento), com valor, e a cobrança de mensalidades precisa estar ligada nas configurações.',
  'Enquanto não ligar, o filho vê a mensagem "seu cadastro ainda não foi ligado pelo Pai/Mãe". Ao ligar, a mensalidade aparece em poucos instantes.',
  'Depois: o filho toca em "Já paguei", envia o comprovante, e você valida na aba Pagamentos. Só dá para validar se a pessoa estiver ligada.']],
 ['Problemas comuns e como resolver','Antes de pedir ajuda, veja se é um destes.',[
  'Pessoa não vê a agenda: confira se o cadastro foi aprovado, se o plano está em dia e se o compromisso não é rascunho ou fechado para o módulo dela.',
  'Mensalidade não aparece para o filho: quase sempre falta ligar a conta dele ao cadastro em Pessoas. Veja o capítulo anterior, o app mostra o que falta.',
  'Aviso "esta parte ainda está sendo ativada": não é erro seu nem da pessoa. É uma atualização do sistema que ainda não chegou. Avise o suporte do Meu Terreiro e use o resto normalmente.',
  'Mudança feita no celular não chegou ao app: abra o app no aparelho principal com internet; ele importa sozinho e avisa.',
  'Sem conexão: o portal mostra a última versão salva. Toque em atualizar quando voltar.']]
];
const ACNS={i:-1};
function acnModal(){
  const n=ACN.length,i=ACNS.i;
  if(i<0){
    showModal('🎓 Aula completa: Acessos & Nuvem',`<p class="small">Uma aula passo a passo, com todas as abas e as regras de segurança. Leva uns 10 minutos. Toque em um capítulo ou comece pelo início.</p><div class="mtx-chips" style="flex-direction:column;align-items:stretch;gap:6px">${ACN.map((s,k)=>`<button class="btn" style="text-align:left" data-mt="acn" data-a="go" data-n="${k}"><b>${k+1}.</b> ${E(s[0])}</button>`).join('')}</div>`,`<button class="btn" data-action="close-modal">Fechar</button><button class="btn primary" data-mt="acn" data-a="go" data-n="0">Começar</button>`,true);
    return;
  }
  const s=ACN[i],pct=Math.round((i+1)/n*100);
  showModal('🎓 '+(i+1)+' de '+n+' · '+s[0],`<div style="height:6px;border-radius:6px;background:rgba(0,0,0,.08);margin-bottom:12px"><div style="height:6px;border-radius:6px;background:#4a2a7a;width:${pct}%"></div></div><p>${E(s[1])}</p><ul style="margin:10px 0 0 18px;padding:0">${s[2].map(p=>`<li style="margin:7px 0">${E(p)}</li>`).join('')}</ul>`,`<button class="btn" data-mt="acn" data-a="go" data-n="-1">☰ Sumário</button>${i>0?`<button class="btn" data-mt="acn" data-a="go" data-n="${i-1}">← Anterior</button>`:''}${i<n-1?`<button class="btn primary" data-mt="acn" data-a="go" data-n="${i+1}">Próximo →</button>`:'<button class="btn primary" data-action="close-modal">Concluir ✓</button>'}`,true);
}
function acnBanner(){return `<div class="card mtx" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-left:4px solid #4a2a7a"><div class="grow" style="min-width:200px"><b>🎓 Aula prática: Acessos &amp; Nuvem</b><div class="small muted">Aprenda fazendo: eu mostro cada botão na tela e você toca nele.</div></div><button class="btn primary" data-mt="acn" data-a="go" data-n="-1">▶ Começar a aula prática</button></div>`}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-mt="acn"]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();ACNS.i=parseInt(t.dataset.n,10);if(ACNS.i<0){guiaStart(GUIA_ACN);return}acnModal();try{const m=document.querySelector('#modalRoot .modal-body,#modalRoot .modal');if(m)m.scrollTop=0}catch(x){}},true);

/* ---- AULA PRÁTICA GUIADA (V0.12.0.0): destaca os botões e telas de verdade ---- */
const GUIA={on:false,steps:[],i:0,poll:null,seq:0,el:null,cur:null,portal:false,onEnd:null};
const GCONT=()=>document.querySelector('.mtx-tabs+*');
const GIDX=(sel,n)=>()=>document.querySelectorAll(sel)[n]||null;
const GTAB=k=>`[data-mt="axtab"][data-a="${k}"]`;
const GUIA_ACN=[
 {t:'Vamos praticar com a tela de verdade',d:'Eu vou destacar cada botão e explicar para que serve. Você pode tocar nos botões destacados para treinar. Nada aqui altera dados sem você confirmar. Toque em Próximo.'},
 {tab:'convidar',sel:GTAB('convidar'),tap:true,t:'Toque em “Convidar”',d:'Por aqui as pessoas entram na sua casa. Cada aba tem uma função. Estas abas ficam sempre no topo.'},
 {tab:'convidar',sel:GIDX('.mtx-code',0),t:'Código dos filhos e cambonos',d:'Este é o código de convite de quem vai fazer parte da equipe. A pessoa usa o link ou o código para se cadastrar. O cadastro só vale depois que você aprovar.'},
 {tab:'convidar',sel:'[data-mt="sharepessoa"]',t:'Enviar para quem já está em Pessoas',d:'Digite o nome no campo ao lado (a lista vem do módulo Pessoas) e toque neste botão. O WhatsApp abre com a mensagem e o link prontos. É só escolher o contato.'},
 {tab:'convidar',sel:'[data-mt="copylink"]',t:'Copiar o link',d:'Se preferir mandar por outro app, copie o link e cole onde quiser. Cada vez que você envia, fica registrado em “Quem fez o quê”.'},
 {tab:'convidar',sel:GIDX('.mtx-code',1),t:'Código dos consulentes',d:'Este outro código é só para consulentes. Eles veem apenas orientações e a agenda aberta ao público.'},
 {tab:'convidar',sel:GTAB('pessoas'),tap:true,t:'Agora toque em “Pessoas”',d:'Toque na aba destacada para ver quem já se cadastrou.'},
 {tab:'pessoas',sel:'[data-mt="axfilter"][data-a="pendente"]',t:'Aguardando',d:'Quem acabou de se cadastrar aparece em “Aguardando”. Um número amarelo na aba avisa que há alguém esperando você.'},
 {tab:'pessoas',sel:'[data-mt="decide"][data-s="ativo"]',opt:'Quando alguém se cadastrar, aparece aqui o botão Aprovar. Aprovar libera o acesso. Recusar bloqueia.',t:'Aprovar ou recusar',d:'Aprovar libera o acesso da pessoa. Se o nome dela for igual ao do cadastro em Pessoas, o app já liga sozinho.'},
 {tab:'pessoas',sel:'[data-mt-vinc]',opt:'Depois de aprovar um filho ou cambono, aparece aqui o campo “Vínculo com Pessoas”. Ele liga a conta online ao cadastro dele, e é por isso que a mensalidade chega ao celular dele.',t:'Vínculo com Pessoas',d:'Liga a conta online desta pessoa ao cadastro dela em Pessoas. É por esse vínculo que a mensalidade chega ao celular dela. Confira se o nome está certo. Se aparecer um aviso amarelo, ele tem um botão que leva direto à correção.'},
 {tab:'pessoas',sel:'[data-mt="remove"],[data-mt="decide"][data-s="inativo"]',opt:'Desativar suspende o acesso sem apagar nada. Remover apaga o cadastro online.',t:'Desativar e Remover',d:'Desativar suspende o acesso sem apagar nada, e dá para reativar. Remover apaga o cadastro online. Para voltar, a pessoa precisa se cadastrar de novo.'},
 {tab:'pessoas',sel:GTAB('permissoes'),tap:true,t:'Toque em “Permissões”',d:'Agora vamos escolher o que cada pessoa pode ver ou fazer.'},
 {tab:'permissoes',sel:'.mtx-plist',t:'Todas as pessoas da casa',d:'Aqui estão todas as pessoas cadastradas, com ou sem conta online. Os rótulos mostram o que cada uma já pode fazer.'},
 {tab:'permissoes',sel:'[data-mt="acessos"]',tap:true,opt:'Quando houver pessoas na lista, o botão Permissões abre as escolhas dela.',t:'Toque em “Permissões” da primeira pessoa',d:'Vai abrir a lista de funções que você pode liberar para ela.'},
 {sel:'#modalRoot .modal-body',needModal:true,t:'Marque o que ela pode fazer',d:'Cada caixinha libera uma função. Marcar “alterar” já libera o “ver” correspondente. Você pode mudar quando quiser.'},
 {sel:'[data-mt="acessossave"]',needModal:true,t:'Salvar',d:'Salvar guarda as permissões e atualiza o celular da pessoa em instantes. Para treinar sem mudar nada, apenas feche a janela.',after:'closeModal'},
 {tab:'permissoes',sel:'.mtx-grp',t:'Legenda das cores',d:'Verde: a pessoa só consulta. Amarelo: ela pode alterar. Cada função tem uma explicação curta para você escolher sem medo.'},
 {tab:'permissoes',sel:GTAB('nuvem'),tap:true,t:'Toque em “Módulos na nuvem”',d:'Vamos ver o que fica disponível online.'},
 {tab:'nuvem',sel:'.mtx-ac',t:'O que vai para a nuvem',d:'Marque os módulos que ficam disponíveis para consulta no celular. Desmarcar tira da nuvem, e seus dados continuam no seu aparelho.'},
 {tab:'nuvem',sel:'[data-mt="areasync"]',t:'Atualizar agora',d:'Envia agora as últimas mudanças. Normalmente isso acontece sozinho.'},
 {tab:'qr',sel:GCONT,t:'Senhas e Presença',d:'Duas ferramentas com QR Code. As senhas organizam a fila da gira. A presença registra quem chegou, como bater ponto, e entra na Frequência.'},
 {tab:'registro',sel:GCONT,t:'Quem fez o quê',d:'Tudo que filhos e cambonos fizeram pelo celular fica aqui, com o nome de quem fez. Ninguém consegue apagar nem trocar. Olhe uma vez por mês.'},
 {tab:'agenda',sel:GCONT,t:'Agenda: mudanças para aprovar',d:'Quando alguém sem permissão de publicar propõe uma mudança na agenda, ela espera aqui pela sua aprovação.'},
 {tab:'pag',sel:GCONT,t:'Pagamentos',d:'Comprovantes de mensalidade enviados pelos filhos. Confira o comprovante e toque em Validar e dar como pago. Só valida se a pessoa estiver ligada ao cadastro.'},
 {tab:'avisos',sel:GCONT,t:'Avisos e orientações',d:'Escreva avisos para a equipe e orientações para consulentes. Eles aparecem no celular da pessoa e no sininho.'},
 {tab:'plano',sel:GCONT,t:'Plano e sincronização',d:'Aqui você vê a validade do plano, renova com o código, troca a sua senha e sincroniza com a nuvem.'},
 {t:'Aula prática concluída',d:'Você viu todas as abas. Para rever qualquer parte, toque em “Aula prática” de novo. A aula em texto continua disponível em “Ler a aula”.',last:true}
];

const PGO=(tab,area)=>()=>{PT.tab=tab;if(area)PT.area=area;PT.lesson=null;PT.evf=null;portalPaint()};
const NAVB=k=>`.ptl-nav [data-a="${k}"]`;
const PBODY='.ptl-main';
const LGU={
 basico:[{go:PGO('inicio'),sel:'.ptl-bell'},{go:PGO('agenda'),sel:NAVB('agenda'),tap:1},{go:PGO('mens'),sel:NAVB('mens'),tap:1},{go:PGO('inicio'),sel:'[data-mt="pres"][data-a="scan"]'},{go:PGO('perfil'),sel:NAVB('perfil'),tap:1}],
 internos:[{go:PGO('agenda'),sel:'.ptl-cal-head'},{go:PGO('agenda'),sel:'.ptl-day.has'}],
 materiais:[{go:PGO('agenda'),sel:'.ptl-ev'},{go:PGO('agenda'),sel:'.ptl-ev'},{go:PGO('areas','estoque'),sel:PBODY}],
 agenda_editar:[{go:PGO('agenda'),sel:'[data-mt="evnew"]'},{go:PGO('agenda'),sel:'.ptl-ev'},{go:PGO('agenda'),sel:'[data-mt="evnew"]'},{go:PGO('agenda'),sel:'.ptl-cal-head'}],
 convites:[{go:PGO('conv'),sel:PBODY},{go:PGO('conv'),sel:PBODY},{go:PGO('conv'),sel:PBODY}],
 cadastros:[{go:PGO('conv'),sel:PBODY},{go:PGO('conv'),sel:PBODY},{go:PGO('conv'),sel:PBODY}]
};
const LAREAS=['pessoas','financeiro','estoque','fornecedores','patrimonio','documentos','comunicacao','trabalhos','festas','relatorios'];
function guiaLessonSteps(l){
  const g=LGU[l.k],alias={estoque_cel:'estoque',fin_tesouraria:'financeiro'},area=alias[l.k]||l.k.replace(/^eq_/,''),isArea=LAREAS.includes(l.k)||!!alias[l.k]||/^eq_/.test(l.k);
  const steps=l.steps.map((st,i)=>{
    const t=st[0],x=st[1],pts=st[2],tx=typeof x==='function'?x():x;let o=g&&g[i]?Object.assign({},g[i]):{};
    if(!(g&&g[i])&&isArea){
      o.go=PGO('areas',area);o.sel=i===0?'.ptl-main .mtx-chips':'.ptl-main .ptl-sec';
      if(/estoque/.test(area)){if(/entrada|saída|registrar/i.test(t))o.sel='[data-mt="est"][data-a="mov"]';else if(/item novo|novo item/i.test(t))o.sel='[data-mt="est"][data-a="new"]'}
      if(area==='financeiro'&&/lançar|lançamento|novo/i.test(t))o.sel='[data-mt="fin"][data-a="new"]';
      if(EQM[area]&&/novo|cadastr/i.test(t))o.sel='[data-mt="eq"][data-a="new"]';
    }
    return Object.assign(o,{t,d:tx,pts:pts||[],opt:'Este botão aparece quando a permissão estiver liberada. '+tx});
  });
  steps.unshift({go:isArea?PGO('areas',area):null,t:'Vamos praticar: '+l.title,d:'Eu mostro cada botão na tela de verdade. Toque no que estiver destacado, ou em Próximo.'});
  steps.push({t:'Aula concluída',d:'Para rever, toque na aula de novo. Praticar ajuda a lembrar onde fica cada coisa.',last:true});
  return steps;
}
function guiaLesson(k){const l=LESSONS.find(x=>x.k===k);if(!l)return;guiaStart(guiaLessonSteps(l),{portal:true})}
const ADG={
 delegar:[{tab:'permissoes',sel:'.mtx-plist'},{tab:'permissoes',sel:'.mtx-grp'},{tab:'permissoes',sel:'[data-mt="acessos"]'},{tab:'registro',sel:GCONT}],
 tesouraria:[{tab:'permissoes',sel:'.mtx-plist'},{tab:'registro',sel:GCONT},{tab:'registro',sel:GCONT},{tab:'registro',sel:GCONT}],
 modulos:[{tab:'permissoes',sel:'.mtx-grp'},{tab:'permissoes',sel:'.mtx-grp'},{tab:'nuvem',sel:'.mtx-ac'},{tab:'permissoes',sel:'.mtx-plist'}],
 registro:[{tab:'registro',sel:GCONT},{tab:'registro',sel:GCONT},{tab:'registro',sel:GCONT}]
};
function guiaAdmLesson(k){
  const l=ADM_LESSONS.find(x=>x[0]===k);if(!l)return;const g=ADG[k]||[];
  const steps=[{t:'Vamos praticar: '+l[2],d:'Eu mostro cada parte na tela de verdade. Pode tocar nos botões destacados.'}].concat(l[3].map((s,i)=>Object.assign({},g[i]||{},{t:s[0],d:s[1],pts:s[2]||[]})),[{t:'Aula concluída',d:'Para rever, abra a aula de novo. Praticar ajuda a memorizar onde fica cada coisa.',last:true}]);
  guiaStart(steps,{})
}
function guiaEl(s){try{return typeof s.sel==='function'?s.sel():s.sel?document.querySelector(s.sel):null}catch(e){return null}}
function guiaClear(){if(GUIA.poll){clearInterval(GUIA.poll);GUIA.poll=null}const o=document.getElementById('mtGuia');if(o)o.remove();GUIA.el=null;GUIA.cur=null}
function guiaEnd(){GUIA.on=false;GUIA.seq++;guiaClear()}
function closeModalSafe(){try{if(typeof closeModal==='function')closeModal();else{const m=document.getElementById('modalRoot');if(m)m.innerHTML=''}}catch(e){}}
async function guiaStart(steps,opt){
  opt=opt||{};closeModalSafe();GUIA.portal=!!(opt.portal||opt.app);
  if(!opt.portal&&!opt.app&&typeof route!=='undefined'&&route!=='access'&&typeof go==='function'){go('access');await new Promise(r=>setTimeout(r,800))}
  GUIA.on=true;GUIA.steps=steps;GUIA.i=0;guiaShow()
}
async function guiaShow(){
  const my=++GUIA.seq;guiaClear();if(!GUIA.on)return;
  const s=GUIA.steps[GUIA.i];if(!s){guiaEnd();return}
  let el=null;
  if(s.tap&&s.sel)el=guiaEl(s);
  if(!el){
    if(s.go){try{s.go()}catch(e){}await new Promise(r=>setTimeout(r,160))}
    if(s.tab&&AX.tab!==s.tab){AX.tab=s.tab;axPaint();await new Promise(r=>setTimeout(r,140))}
  }
  if(s.sel){for(let k=0,mx=s.opt?4:12;k<mx&&!el;k++){el=guiaEl(s);if(!el)await new Promise(r=>setTimeout(r,150));if(my!==GUIA.seq)return}}
  if(my!==GUIA.seq)return;
  const n=GUIA.steps.length,txt=(s.sel&&!el&&s.opt)?s.opt:s.d,pts=(s.pts||[]).filter(Boolean);
  GUIA.cur=s;GUIA.el=el;
  const o=document.createElement('div');o.id='mtGuia';
  o.innerHTML=`<div class="gu-dimmer"></div><div class="gu-hole"></div><div class="gu-card"><div class="gu-n">${GUIA.i+1} de ${n}${s.tap&&el?' · toque no que está destacado':''}</div><b>${E(s.t||'')}</b><p>${E(txt||'')}</p>${pts.length?`<ul>${pts.map(p=>`<li>${E(p)}</li>`).join('')}</ul>`:''}<div class="gu-b"><button type="button" class="btn sm" data-mt="guia" data-a="exit">${s.last?'Fechar':'Sair'}</button><span class="grow"></span>${GUIA.i>0?'<button type="button" class="btn sm" data-mt="guia" data-a="prev">← Voltar</button>':''}<button type="button" class="btn sm primary" data-mt="guia" data-a="next">${s.last?'Concluir':'Próximo →'}</button></div></div>`;
  document.body.appendChild(o);
  const place=()=>{
    const hole=o.querySelector('.gu-hole'),card=o.querySelector('.gu-card'),dm=o.querySelector('.gu-dimmer');if(!hole||!card)return;
    const vw=window.innerWidth,vh=window.innerHeight,e=GUIA.el;
    if(!e||!document.contains(e)){hole.style.display='none';dm.style.clipPath='none';const cw0=Math.min(380,vw-24);card.style.cssText=`width:${cw0}px;left:${(vw-cw0)/2}px;top:${Math.max(12,(vh-(card.offsetHeight||180))/2)}px`;return}
    const r=e.getBoundingClientRect(),pad=6,big=r.height>=vh*0.6;
    hole.style.cssText=big?`display:block;left:${Math.max(r.left,0)-pad}px;top:${Math.max(r.top,8)}px;width:${Math.min(r.width,vw)+pad*2}px;height:${Math.min(r.height,vh*0.45)}px`:`display:block;left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px`;
    {const hl=parseFloat(hole.style.left),ht=parseFloat(hole.style.top),hw=parseFloat(hole.style.width),hh=parseFloat(hole.style.height),x1=Math.max(0,hl),y1=Math.max(0,ht),x2=Math.min(vw,hl+hw),y2=Math.min(vh,ht+hh);dm.style.clipPath=`polygon(evenodd,0 0,${vw}px 0,${vw}px ${vh}px,0 ${vh}px,0 0,${x1}px ${y1}px,${x1}px ${y2}px,${x2}px ${y2}px,${x2}px ${y1}px,${x1}px ${y1}px)`}
    const cw=Math.min(380,vw-24);card.style.width=cw+'px';const ch=card.offsetHeight||180;
    let top=r.bottom+14;if(big)top=vh-ch-12;else if(top+ch>vh-8)top=r.top-ch-14;if(top<8)top=vh-ch-12;
    card.style.top=Math.max(8,top)+'px';card.style.left=Math.max(12,Math.min(vw-cw-12,r.left))+'px'};
  if(el){try{const r0=el.getBoundingClientRect();if(r0.top<90||r0.bottom>window.innerHeight-70)el.scrollIntoView({block:r0.height>window.innerHeight*0.6?'start':'center',behavior:'auto'})}catch(e){}}
  place();GUIA.poll=setInterval(()=>{if(!GUIA.on||my!==GUIA.seq)return;if(s.sel&&(!GUIA.el||!document.contains(GUIA.el)))GUIA.el=guiaEl(s);place()},350);
}
async function guiaGo(d,fromTap){
  if(!GUIA.on||GUIA.busy)return;GUIA.busy=true;try{await guiaGo2(d,fromTap)}finally{GUIA.busy=false}}
async function guiaGo2(d,fromTap){
  const s=GUIA.steps[GUIA.i];
  if(d>0&&s&&s.tap&&!fromTap){const el=GUIA.el&&document.contains(GUIA.el)?GUIA.el:guiaEl(s);if(el){GUIA.nt=true;try{el.click()}catch(e){}await new Promise(r=>setTimeout(r,450));GUIA.nt=false}}
  if(d>0&&s&&s.after==='closeModal')closeModalSafe();
  let i=GUIA.i+d;
  const need=x=>x&&x.needModal&&!document.querySelector('#modalRoot .modal-body');
  while(GUIA.steps[i]&&need(GUIA.steps[i]))i+=d;
  if(i>=GUIA.steps.length){guiaEnd();return}
  if(i<0)i=0;
  if(d<0)closeModalSafe();
  GUIA.i=i;guiaShow()
}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-mt="guia"]');
  if(t){e.preventDefault();e.stopImmediatePropagation();const a=t.dataset.a;if(a==='start')guiaStart(GUIA_ACN);else if(a==='next')guiaGo(1);else if(a==='prev')guiaGo(-1);else if(a==='exit'){closeModalSafe();guiaEnd()}return}
},true);
window.addEventListener('click',e=>{if(GUIA.on&&GUIA.cur&&GUIA.cur.tap&&!GUIA.nt&&GUIA.el&&GUIA.el.contains&&GUIA.el.contains(e.target)){const my=GUIA.seq;setTimeout(()=>{if(my===GUIA.seq)guiaGo(1,true)},450)}},true);
window.addEventListener('resize',()=>{if(GUIA.on)guiaShow()});

/* olho para ver a senha em qualquer campo de senha */
(function(){
 const css=document.createElement('style');css.textContent='.mt-eyew{position:relative;display:block;margin-bottom:12px}.mt-eyew>input{padding-right:78px!important;width:100%;margin:0!important}.mt-eye{position:absolute!important;right:8px!important;top:50%!important;bottom:auto!important;left:auto!important;transform:translateY(-50%)!important;width:auto!important;min-width:0!important;margin:0!important;height:32px!important;padding:0 10px!important;border:1px solid #c99539;border-radius:8px;background:#fff8e6;color:#173d2f;font:700 12px/1 -apple-system,Segoe UI,Arial,sans-serif;cursor:pointer}.mt-eye:hover{background:#f3e3b8}';document.head.appendChild(css);
 function add(i){if(i.dataset.eye||i.closest('.password-wrap'))return;i.dataset.eye='1';const w=document.createElement('span');w.className='mt-eyew';i.parentNode.insertBefore(w,i);w.appendChild(i);const b=document.createElement('button');b.type='button';b.className='mt-eye';b.textContent='Ver';b.setAttribute('aria-label','Mostrar ou ocultar senha');b.title='Mostrar senha';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const s=i.type==='password';i.type=s?'text':'password';b.textContent=s?'Ocultar':'Ver';b.title=s?'Ocultar senha':'Mostrar senha';i.focus()});w.appendChild(b)}
 function scan(){document.querySelectorAll('input[type=password]').forEach(add)}
 new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});scan();
})();

/* ======================================================================
   V0.13.0.0 · "ESTE REGISTRO ACABOU DE SER ALTERADO" (edição simultânea)
   A) aparelho do Pai/Mãe: registro mudou por trás da janela aberta (nuvem ou outra pessoa)
   B) duas janelas do app no mesmo aparelho (uma não apaga a outra)
   C) portal da equipe: confere na nuvem antes de gravar
   ====================================================================== */
const MTG={snap:[],ids:[],userUntil:0,bypass:false,lastBtn:null,P:new Map(),pforce:false};
const gOpen=()=>{const m=document.getElementById('modalRoot');return !!(m&&m.children.length)};
function gDlg(o){
  const old=document.getElementById('mtConf');if(old)old.remove();
  const d=document.createElement('div');d.id='mtConf';
  d.innerHTML=`<div class="mtg-ov" role="alertdialog" aria-modal="true"><div class="mtg-card"><div class="mtg-ic">⚠️</div><h2>${E(o.title)}</h2><div class="mtg-body">${o.html}</div><div class="mtg-btns">${o.btns.map((b,i)=>`<button class="btn ${b.cls||''}" data-g="${i}">${E(b.t)}</button>`).join('')}</div></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;e.stopPropagation();d.remove();const f=o.btns[+b.dataset.g];if(f&&f.fn)f.fn()});
}
const gWhen=iso=>{try{const t=new Date(iso);if(isNaN(t))return '';return t.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
/* ---------- A) registros abertos no aparelho do Pai/Mãe ---------- */
function gSnapshot(){
  const root=document.getElementById('modalRoot');MTG.snap=[];MTG.ids=[];
  if(!root||!root.children.length)return;
  const ids=new Set();root.querySelectorAll('[data-id]').forEach(el=>{const v=el.getAttribute('data-id');if(v&&v.length>1)ids.add(v)});
  MTG.ids=[...ids];if(!ids.size||typeof state!=='object'||!state)return;
  Object.keys(state).forEach(k=>{const L=state[k];if(!Array.isArray(L)||L.length>20000)return;L.forEach(it=>{if(it&&typeof it==='object'&&ids.has(String(it.id))){try{MTG.snap.push({k,id:String(it.id),js:JSON.stringify(it)})}catch(e){}}})});
}
function gChanges(){
  const out=[];
  MTG.snap.forEach(r=>{
    const cur=((state||{})[r.k]||[]).find(x=>x&&String(x.id)===r.id);
    if(!cur){out.push({r,gone:true});return}
    let js;try{js=JSON.stringify(cur)}catch(e){return}
    if(js!==r.js)out.push({r,cur,old:JSON.parse(r.js)});
  });
  return out;
}
const G_SKIP=new Set(['lastBy','lastAt','updatedAt','history','hist','audit','createdAt']);
function gLines(c){
  const F=(typeof REV_F==='object'&&REV_F[c.r.k])||{},ks=new Set([...Object.keys(c.old||{}),...Object.keys(c.cur||{})]),L=[];
  ks.forEach(f=>{if(G_SKIP.has(f))return;const a=JSON.stringify(c.old[f]??''),b=JSON.stringify(c.cur[f]??'');if(a===b)return;
    if(typeof c.old[f]==='object'&&c.old[f]!==null||typeof c.cur[f]==='object'&&c.cur[f]!==null){if(F[f])L.push(`<li><b>${E(F[f])}</b> foi alterado</li>`);return}
    if(F[f])L.push(`<li><b>${E(F[f])}:</b> ${E(revVal(c.r.k,f,c.old[f]))} → ${E(revVal(c.r.k,f,c.cur[f]))}</li>`)});
  return L.slice(0,6).join('');
}
function gConflictLocal(btn){
  const ch=gChanges();if(!ch.length)return false;
  const html=ch.slice(0,3).map(c=>{
    if(c.gone)return `<p><b>Este registro foi excluído</b> enquanto a janela estava aberta.</p>`;
    const nm=c.cur.title||c.cur.name||c.cur.description||'Registro',who=c.cur.lastBy||'outra pessoa ou outro aparelho',at=gWhen(c.cur.lastAt);
    return `<p><b>${E(nm)}</b> foi alterado por <b>${E(who)}</b>${at?' às '+at:''}.</p>${gLines(c)?`<ul>${gLines(c)}</ul>`:''}`;
  }).join('')+'<p class="small muted">Se você salvar agora, o que você digitou vale e o que a outra pessoa mudou pode se perder. Veja como ficou antes.</p>';
  gDlg({title:'Este registro acabou de ser alterado',html,btns:[
    {t:'Ver como ficou',cls:'primary',fn:()=>{try{closeModal()}catch(e){const m=document.getElementById('modalRoot');if(m)m.innerHTML=''}try{render()}catch(e){}}},
    {t:'Salvar mesmo assim',fn:()=>{ch.forEach(c=>{if(!c.gone)c.r.js=JSON.stringify(c.cur)});MTG.bypass=true;try{btn.click()}finally{MTG.bypass=false}}},
    {t:'Voltar',fn:()=>{}}]});
  return true;
}
(function(){
  const root=document.getElementById('modalRoot');
  if(root&&window.MutationObserver)new MutationObserver(()=>{gSnapshot()}).observe(root,{childList:true});
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('#modalRoot button');if(!b)return;
    MTG.userUntil=Date.now()+4000;
    if(MTG.bypass||!b.classList.contains('primary'))return;
    if(/close|cancel|back|voltar/i.test(b.dataset.action||b.dataset.mt||''))return;
    if(!MTG.snap.length)return;
    try{if(gConflictLocal(b)){e.preventDefault();e.stopImmediatePropagation()}}catch(er){console.error(er)}
  },true);
})();
/* ---------- B) duas janelas no mesmo aparelho ---------- */
const STK='mt_state_stamp';
const stRead=()=>{try{return localStorage.getItem(STK)||''}catch(e){return null}};
let LAST=stRead();if(LAST===null)LAST='';
function gStale(){
  gDlg({title:'Os dados foram alterados em outra janela',html:'<p>Você tem o app aberto em outra janela ou aba, e ela salvou alterações agora há pouco.</p><p>Para não apagar o que foi salvo lá, esta janela precisa <b>recarregar</b>. O que você acabou de digitar aqui não foi gravado.</p>',btns:[{t:'Recarregar agora',cls:'primary',fn:()=>location.reload()}]});
}
{
  const _p=persist;
  persist=async function(){
    if(window.__MT_DEMO_MODE||window.__MT_ACCOUNT_DELETING)return _p.apply(this,arguments);
    const cur=stRead();
    if(cur&&cur!==LAST){gStale();throw new Error('Os dados foram alterados em outra janela do app. Recarregue para continuar.')}
    const r=await _p.apply(this,arguments);
    try{LAST=state.updatedAt||'';localStorage.setItem(STK,LAST)}catch(e){}
    if(Date.now()<MTG.userUntil)gSnapshot();
    return r;
  };
  window.addEventListener('storage',e=>{
    if(e.key!==STK||!e.newValue||e.newValue===LAST)return;
    if(document.getElementById('mtConf'))return;
    const old=document.getElementById('mtStaleBar');if(old)return;
    const b=document.createElement('div');b.id='mtStaleBar';b.className='mtg-bar';
    b.innerHTML='Outra janela do app alterou os dados. <button class="btn sm primary" type="button">Atualizar</button>';
    b.querySelector('button').onclick=()=>location.reload();document.body.appendChild(b);
  });
}
/* ---------- C) portal da equipe: confere na nuvem antes de gravar ---------- */
const GP={
  mt_agenda_salvar:{t:'eventos',id:a=>a.p_evento,on:a=>a.p_acao!=='criar',what:'este compromisso',ver:true},
  mt_agenda_decidir:{t:'agenda_propostas',id:a=>a.p_proposta,what:'esta proposta',st:r=>r.situacao!=='pendente'?'Esta proposta já foi '+(r.situacao==='aprovada'?'aprovada':'recusada')+(r.decidida_em?' às '+gWhen(r.decidida_em):'')+'.':''},
  mt_decidir_pagamento:{t:'pagamentos',id:a=>a.p_id,what:'este pagamento',st:r=>r.situacao!=='enviado'?'Este pagamento já foi '+(r.situacao==='validado'?'validado':'recusado')+(r.decidido_em?' às '+gWhen(r.decidido_em):'')+'.':''},
  mt_fin_baixa:{t:'fin_lancamentos',id:a=>a.p_id,what:'este lançamento',ver:true,st:r=>r.status==='Pago'?'Este lançamento já foi baixado (pago)'+(r.editado_nome?' por '+r.editado_nome:'')+'.':r.status==='Cancelado'?'Este lançamento foi cancelado'+(r.editado_nome?' por '+r.editado_nome:'')+'.':''},
  mt_fin_cancelar:{t:'fin_lancamentos',id:a=>a.p_id,what:'este lançamento',ver:true,st:r=>r.status==='Cancelado'?'Este lançamento já foi cancelado'+(r.editado_nome?' por '+r.editado_nome:'')+'.':r.status==='Pago'?'Este lançamento já foi pago'+(r.editado_nome?' por '+r.editado_nome:'')+'.':''},
  mt_fin_decidir:{t:'fin_lancamentos',id:a=>a.p_id,what:'este lançamento',st:r=>r.aprovacao&&r.aprovacao!=='pendente'?'Este lançamento já foi '+(r.aprovacao==='ok'?'aprovado':'recusado')+'.':''},
  mt_mod_salvar:{t:'mod_registros',id:a=>a.p_id,what:'este cadastro',ver:true},
  mt_estoque_salvar:{t:'estoque_itens',id:a=>a.p_item,what:'este item de estoque',ver:true}
};
const gOpenP=()=>gOpen()||!!(window.mtCloud&&PT&&PT.evf);
function gSee(t,rows){if(!Array.isArray(rows))return;rows.forEach(r=>{if(r&&r.id&&r.atualizado_em){const k=t+':'+r.id;if(!MTG.P.has(k)||!gOpenP())MTG.P.set(k,r.atualizado_em)}})}
{
  const _sel=api.select.bind(api),_rpc=api.rpc.bind(api);
  api.select=async function(t,qs){const r=await _sel(t,qs);try{if(Object.values(GP).some(g=>g.t===t))gSee(t,r)}catch(e){}return r};
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-mt]');if(b)MTG.lastBtn=b},true);
  api.rpc=async function(n,args,anon){
    const g=GP[n];
    if(g&&!anon&&!MTG.pforce&&(!g.on||g.on(args||{}))){
      const id=g.id(args||{});
      if(id){
        let row=null;try{const r=await _sel(g.t,'id=eq.'+encodeURIComponent(id)+'&select=*&limit=1');row=r&&r[0]}catch(e){row=null}
        if(row){
          const k=g.t+':'+id,seen=MTG.P.get(k);
          const stMsg=g.st?g.st(row):'';
          if(stMsg){gPortalDlg(g,row,stMsg,false,k);throw Object.assign(new Error('Este registro acabou de ser alterado. Veja como ficou.'),{code:'conflict'})}
          if(g.ver&&seen&&row.atualizado_em&&row.atualizado_em!==seen){gPortalDlg(g,row,'',true,k);throw Object.assign(new Error('Este registro acabou de ser alterado. Veja como ficou.'),{code:'conflict'})}
        }
      }
    }
    let r;
    if(g&&!anon&&!MTG.noSql){
      const id=g.id(args||{}),k=id?g.t+':'+id:'',seen=(g.ver&&!MTG.pforce&&k)?MTG.P.get(k):null;
      try{r=await _rpc('mt_guardar',{p_fn:n,p_args:args||{},p_esperado:seen||null})}
      catch(e){
        const m=String(e&&e.message||'');
        if(/CONFLITO/.test(m)){
          let row=null;try{const q=await _sel(g.t,'id=eq.'+encodeURIComponent(id)+'&select=*&limit=1');row=q&&q[0]}catch(x){}
          const st=/CONFLITO\|(já decid[^|]*)/.exec(m);
          gPortalDlg(g,row||{editado_nome:(m.split('|')[1]||'')},st?(g.what.charAt(0).toUpperCase()+g.what.slice(1)+' '+st[1]+'.'):'',!st&&!!g.ver,k);
          throw Object.assign(new Error('Este registro acabou de ser alterado. Veja como ficou.'),{code:'conflict'});
        }
        if(e&&(e.status===404||/PGRST202|mt_guardar|schema cache/i.test(m+(e.code||'')))){MTG.noSql=true;r=await _rpc(n,args,anon)}
        else throw e;
      }
    }else r=await _rpc(n,args,anon);
    try{if(g){const id=g.id(args||{});if(id)MTG.P.delete(g.t+':'+id)}}catch(e){}
    return r;
  };
}
function gPortalDlg(g,row,msg,canForce,key){
  const who=row.editado_nome||row.por_nome||'outra pessoa',at=gWhen(row.editado_em||row.atualizado_em);
  const html=msg?`<p>${E(msg)}</p><p class="small muted">Atualize a tela para ver como ficou.</p>`:`<p>Alguém alterou ${E(g.what)} (<b>${E(who)}</b>${at?' às '+at:''}) enquanto você editava.</p><p class="small muted">Se você salvar agora, o que você digitou vale e a outra alteração pode se perder. Veja como ficou antes.</p>`;
  const reload=async()=>{try{closeModal()}catch(e){}try{if(PT)PT.evf=null}catch(e){}MTG.P.delete(key);try{if(g.t==='fin_lancamentos'){await finLoad();await regLoad()}else if(g.t==='pagamentos'){await axLoad()}else if(g.t==='agenda_propostas'){await axLoad();await portalLoad(true);portalPaint()}else if(g.t==='mod_registros')await eqLoad();else if(g.t==='estoque_itens')await estLoad();else{await portalLoad(true);portalPaint()}}catch(e){console.error(e)}};
  const btns=[{t:msg?'Atualizar a tela':'Ver como ficou',cls:'primary',fn:reload}];
  if(canForce)btns.push({t:'Salvar mesmo assim',fn:()=>{MTG.P.delete(key);MTG.pforce=true;const b=MTG.lastBtn;try{if(b)b.click()}finally{setTimeout(()=>{MTG.pforce=false},1500)}}},{t:'Voltar',fn:()=>{}});
  gDlg({title:msg?'Este registro já foi tratado':'Este registro acabou de ser alterado',html,btns});
}

window.mtCloud={guiaStart,EQM,EQ,FIN,EST,REG,REV,QR,TKP,PT,AX,portalPaint,configured,api,session:()=>S,profile:()=>MEM,pubEvents,pubFees,syncAll};
})();
