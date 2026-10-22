import * as THREE from './vendor/three.module.js';

// Project the actual rigid mesh silhouette once; mobile keeps grounded shadows without a shadow-map pass.
export function bakeModelShadow(model) {
  model.updateWorldMatrix(true, true);
  const triangles = [], bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  const vertex = new THREE.Vector3();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const triangle = [];
      for (let j = 0; j < 3; j++) {
        vertex.fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld);
        const height = Math.max(0, vertex.y - 31), x = vertex.x + height * .42, z = vertex.z - height * .45;
        bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x); bounds.top = Math.min(bounds.top, z); bounds.bottom = Math.max(bounds.bottom, z);
        triangle.push([x, z]);
      }
      triangles.push(triangle);
    }
  });
  const width = bounds.right - bounds.left + 36, depth = bounds.bottom - bounds.top + 36;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#233f50';
  for (const t of triangles) {
    ctx.beginPath();
    const points = t.map(([x, z]) => [(x - bounds.left + 18) / width * 256, (z - bounds.top + 18) / depth * 256]);
    ctx.moveTo(...points[0]); ctx.lineTo(...points[1]); ctx.lineTo(...points[2]); ctx.closePath(); ctx.fill();
  }
  const soft = document.createElement('canvas'); soft.width = soft.height = 256;
  const blur = soft.getContext('2d'); blur.filter = 'blur(2px)'; blur.drawImage(canvas, 0, 0);
  const texture = new THREE.CanvasTexture(soft);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .27, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  shadow.rotation.x = -Math.PI / 2; shadow.position.set((bounds.left + bounds.right) / 2, 31.5, (bounds.top + bounds.bottom) / 2);
  shadow.renderOrder = 1; return shadow;
}
