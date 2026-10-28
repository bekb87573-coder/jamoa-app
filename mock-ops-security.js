/* Mir Luxe One — демо-мок пакета ops-security (охрана: сутки, обход, QR).
   Подключается в app.html сразу после demo-mock.js. Только демо, на боевом сервере не нужен. */
(function () {
  var DB = window.__DB; if (!DB) return;
  var TZN = 'Asia/Tashkent';
  function tday() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZN }).format(new Date()); }
  function addD(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function hourT() { return +new Intl.DateTimeFormat('en-GB', { timeZone: TZN, hour: '2-digit', hour12: false }).format(new Date()) % 24; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ts) { return new Intl.DateTimeFormat('ru-RU', { timeZone: TZN, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }
  var seq = 50000;

  // 1. График охраны «сутки через двое» на 14 дней от понедельника
  try {
    var td = tday(), wd = (new Date(td + 'T00:00:00Z').getUTCDay() + 6) % 7, mon = addD(td, -wd);
    var phase = { e42: 0, e43: 0, e44: 2 };   // 0 = сутки сегодня; e44: сутки завтра (2 дня назад от «через двое»)
    var ids = Object.keys(phase);
    DB.schedule = (DB.schedule || []).filter(function (s) { return ids.indexOf(s.employee_id) < 0 || s.day < mon || s.day > addD(mon, 13); });
    ids.forEach(function (id) {
      for (var i = 0; i < 14; i++) {
        var d = addD(mon, i), diff = Math.round((Date.parse(d) - Date.parse(td)) / 864e5);
        var k = ((diff + phase[id]) % 3 + 3) % 3 === 0 ? 'u' : 'o';
        DB.schedule.push({ employee_id: id, day: d, kind: k, t_start: null, t_end: null });
      }
    });
  } catch (e) {}

  // 2. Точки обхода: третья точка
  try {
    DB.patrol_points = DB.patrol_points || [];
    if (!DB.patrol_points.some(function (p) { return p.code === 'sklad1'; })) DB.patrol_points.push({ id: 3, name: 'Склад, 1 этаж', code: 'sklad1', active: true, sort: 3 });
  } catch (e) {}

  // 3. Расписание обходов (демо): обычное + два обхода в прошлом часе текущих суток охраны, чтобы были видны «выполнен» и «пропущен»
  try {
    var H = hourT(), dayStartH = 8, extra = [];
    [3, 1].forEach(function (back) { var hh = (H - back + 24) % 24; var since8 = (H - dayStartH + 24) % 24; if (back <= since8) extra.push(p2(hh) + ':00'); });
    var hs = DB.hotel_settings && DB.hotel_settings[0];
    if (hs) {
      var base = ['14:00', '18:00', '22:00', '00:00', '02:00', '04:00', '06:00'];
      extra.forEach(function (x) { if (base.indexOf(x) < 0) base.push(x); });
      hs.prefs = Object.assign({}, hs.prefs || {}, { patrol_times: base });
    }
    // отметки: обход ~3 ч назад — все три точки (Турсунбой), обход ~1 ч назад — только главный вход
    DB.patrol_scans = DB.patrol_scans || [];
    var now = Date.now(), hourStart = now - (now % 3600e3);   // UTC и Ташкент (UTC+5) совпадают по границе часа
    if (extra.length) {
      var r1 = hourStart - 3 * 3600e3, r2 = hourStart - 1 * 3600e3;
      if (extra.indexOf(p2((H - 3 + 24) % 24) + ':00') >= 0) [[1, 2], [2, 6], [3, 9]].forEach(function (x) { DB.patrol_scans.push({ id: ++seq, point_id: x[0], by_emp: 'e43', at: new Date(r1 + x[1] * 6e4).toISOString(), lat: 41.2906, lng: 69.2781 }); });
      if (extra.indexOf(p2((H - 1 + 24) % 24) + ':00') >= 0) DB.patrol_scans.push({ id: ++seq, point_id: 1, by_emp: 'e43', at: new Date(r2 + 4 * 6e4).toISOString(), lat: 41.2906, lng: 69.2781 });
    }
  } catch (e) {}

  // 4. Обёртка клиента: patrol_scan, страховка active у новой точки, смена охраны при приходе
  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__opsSec) return c; c.__opsSec = true;
    function meEmp() { var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null; try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {} return DB.employees.filter(function (e) { return a ? e.login === a[1] : s && e.user_id === s.user.id; })[0]; }
    var me0 = meEmp();
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (n === 'patrol_scan') {
        var pt = (DB.patrol_points || []).filter(function (p) { return p.code === a.p_code && p.active; })[0];
        if (!pt) return Promise.resolve({ data: { ok: false, msg: 'Точка не найдена' }, error: null });
        var at = new Date().toISOString();
        DB.patrol_scans.push({ id: ++seq, point_id: pt.id, by_emp: (me0 || {}).id, at: at, lat: a.p_lat, lng: a.p_lng });
        return Promise.resolve({ data: { ok: true, msg: pt.name + ' · ' + hhmm(at) }, error: null });
      }
      return rpc0.apply(this, arguments);
    };
    var from0 = c.from;
    c.from = function (t) {
      var q = from0.apply(this, arguments);
      if (t === 'patrol_points') { var ins0 = q.insert; q.insert = function (p) { return ins0.call(this, [].concat(p).map(function (x) { return Object.assign({ active: true }, x); })); }; }
      return q;
    };
    var inv0 = c.functions.invoke;
    c.functions.invoke = function (n, o) {
      var res = inv0.apply(this, arguments);
      if (n !== 'clock' || !o || !o.body || o.body.action !== 'in') return res;
      return Promise.resolve(res).then(function (r) {
        try {
          var me = me0; if (!me || me.dept_id !== 'sec' || !r || !r.data || !r.data.ok) return r;
          var a = DB.attendance.filter(function (x) { return x.employee_id === me.id && !x.clock_out; }).pop();
          var s = (DB.schedule || []).filter(function (x) { return x.employee_id === me.id && x.day === tday(); })[0];
          var k = s && s.kind && ['o', 'h', 'b'].indexOf(s.kind) < 0 ? s.kind : 'u';
          var st = (DB.shift_types || []).filter(function (x) { return x.dept_id === me.dept_id && x.code === k; })[0];
          if (a && st) { a.shift_kind = k; a.shift_start = st.start_time; a.shift_end = st.end_time; }
        } catch (e) {}
        return r;
      });
    };
    return c;
  };
})();
