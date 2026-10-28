/* Mir Luxe One — демо-мок пакета ops-rooms (распределение номеров, проверка уборки, «Не беспокоить»).
   Подключается после всех mock-*.js волны 03. Учебные данные; даты относительно сегодня (Ташкент). */
(function () {
  var DB = window.__DB; if (!DB || !DB.pms_rooms) return;
  var TZ = 'Asia/Tashkent', now = Date.now();
  function dOf(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms)); }
  function iso(ms) { return new Date(ms).toISOString(); }
  var tday = dOf(now), yday = dOf(now - 864e5), M = 60e3, H = 3600e3;
  function room(no) { return DB.pms_rooms.filter(function (r) { return r.no === no; })[0]; }
  function live(no) { var r = room(no); return r && r.hk !== 'ooo' ? r : null; }
  DB.hk_assign = DB.hk_assign || []; DB.hk_log = DB.hk_log || []; DB.notifications = DB.notifications || []; DB.pms_board = DB.pms_board || [];
  var nseq = 77000; function nid() { return ++nseq; }
  var lseq = 0; DB.hk_log.forEach(function (x) { if (x.id > lseq) lseq = x.id; });
  function log(no, act, from, to, by, at, photos, note) { DB.hk_log.push({ id: ++lseq, room_no: no, day: dOf(at), act: act, hk_from: from || null, hk_to: to || null, by_emp: by || null, at: iso(at), photos: photos || null, note: note || null }); }

  if (!DB.__opsRoomsSeed) {
    DB.__opsRoomsSeed = true;
    // 1. доска на сегодня (если ресепшен ещё не внёс)
    if (!DB.pms_board.some(function (b) { return b.day === tday; })) {
      var bid = 0; DB.pms_board.forEach(function (b) { if (b.id > bid) bid = b.id; });
      var used = {};
      function add(no, kind) { var r = live(no); if (!r || used[no]) return; used[no] = 1; var n = parseInt(no, 10); DB.pms_board.push({ id: ++bid, day: tday, room_no: no, room_type: r.type, kind: kind, adults: kind === 'dep' ? null : (n % 2 ? 1 : 2), children: 0, source: 'manual' }); }
      ['302', '309', '402', '507', '604', '703', '710', '805'].forEach(function (x) { add(x, 'dep'); });
      ['305', '601'].forEach(function (x) { add(x, 'turn'); });
      ['303', '311', '406', '502', '610', '702'].forEach(function (x) { add(x, 'arr'); });
      DB.pms_rooms.filter(function (r) { return r.hk !== 'ooo' && !used[r.no]; }).map(function (r) { return r.no; }).sort().forEach(function (no, i) { if (i % 3 === 0) add(no, 'stay'); });
    }
    // 2. распределение на сегодня: Барно 301–312, Мукаддам 501–512, Нафиса 601–612
    if (!DB.hk_assign.some(function (a) { return a.day === tday; })) {
      [['e14', 3], ['e15', 5], ['e16', 6]].forEach(function (p) {
        for (var i = 1; i <= 12; i++) { var no = p[1] + (i < 10 ? '0' : '') + i; if (live(no)) DB.hk_assign.push({ day: tday, room_no: no, emp_id: p[0], by_emp: 'e13', at: iso(now - 4 * H) }); }
      });
    }
    // 3. состояния уборки (номера «не продаётся» не трогаем)
    var seeded = { '304': 1, '305': 1, '307': 1, '503': 1, '308': 1, '306': 1 };
    DB.pms_rooms.forEach(function (r) { // старые «чистые» без фото — уже проверены вчера, чтобы очередь была ровно из 3
      if (r.hk === 'clean' && !seeded[r.no] && !r.cleaned_by) { r.hk = 'inspected'; r.inspected_by = 'e13'; r.inspected_at = iso(now - 20 * H); r.hk_by = 'e13'; r.hk_at = r.inspected_at; }
    });
    function st(no, o, evs) { var r = live(no); if (!r) return; Object.assign(r, o); (evs || []).forEach(function (e) { log.apply(null, [no].concat(e)); }); }
    st('304', { hk: 'cleaning', hk_by: 'e14', hk_at: iso(now - 25 * M) }, [['status', 'dirty', 'cleaning', 'e14', now - 25 * M]]);
    st('305', { hk: 'clean', cleaned_by: 'e14', cleaned_at: iso(now - 35 * M), clean_photos: ['e14/room-305-1.jpg', 'e14/room-305-2.jpg'], hk_by: 'e14', hk_at: iso(now - 35 * M) }, [['status', 'dirty', 'cleaning', 'e14', now - 70 * M], ['clean', 'cleaning', 'clean', 'e14', now - 35 * M, ['e14/room-305-1.jpg', 'e14/room-305-2.jpg']]]);
    st('307', { hk: 'clean', cleaned_by: 'e14', cleaned_at: iso(now - 15 * M), clean_photos: ['e14/room-307-1.jpg'], hk_by: 'e14', hk_at: iso(now - 15 * M) }, [['clean', 'cleaning', 'clean', 'e14', now - 15 * M, ['e14/room-307-1.jpg']]]);
    st('503', { hk: 'clean', cleaned_by: 'e15', cleaned_at: iso(now - 50 * M), clean_photos: ['e15/room-503-1.jpg'], hk_by: 'e15', hk_at: iso(now - 50 * M) }, [['clean', 'cleaning', 'clean', 'e15', now - 50 * M, ['e15/room-503-1.jpg']]]);
    st('308', { hk: 'inspected', cleaned_by: 'e14', cleaned_at: iso(now - 2 * H), clean_photos: ['e14/room-308-1.jpg'], inspected_by: 'e13', inspected_at: iso(now - 100 * M), hk_by: 'e13', hk_at: iso(now - 100 * M) }, [['clean', 'cleaning', 'clean', 'e14', now - 2 * H, ['e14/room-308-1.jpg']], ['inspect', 'clean', 'inspected', 'e13', now - 100 * M]]);
    st('306', { hk: 'dirty', cleaned_by: 'e14', cleaned_at: iso(now - 45 * M), clean_photos: [], returned_reason: 'Пыль на тумбочке, нет тапочек', returned_by: 'e13', returned_at: iso(now - 20 * M), hk_by: 'e13', hk_at: iso(now - 20 * M) }, [['clean', 'cleaning', 'clean', 'e14', now - 45 * M], ['return', 'clean', 'dirty', 'e13', now - 20 * M, null, 'Пыль на тумбочке, нет тапочек']]);
    if (live('306')) DB.notifications.push({ id: nid(), employee_id: 'e14', at: iso(now - 20 * M), title: 'Номер 306 вернули на доработку', body: 'Пыль на тумбочке, нет тапочек', ref_type: 'room', ref_id: 306, urgent: false, read_at: null });
    // 5. «Не беспокоить» и «Убрать после»
    st('412', { dnd_at: iso(now - 26 * H) }, [['dnd_on', null, null, 'e8', now - 26 * H]]);
    st('509', { dnd_at: iso(now - 50 * M) }, [['dnd_on', null, null, 'e8', now - 50 * M]]);
    st('310', { svc_after: '14:00', svc_day: tday }, [['svc_after', null, null, 'e14', now - 3 * H, null, '14:00']]);
  }

  // ---- RPC пакета ----
  var sess = null;
  function me() { return sess && DB.employees.filter(function (e) { return e.user_id === sess.user.id; })[0]; }
  function posN(e) { var p = DB.positions.filter(function (x) { return x.id === e.position_id; })[0]; return p ? p.name : ''; }
  function isDir(e) { return e.role === 'director'; }
  function inHk(e) { return e.dept_id === 'hk' || e.lead_dept === 'hk'; }
  function canInspect(e) { return isDir(e) || e.role === 'manager' || (e.dept_id === 'hk' && /супервайз|старш|менедж/i.test(posN(e))); }
  function canAssign(e) { return isDir(e) || (inHk(e) && canInspect(e)); }
  function canHk(e) { return isDir(e) || e.role === 'manager' || ['hk', 'fo', 'eng'].some(function (d) { return e.dept_id === d || e.lead_dept === d; }); }
  function isMaid(e) { return inHk(e) && e.role === 'staff'; }
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function no(m) { return Promise.resolve({ data: null, error: { message: m } }); }
  function notify(emp, title, body, refId) { DB.notifications.push({ id: nid(), employee_id: emp, at: iso(Date.now()), title: title, body: body || '', ref_type: 'room', ref_id: refId == null ? null : +refId, urgent: false, read_at: null }); }

  var orig = window.supabase && window.supabase.createClient; if (!orig) return;
  window.supabase.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__opsRooms) return c; c.__opsRooms = true;
    try { c.auth.onAuthStateChange(function (ev, s) { sess = s; }); } catch (e) {}
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (['room_hk', 'hk_assign_set', 'hk_assign_reset', 'hk_assign_notify', 'room_dnd'].indexOf(n) < 0) return rpc0.apply(c, arguments);
      a = a || {}; var e = me(), t = Date.now(); if (!e) return no('Нет прав');
      if (n === 'room_hk') {
        var r = room(String(a.p_no)), k = a.p_hk; if (!r) return no('Номер не найден');
        if (['dirty', 'cleaning', 'clean', 'inspected', 'ooo'].indexOf(k) < 0) return no('Неверный статус');
        if (!canHk(e)) return no('Нет прав');
        if ((k === 'inspected' || k === 'ooo') && !canInspect(e)) return no('Нет прав');
        var ph = (a.p_photos || []).filter(Boolean);
        if (k === 'clean' && isMaid(e) && !ph.length) return no('Нужно фото');
        var ret = k === 'dirty' && a.p_reason && r.hk === 'clean';
        if (ret && !canInspect(e)) return no('Нет прав');
        var from = r.hk; r.hk = k; r.hk_by = e.id; r.hk_at = iso(t);
        if (k === 'clean') { r.cleaned_by = e.id; r.cleaned_at = iso(t); r.clean_photos = ph; r.inspected_by = r.inspected_at = null; r.returned_reason = r.returned_by = r.returned_at = null;
          if (isMaid(e)) DB.employees.filter(function (x) { return x.active !== false && x.id !== e.id && inHk(x) && (x.role === 'manager' || canInspect(x)); }).forEach(function (x) { notify(x.id, 'Номер ' + r.no + ' убран — проверьте', e.first_name + (ph.length ? ' · фото: ' + ph.length : ''), r.no); });
          log(r.no, 'clean', from, k, e.id, t, ph); }
        else if (k === 'inspected') { r.inspected_by = e.id; r.inspected_at = iso(t); r.returned_reason = r.returned_by = r.returned_at = null; log(r.no, 'inspect', from, k, e.id, t); }
        else if (ret) { r.returned_reason = String(a.p_reason); r.returned_by = e.id; r.returned_at = iso(t); r.inspected_by = r.inspected_at = null; if (r.cleaned_by) notify(r.cleaned_by, 'Номер ' + r.no + ' вернули на доработку', r.returned_reason, r.no); log(r.no, 'return', from, k, e.id, t, null, r.returned_reason); }
        else if (k === 'dirty' && !a.p_reason) { r.cleaned_by = r.cleaned_at = null; r.clean_photos = null; r.inspected_by = r.inspected_at = null; r.returned_reason = r.returned_by = r.returned_at = null; log(r.no, 'status', from, k, e.id, t); }
        else log(r.no, 'status', from, k, e.id, t);
        return ok({ ok: true, hk: k });
      }
      if (!canAssign(e) && n !== 'room_dnd') return no('Нет прав');
      if (n === 'hk_assign_set') {
        var day = a.p_day, rooms = (a.p_rooms || []).map(String);
        DB.hk_assign = DB.hk_assign.filter(function (x) { return !(x.day === day && rooms.indexOf(x.room_no) >= 0); });
        rooms.forEach(function (rn) { if (a.p_emp) DB.hk_assign.push({ day: day, room_no: rn, emp_id: a.p_emp, by_emp: e.id, at: iso(t) }); log(rn, 'assign', null, null, e.id, t, null, a.p_emp || null); });
        return ok({ ok: true, n: rooms.length });
      }
      if (n === 'hk_assign_reset') { var was = DB.hk_assign.length; DB.hk_assign = DB.hk_assign.filter(function (x) { return x.day !== a.p_day; }); return ok({ ok: true, n: was - DB.hk_assign.length }); }
      if (n === 'hk_assign_notify') {
        var cnt = {}; DB.hk_assign.filter(function (x) { return x.day === a.p_day; }).forEach(function (x) { cnt[x.emp_id] = (cnt[x.emp_id] || 0) + 1; });
        Object.keys(cnt).forEach(function (id) { notify(id, 'Вам назначено номеров на сегодня: ' + cnt[id], '', null); });
        return ok({ ok: true, n: Object.keys(cnt).length });
      }
      if (n === 'room_dnd') {
        if (!canHk(e)) return no('Нет прав');
        var rr = room(String(a.p_no)); if (!rr) return no('Номер не найден');
        if (a.p_on === true || a.p_on === false) { rr.dnd_at = a.p_on ? iso(t) : null; log(rr.no, a.p_on ? 'dnd_on' : 'dnd_off', null, null, e.id, t); }
        if (a.p_after != null) { rr.svc_after = a.p_after || null; rr.svc_day = a.p_after ? dOf(t) : null; log(rr.no, 'svc_after', null, null, e.id, t, null, a.p_after || null); }
        return ok({ ok: true });
      }
    };
    return c;
  };
})();
