/* Cameras, split-screen rendering and the menu flyover.
   Modes: 0 chase · 3 cockpit (onboard, see cockpit.js) · 1 nose · 2 far chase */
import * as THREE from 'three';
import { $, clamp, wrapA } from './utils.js';
import { G } from './state.js';
import { renderer } from './renderer.js';
import { EYE } from './cockpit.js';

export const CAM_COCKPIT=3;
const ORDER=[0,CAM_COCKPIT,1,2];
export function cycleCam(k){ const v=G.views[k]; if(!v) return; v.mode=ORDER[(ORDER.indexOf(v.mode)+1)%ORDER.length]; }
$('#camBtn').onclick=()=>cycleCam(0);
export function updateCam(v,dt){
  const c=v.car, cam=v.cam, fx=Math.sin(c.h), fz=Math.cos(c.h);
  const sh=v.shake>0?(v.shake-=dt,v.shake*0.6):0; const jx=(Math.random()-0.5)*sh, jy=(Math.random()-0.5)*sh;
  if(v.mode===CAM_COCKPIT){
    // onboard: eye inside the car, a little head roll in corners and road buzz at speed
    const yawRate=v.prevH==null?0:wrapA(c.h-v.prevH)/Math.max(dt,1e-4); v.prevH=c.h;
    v.roll=(v.roll||0)+(clamp(yawRate*0.03,-0.05,0.05)-(v.roll||0))*Math.min(1,dt*4);
    const buzz=Math.abs(c.v)/90*0.004, bx=(Math.random()-0.5)*buzz, by=(Math.random()-0.5)*buzz;
    const ex=EYE.x, ez=EYE.z;
    cam.position.set(c.x+ex*fz+ez*fx+jx*0.3+bx, EYE.y+jy*0.3+by, c.z-ex*fx+ez*fz);
    cam.lookAt(c.x+fx*30,0.85,c.z+fz*30); cam.rotateZ(v.roll); cam.fov=66; }
  else if(v.mode===1){ cam.position.set(c.x+fx*0.35+jx,1.18+jy,c.z+fz*0.35); cam.lookAt(c.x+fx*25,0.9,c.z+fz*25); cam.fov=72; }
  else { const far=v.mode===2; const back=far?15:8.5, up=far?6:3.1;
    const tx=c.x-fx*back, tz=c.z-fz*back, k=1-Math.exp(-dt*(far?5:9));
    v.p.x+=(tx-v.p.x)*k; v.p.z+=(tz-v.p.z)*k; v.p.y=up;
    cam.position.set(v.p.x+jx,v.p.y+jy,v.p.z); cam.lookAt(c.x+fx*7,1.1,c.z+fz*7); cam.fov=60+Math.abs(c.v)*0.13; }
  // widen the view while boosting for a sense of speed
  v.bf=(v.bf||0)+((c.boost>0?1:0)-(v.bf||0))*Math.min(1,dt*4); cam.fov+=v.bf*9;
  cam.updateProjectionMatrix();
}
/** Draw the race: full screen for one player, top/bottom split for two. */
/** Show the onboard cockpit only to the camera sitting in that car. */
function prepView(v){ for(const w of G.views){ const on=w===v && w.mode===CAM_COCKPIT; if(w.car.cockpit) w.car.cockpit.visible=on; w.car.mesh.userData.hide.forEach(m=>m.visible=!on); } }
export function render(){
  const W=innerWidth,H=innerHeight, views=G.views, scene=G.scene;
  if(views.length===1){ prepView(views[0]); renderer.setScissorTest(false); renderer.setViewport(0,0,W,H); views[0].cam.aspect=W/H; views[0].cam.updateProjectionMatrix(); renderer.render(scene,views[0].cam); }
  else { renderer.setScissorTest(true); views.forEach((v,k)=>{ prepView(v); const y=k===0?H/2:0; renderer.setViewport(0,y,W,H/2); renderer.setScissor(0,y,W,H/2); v.cam.aspect=W/(H/2); v.cam.updateProjectionMatrix(); renderer.render(scene,v.cam); }); }
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
