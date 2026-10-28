/* Mir Luxe One — демо-мок пакета w4-analytics (волна 04, аналитика отеля, круг A).
   Подключается после всех mock-*.js. Даты демо уже сдвинуты на сегодня (demo-mock.js).
   Все данные учебные и детерминированные (без Math.random): одинаковы при каждом открытии. */
(function () {
  var DB = window.__DB; if (!DB || !DB.pms_bookings) return;
  var TZ = 'Asia/Tashkent';
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function addD(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function wd(d) { return (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; }
  function nights(b) { return Math.max(1, Math.round((Date.parse(b.departure) - Date.parse(b.arrival)) / 864e5)); }
  function rnd(n, salt) { var x = Math.sin((+n || 0) * 12.9898 + (salt || 0) * 78.233) * 43758.5453; return x - Math.floor(x); } // 0..1, детерминированно
  function strN(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; }
  function live(b) { return b.status !== 'cancelled' && b.status !== 'noshow'; }

  // ---------- 1. Тарифы, дата создания, отмены, no-show, гражданство, питание ----------
  var BASE = { 'Корпоратив': 1250000, 'Booking.com': 1550000, 'Exely / сайт': 1450000, 'Турагентство': 1100000, 'Walk-in': 1600000, 'Другое': 1400000 };
  var CAT = { SINGL: 0.85, STD: 1, DLX: 1.35, APT: 1.9 };
  var LEAD = { 'Корпоратив': 5, 'Booking.com': 12, 'Exely / сайт': 18, 'Турагентство': 35, 'Walk-in': 0, 'Другое': 20 };
  var CXL = { 'Booking.com': 0.15, 'Корпоратив': 0.04, 'Walk-in': 0 };
  var CTRY = [['UZ', 35], ['RU', 22], ['KZ', 8], ['CN', 7], ['TR', 6], ['KR', 4], ['DE', 3], ['IN', 3], ['AE', 2], ['TJ', 4], ['KG', 3], ['GB', 3]];
  var ctot = CTRY.reduce(function (s, x) { return s + x[1]; }, 0);
  var ev = DB.city_events || [];
  var mix = 0; DB.pms_bookings.forEach(function (b) { mix += CAT[b.room_type] || 1; }); mix = mix / Math.max(1, DB.pms_bookings.length) || 1; // база канала = средний тариф канала
  var grp = {}; DB.pms_bookings.forEach(function (b) { if (b.company) { var k = b.company + '|' + b.arrival; grp[k] = (grp[k] || 0) + 1; } });
  var extra = [];
  if (!DB.pms_bookings.__w4an) DB.pms_bookings.forEach(function (b) {
    var id = +b.id || strN(b.id), src = b.source || 'Другое';
    var isGrp = b.company && grp[b.company + '|' + b.arrival] >= 5;
    var inEv = ev.some(function (e) { return b.arrival >= e.d_from && b.arrival <= e.d_to; });
    var r = (BASE[src] || 1400000) * (CAT[b.room_type] || 1) / mix * (inEv ? 1.15 : 1) * (isGrp ? 0.92 : 1) * (0.95 + 0.1 * rnd(id, 1));
    b.rate = Math.round(r / 10000) * 10000;
    var lead = isGrp ? 45 : (LEAD[src] != null ? LEAD[src] : 20);
    var ld = Math.round(lead * (0.4 + 1.2 * rnd(id, 2)));
    var cr = addD(b.arrival, -ld); if (cr > T) cr = addD(T, -Math.round(Math.min(75, Math.max(2, (Date.parse(b.arrival) - Date.parse(T)) / 864e5 * 0.8 + 10)) * rnd(id, 3)));
    if (cr > b.arrival) cr = b.arrival;
    b.created_at = b.created_at || cr + 'T' + ('0' + (9 + Math.floor(9 * rnd(id, 4)))).slice(-2) + ':' + ('0' + Math.floor(60 * rnd(id, 5))).slice(-2) + ':00+05:00';
    if (!b.country) { var c = rnd(id, 6) * ctot, acc = 0; for (var i = 0; i < CTRY.length; i++) { acc += CTRY[i][1]; if (c < acc) { b.country = CTRY[i][0]; break; } } }
    if (!b.meal) { var m = rnd(id, 7); b.meal = m < 0.85 ? 'BB' : m < 0.95 ? 'HB' : 'RO'; }
    // отмены и no-show — отдельными записями-копиями (история загрузки не меняется)
    var near = b.arrival >= addD(T, -1) && b.arrival <= addD(T, 1);
    if (b.status === 'inhouse' || near) return;
    var p = CXL[src] != null ? CXL[src] : 0.08;
    if (rnd(id, 8) < p) {
      var span = Math.max(1, Math.round((Date.parse(b.arrival) - Date.parse(cr)) / 864e5)), ca = addD(cr, Math.floor(span * (0.3 + 0.6 * rnd(id, 9))));
      if (ca > T) ca = T;
      extra.push(Object.assign({}, b, { id: 90000 + id, status: 'cancelled', room_no: null, cancelled_at: ca + 'T12:00:00+05:00', status_note: null }));
    } else if (b.status === 'out' && src !== 'Walk-in' && rnd(id, 10) < 0.022) extra.push(Object.assign({}, b, { id: 95000 + id, status: 'noshow', room_no: null }));
  });
  if (extra.length) DB.pms_bookings.push.apply(DB.pms_bookings, extra);
  DB.pms_bookings.__w4an = true;

  // ---------- 4. Номера на ремонте: ровно 2 (не 214/418, не занятые проживающими) ----------
  var rooms = DB.pms_rooms || [];
  var busy = {}; DB.pms_bookings.forEach(function (b) { if (b.status === 'inhouse' && b.room_no) busy[b.room_no] = 1; if (b.room_no && b.arrival >= T && b.arrival <= addD(T, 3)) busy[b.room_no] = 1; });
  var ooo = rooms.filter(function (r) { return r.hk === 'ooo'; });
  for (var ri = rooms.length - 1; ri >= 0 && ooo.length < 2; ri--) {
    var rm = rooms[ri];
    if (rm.hk === 'ooo' || busy[rm.no] || rm.no === '214' || rm.no === '418' || rm.floor < 3) continue;
    rm.hk = 'ooo'; rm.hk_note = rm.hk_note || 'Замена кондиционера (учебный пример)'; ooo.push(rm);
  }
  var OOO = rooms.filter(function (r) { return r.hk === 'ooo'; }).length, ROOMS = rooms.length || 88;

  // ---------- 2. fid_days (ночной аудит) за 430 дней до вчера ----------
  var minArr = DB.pms_bookings.reduce(function (m, b) { return b.arrival < m ? b.arrival : m; }, '9999');
  var fromBk = addD(minArr, 14); // раньше брони в демо неполные — там синтетика с сезонностью
  var SEAS = [45, 52, 64, 70, 72, 58, 55, 57, 63, 63, 61, 55];          // загрузка % по месяцам
  var SADR = [0.92, 0.95, 1.0, 1.04, 1.06, 0.97, 0.95, 0.96, 1.03, 1.06, 1.02, 0.97]; // ADR к среднему
  var WDK = [3, 4, 4, 3, -3, -8, -4];                                   // деловой отель: будни выше
  function bkDay(d) {
    var s = 0, rev = 0;
    for (var i = 0; i < DB.pms_bookings.length; i++) { var b = DB.pms_bookings[i]; if (live(b) && b.arrival <= d && b.departure > d) { s++; rev += +b.rate || 0; } }
    return { sold: s, rev: rev };
  }
  if (!DB.fid_days || !DB.fid_days.length) {
    var out = [];
    for (var k = 430; k >= 1; k--) {
      var d = addD(T, -k), n = strN(d), o = k <= 12 ? OOO : Math.floor(3 * rnd(n, 11)), cap = ROOMS - o, sold, rr;
      if (d >= fromBk) { var x = bkDay(d); sold = Math.min(cap, x.sold); rr = x.sold ? Math.round(x.rev * sold / x.sold) : 0; }
      else {
        var mo = +d.slice(5, 7) - 1, occ = SEAS[mo] + WDK[wd(d)] + (rnd(n, 12) - 0.5) * 10;
        sold = Math.max(10, Math.min(cap, Math.round(cap * occ / 100)));
        var adr = 1300000 * SADR[mo] * 0.93 * (0.97 + 0.06 * rnd(n, 13)); // год назад тарифы ~7% ниже
        rr = Math.round(sold * adr / 1000) * 1000;
      }
      var tot = Math.round(rr * (1.15 + 0.06 * rnd(n, 14)) / 1000) * 1000;
      out.push({ d: d, day: d, rooms: ROOMS, ooo: o, sold: sold, rooms_sold: sold, occ_pct: cap ? Math.round(sold / cap * 100) : 0, adr: sold ? Math.round(rr / sold) : 0, room_rev: rr, total_rev: tot });
    }
    DB.fid_days = out;
  }
  // сводка Fidelio «вчера» — из того же ночного аудита
  var y0 = DB.fid_days[DB.fid_days.length - 1];
  if (DB.fidelio_stats && DB.fidelio_stats[0] && y0) {
    var fd = DB.fidelio_stats[0].data = DB.fidelio_stats[0].data || {};
    fd.revenue = { day: y0.d, occ_pct: y0.occ_pct, adr: y0.adr, rooms_rev: y0.room_rev, total_rev: y0.total_rev };
  }

  // ---------- 3. Бюджет (пример, уточнить у директора) ----------
  var hs = (DB.hotel_settings || [])[0];
  if (hs) {
    hs.prefs = hs.prefs || {};
    if (!hs.prefs.budget) {
      var ym = T.slice(0, 7);
      var ymA = function (n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1); };
      var PL = [[-1, 74, 1320000], [0, 72, 1350000], [1, 70, 1380000], [2, 62, 1400000]], bud = {};
      PL.forEach(function (p) { var k2 = ymA(p[0]), dim = new Date(Date.UTC(+k2.slice(0, 4), +k2.slice(5, 7), 0)).getUTCDate(); bud[k2] = { occ: p[1], adr: p[2], rr: Math.round((ROOMS - 1) * dim * p[1] / 100 * p[2] / 1e7) * 1e7 }; });
      hs.prefs.budget = bud; // пример, уточнить у директора
    }
  }

  // ---------- помощники для RPC ----------
  function capOn() { var R = DB.pms_rooms || []; if (!R.length) return ROOMS - OOO; return R.reduce(function (a, r) { return a + (r.hk === 'ooo' ? 0 : r.dorm ? Math.max(1, +r.beds || 1) : 1); }, 0); } /* по текущим номерам; общие номера — по койкам */
  function dayStat(d) { var x = bkDay(d), arr = 0, dep = 0; DB.pms_bookings.forEach(function (b) { if (!live(b)) return; if (b.arrival === d) arr++; if (b.departure === d) dep++; }); var c = capOn(); return { day: d, sold: x.sold, occ: c ? Math.round(x.sold / c * 100) : 0, adr: x.sold ? Math.round(x.rev / x.sold) : 0, rev: x.rev, arr: arr, dep: dep }; }
  function pmsReport(from, to) {
    var days = [], c = capOn(), sold = 0, rev = 0, src = {}, typ = {};
    for (var d = from; d <= to; d = addD(d, 1)) { var s = dayStat(d); days.push({ day: d, occ: s.occ, sold: s.sold, arr: s.arr, dep: s.dep, adr: s.adr }); sold += s.sold; rev += s.rev; }
    DB.pms_bookings.forEach(function (b) {
      if (!live(b) || b.arrival > to || b.departure <= from) return;
      var a = b.arrival > from ? b.arrival : from, z = b.departure <= to ? b.departure : addD(to, 1), n = Math.round((Date.parse(z) - Date.parse(a)) / 864e5); if (n <= 0) return;
      var k = b.company && b.source === 'Турагентство' ? b.company : (b.source || 'Другое');
      src[k] = src[k] || { k: k, n: 0, rev: 0 }; src[k].n += n; src[k].rev += n * (+b.rate || 0);
      var t = b.room_type || '—'; typ[t] = typ[t] || { k: t, n: 0, rev: 0 }; typ[t].n += n; typ[t].rev += n * (+b.rate || 0);
    });
    var capN = c * days.length;
    return { cap: c, total: { occ: capN ? Math.round(sold / capN * 100) : 0, sold: sold, adr: sold ? Math.round(rev / sold) : 0, revpar: capN ? Math.round(rev / capN) : 0, rev: rev },
      days: days, by_source: Object.keys(src).map(function (k) { return src[k]; }).sort(function (a, b) { return b.rev - a.rev; }).slice(0, 12),
      by_type: Object.keys(typ).map(function (k) { var x = typ[k]; return { k: k, n: x.n, adr: x.n ? Math.round(x.rev / x.n) : 0 }; }).sort(function (a, b) { return b.n - a.n; }) };
  }
  function empName(e) { return (e.first_name + ' ' + (e.last_name || '')).trim(); }
  function teamOf(me) {
    var all = DB.employees.filter(function (e) { return e.active !== false && e.role !== 'director'; });
    if (!me || me.role === 'director') return all;
    var ids = {}, ch = true; ids[me.id] = 1;
    while (ch) { ch = false; all.forEach(function (e) { if (!ids[e.id] && ids[e.manager_id]) { ids[e.id] = 1; ch = true; } }); }
    return all.filter(function (e) { return ids[e.id] && e.id !== me.id || (me.lead_dept && e.dept_id === me.lead_dept && e.id !== me.id); });
  }
  var OFF = { v: 1, o: 1 };
  function rating(me, from, to) {
    var end = to < T ? to : T, att = DB.attendance || [], sch = DB.schedule || [], tk = DB.tasks || [], mr = DB.maint_requests || [];
    return teamOf(me).map(function (e) {
      var en = strN(e.id), sh = 0, late = 0, lm = 0, early = 0, noout = 0;
      for (var d = from; d <= end; d = addD(d, 1)) {
        var a = att.filter(function (x) { return x.employee_id === e.id && x.day === d; })[0];
        var s = sch.filter(function (x) { return x.employee_id === e.id && x.day === d; })[0];
        var dn = strN(e.id + d);
        if (a) { sh++; if (a.is_late) { late++; lm += +a.late_min || 0; } if (!a.clock_out && d < T) noout++; continue; }
        if (d === T) continue;
        var works = s ? !OFF[s.kind] : (wd(d) + en) % 7 < 5;
        if (!works) continue;
        if (rnd(dn, 21) < 0.04) continue; // пропуск без отметки
        sh++;
        var lp = 0.03 + 0.12 * rnd(en, 22);
        if (rnd(dn, 23) < lp) { late++; lm += 5 + Math.floor(25 * rnd(dn, 24)); }
        else if (rnd(dn, 25) < 0.03) early++;
        else if (rnd(dn, 26) < 0.02) noout++;
      }
      var my = tk.filter(function (t) { return t.assignee_id === e.id && t.day >= from && t.day <= to; });
      var tasks = my.length, done = my.filter(function (t) { return t.status === 'done' || t.status === 'review'; }).length;
      if (!tasks && sh) { tasks = Math.round(sh * (0.6 + 0.8 * rnd(en, 27))); done = Math.round(tasks * (0.7 + 0.29 * rnd(en, 28))); }
      var ontime = Math.round(done * (0.8 + 0.2 * rnd(en, 29)));
      var disc = sh ? Math.max(0, Math.round(100 * (sh - late - early - noout * 0.5) / sh)) : null;
      var tpct = tasks ? Math.round(100 * (done + ontime) / (2 * tasks)) : null;
      var parts = [disc, tpct].filter(function (v) { return v != null; });
      var md = e.dept_id === 'eng' ? mr.filter(function (m) { return m.assigned_to === e.id && m.status === 'done'; }).length : 0;
      return { id: e.id, name: empName(e), dept_id: e.dept_id, position_id: e.position_id, shifts: sh, late: late, late_min: lm, early: early, noout: noout, disc: disc,
        tasks: tasks, done: done, ontime: ontime, tpct: tpct, maint_done: md, score: parts.length ? Math.round(parts.reduce(function (s, v) { return s + v; }, 0) / parts.length) : null };
    }).sort(function (a, b) { return (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score); });
  }
  function inR(ts, from, to) { if (!ts) return false; var d = String(ts).slice(0, 10); return d >= from && d <= to; }
  function founder(me, from, to) {
    var rt = rating(null, from, to), ev2 = DB.events || [], pr = DB.purchase_requests || [], pay = DB.payments || [], wo = DB.writeoffs || [], mr = DB.maint_requests || [], tk = DB.tasks || [];
    var evIn = ev2.filter(function (e) { return e.day >= from && e.day <= to && e.status !== 'cancelled'; });
    var evNx = ev2.filter(function (e) { return e.day > T && e.day <= addD(T, 30) && e.status !== 'cancelled'; });
    var puIn = pr.filter(function (p) { return inR(p.created_at, from, to); }), byCat = {};
    puIn.forEach(function (p) { if (p.status === 'approved' || p.status === 'done' || p.status === 'delivered') { var c = p.category || 'Прочее'; byCat[c] = (byCat[c] || 0) + (+p.est_cost || 0); } });
    var deals = DB.crm_deals || [], ct = DB.crm_tasks || [], stages = {};
    deals.forEach(function (d) { if (d.stage && d.stage !== 'won' && d.stage !== 'lost') stages[d.stage] = (stages[d.stage] || 0) + 1; });
    var mIn = mr.filter(function (m) { return inR(m.created_at, from, to); }), mDone = mIn.filter(function (m) { return m.status === 'done'; });
    var hrs = mDone.filter(function (m) { return m.done_at; }).map(function (m) { return (Date.parse(m.done_at) - Date.parse(m.created_at)) / 36e5; });
    var probs = {}; (DB.problem_reports || []).filter(function (p) { return inR(p.created_at, from, to); }).forEach(function (p) { var k = p.kind || p.category || 'Другое'; probs[k] = (probs[k] || 0) + 1; });
    var tIn = tk.filter(function (t) { return t.day >= from && t.day <= to; });
    var shifts = rt.reduce(function (s, x) { return s + x.shifts; }, 0), late = rt.reduce(function (s, x) { return s + x.late; }, 0);
    var tN = rt.reduce(function (s, x) { return s + x.tasks; }, 0) || tIn.length, tD = rt.reduce(function (s, x) { return s + x.done; }, 0) || tIn.filter(function (t) { return t.status === 'done'; }).length;
    return {
      from: from, to: to,
      staff: { active: DB.employees.filter(function (e) { return e.active !== false && e.role !== 'director'; }).length, shifts: shifts, late: late },
      tasks: { n: tN, done: tD },
      events: { n: evIn.length, guests: evIn.reduce(function (s, e) { return s + (+e.guests || 0); }, 0), sum: evIn.reduce(function (s, e) { return s + (+e.total || 0); }, 0) },
      events_next: { n: evNx.length, sum: evNx.reduce(function (s, e) { return s + (+e.total || 0); }, 0) },
      crm: { new: deals.filter(function (d) { return inR(d.created_at, from, to); }).length || deals.filter(function (d) { return d.stage === 'new'; }).length,
        moved: deals.filter(function (d) { return inR(d.updated_at || d.stage_at, from, to); }).length || deals.filter(function (d) { return d.stage && d.stage !== 'new'; }).length,
        calls: ct.filter(function (t) { return t.done && inR(t.due, from, to); }).length + (DB.crm_notes || []).filter(function (n) { return inR(n.ts, from, to); }).length, stages: stages },
      purchases: { n: puIn.length, approved: puIn.filter(function (p) { return p.status !== 'new' && p.status !== 'rejected'; }).length, spent: Object.keys(byCat).reduce(function (s, k) { return s + byCat[k]; }, 0), by_cat: byCat },
      payments: { paid: pay.filter(function (p) { return p.status === 'paid' && inR(p.paid_at || p.created_at, from, to); }).reduce(function (s, p) { return s + (+p.amount || 0); }, 0) },
      writeoffs: { n: wo.filter(function (w) { return inR(w.created_at || w.at, from, to); }).length, sum: wo.filter(function (w) { return inR(w.created_at || w.at, from, to); }).reduce(function (s, w) { return s + (+w.sum || +w.amount || 0); }, 0) },
      maint: { n: mIn.length, done: mDone.length, hours: hrs.length ? Math.round(hrs.reduce(function (s, v) { return s + v; }, 0) / hrs.length * 10) / 10 : null },
      problems: probs, rating: rt, pms: pmsReport(from, to < T ? to : T)
    };
  }
  function cash(d) {
    var M = ['card', 'cash', 'transfer', 'online', 'company'], byM = {}, byU = {}, ch = { room: 0, tax: 0, minibar: 0, restaurant: 0 };
    var rec = DB.employees.filter(function (e) { return e.dept_id === 'fo' && e.active !== false; });
    var vp = ((((DB.hotel_settings || [])[0] || {}).prefs) || {}).venue_profile, sv = vp && vp.svc || null, fnbOk = !sv || ['hall', 'bar', 'kitchen'].some(function (x) { return sv.indexOf(x) >= 0; }), barOk = !sv || sv.indexOf('bar') >= 0; /* волна 3 (А7): мини-бар и ресторан — только по службам анкеты */
    DB.pms_bookings.forEach(function (b) {
      if (!live(b)) return;
      if (b.arrival <= d && b.departure > d) { ch.room += +b.rate || 0; ch.tax += 40000; if (barOk && rnd(+b.id, 31) < 0.12) ch.minibar += 35000 + 5000 * Math.floor(10 * rnd(+b.id, 32)); if (fnbOk && rnd(+b.id, 33) < 0.18) ch.restaurant += 90000 + 10000 * Math.floor(20 * rnd(+b.id, 34)); }
      if (b.departure === d && d <= T) {
        var sum = (+b.rate || 0) * nights(b), m = b.source === 'Booking.com' ? 'online' : b.source === 'Корпоратив' ? (rnd(+b.id, 35) < 0.6 ? 'company' : 'transfer') : M[Math.floor(rnd(+b.id, 36) * 2)];
        byM[m] = (byM[m] || 0) + sum;
        var u = rec.length ? rec[Math.floor(rnd(+b.id, 37) * rec.length)].id : null, key = u + '|' + m;
        byU[key] = byU[key] || { emp: u, method: m, sum: 0, n: 0 }; byU[key].sum += sum; byU[key].n++;
      }
    });
    Object.keys(ch).forEach(function (k) { if (!ch[k]) delete ch[k]; });
    return { day: d, by_method: byM, by_user: Object.keys(byU).map(function (k) { return byU[k]; }), charges: ch, voids: rnd(strN(d), 38) < 0.3 ? 1 : 0 };
  }

  // ---------- RPC-обёртка (цепочкой) ----------
  var orig = window.supabase && window.supabase.createClient; if (!orig) return;
  var sess = null;
  window.supabase.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w4an) return c; c.__w4an = true;
    try { c.auth.onAuthStateChange(function (e, s) { sess = s; }); } catch (e) {}
    var rpc0 = c.rpc;
    function me() { var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), u = sess && sess.user && sess.user.id; return DB.employees.filter(function (e) { return u ? e.user_id === u : a && e.login === a[1]; })[0]; }
    function ok(d) { return Promise.resolve({ data: d, error: null }); }
    c.rpc = function (n, a) {
      a = a || {};
      try {
        if (n === 'founder_report') return ok(founder(me(), a.p_from, a.p_to));
        if (n === 'team_rating') return ok(rating(me(), a.p_from, a.p_to));
        if (n === 'pms_report') return ok(pmsReport(a.p_from, a.p_to));
        if (n === 'cash_report') return ok(cash(a.p_day || T));
        if (n === 'mgr_brief') return rpc0.call(c, n, a).then(function (r) {
          try {
            var e = me(), pos = e && DB.positions.filter(function (p) { return p.id === e.position_id; })[0];
            if (r && r.data && e && (e.role === 'director' || (pos && pos.has_pms)) && !r.data.pms) {
              var td = dayStat(T), yd = dayStat(addD(T, -1)), wk = 0, inh = DB.pms_bookings.filter(function (b) { return b.status === 'inhouse'; }).length;
              for (var i = 1; i <= 7; i++) wk += dayStat(addD(T, i)).occ;
              r.data.pms = { today: { occ: td.occ, sold: td.sold, adr: td.adr, arr: td.arr, dep: td.dep, inhouse: inh }, yesterday: { occ: yd.occ, sold: yd.sold }, week: { occ: Math.round(wk / 7) }, occ: td.occ, arr: td.arr, dep: td.dep, inhouse: inh };
            }
          } catch (x) {}
          return r;
        });
      } catch (x) { return Promise.resolve({ data: null, error: { message: String(x && x.message || x) } }); }
      return rpc0.call(c, n, a);
    };
    return c;
  };
})();
