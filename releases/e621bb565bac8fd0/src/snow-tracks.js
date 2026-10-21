import * as THREE from './vendor/three.module.js';
import { SAFE, toX, toZ } from './world-config.js';
import { surfaceHeight } from './field-art.js';

// A fixed ring of GPU instances, one draw call, no per-step allocations.
export class SnowTracks {
  constructor(root) {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 64;
    const c = canvas.getContext('2d');
    c.fillStyle = '#55758b'; c.beginPath(); c.roundRect(5,4,22,53,10); c.fill();
    c.strokeStyle = '#a8c4d3'; c.lineWidth = 3;
    for (let y=13;y<50;y+=9) { c.beginPath(); c.moveTo(9,y);c.lineTo(23,y);c.stroke(); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({map,transparent:true,opacity:.24,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    this.time = {value:0};
    material.onBeforeCompile = shader => {
      shader.uniforms.trackTime = this.time;
      shader.vertexShader = 'attribute float trackBirth; varying float trackAge; uniform float trackTime;\n'+shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntrackAge = trackTime - trackBirth;');
      shader.fragmentShader = 'varying float trackAge;\n'+shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a *= 1. - smoothstep(22., 45., trackAge);');
    };
    material.customProgramCacheKey=()=> 'snow-sole-v1';
    const geometry = new THREE.PlaneGeometry(9,20); geometry.rotateX(-Math.PI/2);
    this.births = new THREE.InstancedBufferAttribute(new Float32Array(96),1);
    geometry.setAttribute('trackBirth', this.births);
    this.mesh = new THREE.InstancedMesh(geometry, material,96);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled=false; this.mesh.count=0;
    root.add(this.mesh); this.transform=new THREE.Object3D(); this.cursor=0;
  }
  update(state) {
    this.time.value=state.elapsed;
    const p=state.player;
    if(this.run!==state.runId) { this.run=state.runId;this.mesh.count=0;this.cursor=0;this.last=null; }
    if(state.home || !p.moving) return;
    if(this.last && Math.hypot(p.x-this.last.x,p.y-this.last.y)<24) return;
    if(this.last && Math.hypot(p.x-this.last.x,p.y-this.last.y)>180) {this.last={x:p.x,y:p.y};return;}
    this.last={x:p.x,y:p.y};
    // Stone paving receives no snow imprints.
    if(p.y>=SAFE.y && (Math.abs(toX(p.x))<90 || [3830,4130,4430,4840,5230].some(y=>Math.abs(p.y-y)<40))) return;
    const side=this.cursor%2 ? 7 : -7,angle=p.facing||0;
    const x=p.x+Math.cos(angle)*side,y=p.y-Math.sin(angle)*side;
    this.transform.position.set(toX(x),surfaceHeight(x,y)+.8,toZ(y));
    this.transform.rotation.set(0,angle,0);this.transform.updateMatrix();
    const index=this.cursor%96;this.mesh.setMatrixAt(index,this.transform.matrix);this.births.setX(index,state.elapsed);
    this.cursor++;this.mesh.count=Math.min(96,this.cursor);this.mesh.instanceMatrix.needsUpdate=true;this.births.needsUpdate=true;
  }
}
