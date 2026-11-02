// 네트워크 — Supabase Realtime(Presence + Broadcast), 키가 없으면 BroadcastChannel 로컬 테스트 모드
window.Net = (() => {
  const cfg = window.APP_CONFIG || {};
  const myId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const online = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const prefix = cfg.CHANNEL_PREFIX || 'meomum';
  let lobbyCb = () => {}, room = null, roomId = null, h = null, myState = null;

  // ---------- Supabase ----------
  if (online) {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 20 } } });
    const lobby = sb.channel(prefix + ':lobby', { config: { presence: { key: myId } } });
    let lobbyReady = false, wantRoom = null;
    lobby.on('presence', { event: 'sync' }, () => {
      const st = lobby.presenceState(), counts = {}; let total = 0;
      Object.values(st).forEach(arr => { const m = arr[arr.length - 1] || {}; total++; if (m.room) counts[m.room] = (counts[m.room] || 0) + 1; });
      lobbyCb(counts, total);
    }).subscribe(s => { if (s === 'SUBSCRIBED') { lobbyReady = true; lobby.track({ room: wantRoom }); } });

    let trackTimer = null, lastTrack = 0;
    var impl = {
      setRoom(id) { wantRoom = id; if (lobbyReady) lobby.track({ room: id }); },
      join(id, state, handlers) {
        roomId = id; h = handlers; myState = state;
        room = sb.channel(prefix + ':room:' + id, { config: { presence: { key: myId }, broadcast: { self: false } } });
        const peers = () => { const st = room.presenceState(), o = {}; Object.entries(st).forEach(([k, arr]) => { if (k !== myId && arr.length) o[k] = arr[arr.length - 1]; }); return o; };
        room.on('presence', { event: 'sync' }, () => h && h.sync(peers()))
          .on('broadcast', { event: 'ev' }, ({ payload }) => h && payload && payload.id !== myId && h.event(payload))
          .subscribe(s => { if (s === 'SUBSCRIBED') room.track(myState); });
      },
      update(state) {
        myState = state; if (!room) return;
        const now = Date.now(), go = () => { lastTrack = Date.now(); room && room.track(myState); };
        clearTimeout(trackTimer);
        if (now - lastTrack > 400) go(); else trackTimer = setTimeout(go, 400);
      },
      send(type, data) { room && room.send({ type: 'broadcast', event: 'ev', payload: { id: myId, type, ...data } }); },
      leave() { clearTimeout(trackTimer); if (room) { room.untrack(); sb.removeChannel(room); } room = null; roomId = null; h = null; }
    };
    return { myId, online, ...impl, onLobby(cb) { lobbyCb = cb; } };
  }

  // ---------- 로컬 테스트 모드 (같은 브라우저의 탭끼리) ----------
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(prefix + '-local') : null;
  const seen = {}; // id -> {room, state, t}
  let curRoom = null;
  const post = m => bc && bc.postMessage({ ...m, id: myId });
  const beat = () => post({ k: 'hb', room: curRoom, state: roomId ? myState : null });

  function recompute() {
    const now = Date.now(), counts = {}; let total = 1;
    if (curRoom) counts[curRoom] = 1;
    Object.entries(seen).forEach(([id, p]) => { if (now - p.t > 6000) { delete seen[id]; return; } total++; if (p.room) counts[p.room] = (counts[p.room] || 0) + 1; });
    lobbyCb(counts, total);
    if (h && roomId) { const o = {}; Object.entries(seen).forEach(([id, p]) => { if (p.room === roomId && p.state) o[id] = p.state; }); h.sync(o); }
  }
  if (bc) bc.onmessage = ({ data: m }) => {
    if (!m || m.id === myId) return;
    if (m.k === 'hb') { seen[m.id] = { room: m.room, state: m.state, t: Date.now() }; recompute(); }
    else if (m.k === 'bye') { delete seen[m.id]; recompute(); }
    else if (m.k === 'ev' && m.room === roomId && h) h.event(m.p);
  };
  setInterval(() => { beat(); recompute(); }, 2000);
  window.addEventListener('pagehide', () => post({ k: 'bye' }));
  setTimeout(beat, 50);

  return {
    myId, online,
    onLobby(cb) { lobbyCb = cb; recompute(); },
    setRoom(id) { curRoom = id; beat(); recompute(); },
    join(id, state, handlers) { roomId = id; myState = state; h = handlers; beat(); recompute(); },
    update(state) { myState = state; beat(); },
    send(type, data) { post({ k: 'ev', room: roomId, p: { id: myId, type, ...data } }); },
    leave() { roomId = null; h = null; myState = null; beat(); }
  };
})();
