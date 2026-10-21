import { TextureLoader, RepeatWrapping } from './vendor/three.module.js';

let relief;
export async function loadSurfaceAtlas() {
  relief ??= await new TextureLoader().loadAsync(new URL('../assets/generated/material-relief-v12.png', import.meta.url).href);
  relief.wrapS = relief.wrapT = RepeatWrapping; relief.anisotropy = 2;
  return relief;
}

// Surface relief follows the mesh, including animated limbs. UV.x stores the
// authored material family; painted vertex colors retain the baked occlusion.
export function sculptedSurface(material, industrial = false) {
  material.side = 0; // Authored closed meshes use front faces, preserving correct lighting.
  material.onBeforeCompile = shader => {
    shader.uniforms.sculptRelief = { value: relief };
    const varyings = 'varying vec3 vSculptPosition; varying vec3 vSculptNormal; varying float vSculptSurface;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${varyings}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSculptPosition = position; vSculptNormal = normal; vSculptSurface = uv.x;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${varyings}\nuniform sampler2D sculptRelief;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        vec3 sp = vSculptPosition;
        float family = floor(vSculptSurface + .5);
        vec3 an = abs(normalize(vSculptNormal));
        vec3 weights = pow(an, vec3(4.0));
        weights /= max(dot(weights, vec3(1.0)), .0001);
        vec2 quadrant = family == 1.0 ? vec2(.5,.5) : family == 2.0 ? vec2(0.0,.5) : family == 3.0 ? vec2(0.0,0.0) : vec2(.5,0.0);
        vec3 reliefSamples = vec3(
          texture2D(sculptRelief, quadrant + (.02 + .96 * fract(sp.zy * .016)) * .5).r,
          texture2D(sculptRelief, quadrant + (.02 + .96 * fract(sp.xz * .016)) * .5).r,
          texture2D(sculptRelief, quadrant + (.02 + .96 * fract(sp.xy * .016)) * .5).r);
        float reliefValue = dot(reliefSamples, weights);
        float grain = 0.0;
        if (family == 1.0) {
          float rings = sin(sp.y * .48 + sin(sp.x * .07 + sp.z * .09) * 2.5);
          grain = (reliefValue - .5) * .22 + rings * .035;
          roughnessFactor = .78 + reliefValue * .15;
        }
        if (family == 2.0) {
          float weave = sin(sp.x * 2.8) * sin(sp.y * 2.8);
          grain = (reliefValue - .5) * .14 + weave * .025;
          roughnessFactor = .91;
        }
        if (family == 3.0) {
          grain = (reliefValue - .5) * .12;
          roughnessFactor = .24 + reliefValue * .23;
        }
        if (family == 4.0) {
          grain = (reliefValue - .5) * .055;
          roughnessFactor = .86;
          diffuseColor.rgb *= mix(vec3(.80,.91,1.04), vec3(1.02,1.025,1.02), smoothstep(-.1,.85,vSculptNormal.y));
        }
        if (family == 5.0) { grain = (reliefValue - .5) * .17; roughnessFactor = .96; }
        if (family == 6.0) roughnessFactor = .62;
        ${industrial ? `
        if (family == 1.0) {
          float paint = clamp(dot(diffuseColor.rgb, vec3(.2126,.7152,.0722)) * 3.8, .28, 1.0);
          float panel = step(.965, fract(sp.x * .035 + .01)) + step(.975, fract(sp.z * .035 + .01));
          diffuseColor.rgb = mix(vec3(.055,.095,.14), vec3(.42,.54,.62), smoothstep(.22,.65,paint)) * paint;
          diffuseColor.rgb *= 1.0 - min(panel,1.0)*.18;
          grain = (reliefValue-.5)*.035; roughnessFactor=.43;
        }
        if (family == 2.0) {
          float paint = clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*4.,.35,1.);
          diffuseColor.rgb = vec3(.12,.30,.36)*paint; roughnessFactor=.4; grain=0.;
        }` : ''}
        diffuseColor.rgb *= 1.0 + grain;
      `)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nif (family == 3.0) metalnessFactor = .56;${industrial ? 'if (family == 1.0 || family == 2.0) metalnessFactor = .38;' : ''}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (family == 7.0) totalEmissiveRadiance += diffuseColor.rgb * .75;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 sd0 = dFdx(vViewPosition), sd1 = dFdy(vViewPosition);
        vec3 ss = cross(sd1, normal), st = cross(normal, sd0);
        float det = dot(sd0, ss);
        normal = normalize((abs(det) + .000001) * normal + sign(det) * (dFdx(grain) * ss + dFdy(grain) * st) * .55);
      `);
  };
  material.customProgramCacheKey = () => `sculpted-surface-v14-${industrial ? 'industrial' : 'organic'}`;
  return material;
}
