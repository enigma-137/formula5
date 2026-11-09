/* Car physics, walls, lap counting, car-to-car collisions and standings. */
import { wrapA, store, fmt } from './utils.js';
import { VTOP, ACC, BRAKE, GRIP, S } from './config.js';
import { G } from './state.js';
import { nearest } from './tracks.js';
import { flash } from './hud.js';

export function stepCar(c,inp,dt){
  const T=G.track; const off=Math.abs(c.lat)>T.hw+1.4;
  const vtop=off?40:VTOP; let v=c.v;
  c.thr=inp.thr;
  c.steer+=(inp.str-c.steer)*Math.min(1,dt*(c.human?9:7));
  if(inp.thr>0.02){ if(v<0) v+=30*inp.thr*dt; else v+=ACC*inp.thr*Math.max(0,1-(v/vtop)**2)*(off?0.6:1)*dt; }
  if(inp.brk>0.02){ if(v>0.5) v-=BRAKE*inp.brk*dt; else v=Math.max(-10,v-8*inp.brk*dt); }
  if(inp.thr<=0.02) v-=Math.sign(v)*(0.8+0.0006*v*v)*dt;
  if(off && v>vtop) v-=(v-vtop)*1.3*dt;
  const sa=c.steer*0.5/(1+Math.abs(v)*0.035);
  let w=v/3.6*Math.tan(sa);
  const grip=off?24:GRIP, wmax=grip/Math.max(Math.abs(v),1);
  if(Math.abs(w)>wmax){ w=Math.sign(w)*wmax; v-=Math.sign(v)*Math.min(Math.abs(v),Math.abs(v)*0.12*dt); }
  c.h=wrapA(c.h-w*dt); c.v=v;
  c.x+=Math.sin(c.h)*v*dt; c.z+=Math.cos(c.h)*v*dt;
  const prev=c.idx; c.idx=nearest(T,c.x,c.z,c.idx); const i=c.idx;
  c.lat=(c.x-T.px[i])*T.nx[i]+(c.z-T.pz[i])*T.nz[i];
  const lim=T.hw+T.wallOff-1.1;
  if(Math.abs(c.lat)>lim){ const s=Math.sign(c.lat), push=c.lat-s*lim; c.x-=T.nx[i]*push; c.z-=T.nz[i]*push; c.lat=s*lim;
    if(!c.wall){ c.v*=0.72; const vw=G.views.find(q=>q.car===c); if(vw) vw.shake=0.35; }
    c.wall=true; const th=Math.atan2(T.tx[i],T.tz[i]); const d=wrapA(th-c.h); if(Math.abs(d)<Math.PI/2) c.h=wrapA(c.h+d*Math.min(1,dt*3)); }
  else c.wall=false;
  lapLogic(c,prev);
}
function lapLogic(c,prev){
  const N=G.track.N;
  if(c.idx>N*0.4 && c.idx<N*0.6) c.half=true;
  if(prev>N*0.75 && c.idx<N*0.25){ if(c.half){ crossLine(c); c.half=false; } }
  else if(prev<N*0.25 && c.idx>N*0.75){ c.lap--; c.half=true; c.noTime=true; }
}
function crossLine(c){
  const t=G.raceTime, game=G.game;
  if(c.lap>=1 && !c.noTime){ const lt=t-c.lapStart; c.lastLap=lt; c.laps.push(lt); if(!c.best||lt<c.best) c.best=lt;
    if(!G.fastest||lt<G.fastest.t) G.fastest={t:lt,name:c.name};
    if(c.human){ if(S.mode==='tt'){ const key='f5_best_'+S.track, rec=store.get(key,null); if(!rec||lt<rec){ store.set(key,lt); flash(c,'NEW RECORD '+fmt(lt),2.2); } else flash(c,fmt(lt),1.6); }
      else if(c.lap<game.laps) flash(c,'LAP '+fmt(lt),1.4); } }
  c.noTime=false;
  if(c.lap>=1) c.lapStart=t;
  c.lap++;
  if(S.mode!=='tt'){
    if(c.lap>game.laps && !c.finished){ c.finished=true; c.finishTime=t; c.place=++G.finishCount; if(c.human) flash(c,c.place===1?'🏆 WINNER!':'FINISHED P'+c.place,3); }
    else if(c.human && c.lap===game.laps && game.laps>1) flash(c,'FINAL LAP',1.8);
  }
}
/** Distance along the track from car a to car b (positive = b is ahead). */
export function progDist(a,b){ const N=G.track.N; let d=b.idx-a.idx; if(d>N/2) d-=N; if(d<-N/2) d+=N; return d*G.track.ds; }
export function resetCar(c){ if(!c) return; const T=G.track,i=(c.idx+2)%T.N; c.x=T.px[i]; c.z=T.pz[i]; c.h=Math.atan2(T.tx[i],T.tz[i]); c.v=0; c.steer=0; c.lat=0; c.prevIdx=c.idx; c.idx=i; }
export function collide(){
  const cs=G.game.cars;
  for(let a=0;a<cs.length;a++) for(let b=a+1;b<cs.length;b++){ const A=cs[a],B=cs[b]; const dx=B.x-A.x, dz=B.z-A.z, d2=dx*dx+dz*dz; if(d2>16||d2<1e-6) continue;
    const d=Math.sqrt(d2), p=(4-d)/2, nx=dx/d, nz=dz/d; A.x-=nx*p; A.z-=nz*p; B.x+=nx*p; B.z+=nz*p;
    const [back,front]=progDist(A,B)>0?[A,B]:[B,A]; if(back.v>front.v){ const m=(back.v+front.v)/2; back.v=m-0.5; front.v=Math.max(front.v,m*0.98); }
    [A,B].forEach(c=>{ const vw=G.views.find(q=>q.car===c); if(vw) vw.shake=Math.max(vw.shake,0.15); }); }
}
/** Race order: finishers by time, then everyone else by distance covered. */
export function standings(){ const N=G.track.N; return [...G.game.cars].sort((a,b)=>{ if(a.finished&&b.finished) return a.finishTime-b.finishTime; if(a.finished) return -1; if(b.finished) return 1; return (b.lap*N+b.idx)-(a.lap*N+a.idx); }); }
