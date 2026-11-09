/* Synthesised engine sound (one voice per human player). */
import { $, store } from './utils.js';
import { G } from './state.js';

let actx=null, muted=store.get('f5_mute',false); const eng=[];
export function initAudio(){ if(actx){ try{actx.resume();}catch(e){} return; }
  try{ actx=new (window.AudioContext||window.webkitAudioContext)(); const master=actx.createGain(); master.gain.value=0.6; master.connect(actx.destination);
    for(let k=0;k<2;k++){ const o=actx.createOscillator(); o.type='sawtooth'; const o2=actx.createOscillator(); o2.type='square'; const f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1100; const g=actx.createGain(); g.gain.value=0; const g2=actx.createGain(); g2.gain.value=0.35;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); eng.push({o,o2,g}); } }catch(e){ actx=null; } }
export function updateAudio(){ if(!actx) return; const now=actx.currentTime, views=G.views;
  eng.forEach((e,k)=>{ const v=views[k]; const on=!muted && v && G.game && (G.state==='race'||G.state==='countdown');
    const rpm=v?(v.car.rpm||0.15):0; const fq=55+rpm*240+(v?Math.abs(v.car.v)*0.6:0);
    e.o.frequency.setTargetAtTime(fq,now,0.05); e.o2.frequency.setTargetAtTime(fq*0.5,now,0.05);
    e.g.gain.setTargetAtTime(on?(0.03+(v.car.thr||0)*0.04)/(views.length):0,now,0.08); }); }
export function toggleMute(){ muted=!muted; store.set('f5_mute',muted); $('#muteBtn').textContent=muted?'🔇':'🔊'; }
$('#muteBtn').textContent=muted?'🔇':'🔊';
$('#muteBtn').onclick=()=>{ initAudio(); toggleMute(); };
