// ops-fnb: дополнение демо-мока (журнал температур, списания, счёт в номер). Подключается сразу после demo-mock.js.
(function () {
  var DB = window.__DB; if (!DB || !window.supabase) return;
  var day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  function at(hm) { return day + 'T' + hm + ':00+05:00'; }
  var seq = 5000, chk = 210;
  // сид на сегодня
  DB.temp_logs = DB.temp_logs || []; DB.writeoffs = DB.writeoffs || [];
  if (!DB.temp_logs.some(function (l) { return l.seed_fnb; }))
    DB.temp_logs.push({ id: ++seq, seed_fnb: 1, unit_id: 2, temp: -19, by_emp: 'e27', at: at('07:40'), ok: true });
  if (!DB.writeoffs.some(function (w) { return w.seed_fnb; })) {
    DB.writeoffs.push({ id: ++seq, seed_fnb: 1, item: 'Зелень (кинза)', qty: 0.5, unit: 'кг', reason: 'Истёк срок годности', cost: 15000, photo_path: null, dept_id: 'kitchen', status: 'new', by_emp: 'e27', at: at('08:15') });
    DB.writeoffs.push({ id: ++seq, seed_fnb: 1, item: 'Сливки 33%', qty: 2, unit: 'л', reason: 'Испорчено при хранении', cost: 96000, photo_path: null, dept_id: 'kitchen', status: 'new', by_emp: 'e26', at: at('08:40') });
  }
  var make = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = make.apply(this, arguments);
    if (c.__fnb) return c; c.__fnb = 1;
    var from = c.from, rpc = c.rpc;
    c.from = function (t) {
      var q = from.call(c, t);
      if (t === 'temp_logs' || t === 'writeoffs') {
        var ins = q.insert;
        q.insert = function (p) {
          p = [].concat(p).map(function (r) {
            r = Object.assign({}, r); if (!r.at) r.at = new Date().toISOString();
            if (t === 'temp_logs' && r.ok == null) { var u = (DB.kitchen_units || []).filter(function (z) { return z.id === r.unit_id; })[0]; r.ok = u ? (r.temp >= u.t_min && r.temp <= u.t_max) : true; }
            return r;
          });
          return ins.call(this, p);
        };
      }
      return q;
    };
    c.rpc = function (n, a) {
      if (n === 'charge_to_room') return Promise.resolve({ data: 'чек ' + (++chk), error: null });
      return rpc.call(c, n, a);
    };
    return c;
  };
})();
