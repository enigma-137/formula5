/* TraceIQ sponsor placements (https://traceiq.run).
   Kept deliberately light: ~6 logo panels on the walls of the straights and
   3–4 billboards outside the corners, angled towards approaching drivers. */
import * as THREE from 'three';
import { clearOf } from './tracks.js';

const BLUE='#2f5be0', ORANGE='#e8692c', INK='#0d0f12', SKY='#dce9f9';
const FONT='"Inter","Helvetica Neue",Arial,sans-serif';

function tex(w,h,draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
/** "TraceIQ." wordmark: black text with a blue full stop. Returns its width. */
function logo(g,x,y,size,ink=INK){
  g.font=`800 ${size}px ${FONT}`; g.textBaseline='alphabetic'; g.textAlign='left';
  g.fillStyle=ink; g.fillText('TraceIQ',x,y); const w=g.measureText('TraceIQ').width;
  g.fillStyle=BLUE; g.fillText('.',x+w,y); return w+g.measureText('.').width;
}

/* Wall panel: white, logo on the left, web address on the right. 8 m x 1.2 m */
const wallTex=()=>tex(1024,154,(g,w,h)=>{
  g.fillStyle='#ffffff'; g.fillRect(0,0,w,h);
  g.fillStyle=BLUE; g.fillRect(0,0,14,h); g.fillStyle=ORANGE; g.fillRect(0,h-10,w,10);
  logo(g,48,108,92);
  g.font=`600 46px ui-monospace,Menlo,Consolas,monospace`; g.fillStyle=BLUE; g.textAlign='right'; g.fillText('traceiq.run',w-36,100);
});

/* Billboard: logo, two-line headline in the brand style, address. 14 m x 5.25 m */
const boardTex=()=>tex(1024,384,(g,w,h)=>{
  g.fillStyle=SKY; g.fillRect(0,0,w,h);
  // the orange "trace line" with event dots, from their hero image
  g.strokeStyle=ORANGE; g.lineWidth=7; g.beginPath(); g.moveTo(0,330);
  g.bezierCurveTo(260,360,420,250,600,300); g.bezierCurveTo(780,350,880,280,w,250); g.stroke();
  g.fillStyle=ORANGE; [[150,345],[600,300],[930,262]].forEach(([x,y])=>g.fillRect(x-11,y-11,22,22));
  logo(g,44,82,62);
  g.font=`800 70px ${FONT}`; g.textAlign='left'; g.fillStyle=INK; g.fillText('See what users do,',44,172);
  const t2='and what broke.'; const tw=g.measureText(t2).width;
  g.fillStyle=BLUE; g.fillRect(36,190,tw+24,84); g.fillStyle='#fff'; g.fillText(t2,48,256);
  g.font=`600 40px ui-monospace,Menlo,Consolas,monospace`; g.fillStyle=BLUE; g.textAlign='right'; g.fillText('traceiq.run',w-40,80);
});

let mats=null;
function materials(){
  if(mats) return mats;
  mats={ wall:new THREE.MeshLambertMaterial({map:wallTex()}),
    board:new THREE.MeshLambertMaterial({map:boardTex()}),
    back:new THREE.MeshLambertMaterial({color:0x1b1f24}),
    steel:new THREE.MeshLambertMaterial({color:0x8d949c}) };
  return mats;
}

/** Index near `i` with the straightest track (so a flat panel sits flush). */
function straightest(T,i,range){ let best=i,bc=1e9; for(let d=-range;d<=range;d++){ const j=((i+d)%T.N+T.N)%T.N; if(T.curv[j]<bc){ bc=T.curv[j]; best=j; } } return best; }

export function addTraceIQ(T,scene){
  const M=materials(), N=T.N, wallO=T.hw+T.wallOff-0.07;
  // ---- wall panels: 6 per track, evenly spread, alternating sides ----
  const PANELS=6; T.ads={panels:[],boards:[],spots:[]};
  for(let k=0;k<PANELS;k++){
    const i=straightest(T,Math.floor((k+0.35)/PANELS*N),25), side=k%2?1:-1;
    const nx=T.nx[i]*side, nz=T.nz[i]*side;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(8,1.2),M.wall);
    m.position.set(T.px[i]+nx*wallO,0.66,T.pz[i]+nz*wallO);
    m.rotation.y=Math.atan2(-nx,-nz);   // face the road
    scene.add(m); T.ads.panels.push(i);
  }
  // ---- billboards: outside the corners that end long straights ----
  const D=T.hw+T.wallOff, picks=[]; let run=0;
  for(let j=0;j<N*2 && picks.length<4;j++){ const i=j%N;
    if(T.curv[i]<0.004){ run++; continue; }
    if(run>=40 && !picks.some(p=>Math.min(Math.abs(p-i),N-Math.abs(p-i))<N/6)) picks.push(i);
    run=0; }
  for(const i of picks){
    const a=(i-6+N)%N, b=(i+14)%N;
    // which way does the corner turn? put the board on the outside
    const turn=(T.px[b]-T.px[a])*T.nx[a]+(T.pz[b]-T.pz[a])*T.nz[a], side=turn>0?-1:1;
    const off=side*(D+11), x=T.px[i]+T.nx[i]*off, z=T.pz[i]+T.nz[i]*off;
    if(!clearOf(T,x,z,D+6)) continue;
    const g=new THREE.Group(); g.position.set(x,0,z);
    // face drivers coming down the straight, turned a little towards the road
    g.rotation.y=Math.atan2(-T.tx[i],-T.tz[i])-side*0.45;
    const face=new THREE.Mesh(new THREE.PlaneGeometry(14,5.25),M.board); face.position.set(0,6.2,0.32); g.add(face);
    const back=new THREE.Mesh(new THREE.BoxGeometry(14.4,5.6,0.3),M.back); back.position.y=6.2; g.add(back);
    [-4.5,4.5].forEach(px=>{ const leg=new THREE.Mesh(new THREE.BoxGeometry(0.35,3.6,0.35),M.steel); leg.position.set(px,1.8,0); g.add(leg); });
    g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
    scene.add(g); T.ads.boards.push(i);
    // clear zone around the board and in front of it (towards the approaching cars)
    T.ads.spots.push({x,z,r:16},{x:x+T.tx[i]*-30,z:z+T.tz[i]*-30,r:18});
  }
}
