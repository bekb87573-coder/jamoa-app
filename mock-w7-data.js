/* Mir Luxe One — демо-данные пакета w7-onboard-data (волна 07). Подключается ПОСЛЕДНИМ из mock-*.js.
   Только данные в window.__DB (обёрток RPC нет). Все данные учебные и детерминированные (без Math.random),
   время — относительно «сейчас» по Ташкенту, чтобы демо выглядело правдоподобно в любой час.
   Что делает:
   §1 отделы: Ибодуллаев — в «Приёме и размещении», офисная смена 09:00–18:00;
   §2 график: у всех сотрудников есть смены (и на прошлые дни месяца), горничные дня — в графике;
   §3 посещаемость: табель месяца с реальными часами, сегодня отмечены те, у кого смена уже началась;
   §4 номера: одна правда — брони Fidelio → номера броней → доска дня → статусы уборки и распределение;
   §5 только существующие номера в заявках/просьбах, банкет — одна дата, мероприятие Iteca — сегодня;
   §6 свежие срочные уведомления нужным адресатам (сейчас − 3 мин), директору — оплата Booking и овербукинг;
   §7 отчёты дня в Пульте на русском (перевод в i18n), кухня: утренний замер делает утренний повар;
   §8 режим новичка (#ob=1): сотрудник ещё не на смене. */
(function () {
  var DB = window.__DB; if (!DB || !DB.employees || DB.__w7data) return; DB.__w7data = true;
  var TZ = 'Asia/Tashkent', NOW = Date.now(), M = 6e4, H = 36e5;
  function dOf(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms)); }
  var T = dOf(NOW);
  function addD(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function wd(d) { return (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; }
  function dm(d) { return d.slice(8, 10) + '.' + d.slice(5, 7); }
  function d0(d) { return Date.parse(d + 'T00:00:00+05:00'); }
  function iso(ms) { return new Date(ms + 5 * H).toISOString().slice(0, 19) + '+05:00'; }
  function atMin(d, min) { return iso(d0(d) + min * M); }
  var NM = Math.floor((NOW - d0(T)) / M);                       // минут с полуночи (Ташкент)
  function ago(min) { return iso(Math.max(d0(T) + 3 * M, NOW - min * M)); } // «N минут назад», но не раньше начала суток
  function toMin(t) { var p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function hm(min) { min = ((min % 1440) + 1440) % 1440; return p2(Math.floor(min / 60)) + ':' + p2(min % 60); }
  function rnd(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003; var x = Math.sin(h * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function emp(id) { return DB.employees.filter(function (e) { return e.id === id; })[0] || null; }
  function row(tb, id) { return (DB[tb] || []).filter(function (x) { return x.id === id; })[0] || null; }
  function maxId(tb) { var m = 0; (DB[tb] || []).forEach(function (x) { if (typeof x.id === 'number' && x.id > m) m = x.id; }); return m; }
  ['schedule', 'attendance', 'notifications', 'tasks', 'maint_requests', 'guest_requests', 'pms_board', 'hk_assign', 'hk_log', 'daily_reports', 'events', 'upsells', 'shift_handover', 'temp_logs', 'writeoffs', 'purchase_requests', 'payments'].forEach(function (t) { DB[t] = DB[t] || []; });

  try {
    // ---------- §1 отделы ----------
    var e6 = emp('e6');
    if (e6) { e6.dept_id = 'fo'; e6.lead_dept = 'fo'; e6.shift_start = '09:00:00'; e6.shift_end = '18:00:00'; var p6 = (DB.positions || []).filter(function (p) { return p.id === e6.position_id; })[0]; if (p6) p6.dept_id = 'fo'; }

    // ---------- §2 график ----------
    var ST = {}; (DB.shift_types || []).forEach(function (s) { ST[s.dept_id + '|' + s.code] = s; });
    var SCH = {}; DB.schedule.forEach(function (s) { SCH[s.employee_id + '|' + s.day] = s; });
    function setK(id, d, k) { var s = SCH[id + '|' + d]; if (s) { s.kind = k; s.t_start = null; s.t_end = null; } else { s = SCH[id + '|' + d] = { employee_id: id, day: d, kind: k, t_start: null, t_end: null }; DB.schedule.push(s); } }
    var B0 = addD(T, -1), B1 = addD(T, 12);                   // «база» графика: 14 дней вчера…+12 (так в демо)
    // сотрудники без графика: 14-дневный шаблон (5/2 со сдвигом выходных, офис — Пн–Пт)
    var PLAN = { e1: 'office', e3: 'office', e5: 'office', e12: ['u', 'v'], e17: ['u'], e18: ['u'], e19: ['u'], e20: ['u'], e21: ['u'], e22: ['u'], e23: ['u'], e24: ['u'], e25: ['u'], e29: ['u'], e30: ['u', 'v'], e31: ['v', 'u'], e33: ['d'], e36: ['u', 'v'], e40: ['u'], e41: ['u'] };
    var OFFW = { e12: [3, 4], e17: [4, 5], e18: [5, 6], e19: [0, 1], e20: [2, 3], e21: [5, 6], e22: [0, 1], e23: [3, 4], e24: [5, 6], e25: [1, 2], e29: [6, 0], e30: [3, 4], e31: [0, 1], e33: [0, 1], e36: [5, 6], e40: [5, 6], e41: [6] };
    Object.keys(PLAN).forEach(function (id) {
      if (!emp(id)) return;
      for (var d = B0; d <= B1; d = addD(d, 1)) {
        if (SCH[id + '|' + d]) continue;
        var w = wd(d), p = PLAN[id], k;
        if (p === 'office') k = w < 5 ? 'u' : 'o';
        else { var off = OFFW[id] || [5, 6]; k = off.indexOf(w) >= 0 ? 'o' : p[Math.floor((d0(d) - d0(B0)) / (7 * 864e5)) % p.length]; }
        setK(id, d, k);
      }
    });
    // сегодня: Зикрулло — «Утро 2» 08:30–17:30 (он работает днём), Ахмаджон — утро, Мукаддам — утро (её номера и запрос «уйти в 15:00»)
    setK('e8', T, 's830'); setK('e9', T, 'u'); setK('e15', T, 'u');
    // прошлые дни месяца (для табеля): повтор 14-дневного шаблона назад; охрана — «сутки через двое»
    var FROM = addD(T, -40);
    var SEC = { e42: 0, e43: 0, e44: 1 };
    DB.employees.forEach(function (e) {
      if (e.active === false || e.role === 'director') return;
      for (var d = FROM; d < B0; d = addD(d, 1)) {
        if (SCH[e.id + '|' + d]) continue;
        var k;
        if (SEC[e.id] != null) { var df = Math.round((d0(d) - d0(T)) / 864e5); k = ((df - SEC[e.id]) % 3 + 3) % 3 === 0 ? 'u' : 'o'; }
        else { var src = d; while (src < B0) src = addD(src, 14); var s = SCH[e.id + '|' + src]; if (!s) continue; k = s.kind; }
        setK(e.id, d, k);
      }
    });

    // ---------- §3 посещаемость ----------
    function shOf(e, k) {
      if (!k || k === 'o' || k === 'h' || k === 'b') return null;
      var s, en;
      if (k === 'u' && e.shift_start && e.shift_end) { s = e.shift_start; en = e.shift_end; }
      else { var t = ST[e.dept_id + '|' + k]; if (!t) return null; s = t.start_time; en = t.end_time; }
      var a = toMin(s), b = toMin(en); if (b <= a) b += 1440;
      return { a: a, b: b, s: s, e: en };
    }
    var EXPL = ['Пробка на Амира Темура', 'Задержался автобус', 'Отвозил(а) ребёнка в сад', 'Был(а) в поликлинике, справка есть', 'Метро стояло 15 минут'];
    var ABSENT = { e36: 1 };                                   // сегодня не пришёл (для «Не пришли» — один человек, без часов)
    var SPEC = { e14: { i: 8 * 60 + 27 }, e15: { i: 8 * 60 + 41, late: 11, x: 'Отвозила ребёнка в сад' }, e6: { i: 9 * 60 + 22, late: 22, x: 'Пробка на Амира Темура' }, e8: { i: 8 * 60 + 24 }, e43: { i: 7 * 60 + 52 }, e42: { i: 7 * 60 + 50 }, e28: { i: 5 * 60 + 56 } };
    var keepIds = {}; DB.attendance.forEach(function (a) { if (a.day === T) keepIds[a.employee_id] = a.id; });
    DB.attendance = DB.attendance.filter(function (a) { return a.day < FROM; });
    var aid = 200000;
    DB.employees.forEach(function (e) {
      if (e.active === false || e.role === 'director') return;
      for (var d = FROM; d <= T; d = addD(d, 1)) {
        var s = SCH[e.id + '|' + d], sh = s && shOf(e, s.kind); if (!sh) continue;
        var key = e.id + '|' + d, today = d === T, sp = today ? SPEC[e.id] : null;
        if (today && ABSENT[e.id]) continue;
        if (!today && rnd(key + 'm') < 0.015) continue;        // редкий пропуск
        var late = 0, inM;
        if (sp) { inM = sp.i; late = sp.late || 0; }
        else if (rnd(key + 'l') < 0.06) { late = 6 + Math.floor(rnd(key + 'L') * 22); inM = sh.a + late; }
        else inM = sh.a - 2 - Math.floor(rnd(key + 'i') * 13);
        if (today && inM > NM) continue;                          // смена ещё не началась
        var outM = sh.b + 1 + Math.floor(rnd(key + 'o') * 11), early = 0;
        if (!late && rnd(key + 'e') < 0.025) { early = 20 + Math.floor(rnd(key + 'E') * 40); outM = sh.b - early; }
        var outAbs = d0(d) + outM * M, closed = outAbs <= NOW - 2 * M;
        var a = { id: today && keepIds[e.id] ? keepIds[e.id] : ++aid, employee_id: e.id, day: d, clock_in: atMin(d, inM), clock_out: closed ? iso(outAbs) : null,
          is_late: late > 0, late_min: late, shift_start: sh.s, shift_end: sh.e, shift_kind: s.kind, in_device: 'iPhone', face_flag: false };
        if (closed) { a.worked_min = outM - inM; if (early) { a.left_early = true; a.early_min = early; } }
        if (late) { a.explain_text = (sp && sp.x) || EXPL[Math.floor(rnd(key + 'x') * EXPL.length)]; a.explain_at = atMin(d, inM + 6); }
        DB.attendance.push(a);
      }
    });

    // ---------- §4 номера: брони Fidelio → доска дня → уборка ----------
    var ROOMS = DB.pms_rooms || [], RT = {}, OOO = {}, FL = {};
    ROOMS.forEach(function (r) { RT[r.no] = r.type; FL[r.no] = r.floor; if (r.hk === 'ooo') OOO[r.no] = 1; });
    var SELL = ROOMS.filter(function (r) { return !OOO[r.no]; }).map(function (r) { return r.no; }).sort();
    function live(b) { return b.status !== 'cancelled' && b.status !== 'noshow'; }
    var W0 = addD(T, -21);
    var BK = (DB.pms_bookings || []).filter(function (b) { return live(b) && b.departure > W0 && b.arrival < b.departure; });
    BK.sort(function (x, y) { return x.arrival < y.arrival ? -1 : x.arrival > y.arrival ? 1 : (x.departure < y.departure ? -1 : x.departure > y.departure ? 1 : x.id - y.id); });
    var occ = {}, ORIG = {};
    function free(no, b) { var L = occ[no] || []; for (var i = 0; i < L.length; i++) if (L[i][0] < b.departure && L[i][1] > b.arrival) return false; return true; }
    function put(no, b) { b.room_no = no; (occ[no] = occ[no] || []).push([b.arrival, b.departure]); }
    BK.forEach(function (b) { ORIG[b.id] = b.room_no; b.room_no = null; });
    var arrP = BK.filter(function (b) { return b.arrival === T; }), depP = BK.filter(function (b) { return b.departure === T; }), stayP = BK.filter(function (b) { return b.arrival < T && b.departure > T; });
    function pick(pool, no) { var c = pool.filter(function (b) { return !b.room_no; }), m = c.filter(function (b) { return b.room_type === RT[no]; }); var b = (m.length ? m : c)[0]; if (b) { b.room_type = RT[no]; put(no, b); } return b; }
    // номера, на которых держится учебный сюжет дня (задачи, просьбы, уборка Барно, VIP 305)
    var PIN = { turn: ['305', '601'], arr: ['303', '311', '502', '610', '702'],
      dep: ['302', '306', '308', '309', '402', '412', '507', '604', '703', '710', '805'],
      stay: ['204', '207', '304', '307', '310', '315', '405', '406', '408', '410', '503', '505', '509', '611'] };
    PIN.turn.forEach(function (no) { if (OOO[no]) return; pick(depP, no); pick(arrP, no); });
    PIN.dep.forEach(function (no) { if (!OOO[no]) pick(depP, no); });
    PIN.arr.forEach(function (no) { if (!OOO[no]) pick(arrP, no); });
    PIN.stay.forEach(function (no) { if (!OOO[no]) pick(stayP, no); });
    var depToday = {}; BK.forEach(function (b) { if (b.room_no && b.departure === T) depToday[b.room_no] = 1; });
    BK.forEach(function (b) {
      if (b.room_no) return;
      var o = ORIG[b.id], cand = SELL.filter(function (no) { return free(no, b); });
      var same = cand.filter(function (no) { return RT[no] === b.room_type; });
      if (b.arrival === T) {                                   // заезд сегодня: сначала свободные со вчера номера (своего типа, потом апгрейд), «выезд+заезд» — в крайнем случае
        var nd = function (L) { return L.filter(function (no) { return !depToday[no]; }); };
        same = nd(same).length ? nd(same) : nd(cand).length ? nd(cand) : same;
      }
      var pool = same.length ? same : cand;
      if (!pool.length) { if (b.departure <= T && o) b.room_no = o; return; }   // прошлое — оставить как было; будущее — «без номера» (овербукинг)
      if (o && pool.indexOf(o) >= 0) { put(o, b); if (b.departure === T) depToday[o] = 1; return; }
      pool = pool.slice().sort(function (x, y) { return rnd(x + b.id) - rnd(y + b.id); });
      if (RT[pool[0]] !== b.room_type && b.arrival >= T) b.room_type = RT[pool[0]];
      put(pool[0], b); if (b.departure === T) depToday[pool[0]] = 1;
    });
    // кто уже заехал / выехал к текущему часу
    var DEP = {}, ARR = {}, STAY = {};
    BK.forEach(function (b) { if (!b.room_no) return; if (b.departure === T) DEP[b.room_no] = b; if (b.arrival === T) ARR[b.room_no] = b; if (b.arrival < T && b.departure > T) STAY[b.room_no] = b; });
    var arrNos = Object.keys(ARR).sort(function (x, y) { return rnd(x + 'eta') - rnd(y + 'eta'); });
    var ETA = {}; arrNos.forEach(function (no, i) { ETA[no] = 12 * 60 + Math.round(i * 540 / Math.max(1, arrNos.length - 1) / 15) * 15; });
    ETA['305'] = 17 * 60; if (ARR['601']) ETA['601'] = 18 * 60 + 30;
    var ETD = {}; Object.keys(DEP).forEach(function (no) { ETD[no] = 7 * 60 + Math.floor(rnd(no + 'etd') * 20) * 15; }); ETD['412'] = 14 * 60;
    Object.keys(ARR).forEach(function (no) { var b = ARR[no]; b.status = !DEP[no] && ETA[no] <= NM - 20 ? 'inhouse' : 'confirmed'; b.eta = hm(ETA[no]); });
    Object.keys(DEP).forEach(function (no) { DEP[no].status = ETD[no] <= NM ? 'out' : 'inhouse'; });
    if (ARR['305']) { ARR['305'].vip = true; ARR['305'].status_note = 'VIP · заезд ' + hm(ETA['305']); }
    // доска дня = брони (одна правда для «Номеров», главной, Пульса и Fidelio)
    DB.pms_board = DB.pms_board.filter(function (x) { return x.day !== T; });
    var bid = maxId('pms_board');
    SELL.forEach(function (no) {
      var k = DEP[no] && ARR[no] ? 'turn' : DEP[no] ? 'dep' : ARR[no] ? 'arr' : STAY[no] ? 'stay' : null; if (!k) return;
      var g = ARR[no] || STAY[no] || DEP[no];
      DB.pms_board.push({ id: ++bid, day: T, room_no: no, room_type: RT[no], kind: k, adults: k === 'dep' ? null : (g.adults || 1), children: g.children || 0, source: 'fidelio',
        eta: ARR[no] ? hm(ETA[no]) : null, etd: DEP[no] ? hm(ETD[no]) : null, vip: no === '305' && !!ARR[no] || null });
    });
    arrP.concat(depP).forEach(function (b) { if (!b.room_no) DB.pms_board.push({ id: ++bid, day: T, room_no: null, room_type: b.room_type, kind: b.arrival === T ? 'arr' : 'dep', adults: b.adults || 1, children: 0, source: 'fidelio' }); });
    if (DB.pms_sync && DB.pms_sync[0]) DB.pms_sync[0].synced_at = atMin(T, Math.max(8 * 60, Math.min(NM - 20, 13 * 60 + 10)));

    // распределение: этаж → горничная дня; 8-й этаж ждёт распределения (~10 номеров)
    var MAID = { 2: 'e14', 3: 'e14', 4: 'e17', 5: 'e15', 6: 'e16', 7: 'e18' };
    function maidOf(no) { var f = FL[no]; if (f === 2) return +no.slice(1) <= 4 ? 'e14' : 'e17'; return MAID[f] || null; }
    DB.hk_assign = DB.hk_assign.filter(function (a) { return a.day !== T; });
    SELL.forEach(function (no) { var m = maidOf(no); if (m) DB.hk_assign.push({ day: T, room_no: no, emp_id: m, by_emp: 'e13', at: atMin(T, 8 * 60 + 40) }); });

    // статусы уборки к текущему часу: ~15–20 грязных в 15:30, заезды частично готовы
    var SEED = { '304': 1, '305': 1, '306': 1, '307': 1, '308': 1, '503': 1 };   // сюжет ops-rooms — не трогаем
    var lseq = maxId('hk_log');
    function log(no, act, from, to, by, ms, photos, note) { DB.hk_log.push({ id: ++lseq, room_no: no, day: T, act: act, hk_from: from || null, hk_to: to || null, by_emp: by || null, at: iso(ms), photos: photos || null, note: note || null }); }
    function clr(r) { ['cleaned_by', 'cleaned_at', 'clean_photos', 'inspected_by', 'inspected_at', 'returned_reason', 'returned_by', 'returned_at'].forEach(function (k) { r[k] = null; }); }
    function setHk(r, k, base) {
      var maid = maidOf(r.no) || 'e14', back = Math.max(d0(T) + 8 * 60 * M, Math.min(NOW - 8 * M, base));
      clr(r); r.hk = k;
      if (k === 'dirty') { r.hk_by = null; r.hk_at = null; return; }
      if (k === 'cleaning') { r.hk_by = maid; r.hk_at = iso(back); log(r.no, 'status', 'dirty', 'cleaning', maid, back); return; }
      var ph = [maid + '/room-' + r.no + '-1.jpg'];
      r.cleaned_by = maid; r.cleaned_at = iso(back); r.clean_photos = ph; r.hk_by = maid; r.hk_at = r.cleaned_at;
      log(r.no, 'clean', 'cleaning', 'clean', maid, back, ph);
      if (k === 'inspected') { var ib = Math.min(NOW - 3 * M, back + 25 * M); r.inspected_by = 'e13'; r.inspected_at = iso(ib); r.hk_by = 'e13'; r.hk_at = r.inspected_at; log(r.no, 'inspect', 'clean', 'inspected', 'e13', ib); }
    }
    function clamp(x) { return Math.max(0, Math.min(1, x)); }
    var fDep = clamp((NM - 11 * 60) / 300), fStay = clamp((NM - 9 * 60) / 420);
    ROOMS.forEach(function (r) {
      if (OOO[r.no] || SEED[r.no]) return;
      var no = r.no, x = rnd(no + T + 'hk'), k;
      delete r.dnd_at;
      if (DEP[no] || ARR[no] && DEP[no]) {
        if (DEP[no].status === 'inhouse') k = 'dirty';
        else if (no === '309' || no === '412' || no === '507' || no === '302') k = 'dirty';
        else if (no === '601') k = 'cleaning';
        else { var fd = Math.max(0.12, 1 - fDep * 0.9); k = x < fd ? 'dirty' : x < fd + 0.1 ? 'cleaning' : x < fd + 0.16 ? 'clean' : 'inspected'; }
        setHk(r, k, NOW - (20 + Math.floor(rnd(no + 'm') * 120)) * M);
      } else if (ARR[no]) {
        setHk(r, no === '502' ? 'clean' : 'inspected', no === '502' ? NOW - 30 * M : d0(T) + 9 * 60 * M + Math.floor(rnd(no) * 180) * M);
      } else if (STAY[no]) {
        if (no === '410' || no === '509' || no === '310') k = 'dirty';
        else if (no === '204' || no === '406' || no === '611' || no === '408') k = 'inspected';
        else { var fs = Math.max(0.15, 1 - fStay * 0.85); k = x < fs ? 'dirty' : x < fs + 0.07 ? 'cleaning' : x < fs + 0.12 ? 'clean' : 'inspected'; }
        setHk(r, k, NOW - (15 + Math.floor(rnd(no + 'm') * 200)) * M);
      } else {
        // свободный номер — убран и проверен вчера
        clr(r); r.hk = 'inspected'; r.inspected_by = 'e13'; r.inspected_at = atMin(addD(T, -1), 16 * 60 + Math.floor(rnd(no) * 90)); r.hk_by = 'e13'; r.hk_at = r.inspected_at;
      }
    });
    // «Не беспокоить»: долгий НБ — у живущего 410 (412 сегодня выехал с поздним выездом)
    var r412 = ROOMS.filter(function (r) { return r.no === '412'; })[0], r410 = ROOMS.filter(function (r) { return r.no === '410'; })[0], r509 = ROOMS.filter(function (r) { return r.no === '509'; })[0];
    if (r412) delete r412.dnd_at;
    if (r410) r410.dnd_at = iso(NOW - 26 * H);
    if (r509) r509.dnd_at = ago(50);
    DB.hk_log.forEach(function (l) { if (l.room_no === '412' && l.act === 'dnd_on') l.room_no = '410'; });

    // ---------- §5 только существующие номера; банкет и мероприятия ----------
    var BQ = addD(T, 2);                                      // банкет «Анор» — одна дата везде
    function mr(id, o) { var x = row('maint_requests', id); if (x) Object.assign(x, o); return x; }
    mr(301, { room_no: '204', status: 'work', assigned_to: 'e38', taken_at: atMin(T, 9 * 60 + 5), created_at: atMin(T, 8 * 60 + 51) });
    mr(302, { room_no: '408' });
    mr(7704, { room_no: '406' });
    if (!row('maint_requests', 306)) DB.maint_requests.push({ id: 306, room_no: '611', place: null, text: 'Нет горячей воды в душе, гость ждёт', urgent: true, status: 'new', created_by: 'e8', created_at: ago(5), assigned_to: null, photo_path: null });
    function gr(id, o) { var x = row('guest_requests', id); if (x) Object.assign(x, o); return x; }
    gr(401, { created_at: ago(18) });
    gr(402, { room_no: '505', text: 'Такси в аэропорт на ' + hm(Math.min(22 * 60, Math.max(NM + 75, 12 * 60)) - (Math.min(22 * 60, Math.max(NM + 75, 12 * 60)) % 30)), created_at: ago(8), due_at: null, lang: 'en' });
    gr(403, { room_no: '207', text: 'Чай и десерт в номер', created_at: ago(9) });
    gr(405, { room_no: '315', created_at: ago(30), taken_at: ago(25) });
    gr(7703, { room_no: '310', created_at: ago(50), taken_at: ago(44) });
    var pr802 = row('purchase_requests', 802); if (pr802) pr802.items = 'Смеситель для ванной Grohe — 1 шт (номер 204, течёт кран)';
    var pr803 = row('purchase_requests', 803); if (pr803) pr803.items = 'Говядина 25 кг, курица 30 кг, сливки 10 л — банкет ' + dm(BQ) + ' на 120 гостей';
    var t901 = row('tasks', 901); if (t901) { t901.title = 'Проверить номер 305 перед заездом VIP — гость в ' + hm(ETA['305'] || 1020); t901.due_time = hm((ETA['305'] || 1020) - 30) + ':00'; }
    var t913 = row('tasks', 913); if (t913) t913.title = 'Согласовать меню банкета ' + dm(BQ) + ' на 120 гостей';
    var t914 = row('tasks', 914); if (t914) t914.day = BQ;
    var t7702 = row('tasks', 7702); if (t7702) t7702.title = 'Уборка 309 после выезда — фото готового номера';
    var ho = row('shift_handover', 7706); if (ho) ho.notes = 'Такси для 402 в 15:00 заказано';
    var u1 = row('upsells', 9001); if (u1) u1.room_no = '412';   // поздний выезд продан 412, а не VIP-номеру 305
    var u2 = row('upsells', 9002); if (u2) u2.room_no = '610';
    var ev1 = row('events', 'e1'); if (ev1) { ev1.day = T; ev1.status = 'confirmed'; }
    var ev2 = row('events', 'e2'); if (ev2) Object.assign(ev2, { day: BQ, status: 'confirmed', time_text: '18:00–23:00', manager_id: 'e4', manager_name: 'Сирож' });
    var t900 = row('tasks', 900); if (t900 && t900.day < T) t900.status = 'done';            // вчерашняя проверка 305 закрыта
    var t908 = row('tasks', 908); if (t908 && NM > 9 * 60) t908.status = 'work';           // генеральную уборку 507 Барно уже взяла
    // утренние задачи по шаблону у тех, кто на смене, к этому часу уже сделаны (иначе в 15:30 «просрочено · к 08:00»)
    var onT = {}; DB.attendance.forEach(function (a) { if (a.day === T) onT[a.employee_id] = 1; });
    var tid = Math.max(maxId('tasks'), 60000);
    (DB.task_templates || []).forEach(function (t) {
      if (!t.active || !t.due_time || toMin(t.due_time) > NM - 30) return;
      DB.employees.forEach(function (e) {
        if (e.active === false || !onT[e.id] || !(e.id === t.employee_id || (!t.employee_id && e.position_id === t.position_id))) return;
        if (DB.tasks.some(function (x) { return x.template_id === t.id && x.assignee_id === e.id && x.day === T; })) return;
        DB.tasks.push({ id: ++tid, title: t.title, assignee_id: e.id, day: T, due_time: t.due_time, needs_photo: t.needs_photo, template_id: t.id, status: 'done', created_by: null, photo_path: t.needs_photo ? e.id + '/task-' + t.id + '.jpg' : null });
      });
    });
    // новый срочный вызов охране — задача от ресепшена
    if (!row('tasks', 930)) DB.tasks.push({ id: 930, title: 'Шум в коридоре 4 этажа — проверить (жалоба гостя 408)', notes: null, assignee_id: 'e43', created_by: 'e8', day: T, due_time: null, status: 'new', urgent: true, needs_photo: false, created_at: ago(4), updated_at: ago(4) });

    // ---------- §6 уведомления ----------
    function nt(id, o) { var x = row('notifications', id); if (x) Object.assign(x, o); return x; }
    function push(o) { if (!row('notifications', o.id)) DB.notifications.push(Object.assign({ read_at: null, urgent: false }, o)); }
    nt(701, { at: ago(3), body: 'Проверить номер 305 перед заездом VIP — гость в ' + hm(ETA['305'] || 1020) + '. Откройте и нажмите «Принял».' });
    nt(702, { at: atMin(T, 8 * 60 + 30), body: 'Смена с 08:30. Отметьте приход в приложении.', read_at: atMin(T, 8 * 60 + 24) });
    nt(703, { employee_id: 'e8', at: ago(3), title: '🛎 Гость ждёт 5 мин: № 505', body: 'такси — ' + (row('guest_requests', 402) || {}).text + '. Нажмите «Беру».' });
    nt(704, { at: ago(13) });
    nt(706, { read_at: atMin(T, 9 * 60 + 5), body: 'Номер 204: Течёт кран в ванной, гость жалуется' });
    nt(707, { read_at: atMin(T, 9 * 60 + 5), body: 'Зикрулло · Номер 204: Течёт кран в ванной, гость жалуется' });
    nt(708, { at: ago(4), title: '🛎 Гость ждёт 5 мин: № 207', body: 'еда / напитки — Чай и десерт в номер. Нажмите «Беру».' });
    nt(709, { body: 'Бекзод: Согласовать меню банкета ' + dm(BQ) + ' на 120 гостей' });
    nt(711, { read_at: atMin(T, 7 * 60 + 52) });
    nt(712, { body: 'Акбаржон: ' + dm(BQ) + ' — вечер 14:00–23:00' });
    nt(719, { body: 'Махмуд · Смеситель для ванной Grohe — 1 шт (номер 204)' });
    push({ id: 731, employee_id: 'e43', at: ago(3), title: 'Срочная задача', body: 'Зикрулло: Шум в коридоре 4 этажа — проверить (жалоба гостя 408)', ref_type: 'task', ref_id: 930, urgent: true });
    push({ id: 732, employee_id: 'e38', at: ago(3), title: '🚨 Срочная заявка инженерам', body: 'Номер 611: Нет горячей воды в душе, гость ждёт', ref_type: 'maint', ref_id: 306, urgent: true });
    push({ id: 733, employee_id: 'e37', at: ago(3), title: '🚨 Срочная заявка инженерам', body: 'Зикрулло · Номер 611: Нет горячей воды в душе, гость ждёт', ref_type: 'maint', ref_id: 306, urgent: true });
    var bk = row('payments', 9102);
    if (bk && bk.status === 'pending' && bk.due_date < T) push({ id: 734, employee_id: 'e0', at: atMin(T, 9 * 60), title: '💳 Просрочена оплата: Booking.com', body: '1 240 USD · комиссия за сентябрь, срок был ' + dm(bk.due_date), ref_type: 'pay', ref_id: 9102 });
    // овербукинг: первая ночь, где продано больше номеров, чем есть
    var cap = SELL.length;
    for (var od = T; od <= addD(T, 30); od = addD(od, 1)) {
      var sold = (DB.pms_bookings || []).filter(function (b) { return live(b) && b.arrival <= od && b.departure > od; }).length;
      if (sold > cap) { push({ id: 735, employee_id: 'e0', at: atMin(T, 13 * 60 + 15), title: '⚠️ Овербукинг ' + dm(od), body: 'Продано ' + sold + ' из ' + cap + ' номеров — закройте продажи на эту дату', ref_type: 'pms', ref_id: null }); break; }
    }

    // ---------- §7 отчёты дня, кухня ----------
    DB.daily_reports = DB.daily_reports.filter(function (x) { return x.day < addD(T, -10); });
    DB.daily_reports.push({ day: addD(T, -1), data: { date: addD(T, -1), director: [
      { dir: 'Утренний обход', what: 'Лобби, ресторан, 3 и 5 этажи — замечаний нет', res: 'OK' },
      { dir: 'Планёрка', what: 'Заезды недели, подготовка к банкету, закупка белья', res: 'OK' }
    ], staff: [
      { dir: 'Хаускипинг', what: 'Убраны все выезды, генеральная уборка 507 перенесена на сегодня', res: 'В работе' },
      { dir: 'Техслужба', what: 'Заменили лампу у лифта, проверили кондиционеры 4 этажа', res: 'OK' },
      { dir: 'Ресепшен', what: 'Поздний выезд 412 согласован, касса сдана без расхождений', res: 'OK' }
    ] } });
    DB.daily_reports.push({ day: T, data: { date: T, director: [
      { dir: 'Утренний обход', what: 'Лобби и ресторан — замечаний нет, на 3 этаже не хватает белья', res: 'Закупка одобрена' },
      { dir: 'Планёрка', what: 'VIP-заезд в 305, мероприятие Iteca, банкет «Анор»', res: 'OK' }
    ], staff: [
      { dir: 'Хаускипинг', what: 'Номер 306 вернули на доработку, остальные в графике', res: 'В работе' },
      { dir: 'Техслужба', what: 'Течёт кран в 204 — ждём смеситель от закупок', res: 'В работе' }
    ] } });
    DB.daily_reports.push({ day: addD(T, -6), data: { date: addD(T, -6), director: [{ dir: 'Ежедневный контроль', what: 'Утром обошли территорию', res: 'OK' }], staff: [] } });
    DB.temp_logs.forEach(function (l) { if (l.seed_fnb && l.by_emp === 'e27') l.by_emp = 'e28'; });       // утром мерит утренний повар
    DB.writeoffs.forEach(function (w) { if (w.seed_fnb && w.by_emp === 'e27') w.by_emp = 'e28'; });

    // ---------- §8 режим новичка: #as=<login>&ob=1 — ещё не отметился на смену ----------
    var h0 = location.hash || '', ob = /(^|[#&])ob=1(&|$)/.test(h0), lg = /as=([a-z0-9._]+)/.exec(h0);
    if (ob && lg) { var me = DB.employees.filter(function (e) { return e.login === lg[1]; })[0]; if (me) DB.attendance = DB.attendance.filter(function (a) { return !(a.employee_id === me.id && a.day === T); }); }
  } catch (err) { try { console.warn('mock-w7-data', err); } catch (x) {} }
})();
