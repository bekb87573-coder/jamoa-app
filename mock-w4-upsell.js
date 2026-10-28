// mock-w4-upsell.js — только демо (пакет w4-upsell, волна 04): учебные допродажи, прайс, рейтинг продавцов
// Прайс и бонус 5 % — ПРИМЕР, уточнить у директора.
(function () {
  var DB = window.__DB; if (!DB || !DB.employees) return;
  var TZ = 'Asia/Tashkent';
  var today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function iso(d, hm) { return new Date(d + 'T' + hm + ':00+05:00').toISOString(); }
  function byLogin(l) { return DB.employees.filter(function (e) { return e.login === l; })[0]; }
  var ym = today.slice(0, 7), dayN = +today.slice(8, 10);
  // день текущего месяца не позже сегодня
  function dIn(back) { return ym + '-' + ('0' + Math.max(1, dayN - back)).slice(-2); }

  // 1) прайс и бонус в настройках отеля
  var hs = (DB.hotel_settings || [])[0];
  if (hs) {
    hs.prefs = Object.assign({}, hs.prefs || {});
    if (!hs.prefs.upsell_prices) hs.prefs.upsell_prices = { upgrade: 300000, late_co: 250000, early_ci: 250000, transfer: 150000, breakfast: 120000, dinner: 250000, celebr: 300000, other: 0 };
    if (hs.prefs.upsell_bonus_pct == null) hs.prefs.upsell_bonus_pct = 5;
  }

  // 2) учебные записи: 14 за текущий месяц (3 проведены в Fidelio) + 8 за прошлый месяц для сравнения
  if (!DB.upsells) {
    var rooms = (DB.pms_rooms || []).map(function (r) { return r.no; });
    function room(i) { var pref = ['305', '412', '207', '604', '511', '308', '702', '215', '409', '806', '310', '503', '614', '220']; var r = pref[i % pref.length]; return rooms.length && rooms.indexOf(r) < 0 ? rooms[(i * 7) % rooms.length] : r; }
    var z = byLogin('zikrullo.b'), sk = byLogin('shaxriyor.k'), da = byLogin('dilshodbek.a'), si = byLogin('shoxrux.i');
    var P = hs && hs.prefs.upsell_prices || {};
    var plan = [
      [z, 'late_co', 0, '11:40', 'new'], [z, 'upgrade', 0, '15:10', 'new'], [z, 'transfer', 2, '09:20', 'posted'], [z, 'early_ci', 4, '08:05', 'new'], [z, 'late_co', 7, '11:55', 'posted'], [z, 'upgrade', 11, '14:30', 'new'],
      [sk, 'upgrade', 1, '16:20', 'new'], [sk, 'late_co', 3, '10:45', 'new'], [sk, 'celebr', 6, '19:10', 'posted'], [sk, 'transfer', 9, '06:30', 'new'],
      [da, 'dinner', 0, '20:15', 'new'], [da, 'breakfast', 5, '08:40', 'new'], [da, 'dinner', 8, '21:05', 'new'],
      [si, 'upgrade', 2, '13:00', 'new']
    ];
    var seq = 9000, out = [];
    plan.forEach(function (p, i) {
      if (!p[0]) return;
      var d = dIn(p[2]), at = iso(d, p[3]);
      if (d === today && Date.parse(at) > Date.now()) at = new Date(Date.now() - (i + 1) * 9 * 6e4).toISOString();
      out.push({ id: ++seq, room_no: p[1] === 'dinner' && i === 12 ? null : room(i), kind: p[1], amount: P[p[1]] || 150000, emp_id: p[0].id, at: at, status: p[4], note: p[1] === 'celebr' ? 'Годовщина свадьбы, торт и цветы' : null, created_at: at });
    });
    var pm = addDays(ym + '-01', -1).slice(0, 7);
    [[z, 'late_co', '03'], [z, 'upgrade', '09'], [z, 'transfer', '14'], [sk, 'upgrade', '05'], [sk, 'late_co', '18'], [da, 'dinner', '11'], [da, 'breakfast', '22'], [si, 'early_ci', '25']].forEach(function (p, i) {
      if (!p[0]) return; var at = iso(pm + '-' + p[2], '12:00');
      out.push({ id: ++seq, room_no: room(i + 3), kind: p[1], amount: P[p[1]] || 150000, emp_id: p[0].id, at: at, status: 'posted', note: null, created_at: at });
    });
    DB.upsells = out;
  }

  // 3) RPC: рейтинг продавцов (агрегат без чужих сумм по строкам) и строка в сводке руководителя
  var prev = window.supabase && window.supabase.createClient;
  if (!prev) return;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), rpc0 = c.rpc;
    if (c.__upsWrapped) return c; c.__upsWrapped = true;
    c.rpc = function (n, a) {
      if (n === 'upsell_rating') {
        a = a || {}; var from = a.p_from || '0000', to = a.p_to || '9999', m = {};
        (DB.upsells || []).forEach(function (x) {
          if (x.status === 'void') return; var d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(x.at));
          if (d < from || d > to) return; var o = m[x.emp_id] = m[x.emp_id] || { emp_id: x.emp_id, n: 0, sum: 0 }; o.n++; o.sum += +x.amount || 0;
        });
        var list = Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return y.sum - x.sum; });
        return Promise.resolve({ data: list, error: null });
      }
      var res = rpc0.apply(c, arguments);
      if (n === 'mgr_brief') return Promise.resolve(res).then(function (r) {
        if (!r || !r.data) return r;
        var y = addDays(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()), -1), ny = 0, sy = 0, w = 0;
        (DB.upsells || []).forEach(function (x) {
          if (x.status === 'void') return; if (x.status === 'new') w++;
          if (new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(x.at)) === y) { ny++; sy += +x.amount || 0; }
        });
        r.data.upsell = { n_y: ny, sum_y: sy, wait: w };
        return r;
      });
      return res;
    };
    return c;
  };
})();
