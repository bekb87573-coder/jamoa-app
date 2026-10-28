/* Mir Luxe One — мок пакета w12-shiftswap (волна 12, идея №2 «Обмен сменами»).
   Таблица shift_exchanges (НЕ shift_swaps — её занял w9-swap «Срочная замена»), колонка schedule.xchg_id — метка «обмен».
   RPC: shift_exchange_create / shift_exchange_answer / shift_exchange_decide (внутри — shift_exchange_apply, атомарно) / shift_exchange_cancel.
   Демо (даты от сегодняшнего дня, Ташкент):
   - Мукаддам (e15) предлагает Барно (e14) обмен — Барно видит «Согласен / Нет»;
   - Нафиса (e16) ↔ Мукаддам (e15): коллега согласна, ждёт Иброхима (e13) — с предупреждением про отдых;
   - Ахмаджон (e9) отдаёт смену Мухсине (e10): ждёт руководителя приёма (видят Шахриёр e7 и Шохрух e6) — отдых 0 ч после ночи;
   - Зикрулло (e8) ↔ Ахмаджон (e9) сегодня — подтверждён вчера: в графике и Пульте метка «обмен»;
   - в истории Барно — подтверждённый обмен с Латофат (10 дней назад) и отклонённый.
   Подключать после mock-w8-tails.js. */
(function () {
  var DB = window.__DB; if (!DB || DB.__w12xcSeed) return; DB.__w12xcSeed = true;
  var TZ = 'Asia/Tashkent', T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function add(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function iso(d, hm) { return d + 'T' + hm + ':00+05:00'; }
  DB.shift_exchanges = DB.shift_exchanges || [];
  DB.schedule = DB.schedule || []; DB.notifications = DB.notifications || [];
  function cell(id, d) { return DB.schedule.filter(function (s) { return s.employee_id === id && s.day === d; })[0] || null; }
  function snap(c) { return c ? { kind: c.kind, t_start: c.t_start || null, t_end: c.t_end || null } : null; }
  function put(id, d, kind, xid) { var c = cell(id, d); if (c) { c.kind = kind; c.t_start = null; c.t_end = null; c.xchg_id = xid || null; } else DB.schedule.push({ employee_id: id, day: d, kind: kind, t_start: null, t_end: null, xchg_id: xid || null }); }
  function work(c) { return !!(c && c.kind && ['o', 'h', 'b'].indexOf(c.kind) < 0); }
  function free(c) { return !c || c.kind === 'o'; }
  // ближайший день ≥ from, где у a рабочая смена, а b свободен
  function find(a, b, from, to) { for (var d = from; d <= to; d = add(d, 1)) if (work(cell(a, d)) && free(cell(b, d))) return d; return null; }
  // норма людей на смену (настройка директора hotel_settings.prefs.shift_min: «должность:смена» → минимум), недельная норма часов
  var hs = (DB.hotel_settings || [])[0]; if (hs) { hs.prefs = hs.prefs || {}; if (!hs.prefs.shift_min) hs.prefs.shift_min = { '11:u': 2, '9:u': 1, '9:v': 1, '9:n': 1 }; if (!hs.prefs.week_hours_max) hs.prefs.week_hours_max = 48; }
  var id = 9300, hi = add(T, 12);
  function mk(o) { o.id = ++id; o.created_at = o.created_at || iso(T, '09:10'); DB.shift_exchanges.push(o); return o; }
  // 1) Мукаддам → Барно (ждёт ответа Барно)
  (function () {
    var a = find('e15', 'e14', add(T, 1), hi), b = a && find('e14', 'e15', add(a, 1), hi); if (!a || !b) return;
    var x = mk({ kind: 'swap', from_id: 'e15', to_id: 'e14', from_day: a, to_day: b, status: 'peer', boss_id: 'e13', note: 'У сына утренник в садике, очень прошу', warn_n: 0, created_at: new Date(Date.now() - 40 * 6e4).toISOString(),
      cells: { fA: snap(cell('e15', a)), tA: snap(cell('e14', a)), fB: snap(cell('e15', b)), tB: snap(cell('e14', b)) } });
    DB.notifications.push({ id: 9351, employee_id: 'e14', at: x.created_at, title: 'Предложение обмена сменой', body: 'Мукаддам Тиллабоева предлагает поменяться сменами', ref_type: 'xchg', ref_id: x.id, urgent: false, read_at: null });
  })();
  // 2) Нафиса ↔ Мукаддам: коллега согласна, ждёт Иброхима. Нафисе ставим вечер накануне, чтобы проверка отдыха сработала.
  (function () {
    var used = DB.shift_exchanges.filter(function (o) { return o.status === 'peer'; }).reduce(function (u, o) { u.push(o.from_day, o.to_day); return u; }, []);
    function fx(p, q) { for (var d = add(T, 2); d <= hi; d = add(d, 1)) if (used.indexOf(d) < 0 && work(cell(p, d)) && free(cell(q, d))) return d; return null; }
    var a = fx('e16', 'e15'), b = fx('e15', 'e16'); if (!a || !b) return;
    var pb = add(b, -1); if (!cell('e16', pb) || cell('e16', pb).kind !== 'v') put('e16', pb, 'v');
    var x = mk({ kind: 'swap', from_id: 'e16', to_id: 'e15', from_day: a, to_day: b, status: 'boss', boss_id: 'e13', note: null, warn_n: 1, created_at: iso(T, '08:05'), peer_at: iso(T, '08:40'),
      cells: { fA: snap(cell('e16', a)), tA: snap(cell('e15', a)), fB: snap(cell('e16', b)), tB: snap(cell('e15', b)) } });
    DB.notifications.push({ id: 9352, employee_id: 'e13', at: x.peer_at, title: 'Обмен смен на подтверждение', body: 'Нафиса Хамиджанова ⇄ Мукаддам Тиллабоева — коллега согласна', ref_type: 'xchg', ref_id: x.id, urgent: false, read_at: null });
  })();
  // 3) Ахмаджон отдаёт смену Мухсине (у неё ночь накануне → отдых 0 ч)
  (function () {
    var a = null; for (var d = add(T, 2); d <= hi; d = add(d, 1)) { var p = cell('e10', add(d, -1)); if (work(cell('e9', d)) && free(cell('e10', d)) && p && p.kind === 'n') { a = d; break; } }
    if (!a) { a = find('e9', 'e10', add(T, 2), hi); if (!a) return; put('e10', add(a, -1), 'n'); }
    var x = mk({ kind: 'give', from_id: 'e9', to_id: 'e10', from_day: a, to_day: null, status: 'boss', boss_id: 'e7', note: 'Свадьба брата', warn_n: 1, created_at: iso(T, '07:30'), peer_at: iso(T, '08:15'),
      cells: { fA: snap(cell('e9', a)), tA: snap(cell('e10', a)) } });
    DB.notifications.push({ id: 9353, employee_id: 'e7', at: x.peer_at, title: 'Обмен смен на подтверждение', body: 'Ахмаджон Эркинжонов отдаёт смену — Мухсина Садуллаева согласна', ref_type: 'xchg', ref_id: x.id, urgent: false, read_at: null });
  })();
  // 4) Зикрулло ↔ Ахмаджон сегодня — подтверждён вчера (в графике уже поменяно)
  (function () {
    var c8 = cell('e8', T), c9 = cell('e9', T); if (!work(c8) || !work(c9) || c8.kind === c9.kind) return;
    var y = add(T, -1);
    var x = mk({ kind: 'swap', from_id: 'e8', to_id: 'e9', from_day: T, to_day: T, status: 'done', boss_id: 'e7', decided_by: 'e7', note: 'Утром к врачу', warn_n: 0, created_at: iso(y, '10:12'), peer_at: iso(y, '10:30'), boss_at: iso(y, '11:02'),
      cells: { fA: snap(c9), tA: snap(c8) } }); // до обмена: у Зикрулло было то, что сейчас у Ахмаджона
    c8.xchg_id = x.id; c9.xchg_id = x.id;
  })();
  // 5) история Барно
  (function () {
    var d1 = add(T, -10), d2 = add(T, -9);
    mk({ kind: 'swap', from_id: 'e14', to_id: 'e18', from_day: d1, to_day: d2, status: 'done', boss_id: 'e13', decided_by: 'e13', note: null, warn_n: 0, created_at: iso(add(T, -13), '12:00'), peer_at: iso(add(T, -13), '12:20'), boss_at: iso(add(T, -13), '13:05'), cells: { fA: { kind: 'u' }, tA: { kind: 'o' }, fB: { kind: 'o' }, tB: { kind: 'u' } } });
    mk({ kind: 'give', from_id: 'e14', to_id: 'e16', from_day: add(T, -4), to_day: null, status: 'rejected', boss_id: 'e13', decided_by: 'e13', note: null, warn_n: 1, created_at: iso(add(T, -6), '15:40'), peer_at: iso(add(T, -6), '16:00'), boss_at: iso(add(T, -6), '17:10'), cells: { fA: { kind: 'u' }, tA: { kind: 'o' } } });
  })();

  // ---------- RPC ----------
  function emp(i) { return DB.employees.filter(function (e) { return e.id === i; })[0] || null; }
  function nm(e) { return e ? e.first_name + ' ' + e.last_name : ''; }
  function boss(e) { return e && e.manager_id ? e.manager_id : (DB.employees.filter(function (x) { return x.role === 'director'; })[0] || {}).id; }
  var nid = 9400;
  function note(to, title, body, x) { if (!to) return; DB.notifications.push({ id: ++nid, employee_id: to, at: new Date().toISOString(), title: title, body: body, ref_type: 'xchg', ref_id: x.id, urgent: false, read_at: null }); }
  function inTeam(mgr, eid) { var e = emp(eid), g = 0; while (e && e.manager_id && g++ < 10) { if (e.manager_id === mgr) return true; e = emp(e.manager_id); } return false; }
  function same(a, b) { a = a || {}; b = b || {}; return (a.kind || 'o') === (b.kind || 'o') && String(a.t_start || '').slice(0, 5) === String(b.t_start || '').slice(0, 5) && String(a.t_end || '').slice(0, 5) === String(b.t_end || '').slice(0, 5); }
  function days(x) { return x.kind === 'swap' && x.to_day && x.to_day !== x.from_day ? [x.from_day, x.to_day] : [x.from_day]; }
  function stale(x) { var c = x.cells || {}; if (!same(cell(x.from_id, x.from_day), c.fA) || !same(cell(x.to_id, x.from_day), c.tA)) return true; if (days(x).length > 1 && (!same(cell(x.from_id, x.to_day), c.fB) || !same(cell(x.to_id, x.to_day), c.tB))) return true; return false; }
  // атомарно: клетки двух людей в затронутые дни меняются местами + метка xchg_id
  function apply(x) {
    if (stale(x)) return false;
    days(x).forEach(function (d) {
      var a = snap(cell(x.from_id, d)), b = snap(cell(x.to_id, d));
      var ca = cell(x.from_id, d), cb = cell(x.to_id, d), na = b || { kind: 'o' }, nb = a || { kind: 'o' };
      if (ca) Object.assign(ca, na, { xchg_id: x.id }); else DB.schedule.push(Object.assign({ employee_id: x.from_id, day: d, xchg_id: x.id }, na));
      if (cb) Object.assign(cb, nb, { xchg_id: x.id }); else DB.schedule.push(Object.assign({ employee_id: x.to_id, day: d, xchg_id: x.id }, nb));
    });
    return true;
  }
  function rpc(n, a, me) {
    var x = a && a.p_id ? DB.shift_exchanges.filter(function (y) { return y.id === +a.p_id; })[0] : null, now = new Date().toISOString();
    if (n === 'shift_exchange_create') {
      var to = emp(a.p_to); if (!to || to.dept_id !== me.dept_id || to.id === me.id) return { ok: false, reason: 'peer' };
      var y = { kind: a.p_kind === 'give' ? 'give' : 'swap', from_id: me.id, to_id: to.id, from_day: a.p_from_day, to_day: a.p_kind === 'give' ? null : a.p_to_day };
      var busy = DB.shift_exchanges.some(function (o) { return (o.status === 'peer' || o.status === 'boss') && [o.from_id, o.to_id].some(function (p) { return p === me.id || p === to.id; }) && days(o).some(function (d) { return days(y).indexOf(d) >= 0; }); });
      if (busy) return { ok: false, reason: 'busy' };
      if (!work(cell(me.id, y.from_day))) return { ok: false, reason: 'changed' };
      if (y.kind === 'give' && !free(cell(to.id, y.from_day))) return { ok: false, reason: 'changed' };
      y.cells = { fA: snap(cell(me.id, y.from_day)), tA: snap(cell(to.id, y.from_day)) };
      if (y.kind === 'swap') { y.cells.fB = snap(cell(me.id, y.to_day)); y.cells.tB = snap(cell(to.id, y.to_day)); }
      y.status = 'peer'; y.boss_id = boss(me); y.note = a.p_note || null; y.warn_n = +a.p_warn_n || 0;
      mk(y); y.created_at = now;
      note(to.id, 'Предложение обмена сменой', nm(me) + (y.kind === 'give' ? ' предлагает вам свою смену' : ' предлагает поменяться сменами'), y);
      return { ok: true, id: y.id };
    }
    if (!x) return { ok: false, reason: 'gone' };
    if (n === 'shift_exchange_answer') {
      if (x.to_id !== me.id || x.status !== 'peer') return { ok: false, reason: 'closed' };
      if (a.p_yes && stale(x)) return { ok: false, reason: 'changed' };
      x.peer_at = now; x.status = a.p_yes ? 'boss' : 'declined';
      note(x.from_id, a.p_yes ? 'Коллега согласен на обмен' : 'Коллега отказался от обмена', nm(me) + (a.p_yes ? ' — согласие, ждём руководителя' : ' — отказ'), x);
      if (a.p_yes) note(x.boss_id, 'Обмен смен на подтверждение', nm(emp(x.from_id)) + ' ⇄ ' + nm(me) + ' — коллега согласен', x);
      return { ok: true };
    }
    if (n === 'shift_exchange_decide') {
      if (x.status !== 'boss' || !(me.role === 'director' || inTeam(me.id, x.from_id))) return { ok: false, reason: 'closed' };
      if (a.p_yes && !apply(x)) return { ok: false, reason: 'changed' };
      x.status = a.p_yes ? 'done' : 'rejected'; x.boss_at = now; x.decided_by = me.id;
      var t = a.p_yes ? 'Обмен смен подтверждён' : 'Обмен смен отклонён', b = nm(emp(x.from_id)) + ' ⇄ ' + nm(emp(x.to_id));
      note(x.from_id, t, b, x); note(x.to_id, t, b, x); if (x.boss_id !== me.id) note(x.boss_id, t, b + ' · ' + nm(me), x);
      return { ok: true };
    }
    if (n === 'shift_exchange_cancel') {
      if (x.from_id !== me.id || (x.status !== 'peer' && x.status !== 'boss')) return { ok: false, reason: 'closed' };
      var wasBoss = x.status === 'boss'; x.status = 'cancelled'; x.cancel_at = now;
      note(x.to_id, 'Обмен смен отменён', nm(me) + ' отменил(а) предложение', x); if (wasBoss) note(x.boss_id, 'Обмен смен отменён', nm(me) + ' отменил(а) предложение', x);
      return { ok: true };
    }
    return null;
  }
  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments), rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (!/^shift_exchange_/.test(n)) return rpc0.apply(this, arguments);
      var ah = /as=([a-z0-9._]+)/.exec(location.hash || ''), sess = null; try { sess = JSON.parse(localStorage.getItem('mock-session') || 'null'); } catch (e) {}
      var me = DB.employees.filter(function (e) { return ah ? e.login === ah[1] : sess && e.user_id === sess.user.id; })[0] || null;
      if (!me) return Promise.resolve({ data: null, error: { message: 'Нет входа' } });
      return Promise.resolve({ data: rpc(n, a || {}, me), error: null });
    };
    return c;
  };
})();
