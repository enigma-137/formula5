/* WebGL renderer setup. */
import * as THREE from 'three';
import { $ } from './utils.js';
import { S } from './config.js';

const canvas = $('#gl');
export let renderer;
export function makeRenderer(){
  if(renderer){ renderer.dispose(); }
  renderer = new THREE.WebGLRenderer({canvas, antialias:S.gfx==='high', powerPreference:'high-performance'});
  renderer.setPixelRatio(S.gfx==='high'?Math.min(devicePixelRatio,1.75):Math.min(devicePixelRatio,1)*0.8);
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.shadowMap.enabled = S.gfx==='high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
makeRenderer();
addEventListener('resize',()=>renderer.setSize(innerWidth,innerHeight,false));
