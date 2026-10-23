import * as THREE from './vendor/three.module.js';

// One scene pass + one fullscreen pass. All lighting stays linear HDR until
// the final ACES/display conversion; HUD remains crisp HTML above the canvas.
export class CinematicPipeline {
  constructor(renderer, antialias = false) {
    this.renderer = renderer;
    this.enabled = renderer.extensions.has('EXT_color_buffer_float');
    if (!this.enabled) return;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      samples: antialias ? Math.min(4, renderer.capabilities.maxSamples) : 0,
      type: THREE.HalfFloatType, minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter, depthBuffer: true
    });
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        sceneColor: { value: this.target.texture }, sceneDepth: { value: this.target.depthTexture },
        texel: { value: new THREE.Vector2(1, 1) }, cameraRange: { value: new THREE.Vector2(1, 6000) },
        finishStrength: { value: 1 }
      },
      depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        uniform sampler2D sceneColor, sceneDepth;
        uniform vec2 texel, cameraRange;
        uniform float finishStrength;
        varying vec2 vUv;
        float sceneLuma(vec3 c) { return dot(c, vec3(.2126,.7152,.0722)); }
        float depthAt(vec2 uv) { return mix(cameraRange.x, cameraRange.y, texture2D(sceneDepth, uv).r); }
        void main() {
          vec3 center = texture2D(sceneColor, vUv).rgb;
          vec3 color = center;
          float depth = depthAt(vUv), occlusion = 0.;
          vec3 glow = vec3(0.);
          for (int i=0; i<8; i++) {
            float angle = float(i)*2.39996323;
            vec2 direction = vec2(cos(angle), sin(angle));
            vec2 offset = direction * texel * (3. + float(i)*1.3);
            float delta = depth - depthAt(vUv + offset);
            occlusion += smoothstep(1.2, 9., delta) * (1.-smoothstep(24., 105., delta));
            vec3 light = texture2D(sceneColor, vUv + direction*texel*7.).rgb;
            glow += light * smoothstep(1.1, 2.8, sceneLuma(light));
          }
          color *= 1. - occlusion * .052 * finishStrength;
          color += glow * .018 * finishStrength;
          gl_FragColor = vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.scene = new THREE.Scene();
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
    this.camera = new THREE.Camera();
  }
  resize(width, height) {
    if (!this.enabled) return;
    this.target.setSize(width, height);
    this.material.uniforms.texel.value.set(1/width, 1/height);
    this.renderer.setRenderTarget(this.target);
    const gl = this.renderer.getContext();
    this.enabled = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    this.renderer.setRenderTarget(null);
  }
  render(scene, camera, detailed = true) {
    if (!this.enabled || !detailed) { this.renderer.setRenderTarget(null); this.renderer.render(scene, camera); return; }
    this.material.uniforms.cameraRange.value.set(camera.near, camera.far);
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.target?.dispose(); this.target?.depthTexture?.dispose();
    this.geometry?.dispose(); this.material?.dispose();
  }
}
