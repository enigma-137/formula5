# Formula 5 — Naija Grand Prix

A browser F1 racing game built with three.js. Race the streets of **Lagos**, **Abuja** and **Benin** against bots, in time trial, 2-player split screen, or **online 1v1** with a friend.

**Play:** https://enigma-137.github.io/formula5/ (once GitHub Pages is switched on)

## Controls
| | |
|---|---|
| **Gamepad** | RT gas · LT brake · left stick steer · Y reset · LB/RB camera · Start pause |
| **Keyboard** | P1 W A S D · P2 arrow keys · C/V camera · R reset · Esc pause · M mute |
| **Phone** | Landscape only. GAS / BRK on the right; steer with ◀ ▶ or choose **Tilt phone** in the menu and turn the phone like a steering wheel |

## Online 1v1
Pick **Online 1v1**, tap **Create room** and send the 5-letter code (or the **Share link**) to a friend; they tap **Join**. The host picks track and laps and presses START. Phones connect directly using [PeerJS](https://peerjs.com/) (its free public server only introduces the two players) — there is no database.

## Points & stats
F1 points (25, 18, 15, 12, 10, 8, 6, 4, 2, 1, +1 fastest lap) for races vs bots and online races, plus wins, podiums and your best lap on every track. Tap **📊 My stats** in the menu. Stored in the browser on each device.

## Running it on your computer
The game is split into JavaScript modules, which browsers won't load from a double-clicked file. Start a tiny local server in this folder instead, then open http://localhost:8000:

```bash
python -m http.server 8000
```
(or `npx serve`, or the "Live Server" extension in VS Code). The first load needs internet for three.js.

## Code layout
```
index.html        page markup (menus, HUD containers)
css/style.css     all styling, incl. phone/landscape layout
js/main.js        entry point + frame loop
js/config.js      tuning numbers, track shapes, drivers, saved settings
js/state.js       shared game state
js/tracks.js      track geometry and city scenery
js/textures.js    procedural textures
js/cars.js        car models and starting grid
js/physics.js     driving model, walls, laps, collisions
js/bots.js        AI drivers
js/input.js       keyboard, touch, tilt, gamepad
js/camera.js      cameras and split-screen rendering
js/cockpit.js     onboard cockpit view (halo, wheel display, hands)
js/hud.js         HUD, timing tower, minimap
js/audio.js       engine sound
js/menu.js        menu, pause and results screens
js/race.js        race setup and per-frame simulation
js/net.js         peer-to-peer connection (PeerJS)
js/online.js      online rooms, rematches, the rival's car
js/profile.js     points, stats, personal bests
js/ads.js         TraceIQ sponsor wall panels and billboards
```
