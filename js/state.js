/* Mutable game state shared between modules. Everything that more than one
   file reads AND writes lives here, so modules don't fight over `let` exports. */
export const G = {
  scene:null,      // THREE.Scene for the current track
  track:null,      // sampled track data from makeTrack()
  sun:null,        // directional light (follows the player for shadows)
  world:{},        // {key, def, gfx} of the built world
  game:null,       // {cars, humans, laps} while a race is loaded
  state:'menu',    // 'menu' | 'countdown' | 'race' | 'paused:<prev>' | 'results'
  raceTime:0, cd:0, finishCount:0, endTimer:0,
  fastest:null,    // {t, name} fastest lap of the race
  views:[],        // one {cam, car, mode, p, shake} per human player
};
