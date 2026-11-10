/* Player profile saved on this device: name, championship points, race
   stats and personal-best lap per track. (No server: each phone keeps its own.) */
import { store } from './utils.js';

const KEY='f5_profile';
export const POINTS=[25,18,15,12,10,8,6,4,2,1];   // F1 points for P1..P10

export const profile=Object.assign(
  {name:'', points:0, races:0, wins:0, podiums:0, online:0, onlineWins:0},
  store.get(KEY,{}));
if(!profile.name) profile.name='Driver'+Math.floor(100+Math.random()*900);
export function saveProfile(){ store.set(KEY,profile); }
export function setName(n){ n=String(n||'').replace(/[<>&"]/g,'').trim().slice(0,14); if(n){ profile.name=n; saveProfile(); } return profile.name; }

/** Award points for a finished race. Returns the points earned. */
export function awardRace({pos, field, online, fastestLap}){
  if(field<2) return 0;                         // racing nobody earns nothing
  const pts=(POINTS[pos-1]||0)+(fastestLap && pos<=10?1:0);
  profile.points+=pts; profile.races++;
  if(pos===1) profile.wins++;
  if(pos<=3) profile.podiums++;
  if(online){ profile.online++; if(pos===1) profile.onlineWins++; }
  saveProfile(); return pts;
}

/** Personal best lap per track (any mode). Returns true if `t` is a new PB. */
export const getBest=track=>store.get('f5_best_'+track,null);
export function submitLap(track,t){ const b=getBest(track); if(b==null||t<b){ store.set('f5_best_'+track,t); return true; } return false; }
