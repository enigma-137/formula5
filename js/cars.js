/* Car models, grid slots and per-car state. */
import * as THREE from 'three';
import { G } from './state.js';

/* Shared geometry for every car (built once, reused). Car-local axes:
   +z forward (nose), +y up, x across. Shapes are side profiles (z,y)
   extruded across the car, so the body has proper F1 curves. */
function profile(pts,width,bevel){
  const s=new THREE.Shape(); pts.forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y)); s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:width,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:12});
  g.rotateY(-Math.PI/2); g.translate(width/2,0,0); return g;
}
let GEO=null;
function carGeo(){
  if(GEO) return GEO;
  // main body: cockpit tub, airbox above the driver, engine cover sloping to the gearbox
  const body=profile([[1.05,0.16],[1.05,0.62],[0.75,0.68],[0.2,0.66],[-0.25,0.7],[-0.42,1.02],[-0.62,1.06],[-1.2,0.86],[-2.1,0.56],[-2.45,0.42],[-2.45,0.16]],0.62,0.08);
  // tapered nose: a cone squashed flat
  const nose=new THREE.CylinderGeometry(0.11,0.32,2.1,16,1).rotateX(Math.PI/2).scale(1,0.62,1).translate(0,0,0);
  // sidepods (one each side): high, rounded front, tapering towards the rear
  const pod=profile([[0.55,0.16],[0.55,0.56],[0.3,0.62],[-0.6,0.56],[-1.5,0.4],[-2.05,0.26],[-2.05,0.16]],0.38,0.07);
  const fin=profile([[-0.7,0.98],[-0.9,1.12],[-2.2,0.86],[-2.2,0.56]],0.025,0);
  const floor=new THREE.BoxGeometry(1.5,0.05,3.9);
  const plane=new THREE.BoxGeometry(1,1,1);
  const tyreF=new THREE.CylinderGeometry(0.36,0.36,0.38,28).rotateZ(Math.PI/2);
  const tyreR=new THREE.CylinderGeometry(0.4,0.4,0.48,28).rotateZ(Math.PI/2);
  const rimF=new THREE.CylinderGeometry(0.24,0.24,0.4,20).rotateZ(Math.PI/2);
  const rimR=new THREE.CylinderGeometry(0.27,0.27,0.5,20).rotateZ(Math.PI/2);
  const ringF=new THREE.TorusGeometry(0.29,0.012,6,32).rotateY(Math.PI/2);
  const ringR=new THREE.TorusGeometry(0.32,0.012,6,32).rotateY(Math.PI/2);
  const helmet=new THREE.SphereGeometry(0.15,20,14);
  const visor=new THREE.SphereGeometry(0.152,20,8,Math.PI/2-0.9,1.8,1.15,0.5);
  const halo=new THREE.TorusGeometry(0.3,0.028,8,24,Math.PI*1.3).rotateX(Math.PI/2).rotateY(0.47);
  const rod=new THREE.CylinderGeometry(1,1,1,6);
  GEO={body,nose,pod,fin,floor,plane,tyreF,tyreR,rimF,rimR,ringF,ringR,helmet,visor,halo,rod};
  return GEO;
}
const MAT={ carbon:new THREE.MeshStandardMaterial({color:0x15181b,roughness:0.55,metalness:0.3}),
  tyre:new THREE.MeshStandardMaterial({color:0x121212,roughness:0.92}),
  rim:new THREE.MeshStandardMaterial({color:0x9aa0a6,roughness:0.3,metalness:0.6}),
  stripe:new THREE.MeshStandardMaterial({color:0xf5c400,roughness:0.6}),
  visor:new THREE.MeshStandardMaterial({color:0x0a0f18,roughness:0.1,metalness:0.9}) };

export function makeCarMesh(col,acc){
  const G_=carGeo(), g=new THREE.Group();
  const body=new THREE.MeshPhysicalMaterial({color:col,metalness:0.45,roughness:0.32,clearcoat:1,clearcoatRoughness:0.15});
  const accent=new THREE.MeshStandardMaterial({color:acc,metalness:0.3,roughness:0.4});
  const {carbon,tyre,rim,stripe,visor}=MAT;
  const put=(geo,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,shadow=true)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.rotation.x=rx; m.castShadow=shadow; g.add(m); return m; };
  const box=(mat,sx,sy,sz,x,y,z,rx=0)=>put(G_.plane,mat,x,y,z,sx,sy,sz,rx);
  const rod=(a,b,r=0.022)=>{ const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A); const m=put(G_.rod,carbon); m.position.copy(A).addScaledVector(d,0.5); m.scale.set(r,d.length(),r); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m; };

  put(G_.floor,carbon,0,0.1,-0.45);
  put(G_.body,body);
  put(G_.nose,body,0,0.4,2.05);
  box(accent,0.2,0.1,0.25,0,0.33,3.05);                    // nose tip
  [1,-1].forEach(s=>put(G_.pod,body,s*0.5,0,0));           // sidepods
  put(G_.fin,accent);                                       // shark fin
  box(accent,0.66,0.02,1.2,0,0.69,-1.0);                   // livery stripe over engine cover
  // front wing: two elements + endplates
  box(accent,1.95,0.035,0.42,0,0.11,3.0);
  box(accent,1.85,0.03,0.26,0,0.2,2.82,-0.35);
  [1,-1].forEach(s=>box(carbon,0.03,0.24,0.6,s*0.98,0.2,2.95));
  // rear wing: main plane, flap, endplates, centre pylon
  box(accent,1.12,0.04,0.34,0,0.98,-2.45);
  box(accent,1.08,0.03,0.22,0,1.1,-2.36,-0.45);
  [1,-1].forEach(s=>box(body,0.035,0.62,0.72,s*0.57,0.78,-2.4));
  box(carbon,0.06,0.5,0.12,0,0.62,-2.42);
  box(carbon,0.9,0.03,0.3,0,0.3,-2.62);                    // beam wing / diffuser lip
  // driver: helmet + visor, halo (hidden from the driver's own cockpit camera)
  const helmet=put(G_.helmet,accent,0,0.88,0.05);
  const vis=put(G_.visor,visor,0,0.88,0.05);
  const halo=put(G_.halo,carbon,0,1.0,0.22);
  const post=box(carbon,0.05,0.32,0.05,0,0.82,0.62);
  const cockpitRim=box(carbon,0.5,0.03,0.7,0,0.69,0.35);
  // mirrors
  const mirrors=[]; [1,-1].forEach(s=>{ mirrors.push(rod([s*0.32,0.66,0.6],[s*0.52,0.8,0.68],0.012), box(body,0.16,0.07,0.06,s*0.57,0.82,0.7)); });
  // wheels: tyre + rim + yellow sidewall rings, and suspension arms
  const wheels=[], fronts=[];
  const mk=(x,z,front)=>{ const piv=new THREE.Group(); const r=front?0.36:0.4; piv.position.set(x,r,z); g.add(piv);
    const spin=new THREE.Group(); piv.add(spin);
    const t=new THREE.Mesh(front?G_.tyreF:G_.tyreR,tyre); t.castShadow=true; spin.add(t);
    spin.add(new THREE.Mesh(front?G_.rimF:G_.rimR,rim));
    const w=front?0.19:0.24; [1,-1].forEach(s=>{ const ring=new THREE.Mesh(front?G_.ringF:G_.ringR,stripe); ring.position.x=s*(w+0.003); spin.add(ring); });
    wheels.push(spin); if(front) fronts.push(piv);
    const inner=Math.sign(x)*0.42; rod([inner,0.28,z+0.18],[x,r+0.04,z]); rod([inner,0.5,z-0.12],[x,r+0.1,z]); };
  mk(0.98,1.75,true); mk(-0.98,1.75,true); mk(0.98,-1.65,false); mk(-0.98,-1.65,false);
  g.userData={wheels,fronts,hide:[helmet,vis,halo,post,cockpitRim,...mirrors]};
  return g;
}

/** Starting-grid position for grid slot `slot` (0 = pole). */
export function spawnSlot(slot){
  const T=G.track; const back=Math.round((12+Math.floor(slot/2)*9+(slot%2)*3)/T.ds); const i=(T.N-back)%T.N; const lat=slot%2?3.2:-3.2;
  return {x:T.px[i]+T.nx[i]*lat, z:T.pz[i]+T.nz[i]*lat, h:Math.atan2(T.tx[i],T.tz[i]), idx:i};
}
export function newCar(name,col,acc,human,pi){ const mesh=makeCarMesh(col,acc); G.scene.add(mesh);
  return {name,col,mesh,human,pi,x:0,z:0,h:0,v:0,steer:0,idx:0,lat:0,lap:0,half:true,noTime:false,lapStart:0,lastLap:null,best:null,laps:[],finished:false,finishTime:0,place:0,wall:false,stuck:0,skill:1,line:0,thr:0,boost:0}; }

/** Copy simulated position into the 3D model and spin the wheels. */
export function placeMesh(c,dt){ c.mesh.position.set(c.x,0,c.z); c.mesh.rotation.y=c.h; const u=c.mesh.userData; u.wheels.forEach(w=>w.rotation.x+=c.v*dt/0.38); u.fronts.forEach(f=>f.rotation.y=-c.steer*0.35); }
