/* Mir Luxe One — демо-мок пакета w12-emergency (волна 12): «Экстренный протокол».
   Таблицы: emergency_events (событие: вид, учебная, место, начало/конец, итог), emergency_marks (отметки: room «вышли», emp «на месте», step, call, alert, ack, log).
   RPC: emergency_start, emergency_place, emergency_alert (оповещение-тревога = срочное уведомление ref_type 'emerg', НЕ задача), emergency_ack, emergency_mark, emergency_log, emergency_end (итоговый отчёт директору).
   Демо: события, отметки и тревоги сохраняются в localStorage «mock-w12-emg», чтобы при смене должности в обёртке оповещённый увидел тревогу.
   Подключается после остальных mock-*.js. */
(function () {
  var DB = window.__DB; if (!DB || DB.__w12EmgSeed) return; DB.__w12EmgSeed = true;
  var TZ = 'Asia/Tashkent', NOW = Date.now(), seq = 97000, KEY = 'mock-w12-emg';
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function add(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function at(day, hm) { return new Date(day + 'T' + hm + ':00+05:00').toISOString(); }
  var EV = DB.emergency_events = DB.emergency_events || [], MK = DB.emergency_marks = DB.emergency_marks || [];
  DB.notifications = DB.notifications || [];
  // дежурный руководитель в демо: начальник приёма на смене
  var A = DB.attendance = DB.attendance || [];
  if (!A.some(function (a) { return a.employee_id === 'e6' && !a.clock_out; })) A.push({ id: ++seq, employee_id: 'e6', day: T, clock_in: at(T, '08:52'), clock_out: null, is_late: false, late_min: 0, shift_start: '09:00:00', shift_end: '18:00:00', shift_kind: 'u', in_device: 'iPhone' });
  // учебная эвакуация 2 недели назад — для журнала и примера отчёта
  var d0 = add(T, -14), ev0 = { id: ++seq, kind: 'evac', drill: true, place: 'Весь отель · учебная эвакуация', started_by: 'e42', started_at: at(d0, '15:00'), ended_at: at(d0, '15:17'), ended_by: 'e0', result: 'done', summary: 'Все вышли за 11 минут. Замечание: на 5 этаже дверь лестницы была заперта — ключ передан охране.', stat: { rooms: 31, rooms_out: 31, emps: 14, emps_ok: 14, alerted: 6, acked: 6 } };
  EV.push(ev0);
  [['log', null, 'Начато: Эвакуация (учебная)', '15:00', 'e42'], ['alert', 'e43', 'Оповещён: Турсунбой Юлдашев', '15:01', 'e42'], ['alert', 'e38', 'Оповещён: Шахриёр Мирзаев', '15:01', 'e42'], ['call', '101', 'Звонок 101 (учебный — не набирали)', '15:02', 'e42'], ['log', null, 'Все номера 5 этажа вышли', '15:09', 'e43'], ['log', null, 'Все на месте', '15:11', 'e42'], ['log', null, 'Завершено', '15:17', 'e0']]
    .forEach(function (x) { MK.push({ id: ++seq, event_id: ev0.id, kind: x[0], ref: x[1], text: x[2], at: at(d0, x[3]), by: x[4], on: true }); });
  var d1 = add(T, -40); EV.push({ id: ++seq, kind: 'med_guest', drill: false, place: 'Ресторан, 1 этаж', started_by: 'e8', started_at: at(d1, '20:41'), ended_at: at(d1, '21:05'), ended_by: 'e6', result: 'done', summary: 'Гостю стало плохо в ресторане, скорая приехала через 14 минут, гостя забрали в больницу.', stat: { alerted: 3, acked: 3 } });
  MK.push({ id: ++seq, event_id: seq - 1, kind: 'log', ref: null, text: 'Начато: Медпомощь гостю', at: at(d1, '20:41'), by: 'e8', on: true });
  // восстановить демо-состояние после смены должности (только свежие, не старше 12 ч)
  var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (saved && saved.ev) {
    saved.ev.forEach(function (e) { if (Date.parse(e.started_at) > NOW - 12 * 36e5 && !EV.some(function (x) { return x.id === e.id; })) EV.push(e); });
    (saved.mk || []).forEach(function (m) { if (EV.some(function (x) { return x.id === m.event_id; }) && !MK.some(function (x) { return x.id === m.id; })) MK.push(m); });
    (saved.nt || []).forEach(function (n) { if (Date.parse(n.at) > NOW - 12 * 36e5 && !DB.notifications.some(function (x) { return x.id === n.id; })) DB.notifications.push(n); });
    seq = Math.max(seq, saved.seq || 0);
  }
  function persist() {
    try {
      var ev = EV.filter(function (e) { return Date.parse(e.started_at) > Date.now() - 12 * 36e5; }), ids = ev.map(function (e) { return e.id; });
      localStorage.setItem(KEY, JSON.stringify({ seq: seq, ev: ev, mk: MK.filter(function (m) { return ids.indexOf(m.event_id) >= 0; }), nt: DB.notifications.filter(function (n) { return n.ref_type === 'emerg' && Date.parse(n.at) > Date.now() - 12 * 36e5; }) }));
    } catch (e) {}
  }

  var KN = { fire: 'Пожар', med_guest: 'Медпомощь гостю', med_staff: 'Медпомощь сотруднику', gas: 'Запах газа', evac: 'Эвакуация', object: 'Подозрительный предмет' };
  function meEmp() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null;
    try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {}
    return (DB.employees || []).filter(function (e) { return a ? e.login === a[1] : s && e.user_id === s.user.id; })[0];
  }
  function emp(id) { return (DB.employees || []).filter(function (e) { return e.id === id; })[0]; }
  function fn(e) { return e ? e.first_name + ' ' + e.last_name : ''; }
  function evOf(id) { return EV.filter(function (e) { return e.id === +id; })[0]; }
  function log(ev, kind, ref, text, me) { var m = { id: ++seq, event_id: ev.id, kind: kind, ref: ref == null ? null : String(ref), text: text, at: new Date().toISOString(), by: me ? me.id : null, on: true }; MK.push(m); return m; }
  function ok(d) { persist(); return Promise.resolve({ data: d, error: null }); }
  function bad(m) { return Promise.resolve({ data: null, error: { message: m } }); }
  function canEnd(me, ev) { return me && (me.role === 'director' || me.role === 'manager' || me.dept_id === 'sec' || ev.started_by === me.id); }

  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w12emg) return c; c.__w12emg = true;
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (!/^emergency_/.test(n)) return rpc0.apply(this, arguments);
      a = a || {}; var me = meEmp(); if (!me) return bad('Нет входа');
      var ev = a.p_event ? evOf(a.p_event) : null;
      if (n === 'emergency_start') {
        EV.forEach(function (x) { if (!x.ended_at && Date.parse(x.started_at) <= Date.now() - 12 * 36e5) { x.ended_at = new Date(Date.parse(x.started_at) + 12 * 36e5).toISOString(); x.result = 'auto'; log(x, 'log', null, 'Закрыто автоматически через 12 ч', null); } });
        if (!KN[a.p_kind]) return bad('Неизвестный вид');
        var drill = !!a.p_drill && (me.role === 'director' || me.role === 'manager' || me.dept_id === 'sec');
        var cur = EV.filter(function (e) { return !e.ended_at && e.kind === a.p_kind && !!e.drill === drill && Date.parse(e.started_at) > Date.now() - 12 * 36e5; })[0];
        if (cur) return ok({ id: cur.id, joined: true });
        var e = { id: ++seq, kind: a.p_kind, drill: drill, place: a.p_place || null, started_by: me.id, started_at: new Date().toISOString(), ended_at: null, ended_by: null, result: null, summary: null, stat: null };
        EV.push(e); log(e, 'log', null, 'Начато: ' + KN[e.kind] + (drill ? ' (учебная)' : ''), me);
        return ok({ id: e.id });
      }
      if (n === 'emergency_onshift') { var y = add(T, -1); return Promise.resolve({ data: (DB.attendance || []).filter(function (x) { return !x.clock_out && x.clock_in && x.day >= y; }).map(function (x) { return { employee_id: x.employee_id, clock_in: x.clock_in }; }), error: null }); }
      if (n === 'emergency_rooms') {
        var act = EV.some(function (x) { return !x.ended_at && Date.parse(x.started_at) > Date.now() - 12 * 36e5; });
        if (!act) return Promise.resolve({ data: [], error: null });   // как на сервере: вне события доска рядовым не открывается
        var bd = {}, day = a.p_day || T;
        (DB.pms_board || []).filter(function (b) { return b.day === day && b.room_no; }).forEach(function (b) { bd[b.room_no] = b; });
        var self = this;
        return Promise.resolve(rpc0.call(self, 'pms_day', { p_day: day })).then(function (r) {
          ((r && r.data) || []).forEach(function (b) { if (b.room_no) bd[b.room_no] = b; });
          return { data: Object.keys(bd).map(function (k) { var b = bd[k]; return { room_no: b.room_no, kind: b.kind, adults: b.adults, children: b.children, eta: b.eta, etd: b.etd }; }), error: null };
        }, function () { return { data: Object.keys(bd).map(function (k) { return bd[k]; }), error: null }; });
      }
      if (!ev) return bad('Событие не найдено');
      if (n === 'emergency_place') { ev.place = String(a.p_place || '').slice(0, 120) || null; log(ev, 'log', null, 'Место: ' + (ev.place || '—'), me); return ok({ ok: true }); }
      if (n === 'emergency_alert') {
        if (ev.ended_at) return bad('Событие завершено');
        var ids = [].concat(a.p_emps || []), sent = [];
        ids.forEach(function (id) {
          var e = emp(id); if (!e || e.id === me.id) return;
          var nt = { id: ++seq, employee_id: e.id, at: new Date().toISOString(), title: (ev.drill ? 'Учебная тревога: ' : 'Тревога: ') + KN[ev.kind], body: (ev.place ? 'Место — ' + ev.place + '. ' : '') + 'Вызывает — ' + fn(me) + '. Нажмите «Иду».', ref_type: 'emerg', ref_id: ev.id, urgent: true, read_at: null };
          DB.notifications.push(nt); sent.push(e.id); log(ev, 'alert', e.id, 'Оповещён: ' + fn(e), me);
        });
        return ok({ sent: sent });
      }
      if (n === 'emergency_ack') { if (!MK.some(function (m) { return m.event_id === ev.id && m.kind === 'ack' && m.ref === me.id; })) log(ev, 'ack', me.id, 'Принял: ' + fn(me), me); return ok({ ok: true }); }
      if (n === 'emergency_mark') {
        if (ev.ended_at) return bad('Событие завершено');
        var k = a.p_kind, ref = String(a.p_ref), on = a.p_on !== false;
        if (['room', 'emp', 'step'].indexOf(k) < 0) return bad('Неверная отметка');
        var m = MK.filter(function (x) { return x.event_id === ev.id && x.kind === k && x.ref === ref; })[0];
        var txt = k === 'room' ? (on ? 'Номер ' + ref + ' — вышли' : 'Номер ' + ref + ' — отметка снята') : k === 'emp' ? ((on ? 'На месте: ' : 'Снята отметка: ') + fn(emp(ref))) : (on ? 'Шаг ' + ref + ' выполнен' : 'Шаг ' + ref + ' — снято');
        if (m) { m.on = on; m.at = new Date().toISOString(); m.by = me.id; m.text = txt; } else log(ev, k, ref, txt, me).on = on;
        return ok({ ok: true });
      }
      if (n === 'emergency_log') { var t = String(a.p_text || '').trim().slice(0, 300); if (!t) return bad('Пустая запись'); log(ev, a.p_kind === 'call' ? 'call' : 'log', a.p_ref || null, t, me); return ok({ ok: true }); }
      if (n === 'emergency_end') {
        if (ev.ended_at) return ok({ ok: true });
        if (!canEnd(me, ev)) return bad('Завершить может руководитель, охрана или тот, кто начал');
        ev.ended_at = new Date().toISOString(); ev.ended_by = me.id; ev.result = a.p_false ? 'false' : 'done'; ev.summary = String(a.p_summary || '').slice(0, 1000) || null; ev.stat = a.p_stat || null;
        log(ev, 'log', null, a.p_false ? 'Завершено: ложный вызов' : 'Завершено', me);
        DB.notifications.forEach(function (x) { if (x.ref_type === 'emerg' && x.ref_id === ev.id && x.urgent && !x.read_at) x.read_at = ev.ended_at; });
        var dirs = (DB.employees || []).filter(function (e) { return e.role === 'director' && e.active !== false; });
        var min = Math.max(1, Math.round((Date.parse(ev.ended_at) - Date.parse(ev.started_at)) / 6e4));
        dirs.forEach(function (d) { DB.notifications.push({ id: ++seq, employee_id: d.id, at: ev.ended_at, title: 'Отчёт: ' + KN[ev.kind] + (ev.drill ? ' (учебная)' : ''), body: (a.p_false ? 'Ложный вызов. ' : '') + 'Длилось ' + min + ' мин. Завершил — ' + fn(me) + '.', ref_type: 'emerg', ref_id: ev.id, urgent: false, read_at: d.id === me.id ? ev.ended_at : null }); });
        return ok({ ok: true });
      }
      return bad('Неизвестный вызов');
    };
    return c;
  };
})();
