/* Peer-to-peer connection for 1v1 online races (PeerJS / WebRTC).
   The free PeerJS cloud server only introduces the two phones; after that
   they talk directly. No database, no accounts.

   Testing tip: ?peer=localhost:9000 uses a local `npx peer --port 9000` server. */
const PEERJS='https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
const PREFIX='formula5-ng-';
const ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O/1/I/L confusion

export const net={ role:null, code:null, connected:false };
let peer=null, conn=null, on=()=>{};

function loadLib(){
  if(window.Peer) return Promise.resolve();
  return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=PEERJS; s.onload=res; s.onerror=()=>rej(new Error('lib')); document.head.appendChild(s); });
}
function peerOpts(){
  const q=new URLSearchParams(location.search).get('peer'); if(!q) return {debug:0};
  const [host,port]=q.split(':'); return {host,port:Number(port)||9000,path:'/',secure:false,debug:0};
}
const newCode=()=>Array.from({length:5},()=>ALPHA[Math.floor(Math.random()*ALPHA.length)]).join('');
const friendly=e=>({ 'peer-unavailable':'Room not found — check the code (rooms close when the host leaves).',
  'network':'Can\'t reach the online server. Check your internet.', 'server-error':'Online server is busy — try again.',
  'browser-incompatible':'This browser can\'t do online races. Try Chrome.', 'unavailable-id':'Code taken, retrying…' }[e&&e.type]||'Connection problem — try again.');

/** Wire up events: on(type, data) with type 'code' | 'open' | 'data' | 'close' | 'error'. */
export function onNet(fn){ on=fn; }

function attach(c){
  conn=c;
  c.on('open',()=>{ net.connected=true; on('open'); });
  c.on('data',d=>on('data',d));
  c.on('close',()=>{ if(conn===c){ net.connected=false; conn=null; on('close'); } });
  c.on('error',()=>{});
}

/** Create a room. Resolves once the room code is live. */
export async function hostRoom(){
  leave(); await loadLib(); net.role='host';
  const tryOpen=attempt=>new Promise((res,rej)=>{
    const code=newCode(); const p=new window.Peer(PREFIX+code,peerOpts()); peer=p;
    p.on('open',()=>{ net.code=code; res(code); });
    p.on('connection',c=>{ if(conn&&conn.open){ c.on('open',()=>{ c.send({t:'full'}); setTimeout(()=>c.close(),300); }); return; } attach(c); });
    p.on('disconnected',()=>{ try{ p.reconnect(); }catch(_){} });
    p.on('error',e=>{ if(e.type==='unavailable-id' && attempt<3){ p.destroy(); tryOpen(attempt+1).then(res,rej); } else if(!net.code) rej(e); else on('error',friendly(e)); });
  });
  try{ const code=await tryOpen(0); on('code',code); return code; }
  catch(e){ leave(); throw new Error(friendly(e)); }
}

/** Join a friend's room by code. Resolves when connected. */
export async function joinRoom(code){
  leave(); await loadLib(); net.role='guest'; code=String(code).toUpperCase().replace(/[^A-Z0-9]/g,'');
  return new Promise((res,rej)=>{
    const p=new window.Peer(peerOpts()); peer=p; let done=false;
    const fail=msg=>{ if(done) return; done=true; leave(); rej(new Error(msg)); };
    const timer=setTimeout(()=>fail('Couldn\'t connect to that room. Check the code and try again.'),15000);
    p.on('open',()=>{ const c=p.connect(PREFIX+code,{reliable:true}); attach(c);
      c.on('open',()=>{ if(done) return; done=true; clearTimeout(timer); net.code=code; res(code); }); });
    p.on('error',e=>{ if(!done){ clearTimeout(timer); fail(friendly(e)); } else on('error',friendly(e)); });
  });
}

export function send(msg){ if(conn && conn.open){ try{ conn.send(msg); }catch(_){} } }
export function leave(){
  const p=peer; peer=null; const c=conn; conn=null;
  try{ c&&c.close(); }catch(_){} try{ p&&p.destroy(); }catch(_){}
  net.role=null; net.code=null; net.connected=false;
}
