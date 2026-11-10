/* Formula 5 — Naija Grand Prix. Entry point: boots the world and runs the frame loop.

   File map:
     config.js    tuning constants, tracks, drivers, saved settings
     state.js     shared mutable game state (G)
     utils.js     helpers
     renderer.js  WebGL renderer
     textures.js  procedural textures
     tracks.js    track geometry + city scenery
     cars.js      car models and grid
     physics.js   driving model, walls, laps, collisions, standings
     bots.js      AI drivers
     input.js     keyboard, touch, tilt, gamepad
     camera.js    cameras and rendering
     cockpit.js   onboard view: halo, steering wheel, hands
     hud.js       HUD, timing tower, minimap
     audio.js     engine sound
     menu.js      menu / pause / results screens
     race.js      race setup and per-frame simulation
*/
import { $, isTouch } from './utils.js';
import { S } from './config.js';
import { G } from './state.js';
import { buildWorld } from './tracks.js';
import { placeMesh } from './cars.js';
import { updateCockpit } from './cockpit.js';
import { pollPadButtons } from './input.js';
import { updateCam, render, renderMenu } from './camera.js';
import { updateHUD, flash } from './hud.js';
import { updateAudio } from './audio.js';
import { syncMenu, showResults, togglePause } from './menu.js';
import { startGame, simulate } from './race.js';

let last=performance.now();
function frame(t){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(t-last)/1000); last=t;
  pollPadButtons();
  const game=G.game;
  if(game && (G.state==='countdown'||G.state==='race'||G.state==='results')){
    if(G.state==='countdown'){ G.cd+=dt; const cd=G.cd, n=Math.min(5,Math.floor(cd/0.7)); document.querySelectorAll('#lights i').forEach((l,i)=>l.classList.toggle('on',i<n&&cd<3.9));
      if(cd>=3.9){ G.state='race'; $('#lights').style.display='none'; game.humans.forEach(c=>flash(c,'GO!',1)); } }
    if(G.state==='race'){ G.raceTime+=dt; const sub=2; for(let s=0;s<sub;s++) simulate(dt/sub);
      if(S.mode!=='tt' && game.humans.every(c=>c.finished)){ G.endTimer+=dt; if(G.endTimer>2.5) showResults(); } }
    else simulate(dt);
    game.cars.forEach(c=>placeMesh(c,dt));
    G.views.forEach(v=>{ updateCam(v,dt); if(v.mode===3) updateCockpit(v.car); });
    const f=G.views[0].car; G.sun.position.set(f.x+120,220,f.z+80); G.sun.target.position.set(f.x,0,f.z);
    if(G.boostTex) G.boostTex.offset.y+=dt*1.6;
    updateHUD(dt);
    render();
  } else if(game && G.state.startsWith('paused')){ render(); }
  else renderMenu(dt);
  updateAudio();
}

if(isTouch) document.body.classList.add('touch');
// Turning a phone back to portrait mid-race pauses the game.
const portrait=matchMedia('(orientation:portrait)');
const onTurn=()=>{ if(isTouch && portrait.matches && (G.state==='race'||G.state==='countdown')) togglePause(); };
portrait.addEventListener ? portrait.addEventListener('change',onTurn) : portrait.addListener(onTurn);
// Pause when the tab/app goes to the background.
document.addEventListener('visibilitychange',()=>{ if(document.hidden && (G.state==='race'||G.state==='countdown')) togglePause(); });

buildWorld(S.track); G.world.gfx=S.gfx; syncMenu();
['#lights','#topbtns','#tower'].forEach(s=>$(s).style.display='none'); $('#map').style.display='none';
requestAnimationFrame(frame);

// debug hook (used by automated tests)
window.__f5={get state(){return G.state;}, get game(){return G.game;}, S, startGame, step(n,auto){ if(G.state==='countdown'){G.state='race';$('#lights').style.display='none';} for(let i=0;i<n;i++){ G.raceTime+=1/60; if(auto) G.game.humans.forEach(c=>c.auto=true); simulate(1/60);} }};
