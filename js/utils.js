/* Small shared helpers. */
export const $ = s => document.querySelector(s);
export const clamp = (v,a,b) => v<a?a:v>b?b:v;
export const wrapA = a => { while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; };
export function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export const store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};
export const fmt = t => { if(t==null||!isFinite(t)) return '-:--.---'; const m=Math.floor(t/60), s=t-m*60; return m+':'+(s<10?'0':'')+s.toFixed(3); };
export const hex = c => '#'+c.toString(16).padStart(6,'0');
/** true on phones/tablets (finger is the main pointer) */
export const isTouch = matchMedia('(pointer:coarse)').matches;
