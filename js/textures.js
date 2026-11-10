/* Procedural canvas textures (asphalt, kerbs, grass, start line, sponsor walls). */
import * as THREE from 'three';
import { hex } from './utils.js';

function canvasTex(w,h,draw,repeat){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  if(repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; }
  t.anisotropy=4; return t;
}
function noiseFill(g,w,h,base,amt,n){
  g.fillStyle=base; g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){ const v=(Math.random()-0.5)*amt; g.fillStyle=v>0?`rgba(255,255,255,${v})`:`rgba(0,0,0,${-v})`; g.fillRect(Math.random()*w,Math.random()*h,2,2); }
}
export const texAsphalt = () => { const t=canvasTex(256,256,(g,w,h)=>{ noiseFill(g,w,h,'#3c3e42',0.16,9000);
  g.fillStyle='#e9e9e9'; g.fillRect(0,0,7,h); g.fillRect(w-7,0,7,h);
  g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(w*0.3,0,w*0.12,h); g.fillRect(w*0.58,0,w*0.12,h); },true);
  t.wrapS=THREE.ClampToEdgeWrapping; return t; };
export const texKerb = () => { const t=canvasTex(8,64,(g,w,h)=>{ g.fillStyle='#d32f2f'; g.fillRect(0,0,w,h/2); g.fillStyle='#f4f4f4'; g.fillRect(0,h/2,w,h/2); },true); t.magFilter=THREE.NearestFilter; return t; };
export const texGround = col => canvasTex(128,128,(g,w,h)=>noiseFill(g,w,h,hex(col),0.22,3000),true);
export const texChecker = () => canvasTex(64,16,(g)=>{ for(let x=0;x<16;x++)for(let y=0;y<4;y++){ g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*4,y*4,4,4);} },false);
export function texWall(def){
  const t=canvasTex(1024,64,(g,w,h)=>{
    const n=def.words.length; const seg=w/n;
    def.words.forEach((wd,i)=>{ const a=i%2?def.wallB:def.wallA, b=i%2?def.wallA:def.wallB;
      g.fillStyle=hex(a); g.fillRect(i*seg,0,seg,h); g.fillStyle=hex(b); g.font='bold 38px "Russo One",Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(wd,i*seg+seg/2,h/2+2); });
  },true);
  t.wrapT=THREE.ClampToEdgeWrapping; return t;
}
/** Glowing chevrons for boost pads (pointing in the direction of travel). */
export const texBoost = () => { const t=canvasTex(64,128,(g,w,h)=>{
  g.clearRect(0,0,w,h); g.fillStyle='rgba(0,229,255,0.45)'; g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(0,229,255,0.9)'; g.lineWidth=6; g.strokeRect(2,0,w-4,h);
  g.fillStyle='#b8fbff'; for(let k=0;k<2;k++){ const y=k*64; g.beginPath(); g.moveTo(8,y+44); g.lineTo(32,y+20); g.lineTo(56,y+44); g.lineTo(56,y+58); g.lineTo(32,y+34); g.lineTo(8,y+58); g.closePath(); g.fill(); }
},true); return t; };
