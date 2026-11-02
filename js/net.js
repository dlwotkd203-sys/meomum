// 네트워크 — Supabase Realtime(Presence + Broadcast), 키가 없으면 BroadcastChannel 로컬 테스트 모드
window.Net = (() => {
  const cfg = window.APP_CONFIG || {};
  const myId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const online = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const prefix = cfg.CHANNEL_PREFIX || 'meomum';
  let lobbyCb = () => {}, room = null, roomId = null, h = null, myState = null;

  // ---------- Supabase ----------
  if (online) {
    // worker: 백그라운드 탭에서도 하트비트가 늦춰지지 않게 Web Worker에서 돌림
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 20 }, worker: true, heartbeatIntervalMs: 15000 }
    });
    let statusCb = () => {}, wantRoom = null, lobby = null, lobbyRetry = null, roomRetry = null;
    let trackTimer = null, lastTrack = 0;
    const joined = ch => ch && ch.state === 'joined';
    const BAD = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'];

    // 로비: 끊기면 새로 만들어 다시 들어감
    function openLobby() {
      clearTimeout(lobbyRetry);
      if (lobby) sb.removeChannel(lobby);
      const ch = lobby = sb.channel(prefix + ':lobby', { config: { presence: { key: myId } } });
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState(), counts = {}; let total = 0;
        Object.values(st).forEach(arr => { const m = arr[arr.length - 1] || {}; total++; if (m.room) counts[m.room] = (counts[m.room] || 0) + 1; });
        lobbyCb(counts, total);
      }).subscribe(s => {
        if (ch !== lobby) return;
        if (s === 'SUBSCRIBED') ch.track({ room: wantRoom });
        else if (BAD.includes(s)) lobbyRetry = setTimeout(openLobby, 2000);
      });
    }
    openLobby();

    // 방: 끊기면 같은 방에 다시 들어가고 내 상태를 다시 알림
    function openRoom() {
      clearTimeout(roomRetry);
      if (room) sb.removeChannel(room);
      if (!roomId) return;
      const ch = room = sb.channel(prefix + ':room:' + roomId, { config: { presence: { key: myId }, broadcast: { self: false } } });
      const peers = () => { const st = ch.presenceState(), o = {}; Object.entries(st).forEach(([k, arr]) => { if (k !== myId && arr.length) o[k] = arr[arr.length - 1]; }); return o; };
      ch.on('presence', { event: 'sync' }, () => ch === room && h && h.sync(peers()))
        .on('broadcast', { event: 'ev' }, ({ payload }) => ch === room && h && payload && payload.id !== myId && h.event(payload))
        .subscribe(s => {
          if (ch !== room) return;
          if (s === 'SUBSCRIBED') { ch.track(myState); statusCb(true); }
          else if (BAD.includes(s)) { statusCb(false); roomRetry = setTimeout(openRoom, 2000); }
        });
    }

    // 살아있음 확인: 주기적으로, 그리고 탭으로 돌아왔을 때 상태를 다시 보냄
    function keepAlive() {
      if (joined(lobby)) lobby.track({ room: wantRoom }); else if (lobby && lobby.state !== 'joining') openLobby();
      if (roomId) { if (joined(room)) room.track(myState); else if (!room || room.state !== 'joining') openRoom(); }
    }
    setInterval(keepAlive, 20000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAlive(); });
    window.addEventListener('online', keepAlive);

    var impl = {
      setRoom(id) { wantRoom = id; if (joined(lobby)) lobby.track({ room: id }); },
      join(id, state, handlers) { roomId = id; h = handlers; myState = state; openRoom(); },
      update(state) {
        myState = state; if (!joined(room)) return;
        const now = Date.now(), go = () => { lastTrack = Date.now(); joined(room) && room.track(myState); };
        clearTimeout(trackTimer);
        if (now - lastTrack > 400) go(); else trackTimer = setTimeout(go, 400);
      },
      send(type, data) { joined(room) && room.send({ type: 'broadcast', event: 'ev', payload: { id: myId, type, ...data } }); },
      leave() {
        clearTimeout(trackTimer); clearTimeout(roomRetry);
        const ch = room; room = null; roomId = null; h = null;
        if (ch) { try { ch.untrack(); } catch (e) {} sb.removeChannel(ch); }
      }
    };
    return { myId, online, ...impl, onLobby(cb) { lobbyCb = cb; }, onStatus(cb) { statusCb = cb; } };
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
    onStatus() {},
    onLobby(cb) { lobbyCb = cb; recompute(); },
    setRoom(id) { curRoom = id; beat(); recompute(); },
    join(id, state, handlers) { roomId = id; myState = state; h = handlers; beat(); recompute(); },
    update(state) { myState = state; beat(); },
    send(type, data) { post({ k: 'ev', room: roomId, p: { id: myId, type, ...data } }); },
    leave() { roomId = null; h = null; myState = null; beat(); }
  };
})();
