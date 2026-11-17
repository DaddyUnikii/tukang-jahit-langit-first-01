(function (root) {
  'use strict';
  const KEY = 'tukang-jahit-langit-v1';
  function defaults() { return {unlocked: 1, stars: [], language: 'en', muted: false}; }
  function normalize(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      unlocked: Number.isInteger(source.unlocked) ? Math.max(1, Math.min(8, source.unlocked)) : 1,
      stars: Array.isArray(source.stars) ? source.stars.slice(0,8).map(n => Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0) : [],
      language: source.language === 'id' ? 'id' : 'en',
      muted: source.muted === true,
    };
  }
  function load(storage) {
    try { return normalize(JSON.parse(storage?.getItem(KEY) ?? 'null')); }
    catch { return defaults(); }
  }
  function save(storage, value) {
    try { storage.setItem(KEY, JSON.stringify(normalize(value))); return true; }
    catch { return false; }
  }
  function complete(progress, index, stars) {
    const next = normalize(progress);
    if (!Number.isInteger(index) || index < 0 || index >= next.unlocked || index >= 8 || !Number.isInteger(stars) || stars < 1 || stars > 3) return next;
    while (next.stars.length <= index) next.stars.push(0);
    next.stars[index] = Math.max(next.stars[index], stars);
    next.unlocked = Math.max(next.unlocked, Math.min(8, index + 2));
    return next;
  }
  const api = {KEY, load, save, complete};
  root.SkyProgress = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
