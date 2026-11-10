/* Online 1v1: room UI in the menu, race start/rematch messages, and the
   rival's car, which is driven by the position updates they send us.

   Each phone simulates only its own car and sends its position 20x a second.
   The host picks the track and laps and starts the race. */
import { $, wrapA, isTouch } from './utils.js';
import { S, TRACKS } from './config.js';
import { G } from './state.js';
import { net, onNet, hostRoom, joinRoom, send, leave } from './net.js';
import { profile, setName } from './profile.js';
import { buildWorld } from './tracks.js';
import { flash } from './hud.js';
import { startGame } from './race.js';
import { syncMenu, showResults } from './menu.js';
import { enableTilt } from './input.js';

export let oppName='Rival';
let busy=false, rematchAsked=false;
const status=t=>{ $('#oStatus').textContent=t||''; };

/* ---------- menu UI ---------- */
export function updateOnlineUI(){
  const inRoom=!!net.code, start=$('#startBtn');
  $('#oIdle').hidden=inRoom || busy; $('#oRoom').hidden=!inRoom;
  $('#roomCode').textContent=net.code||'';
  $('#shareBtn').hidden=net.role!=='host';
  if(S.mode!=='online'){ start.disabled=false; start.textContent='START ▶'; return; }
  if(!inRoom){ start.disabled=true; start.textContent='Create or join a room'; }
  else if(!net.connected){ start.disabled=true; start.textContent=net.role==='host'?'Waiting for your rival to join…':'Reconnecting…'; }
  else if(net.role==='host'){ start.disabled=false; start.textContent=`START vs ${oppName} ▶`; }
  else { start.disabled=true; start.textContent=`Waiting for ${oppName} to start…`; }
}
$('#nameIn').value=profile.name;
$('#nameIn').addEventListener('change',e=>{ e.target.value=setName(e.target.value); if(net.connected) send({t:'hi',name:profile.name}); });
$('#hostBtn').onclick=async()=>{
  setName($('#nameIn').value); busy=true; status('Creating room…'); updateOnlineUI();
  try{ await hostRoom(); status('Send the code (or link) to your friend.'); }
  catch(e){ status(e.message); }
  busy=false; updateOnlineUI();
};
async function doJoin(code){
  setName($('#nameIn').value); code=String(code||'').trim();
  if(code.length<4){ status('Type the 5-letter room code first.'); return; }
  busy=true; status('Joining '+code.toUpperCase()+'…'); updateOnlineUI();
  try{ await joinRoom(code); status('Connected! Waiting for the host to start.'); }
  catch(e){ status(e.message); }
  busy=false; updateOnlineUI();
}
$('#joinBtn').onclick=()=>doJoin($('#codeIn').value);
$('#codeIn').addEventListener('keydown',e=>{ if(e.key==='Enter') doJoin(e.target.value); });
$('#leaveBtn').onclick=()=>{ leave(); status('Left the room.'); updateOnlineUI(); };
$('#shareBtn').onclick=async()=>{
  const url=location.origin+location.pathname+'?join='+net.code;
  const text=`Race me on Formula 5 🏎️ Room code ${net.code}`;
  try{ if(navigator.share){ await navigator.share({title:'Formula 5',text,url}); return; } }catch(_){ return; }
  try{ await navigator.clipboard.writeText(text+' '+url); status('Link copied — paste it to your friend.'); }
  catch(_){ status('Share this link: '+url); }
};

/* ---------- messages ---------- */
onNet((type,d)=>{
  if(type==='open'){ send({t:'hi',name:profile.name}); if(net.role==='host') sendCfg(); status('Connected!'); }
  else if(type==='close'){ status(`${oppName} left the room.`); rivalLeft(); }
  else if(type==='error'){ status(d); }
  else if(type==='data') handle(d);
  updateOnlineUI();
});
function handle(d){
  if(!d||typeof d!=='object') return;
  switch(d.t){
    case 'hi': oppName=String(d.name||'Rival').replace(/[<>&"]/g,'').slice(0,14)||'Rival'; status(`${oppName} is here!`); break;
    case 'full': status('That room already has two players.'); leave(); break;
    case 'cfg': if(net.role==='guest') applyCfg(d); break;
    case 'go': if(net.role==='guest'){ applyCfg(d); rematchAsked=false; S.mode='online'; startGame(); G.game.rid=d.rid; } break;
    case 'again': if(net.role==='host'){ rematchAsked=true; const b=$('#againBtn'); if(b) b.textContent=`${oppName} wants a rematch — Race again`; } break;
    case 's': rivalState(d); break;
  }
}
function applyCfg(d){
  if(TRACKS[d.track] && d.track!==S.track){ S.track=d.track; if(!G.game){ buildWorld(S.track); G.world.gfx=S.gfx; } }
  if([2,3,5,10].includes(d.laps)) S.laps=d.laps;
  syncMenu();
}
/** Host: tell the guest which track/laps are selected. */
export function sendCfg(){ if(net.role==='host' && net.connected) send({t:'cfg',track:S.track,laps:S.laps}); }

/** Host starts a race for both phones. */
export function startOnline(){
  if(net.role!=='host' || !net.connected) return;
  if(isTouch && S.steer==='tilt') enableTilt();
  // every race gets an id so late updates from the previous race are ignored
  const rid=Math.floor(Math.random()*1e9);
  rematchAsked=false; send({t:'go',track:S.track,laps:S.laps,rid}); startGame(); G.game.rid=rid;
}
/** "Race again" / "Restart" in online mode. */
export function onlineAgain(){
  if(net.role==='host') startOnline();
  else { send({t:'again'}); const b=$('#againBtn'); if(b) b.textContent='Asked for a rematch — waiting for host…'; }
}

/* ---------- the rival's car ---------- */
const rival=()=>G.game && G.game.cars.find(c=>c.remote);
function rivalState(d){
  const c=rival(); if(!c || d.rid!==G.game.rid) return;
  const wasDone=c.finished;
  c.net={x:+d.x,z:+d.z,h:+d.h,v:+d.v,at:performance.now()};
  c.steer=+d.st||0; c.lap=d.lap|0; c.idx=d.idx|0; c.boost=+d.b||0; c.best=d.best||null;
  if(d.f && !wasDone){ c.finished=true; c.finishTime=+d.ft;
    const me=G.game.humans[0]; if(me && !me.finished) flash(me,`${oppName} has finished!`,1.6);
    if(G.state==='results') showResults(); }
}
function rivalLeft(){ const c=rival(); if(c && !c.finished){ c.gone=true; c.name=oppName+' (left)'; const me=G.game.humans[0]; if(me) flash(me,`${oppName} left the race`,2.5); } }

/** Smoothly move the rival's car towards where their last update says it is. */
export function updateRemote(c,dt){
  const s=c.net; if(!s || c.gone) return;
  const age=Math.min(0.3,(performance.now()-s.at)/1000);
  const px=s.x+Math.sin(s.h)*s.v*age, pz=s.z+Math.cos(s.h)*s.v*age;
  if(Math.hypot(px-c.x,pz-c.z)>20){ c.x=px; c.z=pz; c.h=s.h; }
  const k=Math.min(1,dt*12); c.x+=(px-c.x)*k; c.z+=(pz-c.z)*k; c.h=wrapA(c.h+wrapA(s.h-c.h)*k); c.v=s.v;
}

/** Send my car's state ~20 times a second. Called every frame. */
let sendT=0;
export function onlineTick(dt){
  if(S.mode!=='online' || !G.game) return;
  // no word from the rival for 6 s mid-race: treat them as gone
  const r=rival(); if(r && r.net && !r.gone && !r.finished && G.state==='race' && performance.now()-r.net.at>6000) rivalLeft();
  if(!net.connected) return;
  sendT-=dt; if(sendT>0) return; sendT=0.05;
  const c=G.game.humans[0]; if(!c) return;
  send({t:'s',rid:G.game.rid,x:+c.x.toFixed(2),z:+c.z.toFixed(2),h:+c.h.toFixed(3),v:+c.v.toFixed(2),st:+c.steer.toFixed(2),lap:c.lap,idx:c.idx,
    f:c.finished?1:0,ft:c.finished?+c.finishTime.toFixed(3):0,b:+(c.boost||0).toFixed(2),best:c.best});
}

/* ---------- invite links: ?join=CODE ---------- */
const inv=new URLSearchParams(location.search).get('join');
if(inv){ S.mode='online'; $('#codeIn').value=inv.toUpperCase(); setTimeout(()=>{ syncMenu(); doJoin(inv); },300); }
