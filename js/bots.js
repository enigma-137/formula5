/* AI drivers: follow the racing line at the track's speed profile, scaled by skill,
   and steer around slower cars ahead. */
import { clamp, wrapA } from './utils.js';
import { G } from './state.js';
import { progDist } from './physics.js';

export function botInput(c){
  const T=G.track,N=T.N;
  const look=Math.max(3,Math.round((9+Math.abs(c.v)*0.42)/T.ds)); const j=(c.idx+look)%N;
  let line=c.line;
  for(const o of G.game.cars){ if(o===c) continue; const ahead=progDist(c,o); if(ahead>0&&ahead<26&&Math.abs(o.lat-c.lat)<3.2&&o.v<c.v+3){ line=o.lat>=0?o.lat-4.2:o.lat+4.2; break; } }
  line=clamp(line,-T.hw+1.6,T.hw-1.6);
  const tx=T.px[j]+T.nx[j]*line, tz=T.pz[j]+T.nz[j]*line;
  const d=wrapA(Math.atan2(tx-c.x,tz-c.z)-c.h);
  const str=clamp(-d*2.4,-1,1);
  let vt=T.prof[(c.idx+2)%N]*c.skill; if(Math.abs(c.lat)>T.hw+1) vt=Math.min(vt,35);
  if(c.finished) vt=Math.min(vt,45);
  const thr=c.v<vt-1?1:c.v<vt?0.35:0, brk=c.v>vt+1.5?clamp((c.v-vt)/6,0,1):0;
  if(Math.abs(d)>Math.PI/2) return {thr:0.6,brk:0,str:clamp(-Math.sign(d),-1,1)};
  return {thr,brk,str};
}
