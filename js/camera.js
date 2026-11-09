/* Chase / cockpit / far cameras, split-screen rendering and the menu flyover. */
import * as THREE from 'three';
import { store } from './utils.js';
import { G } from './state.js';
import { renderer } from './renderer.js';

export function cycleCam(k){ const v=G.views[k]; if(!v) return; v.mode=(v.mode+1)%3; store.set('f5_cam'+k,v.mode); }
export function updateCam(v,dt){
  const c=v.car, cam=v.cam, fx=Math.sin(c.h), fz=Math.cos(c.h);
  const sh=v.shake>0?(v.shake-=dt,v.shake*0.6):0; const jx=(Math.random()-0.5)*sh, jy=(Math.random()-0.5)*sh;
  if(v.mode===1){ cam.position.set(c.x+fx*0.35+jx,1.18+jy,c.z+fz*0.35); cam.lookAt(c.x+fx*25,0.9,c.z+fz*25); cam.fov=72; }
  else { const far=v.mode===2; const back=far?15:8.5, up=far?6:3.1;
    const tx=c.x-fx*back, tz=c.z-fz*back, k=1-Math.exp(-dt*(far?5:9));
    v.p.x+=(tx-v.p.x)*k; v.p.z+=(tz-v.p.z)*k; v.p.y=up;
    cam.position.set(v.p.x+jx,v.p.y+jy,v.p.z); cam.lookAt(c.x+fx*7,1.1,c.z+fz*7); cam.fov=60+Math.abs(c.v)*0.13; }
  cam.updateProjectionMatrix();
}
/** Draw the race: full screen for one player, top/bottom split for two. */
export function render(){
  const W=innerWidth,H=innerHeight, views=G.views, scene=G.scene;
  if(views.length===1){ renderer.setScissorTest(false); renderer.setViewport(0,0,W,H); views[0].cam.aspect=W/H; views[0].cam.updateProjectionMatrix(); renderer.render(scene,views[0].cam); }
  else { renderer.setScissorTest(true); views.forEach((v,k)=>{ const y=k===0?H/2:0; renderer.setViewport(0,y,W,H/2); renderer.setScissor(0,y,W,H/2); v.cam.aspect=W/(H/2); v.cam.updateProjectionMatrix(); renderer.render(scene,v.cam); }); }
}
const menuCam=new THREE.PerspectiveCamera(55,1,0.5,5000); let menuAng=0;
/** Slow orbit around the track behind the main menu. */
export function renderMenu(dt){
  const T=G.track; menuAng+=dt*0.06; const r=Math.max(T.maxX-T.minX,T.maxZ-T.minZ)*0.75;
  menuCam.position.set(T.cx+Math.cos(menuAng)*r,r*0.45,T.cz+Math.sin(menuAng)*r); menuCam.lookAt(T.cx,0,T.cz);
  menuCam.aspect=innerWidth/innerHeight; menuCam.fov=55; menuCam.far=6000; menuCam.updateProjectionMatrix();
  G.sun.position.set(T.cx+120,220,T.cz+80); G.sun.target.position.set(T.cx,0,T.cz);
  renderer.setScissorTest(false); renderer.setViewport(0,0,innerWidth,innerHeight); renderer.render(G.scene,menuCam);
}
