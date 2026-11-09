/* Heads-up display: position, lap, timing, speedo, timing tower and minimap. */
import { $, store, fmt, hex } from './utils.js';
import { VTOP, S } from './config.js';
import { G } from './state.js';
import { standings } from './physics.js';

let huds=[];
export function buildHUD(){
  clearHUD();
  const game=G.game, two=game.humans.length===2;
  game.humans.forEach((c,k)=>{
    const el=document.createElement('div'); el.className='hud';
    el.style.top=two?(k===0?'0':'50%'):'0'; el.style.height=two?'50%':'100%';
    el.innerHTML=`<div class="tl">${S.mode==='tt'?'':'<div class="box"><small>Pos</small><b class="pos">-</b></div>'}<div class="box"><small>Lap</small><b class="lap">-</b></div></div>
      <div class="tc"><div class="box"><small>${two?(k?'P2 ':'P1 '):''}Lap time</small><b class="cur">0:00.000</b><div class="sub"><span class="last"></span> <span class="bst"></span></div></div></div>
      <div class="msg"></div>
      <div class="br"><div class="spd"><span class="gear">N</span><span class="kmh">0</span><small>km/h</small></div><div class="rpm"><i></i></div></div>
      ${two?`<div class="tag2" style="color:${hex(c.col)}">${k?'P2 · second pad / arrows':'P1 · first pad / WASD'}</div>`:''}`;
    document.body.appendChild(el);
    const q=s=>el.querySelector(s);
    huds.push({el,c,pos:q('.pos'),lap:q('.lap'),cur:q('.cur'),last:q('.last'),bst:q('.bst'),msg:q('.msg'),gear:q('.gear'),kmh:q('.kmh'),rpm:q('.rpm i'),msgT:0});
  });
  $('#tower').style.display=S.mode==='tt'?'none':'block';
}
export function clearHUD(){ document.querySelectorAll('.hud').forEach(h=>h.remove()); huds=[]; }
/** Big centre-screen message for one player ("LAP 1:23.456", "GO!" …). */
export function flash(c,text,dur){ const h=huds.find(h=>h.c===c); if(!h) return; h.msg.textContent=text; h.msg.classList.add('on'); h.msgT=dur; }
let towerT=0;
export function updateHUD(dt){
  const order=standings(), game=G.game;
  huds.forEach(h=>{ const c=h.c; const set=(el,t)=>{ if(el && el.textContent!==t) el.textContent=t; };
    // in cockpit view the steering-wheel screen shows speed/gear, so hide the big speedo
    const vw=G.views.find(w=>w.car===c); h.el.classList.toggle('onboard',!!vw && vw.mode===3);
    set(h.pos,(order.indexOf(c)+1)+'/'+order.length);
    set(h.lap, S.mode==='tt'?String(Math.max(1,c.lap)):Math.min(Math.max(1,c.lap),game.laps)+'/'+game.laps);
    set(h.cur, fmt(G.state==='race'&&!c.finished?G.raceTime-c.lapStart:(c.finished?c.finishTime:0)));
    set(h.last, c.lastLap?'Last '+fmt(c.lastLap):'');
    const rec=S.mode==='tt'?store.get('f5_best_'+S.track,null):c.best;
    set(h.bst, rec?(S.mode==='tt'?'· Record ':'· Best ')+fmt(rec):'');
    const kmh=Math.round(Math.abs(c.v)*3.6); set(h.kmh,String(kmh));
    const f=Math.max(0,c.v)/VTOP*7.99; const gear=c.v<-0.5?'R':c.v<0.5?'N':String(1+Math.floor(f)); set(h.gear,gear);
    const rpm=c.v<0.5?0.15:0.25+(f%1)*0.75; h.rpm.style.width=(rpm*100).toFixed(0)+'%'; c.rpm=rpm;
    if(h.msgT>0){ h.msgT-=dt; if(h.msgT<=0) h.msg.classList.remove('on'); }
  });
  towerT-=dt; if(towerT<=0 && S.mode!=='tt'){ towerT=0.25;
    $('#tower').innerHTML=order.map((c,i)=>`<div class="${c.human?'me':''}"><span class="p">${i+1}</span><span class="sw" style="background:${hex(c.col)}"></span>${c.name}${c.finished?' 🏁':''}</div>`).join(''); }
  drawMap();
}

/* ---------------- minimap ---------------- */
const mapC=$('#map'), mg=mapC.getContext('2d'); let mapBase=null, mapTf=null;
export function drawMapBase(){
  const T=G.track, W=mapC.width, pad=26; const sx=(T.maxX-T.minX), sz=(T.maxZ-T.minZ); const s=(W-pad*2)/Math.max(sx,sz);
  mapTf=(x,z)=>[W-(pad+(x-T.minX)*s+((W-pad*2)-sx*s)/2), pad+(z-T.minZ)*s+((W-pad*2)-sz*s)/2];
  const off=document.createElement('canvas'); off.width=off.height=W; const g=off.getContext('2d');
  g.lineJoin='round'; g.beginPath(); for(let i=0;i<=T.N;i+=2){ const [x,y]=mapTf(T.px[i%T.N],T.pz[i%T.N]); i?g.lineTo(x,y):g.moveTo(x,y); } g.closePath();
  g.strokeStyle='rgba(0,0,0,.6)'; g.lineWidth=14; g.stroke(); g.strokeStyle='#e8e8e8'; g.lineWidth=7; g.stroke();
  const [sx0,sy0]=mapTf(T.px[0],T.pz[0]); g.fillStyle='#00a35c'; g.fillRect(sx0-6,sy0-6,12,12);
  mapBase=off;
}
function drawMap(){ if(!mapBase) return; mg.clearRect(0,0,mapC.width,mapC.height); mg.drawImage(mapBase,0,0);
  if(!G.game) return; for(const c of G.game.cars){ const [x,y]=mapTf(c.x,c.z); mg.beginPath(); mg.arc(x,y,c.human?9:6.5,0,7); mg.fillStyle=hex(c.col); mg.fill(); mg.lineWidth=c.human?3:2; mg.strokeStyle=c.human?'#fff':'#000'; mg.stroke(); } }
