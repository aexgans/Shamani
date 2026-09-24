/* Звуки природы, синтезированные в браузере (Web Audio) — без аудиофайлов.
   Под каждой сценой тихо гудит «поющая чаша» на 136,1 Гц — частоте Ом. */
const Ambience = (() => {
  let ac = null, master = null, bus = null;
  let sources = [], timers = [], gen = 0, volume = 0.7;

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }

  const buffers = {};
  function noiseBuffer(kind) {
    if (buffers[kind]) return buffers[kind];
    const len = ac.sampleRate * 6, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;   b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;   b5 = -0.7616 * b5 - white * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11; b6 = white * 0.115926;
      } else d[i] = white;
    }
    return (buffers[kind] = buf);
  }

  const gain = (v) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const filter = (type, freq, q = 0.7) => {
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
  };
  function lfo(freq, depth, param) {
    const o = ac.createOscillator(), g = gain(depth);
    o.frequency.value = freq;
    o.connect(g).connect(param);
    o.start();
    sources.push(o);
  }
  function bed(kind, filt, level) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(kind);
    src.loop = true;
    const g = gain(level);
    src.connect(filt).connect(g).connect(bus);
    src.start(0, Math.random() * 5);
    sources.push(src);
    return { g, filt };
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function panned(node) {
    if (!ac.createStereoPanner) { node.connect(bus); return; }
    const p = ac.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    node.connect(p).connect(bus);
  }

  function birds() {
    const sing = () => {
      const t = ac.currentTime, notes = 2 + Math.floor(Math.random() * 4), base = 2200 + Math.random() * 1800;
      const out = gain(1);
      panned(out);
      for (let i = 0; i < notes; i++) {
        const o = ac.createOscillator(), g = ac.createGain(), at = t + i * (0.1 + Math.random() * 0.06);
        o.frequency.setValueAtTime(base * (1 + Math.random() * 0.15), at);
        o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.35), at + 0.08);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.045, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
        o.connect(g).connect(out);
        o.start(at);
        o.stop(at + 0.12);
      }
      later(sing, 1600 + Math.random() * 5200);
    };
    later(sing, 900);
  }

  function crackle() {
    const tick = () => {
      if (Math.random() < 0.4) {
        const t = ac.currentTime, src = ac.createBufferSource(), g = ac.createGain();
        src.buffer = noiseBuffer('white');
        src.playbackRate.value = 0.6 + Math.random();
        const dur = 0.01 + Math.random() * 0.05;
        g.gain.setValueAtTime(0.04 + Math.random() * 0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const hp = filter('highpass', 1200 + Math.random() * 3000);
        src.connect(hp).connect(g);
        panned(g);
        src.start(t, Math.random() * 5, dur + 0.02);
      }
      later(tick, 40 + Math.random() * 110);
    };
    tick();
  }

  function bowl(level) {
    const out = gain(level);
    out.connect(bus);
    lfo(0.18, level * 0.35, out.gain);
    [[136.1, 0.05], [136.1 * 2.71, 0.014], [136.1 * 5.4, 0.005]].forEach(([fq, v]) => {
      const o = ac.createOscillator(), g = gain(v);
      o.frequency.value = fq;
      o.connect(g).connect(out);
      o.start();
      sources.push(o);
    });
  }

  const SCENES = {
    water() {
      const w = bed('brown', filter('lowpass', 600), 0.5); lfo(0.09, 0.35, w.g.gain);
      const s = bed('white', filter('highpass', 2500), 0.022); lfo(0.09, 0.018, s.g.gain);
    },
    wind() {
      const w = bed('pink', filter('bandpass', 500, 0.9), 0.6);
      lfo(0.06, 300, w.filt.frequency); lfo(0.11, 0.3, w.g.gain);
    },
    forest() {
      const l = bed('pink', filter('lowpass', 1400), 0.12); lfo(0.07, 0.06, l.g.gain);
      birds();
    },
    fire() {
      bed('brown', filter('lowpass', 260), 0.45);
      crackle();
    },
    bowl() {},
    silence() {},
  };

  function teardown() {
    timers.forEach(clearTimeout);
    timers = [];
    sources.forEach((n) => { try { n.stop(); } catch (e) { /* уже остановлен */ } });
    sources = [];
    if (bus) bus.disconnect();
    bus = null;
  }

  return {
    SCENES: Object.keys(SCENES),
    start(scene) {
      if (!ensure()) return;
      gen++;
      teardown();
      bus = gain(1);
      bus.connect(master);
      (SCENES[scene] || SCENES.silence)();
      if (scene !== 'silence') bowl(scene === 'bowl' ? 1 : 0.5);
      const now = ac.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(volume, now, 0.8);
    },
    stop() {
      if (!ac) return;
      const my = ++gen;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(0, ac.currentTime, 0.4);
      setTimeout(() => { if (my === gen) teardown(); }, 2000);
    },
    setVolume(v) {
      volume = v;
      if (ac && bus) master.gain.setTargetAtTime(v, ac.currentTime, 0.2);
    },
  };
})();
