// 앰비언트 사운드 엔진 — 음원 파일 없이 Web Audio로 직접 합성
window.SoundEngine = (() => {
  let ctx = null, master = null, current = null, vol = 0.7, muted = false;
  const cache = {};

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : vol;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function buf(type) {
    if (cache[type]) return cache[type];
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w;
      else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
    return (cache[type] = b);
  }

  function noise(type) { const s = ctx.createBufferSource(); s.buffer = buf(type); s.loop = true; s.start(); return s; }
  function lfo(freq, depth, param) {
    const o = ctx.createOscillator(); o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(param); o.start(); return o;
  }
  function env(dest, t, a, d, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest); return g;
  }
  function chirp(dest, f0, f1, dur, v, type = 'sine', delay = 0) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(env(dest, t, Math.min(0.02, dur / 4), dur, v)); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(dest, t) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    o.connect(env(dest, t, 0.003, 0.28, 0.9)); o.start(t); o.stop(t + 0.35);
  }
  function burst(dest, t, dur, v, ftype, freq) {
    const s = ctx.createBufferSource(); s.buffer = buf('white');
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    s.connect(f); f.connect(env(dest, t, 0.002, dur, v)); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  const hat = (dest, t, v = 0.12) => burst(dest, t, 0.05, v, 'highpass', 7000);
  const snare = (dest, t) => burst(dest, t, 0.16, 0.22, 'bandpass', 1800);
  function bass(dest, t, freq, dur) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(160, t + dur);
    o.connect(f); f.connect(env(dest, t, 0.005, dur, 0.3)); o.start(t); o.stop(t + dur + 0.05);
  }

  const H = { noise, lfo, chirp, kick, hat, snare, bass, burst, get ctx() { return ctx; }, get master() { return master; } };

  function scene() {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    const nodes = [], timers = [];
    return {
      out,
      add(n) { nodes.push(n); return n; },
      every(ms, fn) { timers.push(setInterval(fn, ms)); },
      stop() {
        timers.forEach(clearInterval);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => {
          nodes.forEach(n => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
          try { out.disconnect(); } catch (e) {}
        }, 1500);
      }
    };
  }

  function stop() { if (current) { current.stop(); current = null; } }

  return {
    ensure,
    play(build) {
      if (!ensure()) return;
      stop(); current = scene();
      try { build(current, H); } catch (e) { console.error(e); }
    },
    stop,
    sfx(fn) { if (!ctx || muted) return; try { fn(H); } catch (e) {} },
    setVolume(v) { vol = v; if (master && !muted) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    toggleMute() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.05); return muted; },
    get muted() { return muted; }
  };
})();
