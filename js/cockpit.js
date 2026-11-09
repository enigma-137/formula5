/* Onboard "inside the car" view: halo, steering wheel with a live display,
   gloved hands that turn the wheel, cockpit rims and mirrors.
   Everything is built in car-local space (+z forward, +y up) and added to the
   player's car, but only shown while that player's camera is in cockpit mode. */
import * as THREE from 'three';
import { VTOP } from './config.js';
import { G } from './state.js';
import { standings } from './physics.js';

/** Driver's eye position in car-local space. */
export const EYE = new THREE.Vector3(0, 1.08, -0.28);

const V = (x,y,z) => new THREE.Vector3(x,y,z);
function tube(points, r, mat, seg=48){
  const curve = new THREE.CatmullRomCurve3(points.map(p=>V(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 12, false), mat);
}
function roundRect(w,h,r,depth){
  const s=new THREE.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
  return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:2,curveSegments:8});
}
const UP = V(0,1,0);
/** Point a unit-height cylinder from a to b. */
function aim(mesh,a,b){ const d=b.clone().sub(a); mesh.position.copy(a).addScaledVector(d,0.5); mesh.scale.set(1,d.length(),1); mesh.quaternion.setFromUnitVectors(UP,d.normalize()); }

/* ---------- steering-wheel display ---------- */
const LED_COLS=['#19e05a','#19e05a','#19e05a','#19e05a','#19e05a','#ff2a2a','#ff2a2a','#ff2a2a','#ff2a2a','#ff2a2a','#7a5cff','#7a5cff','#7a5cff','#7a5cff','#7a5cff'];
function drawDisplay(g,c,info){
  const W=256,H=150; g.fillStyle='#04070a'; g.fillRect(0,0,W,H);
  // rev lights
  const lit=Math.round((c.v<0.5?0:c.rpm||0)*15);
  for(let i=0;i<15;i++){ g.beginPath(); g.arc(18+i*15.7,13,6,0,7); g.fillStyle=i<lit?LED_COLS[i]:'#1b1f24'; g.fill(); }
  g.strokeStyle='#2a3038'; g.lineWidth=2; g.strokeRect(6,28,W-12,H-34);
  // gear
  g.fillStyle='#fff'; g.font='bold 78px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(info.gear,W/2,92);
  // speed
  g.textAlign='left'; g.font='bold 30px Arial'; g.fillStyle='#fff'; g.fillText(String(info.kmh),14,58);
  g.font='13px Arial'; g.fillStyle='#8fa3b5'; g.fillText('KM/H',14,80);
  // lap / position
  g.textAlign='right'; g.font='bold 22px Arial'; g.fillStyle='#ffd400'; g.fillText(info.pos,W-14,56);
  g.font='bold 18px Arial'; g.fillStyle='#fff'; g.fillText(info.lap,W-14,84);
  // throttle / brake bars
  g.fillStyle='#1b1f24'; g.fillRect(14,118,100,12); g.fillRect(W-114,118,100,12);
  g.fillStyle='#19e05a'; g.fillRect(14,118,100*(c.thr||0),12);
  g.fillStyle='#ff2a2a'; g.fillRect(W-114,118,100*(c.brk||0),12);
}

/** Build the cockpit for a car and attach it to the car's mesh. */
export function makeCockpit(car){
  const g=new THREE.Group(); g.visible=false;
  const body=new THREE.MeshStandardMaterial({color:car.col,metalness:0.4,roughness:0.35});
  const carbon=new THREE.MeshStandardMaterial({color:0x16191d,metalness:0.3,roughness:0.55});
  const halo=new THREE.MeshStandardMaterial({color:0x22262b,metalness:0.6,roughness:0.3});
  const rubber=new THREE.MeshStandardMaterial({color:0x0c0d0f,roughness:0.95});
  const glove=new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:0.8});
  const suit=new THREE.MeshStandardMaterial({color:car.col,roughness:0.7});

  // halo: hoop around the driver's head plus the centre pillar
  g.add(tube([[0.46,0.74,-0.5],[0.44,1.02,-0.3],[0.38,1.16,0.05],[0.22,1.22,0.4],[0,1.24,0.56],[-0.22,1.22,0.4],[-0.38,1.16,0.05],[-0.44,1.02,-0.3],[-0.46,0.74,-0.5]],0.034,halo,64));
  g.add(tube([[0,1.24,0.56],[0,1.15,0.82],[0,0.98,1.05],[0,0.86,1.22]],0.032,halo,24));

  // cockpit rims either side, curving down towards the nose
  [1,-1].forEach(s=>{
    g.add(tube([[s*0.36,0.74,-0.6],[s*0.37,0.78,-0.1],[s*0.34,0.8,0.45],[s*0.26,0.78,0.95],[s*0.14,0.74,1.45]],0.042,body,32));
    const wall=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.3,1.4),body); wall.position.set(s*0.37,0.6,0.05); g.add(wall);
    // sidepod top and mirror
    const pod=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.08,1.2),body); pod.position.set(s*0.62,0.6,0.0); pod.rotation.z=-s*0.12; g.add(pod);
    const stalk=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,1,6),carbon); aim(stalk,V(s*0.5,0.66,0.55),V(s*0.74,0.84,0.68)); g.add(stalk);
    const house=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.07,0.06),body); house.position.set(s*0.8,0.86,0.7); g.add(house);
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(0.145,0.05).rotateY(Math.PI),new THREE.MeshBasicMaterial({color:0x7d97ad}));
    glass.position.set(s*0.8,0.86,0.668); g.add(glass);
  });
  // dash / front cowl in front of the wheel
  const cowl=new THREE.Mesh(new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2),body);
  cowl.scale.set(0.3,0.1,0.75); cowl.position.set(0,0.7,1.1); g.add(cowl);
  const dash=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.08,0.4),carbon); dash.position.set(0,0.68,0.6); g.add(dash);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(0.64,0.02,1.2),carbon); floor.position.set(0,0.705,-0.1); g.add(floor);

  // steering wheel: tilt group (column angle) -> spin group (steering)
  const tilt=new THREE.Group(); tilt.position.set(0,0.78,0.36); tilt.rotation.x=0.42; g.add(tilt);
  const spin=new THREE.Group(); tilt.add(spin);
  const wb=new THREE.Mesh(roundRect(0.3,0.15,0.035,0.03),carbon); wb.position.z=-0.005; spin.add(wb);
  const top=new THREE.Mesh(roundRect(0.18,0.05,0.02,0.025),carbon); top.position.set(0,0.085,0); spin.add(top);
  [1,-1].forEach(s=>{ const grip=new THREE.Mesh(new THREE.CapsuleGeometry(0.034,0.12,4,12),rubber); grip.position.set(s*0.165,-0.005,0.01); grip.rotation.z=s*0.18; spin.add(grip); });
  // display
  const cv=document.createElement('canvas'); cv.width=256; cv.height=150; const ctx=cv.getContext('2d');
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(0.13,0.076).rotateY(Math.PI),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));
  screen.position.set(0,0.008,-0.012); spin.add(screen);
  // buttons and rotary dials around the screen
  const btnCols=[0x2e7d32,0xc62828,0x1565c0,0xf9a825,0x6a1b9a,0xeeeeee];
  [[-0.1,0.04],[-0.1,0.0],[-0.1,-0.04],[0.1,0.04],[0.1,0.0],[0.1,-0.04]].forEach(([x,y],i)=>{
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.01,12).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:btnCols[i],roughness:0.4,emissive:btnCols[i],emissiveIntensity:0.15}));
    b.position.set(x,y,-0.014); spin.add(b); });
  [-0.04,0,0.04].forEach(x=>{ const d=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.012,14).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0x8a9099,metalness:0.8,roughness:0.3})); d.position.set(x,-0.055,-0.016); spin.add(d); });
  // gloved hands on the grips
  const hands=[];
  [1,-1].forEach(s=>{
    const hand=new THREE.Group(); hand.position.set(s*0.165,0.0,-0.02); spin.add(hand);
    const palm=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),glove); palm.scale.set(0.04,0.06,0.042); hand.add(palm);
    const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(0.014,0.035,4,8),glove); thumb.position.set(-s*0.035,0.035,-0.012); thumb.rotation.z=s*0.9; hand.add(thumb);
    const cuff=new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.04,0.05,12),glove); cuff.position.set(s*0.015,-0.07,-0.03); cuff.rotation.x=-0.6; hand.add(cuff);
    const wrist=new THREE.Object3D(); wrist.position.set(s*0.02,-0.09,-0.05); hand.add(wrist);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.042,1,12),suit); g.add(arm);
    hands.push({wrist,arm,elbow:V(s*0.3,0.66,-0.5)});
  });

  g.userData={spin,hands,ctx,tex,frame:0};
  car.mesh.add(g); car.cockpit=g;
  return g;
}

const tmp=V(0,0,0);
/** Animate wheel + hands and refresh the display. Call once per frame while visible. */
export function updateCockpit(c){
  const ck=c.cockpit; if(!ck) return; const u=ck.userData;
  u.spin.rotation.z=c.steer*0.8;
  ck.updateMatrixWorld(true);
  u.hands.forEach(h=>{ h.wrist.getWorldPosition(tmp); ck.worldToLocal(tmp); aim(h.arm,h.elbow,tmp); });
  if((u.frame++&1)===0){
    const f=Math.max(0,c.v)/VTOP*7.99;
    const order=G.game?standings():[c];
    const info={ gear:c.v<-0.5?'R':c.v<0.5?'N':String(1+Math.floor(f)), kmh:Math.round(Math.abs(c.v)*3.6),
      pos:G.game&&G.game.cars.length>1?'P'+(order.indexOf(c)+1):'',
      lap:'L'+Math.max(1,c.lap)+(isFinite(G.game?.laps)?'/'+G.game.laps:'') };
    drawDisplay(u.ctx,c,info); u.tex.needsUpdate=true;
  }
}
