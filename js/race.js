/* Setting up a race and stepping every car each frame. */
import * as THREE from 'three';
import { $, store, isTouch } from './utils.js';
import { BOTS, HUMANS, DIFF, S } from './config.js';
import { G } from './state.js';
import { makeRenderer } from './renderer.js';
import { buildWorld } from './tracks.js';
import { newCar, spawnSlot, placeMesh } from './cars.js';
import { makeCockpit } from './cockpit.js';
import { CAM_COCKPIT } from './camera.js';
import { stepCar, collide, resetCar } from './physics.js';
import { botInput } from './bots.js';
import { readInput } from './input.js';
import { buildHUD } from './hud.js';
import { initAudio } from './audio.js';
import { showOverlay } from './menu.js';
import { net } from './net.js';
import { oppName, updateRemote } from './online.js';

const R0=Math.random;

/** On phones: go fullscreen and lock to landscape where the browser allows it. */
function goLandscape(){
  if(!isTouch) return;
  const el=document.documentElement;
  const lock=()=>{ try{ return screen.orientation&&screen.orientation.lock?screen.orientation.lock('landscape'):null; }catch(e){ return null; } };
  if(!document.fullscreenElement && el.requestFullscreen){
    el.requestFullscreen({navigationUI:'hide'}).then(lock).catch(()=>{});
  } else { const p=lock(); if(p&&p.catch) p.catch(()=>{}); }
}

export function startGame(){
  goLandscape();
  store.set('f5_settings',S);
  if(G.world.key!==S.track || G.world.gfx!==S.gfx){ if(G.world.gfx!==S.gfx) makeRenderer(); buildWorld(S.track); G.world.gfx=S.gfx; }
  else if(G.game){ // remove old cars
    G.game.cars.forEach(c=>{ G.scene.remove(c.mesh); c.mesh.traverse(o=>{ if(o.material) o.material.dispose?.(); }); });
  }
  const humans = S.mode==='duo'?2:1;
  const nb = S.mode==='tt'||S.mode==='online'?0:S.bots;
  const cars=[];
  for(let b=0;b<nb;b++){ const [n,c,a]=BOTS[b]; const car=newCar(n,c,a,false,-1); car.skill=DIFF[S.diff]*(1+(R0()-0.5)*0.05)*(1-b*0.004); car.line=(R0()-0.5)*4; cars.push(car); }
  if(S.mode==='online'){
    // same grid on both phones: host in slot 0 (green), guest in slot 1 (gold)
    const me=net.role==='guest'?1:0;
    for(let k=0;k<2;k++){ const [,c,a]=HUMANS[k]; const car=newCar(k===me?'You':oppName,c,a,k===me,0); if(k!==me) car.remote=true; cars.push(car); }
  }
  else for(let h=0;h<humans;h++){ const [n,c,a]=HUMANS[h]; cars.push(newCar(humans===1?'You':n,c,a,true,h)); }
  cars.forEach((c,k)=>{ const s=spawnSlot(k); Object.assign(c,{x:s.x,z:s.z,h:s.h,idx:s.idx}); c.prevIdx=s.idx; placeMesh(c,0); });
  G.game={cars, humans:cars.filter(c=>c.human).sort((a,b)=>a.pi-b.pi), laps:S.mode==='tt'?Infinity:S.laps};
  G.views.length=0;
  G.game.humans.forEach((c,k)=>{ const cam=new THREE.PerspectiveCamera(62,1,0.1,4000); makeCockpit(c); G.views.push({cam,car:c,mode:S.view==='cockpit'?CAM_COCKPIT:0,p:new THREE.Vector3(c.x-Math.sin(c.h)*9,3.4,c.z-Math.cos(c.h)*9),shake:0}); });
  buildHUD();
  G.raceTime=0; G.cd=0; G.finishCount=0; G.endTimer=0; G.fastest=null; G.state='countdown';
  showOverlay(null);
  $('#lights').style.display='flex'; $('#topbtns').style.display='flex'; $('#map').style.display='block';
  $('#split').style.display=humans===2?'block':'none';
  $('#touch').style.display=(humans===1 && isTouch)?'block':'none';
  initAudio();
}

export function simulate(dt){
  const racing=G.state==='race';
  for(const c of G.game.cars){
    if(c.remote){ updateRemote(c,dt); continue; }   // online rival: moved by their updates
    let inp;
    if(!racing) inp={thr:0,brk:1,str:0};
    else if(c.human && !c.finished && !c.auto) inp=readInput(c.pi);
    else inp=botInput(c);   // bots, and humans after the flag drive themselves
    if(!racing){ c.steer+=(inp.str-c.steer)*0.1; continue; }
    stepCar(c,inp,dt);
    if(!c.human){ if(Math.abs(c.v)<2){ c.stuck+=dt; if(c.stuck>2.5){ resetCar(c); c.stuck=0; } } else c.stuck=0; }
  }
  if(racing) collide();
}
