/* Mir Luxe One — мок пакета w9-swap (волна 09): «Срочная замена за 1 минуту».
   Повторяет серверную миграцию 09_support/w9-swap/sql/migration.sql (M47–M50): те же таблицы, RPC, ответы, тексты ошибок и уведомлений.
   Таблицы: shift_swaps (поиск замены), shift_swap_offers (кому предложили: sent | yes | no | closed; ключ swap_id + emp_id).
   RPC: swap_candidates, swap_open (открыть + сразу предложить 1–10), swap_offer_more, swap_answer (атомарно: первый «Выйду» встаёт в график),
        swap_cancel (график заболевшего возвращается), swap_brief (+ блок swap в mgr_brief). swap_expire — как cron: при загрузке и в swap_answer.
   Правило «Отпроситься»: если сотрудник уже отметил приход, swap_open его не отпускает — уйти разрешает только директор.
   Передача дел — существующими средствами: номера hk_assign_set (w7-rooms), задачи — update tasks (как в карточке задачи). Новых задач нет.
   Демо: Техслужба — Панжи больничный, замена Элёр (подтверждено утром), у Панжи 2 задачи; Хаускипинг — Нафиса сегодня без отметки.
   Живые изменения сегодняшнего дня сохраняются в localStorage (mlx-w9swap): каждый вход в демо — перезагрузка. В боевую сборку не идёт. */
(function () {
  var DB = window.__DB; if (!DB || !DB.employees) return;
  var TZ = 'Asia/Tashkent', KEY = 'mlx-w9swap', DAY = 864e5;
  function dOf(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms)); }
  function iso(ms) { return new Date(ms).toISOString(); }
  function addD(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function monday(d) { var w = new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay(); return addD(d, -((w + 6) % 7)); }
  function t8(t) { t = String(t || ''); return t.length === 5 ? t + ':00' : t.slice(0, 8); }
  function at(day, t) { return Date.parse(day + 'T' + t8(t) + '+05:00'); }
  var now0 = Date.now(), TD = dOf(now0);
  function E(id) { return DB.employees.filter(function (e) { return e.id === id; })[0]; }
  function meEmp() { var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null; try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {} return DB.employees.filter(function (e) { return a ? e.login === a[1] : s && e.user_id === s.user.id; })[0]; }
  ['shift_swaps', 'shift_swap_offers', 'notifications', 'schedule', 'attendance', 'tasks', 'hk_assign'].forEach(function (t) { DB[t] = DB[t] || []; });
  function schRow(emp, day) { return DB.schedule.filter(function (x) { return x.employee_id === emp && x.day === day; })[0]; }
  function schSet(row) { var ex = schRow(row.employee_id, row.day); if (ex) Object.assign(ex, row); else DB.schedule.push(Object.assign({}, row)); }
  function stFor(dept, code) { return (DB.shift_types || []).filter(function (t) { return t.dept_id === dept && t.code === code && t.active !== false; })[0]; }
  // swap_shift(p_emp, p_day): код и часы смены (время строки графика → шаблон службы); ночь/сутки — конец на следующий день
  function shiftOf(empId, day) {
    var e = E(empId), r = schRow(empId, day), o = { kind: r ? r.kind || null : null, t_start: null, t_end: null, starts_at: null, ends_at: null, name: null };
    if (!o.kind || 'ohb'.indexOf(o.kind) >= 0) return o;
    var st = stFor(e && e.dept_id, o.kind);
    o.t_start = r.t_start ? t8(r.t_start) : st ? t8(st.start_time) : null; o.t_end = r.t_end ? t8(r.t_end) : st ? t8(st.end_time) : null; o.name = st ? st.name : null;
    if (!o.t_start || !o.t_end) return o;
    o.starts_at = at(day, o.t_start); o.ends_at = at(day, o.t_end); if (o.ends_at <= o.starts_at) o.ends_at += DAY;
    return o;
  }
  function full(e) { return e ? e.first_name + ' ' + e.last_name : '—'; }
  function short(e) { return e ? e.first_name + ' ' + String(e.last_name || '').charAt(0) + '.' : '—'; }
  var nseq = 99000;
  function notify(emp, title, body, rid, ms) { var n = { id: ++nseq, employee_id: emp, at: iso(ms || Date.now()), title: title, body: body || '', ref_type: 'swap', ref_id: rid, urgent: false, read_at: null }; DB.notifications.push(n); return n; }
  // swap_line: «21.10 · Утро 08:30–17:30»
  function line(s) { var st = stFor(s.dept_id, s.kind); return s.day.slice(8, 10) + '.' + s.day.slice(5, 7) + ' · ' + (st ? st.name : s.kind) + ' ' + s.t_start.slice(0, 5) + '–' + s.t_end.slice(0, 5); }
  function offersOf(id) { return DB.shift_swap_offers.filter(function (o) { return o.swap_id === id; }); }
  // M50: триггеры уведомлений (заголовки фиксированные, детали — в body)
  function onStatus(s, t) {
    var ln = line(s);
    if (s.status === 'filled') {
      var f = E(s.filled_by);
      [s.created_by, s.absent_id].filter(function (x, i, a) { return a.indexOf(x) === i && x !== s.filled_by; }).forEach(function (id) { notify(id, 'Замена найдена', full(f) + ' выйдет · ' + ln, s.id, t); });
      offersOf(s.id).forEach(function (o) { if (o.status === 'sent' && o.emp_id !== s.filled_by) notify(o.emp_id, 'Замена уже найдена', 'Выходить не нужно · ' + ln, s.id, t); });
    } else if (s.status === 'cancelled') offersOf(s.id).forEach(function (o) { if (o.status === 'sent') notify(o.emp_id, 'Замена отменена', 'Выходить не нужно · ' + ln, s.id, t); });
    else if (s.status === 'expired') notify(s.created_by, 'Замена не найдена', ln, s.id, t);
    DB.notifications.forEach(function (n) { if (n.ref_type === 'swap' && n.ref_id === s.id && n.title === 'Нужна замена' && !n.read_at) n.read_at = iso(t); });
  }
  function onOfferInsert(o, s, t) { notify(o.emp_id, 'Нужна замена', line(s) + ' · вместо ' + short(E(s.absent_id)), s.id, t); }
  function onOfferNo(o, s, t) { notify(s.created_by, 'Не может выйти', full(E(o.emp_id)) + ' · ' + line(s), s.id, t); }

  // ---------- демо-данные (детерминированно на сегодня) ----------
  (function seed() {
    var base = Math.min(at(TD, '07:05'), now0 - 25 * 6e4);
    if (E('e41') && E('e39') && E('e37') && !DB.shift_swaps.some(function (s) { return s.id === 9001; })) {
      var r0 = schRow('e41', TD); if (!r0 || !r0.kind || 'ohb'.indexOf(r0.kind) >= 0) schSet({ employee_id: 'e41', day: TD, kind: 'u', t_start: null, t_end: null });
      var a = shiftOf('e41', TD), prev39 = (schRow('e39', TD) || {}).kind || null;
      if (a.starts_at) {
        var tA = base + 7 * 6e4;
        var s = { id: 9001, dept_id: 'eng', day: TD, kind: a.kind, t_start: a.t_start, t_end: a.t_end, starts_at: iso(a.starts_at), ends_at: iso(a.ends_at), absent_id: 'e41', reason: 'sick', note: null, status: 'filled', absent_prev_kind: a.kind, absent_set_kind: 'b', created_by: 'e37', created_at: iso(base), filled_by: 'e39', filled_at: iso(tA), filler_prev_kind: prev39, closed_by: null, closed_at: null };
        DB.shift_swaps.push(s);
        DB.shift_swap_offers.push({ swap_id: 9001, emp_id: 'e39', status: 'yes', rank: 1, off_day: true, week_min: 2700, rest_min: null, sent_by: 'e37', sent_at: iso(base + 3 * 6e4), answered_at: iso(tA) });
        schSet({ employee_id: 'e41', day: TD, kind: 'b' });
        schSet({ employee_id: 'e39', day: TD, kind: a.kind, t_start: a.t_start, t_end: a.t_end });
        DB.attendance = DB.attendance.filter(function (x) { return !(x.employee_id === 'e41' && x.day === TD); });
        DB.notifications.push({ id: 98001, employee_id: 'e39', at: iso(base + 3 * 6e4), title: 'Нужна замена', body: line(s) + ' · вместо ' + short(E('e41')), ref_type: 'swap', ref_id: 9001, urgent: false, read_at: iso(tA) });
        DB.notifications.push({ id: 98002, employee_id: 'e37', at: iso(tA), title: 'Замена найдена', body: full(E('e39')) + ' выйдет · ' + line(s), ref_type: 'swap', ref_id: 9001, urgent: false, read_at: now0 - tA > 20 * 6e4 ? iso(tA + 5 * 6e4) : null });
        if (now0 > a.starts_at - 15 * 6e4 && !DB.attendance.some(function (x) { return x.employee_id === 'e39' && x.day === TD; })) DB.attendance.push({ id: 98101, employee_id: 'e39', day: TD, clock_in: iso(Math.min(now0 - 6e4, a.starts_at - 12 * 6e4)), clock_out: null, is_late: false, late_min: 0, shift_kind: a.kind, shift_start: a.t_start, shift_end: a.t_end });
        if (!DB.tasks.some(function (t) { return t.assignee_id === 'e41' && t.day === TD && t.status !== 'done'; }))
          [['Проверить вентиляцию в прачечной', '11:00'], ['Заменить лампы в коридоре 3 этажа', '14:00']].forEach(function (x, i) { DB.tasks.push({ id: 98201 + i, title: x[0], assignee_id: 'e41', created_by: 'e37', day: TD, due_time: x[1], status: 'new', created_at: iso(base - DAY) }); });
      }
    }
    // Хаускипинг: Нафиса сегодня по графику, но без отметки → кнопка замены на чипе «опаздывает / не пришёл»
    var rn = schRow('e16', TD); if (rn && 'ohb'.indexOf(rn.kind) < 0) DB.attendance = DB.attendance.filter(function (x) { return !(x.employee_id === 'e16' && x.day === TD); });
    // учебные телефоны для «Позвонить» (формат front-desk: код 00 не существует)
    DB.employees.forEach(function (e) { if (!e.phone) { var n = String(+e.id.slice(1) || 0); e.phone = '+998 00 000 00 ' + (n.length < 2 ? '0' + n : n); } });
  })();

  // ---------- живые изменения сегодняшнего дня (демо: вход под другим логином = перезагрузка) ----------
  var snapTask = {}, snapHk = JSON.stringify(DB.hk_assign.filter(function (x) { return x.day === TD; }));
  DB.tasks.forEach(function (t) { if (t.day === TD) snapTask[t.id] = t.assignee_id; });
  var ST = null; try { ST = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { ST = null; }
  if (ST && ST.day === TD) {
    nseq = Math.max(nseq, ST.nseq || 0);
    DB.shift_swaps = DB.shift_swaps.filter(function (s) { return s.day !== TD; }).concat(ST.swaps || []);
    var ids = (ST.swaps || []).map(function (s) { return s.id; });
    DB.shift_swap_offers = DB.shift_swap_offers.filter(function (o) { return ids.indexOf(o.swap_id) < 0; }).concat(ST.offers || []);
    (ST.sch || []).forEach(schSet);
    var rd = ST.read || {}; DB.notifications.forEach(function (n) { if (rd[n.id]) n.read_at = rd[n.id]; });
    (ST.notes || []).forEach(function (n) { if (!DB.notifications.some(function (x) { return x.id === n.id; })) DB.notifications.push(n); });
    DB.tasks.forEach(function (t) { if (ST.tasks && ST.tasks[t.id]) t.assignee_id = ST.tasks[t.id]; });
    if (ST.hk) DB.hk_assign = DB.hk_assign.filter(function (x) { return x.day !== TD; }).concat(ST.hk);
  }
  function save() {
    try {
      var sw = DB.shift_swaps.filter(function (s) { return s.day === TD; }), ids = sw.map(function (s) { return s.id; }), who = {};
      sw.forEach(function (s) { who[s.absent_id] = 1; if (s.filled_by) who[s.filled_by] = 1; });
      var tasks = {}; DB.tasks.forEach(function (t) { if (t.id in snapTask && snapTask[t.id] !== t.assignee_id) tasks[t.id] = t.assignee_id; });
      var hk = DB.hk_assign.filter(function (x) { return x.day === TD; }), read = {};
      DB.notifications.forEach(function (n) { if (n.ref_type === 'swap' && n.read_at) read[n.id] = n.read_at; });
      localStorage.setItem(KEY, JSON.stringify({ day: TD, nseq: nseq, swaps: sw, offers: DB.shift_swap_offers.filter(function (o) { return ids.indexOf(o.swap_id) >= 0; }),
        sch: DB.schedule.filter(function (x) { return x.day === TD && who[x.employee_id]; }), notes: DB.notifications.filter(function (n) { return n.id > 99000 && n.ref_type === 'swap'; }),
        read: read, tasks: tasks, hk: JSON.stringify(hk) !== snapHk ? hk : null }));
    } catch (e) {}
  }
  try { window.addEventListener('pagehide', save); } catch (e) {}

  // ---------- права (как swap_mgr_of / manager_id) ----------
  function isDir(me) { return me && me.role === 'director'; }
  function mgrOf(me, dept) { return !!me && (isDir(me) || (me.role === 'manager' && (me.dept_id === dept || me.lead_dept === dept))); }
  function canLead(me, ab) { return mgrOf(me, ab.dept_id) || ab.manager_id === me.id; }
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function no(m) { return Promise.resolve({ data: null, error: { message: m } }); }
  function sw(id) { return DB.shift_swaps.filter(function (s) { return s.id === +id; })[0]; }
  function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }
  function expire(t) { DB.shift_swaps.forEach(function (s) { if (s.status === 'open' && Date.parse(s.ends_at) - t < 2 * 36e5) { s.status = 'expired'; s.closed_at = iso(t); onStatus(s, t); offersOf(s.id).forEach(function (o) { if (o.status === 'sent') o.status = 'closed'; }); } }); }
  expire(now0);

  // swap_candidates: та же служба, активные, не директор, не я, не отпуск/больничный; busy — своя смена пересекается (вчера/сегодня/завтра)
  function candidates(me, abId, day, incBusy) {
    var ab = E(abId); if (!ab) throw 'Сотрудник не найден';
    if (!canLead(me, ab)) throw 'Нет доступа';
    var s0 = DB.shift_swaps.filter(function (s) { return s.absent_id === abId && s.day === day && (s.status === 'open' || s.status === 'filled'); })[0];
    var A = s0 ? { starts_at: Date.parse(s0.starts_at), ends_at: Date.parse(s0.ends_at) } : shiftOf(abId, day);
    if (!A.starts_at) throw 'В этот день у сотрудника нет смены';
    var mon = monday(day);
    var rows = DB.employees.filter(function (e) { return e.active !== false && e.dept_id === ab.dept_id && e.id !== abId && e.role !== 'director' && e.id !== me.id; }).map(function (e) {
      var d0 = shiftOf(e.id, day); if (d0.kind === 'h' || d0.kind === 'b') return null;
      var busy = false, rest = null;
      [-1, 0, 1].forEach(function (g) { var x = shiftOf(e.id, addD(day, g));
        if (x.starts_at && overlap(x.starts_at, x.ends_at, A.starts_at, A.ends_at)) busy = true;
        else if (g === 0 && x.kind && 'ohb'.indexOf(x.kind) < 0 && !x.starts_at) busy = true;
        if (x.starts_at && !overlap(x.starts_at, x.ends_at, A.starts_at, A.ends_at)) { var r = Math.round(Math.max(A.starts_at - x.ends_at, x.starts_at - A.ends_at) / 6e4); rest = rest == null ? r : Math.min(rest, r); } });
      var wk = 0; for (var i = 0; i < 7; i++) { var w = shiftOf(e.id, addD(mon, i)); if (w.starts_at) wk += Math.round((w.ends_at - w.starts_at) / 6e4); }
      var wrk = 0; DB.attendance.forEach(function (t) { if (t.employee_id === e.id && t.day >= mon && t.day <= day && t.clock_in) wrk += t.worked_min != null ? t.worked_min : Math.round(((t.clock_out ? Date.parse(t.clock_out) : Date.now()) - Date.parse(t.clock_in)) / 6e4); });
      var os = null; DB.shift_swap_offers.forEach(function (o) { var s = sw(o.swap_id); if (o.emp_id === e.id && s && s.absent_id === abId && s.day === day && s.status === 'open') os = o.status; });
      return { emp_id: e.id, name: full(e), position_id: e.position_id, kind_today: d0.kind, off_day: !d0.kind || d0.kind === 'o', busy: busy, rest_min: rest, week_min: wk, worked_min: wrk, offered: os, rank: 0 };
    }).filter(Boolean);
    rows.sort(function (a, b) { return (a.busy - b.busy) || (b.off_day - a.off_day) || (((a.rest_min == null ? 1e5 : a.rest_min) < 480) - ((b.rest_min == null ? 1e5 : b.rest_min) < 480)) || (a.week_min - b.week_min) || a.name.localeCompare(b.name, 'ru'); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows.filter(function (r) { return incBusy || !r.busy; });
  }
  function brief(me, day) {
    if (!me || !(isDir(me) || me.role === 'manager')) throw 'Нет доступа';
    var S = DB.shift_swaps.filter(function (s) { return (isDir(me) || s.dept_id === me.dept_id || s.dept_id === me.lead_dept) && s.day >= addD(day, -6) && s.day <= addD(day, 1); });
    var fl = S.filter(function (s) { return s.status === 'filled' && s.day <= day; });
    var items = S.filter(function (s) { return s.day === day || s.day === addD(day, 1) || s.status === 'open'; }).sort(function (a, b) { return ((a.status !== 'open') - (b.status !== 'open')) || (a.starts_at < b.starts_at ? -1 : 1); }).map(function (s) {
      var of = offersOf(s.id), fm = s.filled_at ? Math.round((Date.parse(s.filled_at) - Date.parse(s.created_at)) / 6e4) : null;
      return { id: s.id, dept_id: s.dept_id, day: s.day, kind: s.kind, t_start: s.t_start.slice(0, 5), t_end: s.t_end.slice(0, 5), status: s.status, reason: s.reason, absent_id: s.absent_id, absent: full(E(s.absent_id)), filled_by: s.filled_by, filler: s.filled_by ? full(E(s.filled_by)) : null, created_at: s.created_at, filled_at: s.filled_at, fill_min: fm, sent: of.length, no: of.filter(function (o) { return o.status === 'no'; }).length };
    });
    return { day: day, open: S.filter(function (s) { return s.status === 'open'; }).length, today: S.filter(function (s) { return s.day === day; }).length, filled_7d: fl.length,
      avg_fill_min_7d: fl.length ? Math.round(fl.reduce(function (m, s) { return m + (Date.parse(s.filled_at) - Date.parse(s.created_at)) / 6e4; }, 0) / fl.length) : null, items: items };
  }
  function sendTo(me, s, emps, t) {
    var C = candidates(me, s.absent_id, s.day, false), n = 0;
    emps.forEach(function (id) { var c = C.filter(function (x) { return x.emp_id === id; })[0]; if (!c || DB.shift_swap_offers.some(function (o) { return o.swap_id === s.id && o.emp_id === id; })) return;
      var o = { swap_id: s.id, emp_id: id, status: 'sent', rank: c.rank, off_day: c.off_day, week_min: c.week_min, rest_min: c.rest_min, sent_by: me.id, sent_at: iso(t), answered_at: null };
      DB.shift_swap_offers.push(o); onOfferInsert(o, s, t); n++; });
    return n;
  }
  function badPick(me, abId, day, emps) { var C = candidates(me, abId, day, false); return emps.some(function (x) { return !C.some(function (c) { return c.emp_id === x; }); }); }

  var NAMES = ['swap_candidates', 'swap_open', 'swap_offer_more', 'swap_answer', 'swap_cancel', 'swap_brief', 'swap_expire', 'mgr_brief'];
  var orig = window.supabase && window.supabase.createClient; if (!orig) return;
  window.supabase.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w9swap) return c; c.__w9swap = true;
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (NAMES.indexOf(n) < 0) return rpc0.apply(c, arguments);
      a = a || {}; var me = meEmp(), t = Date.now();
      if (n === 'mgr_brief') return rpc0.apply(c, arguments).then(function (r) { // блок 'swap' = swap_brief(null)
        if (r && r.data && me && (isDir(me) || me.role === 'manager')) { try { r.data.swap = brief(me, TD); } catch (x) {} }
        return r;
      });
      if (!me) return no('Нет доступа');
      var res;
      try {
        expire(t);
        if (n === 'swap_candidates') res = candidates(me, a.p_absent, a.p_day || TD, !!a.p_include_busy);
        else if (n === 'swap_brief') res = brief(me, a.p_day || TD);
        else if (n === 'swap_expire') res = 0;
        else if (n === 'swap_open') {
          var ab = E(a.p_absent), day = a.p_day || TD, emps = a.p_emps || [];
          if (!ab || ab.active === false) throw 'Сотрудник не найден';
          if (!canLead(me, ab)) throw 'Нет доступа';
          if (ab.id === me.id) throw 'Замену себе ищет руководитель службы';
          if (day < addD(TD, -1) || day > addD(TD, 7)) throw 'Замену можно искать на сегодня и 7 дней вперёд';
          if (['sick', 'family', 'no_show', 'other'].indexOf(a.p_reason || '') < 0) throw 'Укажите причину';
          if (a.p_note && String(a.p_note).length > 300) throw 'Комментарий длиннее 300 знаков';
          if (emps.length < 1) throw 'Выберите, кому предложить';
          if (emps.length > 10) throw 'Не больше 10 человек за раз';
          if (emps.filter(function (x, i) { return emps.indexOf(x) === i; }).length !== emps.length) throw 'Сотрудник выбран дважды';
          var ex = DB.shift_swaps.filter(function (s) { return s.absent_id === ab.id && s.day === day && (s.status === 'open' || s.status === 'filled'); })[0];
          if (ex) res = { ok: false, exists: true, id: ex.id };
          else {
            var A = shiftOf(ab.id, day);
            if (!A.kind || 'ohb'.indexOf(A.kind) >= 0) throw 'В этот день у сотрудника нет смены';
            if (!A.starts_at) throw 'Не заданы часы смены — проверьте график';
            if (A.ends_at <= t) throw 'Смена уже закончилась';
            if (!isDir(me) && DB.attendance.some(function (x) { return x.employee_id === ab.id && x.day === day && x.clock_in && !x.clock_out; })) throw 'Сотрудник уже на смене. Уйти раньше разрешает только директор («Отпроситься»)';
            if (badPick(me, ab.id, day, emps)) throw 'Часть выбранных не может выйти в это время — обновите список';
            var sick = a.p_reason === 'sick';
            var s = { id: Math.max.apply(null, [9200].concat(DB.shift_swaps.map(function (x) { return x.id; }))) + 1, dept_id: ab.dept_id, day: day, kind: A.kind, t_start: A.t_start, t_end: A.t_end, starts_at: iso(A.starts_at), ends_at: iso(A.ends_at), absent_id: ab.id, reason: a.p_reason, note: a.p_note ? String(a.p_note).trim() || null : null, status: 'open', absent_prev_kind: sick ? A.kind : null, absent_set_kind: sick ? 'b' : null, created_by: me.id, created_at: iso(t), filled_by: null, filled_at: null, filler_prev_kind: null, closed_by: null, closed_at: null };
            sendTo(me, s, emps, t); // кандидаты считаются до смены графика заболевшего
            DB.shift_swaps.push(s);
            if (sick) { var r = schRow(ab.id, day); if (r) r.kind = 'b'; }
            res = { ok: true, id: s.id, sent: emps.length, starts_at: s.starts_at, ends_at: s.ends_at, kind: s.kind };
          }
        } else if (n === 'swap_offer_more') {
          var s1 = sw(a.p_id); if (!s1) throw 'Поиск замены не найден';
          if (!(mgrOf(me, s1.dept_id) || s1.created_by === me.id)) throw 'Нет доступа';
          if (s1.status !== 'open') throw 'Поиск уже закрыт';
          var em = a.p_emps || []; if (em.length < 1 || em.length > 10) throw 'Выберите от 1 до 10 человек';
          if (offersOf(s1.id).length + em.length > 30) throw 'Слишком много предложений по одной смене';
          if (badPick(me, s1.absent_id, s1.day, em)) throw 'Часть выбранных не может выйти в это время — обновите список';
          res = { ok: true, sent: sendTo(me, s1, em, t) };
        } else if (n === 'swap_answer') { // атомарно: на сервере строка shift_swaps блокируется FOR UPDATE
          var s2 = sw(a.p_id), o = s2 && offersOf(s2.id).filter(function (x) { return x.emp_id === me.id; })[0];
          if (!s2 || !o) throw 'Предложение не найдено';
          if (!a.p_yes) { if (o.status === 'sent') { o.status = 'no'; o.answered_at = iso(t); onOfferNo(o, s2, t); } res = { ok: true, status: 'no' }; }
          else if (s2.status !== 'open') {
            if (o.status === 'sent') o.status = 'closed';
            res = { ok: false, taken: s2.status === 'filled', status: s2.status, by: s2.filled_by ? short(E(s2.filled_by)) : null, mine: s2.filled_by === me.id };
          } else {
            if (['sent', 'no'].indexOf(o.status) < 0) throw 'Предложение закрыто';
            if ([-1, 0, 1].some(function (g) { var y = shiftOf(me.id, addD(s2.day, g)); return y.starts_at && overlap(y.starts_at, y.ends_at, Date.parse(s2.starts_at), Date.parse(s2.ends_at)); })) throw 'У вас в это время своя смена';
            var mr = schRow(me.id, s2.day); if (mr && (mr.kind === 'h' || mr.kind === 'b')) throw 'У вас в этот день отпуск или больничный';
            s2.filler_prev_kind = mr ? mr.kind : null; s2.status = 'filled'; s2.filled_by = me.id; s2.filled_at = iso(t);
            onStatus(s2, t); // уведомления до закрытия остальных предложений (как триггер after update)
            schSet({ employee_id: me.id, day: s2.day, kind: s2.kind, t_start: s2.t_start, t_end: s2.t_end });
            o.status = 'yes'; o.answered_at = iso(t);
            offersOf(s2.id).forEach(function (x) { if (x.status === 'sent') x.status = 'closed'; });
            res = { ok: true, status: 'filled', day: s2.day, kind: s2.kind, t_start: s2.t_start, t_end: s2.t_end, starts_at: s2.starts_at };
          }
        } else if (n === 'swap_cancel') {
          var s3 = sw(a.p_id); if (!s3) throw 'Поиск замены не найден';
          if (!(mgrOf(me, s3.dept_id) || s3.created_by === me.id)) throw 'Нет доступа';
          if (s3.status === 'filled') throw 'Замена уже найдена — измените график вручную';
          if (s3.status !== 'open') res = { ok: true, status: s3.status };
          else {
            s3.status = 'cancelled'; s3.closed_by = me.id; s3.closed_at = iso(t); onStatus(s3, t);
            offersOf(s3.id).forEach(function (x) { if (x.status === 'sent') x.status = 'closed'; });
            var rb = schRow(s3.absent_id, s3.day); if (s3.absent_set_kind && s3.absent_prev_kind && rb && rb.kind === s3.absent_set_kind) rb.kind = s3.absent_prev_kind;
            res = { ok: true, status: 'cancelled' };
          }
        }
      } catch (x) { save(); return no(typeof x === 'string' ? x : String(x && x.message || x)); }
      save();
      return ok(JSON.parse(JSON.stringify(res)));
    };
    var from0 = c.from; // правки задач / номеров через таблицы — тоже в журнал демо
    c.from = function () { var q = from0.apply(c, arguments), th = q.then; q.then = function (a1, a2) { var w = q.op; return th.call(q, function (r) { if (w) save(); return r; }).then(a1, a2); }; return q; };
    return c;
  };
})();
