/* Mir Luxe One — мок пакета w12-discrep (волна 12): сверка факта проживания с Fidelio (расхождения ХК).
   Горничная в 10:00 и 16:00 (prefs.occ_times) отмечает факт в своих номерах: occ — занят, vac — пуст, lug — багаж без гостя, dnd — не открыли (НБ).
   Статус Fidelio снимается сервером в момент отметки (fid_occ, fid_guests) из броней «inhouse» — горничная его не видит (слепая проверка).
   Таблицы: room_occupancy_checks, discrepancy_resolutions. RPC: occ_day (чтение дня; горничной без Fidelio), occ_mark, occ_resolve. Статусы уборки (pms_rooms.hk) не трогаются, задачи не создаются.
   Подключается после mock-ops-rooms.js / mock-w7-rooms.js (нужно распределение hk_assign на сегодня). */
(function () {
  var DB = window.__DB; if (!DB || !DB.pms_rooms) return;
  var TZ = 'Asia/Tashkent';
  function dOf(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms)); }
  function hmNow() { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
  function at(day, t, plusMin) { return new Date(Date.parse(day + 'T' + t + ':00+05:00') + (plusMin || 0) * 6e4).toISOString(); }
  var T = dOf(Date.now());
  DB.room_occupancy_checks = DB.room_occupancy_checks || [];
  DB.discrepancy_resolutions = DB.discrepancy_resolutions || [];
  function times() { var p = (DB.hotel_settings && DB.hotel_settings[0] && DB.hotel_settings[0].prefs) || {}; return (p.occ_times && p.occ_times.length ? p.occ_times : ['10:00', '16:00']).slice().sort(); }
  function fid(no) { // «Fidelio»: проживающие брони номера сейчас
    var g = 0, n = 0, id = null;
    (DB.pms_bookings || []).forEach(function (b) { if (b.status === 'inhouse' && String(b.room_no) === String(no)) { n++; g += (b.adults || 0) + (b.children || 0); id = id || b.id; } });
    return { occ: n > 0, guests: n ? g : 0, booking: id == null ? null : String(id) };  // на сервере fid_booking_id — text
  }
  function live(no) { var r = DB.pms_rooms.filter(function (x) { return x.no === no; })[0]; return r && r.hk !== 'ooo'; }
  var cid = 0, rid = 0;
  DB.room_occupancy_checks.forEach(function (x) { if (x.id > cid) cid = x.id; });
  DB.discrepancy_resolutions.forEach(function (x) { if (x.id > rid) rid = x.id; });
  function kindOf(c) {
    if (!c || c.fact === 'dnd') return null;
    if (c.fact === 'vac' && c.fid_occ) return 'skipper';
    if ((c.fact === 'occ' || c.fact === 'lug') && !c.fid_occ) return 'sleeper';
    if (c.fact === 'occ' && c.fid_occ && c.guests && c.guests > c.fid_guests) return 'extra';
    return null;
  }

  if (!DB.__w12DiscrepSeed) {
    DB.__w12DiscrepSeed = true;
    var R = times(), now = hmNow(), cur = R.filter(function (t) { return t <= now; }).pop() || R[0];
    var asg = (DB.hk_assign || []).filter(function (a) { return a.day === T && live(a.room_no); }).sort(function (a, b) { return a.room_no > b.room_no ? 1 : -1; });
    var plant = {};
    plant[R[0]] = { '505': ['vac'], '602': ['occ', 1], '607': ['occ', '+1'], '509': ['dnd'], '304': ['lug'] };
    if (R[1]) plant[R[1]] = { '610': ['vac'], '509': ['dnd'] };
    R.forEach(function (t, ri) {
      if (t > cur) return;                                  // будущие сверки не заполняем
      var isCur = t === cur, k = 0;
      asg.forEach(function (a) {
        if (isCur && ri > 0 && a.emp_id === 'e14') return;  // 16:00 — Барно ещё не отметила свои номера
        if (isCur && ri === 0 && a.emp_id === 'e14' && a.room_no > '306') return; // 10:00 идёт — у Барно отмечена половина
        var f = fid(a.room_no), p = (plant[t] || {})[a.room_no], fact = f.occ ? 'occ' : 'vac', g = null;
        if (p) { fact = p[0]; if (p[1] === '+1') g = f.guests + 1; else if (p[1]) g = p[1]; }
        var mm = (a.emp_id === 'e14' ? 2 : a.emp_id === 'e15' ? 4 : 6) + (k++ % 12) * 2;
        var stamp = at(T, t, mm); if (Date.parse(stamp) > Date.now()) stamp = new Date(Date.now() - (40 - (k % 30)) * 6e4).toISOString();
        DB.room_occupancy_checks.push({ id: ++cid, day: T, round: t, room_no: a.room_no, fact: fact, guests: g, fid_occ: f.occ, fid_guests: f.guests, fid_booking_id: f.booking, emp_id: a.emp_id, at: stamp });
      });
    });
    // ресепшен уже разобрал skipper 505 утренней сверки
    if (DB.room_occupancy_checks.some(function (c) { return c.round === R[0] && c.room_no === '505'; }))
      DB.discrepancy_resolutions.push({ id: ++rid, day: T, round: R[0], room_no: '505', kind: 'skipper', verdict: 'fid_error', comment: 'Гость выехал в 08:40, выезд в Fidelio закрыли после сверки', by_emp: 'e8', at: at(T, R[0], 38) });
  }

  // ---- RPC пакета ----
  var sess = null;
  function me() { return sess && DB.employees.filter(function (e) { return e.user_id === sess.user.id; })[0]; }
  function posN(e) { var p = DB.positions.filter(function (x) { return x.id === e.position_id; })[0]; return p ? p.name : ''; }
  function inD(e, d) { return e.dept_id === d || e.lead_dept === d; }
  function hkLead(e) { return inD(e, 'hk') && (e.role === 'manager' || /супервайз|старш|менедж/i.test(posN(e))); }
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function no(m) { return Promise.resolve({ data: null, error: { message: m } }); }
  function dropRes(day, round, rn) { DB.discrepancy_resolutions = DB.discrepancy_resolutions.filter(function (x) { return !(x.day === day && x.round === round && x.room_no === rn); }); }
  var orig = window.supabase && window.supabase.createClient; if (!orig) return;
  window.supabase.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w12Discrep) return c; c.__w12Discrep = true;
    try { c.auth.onAuthStateChange(function (ev, s) { sess = s; }); } catch (e) {}
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (n !== 'occ_mark' && n !== 'occ_resolve' && n !== 'occ_day') return rpc0.apply(c, arguments);
      a = a || {}; var e = me(); if (!e) return no('Нет прав');
      var full = e.role === 'director' || hkLead(e) || inD(e, 'fo');
      function blind(x) { var y = JSON.parse(JSON.stringify(x)); delete y.fid_occ; delete y.fid_guests; delete y.fid_booking_id; delete y.kind; return y; }
      if (n === 'occ_day') { // весь день одним вызовом; горничной — только свои отметки и без Fidelio (слепая проверка)
        var dd = a.p_day || T, cks = DB.room_occupancy_checks.filter(function (x) { return x.day === dd; });
        if (full) return ok({ times: times(), checks: cks.map(function (x) { return Object.assign(JSON.parse(JSON.stringify(x)), { kind: kindOf(x) }); }),
          resolutions: JSON.parse(JSON.stringify(DB.discrepancy_resolutions.filter(function (x) { return x.day === dd; }))) });
        return ok({ times: times(), checks: cks.filter(function (x) { return x.emp_id === e.id; }).map(blind), resolutions: [] });
      }
      var day = a.p_day || T, round = String(a.p_round || ''), rn = String(a.p_no || '');
      if (times().indexOf(round) < 0) return no('Нет такой сверки');
      if (n === 'occ_mark') {
        if (day !== T) return no('Отмечать можно только сегодня');
        var mine = (DB.hk_assign || []).some(function (x) { return x.day === day && x.room_no === rn && x.emp_id === e.id; });
        if (!(mine || e.role === 'director' || hkLead(e))) return no('Нет прав');
        if (['occ', 'vac', 'lug', 'dnd', null].indexOf(a.p_fact == null ? null : a.p_fact) < 0) return no('Неверный факт');
        var ex = DB.room_occupancy_checks.filter(function (x) { return x.day === day && x.round === round && x.room_no === rn; })[0];
        if (a.p_fact == null) { DB.room_occupancy_checks = DB.room_occupancy_checks.filter(function (x) { return x !== ex; }); dropRes(day, round, rn); return ok({ ok: true, removed: true }); }
        var f = fid(rn), g = a.p_fact === 'occ' && a.p_guests ? Math.max(1, Math.min(9, +a.p_guests)) : null;
        var row = { day: day, round: round, room_no: rn, fact: a.p_fact, guests: g, fid_occ: f.occ, fid_guests: f.guests, fid_booking_id: f.booking, emp_id: e.id, at: new Date().toISOString() };
        var oldK = ex ? kindOf(ex) : null;
        if (ex) Object.assign(ex, row); else { row.id = ++cid; DB.room_occupancy_checks.push(row); ex = row; }
        if (oldK !== kindOf(ex)) dropRes(day, round, rn);   // тип расхождения изменился — устаревший итог ресепшена удаляется (как на сервере)
        var out = Object.assign(JSON.parse(JSON.stringify(ex)), { kind: kindOf(ex) });
        return ok(full ? out : blind(out));
      }
      // occ_resolve — ресепшен (fo) и директор
      if (!(e.role === 'director' || inD(e, 'fo'))) return no('Нет прав');
      var ck = DB.room_occupancy_checks.filter(function (x) { return x.day === day && x.round === round && x.room_no === rn; })[0], kd = kindOf(ck);
      if (!kd) return no('Расхождения нет');
      if (['left_unpaid', 'fid_error', 'guest_here'].indexOf(a.p_verdict) < 0) return no('Выберите итог');
      DB.discrepancy_resolutions = DB.discrepancy_resolutions.filter(function (x) { return !(x.day === day && x.round === round && x.room_no === rn); });
      var rr = { id: ++rid, day: day, round: round, room_no: rn, kind: kd, verdict: a.p_verdict, comment: (a.p_comment || '').trim() || null, by_emp: e.id, at: new Date().toISOString() };
      DB.discrepancy_resolutions.push(rr);
      return ok(JSON.parse(JSON.stringify(rr)));
    };
    return c;
  };
})();
