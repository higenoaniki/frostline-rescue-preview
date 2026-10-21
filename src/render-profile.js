export function renderProfile({ mobile = false, lowMemory = false, reduced = false } = {}) {
  const constrained = mobile || lowMemory || reduced;
  return {
    antialias: !constrained,
    maxPixelRatio: lowMemory || reduced ? 1 : mobile ? 1.5 : 2,
    shadows: !constrained,
    anisotropy: reduced ? 1 : constrained ? 2 : 8
  };
}
