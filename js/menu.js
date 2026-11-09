/* Main menu, pause screen and results table. */
import { $, store, fmt, hex, isTouch } from './utils.js';
import { TRACKS, S } from './config.js';
import { G } from './state.js';
import { buildWorld } from './tracks.js';
import { clearHUD } from './hud.js';
import { standings } from './physics.js';
import { moveFocus, enableTilt, tilt } from './input.js';
import { startGame } from './race.js';

export function showOverlay(id){ ['#menu','#pause','#results'].forEach(s=>$(s).classList.toggle('show',s===id)); document.querySelectorAll('button.focus').forEach(b=>b.classList.remove('focus')); }
export function syncMenu(){
  document.querySelectorAll('#menu .opts').forEach(o=>{ const k=o.dataset.k; o.querySelectorAll('button').forEach(b=>b.classList.toggle('sel',String(S[k])===b.dataset.v)); });
  $('#g-laps').style.display=S.mode==='tt'?'none':'flex'; $('#g-bots').style.display=S.mode==='tt'?'none':'flex'; $('#g-diff').style.display=S.mode==='tt'?'none':'flex';
  const rec=store.get('f5_best_'+S.track,null); $('#bestline').textContent=rec?`⏱ Your ${TRACKS[S.track].name} record: ${fmt(rec)}`:'';
  document.body.classList.toggle('tilt',isTouch && S.steer==='tilt');
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
  S[k]=(k==='laps'||k==='bots')?Number(b.dataset.v):b.dataset.v; store.set('f5_settings',S);
  if(k==='track'){ if(G.game){ G.game.cars.forEach(c=>G.scene.remove(c.mesh)); G.game=null; } buildWorld(S.track); G.world.gfx=S.gfx; }
  if(k==='steer'){ if(S.steer==='tilt') useTilt(); else $('#steerNote').textContent=''; }
  syncMenu(); }));
$('#startBtn').onclick=()=>{ if(isTouch && S.steer==='tilt') enableTilt(); startGame(); };

export function togglePause(){
  if(G.state==='race'||G.state==='countdown'){ G.state='paused:'+G.state; showOverlay('#pause'); moveFocus($('#pause'),0); }
  else if(G.state.startsWith('paused:')){ G.state=G.state.slice(7); showOverlay(null); }
}
$('#pauseBtn').onclick=togglePause; $('#resumeBtn').onclick=togglePause;
$('#restartBtn').onclick=()=>startGame(); $('#againBtn').onclick=()=>startGame();

export function toMenu(){
  if(G.game){ G.game.cars.forEach(c=>G.scene.remove(c.mesh)); } G.game=null; G.state='menu'; G.views.length=0; clearHUD();
  ['#lights','#topbtns','#touch','#split','#tower'].forEach(s=>$(s).style.display='none'); $('#map').style.display='none'; showOverlay('#menu'); syncMenu();
}
$('#quitBtn').onclick=toMenu; $('#resMenuBtn').onclick=toMenu;

export function showResults(){
  G.state='results'; const game=G.game, order=standings(); const win=order[0];
  const me=game.humans[0]; const pos=order.indexOf(me)+1;
  $('#resTitle').textContent=game.humans.length===2?`${order.find(c=>c.human).name} wins the duel!`:(pos===1?'🏆 You won the '+TRACKS[S.track].name+' GP!':'You finished P'+pos);
  $('#resTable').innerHTML='<tr><th>Pos</th><th>Driver</th><th>Time</th><th>Best lap</th></tr>'+order.map((c,i)=>{
    const t=c.finished?(i===0?fmt(c.finishTime):'+'+(c.finishTime-win.finishTime).toFixed(3)):(()=>{ const lapsDown=game.laps+1-c.lap; return lapsDown>=1?'+'+lapsDown+' lap'+(lapsDown>1?'s':''):'—'; })();
    return `<tr class="${c.human?'me':''}"><td>${i+1}</td><td><span class="sw" style="background:${hex(c.col)}"></span>${c.name}${G.fastest&&G.fastest.name===c.name?' 🟣':''}</td><td>${t}</td><td>${fmt(c.best)}</td></tr>`; }).join('');
  showOverlay('#results'); moveFocus($('#results'),0);
}
