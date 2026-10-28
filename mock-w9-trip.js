/* Mir Luxe One — демо-мок пакета w9-trip (волна 09, идея 13): поездка на базар и подотчёт.
   Таблицы trips / trip_items / trip_stops / advances + RPC trip_build, trip_cancel, trip_stop_receipt, trip_return,
   adv_issue, adv_receive, adv_return, adv_accept, receipt_check, receipt_retake. На боевом сервере — SQL из changes.md.
   Подключается после остальных mock-*.js. Задачи не создаёт — только уведомления. */
(function () {
  var DB = window.__DB; if (!DB) return;
  var TZ = 'Asia/Tashkent', seq = 93000;
  function iso(msAgo) { return new Date(Date.now() - msAgo).toISOString(); }
  function H(h) { return h * 3600000; }
  function day(ts) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ts ? new Date(ts) : new Date()); }
  function dm(ts) { var d = day(ts); return d.slice(8, 10) + '.' + d.slice(5, 7); }
  function byLogin(l, def) { var e = (DB.employees || []).filter(function (x) { return x.login === l; })[0]; return e ? e.id : def; }
  function money(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function pos(e) { var p = (DB.positions || []).filter(function (x) { return e && x.id === e.position_id; })[0]; return p ? p.name : ''; }
  function isAcc(e) { return ['Главный бухгалтер', 'Бухгалтер'].indexOf(pos(e)) >= 0; }
  function isBuyer(e) { return pos(e) === 'Закупки и логистика'; }
  function isDir(e) { return e && e.role === 'director'; }
  ['trips', 'trip_items', 'trip_stops', 'advances'].forEach(function (t) { DB[t] = DB[t] || []; });
  var PR = DB.purchase_requests = DB.purchase_requests || [];
  var BUY = byLogin('shuxrat.r', 'e46'), ACC = byLogin('azamat.x', 'e2'), DIR = byLogin('bekzod.a', 'e0');
  function P(o) { if (!PR.some(function (x) { return x.id === o.id; })) PR.push(o); }

  // история покупок — по ней подсказка «где покупать»
  P({ id: 781, dept_id: 'kitchen', created_by: 'e26', created_at: iso(H(130)), items: 'Помидоры 15 кг, огурцы 10 кг', urgency: 'normal', est_cost: 550000, status: 'delivered', category: 'Продукты', cost: 520000, supplier: 'Алайский базар, ряд 4', bought_at: iso(H(124)), buyer: BUY });
  P({ id: 782, dept_id: 'kitchen', created_by: 'e26', created_at: iso(H(128)), items: 'Рис девзира 20 кг, масло хлопковое 10 л', urgency: 'normal', est_cost: 900000, status: 'delivered', category: 'Продукты', cost: 870000, supplier: 'Алайский базар', bought_at: iso(H(124)), buyer: BUY });
  P({ id: 783, dept_id: 'eng', created_by: 'e37', created_at: iso(H(150)), items: 'Лампочки E14 — 20 шт, кабель 3×2,5 — 50 м', urgency: 'normal', est_cost: 800000, status: 'delivered', category: 'Электрика', cost: 760000, supplier: 'Куйлюк, павильон 12', bought_at: iso(H(146)), buyer: BUY });
  P({ id: 784, dept_id: 'hk', created_by: 'e13', created_at: iso(H(170)), items: 'Мешки для мусора 120 л — 10 уп., губки — 40 шт', urgency: 'normal', est_cost: 400000, status: 'delivered', category: 'Бытовая химия', cost: 380000, supplier: 'Оптовый склад «Чистый дом»', bought_at: iso(H(166)), buyer: BUY });
  P({ id: 785, dept_id: 'fnb', created_by: 'e32', created_at: iso(H(200)), items: 'Тарелки 24 см — 36 шт', urgency: 'normal', est_cost: 1500000, status: 'delivered', category: 'Посуда и инвентарь', cost: 1440000, supplier: 'Чорсу', bought_at: iso(H(196)), buyer: BUY });
  P({ id: 786, dept_id: 'fnb', created_by: 'e32', created_at: iso(H(190)), items: 'Вода питьевая 0,5 л — 10 упаковок, сок — 24 л', urgency: 'normal', est_cost: 700000, status: 'delivered', category: 'Напитки', cost: 690000, supplier: 'Makro', bought_at: iso(H(186)), buyer: BUY });
  P({ id: 787, dept_id: 'adm', created_by: 'e2', created_at: iso(H(220)), items: 'Бумага A4 — 10 пачек', urgency: 'normal', est_cost: 450000, status: 'delivered', category: 'Канцелярия', cost: 430000, supplier: 'Korzinka', bought_at: iso(H(216)), buyer: BUY });
  // вчерашняя поездка: вернулся, сдал остаток — ждёт бухгалтера; два чека на проверке
  P({ id: 795, dept_id: 'kitchen', created_by: 'e26', created_at: iso(H(30)), items: 'Зелень: укроп, кинза — 3 кг; лимоны — 5 кг', urgency: 'normal', est_cost: 400000, status: 'delivered', category: 'Продукты', cost: 410000, supplier: 'Алайский базар', bought_at: iso(H(22)), buyer: BUY, advance_id: 9201, trip_id: 9301, receipt_path: 'e46/receipt-demo1.jpg', receipt_check: 'pending' });
  P({ id: 797, dept_id: 'kitchen', created_by: 'e26', created_at: iso(H(30)), items: 'Лук 20 кг, морковь 20 кг', urgency: 'normal', est_cost: 1900000, status: 'delivered', category: 'Продукты', cost: 2000000, supplier: 'Алайский базар', bought_at: iso(H(22)), buyer: BUY, advance_id: 9201, trip_id: 9301, receipt_path: 'e46/receipt-demo1.jpg', receipt_check: 'pending' });
  P({ id: 796, dept_id: 'fnb', created_by: 'e32', created_at: iso(H(29)), items: 'Салфетки бумажные — 20 уп., трубочки — 5 уп.', urgency: 'normal', est_cost: 1200000, status: 'delivered', category: 'Посуда и инвентарь', cost: 1250000, supplier: 'Makro', bought_at: iso(H(21)), buyer: BUY, advance_id: 9201, trip_id: 9301, receipt_check: 'pending' });
  // сегодня одобрено к покупке (вместе с 801 и 803 из демо-базы)
  P({ id: 806, dept_id: 'kitchen', created_by: 'e26', created_at: iso(H(4)), items: 'Помидоры 20 кг, огурцы 15 кг, зелень — 3 кг', urgency: 'normal', est_cost: 900000, status: 'approved', category: 'Продукты', decided_by: DIR, decided_at: iso(H(3.5)) });
  P({ id: 807, dept_id: 'eng', created_by: 'e37', created_at: iso(H(5)), items: 'Лампочки E27 LED — 30 шт, удлинитель 5 м — 4 шт', urgency: 'normal', est_cost: 700000, status: 'approved', category: 'Электрика', decided_by: DIR, decided_at: iso(H(3.4)) });
  P({ id: 808, dept_id: 'hk', created_by: 'e13', created_at: iso(H(6)), items: 'Перчатки резиновые — 30 пар, губки — 50 шт', urgency: 'normal', est_cost: 350000, status: 'approved', category: 'Бытовая химия', decided_by: DIR, decided_at: iso(H(3.3)) });
  P({ id: 809, dept_id: 'fnb', created_by: 'e32', created_at: iso(H(6)), items: 'Вода минеральная 1 л — 12 упаковок', urgency: 'normal', est_cost: 600000, status: 'approved', category: 'Напитки', decided_by: DIR, decided_at: iso(H(3.2)) });
  if (!DB.advances.length) {
    DB.advances.push(
      { id: 9201, emp_id: BUY, currency: 'UZS', amount: 5000000, pending: 0, purpose: 'Поездка на базар ' + dm(Date.now() - H(24)) + ' · 3 заявки', issued_by: ACC, issued_at: iso(H(27)), received_at: iso(H(26.8)), status: 'returning', returned_amount: 1340000, returned_at: iso(H(19)), log: [] },
      { id: 9202, emp_id: BUY, currency: 'UZS', amount: 0, pending: 12000000, purpose: 'Поездка на базар ' + dm() + ' · 6 заявок', issued_by: ACC, issued_at: iso(H(1.2)), received_at: null, status: 'open', log: [] }
    );
    DB.trips.push({ id: 9301, buyer_id: BUY, status: 'back', created_at: iso(H(25)), returned_at: iso(H(20)), advance_id: 9201, spent: 3660000 });
    DB.trip_items.push(
      { id: 9501, trip_id: 9301, purchase_id: 795, place: 'Алайский базар', state: 'bought', price: 410000, sort: 1 },
      { id: 9502, trip_id: 9301, purchase_id: 797, place: 'Алайский базар', state: 'bought', price: 2000000, sort: 2 },
      { id: 9503, trip_id: 9301, purchase_id: 796, place: 'Makro', state: 'bought', price: 1250000, sort: 3 }
    );
    DB.trip_stops.push(
      { id: 9401, trip_id: 9301, place: 'Алайский базар', receipt_path: 'e46/receipt-demo1.jpg', check: 'pending', reason: null },
      { id: 9402, trip_id: 9301, place: 'Makro', receipt_path: null, check: 'pending', reason: null }
    );
  }

  // только для сценариев Playwright: перенос состояния между ролями (страница другой роли грузится заново)
  var CR = window.__W9_CARRY;
  if (CR) {
    ['trips', 'trip_items', 'trip_stops', 'advances'].forEach(function (t) { if (CR[t]) DB[t] = CR[t]; });
    (CR.purchase_requests || []).forEach(function (p) { var i = PR.findIndex(function (x) { return x.id === p.id; }); if (i >= 0) PR[i] = p; else PR.push(p); });
    (CR.notifications || []).forEach(function (n) { DB.notifications = DB.notifications || []; if (!DB.notifications.some(function (x) { return x.id === n.id; })) DB.notifications.push(n); });
    if (CR.seq) seq = CR.seq;
  }
  window.__w9seq = function () { return seq; };
  function meEmp() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null;
    try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {}
    return (DB.employees || []).filter(function (e) { return a ? e.login === a[1] : s && e.user_id === s.user.id; })[0];
  }
  function notify(to, title, body, refType, refId) {
    if (!to) return; DB.notifications = DB.notifications || [];
    DB.notifications.push({ id: ++seq, employee_id: to, at: new Date().toISOString(), title: title, body: body || '', ref_type: refType || null, ref_id: refId || null, urgent: false, read_at: null });
  }
  function accs() { return (DB.employees || []).filter(function (e) { return e.active !== false && isAcc(e); }); }
  function ok(d) { return Promise.resolve({ data: d == null ? { ok: true } : d, error: null }); }
  function bad(m) { return Promise.resolve({ data: null, error: { message: m } }); }
  function row(t, id) { return (DB[t] || []).filter(function (x) { return x.id === id; })[0]; }
  function openTrip(empId) { return DB.trips.filter(function (t) { return t.buyer_id === empId && t.status === 'open'; })[0]; }
  function spentOf(a) { return PR.filter(function (p) { return p.advance_id === a.id && (p.status === 'bought' || p.status === 'delivered'); }).reduce(function (s, p) { return s + (+p.cost || 0); }, 0); }
  function sumTxt(n, c) { return money(n) + ' ' + (c && c !== 'UZS' ? c : 'сум'); }

  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w9trip) return c; c.__w9trip = true;
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      a = a || {}; var me = meEmp(), now = new Date().toISOString();
      if (n === 'trip_build') {
        if (!me || !isBuyer(me)) return bad('Поездку собирает отдел закупок');
        var t = a.p_trip ? row('trips', a.p_trip) : openTrip(me.id);
        if (a.p_trip && (!t || t.status !== 'open' || t.buyer_id !== me.id)) return bad('Поездка уже закрыта');
        if (!a.p_trip && t) return bad('Поездка уже собрана');
        var busy = {}; DB.trip_items.forEach(function (i) { var tt = row('trips', i.trip_id); if (tt && tt.status === 'open') busy[i.purchase_id] = 1; });
        var list = (a.p_items || []).filter(function (x) { var p = row('purchase_requests', x.purchase_id); return p && p.status === 'approved' && !busy[p.id]; });
        if (!list.length) return bad('Нет одобренных заявок к покупке');
        if (!t) { t = { id: ++seq, buyer_id: me.id, status: 'open', created_at: now, returned_at: null, advance_id: null, spent: 0 }; DB.trips.push(t); }
        var k = DB.trip_items.filter(function (i) { return i.trip_id === t.id; }).length;
        list.forEach(function (x) { DB.trip_items.push({ id: ++seq, trip_id: t.id, purchase_id: x.purchase_id, place: String(x.place || 'Оптовый склад').slice(0, 80), state: 'todo', price: null, sort: ++k }); });
        return ok({ ok: true, trip: t.id, n: list.length });
      }
      if (n === 'trip_cancel') {
        var tc = row('trips', a.p_trip); if (!tc || !me || tc.buyer_id !== me.id || tc.status !== 'open') return bad('Поездка не найдена');
        tc.status = 'cancelled'; return ok();
      }
      if (n === 'trip_stop_receipt') {
        var ts = row('trips', a.p_trip); if (!ts || !me || ts.buyer_id !== me.id || ts.status !== 'open') return bad('Поездка не найдена');
        var s0 = DB.trip_stops.filter(function (s) { return s.trip_id === ts.id && s.place === a.p_place; })[0];
        if (!s0) { s0 = { id: ++seq, trip_id: ts.id, place: a.p_place, check: 'pending', reason: null }; DB.trip_stops.push(s0); }
        s0.receipt_path = a.p_path; return ok();
      }
      if (n === 'trip_return') {
        var tr = row('trips', a.p_trip); if (!tr || !me || tr.buyer_id !== me.id || tr.status !== 'open') return bad('Поездка не найдена');
        var adv = DB.advances.filter(function (x) { return x.emp_id === me.id && x.currency === 'UZS' && x.status === 'open' && x.amount > 0; })[0];
        var its = DB.trip_items.filter(function (i) { return i.trip_id === tr.id; }), places = {}, spent = 0;
        its.forEach(function (i) {
          var p = row('purchase_requests', i.purchase_id); if (!p) return;
          if (i.state === 'bought') {
            var st = DB.trip_stops.filter(function (s) { return s.trip_id === tr.id && s.place === i.place; })[0];
            places[i.place] = 1; spent += +i.price || 0;
            Object.assign(p, { status: 'bought', cost: i.price, supplier: i.place, receipt_path: st && st.receipt_path || null, receipt_check: 'pending', advance_id: adv ? adv.id : null, trip_id: tr.id, bought_at: now, buyer: me.id, trip_note: null, carry_place: null });
            notify(p.created_by, 'Закупка приехала — заберите на складе', String(p.items).slice(0, 90), 'pur', p.id);
            if (p.maint_id) { var mr = row('maint_requests', p.maint_id); if (mr && mr.status !== 'done' && mr.status !== 'cancelled') notify(mr.assigned_to || p.created_by, 'Запчасть доставлена — вернуть в работу?', (mr.room_no ? 'Номер ' + mr.room_no + ': ' : '') + mr.text, 'maint', mr.id); }
          } else if (i.state === 'missing') { p.trip_note = 'Нет в наличии · ' + dm(); }
          else if (i.state === 'tomorrow') { p.trip_note = 'Перенесено на завтра · ' + dm(); p.carry_place = i.place; }
        });
        Object.keys(places).forEach(function (pl) { if (!DB.trip_stops.some(function (s) { return s.trip_id === tr.id && s.place === pl; })) DB.trip_stops.push({ id: ++seq, trip_id: tr.id, place: pl, receipt_path: null, check: 'pending', reason: null }); });
        DB.trip_stops = DB.trip_stops.filter(function (s) { return s.trip_id !== tr.id || places[s.place]; });
        Object.assign(tr, { status: 'back', returned_at: now, advance_id: adv ? adv.id : null, spent: spent });
        var np = Object.keys(places).length;
        if (np) accs().forEach(function (e) { notify(e.id, 'Чеки на проверку', me.first_name + ' · ' + np + ' ' + (np === 1 ? 'точка' : np < 5 ? 'точки' : 'точек') + ' · ' + sumTxt(spent), 'trip', tr.id); });
        return ok({ ok: true, spent: spent, stops: np });
      }
      if (n === 'adv_issue') {
        if (!me || !(isAcc(me) || isDir(me))) return bad('Выдаёт бухгалтерия или директор');
        var cur = a.p_currency === 'USD' ? 'USD' : 'UZS', amt = +a.p_amount || 0, to = (DB.employees || []).filter(function (e) { return e.id === a.p_emp; })[0];
        if (!to) return bad('Сотрудник не найден'); if (!(amt > 0)) return bad('Впишите сумму');
        var ex = DB.advances.filter(function (x) { return x.emp_id === to.id && x.currency === cur && x.status === 'open'; })[0];
        if (ex) { ex.pending = (+ex.pending || 0) + amt; ex.purpose = a.p_purpose || ex.purpose; ex.log = (ex.log || []).concat([{ at: now, by: me.id, kind: 'issue', amount: amt }]); }
        else { ex = { id: ++seq, emp_id: to.id, currency: cur, amount: 0, pending: amt, purpose: a.p_purpose || '', issued_by: me.id, issued_at: now, received_at: null, status: 'open', log: [{ at: now, by: me.id, kind: 'issue', amount: amt }] }; DB.advances.unshift(ex); }
        notify(to.id, 'Выдано под отчёт', sumTxt(amt, cur) + ' · ' + (a.p_purpose || ''), 'adv', ex.id);
        return ok({ ok: true, id: ex.id });
      }
      if (n === 'adv_receive') {
        var ar = row('advances', a.p_id); if (!ar || !me || ar.emp_id !== me.id || !(ar.pending > 0)) return bad('Нечего подтверждать');
        var got = ar.pending; ar.amount = (+ar.amount || 0) + got; ar.pending = 0; ar.received_at = now; ar.log = (ar.log || []).concat([{ at: now, by: me.id, kind: 'receive', amount: got }]);
        notify(ar.issued_by, 'Закупщик получил под отчёт', me.first_name + ' · ' + sumTxt(got, ar.currency), 'adv', ar.id);
        return ok();
      }
      if (n === 'adv_return') {
        var rt = row('advances', a.p_id); if (!rt || !me || rt.emp_id !== me.id || rt.status !== 'open') return bad('Подотчёт не найден');
        if (openTrip(me.id)) return bad('Сначала нажмите «Вернулся»');
        rt.status = 'returning'; rt.returned_amount = Math.max(0, +a.p_amount || 0); rt.returned_at = now; rt.log = (rt.log || []).concat([{ at: now, by: me.id, kind: 'return', amount: rt.returned_amount }]);
        accs().forEach(function (e) { notify(e.id, 'Сдаёт остаток в кассу', me.first_name + ' · ' + sumTxt(rt.returned_amount, rt.currency), 'adv', rt.id); });
        return ok();
      }
      if (n === 'adv_accept') {
        if (!me || !(isAcc(me) || isDir(me))) return bad('Принимает бухгалтерия');
        var ac = row('advances', a.p_id); if (!ac || ac.status !== 'returning') return bad('Остаток ещё не сдан');
        var spent2 = spentOf(ac), exp = (+ac.amount || 0) - spent2, got2 = Math.max(0, +a.p_amount || 0), diff = exp - got2, flag = ac.amount > 0 && Math.abs(diff) / ac.amount > 0.01;
        Object.assign(ac, { status: 'closed', accepted_amount: got2, accepted_by: me.id, accepted_at: now, spent_total: spent2, expected: exp, diff: diff, diff_flag: flag });
        ac.log = (ac.log || []).concat([{ at: now, by: me.id, kind: 'accept', amount: got2 }]);
        var who = row('employees', ac.emp_id);
        notify(ac.emp_id, 'Остаток принят, подотчёт закрыт', sumTxt(got2, ac.currency), 'adv', ac.id);
        if (flag) notify(DIR, 'Подотчёт: расхождение больше 1 %', (who ? who.first_name + ' · ' : '') + 'к сдаче ' + sumTxt(exp, ac.currency) + ' · принято ' + sumTxt(got2, ac.currency), 'trip', ac.id);
        return ok({ ok: true, diff: diff, diff_flag: flag });
      }
      if (n === 'receipt_check') {
        if (!me || !(isAcc(me) || isDir(me))) return bad('Проверяет бухгалтерия');
        var sc = row('trip_stops', a.p_stop); if (!sc) return bad('Чек не найден');
        var stt = ['ok', 'no_receipt', 'mismatch'].indexOf(a.p_status) >= 0 ? a.p_status : null; if (!stt) return bad('Неизвестный статус');
        if (stt !== 'ok' && !String(a.p_reason || '').trim()) return bad('Впишите причину');
        Object.assign(sc, { check: stt, reason: stt === 'ok' ? null : String(a.p_reason).trim().slice(0, 200), checked_by: me.id, checked_at: now });
        PR.forEach(function (p) { if (p.trip_id === sc.trip_id && p.supplier === sc.place) p.receipt_check = stt; });
        var tt2 = row('trips', sc.trip_id);
        if (stt !== 'ok' && tt2) notify(tt2.buyer_id, 'Переснять чек', sc.place + ' · ' + sc.reason, 'trip', tt2.id);
        return ok();
      }
      if (n === 'receipt_retake') {
        var sr = row('trip_stops', a.p_stop), t3 = sr && row('trips', sr.trip_id);
        if (!sr || !t3 || !me || t3.buyer_id !== me.id) return bad('Чек не найден');
        Object.assign(sr, { receipt_path: a.p_path, check: 'pending', reason: null, retake_at: now });
        PR.forEach(function (p) { if (p.trip_id === sr.trip_id && p.supplier === sr.place) { p.receipt_path = a.p_path; p.receipt_check = 'pending'; } });
        accs().forEach(function (e) { notify(e.id, 'Чек переснят', me.first_name + ' · ' + sr.place, 'trip', t3.id); });
        return ok();
      }
      return rpc0.apply(this, arguments);
    };
    return c;
  };
})();
