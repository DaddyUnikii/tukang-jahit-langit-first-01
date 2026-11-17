(function (root) {
  'use strict';
  function create(host = root) {
    let ctx = null;
    let muted = false;
    const enabled = () => !!ctx && !muted && ctx.state === 'running';
    function unlock() {
      try {
        const Constructor = host.AudioContext || host.webkitAudioContext;
        if (!Constructor) return;
        if (!ctx) ctx = new Constructor();
        if (ctx.state === 'suspended') {
          const result = ctx.resume();
          if (result && typeof result.catch === 'function') result.catch(() => {});
        }
      } catch { ctx = null; }
    }
    function note(frequency, delay, length, loudness, type = 'sine') {
      if (!enabled()) return;
      const oscillator = ctx.createOscillator();
      const volume = ctx.createGain();
      const at = ctx.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.connect(volume);
      volume.connect(ctx.destination);
      volume.gain.setValueAtTime(0.0001, at);
      volume.gain.exponentialRampToValueAtTime(loudness, at + 0.012);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.start(at);
      oscillator.stop(at + length + 0.03);
    }
    function play(kind) {
      if (!enabled()) return;
      try {
        const sounds = {
          stitch: [[880,0,.14,.06],[1320,.055,.2,.035]],
          cut: [[440,0,.07,.025,'triangle'],[220,.03,.12,.02,'triangle']],
          move: [[523.25,0,.15,.03],[659.25,.07,.2,.02]],
          rescue: [[659.25,0,.2,.035],[783.99,.09,.25,.03],[1046.5,.18,.3,.025]],
          win: [[523.25,0,.5,.035],[659.25,.15,.6,.035],[783.99,.3,.7,.03],[1046.5,.5,1,.025]],
          lose: [[440,0,.2,.03,'triangle'],[329.63,.12,.3,.025,'triangle'],[220,.25,.4,.02,'triangle']],
          click: [[784,0,.065,.025]],
          undo: [[659.25,0,.14,.025],[523.25,.07,.2,.02]],
        };
        for (const values of sounds[kind] || sounds.click) note(...values);
      } catch { /* Audio must never interrupt the puzzle. */ }
    }
    return {enabled, play, unlock, setMuted(value) { muted = value === true; }, pause() {}};
  }
  const api = {create};
  root.SkyAudio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
