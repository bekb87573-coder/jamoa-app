/* Mir Luxe One — мок пакета w9-meters (волна 09): обход счётчиков с фото, ресурсы, ведомость.
   Демо: 9 учебных точек учёта по маршруту, 40 суток показаний (утренний обход), расход зависит от загрузки (ночной аудит Fidelio — DB.fid_days),
   чиллер к ноябрю работает меньше, отопление — больше; «утечка воды» в прачечной за последние 2 дня (+6,4 м³ в сутки).
   Вчера не сняли чиллер; сегодня сняты 3 из 9. Тарифы — учебные (их задаёт директор).
   Таблицы — как в sql/migration.sql (M47): meter_points (kind electric|water_cold|water_hot|gas, unit, factor, warn_pct, utility, name_uz), meter_readings (by_emp, at, photo_path).
   Дополнение M52 (changes.md): tariffs, meter_readings.maint_id, RPC meter_link_maint, meter_shift_report, meter_rooms.
   RPC ввода: meter_submit / meter_fix — ответы и коды ошибок как в sql/notes.md. Фото — storage «task-photos», путь <сотрудник>/meter-<точка>-<время>.jpg.
   Подключается после mock-w8-tails.js (после mock-w4-analytics.js — нужен DB.fid_days). */
(function () {
  var DB = window.__DB; if (!DB || DB.__w9MetersSeed) return; DB.__w9MetersSeed = true;
  var TZ = 'Asia/Tashkent', T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function add(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function rnd(n, k) { var x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
  // маршрут: подвал (электрощитовая → водомерный узел → котельная) → цоколь (прачечная) → кухня → двор (ГРП) → крыша
  var PTS = [
    ['m1', 1, 'Электричество · ввод', 'Электрощитовая, подвал', 'el', true, 0, 1284560],
    ['m2', 2, 'Вода · ввод', 'Водомерный узел, подвал', 'water', true, 1, 45812.4],
    ['m4', 3, 'Газ · котельная', 'Котельная, подвал', 'gas', false, 1, 204118],
    ['m5', 4, 'Вода · бойлер ГВС', 'Котельная, подвал', 'water', false, 1, 9431.6],
    ['m6', 5, 'Вода · прачечная', 'Прачечная, цокольный этаж', 'water', false, 1, 7205.3],
    ['m7', 6, 'Электричество · прачечная', 'Прачечная, цокольный этаж', 'el', false, 0, 182330],
    ['m8', 7, 'Электричество · кухня', 'Кухня, 1 этаж', 'el', false, 0, 241905],
    ['m3', 8, 'Газ · ввод', 'ГРП, хозяйственный двор', 'gas', true, 1, 318240],
    ['m9', 9, 'Электричество · чиллер', 'Крыша, техплощадка', 'el', false, 0, 612470]
  ];
  var KS = { el: 'electric', water: 'water_cold', gas: 'gas' }, UT = { el: 'Электросеть', water: 'Сувоканал', gas: 'Худудгаз' };
  var NUZ = { m1: 'Elektr · kirish', m2: 'Suv · kirish', m4: 'Gaz · qozonxona', m5: 'Suv · issiq suv qozoni', m6: 'Suv · kir yuvish', m7: 'Elektr · kir yuvish', m8: 'Elektr · oshxona', m3: 'Gaz · kirish', m9: 'Elektr · chiller' };
  DB.meter_points = PTS.map(function (p) { return { id: p[0], sort: p[1], name: p[2], name_uz: NUZ[p[0]], place: p[3], kind: KS[p[4]], unit: p[4] === 'el' ? 'кВт·ч' : 'м³', factor: 1, warn_pct: 30, utility: p[5] ? UT[p[4]] : null, active: true, serial: 'MLX-' + p[0].toUpperCase() + '-' + (4100 + p[1] * 37), created_at: '2026-09-01T09:00:00+05:00' }; });
  var fd = {}; (DB.fid_days || []).forEach(function (x) { fd[x.d] = x; });
  function occ(d) { var x = fd[d]; return x && x.rooms ? x.sold / ((x.rooms || 88) - (x.ooo || 0)) : 0.62; }
  var DAYS = 40, val = {}, rows = [], id = 0, photo = {};
  PTS.forEach(function (p) { val[p[0]] = p[7]; });
  var ENG = ['e38', 'e39', 'e40'];
  for (var k = DAYS; k >= 0; k--) {
    var d = add(T, -k), n = +d.replace(/-/g, '') % 100000, f = occ(add(d, -1)) / 0.62, wd = new Date(d + 'T00:00:00Z').getUTCDay();
    var z = function (a, i) { return a * (0.95 + 0.1 * rnd(n, i)); };
    var cool = k / DAYS;                                   // 1 — середина сентября, 0 — сегодня
    if (k < DAYS) {
      var leak = k <= 1 ? 6.4 : 0;                         // утечка в прачечной: вчера и сегодня
      var c = {};
      c.m8 = z(360 * (0.6 + 0.4 * f) * (wd === 0 ? 1.15 : 1), 1);
      c.m7 = z(290 * f, 2);
      c.m9 = z(520 + 930 * Math.pow(cool, 1.2), 3);
      c.m1 = z(1950 * (0.55 + 0.45 * f), 4) + c.m7 + c.m8 + c.m9;
      c.m6 = z(8.2 * f, 5) + leak;
      c.m5 = z(11.5 * f * (1 + 0.1 * (1 - cool)), 6);
      c.m2 = z(19 * f, 7) + c.m6 + c.m5;
      c.m4 = z(120 + 110 * (1 - cool), 8);
      c.m3 = c.m4 + z(48 * f, 9);
      Object.keys(c).forEach(function (pid) { val[pid] += c[pid]; });
    }
    var who = k === 0 ? 'e38' : k % 7 === 3 ? 'e37' : ENG[k % 3];
    PTS.forEach(function (p, i) {
      if (k === 0 && i > 2) return;                        // сегодня сняты 3 из 9
      if ((k === 1 && p[0] === 'm9') || (k === 19 && p[0] === 'm5')) return;  // пропуски: вчера чиллер, 19 дней назад — бойлер
      var mm = 8 * 60 + 18 + i * 5 + Math.floor(rnd(n, 20 + i) * 4), hh = Math.floor(mm / 60);
      var v = p[6] ? Math.round(val[p[0]] * 10) / 10 : Math.round(val[p[0]]);
      var path = (k === 6 && i === 4) || (k === 23 && i === 7) ? null : who + '/meter-' + p[0] + '-' + d.replace(/-/g, '') + '.jpg';   // 2 старых замера без фото — до M47
      if (path) photo[path] = { v: v, dec: p[6], kind: p[4], serial: 'MLX-' + p[0].toUpperCase() + '-' + (4100 + p[1] * 37) };
      rows.push({ id: ++id, point_id: p[0], day: d, value: v, photo_path: path, note: null, is_reset: false, by_emp: who, at: d + 'T' + (hh < 10 ? '0' : '') + hh + ':' + (mm % 60 < 10 ? '0' : '') + (mm % 60) + ':00+05:00', maint_id: null });
    });
  }
  DB.meter_readings = rows;
  DB.tariffs = [
    { id: 1, kind: 'el', name: 'Электроэнергия', unit: 'кВт·ч', price: 1000, valid_from: '2026-05-01', updated_by: 'e0' },
    { id: 2, kind: 'water', name: 'Вода и канализация', unit: 'м³', price: 7900, valid_from: '2026-05-01', updated_by: 'e0' },
    { id: 3, kind: 'gas', name: 'Природный газ', unit: 'м³', price: 1950, valid_from: '2026-05-01', updated_by: 'e0' }
  ];
  DB.meter_shift_reports = DB.meter_shift_reports || [];
  // ----- фото показаний: в демо — нарисованный счётчик с цифрами показания -----
  function face(o) {
    var txt = Number(o.v).toFixed(o.dec || 0).split('.'), ip = txt[0], dp = txt[1] || '', W = 400, H = 260, cells = '';
    var all = ip.split('').map(function (c) { return [c, 0]; }).concat(dp.split('').map(function (c) { return [c, 1]; }));
    var cw = 34, gap = 4, tw = all.length * (cw + gap) - gap, x0 = (W - tw) / 2;
    all.forEach(function (a, i) { var x = x0 + i * (cw + gap); cells += '<rect x="' + x + '" y="98" width="' + cw + '" height="54" rx="4" fill="' + (a[1] ? '#B8913F' : '#101114') + '"/><text x="' + (x + cw / 2) + '" y="137" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="' + (a[1] ? '#101114' : '#F2EEE6') + '">' + a[0] + '</text>'; });
    var unit = o.kind === 'el' ? 'kWh' : 'm³', lab = o.kind === 'el' ? 'ЭНЕРГОМЕРА · CE 303' : o.kind === 'gas' ? 'ГАЗ · G16 BK' : 'ВОДА · ВСХН-50';
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5A5E66"/><stop offset="1" stop-color="#2A2C31"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="#1C1D21"/><rect x="26" y="22" width="348" height="216" rx="18" fill="url(#g)" stroke="#7A7E86" stroke-width="2"/><rect x="44" y="84" width="312" height="82" rx="8" fill="#D9D6CE"/>' +
      '<text x="200" y="60" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="#E7E2D6" text-anchor="middle" letter-spacing="2">' + lab + '</text>' + cells +
      '<text x="336" y="186" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="#E7E2D6" text-anchor="end">' + unit + '</text><text x="64" y="186" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#B9B4A8">№ ' + o.serial + '</text>' +
      '<circle cx="64" cy="214" r="6" fill="#B8913F" opacity=".8"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  var upl = {};
  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w9meters) return c; c.__w9meters = true;
    function meEmp() {
      var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null;
      try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {}
      return (DB.employees || []).filter(function (e) { return a ? e.login === a[1] : s && e.user_id === s.user.id; })[0];
    }
    function emp(x) { return (DB.employees || []).filter(function (e) { return e.id === x; })[0]; }
    var seq = 90000;
    // показание за день — одно на точку (upsert по point_id+day сохраняет id)
    var from0 = c.from;
    c.from = function (t) {
      var q = from0.apply(this, arguments);
      if (t === 'meter_readings' || t === 'tariffs') {
        var up0 = q.upsert;
        q.upsert = function (p, o) {
          var key = t === 'tariffs' ? ['kind'] : ['point_id', 'day'];
          p = [].concat(p).map(function (x) {
            var ex = (DB[t] || []).filter(function (r) { return key.every(function (k) { return r[k] === x[k]; }); })[0];
            return Object.assign({ id: ex ? ex.id : ++seq }, x);
          });
          var self = this, r = up0.call(this, p, o), keep = p;
          var then0 = r.then;
          r.then = function (res, rej) {
            return then0.call(self, function (out) {
              if (out && !out.error) out = { data: keep.map(function (x) { return (DB[t] || []).filter(function (r2) { return r2.id === x.id; })[0] || x; }), error: null };
              return res ? res(out) : out;
            }, rej);
          };
          return r;
        };
      }
      return q;
    };
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      a = a || {};
      if (n === 'meter_submit' || n === 'meter_fix') {
      var me2 = meEmp(), R = DB.meter_readings, now = new Date().toISOString();
      if (!me2) return Promise.resolve({ data: null, error: { message: 'Нет сессии' } });
      if (a.p_value == null || a.p_value < 0) return Promise.resolve({ data: null, error: { message: 'Нужно показание' } });
      var cur = n === 'meter_fix' ? R.filter(function (r) { return r.id === a.p_id; })[0] : null;
      var pid = cur ? cur.point_id : a.p_point, day = cur ? cur.day : T;
      if (!cur && !a.p_photo) return Promise.resolve({ data: null, error: { message: 'Нужно фото' } });
      if (!(DB.meter_points || []).some(function (p) { return p.id === pid && p.active; })) return Promise.resolve({ data: { ok: false, code: 'no_point' }, error: null });
      var ex = R.filter(function (r) { return r.point_id === pid && r.day === day; })[0];
      if (!cur && ex) return Promise.resolve({ data: { ok: false, code: 'exists', id: ex.id, value: ex.value }, error: null });
      var prv = R.filter(function (r) { return r.point_id === pid && r.day < day; }).sort(function (x, y) { return x.day < y.day ? 1 : -1; })[0];
      if (prv && +a.p_value < +prv.value) return Promise.resolve({ data: { ok: false, code: 'less', prev: prv.value, prev_day: prv.day }, error: null });
      var nxt = R.filter(function (r) { return r.point_id === pid && r.day > day; }).sort(function (x, y) { return x.day > y.day ? 1 : -1; })[0];
      if (nxt && +a.p_value > +nxt.value) return Promise.resolve({ data: { ok: false, code: 'more_next', next: nxt.value }, error: null });
      if (cur) { if (cur.old_value == null) cur.old_value = cur.value; cur.value = +a.p_value; if (a.p_photo) cur.photo_path = a.p_photo; cur.fixed_by = me2.id; cur.fixed_at = now; }
      else { cur = { id: ++seq, point_id: pid, day: day, value: +a.p_value, photo_path: a.p_photo, note: a.p_note || null, is_reset: !!a.p_reset, by_emp: me2.id, at: now, maint_id: null }; R.push(cur); }
      var dlt = prv ? +cur.value - +prv.value : null;
      var left = (DB.meter_points || []).filter(function (p) { return p.active && !R.some(function (r) { return r.point_id === p.id && r.day === T; }); }).length;
      return Promise.resolve({ data: { ok: true, id: cur.id, delta: dlt, per_day: dlt, left: left }, error: null });
    }
    if (n === 'meter_link_maint') {
      var rr = DB.meter_readings.filter(function (r) { return r.id === a.p_id; })[0];
      if (rr) rr.maint_id = a.p_maint;
      return Promise.resolve({ data: { ok: !!rr }, error: null });
    }
    if (n === 'meter_rooms') {
        var out = (DB.fid_days || []).filter(function (x) { return x.d >= a.p_from && x.d <= a.p_to; }).map(function (x) { return { d: x.d, sold: x.sold }; });
        return Promise.resolve({ data: out, error: null });
      }
      if (n === 'meter_shift_report') {
        var me = meEmp(); if (!me) return Promise.resolve({ data: null, error: { message: 'Нет сессии' } });
        var boss = emp(me.manager_id);
        if (!boss || boss.id === me.id) boss = (DB.employees || []).filter(function (e) { return e.role === 'director'; })[0];
        DB.meter_shift_reports.push({ id: ++seq, day: a.p_day, by_emp: me.id, to_id: boss && boss.id, at: new Date().toISOString(), text: a.p_text || '', note: a.p_note || null, missed: a.p_missed || [] });
        DB.notifications = DB.notifications || [];
        if (boss) DB.notifications.push({ id: ++seq, employee_id: boss.id, at: new Date().toISOString(), title: 'Счётчики: смена сдана', body: me.first_name + ': ' + String(a.p_text || '').slice(0, 300) + (a.p_note ? ' Заметка: ' + a.p_note : ''), ref_type: 'meters', ref_id: null, urgent: false, read_at: null });
        return Promise.resolve({ data: { ok: true, to: boss && boss.id }, error: null });
      }
      return rpc0.apply(this, arguments);
    };
    var st0 = c.storage.from;
    c.storage = Object.assign({}, c.storage, { from: function (b) {
      var o = st0.apply(this, arguments);
      return Object.assign({}, o, {
        upload: function (path, blob) { if (/\/meter-/.test(path) && blob) { try { upl[path] = URL.createObjectURL(blob); } catch (e) {} } return o.upload.apply(this, arguments); },
        createSignedUrl: function (path) {
          if (upl[path]) return Promise.resolve({ data: { signedUrl: upl[path] }, error: null });
          if (photo[path]) return Promise.resolve({ data: { signedUrl: face(photo[path]) }, error: null });
          return o.createSignedUrl.apply(this, arguments);
        }
      });
    } });
    return c;
  };
})();
