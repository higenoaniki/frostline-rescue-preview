import {PMREMGenerator,EquirectangularReflectionMapping} from './vendor/three.module.js';
import {HDRLoader} from './vendor/HDRLoader.js';

export async function applyPhysicalLighting(renderer,scene){
  if(!renderer.extensions.has('EXT_color_buffer_float'))return false;
  const hdr=await new HDRLoader().loadAsync(new URL('../assets/pbr/environment-hdr.hdr',import.meta.url).href);
  hdr.mapping=EquirectangularReflectionMapping;
  const pmrem=new PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
  const target=pmrem.fromEquirectangular(hdr);
  scene.environment=target.texture;scene.environmentIntensity=.65;
  scene.userData.environmentSource='Poly Haven snow_field_2 CC0';
  hdr.dispose();pmrem.dispose();return target;
}
