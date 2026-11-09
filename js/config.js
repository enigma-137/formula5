/* Tuning constants, track definitions, driver liveries and saved settings. */
import { store } from './utils.js';

// car physics: top speed (m/s), acceleration, braking, lateral grip
export const VTOP=92, ACC=15, BRAKE=46, GRIP=42;

// Each track is a closed Catmull-Rom spline through `pts` (scaled x2 in tracks.js).
export const TRACKS = {
  lagos:{ name:'Lagos', sub:'Eko Lagoon Street Circuit', seed:11,
    pts:[[0,0],[300,0],[420,40],[460,140],[400,220],[260,230],[200,300],[220,400],[120,460],[-40,430],[-120,330],[-80,200],[-160,120],[-140,30]],
    sky:0x9ccff0, fog:[260,1500], ground:0x5b8a38, wallA:0x0b5fa5, wallB:0xf2c200, words:['EKO','LAGOS','FORMULA 5','DANFO','NAIJA'] },
  abuja:{ name:'Abuja', sub:'Aso Rock Ring', seed:22,
    pts:[[0,0],[200,-40],[380,0],[450,120],[380,260],[220,240],[150,320],[200,420],[60,480],[-120,420],[-200,260],[-120,120]],
    sky:0xa9d8ff, fog:[320,1800], ground:0x6a9a42, wallA:0x007a45, wallB:0xffffff, words:['ABUJA','ASO ROCK','FORMULA 5','FCT','NAIJA'] },
  benin:{ name:'Benin', sub:'Ancient Walls Circuit', seed:33,
    pts:[[0,0],[150,-20],[260,40],[280,160],[200,200],[220,300],[120,380],[-20,360],[-60,260],[-180,240],[-220,120],[-130,40]],
    sky:0xf0d2a2, fog:[150,950], ground:0x9a5634, wallA:0x7a2e12, wallB:0xe2b04a, words:['BENIN','OBA','FORMULA 5','EDO','BRONZE'] }
};
export const BOTS = [['Tunde',0xd62828,0xffffff],['Amara',0x1d4ed8,0xfacc15],['Kofi',0xf97316,0x111111],['Zainab',0x7c3aed,0xffffff],
              ['Chidi',0x0ea5e9,0x0f172a],['Ngozi',0xec4899,0xffffff],['Sipho',0x15803d,0xfacc15],['Ayo',0x475569,0xf97316]];
export const HUMANS = [['P1',0x00a35c,0xffffff],['P2',0xf5c400,0x111111]];
export const DIFF = {easy:0.84, med:0.91, hard:0.975};

/** Menu settings, persisted in localStorage. */
export const S = Object.assign({mode:'race',track:'lagos',laps:3,bots:5,diff:'med',gfx:'high',steer:'stick',view:'chase'}, store.get('f5_settings',{}));
if(!TRACKS[S.track]) S.track='lagos';
