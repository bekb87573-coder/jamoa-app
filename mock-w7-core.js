/* Mir Luxe One — демо-мок пакета w7-core (волна 07): правдивая отметка прихода/ухода.
   Подключается в app.html сразу после demo-mock.js. Только демо; на боевом сервере ту же логику делает функция clock (см. changes.md).
   - clock 'in':  смена из графика (schedule → своё время → шаблон службы → время сотрудника → единственная смена службы),
                  опоздание = приход − начало смены, если больше допуска (prefs.late_grace_min, по умолчанию 5 мин);
                  повторный приход в тот же день — без опоздания (repeat:true).
   - clock 'out': worked_min = уход − приход; left_early/early_min — раньше конца смены; overtime_min — позже конца на 15+ мин.
   - rpc urgent_escalate: уведомление руководителю «Срочное не принято» (не задача). */
(function () {
  var DB = window.__DB; if (!DB) return;
  var TZN = 'Asia/Tashkent', seq = 70000;
  function tday() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZN }).format(new Date()); }
  function addD(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function t5(t) { return t ? String(t).slice(0, 5) : ''; }
  function mm(t) { var m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; }
  // абсолютное время (мс) для 'YYYY-MM-DD' + 'HH:MM' по Ташкенту
  function at(day, hm) { return Date.parse(day + 'T' + t5(hm) + ':00+05:00'); }
  function meEmp() { var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null; try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {} return DB.employees.filter(function (e) { return a ? e.login === a[1] : s && e.user_id === s.user.id; })[0]; }
  function stypes(dept) { return (DB.shift_types || []).filter(function (t) { return t.dept_id === dept && t.active !== false; }).sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }); }
  function grace() { var hs = (DB.hotel_settings || [])[0] || {}, p = hs.prefs || {}; return p.late_grace_min != null && !isNaN(+p.late_grace_min) ? +p.late_grace_min : 5; }
  // смена сотрудника на день: { kind, start, end, day, startMs, endMs } | { off:true } | null
  function shiftFor(e, day) {
    var s = (DB.schedule || []).filter(function (x) { return x.employee_id === e.id && x.day === day; })[0], k = s && s.kind;
    if (k && ['o', 'h', 'b'].indexOf(k) >= 0) return { off: true, kind: k };
    var se = null, kind = k || null, list = stypes(e.dept_id);
    if (s && s.t_start && s.t_end) se = [s.t_start, s.t_end];
    else if (k) { if (k === 'u' && e.shift_start && e.shift_end) se = [e.shift_start, e.shift_end]; else { var t = list.filter(function (x) { return x.code === k; })[0]; if (t) se = [t.start_time, t.end_time]; } }
    if (!se) { var t0 = list.length === 1 ? list[0] : list.filter(function (x) { return x.code === 'u'; })[0] || list[0]; if (!t0) return null; se = [t0.start_time, t0.end_time]; kind = kind || 'default'; }
    var st = at(day, se[0]), en = at(mm(se[1]) <= mm(se[0]) ? addD(day, 1) : day, se[1]);
    return { kind: kind, start: t5(se[0]) + ':00', end: t5(se[1]) + ':00', day: day, startMs: st, endMs: en };
  }
  // какая смена сейчас: сегодняшняя; если сегодня выходной/нет, а вчерашняя ночная/суточная ещё идёт — вчерашняя
  function currentShift(e) {
    var d = tday(), now = Date.now(), y = shiftFor(e, addD(d, -1)), t = shiftFor(e, d);
    if (y && !y.off && y.endMs > now && (!t || t.off || now < t.startMs - 2 * 36e5)) return y;
    return t && !t.off ? t : null;
  }
  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w7core) return c; c.__w7core = true;
    var inv0 = c.functions.invoke;
    c.functions.invoke = function (n, o) {
      var b = o && o.body, act = b && b.action;
      if (n !== 'clock' || (act !== 'in' && act !== 'out')) return inv0.apply(this, arguments);
      var me = meEmp(); if (!me) return inv0.apply(this, arguments);
      var openRec = DB.attendance.filter(function (x) { return x.employee_id === me.id && !x.clock_out; }).pop();
      if (act === 'out' && !openRec) return Promise.resolve({ data: { ok: false, reason: 'not_in' }, error: null });
      if (act === 'in' && openRec) return Promise.resolve({ data: { ok: false, reason: 'already_in', since: openRec.clock_in }, error: null });
      var d = tday(), hadToday = DB.attendance.some(function (x) { return x.employee_id === me.id && x.day === d && x.clock_out; });
      return Promise.resolve(inv0.apply(this, arguments)).then(function (r) {
        try {
          if (!r || !r.data || !r.data.ok) return r;
          var now = Date.now();
          if (act === 'in') {
            var a = DB.attendance.filter(function (x) { return x.employee_id === me.id && !x.clock_out; }).pop(); if (!a) return r;
            var sh = currentShift(me), late = 0;
            if (sh) { a.shift_kind = sh.kind; a.shift_start = sh.start; a.shift_end = sh.end; a.day = sh.day; late = Math.round((now - sh.startMs) / 6e4); }
            else { a.shift_kind = 'default'; }
            var isLate = !hadToday && !!sh && late > grace();
            a.is_late = isLate; a.late_min = isLate ? late : 0; a.repeat = hadToday || undefined;
            r.data = Object.assign({}, r.data, { is_late: isLate, late_min: a.late_min, repeat: !!hadToday, shift_start: a.shift_start, shift_end: a.shift_end, shift_kind: a.shift_kind });
          } else {
            var rec = openRec; if (!rec.clock_out) rec.clock_out = new Date(now).toISOString();
            var worked = Math.max(0, Math.round((Date.parse(rec.clock_out) - Date.parse(rec.clock_in)) / 6e4)), early = 0, over = 0;
            if (rec.shift_start && rec.shift_end) { var day = rec.day || d, endMs = at(mm(rec.shift_end) <= mm(rec.shift_start) ? addD(day, 1) : day, rec.shift_end), diff = Math.round((endMs - now) / 6e4); if (diff > 5) early = diff; else if (-diff >= 15) over = -diff; }
            rec.worked_min = worked; rec.left_early = early > 0; rec.early_min = early; rec.overtime_min = over;
            r.data = Object.assign({}, r.data, { worked_min: worked, left_early: early > 0, early_min: early, overtime_min: over });
          }
        } catch (e) {}
        return r;
      });
    };
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (n !== 'urgent_escalate') return rpc0.apply(this, arguments);
      var me = meEmp(), nt = (DB.notifications || []).filter(function (x) { return x.id === (a && a.p_nid); })[0];
      if (!me || !nt) return Promise.resolve({ data: { ok: false }, error: null });
      var boss = DB.employees.filter(function (e) { return e.id === me.manager_id; })[0] || DB.employees.filter(function (e) { return e.role === 'director' && e.active !== false; })[0];
      if (!boss || boss.id === me.id) return Promise.resolve({ data: { ok: false }, error: null });
      var title = String(nt.title || '').replace(/^[^\wА-Яа-яЁё«"(№]+\s*/, '');
      // w8-tails: «Гость ждёт 5 мин» застывает — пишем время начала ожидания
      title = title.replace(/^Гость ждёт (\d+) мин/, function (x, n) { var t = new Date(new Date(nt.at).getTime() - n * 6e4); return 'Гость ждёт с ' + new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }).format(t); });
      DB.notifications.push({ id: ++seq, employee_id: boss.id, at: new Date().toISOString(), title: 'Срочное не принято', body: me.first_name + ' ' + me.last_name + ' · ' + title + (a.p_reason === 'snooze' ? ' · 3× «Напомнить»' : ''), ref_type: nt.ref_type, ref_id: nt.ref_id, urgent: false, read_at: null });
      return Promise.resolve({ data: { ok: true, to: boss.id }, error: null });
    };
    return c;
  };
})();
