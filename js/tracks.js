/* Track geometry (spline sampling, speed profile, road/kerb/wall meshes)
   and the per-city scenery for Lagos, Abuja and Benin. */
import * as THREE from 'three';
import { clamp, rng } from './utils.js';
import { VTOP, BRAKE, GRIP, TRACKS, S } from './config.js';
import { G } from './state.js';
import { texAsphalt, texKerb, texGround, texChecker, texWall } from './textures.js';
import { drawMapBase } from './hud.js';

/* ---------------- track ---------------- */
export function makeTrack(def){
  const SC=2;
  const curve=new THREE.CatmullRomCurve3(def.pts.map(p=>new THREE.Vector3(p[0]*SC,0,p[1]*SC)),true,'centripetal');
  const len=curve.getLength(); const N=Math.round(len/2.5); const ds=len/N;
  const sp=curve.getSpacedPoints(N); sp.pop();
  const T={N,ds,len,hw:7.5,wallOff:10,px:new Float32Array(N),pz:new Float32Array(N),tx:new Float32Array(N),tz:new Float32Array(N),nx:new Float32Array(N),nz:new Float32Array(N),curv:new Float32Array(N),prof:new Float32Array(N)};
  for(let i=0;i<N;i++){ T.px[i]=sp[i].x; T.pz[i]=sp[i].z; }
  for(let i=0;i<N;i++){ const a=(i+1)%N,b=(i-1+N)%N; let dx=T.px[a]-T.px[b], dz=T.pz[a]-T.pz[b]; const l=Math.hypot(dx,dz)||1; T.tx[i]=dx/l; T.tz[i]=dz/l; T.nx[i]=-T.tz[i]; T.nz[i]=T.tx[i]; }
  const k=6;
  for(let i=0;i<N;i++){ const a=(i-k+N)%N,b=(i+k)%N; const d=clamp(T.tx[a]*T.tx[b]+T.tz[a]*T.tz[b],-1,1); T.curv[i]=Math.acos(d)/(2*k*ds); }
  const aL=GRIP*0.92, aB=BRAKE*0.72;
  for(let i=0;i<N;i++) T.prof[i]=Math.min(VTOP, Math.sqrt(aL/Math.max(T.curv[i],1e-5)));
  for(let pass=0;pass<2;pass++) for(let i=N-1;i>=0;i--){ const nv=T.prof[(i+1)%N]; T.prof[i]=Math.min(T.prof[i],Math.sqrt(nv*nv+2*aB*ds)); }
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9; for(let i=0;i<N;i++){ minX=Math.min(minX,T.px[i]); maxX=Math.max(maxX,T.px[i]); minZ=Math.min(minZ,T.pz[i]); maxZ=Math.max(maxZ,T.pz[i]); }
  Object.assign(T,{minX,maxX,minZ,maxZ,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2});
  return T;
}
export function nearest(T,x,z,hint){
  let best=0,bd=1e18; const N=T.N;
  const scan=(a,b)=>{ for(let j=a;j<=b;j++){ const i=((j%N)+N)%N; const dx=x-T.px[i],dz=z-T.pz[i],d=dx*dx+dz*dz; if(d<bd){bd=d;best=i;} } };
  if(hint>=0) scan(hint-40,hint+40);
  if(hint<0||bd>1600) scan(0,N-1);
  return best;
}
export function clearOf(T,x,z,d){ const d2=d*d; for(let i=0;i<T.N;i+=2){ const dx=x-T.px[i],dz=z-T.pz[i]; if(dx*dx+dz*dz<d2) return false; } return true; }

export function flatRibbon(T,o1,o2,y,vScale){
  const N=T.N, pos=new Float32Array((N+1)*6), uv=new Float32Array((N+1)*4), idx=[];
  for(let k=0;k<=N;k++){ const i=k%N;
    pos.set([T.px[i]+T.nx[i]*o1,y,T.pz[i]+T.nz[i]*o1, T.px[i]+T.nx[i]*o2,y,T.pz[i]+T.nz[i]*o2],k*6);
    const v=k*T.ds/vScale; uv.set([0,v,1,v],k*4); }
  for(let k=0;k<N;k++){ const a=2*k; idx.push(a,a+2,a+1, a+1,a+2,a+3); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
export function wallRibbon(T,o,h,uScale){
  const N=T.N, pos=new Float32Array((N+1)*6), uv=new Float32Array((N+1)*4), idx=[];
  for(let k=0;k<=N;k++){ const i=k%N, x=T.px[i]+T.nx[i]*o, z=T.pz[i]+T.nz[i]*o;
    pos.set([x,0,z,x,h,z],k*6); const u=k*T.ds/uScale; uv.set([u,0,u,1],k*4); }
  for(let k=0;k<N;k++){ const a=2*k; idx.push(a,a+2,a+1, a+1,a+2,a+3); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------------- world ---------------- */
let scene; // the scene being built; also published as G.scene
export const boxGeo = new THREE.BoxGeometry(1,1,1).translate(0,0.5,0);
const coneGeo = new THREE.ConeGeometry(0.75,1,4,1).translate(0,0.5,0).rotateY(Math.PI/4);
const trunkGeo = new THREE.CylinderGeometry(0.12,0.18,1,6).translate(0,0.5,0);
const canopyGeo = new THREE.IcosahedronGeometry(1,0);
export function instanced(geo,mat,items,shadow){
  if(!items.length) return null;
  const m=new THREE.InstancedMesh(geo,mat,items.length), o=new THREE.Object3D(), c=new THREE.Color();
  items.forEach((it,i)=>{ o.position.set(it.x,it.y||0,it.z); o.rotation.set(0,it.ry||0,0); o.scale.set(it.sx,it.sy,it.sz); o.updateMatrix(); m.setMatrixAt(i,o.matrix); c.set(it.c==null?0xffffff:it.c); m.setColorAt(i,c); });
  m.receiveShadow=!!shadow; scene.add(m); return m;
}
export function disposeScene(sc){ if(!sc) return; sc.traverse(o=>{ if(o.geometry && o.geometry!==boxGeo && o.geometry!==coneGeo && o.geometry!==trunkGeo && o.geometry!==canopyGeo) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } }); }


export function buildWorld(key){
  disposeScene(scene);
  const def=TRACKS[key]; const T=makeTrack(def); G.track=T; G.world={key,def};
  const hi=S.gfx==='high'; const R=rng(def.seed);
  scene=new THREE.Scene(); G.scene=scene; scene.background=new THREE.Color(def.sky); scene.fog=new THREE.Fog(def.sky,def.fog[0],def.fog[1]*(hi?1:0.75));
  scene.add(new THREE.HemisphereLight(0xffffff,def.ground,1.25));
  const sun=new THREE.DirectionalLight(key==='benin'?0xffe0b0:0xfff4e0,2.3); sun.position.set(120,220,80);
  if(hi){ sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); const sc=sun.shadow.camera; sc.left=-45; sc.right=45; sc.top=45; sc.bottom=-45; sc.near=10; sc.far=500; sun.shadow.bias=-0.0006; }
  scene.add(sun); scene.add(sun.target); G.sun=sun;
  // ground
  const gt=texGround(def.ground); gt.repeat.set(400,400);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:gt})); ground.position.set(T.cx,0,T.cz); ground.receiveShadow=hi; scene.add(ground);
  // runoff (slightly different shade) between kerb and wall
  const ro=new THREE.MeshLambertMaterial({color:new THREE.Color(def.ground).offsetHSL(0,-0.1,key==='benin'?0.04:-0.05),side:THREE.DoubleSide});
  [[T.hw+1.3,T.hw+T.wallOff],[-T.hw-1.3,-T.hw-T.wallOff]].forEach(([a,b])=>{ const m=new THREE.Mesh(flatRibbon(T,a,b,0.01,10),ro); m.receiveShadow=hi; scene.add(m); });
  // road
  const road=new THREE.Mesh(flatRibbon(T,-T.hw,T.hw,0.03,14),new THREE.MeshLambertMaterial({map:texAsphalt(),side:THREE.DoubleSide})); road.receiveShadow=hi; scene.add(road);
  const km=new THREE.MeshLambertMaterial({map:texKerb(),side:THREE.DoubleSide});
  scene.add(new THREE.Mesh(flatRibbon(T,T.hw,T.hw+1.3,0.035,8),km)); scene.add(new THREE.Mesh(flatRibbon(T,-T.hw-1.3,-T.hw,0.035,8),km));
  // walls
  const wm=new THREE.MeshLambertMaterial({map:texWall(def),side:THREE.DoubleSide});
  scene.add(new THREE.Mesh(wallRibbon(T,T.hw+T.wallOff,1.3,-60),wm)); scene.add(new THREE.Mesh(wallRibbon(T,-T.hw-T.wallOff,1.3,60),wm));
  const fence=new THREE.MeshLambertMaterial({color:0x444a50,transparent:true,opacity:0.35,side:THREE.DoubleSide});
  [T.hw+T.wallOff+0.1,-T.hw-T.wallOff-0.1].forEach(o=>{ const g=wallRibbon(T,o,3.6,60); g.translate(0,1.3,0); scene.add(new THREE.Mesh(g,fence)); });
  // start line + gantry
  const h0=Math.atan2(T.tx[0],T.tz[0]);
  const line=new THREE.Mesh(new THREE.PlaneGeometry(T.hw*2,2.4).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:texChecker()}));
  line.position.set(T.px[0],0.045,T.pz[0]); line.rotation.y=h0+Math.PI/2; line.material.map.rotation=0; scene.add(line);
  const gan=new THREE.Group(); const gm=new THREE.MeshLambertMaterial({color:0x1b1f22}), gp=new THREE.MeshLambertMaterial({color:def.wallA});
  [-1,1].forEach(s=>{ const p=new THREE.Mesh(boxGeo,gm); p.scale.set(0.8,8,0.8); p.position.x=s*(T.hw+2.5); gan.add(p); });
  const beam=new THREE.Mesh(boxGeo,gp); beam.scale.set(T.hw*2+6,1.6,0.9); beam.position.y=7; gan.add(beam);
  gan.position.set(T.px[0],0,T.pz[0]); gan.rotation.y=h0; scene.add(gan);

  // scenery
  const boxes=[], cones=[], trunks=[], canopies=[], crowd=[];
  const D=T.hw+T.wallOff;
  const rand=(a,b)=>a+R()*(b-a);
  function place(count,pad,minD,maxD,fn){ let tries=0,n=0; while(n<count && tries<count*30){ tries++;
      const i=Math.floor(R()*T.N), side=R()<0.5?-1:1, off=side*rand(minD,maxD); const x=T.px[i]+T.nx[i]*off, z=T.pz[i]+T.nz[i]*off;
      if(!clearOf(T,x,z,D+pad)) continue; fn(x,z,Math.atan2(T.tx[i],T.tz[i]),i); n++; } }
  function ring(count,pad,spread,fn){ let tries=0,n=0; while(n<count && tries<count*30){ tries++;
      const x=rand(T.minX-spread,T.maxX+spread), z=rand(T.minZ-spread,T.maxZ+spread); if(!clearOf(T,x,z,D+pad)) continue; fn(x,z); n++; } }
  function tree(x,z,s,col,palm){ if(palm){ trunks.push({x,z,sx:2,sy:s*2.2,sz:2,c:0x7a5a3a}); canopies.push({x,y:s*2.2,z,sx:s*0.7,sy:s*0.22,sz:s*0.7,c:col}); }
    else { trunks.push({x,z,sx:3,sy:s*0.9,sz:3,c:0x5d4128}); canopies.push({x,y:s*1.1,z,sx:s*0.75,sy:s*0.8,sz:s*0.75,c:col}); } }
  const q=hi?1:0.45;
  // grandstands by the start straight
  const crowdCols = key==='benin'?[0xb5762b,0xffffff,0xe2b04a,0x7a2e12,0x008751]:key==='abuja'?[0x008751,0xffffff,0x008751,0x1d4ed8,0xf5c400]:[0x008751,0xffffff,0xf2c200,0x0b5fa5,0xd62828];
  for(const side of [-1,1]) for(let s=-7;s<=7;s++){ const i=((s*7)%T.N+T.N)%T.N, hd=Math.atan2(T.tx[i],T.tz[i]);
    for(let t=0;t<3;t++){ const off=side*(D+4+t*3), x=T.px[i]+T.nx[i]*off, z=T.pz[i]+T.nz[i]*off;
      if(!clearOf(T,x,z,D+2)) continue;
      boxes.push({x,z,ry:hd,sx:3,sy:1.2+t*1.4,sz:17,c:0x9aa0a6});
      const ppl=Math.round(12*q); for(let p=0;p<ppl;p++){ const a=(p/ppl-0.5)*15; crowd.push({x:x+T.tx[i]*a+T.nx[i]*rand(-0.8,0.8),y:1.2+t*1.4,z:z+T.tz[i]*a+T.nz[i]*rand(-0.8,0.8),ry:hd,sx:0.55,sy:rand(0.9,1.25),sz:0.45,c:crowdCols[Math.floor(R()*crowdCols.length)]}); } }
  }
  if(key==='lagos'){
    const glass=[0xd9e2ec,0x9fb3c8,0x6b8cae,0xe8d5b7,0x4a6fa5,0x7fb2d6,0xc9a27e,0xf1f1f1];
    ring(Math.round(90*q),25,320,(x,z)=>{ const w=rand(14,34); boxes.push({x,z,ry:rand(0,3),sx:w,sy:rand(18,130)*(R()<0.25?1.4:1),sz:w*rand(0.7,1.3),c:glass[Math.floor(R()*glass.length)]}); });
    place(Math.round(36*q),4,D+6,D+30,(x,z,h)=>{ boxes.push({x,z,ry:h+(R()<0.5?0:Math.PI/2),sx:2.5,sy:2.8,sz:8,c:0xf2c200}); boxes.push({x,y:1.2,z,ry:boxes[boxes.length-1].ry,sx:2.56,sy:0.35,sz:8.06,c:0x111111}); });
    place(Math.round(160*q),3,D+3,D+70,(x,z)=>tree(x,z,rand(7,11),0x2f6b2a,true));
    // lagoon + bridge
    const water=new THREE.Mesh(new THREE.PlaneGeometry(4000,900).rotateX(-Math.PI/2),new THREE.MeshPhongMaterial({color:0x2b7fb4,shininess:80,specular:0x88ccff}));
    water.position.set(T.cx,0.06,T.maxZ+D+60+450); scene.add(water);
    const bz=T.maxZ+D+60+220; boxes.push({x:T.cx,y:14,z:bz,sx:2400,sy:1.8,sz:22,c:0xb8b8b0});
    for(let x=-1100;x<=1100;x+=60) boxes.push({x:T.cx+x,z:bz,sx:4,sy:14,sz:6,c:0x9a9a92});
  } else if(key==='abuja'){
    const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(170,2),new THREE.MeshLambertMaterial({color:0x8a7f72,flatShading:true}));
    const p=rock.geometry.attributes.position; for(let i=0;i<p.count;i++){ const f=1+(Math.sin(p.getX(i)*0.05)*0.08+Math.cos(p.getZ(i)*0.07)*0.08); p.setXYZ(i,p.getX(i)*f,p.getY(i)*f,p.getZ(i)*f); } rock.geometry.computeVertexNormals();
    rock.scale.set(1.3,0.62,0.8); rock.position.set(T.maxX+D+330,-20,T.cz); scene.add(rock);
    const rock2=rock.clone(); rock2.scale.set(0.5,0.35,0.45); rock2.position.set(T.maxX+D+120,-10,T.cz-260); scene.add(rock2);
    // mosque-like domed landmark
    const mx=T.minX-D-170, mz=T.cz;
    boxes.push({x:mx,z:mz,sx:60,sy:16,sz:60,c:0xf4f1ea});
    const dome=new THREE.Mesh(new THREE.SphereGeometry(20,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xd4af37,metalness:0.7,roughness:0.3})); dome.position.set(mx,16,mz); scene.add(dome);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>{ boxes.push({x:mx+a*36,z:mz+b*36,sx:3.4,sy:62,sz:3.4,c:0xf4f1ea}); cones.push({x:mx+a*36,y:62,z:mz+b*36,sx:4.2,sy:8,sz:4.2,c:0xd4af37}); });
    ring(Math.round(55*q),25,300,(x,z)=>{ const w=rand(16,40); boxes.push({x,z,ry:rand(0,3),sx:w,sy:rand(8,34),sz:w*rand(0.6,1.2),c:[0xf4efe4,0xe7dcc6,0xd9cbb0,0xbfd1c5][Math.floor(R()*4)]}); });
    place(Math.round(260*q),3,D+3,D+90,(x,z)=>tree(x,z,rand(5,9),[0x2f7d32,0x3b8f3a,0x276b2b][Math.floor(R()*3)],false));
    for(let i=0;i<8;i++){ const h=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),new THREE.MeshLambertMaterial({color:0x5d8b3a})); const a=i/8*Math.PI*2, r=900; h.position.set(T.cx+Math.cos(a)*r,-60,T.cz+Math.sin(a)*r); h.scale.set(rand(200,320),rand(90,160),rand(200,320)); scene.add(h); }
  } else {
    // Benin: earthen walls ringing the city, compounds with pyramid roofs, bronze statues
    const rad=Math.max(T.maxX-T.minX,T.maxZ-T.minZ)/2+D+120;
    for(let a=0;a<Math.PI*2;a+=0.035){ if(Math.sin(a*7)>0.85) continue; const x=T.cx+Math.cos(a)*rad, z=T.cz+Math.sin(a)*rad; boxes.push({x,z,ry:-a,sx:5,sy:rand(7,10),sz:rad*0.04,c:0x7a3b1f}); }
    ring(Math.round(110*q),20,240,(x,z)=>{ const w=rand(8,18), h=rand(4,7), ry=rand(0,3); boxes.push({x,z,ry,sx:w,sy:h,sz:w*rand(0.8,1.3),c:[0xc87f4a,0xb8693a,0xd79a62][Math.floor(R()*3)]}); cones.push({x,y:h,z,ry,sx:w*1.1,sy:w*0.45,sz:w*1.4,c:R()<0.5?0x8b3a1e:0x9c7a3c}); });
    place(Math.round(190*q),3,D+3,D+80,(x,z)=>tree(x,z,rand(6,10),[0x2b5d22,0x3a6b26][Math.floor(R()*2)],R()<0.35));
    const bronze=new THREE.MeshStandardMaterial({color:0xb5762b,metalness:0.85,roughness:0.35});
    for(let s=-3;s<=3;s++){ if(s===0) continue; const i=((s*24)%T.N+T.N)%T.N; const side=s%2?1:-1; const off=side*(D+16); const x=T.px[i]+T.nx[i]*off, z=T.pz[i]+T.nz[i]*off; if(!clearOf(T,x,z,D+4)) continue;
      boxes.push({x,z,sx:5,sy:3,sz:5,c:0x6b5a4a});
      const head=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.9,5.5,16),bronze); head.position.set(x,5.75,z); scene.add(head);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(2.1,1.7,1.4,16),bronze); top.position.set(x,9.1,z); scene.add(top); }
  }
  const lam=new THREE.MeshLambertMaterial({color:0xffffff});
  instanced(boxGeo,lam,boxes); instanced(coneGeo,lam,cones); instanced(trunkGeo,lam,trunks); instanced(canopyGeo,new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),canopies); instanced(boxGeo,lam,crowd);
  drawMapBase();
}
