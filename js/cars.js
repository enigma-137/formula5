/* Car models, grid slots and per-car state. */
import * as THREE from 'three';
import { G } from './state.js';
import { boxGeo } from './tracks.js';

export function makeCarMesh(col,acc){
  const g=new THREE.Group();
  const body=new THREE.MeshStandardMaterial({color:col,metalness:0.35,roughness:0.45});
  const accent=new THREE.MeshStandardMaterial({color:acc,metalness:0.2,roughness:0.5});
  const carbon=new THREE.MeshStandardMaterial({color:0x15181b,roughness:0.6});
  const tyre=new THREE.MeshStandardMaterial({color:0x111111,roughness:0.9});
  const add=(m,sx,sy,sz,x,y,z)=>{ const b=new THREE.Mesh(boxGeo,m); b.scale.set(sx,sy,sz); b.position.set(x,y,z); b.castShadow=true; g.add(b); return b; };
  add(body,0.9,0.5,4.4,0,0.2,0.1);           // tub
  add(body,0.42,0.28,1.6,0,0.18,2.9);        // nose
  add(accent,2.0,0.07,0.55,0,0.12,3.55);     // front wing
  add(body,1.55,0.42,1.9,0,0.18,-0.35);      // sidepods
  add(body,0.55,0.55,1.6,0,0.55,-1.1);       // engine cover
  add(carbon,0.6,0.25,0.8,0,0.68,0.55);      // cockpit
  add(accent,0.12,0.5,0.12,0,0.9,1.0);       // halo post
  add(accent,0.62,0.06,0.9,0,1.12,0.6);      // halo top
  add(accent,1.45,0.08,0.5,0,1.0,-2.35);     // rear wing
  add(carbon,0.06,0.6,0.6,0.72,0.55,-2.35); add(carbon,0.06,0.6,0.6,-0.72,0.55,-2.35);
  const wheels=[], fronts=[];
  const mk=(x,z,r,w,front)=>{ const piv=new THREE.Group(); piv.position.set(x,r,z); const wh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,w,14),tyre); wh.rotation.z=Math.PI/2; wh.castShadow=true; piv.add(wh); g.add(piv); wheels.push(wh); if(front) fronts.push(piv); };
  mk(0.98,1.75,0.36,0.38,true); mk(-0.98,1.75,0.36,0.38,true); mk(0.98,-1.65,0.4,0.46,false); mk(-0.98,-1.65,0.4,0.46,false);
  g.userData={wheels,fronts}; return g;
}

/** Starting-grid position for grid slot `slot` (0 = pole). */
export function spawnSlot(slot){
  const T=G.track; const back=Math.round((12+Math.floor(slot/2)*9+(slot%2)*3)/T.ds); const i=(T.N-back)%T.N; const lat=slot%2?3.2:-3.2;
  return {x:T.px[i]+T.nx[i]*lat, z:T.pz[i]+T.nz[i]*lat, h:Math.atan2(T.tx[i],T.tz[i]), idx:i};
}
export function newCar(name,col,acc,human,pi){ const mesh=makeCarMesh(col,acc); G.scene.add(mesh);
  return {name,col,mesh,human,pi,x:0,z:0,h:0,v:0,steer:0,idx:0,lat:0,lap:0,half:true,noTime:false,lapStart:0,lastLap:null,best:null,laps:[],finished:false,finishTime:0,place:0,wall:false,stuck:0,skill:1,line:0,thr:0}; }

/** Copy simulated position into the 3D model and spin the wheels. */
export function placeMesh(c,dt){ c.mesh.position.set(c.x,0,c.z); c.mesh.rotation.y=c.h; const u=c.mesh.userData; u.wheels.forEach(w=>w.rotation.x+=c.v*dt/0.38); u.fronts.forEach(f=>f.rotation.y=-c.steer*0.35); }
