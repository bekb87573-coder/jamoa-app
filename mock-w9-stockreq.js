/* Mir Luxe One — демо-мок пакета w9-stockreq (волна 09): «Заявка на склад с подтверждением».
   Подключается последним из mock-*.js (после mock-w8-tails.js). Склад — из mock-w4-guard.js (stock_items / stock_moves, rpc stock_levels / stock_move).
   Таблицы демо: stock_requests, stock_request_items. RPC:
   - sreq_list({p_scope:'mine'|'queue'|'month', p_month:'YYYY-MM'}) → заявки с позициями;
   - sreq_create({p_items:[{item_id,qty}], p_need_by, p_place, p_note}) → {id};
   - sreq_cancel({p_id}) — только своя и только «Новая»;
   - sreq_pick({p_id, p_items:[{id,qty,reason}]}) — кладовщик: «Собрано» → уведомление получателю «Заберите на складе»;
   - sreq_report({p_month}) → {month,total,requests,by_dept,top};
   - stock_issue({p_id}) — получатель «Получил»: атомарно пишет расход в stock_moves (причина «служба · заявка №»), статус «Выдано», low — что дошло до минимума.
   Формат ответов сверен с боевыми миграциями (cycles/09_support/w9-stockreq/sql): рядовому сотруднику price/sum = null; кладовщик — positions.stock_role.
   Состояние заявок хранится в localStorage `mlx-w9sr` (только демо: чтобы сценарий «служба → кладовщик → служба» проходил при смене пользователя). */
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !window.supabase.createClient) return;
  var LS = 'mlx-w9sr';
  function tzDay(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d || new Date()); }
  function byLogin(l) { return (DB.employees || []).filter(function (e) { return e.login === l; })[0] || null; }
  function empById(id) { return (DB.employees || []).filter(function (e) { return e.id === id; })[0] || null; }
  function posName(e) { var p = (DB.positions || []).filter(function (x) { return e && x.id === e.position_id; })[0]; return p ? p.name : ''; }
  function deptName(d) { var x = (DB.departments || []).filter(function (z) { return z.id === d; })[0]; return x ? x.name : d; }
  var AS0 = /as=([a-z0-9._]+)/.exec(location.hash || '');
  function me() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || '') || AS0, uid = null;
    if (a) return byLogin(a[1]);
    try { var s = JSON.parse(localStorage.getItem('mock-session')); uid = s && s.user && s.user.id; } catch (x) {}
    return (DB.employees || []).filter(function (x) { return x.user_id === uid; })[0] || null;
  }
  // роль должности на складе — как боевой positions.stock_role ('keeper' / 'report'), M51
  (DB.positions || []).forEach(function (p) { if (p.stock_role === undefined) p.stock_role = p.name === 'Закупки и логистика' || p.name === 'Кладовщик' ? 'keeper' : p.name === 'Главный бухгалтер' || p.name === 'Бухгалтер' ? 'report' : null; });
  function stockRole(e) { var p = (DB.positions || []).filter(function (x) { return e && x.id === e.position_id; })[0]; return p ? p.stock_role : null; }
  function isKeeper(e) { return stockRole(e) === 'keeper'; }
  function isDir(e) { return !!e && e.role === 'director'; }
  function isAcc(e) { return stockRole(e) === 'report'; }
  function myDepts(e) { var o = [e.dept_id]; if (e.lead_dept) o.push(e.lead_dept); return o; }
  function nextId(t, base) { var m = base || 0; (DB[t] || []).forEach(function (r) { if (typeof r.id === 'number' && r.id > m) m = r.id; }); return m + 1; }
  function at(daysAgo, hhmm) { var d = new Date(Date.now() - daysAgo * 864e5); return tzDay(d) + 'T' + (hhmm || '10:00') + ':00+05:00'; }
  function iso(x) { return new Date(x).toISOString(); }
  function E(m) { return { data: null, error: { message: m } }; }
  function OK(d) { return { data: d, error: null }; }

  // ---- дополнительные позиции склада (к 8 позициям из mock-w4-guard), чтобы у каждой службы был свой каталог ----
  DB.stock_items = DB.stock_items || []; DB.stock_moves = DB.stock_moves || [];
  var EXTRA = [
    [731, 'Простыня 2-сп.', 'шт', 'hk', 'Бельё', 40, 96, 85000],
    [732, 'Наволочка', 'шт', 'hk', 'Бельё', 60, 150, 28000],
    [733, 'Полотенце для рук', 'шт', 'hk', 'Бельё', 60, 120, 22000],
    [734, 'Мыло 20 г', 'шт', 'hk', 'Косметика', 100, 260, 1800],
    [735, 'Гель для душа 30 мл', 'шт', 'hk', 'Косметика', 100, 190, 3200],
    [736, 'Средство для стёкол', 'л', 'hk', 'Химия', 10, 18, 26000],
    [737, 'Пакеты для мусора 30 л', 'уп', 'hk', 'Номер', 20, 44, 14000],
    [738, 'Масло подсолнечное', 'л', 'kitchen', 'Продукты', 20, 36, 21000],
    [739, 'Мука высший сорт', 'кг', 'kitchen', 'Продукты', 25, 40, 7500],
    [740, 'Рис девзира', 'кг', 'kitchen', 'Продукты', 20, 32, 24000],
    [741, 'Плёнка пищевая', 'рул', 'kitchen', 'Посуда и инвентарь', 4, 9, 46000],
    [742, 'Салфетки бумажные', 'уп', 'fnb', 'Посуда и инвентарь', 30, 52, 9000],
    [743, 'Вода 0,5 л', 'шт', 'fnb', 'Мини-бар', 96, 240, 2500],
    [744, 'Сок 0,2 л', 'шт', 'fnb', 'Напитки', 48, 70, 6000],
    [745, 'Лампа GU10', 'шт', 'eng', 'Тех. запчасти', 20, 34, 16000],
    [746, 'Картридж смесителя 40 мм', 'шт', 'eng', 'Тех. запчасти', 4, 7, 65000],
    [747, 'Герметик силиконовый', 'шт', 'eng', 'Тех. запчасти', 6, 15, 38000],
    [748, 'Бумага А4', 'уп', 'fo', 'Канцелярия', 10, 22, 52000],
    [749, 'Ручки шариковые', 'шт', 'fo', 'Канцелярия', 30, 80, 2500],
    [750, 'Ключ-карты RFID', 'шт', 'fo', 'Номер', 50, 120, 9000]
  ];
  if (!DB.stock_items.some(function (x) { return x.id === 731; })) EXTRA.forEach(function (x, i) {
    DB.stock_items.push({ id: x[0], name: x[1], unit: x[2], dept_id: x[3], category: x[4], min_qty: x[5], price: x[7], sale_price: null, created_at: at(30) });
    DB.stock_moves.push({ id: 7300 + i, item_id: x[0], kind: 'in', qty: x[6], reason: 'Остаток на начало', room_no: null, by_emp: null, at: at(25, '09:00') });
  });
  function item(id) { return DB.stock_items.filter(function (i) { return i.id === +id; })[0] || null; }
  function qtyOf(id) { return Math.round(DB.stock_moves.reduce(function (s, m) { if (m.item_id !== +id) return s; var q = +m.qty || 0; return s + (m.kind === 'in' ? q : m.kind === 'count' ? q : -q); }, 0) * 100) / 100; }

  // ---- демо-заявки: история месяца + текущая очередь (2 новые, 1 собрана) ----
  function seed() {
    var R = [], I = [], M = [], N = [];
    var keeper = byLogin('shuxrat.r');
    var L = [
      // [дней назад, логин, статус, нужно к, место, комментарий, [[item, qty]...]]
      [18, 'ibroxim.r', 'issued', '10:00', 'Этаж 4', '', [[701, 20], [731, 12], [732, 20]]],
      [16, 'akbarjon.a', 'issued', '08:00', 'Кухня', 'На неделю', [[738, 10], [739, 15], [740, 8]]],
      [14, 'shaxriyor.m', 'issued', '12:00', 'Техслужба', '', [[707, 6], [745, 4]]],
      [12, 'barno.r', 'issued', '09:00', 'Этаж 3', '', [[702, 40], [734, 40], [703, 30]]],
      [10, 'zikrullo.b', 'issued', '15:00', 'Ресепшен', '', [[748, 3], [749, 20], [750, 30]]],
      [9, 'dilshodbek.a', 'issued', '11:00', 'Ресторан', 'Банкет 40 чел.', [[742, 12], [743, 48], [744, 24]]],
      [7, 'mukaddam.t', 'issued', '09:30', 'Этаж 5', '', [[701, 16], [735, 30], [737, 6]]],
      [5, 'akbarjon.a', 'issued', '08:00', 'Кухня', '', [[704, 2], [741, 2], [738, 6]]],
      [3, 'barno.r', 'issued', '09:00', 'Этаж 3', '', [[733, 20], [706, 4]]],
      [2, 'elyor.e', 'issued', '14:00', 'Этаж 6', 'Течёт смеситель 612', [[746, 2], [747, 2]]],
      [0, 'barno.r', 'new', '14:00', 'Этаж 3', 'Заезд группы на 3-й этаж', [[701, 20], [702, 30], [734, 30]]],
      [0, 'akbarjon.a', 'new', '12:00', 'Кухня', '', [[739, 10], [740, 6], [741, 1]]],
      [0, 'shaxriyor.m', 'ready', '11:00', 'Этаж 5', 'Замена в 507 и 512', [[707, 4], [745, 6]]]
    ];
    var hh = ['08:40', '09:10', '09:55', '10:20', '11:05', '13:30', '15:10'];
    L.forEach(function (x, n) {
      var e = byLogin(x[1]); if (!e) return;
      var id = 1040 + n, cr = at(x[0], x[0] === 0 ? ['08:12', '09:05', '07:48'][n % 3] : hh[n % hh.length]);
      var r = { id: id, dept_id: e.dept_id, created_by: e.id, status: x[2], need_by: tzDay(new Date(Date.now() - x[0] * 864e5)) + 'T' + x[3] + ':00+05:00', place: x[4], note: x[5] || null, created_at: cr, picked_by: null, picked_at: null, issued_at: null, cancelled_at: null, sr: 1 };
      x[6].forEach(function (p, k) { var it = item(p[0]); if (!it) return; I.push({ id: id * 10 + k, request_id: id, item_id: p[0], qty_req: p[1], qty_give: x[2] === 'new' ? null : p[1], reason: null, price: it.price || 0 }); });
      if (x[2] === 'ready' || x[2] === 'issued') { r.picked_by = keeper ? keeper.id : null; r.picked_at = iso(Date.parse(cr) + 35 * 6e4); }
      if (x[2] === 'issued') {
        r.issued_at = iso(Date.parse(cr) + 55 * 6e4);
        I.filter(function (z) { return z.request_id === id; }).forEach(function (z, k) { M.push({ id: 7500 + n * 10 + k, item_id: z.item_id, kind: 'out', qty: z.qty_give, reason: deptName(e.dept_id) + ' · заявка №' + id, room_no: null, by_emp: e.id, at: r.issued_at, sreq_id: id, sr: 1 }); });
      }
      if (x[2] === 'ready') N.push({ id: 9701, employee_id: e.id, at: r.picked_at, title: 'Заберите на складе', body: 'Заявка №' + id + ' собрана · 2 поз.', ref_type: 'sreq', ref_id: id, urgent: false, read_at: null, sr: 1 });
      if (x[2] === 'new' && keeper) N.push({ id: 9702 + n, employee_id: keeper.id, at: cr, title: 'Новая заявка на склад', body: '№' + id + ' · ' + deptName(e.dept_id) + ' · ' + e.first_name + ' · к ' + x[3], ref_type: 'sreq', ref_id: id, urgent: false, read_at: null, sr: 1 });
      R.push(r);
    });
    return { R: R, I: I, M: M, N: N };
  }
  function load() {
    var s = null; try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (x) { s = null; }
    if (!s || !s.R) s = seed();
    DB.stock_requests = s.R; DB.stock_request_items = s.I;
    DB.stock_moves = DB.stock_moves.filter(function (m) { return !m.sr; }).concat(s.M);
    DB.notifications = (DB.notifications || []).filter(function (n) { return !n.sr; }).concat(s.N);
  }
  function save() {
    try { localStorage.setItem(LS, JSON.stringify({ R: DB.stock_requests, I: DB.stock_request_items, M: DB.stock_moves.filter(function (m) { return m.sr; }), N: (DB.notifications || []).filter(function (n) { return n.sr; }) })); } catch (x) {}
  }
  load();

  function notify(empId, title, body, rid) {
    if (!empId) return;
    DB.notifications.push({ id: nextId('notifications', 9800), employee_id: empId, at: new Date().toISOString(), title: title, body: body, ref_type: 'sreq', ref_id: rid, urgent: false, read_at: null, sr: 1 });
  }
  function readRef(rid, title) { var t = new Date().toISOString(); (DB.notifications || []).forEach(function (n) { if (n.ref_type === 'sreq' && n.ref_id === rid && n.title === title && !n.read_at) n.read_at = t; }); }
  function report(a) {
    var m = me(); if (!canSeeAll(m)) return E('Нет доступа');
    var ym = a.p_month || tzDay().slice(0, 7); if (!/^\d{4}-\d{2}$/.test(ym)) return E('Проверьте месяц');
    var L = list({ p_scope: 'month', p_month: ym }).data || [], by = {}, top = {}, total = 0;
    L.forEach(function (r) {
      var d = by[r.dept_id] = by[r.dept_id] || { dept_id: r.dept_id, dept: r.dept, requests: 0, lines: 0, sum: 0 }; d.requests++;
      r.items.forEach(function (z) { var g = z.qty_give || 0; if (!(g > 0)) return; var v = g * (z.price || 0); d.lines++; d.sum += v; total += v; var t = top[z.item_id] = top[z.item_id] || { item_id: z.item_id, name: z.name, unit: z.unit, qty: 0, sum: 0 }; t.qty += g; t.sum += v; });
    });
    return OK({ month: ym, total: total, requests: L.length, by_dept: Object.keys(by).map(function (k) { return by[k]; }).sort(function (x, y) { return y.sum - x.sum; }), top: Object.keys(top).map(function (k) { return top[k]; }).sort(function (x, y) { return y.sum - x.sum; }).slice(0, 10) });
  }
  function keepers() { return (DB.employees || []).filter(function (e) { return e.active !== false && isKeeper(e); }); }
  function itemsOf(id) { return DB.stock_request_items.filter(function (z) { return z.request_id === id; }); }
  function seesMoney(m) { return !!m && (m.role === 'manager' || isDir(m) || isKeeper(m) || isAcc(m)); }
  function view(r, money) {
    var e = empById(r.created_by), pk = r.picked_by ? empById(r.picked_by) : null;
    var it = itemsOf(r.id).map(function (z) {
      var s = item(z.item_id) || { name: '#' + z.item_id, unit: '', min_qty: 0, price: 0, category: '' };
      return { id: z.id, item_id: z.item_id, name: s.name, unit: s.unit, category: s.category, qty_req: z.qty_req, qty_give: z.qty_give, reason: z.reason, price: z.price != null ? z.price : (s.price || 0), stock: qtyOf(z.item_id), min: +s.min_qty || 0 };
    });
    var o = JSON.parse(JSON.stringify(r)); delete o.sr;
    o.items = it; o.who = e ? { id: e.id, first_name: e.first_name, last_name: e.last_name } : null; o.picker = pk ? { id: pk.id, first_name: pk.first_name } : null;
    o.sum = it.reduce(function (s, z) { return s + (z.qty_give != null ? z.qty_give : z.qty_req) * (z.price || 0); }, 0);
    o.dept = deptName(r.dept_id); o.issued_by = r.issued_by || null;
    if (!money) { o.sum = null; o.items.forEach(function (z) { z.price = null; }); } // как на сервере: рядовой сотрудник цен не видит
    return o;
  }
  function canSeeAll(m) { return isKeeper(m) || isDir(m) || isAcc(m); }
  function list(a) {
    var m = me(); if (!m) return OK([]);
    var sc = a.p_scope || 'mine', out;
    if (sc === 'mine') {
      var lead = m.role === 'manager', dps = myDepts(m);
      out = DB.stock_requests.filter(function (r) { return r.created_by === m.id || (lead && dps.indexOf(r.dept_id) >= 0); });
      out = out.filter(function (r) { return r.status === 'issued' ? Date.parse(r.issued_at) > Date.now() - 31 * 864e5 : r.status === 'cancelled' ? Date.parse(r.cancelled_at) > Date.now() - 31 * 864e5 : true; });
    } else if (sc === 'queue') {
      if (!isKeeper(m) && !isDir(m)) return E('Нет доступа');
      out = DB.stock_requests.filter(function (r) { return r.status === 'new' || r.status === 'ready' || (r.status === 'issued' && Date.parse(r.issued_at) > Date.now() - 3 * 864e5); });
    } else if (sc === 'month') {
      if (!canSeeAll(m)) return E('Нет доступа');
      var ym = a.p_month || tzDay().slice(0, 7);
      out = DB.stock_requests.filter(function (r) { return r.status === 'issued' && tzDay(new Date(r.issued_at)).slice(0, 7) === ym; });
    } else return E('Неизвестный список');
    var mo = seesMoney(m);
    return OK(out.map(function (r) { return view(r, mo); }).sort(function (x, y) { return x.created_at < y.created_at ? 1 : -1; }));
  }
  function create(a) {
    var m = me(); if (!m) return E('Нет входа');
    if ((a.p_items || []).some(function (z) { return !isFinite(+z.qty) || +z.qty < 0 || +z.qty > 1e5; })) return E('Проверьте число');
    var sumQ = {}; (a.p_items || []).forEach(function (z) { if (item(z.item_id) && +z.qty > 0) sumQ[+z.item_id] = (sumQ[+z.item_id] || 0) + +z.qty; }); // одинаковые складываются
    var its = Object.keys(sumQ).map(function (k) { return { item_id: +k, qty: sumQ[k] }; });
    if (!its.length) return E('Добавьте позиции');
    if (its.length > 50) return E('Слишком много позиций (не больше 50)');
    if (DB.stock_requests.filter(function (r) { return r.created_by === m.id && r.status === 'new'; }).length >= 10) return E('Уже 10 новых заявок — дождитесь сборки');
    if (a.p_need_by) { var nb = Date.parse(a.p_need_by); if (!isFinite(nb) || nb < Date.now() - 864e5 || nb > Date.now() + 60 * 864e5) return E('Проверьте время'); }
    var id = nextId('stock_requests', 1039), now = new Date().toISOString();
    DB.stock_requests.push({ id: id, dept_id: m.dept_id, created_by: m.id, status: 'new', need_by: a.p_need_by || null, place: (a.p_place || '').slice(0, 60) || null, note: (a.p_note || '').slice(0, 300) || null, created_at: now, picked_by: null, picked_at: null, issued_at: null, cancelled_at: null, sr: 1 });
    its.forEach(function (z, k) { DB.stock_request_items.push({ id: id * 10 + k, request_id: id, item_id: +z.item_id, qty_req: +z.qty, qty_give: null, reason: null, price: item(z.item_id).price || 0 }); });
    var t = a.p_need_by ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(a.p_need_by)) : '';
    (keepers().length ? keepers() : (DB.employees || []).filter(function (e) { return isDir(e); })).forEach(function (k) { if (k.id !== m.id) notify(k.id, 'Новая заявка на склад', '№' + id + ' · ' + deptName(m.dept_id) + ' · ' + m.first_name + ' · ' + its.length + ' поз.' + (t ? ' · к ' + t : ''), id); });
    save();
    return OK({ ok: true, id: id });
  }
  function cancel(a) {
    var m = me(), r = DB.stock_requests.filter(function (x) { return x.id === +a.p_id; })[0];
    if (!m || !r) return E('Заявка не найдена');
    if (r.created_by !== m.id) return E('Отозвать может только автор');
    if (r.status === 'cancelled') return E('Заявка уже отозвана');
    if (r.status !== 'new') return E('Уже собрано — отозвать нельзя');
    r.status = 'cancelled'; r.cancelled_at = new Date().toISOString();
    keepers().forEach(function (k) { notify(k.id, 'Заявка отозвана', '№' + r.id + ' · ' + m.first_name, r.id); });
    save();
    return OK({ ok: true });
  }
  function pick(a) {
    var m = me(), r = DB.stock_requests.filter(function (x) { return x.id === +a.p_id; })[0];
    if (!m || !r) return E('Заявка не найдена');
    if (!isKeeper(m) && !isDir(m)) return E('Нет доступа');
    if (r.status !== 'new') return E(r.status === 'cancelled' ? 'Заявку отозвали' : 'Уже собрано');
    var its = itemsOf(r.id), given = {}, bad = null;
    (a.p_items || []).forEach(function (z) { given[+z.id] = z; });
    its.forEach(function (z) {
      var g = given[z.id], q = g && g.qty != null && g.qty !== '' ? +g.qty : z.qty_req;
      if (!isFinite(q) || q < 0) bad = 'Проверьте число';
      if (q !== z.qty_req && !(g && g.reason)) bad = 'Укажите причину';
    });
    if (bad) return E(bad);
    if (!its.some(function (z) { var g = given[z.id]; return (g && g.qty != null && g.qty !== '' ? +g.qty : z.qty_req) > 0; })) return E('Нечего выдавать');
    var shortP = its.filter(function (z) { var g = given[z.id], q = g && g.qty != null && g.qty !== '' ? +g.qty : z.qty_req; return q > qtyOf(z.item_id); });
    if (shortP.length) return E('Не хватает на складе: ' + shortP.map(function (z) { return item(z.item_id).name; }).join(', ')); // как sreq_pick на сервере
    var ch = [];
    its.forEach(function (z) { var g = given[z.id]; z.qty_give = g && g.qty != null && g.qty !== '' ? +g.qty : z.qty_req; z.reason = z.qty_give !== z.qty_req ? g.reason : null; if (z.reason) { var s = item(z.item_id); ch.push(s.name + ' ' + z.qty_req + ' → ' + z.qty_give); } });
    r.status = 'ready'; r.picked_by = m.id; r.picked_at = new Date().toISOString();
    readRef(r.id, 'Новая заявка на склад');
    notify(r.created_by, 'Заберите на складе', 'Заявка №' + r.id + ' собрана · ' + its.filter(function (z) { return z.qty_give > 0; }).length + ' поз.' + (ch.length ? ' · изменено: ' + ch.join(', ') : ''), r.id);
    save();
    return OK({ ok: true });
  }
  function issue(a) {
    // на сервере — одна транзакция: блокировка заявки и позиций склада, проверка остатков, расход, статус
    var m = me(), r = DB.stock_requests.filter(function (x) { return x.id === +a.p_id; })[0];
    if (!m || !r) return E('Заявка не найдена');
    var lead = m.role === 'manager' && myDepts(m).indexOf(r.dept_id) >= 0;
    if (r.created_by !== m.id && !lead) return E('Получить может только заказавший');
    if (r.status === 'issued') return E('Уже получено');
    if (r.status !== 'ready') return E('Заявка ещё не собрана');
    var its = itemsOf(r.id).filter(function (z) { return z.qty_give > 0; });
    var short = its.filter(function (z) { return qtyOf(z.item_id) < z.qty_give; });
    if (short.length) return E('Не хватает на складе: ' + short.map(function (z) { return item(z.item_id).name; }).join(', '));
    var now = new Date().toISOString(), base = nextId('stock_moves', 9000);
    its.forEach(function (z, k) { DB.stock_moves.push({ id: base + k, item_id: z.item_id, kind: 'out', qty: z.qty_give, reason: deptName(r.dept_id) + ' · заявка №' + r.id, room_no: null, by_emp: r.created_by, at: now, sreq_id: r.id, sr: 1 }); });
    r.status = 'issued'; r.issued_at = now; r.issued_by = m.id;
    readRef(r.id, 'Заберите на складе');
    var low = its.map(function (z) { var s = item(z.item_id); return { item_id: z.item_id, name: s.name, unit: s.unit, qty: qtyOf(z.item_id), min: +s.min_qty || 0 }; }).filter(function (x) { return x.min > 0 && x.qty <= x.min; });
    var who = empById(r.created_by);
    (r.picked_by ? [empById(r.picked_by)] : keepers()).forEach(function (k) { if (k && k.id !== m.id) notify(k.id, 'Заявка получена', '№' + r.id + ' · ' + (who ? who.first_name : '') + (low.length ? ' · дошло до минимума: ' + low.map(function (x) { return x.name; }).join(', ') : ''), r.id); });
    save();
    return OK({ ok: true, moves: its.length, low: low });
  }

  var prev = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), w = Object.create(c);
    w.rpc = function (n, a) {
      a = a || {};
      if (n === 'sreq_list') return Promise.resolve(list(a));
      if (n === 'sreq_create') return Promise.resolve(create(a));
      if (n === 'sreq_cancel') return Promise.resolve(cancel(a));
      if (n === 'sreq_pick') return Promise.resolve(pick(a));
      if (n === 'stock_issue') return Promise.resolve(issue(a));
      if (n === 'sreq_report') return Promise.resolve(report(a));
      var p = c.rpc.apply(c, arguments);
      if (n === 'stock_move') return Promise.resolve(p).then(function (r) { save(); return r; });
      return p;
    };
    return w;
  };
})();
