import { TextureLoader, RepeatWrapping, SRGBColorSpace } from './vendor/three.module.js';

let relief;
let albedo;
export async function loadSurfaceAtlas() {
  [relief, albedo] = await Promise.all([
    relief ?? new TextureLoader().loadAsync(new URL('../assets/generated/material-relief-v12.png', import.meta.url).href),
    albedo ?? new TextureLoader().loadAsync(new URL('../assets/generated/expedition-materials-v16.png', import.meta.url).href)
  ]);
  relief.wrapS = relief.wrapT = RepeatWrapping; relief.anisotropy = 2;
  albedo.colorSpace = SRGBColorSpace; albedo.anisotropy = 4;
  return relief;
}

// Surface relief follows the mesh, including animated limbs. UV.x stores the
// authored material family; painted vertex colors retain the baked occlusion.
export function sculptedSurface(material, industrial = false) {
  material.side = 0; // Authored closed meshes use front faces, preserving correct lighting.
  material.onBeforeCompile = shader => {
    shader.uniforms.sculptRelief = { value: relief };
    shader.uniforms.sculptAlbedo = { value: albedo };
    const varyings = 'varying vec3 vSculptPosition; varying vec3 vSculptNormal; varying float vSculptSurface;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${varyings}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSculptPosition = position; vSculptNormal = normal; vSculptSurface = uv.x;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${varyings}\nuniform sampler2D sculptRelief;\nuniform sampler2D sculptAlbedo;`)
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
        if (family == 1.0 || family == 2.0 || family == 3.0 || family == 8.0 || family == 9.0) {
          vec2 aq = family == 1.0 ? vec2(0.,0.) : family == 2.0 ? vec2(0.,.5) : family == 8.0 ? vec2(.5,.5) : vec2(.5,0.);
          float scale = family == 1.0 ? .006 : family == 2.0 ? .023 : family == 8.0 ? .031 : .013;
          vec3 tex = texture2D(sculptAlbedo, aq + (.025 + .95 * fract(sp.zy*scale))*.5).rgb * weights.x
            + texture2D(sculptAlbedo, aq + (.025 + .95 * fract(sp.xz*scale))*.5).rgb * weights.y
            + texture2D(sculptAlbedo, aq + (.025 + .95 * fract(sp.xy*scale))*.5).rgb * weights.z;
          vec3 average = family == 1.0 ? vec3(.52,.31,.14) : family == 2.0 ? vec3(.69,.64,.53) : family == 8.0 ? vec3(.26,.095,.038) : vec3(.27,.28,.29);
          diffuseColor.rgb *= mix(vec3(1.), clamp(tex / average, vec3(.55), vec3(1.65)), .66);
          grain = (dot(tex,vec3(.2126,.7152,.0722))-.3)*.12;
        }
        if (family == 1.0) {
          float rings = sin(sp.y * .48 + sin(sp.x * .07 + sp.z * .09) * 2.5);
          grain += (reliefValue - .5) * .13 + rings * .018;
          roughnessFactor = .78 + reliefValue * .15;
        }
        if (family == 2.0) {
          float weave = sin(sp.x * 2.8) * sin(sp.y * 2.8);
          grain += (reliefValue - .5) * .12 + weave * .016;
          roughnessFactor = .91;
        }
        if (family == 3.0) {
          grain += (reliefValue - .5) * .06;
          roughnessFactor = .24 + reliefValue * .23;
        }
        if (family == 4.0) {
          grain = (reliefValue - .5) * .055;
          roughnessFactor = .86;
          diffuseColor.rgb *= mix(vec3(.80,.91,1.04), vec3(1.02,1.025,1.02), smoothstep(-.1,.85,vSculptNormal.y));
        }
        if (family == 5.0) { grain = (reliefValue - .5) * .17; roughnessFactor = .96; }
        if (family == 6.0) roughnessFactor = .5;
        if (family == 8.0) { roughnessFactor = .59 + reliefValue*.13; grain += (reliefValue-.5)*.08; }
        if (family == 9.0) { roughnessFactor = .49 + reliefValue*.12; grain *= .24; }
        diffuseColor.rgb *= 1.0 + grain;
      `)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = family == 3.0 ? .65 : family == 9.0 ? .16 : 0.;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (family == 7.0) totalEmissiveRadiance += diffuseColor.rgb * 2.4;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 sd0 = dFdx(vViewPosition), sd1 = dFdy(vViewPosition);
        vec3 ss = cross(sd1, normal), st = cross(normal, sd0);
        float det = dot(sd0, ss);
        normal = normalize((abs(det) + .000001) * normal + sign(det) * (dFdx(grain) * ss + dFdy(grain) * st) * .55);
      `);
  };
  material.customProgramCacheKey = () => 'sculpted-surface-v16';
  return material;
}
