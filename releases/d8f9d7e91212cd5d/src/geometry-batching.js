import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

function attributeLayout(attribute) {
  return [attribute.array.constructor.name, attribute.itemSize, attribute.normalized,
    attribute.gpuType, !!attribute.isFloat16BufferAttribute];
}

function layout(geometry) {
  const attributes = Object.keys(geometry.attributes).sort().map(name => [name, attributeLayout(geometry.attributes[name])]);
  const morphs = Object.keys(geometry.morphAttributes).sort().map(name => [name, geometry.morphAttributes[name].map(attributeLayout)]);
  return JSON.stringify([!!geometry.index, attributes, geometry.morphTargetsRelative, morphs]);
}

// Identical materials do not imply identical vertex layouts (e.g. UV1 on legacy props).
// Keep incompatible layouts in separate draw calls instead of stripping authored data.
export function mergeCompatibleGeometries(geometries) {
  const buckets = new Map(), merged = [];
  for (const geometry of geometries) {
    const key = layout(geometry);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(geometry);
  }
  try {
    for (const bucket of buckets.values()) {
      const geometry = mergeGeometries(bucket);
      if (!geometry) throw new Error('Could not merge compatible model parts');
      geometry.morphTargetsRelative = bucket[0].morphTargetsRelative;
      merged.push(geometry);
    }
    return merged;
  } catch (error) {
    merged.forEach(geometry => geometry.dispose());
    throw error;
  }
}
