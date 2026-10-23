export function renderProfile({ mobile = false, lowMemory = false, reduced = false } = {}) {
  return {
    antialias: !reduced,
    maxPixelRatio: lowMemory || reduced ? 1 : 2,
    shadows: !lowMemory && !reduced,
    anisotropy: reduced ? 2 : 8,
    shadowResolution: mobile || lowMemory ? 1024 : 2048
  };
}
