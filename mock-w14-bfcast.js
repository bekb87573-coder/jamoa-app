/* w14-bfcast: демо «Прогноз завтрака» — RPC breakfast_forecast (тот же контракт, что в sql/migration.sql).
   Подключается после mock-w9-breakfast.js (нужны брони с полем meal и breakfast_days).
   Данные строятся от сегодняшнего дня (Asia/Tashkent), детерминированно:
   - история закрытых завтраков за 21 день (breakfast_days.totals) — для «обычно приходят N %»;
   - группа «Dolores Travel» (заезд сегодня, 3 ночи, ранний завтрак 06:30) и группа «Silk Road Tours» (через 4 дня, HB);
   - вчерашний снимок прогноза (без группы Dolores) — для подсказки «Прогноз на завтра вырос на N (группа …)». */
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !DB.pms_bookings) return;
  var TZ = 'Asia/Tashkent';
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function add(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function nowHM() { return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
  function rnd(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function prefs() { return (((DB.hotel_settings || [])[0] || {}).prefs) || {}; }
  DB.breakfast_days = DB.breakfast_days || []; DB.breakfast_forecast_snaps = DB.breakfast_forecast_snaps || [];

  // тариф питания: meal из Fidelio; если пусто — по коду тарифа (…RO…), иначе как BB (так же считает сервер)
  function meal(b) { if (b.meal) return b.meal; if (b.rate_code && /(^|[^A-Z])RO([^A-Z]|$)/i.test(b.rate_code)) return 'RO'; return 'BB'; }
  function live(b, day) { return b.status !== 'cancelled' && b.status !== 'noshow' && b.arrival < day && b.departure >= day; }
  // кто завтракает утром day: ночевал с прошлой ночи (живёт + заехал вчера), выезжающий в этот день тоже; номер считаем один раз
  function guests(day, skip) {
    var seen = {}, L = DB.pms_bookings.filter(function (b) { return live(b, day) && !(skip && skip(b)); })
      .sort(function (x, y) { return ((y.status === 'inhouse') - (x.status === 'inhouse')) || (y.id - x.id); })
      .filter(function (b) { if (!b.room_no) return true; if (seen[b.room_no]) return false; seen[b.room_no] = 1; return true; });
    var o = { day: day, rooms: 0, adults: 0, children: 0, incl_adults: 0, incl_children: 0, ro_adults: 0, ro_children: 0, groups: {} };
    L.forEach(function (b) {
      var a = b.adults == null ? 1 : +b.adults || 0, c = +b.children || 0, inc = meal(b) !== 'RO';
      o.rooms++; o.adults += a; o.children += c;
      if (inc) { o.incl_adults += a; o.incl_children += c; } else { o.ro_adults += a; o.ro_children += c; }
      var g = b.group_name && String(b.group_name).trim();
      if (g) {
        var G = o.groups[g] || (o.groups[g] = { name: g, rooms: 0, adults: 0, children: 0, incl: 0, arrival: b.arrival, departure: b.departure, early: null });
        G.rooms++; G.adults += a; G.children += c; if (inc) G.incl += a + c;
        if (b.arrival < G.arrival) G.arrival = b.arrival; if (b.departure > G.departure) G.departure = b.departure;
        var m = /[Рр]анн\S*\s+завтрак\D{0,5}(\d{1,2})[:.](\d{2})/.exec(b.notes || ''); if (m && !G.early) G.early = ('0' + m[1]).slice(-2) + ':' + m[2];
      }
    });
    return o;
  }

  // ---------- демо-данные (один раз)
  if (!DB.__bfc_seed) {
    DB.__bfc_seed = 1;
    // 1) группы: свободные на весь срок номера
    var seq = 990000;
    function freeRooms(from, to) {
      return (DB.pms_rooms || []).map(function (r) { return String(r.no); }).filter(function (no) {
        return !DB.pms_bookings.some(function (b) { return String(b.room_no) === no && b.status !== 'cancelled' && b.status !== 'noshow' && b.arrival < to && b.departure > from; });
      }).sort();
    }
    function group(name, arr, nights, n, ad, ch, ml, note, src) {
      var dep = add(arr, nights), R = freeRooms(arr, dep).slice(0, n);
      R.forEach(function (no, i) {
        DB.pms_bookings.push({ id: ++seq, status: 'confirmed', last_name: name, first_name: '#' + (i + 1), room_no: no, room_type: 'STD', adults: ad, children: i < ch ? 1 : 0,
          rate: 950000, arrival: arr, departure: dep, source: src, company: name, notes: note, status_note: null, meal: ml, rate_code: ml === 'HB' ? 'GRP-HB' : 'GRP-BB', group_name: name });
      });
    }
    group('Dolores Travel', T, 3, 12, 2, 2, 'BB', 'Группа Dolores Travel · ранний завтрак 06:30 · автобус в 07:15', 'Турагентство');
    group('Silk Road Tours', add(T, 4), 2, 8, 2, 0, 'HB', 'Группа Silk Road Tours', 'Турагентство');
    // 2) история закрытых завтраков за 21 день — явка 74–86 %, платные 1–4 чел. на месте и 0–2 в счёт номера
    var price = +prefs().breakfast_price || 120000;
    for (var k = 21; k >= 1; k--) {
      var d = add(T, -k); if (DB.breakfast_days.some(function (x) { return x.day === d; })) continue;
      var g = guests(d), exp = g.incl_adults + g.incl_children, f = 0.74 + rnd(k) * 0.12, came = Math.round(exp * f);
      var cashP = 1 + Math.floor(rnd(k + 50) * 4), roomP = Math.floor(rnd(k + 90) * 3);
      var rooms = DB.pms_bookings.filter(function (b) { return live(b, d) && b.room_no && meal(b) !== 'RO'; }).map(function (b) { return String(b.room_no); });
      rooms = rooms.filter(function (x, i) { return rooms.indexOf(x) === i; }).sort();
      var nos = rooms.filter(function (x, i) { return rnd(k * 100 + i) > f; });
      DB.breakfast_days.push({ day: d, closed_at: d + 'T10:4' + (k % 10) + ':00+05:00', closed_by: k % 3 ? 'e33' : 'e32', seed_bfc: 1,
        totals: { day: d, exp_rooms: rooms.length, exp_persons: exp, incl_persons: came, incl_rooms: rooms.length - nos.length, cash_persons: cashP, cash_amount: cashP * price,
          room_persons: roomP, room_amount: roomP * price, noshow: nos, charges: roomP && rooms[0] ? [{ room: rooms[k % rooms.length], persons: roomP, amount: roomP * price, ref: 'чек ' + (180 + k) }] : [] } });
    }
  }

  // ---------- расчёт прогноза — как breakfast_forecast() на сервере
  var MIN_DAYS = 7, WIN = 28, CHANGE_MIN = 10;
  function settings() {
    var p = prefs(), pct = +p.bfc_pct, fin = /^\d\d:\d\d$/.test(p.bfc_final || '') ? p.bfc_final : '20:00';
    return { pct: pct >= 30 && pct <= 100 ? pct : 85, kids: p.bfc_kids !== false && p.bfc_kids !== 'false', final: fin };
  }
  function history() {
    var from = add(T, -WIN), n = 0, se = 0, si = 0, sp = 0;
    DB.breakfast_days.forEach(function (x) {
      var t = x.totals || {}; if (!(x.day >= from && x.day < T) || !(+t.exp_persons > 0)) return;
      n++; se += +t.exp_persons; si += Math.min(+t.incl_persons || 0, +t.exp_persons); sp += (+t.cash_persons || 0) + (+t.room_persons || 0);
    });
    return { days: n, exp: se, came: si, paid: sp };
  }
  function calc(day, s, pct, paidAvg, skip) {
    var g = guests(day, skip), base = g.incl_adults + (s.kids ? g.incl_children : 0), ro = g.ro_adults + (s.kids ? g.ro_children : 0);
    var expIncl = Math.round(base * pct / 100), paid = paidAvg == null ? null : Math.round(paidAvg);
    return { day: day, rooms: g.rooms, adults: g.adults, children: g.children, incl_adults: g.incl_adults, incl_children: g.incl_children, ro_adults: g.ro_adults, ro_children: g.ro_children,
      with_bf: base, without_bf: ro, exp_incl: expIncl, paid: paid, expected: expIncl + (paid || 0),
      groups: Object.keys(g.groups).sort().map(function (k) { var G = g.groups[k]; return { name: G.name, rooms: G.rooms, adults: G.adults, children: G.children, persons: G.adults + G.children, incl: G.incl, arrival: G.arrival, departure: G.departure, early: G.early }; }) };
  }
  function forecast(nd) {
    nd = Math.max(1, Math.min(14, +nd || 7));
    var s = settings(), H = history(), enough = H.days >= MIN_DAYS && H.exp > 0;
    var pct = enough ? Math.round(100 * H.came / H.exp) : s.pct, paidAvg = enough ? H.paid / H.days : null;
    // вчерашний снимок (в демо — один раз: тот же расчёт, но группа Dolores Travel ещё не была забронирована)
    if (!DB.breakfast_forecast_snaps.some(function (z) { return z.calc_day === add(T, -1); })) {
      for (var j = 1; j <= nd; j++) { var y = calc(add(T, j - 1), s, pct, paidAvg, function (b) { return b.group_name === 'Dolores Travel'; });
        DB.breakfast_forecast_snaps.push({ calc_day: add(T, -1), for_day: y.day, persons: y.with_bf + y.without_bf, expected: y.expected, groups: y.groups.map(function (g) { return { name: g.name, persons: g.persons }; }), at: add(T, -1) + 'T21:00:00+05:00' }); }
    }
    var days = [];
    for (var i = 1; i <= nd; i++) days.push(calc(add(T, i), s, pct, paidAvg));
    // снимок сегодняшнего расчёта (последний за день) — завтра с ним сравнят
    days.forEach(function (x) {
      DB.breakfast_forecast_snaps = DB.breakfast_forecast_snaps.filter(function (z) { return !(z.calc_day === T && z.for_day === x.day); });
      DB.breakfast_forecast_snaps.push({ calc_day: T, for_day: x.day, persons: x.with_bf + x.without_bf, expected: x.expected, groups: x.groups.map(function (g) { return { name: g.name, persons: g.persons }; }), at: new Date().toISOString() });
    });
    var tm = days[0], prev = DB.breakfast_forecast_snaps.filter(function (z) { return z.calc_day === add(T, -1) && z.for_day === tm.day; })[0], change = null;
    if (prev && Math.abs(tm.expected - prev.expected) >= CHANGE_MIN) {
      var pn = (prev.groups || []).map(function (g) { return g.name; }), cn = tm.groups.map(function (g) { return g.name; });
      change = { day: tm.day, prev: prev.expected, now: tm.expected, delta: tm.expected - prev.expected,
        groups_new: tm.groups.filter(function (g) { return pn.indexOf(g.name) < 0; }).map(function (g) { return { name: g.name, persons: g.persons }; }),
        groups_gone: (prev.groups || []).filter(function (g) { return cn.indexOf(g.name) < 0; }) };
    }
    return { today: T, now: nowHM(), final_at: s.final, is_final: nowHM() >= s.final, kids: s.kids, pct: pct, pct_default: s.pct, pct_src: enough ? 'hist' : 'default',
      hist_days: H.days, min_days: MIN_DAYS, window: WIN, paid_avg: paidAvg == null ? null : Math.round(paidAvg * 10) / 10, change_min: CHANGE_MIN,
      week: days.reduce(function (a, x) { return a + x.expected; }, 0), days: days, change: change };
  }
  // кто видит — как bfc_role() на сервере: директор, F&B (официанты, хостес, F&B-менеджер), кухня, закупщик (purch_access)
  function meEmp() { try { var s = JSON.parse(localStorage.getItem('mock-session')); return DB.employees.filter(function (z) { return s && z.user_id === s.user.id; })[0] || null; } catch (x) { return null; } }
  function canSee(e) {
    if (!e || e.active === false) return false;
    var pos = ((DB.positions || []).filter(function (q) { return q.id === e.position_id; })[0] || {});
    return e.role === 'director' || e.dept_id === 'fnb' || e.lead_dept === 'fnb' || e.dept_id === 'kitchen' || e.lead_dept === 'kitchen' || pos.purch_access === true || pos.name === 'Закупки и логистика';
  }
  var make = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = make.apply(this, arguments);
    if (c.__bfc) return c; c.__bfc = 1;
    var rpc = c.rpc;
    c.rpc = function (n, a) {
      if (n === 'breakfast_forecast') {
        if (!canSee(meEmp())) return Promise.resolve({ data: null, error: { message: 'Нет доступа' } });
        return Promise.resolve({ data: JSON.parse(JSON.stringify(forecast(a && a.p_days))), error: null });
      }
      return rpc.call(c, n, a);
    };
    return c;
  };
})();
