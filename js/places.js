// 장소 정의 — 배경(픽셀 아트), 애니메이션, 앰비언트 사운드, 고유 행동, 닉네임
// 모든 좌표는 내부 해상도 320x180 기준
(() => {
  const W = 320, H = 180;

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
  // 계단식 그라데이션 (픽셀 느낌)
  function bands(c, y0, y1, stops, step = 4) {
    for (let y = y0; y < y1; y += step) {
      const t = (y - y0) / (y1 - y0) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(t));
      R(c, 0, y, W, Math.min(step, y1 - y), mix(stops[i], stops[i + 1], t - i));
    }
  }
  function disc(c, cx, cy, r, col, clipY = 999) {
    c.fillStyle = col;
    for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); if (cy + y < clipY) c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); }
  }
  function ridge(c, base, amp, seed, col, freq = 0.03) {
    c.fillStyle = col;
    for (let x = 0; x < W; x++) {
      const h = Math.sin(x * freq + seed) * amp + Math.sin(x * freq * 2.7 + seed * 2) * amp * 0.4 + Math.sin(x * freq * 6.1 + seed) * amp * 0.12;
      c.fillRect(x, Math.round(base - h), 1, H);
    }
  }
  function cloud(c, x, y, s, col) {
    R(c, x, y, 18 * s, 4 * s, col); R(c, x + 3 * s, y - 3 * s, 9 * s, 3 * s, col); R(c, x + 8 * s, y - 5 * s, 6 * s, 3 * s, col);
  }
  const wrap = (v, m) => ((v % m) + m) % m;

  // ---------- 사운드 공용 ----------
  function noiseLayer(s, Hx, type, ftype, freq, gain, lfoF, lfoD, q = 0.7) {
    const c = Hx.ctx, n = s.add(Hx.noise(type)), f = c.createBiquadFilter(), g = c.createGain();
    f.type = ftype; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    n.connect(f); f.connect(g); g.connect(s.out);
    if (lfoF) s.add(Hx.lfo(lfoF, lfoD, g.gain));
    return { f, g };
  }
  function birds(Hx, dest, hi = 3200) {
    const n = 2 + Math.floor(Math.random() * 3), base = hi * (0.85 + Math.random() * 0.3);
    for (let i = 0; i < n; i++) Hx.chirp(dest, base, base * 1.25, 0.07, 0.03, 'sine', i * 0.11);
  }

  const P = [];

  // ===== 바다 =====
  P.push({
    id: 'sea', name: '해질녘 바다', desc: '파도 소리, 젖은 모래, 노을이 지는 수평선', accent: '#f6a85f',
    walk: { x0: 10, x1: 310, y0: 132, y1: 172 },
    names: ['하얀 포말', '젖은 모래', '먼 등대', '작은 소라', '저녁 윤슬', '느린 파도', '바다 유리', '갈매기 한 마리', '조개 껍데기', '수평선 너머'],
    bg(c) {
      bands(c, 0, 82, ['#2b1d4a', '#5a3570', '#c4627a', '#f6a85f', '#ffd28a']);
      disc(c, 222, 82, 17, '#ffe2a8', 82);
      bands(c, 82, 122, ['#d9826e', '#4a4f82', '#2c3766'], 2);
      bands(c, 122, 180, ['#c9a77c', '#e6c79a', '#dcb98a']);
      const r = rng(7);
      for (let i = 0; i < 260; i++) R(c, r() * W, 124 + r() * 56, 1, 1, r() < .5 ? '#c7a679' : '#f0d6ad');
      // 멀리 등대
      R(c, 28, 66, 4, 16, '#efe6d8'); R(c, 28, 70, 4, 2, '#c65a5a'); R(c, 28, 76, 4, 2, '#c65a5a'); R(c, 27, 64, 6, 2, '#3a2a40');
    },
    anim(c, t) {
      const r = rng(3);
      for (let i = 0; i < 40; i++) {
        const y = 84 + Math.floor(r() * 36), sp = 4 + (y - 84) * 0.25;
        R(c, wrap(r() * W + t * sp * (r() < .5 ? 1 : -1), W + 20) - 10, y, 4 + r() * 8, 1, y < 96 ? '#f0a58a' : '#5b6aa8');
      }
      for (let i = 0; i < 26; i++) {
        const y = 84 + Math.floor(r() * 30), x = 222 + (r() - .5) * (16 + (y - 84) * 1.2);
        if (Math.sin(t * 3 + i * 1.7) > .2) R(c, x, y, 2 + r() * 3, 1, '#ffe7b0');
      }
      const sw = Math.sin(t * 0.7) * 4;
      for (let x = 0; x < W; x += 2) {
        const y = Math.round(121 + sw + Math.sin(x * 0.05 + t) * 1.5);
        R(c, x, y, 2, 2, '#f4f1e8'); R(c, x, y + 2, 2, 3 + Math.max(0, sw), 'rgba(80,90,140,.35)');
      }
    },
    sound(s, Hx) {
      noiseLayer(s, Hx, 'brown', 'lowpass', 520, 0.32, 0.11, 0.26);
      noiseLayer(s, Hx, 'pink', 'highpass', 1400, 0.035, 0.11, 0.03);
      s.every(6000, () => { if (Math.random() < .45) { Hx.chirp(s.out, 2100, 1400, 0.22, 0.025, 'triangle'); Hx.chirp(s.out, 2000, 1300, 0.2, 0.02, 'triangle', 0.3); } });
    },
    action: { label: '🪨 돌 던지기', type: 'burst',
      fx(app, a) { app.floatAt(a.x + (a.dir || 1) * 30, 100, '퐁', ''); setTimeout(() => app.floatAt(a.x + (a.dir || 1) * 50, 96, '퐁', 'e1'), 380); setTimeout(() => app.floatAt(a.x + (a.dir || 1) * 64, 93, '퐁', 'e2'), 700); },
      sfx(Hx) { [0, .38, .7].forEach((d, i) => Hx.chirp(Hx.master, 900 - i * 80, 220, 0.12, 0.18 / (i + 1), 'sine', d)); } }
  });

  // ===== 산 =====
  P.push({
    id: 'mountain', name: '산 정상', desc: '능선 너머 바람, 산새 소리, 탁 트인 하늘', accent: '#8fd3ff',
    walk: { x0: 12, x1: 308, y0: 134, y1: 172 },
    names: ['높은 바람', '흰 구름', '작은 솔잎', '바위 이끼', '산새 소리', '맑은 능선', '정상 표지석', '돌탑 하나', '아침 안개'],
    bg(c) {
      bands(c, 0, 120, ['#4f8fd0', '#86bde6', '#cfe8f4']);
      ridge(c, 92, 14, 1.3, '#a9c3d6', 0.025);
      ridge(c, 106, 12, 4.1, '#7d9db4', 0.035);
      ridge(c, 120, 9, 2.2, '#4f7a6a', 0.05);
      const r = rng(11);
      for (let i = 0; i < 70; i++) { const x = r() * W, y = 112 + r() * 14; R(c, x, y, 2, 4, '#3e6656'); R(c, x - 1, y + 2, 4, 2, '#3e6656'); }
      bands(c, 126, 180, ['#9a9083', '#857b6f', '#766c61']);
      for (let i = 0; i < 40; i++) { const x = r() * W, y = 130 + r() * 50, w = 3 + r() * 8; R(c, x, y, w, 2, '#aaa093'); R(c, x, y + 2, w, 1, '#665d53'); }
      for (let i = 0; i < 30; i++) R(c, r() * W, 128 + r() * 50, 2, 1, '#6f8a55');
      // 표지석
      R(c, 52, 112, 12, 22, '#d9d3c4'); R(c, 52, 112, 12, 2, '#efe9db'); R(c, 55, 117, 6, 1, '#6a645a'); R(c, 55, 120, 6, 1, '#6a645a'); R(c, 55, 123, 6, 1, '#6a645a'); R(c, 50, 133, 16, 3, '#6f665b');
      // 돌탑
      [[272, 128, 14], [274, 124, 10], [275, 120, 8], [276, 117, 6], [277, 114, 4]].forEach(([x, y, w]) => { R(c, x, y, w, 4, '#a39a8c'); R(c, x, y + 3, w, 1, '#6b6358'); });
    },
    anim(c, t) {
      const r = rng(5);
      for (let i = 0; i < 6; i++) cloud(c, wrap(r() * W + t * (2 + r() * 3), W + 80) - 60, 14 + r() * 48, r() < .5 ? 1 : 2, 'rgba(255,255,255,.85)');
      for (let i = 0; i < 3; i++) {
        const x = wrap(t * 9 + i * 120, W + 60) - 30, y = 40 + i * 10 + Math.sin(t * 1.5 + i) * 4, f = Math.sin(t * 8 + i) > 0;
        R(c, x, y + (f ? 0 : 1), 2, 1, '#2d3a4a'); R(c, x + 2, y + 1, 1, 1, '#2d3a4a'); R(c, x + 3, y + (f ? 0 : 1), 2, 1, '#2d3a4a');
      }
    },
    sound(s, Hx) {
      const w = noiseLayer(s, Hx, 'pink', 'bandpass', 520, 0.4, 0.05, 0.22, 0.8);
      s.add(Hx.lfo(0.07, 280, w.f.frequency));
      noiseLayer(s, Hx, 'brown', 'lowpass', 160, 0.25, 0.04, 0.12);
      s.every(3200, () => { if (Math.random() < .5) birds(Hx, s.out, 3400); });
    },
    action: { label: '🗣️ 야호!', type: 'burst',
      fx(app, a) { app.floatAt(a.x, a.y - 26, '야호~!', 'big'); setTimeout(() => app.floatAt(a.x + 40, a.y - 40, '야호~', 'e1'), 700); setTimeout(() => app.floatAt(a.x + 80, a.y - 52, '야호~', 'e2'), 1400); setTimeout(() => app.floatAt(a.x + 115, a.y - 62, '야호…', 'e3'), 2100); },
      sfx(Hx) { [[0, .14], [.7, .06], [1.4, .03], [2.1, .015]].forEach(([d, v]) => { Hx.chirp(Hx.master, 560, 470, 0.22, v, 'triangle', d); Hx.chirp(Hx.master, 480, 360, 0.3, v, 'triangle', d + 0.24); }); } }
  });

  // ===== 들판 =====
  P.push({
    id: 'field', name: '여름 들판', desc: '바람에 눕는 풀, 들꽃, 느리게 흐르는 구름', accent: '#a6e07a',
    walk: { x0: 8, x1: 312, y0: 114, y1: 174 },
    names: ['들꽃 한 송이', '오후 햇살', '민들레 씨', '풀잎 끝', '느린 구름', '바랜 밀짚', '나비 한 마리', '토끼풀', '여름 바람'],
    bg(c) {
      bands(c, 0, 92, ['#6cbde8', '#a6d9f0', '#e2f3f6']);
      ridge(c, 92, 5, 0.5, '#9fcf82', 0.02);
      bands(c, 96, 180, ['#86c25e', '#6fb04f', '#5a9a40']);
      // 나무
      R(c, 248, 72, 5, 30, '#6b4a2f'); disc(c, 250, 64, 16, '#3f7f3a'); disc(c, 240, 70, 10, '#4a8f42'); disc(c, 260, 70, 11, '#38733a'); disc(c, 252, 56, 9, '#57a04b');
      R(c, 238, 99, 26, 3, 'rgba(30,70,30,.35)');
      const r = rng(21);
      for (let i = 0; i < 140; i++) { const y = 100 + r() * 78; R(c, r() * W, y, 1, 1, ['#fff7d6', '#ffd84f', '#f6a3c8', '#c9b6ff'][Math.floor(r() * 4)]); }
    },
    anim(c, t) {
      const r = rng(9);
      for (let i = 0; i < 4; i++) cloud(c, wrap(r() * W + t * (1.5 + r() * 2), W + 80) - 60, 12 + r() * 40, 2, 'rgba(255,255,255,.9)');
      const wave = wrap(t * 40, W + 160) - 80;
      for (let i = 0; i < 260; i++) {
        const x = r() * W, y = 100 + r() * 78, near = Math.abs(x - wave) < 40, sway = Math.round(Math.sin(t * 2 + x * 0.06) * (near ? 1.5 : 0.6));
        const col = near ? '#b8e88f' : (y > 140 ? '#4c8a36' : '#5f9f44');
        R(c, x, y - 3, 1, 3, col); R(c, x + sway, y - 4, 1, 1, col);
      }
      for (let i = 0; i < 2; i++) {
        const x = 80 + i * 120 + Math.sin(t * 0.5 + i * 3) * 50, y = 110 + Math.sin(t * 1.3 + i) * 12, f = Math.sin(t * 14 + i) > 0;
        R(c, x, y, 1, 2, '#3a3a3a'); R(c, x - 2, y - (f ? 1 : 0), 2, f ? 2 : 1, i ? '#ffe36b' : '#ffffff'); R(c, x + 1, y - (f ? 1 : 0), 2, f ? 2 : 1, i ? '#ffe36b' : '#ffffff');
      }
    },
    sound(s, Hx) {
      noiseLayer(s, Hx, 'pink', 'lowpass', 900, 0.16, 0.08, 0.11);
      noiseLayer(s, Hx, 'white', 'highpass', 5500, 0.012, 0.3, 0.008);
      s.every(4200, () => { if (Math.random() < .55) birds(Hx, s.out, 2800); });
    },
    action: { label: '🌾 풀밭에 눕기', onLabel: '🌾 일어나기', type: 'pose', pose: 'lie' }
  });

  // ===== 공원 =====
  P.push({
    id: 'park', name: '오후의 공원', desc: '분수 소리, 벤치, 나무 그늘 아래 산책길', accent: '#ffd479',
    walk: { x0: 10, x1: 310, y0: 120, y1: 174 },
    names: ['분수 물방울', '벤치 끝자리', '산책하는 개', '비둘기 친구', '나무 그늘', '노란 은행잎', '자전거 벨', '아이스크림'],
    bg(c) {
      bands(c, 0, 26, ['#a8d8f0', '#d4ecf5']);
      R(c, 0, 26, W, 154, '#79b95a');
      const r = rng(31);
      for (let i = 0; i < 300; i++) R(c, r() * W, 30 + r() * 150, 1, 1, r() < .5 ? '#6aa94d' : '#8cc96b');
      // 나무 줄
      for (let x = -6; x < W + 20; x += 34) { R(c, x + 10, 50, 4, 26, '#6a4a30'); disc(c, x + 12, 40, 15, x % 68 ? '#3c7a38' : '#4d8c3f'); disc(c, x + 6, 46, 9, '#4f9644'); R(c, x + 2, 74, 22, 3, 'rgba(20,60,20,.3)'); }
      // 산책길
      R(c, 0, 138, W, 16, '#dbc9a1'); R(c, 0, 138, W, 1, '#bfae86'); R(c, 0, 153, W, 1, '#bfae86');
      R(c, 150, 118, 20, 20, '#dbc9a1');
      // 분수
      disc(c, 160, 104, 22, '#9aa3ad'); disc(c, 160, 104, 19, '#5aa6d6'); disc(c, 160, 104, 5, '#b9c1c9'); R(c, 158, 88, 4, 16, '#b9c1c9');
      // 벤치
      [[40, 124], [250, 124]].forEach(([x, y]) => { R(c, x, y, 30, 3, '#8a5a35'); R(c, x, y - 6, 30, 3, '#9b6a42'); R(c, x + 2, y + 3, 2, 5, '#4a3a2a'); R(c, x + 26, y + 3, 2, 5, '#4a3a2a'); });
      // 가로등
      [[100, 122], [220, 122]].forEach(([x, y]) => { R(c, x, y - 34, 2, 34, '#3a3f4a'); R(c, x - 2, y - 38, 6, 4, '#f3e3a3'); });
    },
    anim(c, t) {
      const r = rng(13);
      for (let i = 0; i < 26; i++) {
        const ph = wrap(t * 0.9 + r(), 1), a = r() * Math.PI * 2, d = ph * 14;
        R(c, 160 + Math.cos(a) * d, 88 - Math.sin(ph * Math.PI) * 10 + ph * 12, 1, 1, '#e8f6ff');
      }
      for (let i = 0; i < 10; i++) { const a = t * 0.6 + i * 0.63; R(c, 160 + Math.cos(a) * 15, 104 + Math.sin(a) * 7, 2, 1, '#9fd3f2'); }
      // 비둘기
      for (let i = 0; i < 3; i++) { const x = 70 + i * 90 + Math.round(Math.sin(t * 0.4 + i * 2) * 8), y = 160 + i * 3, p = Math.sin(t * 3 + i) > .6 ? 1 : 0; R(c, x, y, 4, 2, '#8d8f9a'); R(c, x + 3, y - 1 + p, 2, 2, '#6d7080'); }
    },
    sound(s, Hx) {
      noiseLayer(s, Hx, 'brown', 'lowpass', 260, 0.22, 0.03, 0.05);
      noiseLayer(s, Hx, 'white', 'bandpass', 2600, 0.05, 0.4, 0.01, 0.6);
      s.every(3600, () => { if (Math.random() < .5) birds(Hx, s.out, 3000); });
      s.every(7000, () => { if (Math.random() < .4) { Hx.chirp(s.out, 520, 430, 0.28, 0.02, 'sine'); Hx.chirp(s.out, 500, 410, 0.3, 0.018, 'sine', 0.35); } });
    },
    action: { label: '🪑 앉아서 쉬기', onLabel: '🪑 일어나기', type: 'pose', pose: 'sit' }
  });

  // ===== 새벽 옥상 =====
  P.push({
    id: 'dawn', name: '새벽 세 시 옥상', desc: '잠든 도시, 몇 개 남은 불빛, 낮게 울리는 밤공기', accent: '#b9a6ff',
    walk: { x0: 10, x1: 262, y0: 132, y1: 174 },
    names: ['새벽 세 시', '꺼진 창문', '마지막 버스', '잠 못 든 별', '식은 커피', '옥상 바람', '가로등 아래', '멀리 사이렌', '뒤척이는 밤'],
    bg(c) {
      bands(c, 0, 118, ['#05071a', '#0d1230', '#1d2148', '#3a2d58']);
      disc(c, 62, 30, 8, '#f4edd2'); disc(c, 66, 27, 7, '#0a0e28');
      const r = rng(41);
      this._win = [];
      for (let pass = 0; pass < 2; pass++) {
        let x = -4;
        while (x < W) {
          const w = 14 + Math.floor(r() * 22), h = (pass ? 22 : 36) + Math.floor(r() * (pass ? 30 : 34)), top = 120 - h;
          R(c, x, top, w, h, pass ? '#11142a' : '#1a1e3a');
          for (let wy = top + 4; wy < 116; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < (pass ? .14 : .08)) this._win.push([wx, wy, r()]);
          x += w + Math.floor(r() * 3);
        }
      }
      R(c, 0, 120, W, 60, '#34374a');
      for (let y = 124; y < 180; y += 9) R(c, 0, y, W, 1, '#2c2f40');
      for (let x = 0; x < W; x += 20) R(c, x, 120, 1, 60, '#2c2f40');
      R(c, 0, 116, W, 2, '#6d7088'); for (let x = 2; x < W; x += 14) R(c, x, 116, 2, 10, '#5a5d74'); R(c, 0, 124, W, 2, '#4a4d62');
      // 물탱크
      R(c, 270, 92, 40, 40, '#5e6276'); R(c, 270, 92, 40, 3, '#7b7f94'); R(c, 274, 132, 3, 8, '#3a3d4c'); R(c, 303, 132, 3, 8, '#3a3d4c'); R(c, 270, 108, 40, 1, '#4c5062');
    },
    anim(c, t) {
      const r = rng(17);
      for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * 80, tw = Math.sin(t * (1 + r() * 2) + i) > .3; if (tw || r() < .3) R(c, x, y, 1, 1, r() < .2 ? '#ffe9b8' : '#dfe6ff'); }
      (this._win || []).forEach(([x, y, s]) => { if (Math.sin(t * 0.05 + s * 60) > -0.6) R(c, x, y, 2, 2, s < .3 ? '#ffd27a' : '#f5e3a0'); });
      const ph = wrap(t, 11);
      if (ph < 0.9) { const k = ph / 0.9, x = 200 + k * 90, y = 12 + k * 30; c.globalAlpha = 1 - k; for (let i = 0; i < 10; i++) R(c, x - i * 2, y - i * 0.66, 1, 1, '#ffffff'); c.globalAlpha = 1; }
      const px = wrap(t * 6, W + 40) - 20; if (Math.sin(t * 4) > .7) R(c, px, 58, 1, 1, '#ff6b6b');
    },
    sound(s, Hx) {
      noiseLayer(s, Hx, 'brown', 'lowpass', 170, 0.42, 0.02, 0.06);
      noiseLayer(s, Hx, 'pink', 'bandpass', 700, 0.02, 0.05, 0.012, 0.5);
      s.every(1300, () => { if (Math.random() < .55) for (let i = 0; i < 3; i++) Hx.chirp(s.out, 4400, 4500, 0.03, 0.012, 'sine', i * 0.07); });
      s.every(9000, () => {
        if (Math.random() > .5) return;
        const c = Hx.ctx, n = Hx.noise('pink'), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime;
        f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(250, t0); f.frequency.exponentialRampToValueAtTime(900, t0 + 2); f.frequency.exponentialRampToValueAtTime(250, t0 + 4.5);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.09, t0 + 2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.5);
        n.connect(f); f.connect(g); g.connect(s.out); n.stop(t0 + 4.6);
      });
    },
    action: { label: '✦ 별 바라보기', onLabel: '✦ 그만 보기', type: 'pose', pose: 'gaze' }
  });

  // ===== 클럽 =====
  const BPM = 122;
  P.push({
    id: 'club', name: '새벽 두 시 클럽', desc: '쿵쿵 울리는 베이스, 레이저, 반짝이는 플로어', accent: '#ff5fd2',
    walk: { x0: 10, x1: 310, y0: 110, y1: 174 },
    names: ['보라색 조명', '베이스 진동', '반짝이 볼', '레이저 한 줄기', '마지막 곡', '젖은 머리칼', '앵콜 한 번', '네온 사인'],
    bg(c) {
      R(c, 0, 0, W, H, '#0b0712');
      bands(c, 0, 98, ['#0b0712', '#1a0e2c', '#22123a']);
      [[8, 40], [282, 40]].forEach(([x, y]) => { R(c, x, y, 30, 58, '#120b1c'); disc(c, x + 15, y + 16, 9, '#24183a'); disc(c, x + 15, y + 16, 4, '#0b0712'); disc(c, x + 15, y + 40, 9, '#24183a'); disc(c, x + 15, y + 40, 4, '#0b0712'); });
      R(c, 120, 70, 80, 28, '#2a1c3d'); R(c, 120, 70, 80, 2, '#4b3470'); R(c, 145, 64, 30, 6, '#3a2a55');
      R(c, 0, 98, W, 82, '#140c1f');
      R(c, 159, 0, 2, 10, '#555');
    },
    anim(c, t) {
      const beat = t * BPM / 60, b = Math.floor(beat), frac = beat - b, pal = ['#ff5fd2', '#6b5bff', '#38e0ff', '#ffb36b', '#7dff8a'];
      for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 20; gx++) {
        const on = (gx * 7 + gy * 3 + b) % 5 === 0 || ((gx + gy + b) % 9 === 0);
        R(c, gx * 16 + 1, 100 + gy * 10 + 1, 14, 8, on ? pal[(gx + gy + b) % 5] : '#1d1230');
        if (on) { c.globalAlpha = 0.25 * (1 - frac); R(c, gx * 16 - 1, 100 + gy * 10 - 1, 18, 12, pal[(gx + gy + b) % 5]); c.globalAlpha = 1; }
      }
      disc(c, 160, 16, 7, '#c9c9d6');
      for (let i = 0; i < 8; i++) R(c, 160 + Math.cos(t * 2 + i) * 5, 16 + Math.sin(t * 3 + i * 2) * 5, 1, 1, '#ffffff');
      const pulse = 1 - frac;
      c.globalAlpha = 0.15 + pulse * 0.25; R(c, 140, 66, 40, 4, pal[b % 5]); c.globalAlpha = 1;
      R(c, 150, 66, 20, 1, '#9be7ff');
    },
    front(c, t) {
      const beat = t * BPM / 60, b = Math.floor(beat);
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 1;
      const cols = ['rgba(255,60,200,.35)', 'rgba(60,220,255,.35)', 'rgba(120,255,140,.3)'];
      for (let i = 0; i < 6; i++) {
        const sx = i < 3 ? 124 : 196, a = Math.PI / 2 + Math.sin(t * (0.9 + i * 0.13) + i) * 0.9;
        c.strokeStyle = cols[(i + Math.floor(b / 4)) % 3]; c.beginPath(); c.moveTo(sx, 72); c.lineTo(sx + Math.cos(a) * 260, 72 + Math.sin(a) * 260); c.stroke();
      }
      c.globalAlpha = 0.08 * (1 - (beat - b)); c.fillStyle = '#ff5fd2'; c.fillRect(0, 0, W, H);
      c.restore();
    },
    sound(s, Hx) {
      const c = Hx.ctx, out = c.createGain(); out.gain.value = 0.55; out.connect(s.out);
      const step = 60 / BPM / 4, roots = [55, 55, 65.41, 49];
      let next = c.currentTime + 0.1, i = 0;
      noiseLayer(s, Hx, 'pink', 'lowpass', 400, 0.05, 0.2, 0.03);
      s.every(25, () => {
        while (next < c.currentTime + 0.12) {
          const st = i % 16, bar = Math.floor(i / 16) % 4;
          if (st % 4 === 0) Hx.kick(out, next);
          if (st % 4 === 2) Hx.hat(out, next, 0.14); else if (st % 2 === 1) Hx.hat(out, next, 0.04);
          if (st === 4 || st === 12) Hx.snare(out, next);
          if (st % 4 === 2 || st === 15) Hx.bass(out, next, roots[bar] * (st === 15 ? 2 : 1), step * 1.6);
          next += step; i++;
        }
      });
    },
    action: { label: '🕺 춤추기', onLabel: '🕺 쉬기', type: 'pose', pose: 'dance' }
  });

  window.PLACES = P;
  window.PLACE_W = W; window.PLACE_H = H;
})();
