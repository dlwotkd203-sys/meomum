(() => {
  const W = PLACE_W, H = PLACE_H, SPEED = 46;
  const $ = id => document.getElementById(id);
  const byId = Object.fromEntries(PLACES.map(p => [p.id, p]));

  // ---------- 외형 ----------
  const HAIR = ['#2b2118', '#4a3222', '#1d1d24', '#7a4b2a', '#c98b4a', '#d9d2c6', '#6b3a5a', '#3a4f7a'];
  const SHIRT = ['#e86a5f', '#f2b84b', '#5fb37a', '#5b8fd9', '#9b6bd6', '#ef8fb5', '#e8e2d4', '#3d4a5c', '#47b3b0', '#d9773f'];
  const SKIN = ['#f6d3b3', '#eec09a', '#d9a47a', '#b97f57', '#8d5a3b'];
  const PANTS = ['#2f3a52', '#3a3a3a', '#5b4636', '#4a5a3a', '#6a6f80'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function myLook() {
    try { const s = JSON.parse(localStorage.getItem('meomum-look')); if (s && s.hair) return s; } catch (e) {}
    const l = { hair: pick(HAIR), shirt: pick(SHIRT), skin: pick(SKIN), pants: pick(PANTS) };
    try { localStorage.setItem('meomum-look', JSON.stringify(l)); } catch (e) {}
    return l;
  }

  // ---------- 배경 캐시 ----------
  const bgCache = {};
  function bgOf(p) {
    if (!bgCache[p.id]) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; p.bg(cv.getContext('2d')); bgCache[p.id] = cv; }
    return bgCache[p.id];
  }

  // ---------- 로비 ----------
  const cards = [];
  PLACES.forEach(p => {
    const b = document.createElement('button');
    b.className = 'card'; b.style.setProperty('--card-accent', p.accent);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const info = document.createElement('div'); info.className = 'info';
    const row = document.createElement('div'); row.className = 'row';
    const nm = document.createElement('b'); nm.textContent = p.name;
    const cnt = document.createElement('span'); cnt.className = 'count'; cnt.innerHTML = '<i></i><span>0명</span>';
    const d = document.createElement('p'); d.textContent = p.desc;
    row.append(nm, cnt); info.append(row, d); b.append(cv, info);
    b.addEventListener('click', () => { location.hash = p.id; });
    $('placeGrid').append(b);
    cards.push({ p, ctx: cv.getContext('2d'), cnt: cnt.querySelector('span') });
  });
  $('modeBadge').textContent = Net.online ? '' : '로컬 테스트 모드 · ';

  let lobbyCounts = {};
  Net.onLobby((counts, total) => {
    lobbyCounts = counts;
    $('onlineTotal').textContent = total;
    cards.forEach(c => { c.cnt.textContent = (counts[c.p.id] || 0) + '명'; });
  });

  // ---------- 방 ----------
  const stage = $('stage'), ctx = stage.getContext('2d'), overlay = $('overlay');
  stage.width = W; stage.height = H;
  let place = null, me = null, actors = {}, scale = 1, synced = false, lastChat = 0, lastAct = 0;

  function fit() {
    const r = $('stageWrap').getBoundingClientRect();
    scale = Math.max(0.5, Math.min(r.width / W, r.height / H));
    $('stageBox').style.width = W * scale + 'px'; $('stageBox').style.height = H * scale + 'px';
  }
  window.addEventListener('resize', () => place && fit());

  function makeActor(id, s, isMe) {
    const el = document.createElement('div'); el.className = 'actor' + (isMe ? ' me' : '');
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = s.name;
    const bub = document.createElement('div'); bub.className = 'bubble';
    el.append(nm, bub); overlay.append(el);
    return { id, name: s.name, look: s.look || { hair: HAIR[0], shirt: SHIRT[0], skin: SKIN[0], pants: PANTS[0] },
      x: s.x, y: s.y, tx: s.tx ?? s.x, ty: s.ty ?? s.y, pose: s.pose || null, dir: s.dir || 1, walkT: 0, el, nm, bub, bubT: 0, lastMove: 0 };
  }
  function removeActor(id) { const a = actors[id]; if (a) { a.el.remove(); delete actors[id]; } }

  function stateOf() { return { name: me.name, look: me.look, x: Math.round(me.x), y: Math.round(me.y), tx: Math.round(me.tx), ty: Math.round(me.ty), pose: me.pose, dir: me.dir }; }

  function line(text, who, sys) {
    const l = document.createElement('div'); l.className = 'line' + (sys ? ' sys' : '');
    if (who) { const b = document.createElement('b'); b.textContent = who; l.append(b); }
    l.append(document.createTextNode(text));
    const log = $('chatLog'); log.append(l);
    while (log.children.length > 30) log.firstChild.remove();
  }
  function say(a, text, emote) {
    if (!a) return;
    a.bub.textContent = text; a.bub.className = 'bubble show' + (emote ? ' emote' : '');
    clearTimeout(a.bubT); a.bubT = setTimeout(() => { a.bub.className = 'bubble' + (emote ? ' emote' : ''); }, emote ? 2200 : 5500);
  }

  const app = {
    floatAt(x, y, text, cls) {
      const f = document.createElement('div'); f.className = 'float ' + (cls || '');
      f.textContent = text; f.style.left = x * scale + 'px'; f.style.top = y * scale + 'px';
      overlay.append(f); setTimeout(() => f.remove(), 2600);
    }
  };

  function freeName(p, taken) {
    const free = p.names.filter(n => !taken.has(n));
    return free.length ? pick(free) : pick(p.names) + ' ' + (2 + Math.floor(Math.random() * 98));
  }

  function enter(p) {
    place = p; actors = {}; synced = false; overlay.innerHTML = ''; $('chatLog').innerHTML = '';
    $('lobby').classList.add('hidden'); $('room').classList.remove('hidden');
    document.title = p.name + ' · 머묾';
    $('roomName').textContent = p.name;
    fit();
    const w = p.walk, x = w.x0 + 20 + Math.random() * (w.x1 - w.x0 - 40), y = w.y0 + Math.random() * (w.y1 - w.y0);
    me = makeActor(Net.myId, { name: freeName(p, new Set()), look: myLook(), x, y }, true);
    updateAction();
    SoundEngine.play(p.sound.bind(p));
    Net.setRoom(p.id);
    Net.join(p.id, stateOf(), { sync: onSync, event: onEvent });
    line(`당신은 '${me.name}'이에요. 화면을 눌러 걸어 보세요.`, null, true);
    setTimeout(() => { if (place === p && !Object.keys(actors).length) line('아직 아무도 없어요. 링크를 보내 함께 머물러요.', null, true); }, 2500);
    countRoom();
  }

  function leave() {
    if (!place) return;
    Net.leave(); Net.setRoom(null); SoundEngine.stop();
    Object.keys(actors).forEach(removeActor);
    if (me) me.el.remove();
    place = null; me = null; overlay.innerHTML = '';
    $('room').classList.add('hidden'); $('lobby').classList.remove('hidden');
    document.title = '머묾 · 잠깐 머물다 가는 곳';
  }

  let connOk = true;
  function countRoom() {
    const n = Object.values(actors).filter(a => !a.goneAt).length + 1;
    $('roomCount').textContent = connOk ? ` · ${n}명 머무는 중` : ' · 다시 연결하는 중…';
  }
  Net.onStatus(ok => { connOk = ok; if (place) countRoom(); });
  setInterval(() => {
    if (!place) return;
    let changed = false;
    Object.keys(actors).forEach(id => {
      const a = actors[id];
      if (a.goneAt && Date.now() - a.goneAt > 5000) { line(`'${a.name}'님이 떠났어요`, null, true); removeActor(id); changed = true; }
    });
    if (changed) countRoom();
  }, 1000);

  function onSync(peers) {
    if (!place) return;
    Object.entries(peers).forEach(([id, s]) => {
      if (!s || !s.name) return;
      let a = actors[id];
      if (!a) {
        a = actors[id] = makeActor(id, s, false);
        if (synced) line(`'${s.name}'님이 머물러 왔어요`, null, true);
      } else {
        a.name = s.name; a.nm.textContent = s.name; a.look = s.look || a.look; a.pose = s.pose || null;
        if (Date.now() - a.lastMove > 1500) { a.tx = s.tx ?? a.tx; a.ty = s.ty ?? a.ty; }
      }
    });
    // 잠깐 끊겼다 돌아오는 경우가 있어서 5초 기다렸다가 떠난 것으로 처리
    Object.keys(actors).forEach(id => {
      const a = actors[id];
      if (peers[id]) { a.goneAt = 0; a.el.style.opacity = ''; return; }
      if (!a.goneAt) { a.goneAt = Date.now(); a.el.style.opacity = '.45'; }
    });
    if (!synced) {
      synced = true;
      const taken = new Set(Object.values(actors).map(a => a.name));
      if (taken.has(me.name)) { me.name = freeName(place, taken); me.nm.textContent = me.name; Net.update(stateOf()); }
    }
    countRoom();
  }

  function onEvent(e) {
    if (!place) return;
    const a = actors[e.id];
    switch (e.type) {
      case 'move': if (a) { if (Math.hypot(a.x - e.x, a.y - e.y) > 24) { a.x = e.x; a.y = e.y; } a.tx = e.tx; a.ty = e.ty; a.pose = null; a.lastMove = Date.now(); } break;
      case 'chat': { const t = String(e.text || '').slice(0, 60); if (!t) break; say(a, t); line(t, e.n || (a && a.name) || '누군가'); break; }
      case 'emote': say(a, String(e.e || '').slice(0, 4), true); break;
      case 'act': if (place.action.type === 'burst') { place.action.fx(app, { x: e.x, y: e.y, dir: e.dir }); SoundEngine.sfx(place.action.sfx); } break;
      case 'pose': if (a) { a.pose = e.pose || null; if (a.pose) { a.tx = a.x; a.ty = a.y; } } break;
    }
  }

  // ---------- 입력 ----------
  function clampWalk(x, y) { const w = place.walk; return [Math.max(w.x0, Math.min(w.x1, x)), Math.max(w.y0, Math.min(w.y1, y))]; }
  function moveTo(x, y) {
    if (!me) return;
    [x, y] = clampWalk(x, y);
    if (me.pose) { me.pose = null; updateAction(); Net.send('pose', { pose: null }); }
    me.tx = x; me.ty = y;
    Net.send('move', { x: Math.round(me.x), y: Math.round(me.y), tx: Math.round(x), ty: Math.round(y) });
    Net.update(stateOf());
  }
  stage.addEventListener('pointerdown', e => {
    SoundEngine.ensure();
    const r = stage.getBoundingClientRect();
    moveTo((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
  });
  document.addEventListener('keydown', e => {
    if (!place) return;
    if (document.activeElement === $('chatInput')) { if (e.key === 'Escape') $('chatInput').blur(); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[e.key];
    if (d) { e.preventDefault(); moveTo(me.x + d[0] * 26, me.y + d[1] * 14); }
    else if (e.key === 'Enter') { e.preventDefault(); $('chatInput').focus(); }
  });
  document.addEventListener('pointerdown', () => SoundEngine.ensure(), { capture: true });

  $('chatForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('chatInput'), t = inp.value.replace(/\s+/g, ' ').trim().slice(0, 60);
    // 엔터로 보내고 나면 다시 캐릭터 조종으로 (터치 기기는 키보드가 계속 열려 있게 둠)
    const backToMove = () => { if (!matchMedia('(pointer: coarse)').matches) inp.blur(); };
    if (!t || !me) { inp.blur(); return; }
    if (Date.now() - lastChat < 900) return;
    lastChat = Date.now(); inp.value = ''; backToMove();
    say(me, t); line(t, me.name);
    Net.send('chat', { text: t, n: me.name });
  });
  document.querySelectorAll('.emotes button').forEach(b => b.addEventListener('click', () => {
    if (!me) return; say(me, b.dataset.emote, true); Net.send('emote', { e: b.dataset.emote });
  }));

  function updateAction() {
    const a = place.action, btn = $('btnAction');
    const on = a.type === 'pose' && me && me.pose === a.pose;
    btn.textContent = on ? a.onLabel : a.label; btn.classList.toggle('on', !!on);
  }
  $('btnAction').addEventListener('click', () => {
    if (!me) return;
    const a = place.action;
    if (a.type === 'burst') {
      if (Date.now() - lastAct < 1500) return; lastAct = Date.now();
      const d = { x: Math.round(me.x), y: Math.round(me.y), dir: me.dir };
      a.fx(app, d); SoundEngine.sfx(a.sfx); Net.send('act', d);
    } else {
      me.pose = me.pose === a.pose ? null : a.pose; me.tx = me.x; me.ty = me.y;
      Net.send('pose', { pose: me.pose }); Net.update(stateOf());
    }
    updateAction();
  });

  $('btnBack').addEventListener('click', () => { history.length > 1 && location.hash ? history.back() : (location.hash = ''); });
  $('btnMute').addEventListener('click', () => { SoundEngine.ensure(); $('btnMute').textContent = SoundEngine.toggleMute() ? '🔇' : '🔊'; });
  $('vol').addEventListener('input', e => SoundEngine.setVolume(e.target.value / 100));

  function route() {
    const p = byId[location.hash.slice(1)];
    if (p && place !== p) { leave(); enter(p); } else if (!p && place) leave();
  }
  window.addEventListener('hashchange', route);

  // ---------- 캐릭터 그리기 ----------
  function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function drawActor(a, t) {
    const L = a.look, x0 = Math.round(a.x) - 3, y = Math.round(a.y), eye = '#1d1a24';
    R(x0 - 1, y - 1, 9, 2, 'rgba(0,0,0,.22)');
    if (a.pose === 'lie') {
      const lx = x0 - 3, ly = y - 4;
      R(lx, ly, 2, 4, L.hair); R(lx + 2, ly, 3, 4, L.skin); R(lx + 3, ly + 1, 1, 1, eye);
      R(lx + 5, ly, 5, 4, L.shirt); R(lx + 10, ly + 1, 3, 3, L.pants); R(lx + 13, ly + 1, 1, 3, '#222');
      R(lx + 5, ly + 3, 2, 1, L.skin);
      return y - 6;
    }
    const sit = a.pose === 'sit' || a.pose === 'gaze';
    const dance = a.pose === 'dance';
    const bob = dance ? Math.round(Math.abs(Math.sin(t * Math.PI * 122 / 60)) * 2) : 0;
    const top = (sit ? y - 9 : y - 12) - bob, d = a.dir < 0 ? -1 : 1;
    // 머리
    R(x0 + 1, top, 5, 1, L.hair); R(x0, top + 1, 7, 1, L.hair);
    R(x0, top + 2, 1, 2, L.hair); R(x0 + 6, top + 2, 1, 2, L.hair);
    R(x0 + 1, top + 2, 5, 3, L.skin);
    if (a.pose === 'gaze') { R(x0 + 2, top + 2, 1, 1, eye); R(x0 + 4, top + 2, 1, 1, eye); }
    else { const ex = d > 0 ? 3 : 1; R(x0 + ex, top + 3, 1, 1, eye); R(x0 + ex + 2, top + 3, 1, 1, eye); }
    // 몸
    const by = top + 5, bh = sit ? 3 : 4;
    R(x0 + 1, by, 5, bh, L.shirt);
    if (dance) {
      const up = Math.floor(t * 122 / 60) % 2;
      R(x0, by - (up ? 3 : 0), 1, 3, L.shirt); R(x0 + 6, by - (up ? 0 : 3), 1, 3, L.shirt);
      R(x0, by - (up ? 4 : -3), 1, 1, L.skin); R(x0 + 6, by - (up ? -3 : 4), 1, 1, L.skin);
    } else {
      R(x0, by, 1, bh - 1, L.shirt); R(x0 + 6, by, 1, bh - 1, L.shirt);
      R(x0, by + bh - 1, 1, 1, L.skin); R(x0 + 6, by + bh - 1, 1, 1, L.skin);
    }
    // 다리
    if (sit) {
      const lx = d > 0 ? x0 + 1 : x0 - 1;
      R(lx, y - 1, 7, 1, L.pants); R(d > 0 ? lx + 7 : lx - 1, y - 1, 1, 1, '#222');
    } else {
      const walking = Math.hypot(a.tx - a.x, a.ty - a.y) > 0.5, f = walking ? Math.floor(a.walkT * 8) % 2 : -1;
      const ly = by + 4;
      R(x0 + 1, ly, 2, f === 0 ? 1 : 2, L.pants); R(x0 + 1, ly + (f === 0 ? 1 : 2), 2, 1, '#222');
      R(x0 + 4, ly, 2, f === 1 ? 1 : 2, L.pants); R(x0 + 4, ly + (f === 1 ? 1 : 2), 2, 1, '#222');
    }
    return top - 1;
  }

  function step(a, dt) {
    const dx = a.tx - a.x, dy = a.ty - a.y, dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      const s = Math.min(dist, SPEED * dt);
      a.x += dx / dist * s; a.y += dy / dist * s; a.walkT += dt;
      if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
    } else { a.x = a.tx; a.y = a.ty; }
  }

  // ---------- 루프 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000), t = now / 1000; last = now;
    if (place) {
      ctx.drawImage(bgOf(place), 0, 0);
      place.anim(ctx, t);
      const list = [me, ...Object.values(actors)];
      list.forEach(a => step(a, dt));
      list.sort((a, b) => a.y - b.y).forEach(a => {
        const headY = drawActor(a, t);
        a.el.style.transform = `translate(${a.x * scale}px, ${headY * scale}px)`;
        a.el.style.zIndex = Math.round(a.y);
      });
      if (place.front) place.front(ctx, t);
    } else {
      cards.forEach(c => { c.ctx.drawImage(bgOf(c.p), 0, 0); c.p.anim(c.ctx, t); if (c.p.front) c.p.front(c.ctx, t); });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  route();
})();
