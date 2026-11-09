/* Player input: keyboard, on-screen touch buttons, phone tilt and gamepads,
   plus gamepad navigation of the menus. */
import { $, clamp } from './utils.js';
import { S } from './config.js';
import { G } from './state.js';
import { resetCar } from './physics.js';
import { cycleCam } from './camera.js';
import { togglePause } from './menu.js';
import { toggleMute } from './audio.js';

/* ---------------- keyboard ---------------- */
const keys=new Set();
addEventListener('keydown',e=>{ keys.add(e.code);
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code) && G.state!=='menu') e.preventDefault();
  if(e.code==='Escape'||e.code==='KeyP') togglePause();
  if(e.code==='KeyM') toggleMute();
  if(G.game && (G.state==='race'||G.state==='countdown')){
    if(e.code==='KeyC') cycleCam(0); if(e.code==='KeyV') cycleCam(1);
    if(e.code==='KeyR') resetCar(G.game.humans[0]); if(e.code==='Slash') resetCar(G.game.humans[1]);
  }
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
function keyInput(set){ const k=c=>keys.has(c)?1:0; return { thr:k(set[0]), brk:k(set[1]), str:k(set[3])-k(set[2]) }; }
const KB1=['KeyW','KeyS','KeyA','KeyD'], KB2=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];

/* ---------------- touch buttons ---------------- */
const touch={l:false,r:false,g:false,b:false};
[['#tL','l'],['#tR','r'],['#tG','g'],['#tB','b']].forEach(([s,k])=>{ const el=$(s);
  const on=e=>{ e.preventDefault(); touch[k]=true; el.classList.add('on'); }, off=e=>{ e.preventDefault(); touch[k]=false; el.classList.remove('on'); };
  el.addEventListener('pointerdown',on); el.addEventListener('pointerup',off); el.addEventListener('pointerleave',off); el.addEventListener('pointercancel',off);
  el.addEventListener('contextmenu',e=>e.preventDefault()); });

/* ---------------- tilt steering ----------------
   Hold the phone sideways like a steering wheel. We take gravity from the
   accelerometer, rotate it into screen coordinates and measure how far the
   phone is rolled. Turning it clockwise (right edge down) steers right. */
export const tilt={listening:false,have:false,roll:0};
const TILT_FULL=0.42;   // radians of roll for full lock (~24°)
const TILT_DEAD=0.04;   // small dead zone so a level phone drives straight
function onMotion(e){
  const a=e.accelerationIncludingGravity; if(!a||a.x==null||a.y==null) return;
  const ang=((screen.orientation&&screen.orientation.angle)??window.orientation??0)*Math.PI/180;
  let sx=a.x*Math.cos(ang)-a.y*Math.sin(ang), sy=a.x*Math.sin(ang)+a.y*Math.cos(ang);
  // "up" must point to the top of the screen; flipping both axes fixes iOS's
  // opposite sign convention and any landscape-left/right mix-up.
  if(sy<0){ sx=-sx; sy=-sy; }
  if(sy<1) return; // phone lying flat: can't read a reliable roll
  tilt.roll=Math.atan2(sx,sy); tilt.have=true;
}
/** Start listening to the motion sensor. iPhones need permission, asked from a tap.
    Resolves false only if permission was explicitly refused AND no sensor data arrives. */
export async function enableTilt(){
  if(!tilt.listening){ addEventListener('devicemotion',onMotion); tilt.listening=true; }
  let ok=true;
  try{
    if(typeof DeviceMotionEvent!=='undefined' && typeof DeviceMotionEvent.requestPermission==='function')
      ok=(await DeviceMotionEvent.requestPermission())==='granted';
  }catch(e){ ok=false; }
  if(!ok){ await new Promise(r=>setTimeout(r,600)); ok=tilt.have; }
  return ok;
}
function tiltSteer(){
  let r=-tilt.roll; const s=Math.sign(r); r=Math.max(0,Math.abs(r)-TILT_DEAD)/(TILT_FULL-TILT_DEAD);
  return clamp(s*r,-1,1);
}

/* ---------------- gamepads ---------------- */
export function getPads(){ try{ return navigator.getGamepads?[...navigator.getGamepads()].filter(p=>p&&p.connected):[]; }catch(e){ return []; } }
const bv=(p,i)=>p.buttons[i]?(p.buttons[i].value||(p.buttons[i].pressed?1:0)):0;
function padInput(p){ let ax=p.axes[0]||0; if(Math.abs(ax)<0.12) ax=0; else ax=Math.sign(ax)*(Math.abs(ax)-0.12)/0.88;
  let str=ax; if(bv(p,14)) str=-1; if(bv(p,15)) str=1;
  return { thr:Math.max(bv(p,7),bv(p,0)), brk:Math.max(bv(p,6),bv(p,2)), str }; }

/** Combined driving input {thr, brk, str} for human player `pi`. */
export function readInput(pi){
  const pads=getPads(); const out={thr:0,brk:0,str:0};
  const merge=i=>{ out.thr=Math.max(out.thr,i.thr); out.brk=Math.max(out.brk,i.brk); if(Math.abs(i.str)>Math.abs(out.str)) out.str=i.str; };
  if(G.game.humans.length===1){
    pads.forEach(p=>merge(padInput(p))); merge(keyInput(KB1)); merge(keyInput(KB2));
    merge({thr:touch.g?1:0,brk:touch.b?1:0,str:(touch.r?1:0)-(touch.l?1:0)});
    if(S.steer==='tilt' && tilt.have) merge({thr:0,brk:0,str:tiltSteer()});
  }
  else { if(pads[pi]) merge(padInput(pads[pi])); merge(keyInput(pi===0?KB1:KB2)); }
  return out;
}

/* pad edge detection for menus & race buttons */
const padPrev=new Map();
export function pollPadButtons(){
  const pads=getPads(), game=G.game;
  pads.forEach((p,pi)=>{
    const prev=padPrev.get(p.index)||{}; const now={};
    const ay=p.axes[1]||0, ax=p.axes[0]||0;
    now.up=bv(p,12)>0.5||ay<-0.6; now.down=bv(p,13)>0.5||ay>0.6; now.left=bv(p,14)>0.5||ax<-0.6; now.right=bv(p,15)>0.5||ax>0.6;
    now.a=bv(p,0)>0.5; now.b=bv(p,1)>0.5; now.y=bv(p,3)>0.5; now.lb=bv(p,4)>0.5; now.rb=bv(p,5)>0.5; now.start=bv(p,9)>0.5||bv(p,8)>0.5;
    const e=k=>now[k]&&!prev[k];
    const ov=currentOverlay();
    if(ov){
      if(e('up')||e('left')) moveFocus(ov,-1);
      if(e('down')||e('right')) moveFocus(ov,1);
      if(e('a')){ const f=ov.querySelector('button.focus'); if(f) f.click(); else moveFocus(ov,0); }
      if(e('b') && ov.id==='pause') togglePause();
      if(e('start') && ov.id==='pause') togglePause();
      else if(e('start') && ov.id==='menu') $('#startBtn').click();
    } else if(game && (G.state==='race'||G.state==='countdown')){
      const hi=game.humans.length===1?0:pi;
      if(e('start')) togglePause();
      if(e('y')) resetCar(game.humans[hi]);
      if(e('lb')||e('rb')) cycleCam(hi);
    }
    padPrev.set(p.index,now);
  });
  const ps=$('#padStatus'); const txt=pads.length?`🎮 ${pads.length} controller${pads.length>1?'s':''} connected — use the stick and A to pick`:'🎮 No controller detected yet. Plug it in and press any button.';
  if(ps.textContent!==txt) ps.textContent=txt;
}
function currentOverlay(){ return ['#menu','#pause','#results'].map(s=>$(s)).find(o=>o.classList.contains('show')); }
export function moveFocus(ov,d){
  const list=[...ov.querySelectorAll('button')].filter(b=>b.offsetParent!==null);
  let i=list.findIndex(b=>b.classList.contains('focus'));
  list.forEach(b=>b.classList.remove('focus'));
  if(i<0) i=list.indexOf(ov.querySelector('.start'))>=0&&d===0?list.indexOf(ov.querySelector('.start')):0; else i=(i+d+list.length)%list.length;
  list[i].classList.add('focus'); list[i].scrollIntoView({block:'nearest'});
}
