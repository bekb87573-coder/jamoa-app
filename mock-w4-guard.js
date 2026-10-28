/* Mir Luxe One — демо-мок пакета w4-guard (волна 04).
   Подключается после остальных mock-*.js. Оборачивает window.supabase.createClient цепочкой:
   - rpc('list_problems') / rpc('problem_reply'): «Сообщить о проблеме» (анонимные — без автора для всех, кроме самого автора);
   - rpc('stock_levels') / rpc('stock_move'): склад (остатки = сумма движений), сид 8 позиций;
   - from(t).insert: проставляет `at` для журналов, где выборка идёт по `at`;
   - rpc('mgr_brief'): у не-директора money = {}, staff.total без директора. */
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !window.supabase.createClient) return;
  function tzDay(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d || new Date()); }
  function emp(id) { return (DB.employees || []).filter(function (e) { return e.id === id; })[0] || null; }
  function byLogin(l) { return (DB.employees || []).filter(function (e) { return e.login === l; })[0] || null; }
  var AS0 = /as=([a-z0-9._]+)/.exec(location.hash || '');
  function me() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || '') || AS0, uid = null;
    if (a) return byLogin(a[1]);
    try { var s = JSON.parse(localStorage.getItem('mock-session')); uid = s && s.user && s.user.id; } catch (x) {}
    return (DB.employees || []).filter(function (x) { return x.user_id === uid; })[0] || null;
  }
  function nextId(t) { var m = 0; (DB[t] || []).forEach(function (r) { if (typeof r.id === 'number' && r.id > m) m = r.id; }); return Math.max(m, 9000) + 1; }
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function iso(daysAgo, hh) { var d = new Date(Date.now() - daysAgo * 864e5); return tzDay(d) + 'T' + (hh || '10:00') + ':00+05:00'; }

  // ---- сид «Проблемы» ----
  DB.problem_reports = DB.problem_reports || [];
  if (!DB.problem_reports.length) {
    var b = byLogin('barno.r'), d = byLogin('dilshodbek.a'), z = byLogin('zikrullo.b');
    if (b) DB.problem_reports.push({ id: 801, category: 'Конфликт', text: 'Старший смены повышает голос на горничных при гостях.', place: 'Этаж 4', anonymous: true, dept_id: b.dept_id, created_by: b.id, status: 'new', reply: null, photo_path: null, created_at: iso(1, '16:20') });
    if (d) DB.problem_reports.push({ id: 802, category: 'Жалоба гостя', text: 'Гость жалуется на шум из бара после 23:00.', place: '305', anonymous: false, dept_id: d.dept_id, created_by: d.id, status: 'seen', reply: 'Поговорим с баром, ограничим громкость после 22:30.', photo_path: null, created_at: iso(2, '23:40') });
    if (z) DB.problem_reports.push({ id: 803, category: 'Идея', text: 'Поставить на ресепшене зарядку для телефонов гостей.', place: 'Ресепшен', anonymous: false, dept_id: z.dept_id, created_by: z.id, status: 'new', reply: null, photo_path: null, created_at: iso(0, '09:15') });
  }
  function listProblems() {
    var m = me(); if (!m) return { data: [], error: null };
    var dir = m.role === 'director', mgr = m.role === 'manager', dp = m.lead_dept || m.dept_id;
    var out = DB.problem_reports.filter(function (p) {
      if (p.created_by === m.id) return true;
      if (dir) return true;
      if (mgr) return p.dept_id === dp || p.dept_id === m.dept_id;
      return false;
    }).map(function (p) {
      if (!p.status) p.status = 'new'; /* на сервере — значение по умолчанию */
      var r = JSON.parse(JSON.stringify(p)); r.mine = p.created_by === m.id;
      if (p.anonymous && !r.mine) r.created_by = null;
      return r;
    }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    return { data: out, error: null };
  }
  function problemReply(a) {
    var m = me(), p = DB.problem_reports.filter(function (x) { return x.id === +a.p_id; })[0];
    if (!m || !p) return { data: { ok: false }, error: null };
    var can = m.role === 'director' || (m.role === 'manager' && (p.dept_id === m.dept_id || p.dept_id === m.lead_dept));
    if (!can) return { data: { ok: false }, error: null };
    p.status = a.p_status || p.status; p.reply = a.p_reply || null; p.replied_by = m.id; p.replied_at = new Date().toISOString();
    if (p.created_by && p.created_by !== m.id) {
      DB.notifications = DB.notifications || [];
      DB.notifications.push({ id: nextId('notifications'), employee_id: p.created_by, ref_type: 'problem', ref_id: p.id, title: p.status === 'resolved' ? 'Ваше сообщение: решено' : 'Ваше сообщение рассматривается', body: p.reply || p.category, urgent: false, at: new Date().toISOString(), read_at: null });
    }
    return { data: { ok: true }, error: null };
  }

  // ---- склад ----
  DB.stock_items = DB.stock_items || []; DB.stock_moves = DB.stock_moves || [];
  if (!DB.stock_items.length) {
    [['Полотенце банное', 'шт', 'hk', 'Бельё', 60, 140, 45000],
     ['Шампунь 30 мл', 'шт', 'hk', 'Косметика', 100, 80, 3500],
     ['Туалетная бумага', 'рул', 'hk', 'Номер', 80, 210, 2800],
     ['Кофе в зёрнах', 'кг', 'kitchen', 'Продукты', 5, 7, 210000],
     ['Сахар в стиках', 'уп', 'fnb', 'Продукты', 10, 4, 38000],
     ['Моющее для полов', 'л', 'hk', 'Химия', 20, 26, 24000],
     ['Лампа E27', 'шт', 'eng', 'Тех. запчасти', 30, 12, 18000],
     ['Батарейки АА', 'шт', 'eng', 'Тех. запчасти', 40, 64, 4000]
    ].forEach(function (x, i) {
      var id = 701 + i;
      DB.stock_items.push({ id: id, name: x[0], unit: x[1], dept_id: x[2], category: x[3], min_qty: x[4], price: x[6], sale_price: null, created_at: iso(30) });
      DB.stock_moves.push({ id: 7100 + i, item_id: id, kind: 'in', qty: x[5] + Math.round(x[5] * 0.4), reason: 'Остаток на начало', room_no: null, by_emp: null, at: iso(20, '09:00') });
      DB.stock_moves.push({ id: 7200 + i, item_id: id, kind: 'out', qty: Math.round(x[5] * 0.4), reason: 'Расход', room_no: null, by_emp: null, at: iso(3, '12:00') });
    });
  }
  function qtyOf(id) { return DB.stock_moves.reduce(function (s, m) { if (m.item_id !== id) return s; var q = +m.qty || 0; return s + (m.kind === 'in' ? q : m.kind === 'count' ? q : -q); }, 0); }
  function stockLevels() {
    var since = new Date(Date.now() - 30 * 864e5).toISOString();
    return { data: DB.stock_items.map(function (x) {
      var mv = DB.stock_moves.filter(function (m) { return m.item_id === x.id; });
      var out30 = mv.filter(function (m) { return (m.kind === 'out' || m.kind === 'writeoff') && String(m.at) >= since; }).reduce(function (s, m) { return s + (+m.qty || 0); }, 0);
      var cnt = mv.filter(function (m) { return m.kind === 'count'; }).map(function (m) { return m.at; }).sort().pop() || null;
      var q = Math.round(qtyOf(x.id) * 100) / 100, mn = +x.min_qty || 0;
      return { id: x.id, name: x.name, unit: x.unit, dept_id: x.dept_id, category: x.category || 'Другое', min: mn, min_qty: mn, qty: q, low: mn > 0 && q < mn, out30: out30, last: cnt, price: x.price, sale: x.sale_price };
    }), error: null };
  }
  function stockMove(a) {
    var m = me(), x = DB.stock_items.filter(function (i) { return i.id === +a.p_item; })[0];
    if (!x) return { data: null, error: { message: 'Товар не найден' } };
    var q = +a.p_qty; if (!isFinite(q) || q < 0) return { data: null, error: { message: 'Проверьте число' } };
    var cur = qtyOf(x.id), row = { id: nextId('stock_moves'), item_id: x.id, kind: a.p_kind, qty: q, reason: a.p_reason || null, room_no: a.p_room || null, by_emp: m ? m.id : null, at: new Date().toISOString() };
    if (a.p_kind === 'count') { row.qty = q - cur; row.counted = q; }
    // для count храним разницу как отдельный тип, чтобы qtyOf считал корректно
    if (a.p_kind === 'count') { row.kind = 'count'; }
    DB.stock_moves.push(row);
    return { data: { ok: true, qty: Math.round(qtyOf(x.id) * 100) / 100, guest: null }, error: null };
  }

  var AT_TABLES = ['temp_logs', 'stock_moves', 'writeoffs', 'patrol_scans', 'task_events', 'upsells', 'reviews'];
  var prev = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), w = Object.create(c);
    w.rpc = function (n, a) {
      if (n === 'list_problems') return Promise.resolve(listProblems());
      if (n === 'problem_reply') return Promise.resolve(problemReply(a || {}));
      if (n === 'stock_levels') return Promise.resolve(stockLevels());
      if (n === 'stock_move') return Promise.resolve(stockMove(a || {}));
      if (n === 'mgr_brief') {
        return Promise.resolve(c.rpc.apply(c, arguments)).then(function (r) {
          try {
            var m = me(), d = r && r.data;
            if (d && m) {
              if (m.role !== 'director') d.money = {};
              if (d.staff) d.staff.total = (DB.employees || []).filter(function (e) { return e.active !== false && e.role !== 'director'; }).length;
            }
          } catch (x) {}
          return r;
        });
      }
      return c.rpc.apply(c, arguments);
    };
    w.from = function (t) {
      var q = c.from.apply(c, arguments);
      if (AT_TABLES.indexOf(t) < 0) return q;
      var ins0 = q.insert;
      q.insert = function (p) { var now = new Date().toISOString(); [].concat(p).forEach(function (r) { if (r && r.at == null) r.at = now; }); return ins0.call(q, p); };
      return q;
    };
    return w;
  };
})();
