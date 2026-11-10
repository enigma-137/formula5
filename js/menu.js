/* Main menu, pause screen and results table. */
import { $, store, fmt, hex, isTouch } from './utils.js';
import { TRACKS, S } from './config.js';
import { G } from './state.js';
import { buildWorld } from './tracks.js';
import { clearHUD } from './hud.js';
import { standings } from './physics.js';
import { moveFocus, enableTilt, tilt } from './input.js';
import { startGame } from './race.js';
import { net } from './net.js';
import { updateOnlineUI, sendCfg, startOnline, onlineAgain, oppName } from './online.js';
import { profile, awardRace, getBest, POINTS } from './profile.js';

export function showOverlay(id){ ['#menu','#pause','#results','#stats'].forEach(s=>$(s).classList.toggle('show',s===id)); document.querySelectorAll('button.focus').forEach(b=>b.classList.remove('focus')); }
export function syncMenu(){
  document.querySelectorAll('#menu .opts').forEach(o=>{ const k=o.dataset.k; o.querySelectorAll('button').forEach(b=>b.classList.toggle('sel',String(S[k])===b.dataset.v)); });
  const noBots=S.mode==='tt'||S.mode==='online';
  $('#g-laps').style.display=S.mode==='tt'?'none':'flex'; $('#g-bots').style.display=noBots?'none':'flex'; $('#g-diff').style.display=noBots?'none':'flex';
  document.body.classList.toggle('mode-online',S.mode==='online'); updateOnlineUI();
  const rec=getBest(S.track); $('#bestline').textContent=rec?`⏱ Your ${TRACKS[S.track].name} record: ${fmt(rec)}`:'';
  document.body.classList.toggle('tilt',isTouch && S.steer==='tilt');
  document.body.classList.toggle('stick',isTouch && S.steer==='stick');
}
function useTilt(){
  const note=$('#steerNote');
  enableTilt().then(ok=>{
    if(!ok){ S.steer='buttons'; store.set('f5_settings',S); note.textContent='Motion sensor permission was refused — using buttons.'; syncMenu(); return; }
    note.textContent='Hold the phone sideways like a steering wheel and turn it to steer.';
    setTimeout(()=>{ if(S.steer==='tilt' && !tilt.have) note.textContent='No tilt sensor found on this device — try the buttons instead.'; },1500);
  });
}
document.querySelectorAll('#menu .opts').forEach(o=>o.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const k=o.dataset.k;
  if(S.mode==='online' && net.role==='guest' && net.connected && (k==='track'||k==='laps')){ $('#oStatus').textContent=`${oppName} (the host) picks the track and laps.`; return; }
  S[k]=(k==='laps'||k==='bots')?Number(b.dataset.v):b.dataset.v; store.set('f5_settings',S);
  if(k==='track'){ if(G.game){ G.game.cars.forEach(c=>G.scene.remove(c.mesh)); G.game=null; } buildWorld(S.track); G.world.gfx=S.gfx; }
  if(k==='steer'){ if(S.steer==='tilt') useTilt(); else $('#steerNote').textContent=''; }
  if(k==='track'||k==='laps') sendCfg();
  syncMenu(); }));
$('#startBtn').onclick=()=>{ if(S.mode==='online'){ startOnline(); return; } if(isTouch && S.steer==='tilt') enableTilt(); startGame(); };

export function togglePause(){
  if(G.state==='race'||G.state==='countdown'){ G.state='paused:'+G.state; showOverlay('#pause'); moveFocus($('#pause'),0); }
  else if(G.state.startsWith('paused:')){ G.state=G.state.slice(7); showOverlay(null); }
}
$('#pauseBtn').onclick=togglePause; $('#resumeBtn').onclick=togglePause;
const raceAgain=()=>{ if(S.mode==='online') onlineAgain(); else startGame(); };
$('#restartBtn').onclick=raceAgain; $('#againBtn').onclick=raceAgain;

export function toMenu(){
  $('#againBtn').textContent='Race again';
  if(G.game){ G.game.cars.forEach(c=>G.scene.remove(c.mesh)); } G.game=null; G.state='menu'; G.views.length=0; clearHUD();
  ['#lights','#topbtns','#touch','#split','#tower'].forEach(s=>$(s).style.display='none'); $('#map').style.display='none'; showOverlay('#menu'); syncMenu();
}
$('#quitBtn').onclick=toMenu; $('#resMenuBtn').onclick=toMenu;

export function showResults(){
  const first=G.state!=='results';
  G.state='results'; const game=G.game, order=standings(); const win=order[0];
  const me=game.humans[0]; const pos=order.indexOf(me)+1, online=S.mode==='online';
  $('#resTitle').textContent=game.humans.length===2?`${order.find(c=>c.human).name} wins the duel!`
    :online?(pos===1?`🏆 You beat ${oppName}!`:`${oppName} wins this one`)
    :(pos===1?'🏆 You won the '+TRACKS[S.track].name+' GP!':'You finished P'+pos);
  // championship points (once per race; split-screen races don't count)
  // fastest lap across everyone (an online rival's best lap arrives in their updates)
  const fastestCar=order.filter(c=>c.best).sort((a,b)=>a.best-b.best)[0];
  if(first && game.humans.length===1){
    const fl=fastestCar===me;
    game.pts=awardRace({pos,field:order.length,online,fastestLap:fl}); game.fl=fl; }
  $('#resPts').textContent=game.humans.length===1&&order.length>1?`+${game.pts||0} points${game.fl?' (incl. +1 fastest lap 🟣)':''} · total ${profile.points}`:'';
  if(online){ const b=$('#againBtn'); if(first) b.textContent=net.role==='host'?'Race again':'Ask for a rematch'; }
  $('#resTable').innerHTML='<tr><th>Pos</th><th>Driver</th><th>Time</th><th>Best lap</th></tr>'+order.map((c,i)=>{
    const t=c.finished?(i===0?fmt(c.finishTime):'+'+(c.finishTime-win.finishTime).toFixed(3)):(()=>{ const lapsDown=game.laps+1-c.lap; return lapsDown>=1?'+'+lapsDown+' lap'+(lapsDown>1?'s':''):'—'; })();
    return `<tr class="${c.human?'me':''}"><td>${i+1}</td><td><span class="sw" style="background:${hex(c.col)}"></span>${c.name}${fastestCar===c?' 🟣':''}</td><td>${t}</td><td>${fmt(c.best)}</td></tr>`; }).join('');
  showOverlay('#results'); moveFocus($('#results'),0);
}

/* ---------- stats screen ---------- */
function showStats(){
  const p=profile, tr=Object.keys(TRACKS);
  $('#statsBody').innerHTML=`<p style="margin:0 0 10px;opacity:.8">Driver: <b>${p.name}</b></p>
   <div class="stat-grid"><div><b>${p.points}</b><small>Points</small></div><div><b>${p.wins}</b><small>Wins</small></div><div><b>${p.podiums}</b><small>Podiums</small></div>
   <div><b>${p.races}</b><small>Races</small></div><div><b>${p.onlineWins}/${p.online}</b><small>Online wins</small></div><div><b>${p.races?Math.round(p.points/p.races):0}</b><small>Pts / race</small></div></div>
   <table><tr><th>Track</th><th>Best lap</th></tr>${tr.map(k=>`<tr><td>${TRACKS[k].name} <small style="opacity:.6">${TRACKS[k].sub}</small></td><td>${fmt(getBest(k))}</td></tr>`).join('')}</table>
   <p style="font-size:13px;opacity:.6;margin:10px 0 0">Points: ${POINTS.slice(0,5).join(', ')}… for P1, P2, P3…, +1 for the fastest lap. Races vs bots and online races count. Saved on this device.</p>`;
  showOverlay('#stats'); moveFocus($('#stats'),0);
}
$('#statsBtn').onclick=showStats;
$('#statsClose').onclick=()=>{ showOverlay('#menu'); };
