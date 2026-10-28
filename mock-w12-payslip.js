/* Mir Luxe One — демо-мок пакета w12-payslip (волна 12): «Мой расчётный лист».
   Таблицы: payslips (шапка: сотрудник × месяц, статус draft/published/paid, оклад, смены/часы из табеля),
            payslip_lines (строки: base, night, overtime, upsell, bonus, fine, advance, tax),
            payslip_questions (вопрос сотрудника по строке → ответ бухгалтера).
   RPC: payslip_ask, payslip_answer, payslip_save, payslip_import, payslip_publish, payslip_paid.
   Видимость (как RLS на сервере): сотрудник — только свои опубликованные листы и свои вопросы; бухгалтерия (Главный бухгалтер, Бухгалтер) и директор — всё.
   Писать в таблицы можно только через RPC. Задачи не создаются. Цифры учебные (Ташкент, 2026, сумы).
   Подключается после остальных mock-*.js. */
(function () {
  var DB = window.__DB; if (!DB || DB.__w12PayslipSeed) return; DB.__w12PayslipSeed = true;
  var TZ = 'Asia/Tashkent', seq = 120000;
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  var YM = T.slice(0, 7);
  function ymAdd(ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1); }
  var M0 = ymAdd(YM, -2), M1 = ymAdd(YM, -1), M2 = YM;            // август (выплачен), сентябрь (выплачен), октябрь (черновик)
  function iso(day, hm) { return new Date(day + 'T' + hm + ':00+05:00').toISOString(); }
  function r100(x) { return Math.round(x / 100) * 100; }
  function r1000(x) { return Math.round(x / 1000) * 1000; }
  // оклады по должностям, сум/мес (Ташкент, 2026)
  var OKLAD = window.MLX_OKLAD = { 1: 25000000, 2: 12000000, 3: 12000000, 4: 7500000, 5: 7000000, 6: 7000000, 7: 9000000, 8: 6500000, 9: 5500000, 10: 8000000, 11: 3800000, 12: 3500000, 13: 3300000, 14: 14000000, 15: 6000000, 16: 6000000, 17: 3200000, 18: 10000000, 19: 6000000, 20: 3500000, 21: 9000000, 22: 6500000, 23: 3500000, 24: 5500000, 25: 4200000 };
  var NORM_H = 176;              // часов в месяце для часовой ставки
  var TAX = 0.12;                // НДФЛ — так считает бухгалтерия; в листе хранится сумма
  // % бонуса допродаж — настройка директора (prefs.upsell_bonus_pct, как в «Допродажах»), читается в момент расчёта
  function upsPct() { var hs = (DB.hotel_settings || [])[0] || {}; var p = hs.prefs && hs.prefs.upsell_bonus_pct != null ? +hs.prefs.upsell_bonus_pct : 5; return p >= 0 && p <= 50 ? p : 5; }
  var E = (DB.employees || []).filter(function (e) { return e.active !== false; });
  var P = DB.payslips = DB.payslips || [], L = DB.payslip_lines = DB.payslip_lines || [], Q = DB.payslip_questions = DB.payslip_questions || [];

  function hmMin(s) { var a = String(s || '00:00').split(':'); return +a[0] * 60 + +a[1]; }
  function tashMin(ts) { var d = new Date(Date.parse(ts) + 5 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
  function nightMin(a) {         // пересечение отметки с 22:00–06:00
    if (!a.clock_in || !a.clock_out) return 0;
    var s = Date.parse(a.clock_in), e = Date.parse(a.clock_out), n = 0;
    for (var t = s; t < e; t += 6e4 * 10) { var m = tashMin(new Date(t).toISOString()); if (m >= 22 * 60 || m < 6 * 60) n += 10; }
    return n;
  }
  function planMin(a) { var s = hmMin(a.shift_start), e = hmMin(a.shift_end); var d = e - s; if (d <= 0) d += 1440; return d; }
  function tabel(empId, ym) {
    var rows = (DB.attendance || []).filter(function (x) { return x.employee_id === empId && String(x.day).slice(0, 7) === ym; });
    var days = {}, wm = 0, nm = 0, om = 0;
    rows.forEach(function (a) {
      days[a.day] = 1;
      var w = a.clock_out ? (+a.worked_min || Math.round((Date.parse(a.clock_out) - Date.parse(a.clock_in)) / 6e4)) : 0;
      wm += w; nm += nightMin(a);
      if (a.shift_start && a.shift_end) { var ov = w - planMin(a); if (ov >= 30) om += ov; }
    });
    return { shifts: Object.keys(days).length, hours: Math.round(wm / 60), night: Math.round(nm / 60), ot: Math.floor(om / 30) / 2, n: rows.length };
  }
  function upsellOf(empId, ym) {
    var l = (DB.upsells || []).filter(function (u) { return u.emp_id === empId && String(u.at || u.created_at).slice(0, 7) === ym && u.status !== 'void' && u.status !== 'cancelled'; });   // аннулированные (void) в бонус не входят
    var sum = l.reduce(function (s, u) { return s + (+u.amount || 0); }, 0);
    return { n: l.length, sum: sum, bonus: r100(sum * upsPct() / 100) };
  }
  function prevOklad(empId, ym) { var l = P.filter(function (x) { return x.employee_id === empId && x.ym < ym && x.oklad > 0; }).sort(function (x, y) { return x.ym < y.ym ? 1 : -1; }); return l.length ? l[0].oklad : 0; }
  function dayFor(empIdx, base) { return base[empIdx % base.length]; }

  // ---- расчёт строк: одна формула для сида и для RPC (бухгалтер присылает оклад, премии, штрафы, аванс, налог) ----
  function calc(ps, inp) {
    var rate = ps.oklad / NORM_H;
    var base = r100(ps.oklad * Math.min(1, ps.norm_shifts ? ps.shifts / ps.norm_shifts : 1));
    var out = [{ kind: 'base', qty: ps.shifts, amount: base }];
    out.push({ kind: 'night', qty: ps.night_h, amount: r100(ps.night_h * rate * 0.5) });
    out.push({ kind: 'overtime', qty: ps.ot_h, amount: r100(ps.ot_h * rate * 2) });
    out.push({ kind: 'upsell', qty: ps.ups_n || 0, amount: inp.upsell != null ? +inp.upsell : (ps.ups_bonus || 0), base_sum: ps.ups_sum || 0 });
    (inp.bonus || []).forEach(function (b) { if (+b.amount) out.push({ kind: 'bonus', amount: Math.abs(+b.amount), comment: b.comment || null }); });
    (inp.fine || []).forEach(function (b) { if (+b.amount) out.push({ kind: 'fine', amount: Math.abs(+b.amount), comment: b.comment || null }); });
    var acc = out.reduce(function (s, l) { return s + (l.kind === 'fine' ? -l.amount : l.amount); }, 0);
    out.push({ kind: 'advance', amount: inp.advance != null ? +inp.advance : r1000(ps.oklad * 0.4 / 10) * 10 });
    out.push({ kind: 'tax', amount: inp.tax != null ? +inp.tax : r100(Math.max(0, acc) * TAX) });
    return out;
  }
  function putLines(ps, lines) {
    for (var i = L.length - 1; i >= 0; i--) if (L[i].payslip_id === ps.id) L.splice(i, 1);
    lines.forEach(function (l, k) { L.push({ id: ++seq, payslip_id: ps.id, employee_id: ps.employee_id, ym: ps.ym, kind: l.kind, qty: l.qty == null ? null : l.qty, amount: Math.round(+l.amount || 0), base_sum: l.base_sum || null, comment: l.comment || null, sort: k }); });
    var acc = lines.reduce(function (s, l) { return s + (l.kind === 'fine' ? -l.amount : ['advance', 'tax'].indexOf(l.kind) >= 0 ? 0 : l.amount); }, 0);
    var ded = lines.reduce(function (s, l) { return s + (['advance', 'tax'].indexOf(l.kind) >= 0 ? +l.amount : 0); }, 0);
    ps.accrued = Math.round(acc); ps.deducted = Math.round(ded); ps.to_pay = Math.round(acc - ded);
  }

  // ---- демо: изменения живут в sessionStorage вкладки, чтобы сценарий «сотрудник спросил → бухгалтер ответил → сотрудник видит» проходил через смену входа (#as=) ----
  var SKEY = 'mlx-w12-payslip', MYN = [];
  function save() { try { sessionStorage.setItem(SKEY, JSON.stringify({ d: T, seq: seq, P: P, L: L, Q: Q, N: MYN })); } catch (x) {} }
  var saved = null; try { saved = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); } catch (x) {}
  if (saved && saved.d === T && saved.P && saved.P.length) {
    [].push.apply(P, saved.P); [].push.apply(L, saved.L); [].push.apply(Q, saved.Q); MYN = saved.N || []; seq = Math.max(seq, saved.seq || 0);
    DB.notifications = DB.notifications || []; MYN.forEach(function (n) { DB.notifications.push(n); });
  } else seedAll();
  function seedAll() {
  // ---- сид: три месяца по всем сотрудникам ----
  var BONUS_TXT = ['Премия за подготовку конференции', 'Премия за замену коллеги на больничном', 'Премия за генеральную уборку этажа', 'Премия к Дню независимости'];
  var FINE_TXT = ['Опоздание более 30 минут без предупреждения', 'Порча белья, акт о списании', 'Нарушение формы одежды, повторно'];
  E.forEach(function (e, i) {
    var ok = OKLAD[e.position_id] || 4000000;
    [M0, M1, M2].forEach(function (ym, k) {
      var tb = tabel(e.id, ym), src = tb.n ? 'tabel' : 'archive';
      if (!tb.n) { var sh = (['sec', 'eng'].indexOf(e.dept_id) >= 0 ? 10 : ['adm', 'sales', 'dir'].indexOf(e.dept_id) >= 0 ? 21 : 24) - (i % 4 === 1 ? 1 : 0); tb = { shifts: sh, hours: sh * (['sec', 'eng'].indexOf(e.dept_id) >= 0 && e.position_id !== 21 ? 24 : 8), night: ['sec', 'fo', 'lobby'].indexOf(e.dept_id) >= 0 ? (e.dept_id === 'sec' ? sh * 8 : 6 + i % 5) : 0, ot: i % 6 === 2 ? 4 : 0 }; }
      var ups = upsellOf(e.id, ym);
      var norm = tb.shifts + (src === 'archive' && i % 4 === 1 ? 1 : 0);
      var ps = { id: ++seq, employee_id: e.id, ym: ym, status: k === 2 ? 'draft' : 'paid', oklad: ok, shifts: tb.shifts, norm_shifts: norm, hours: tb.hours, night_h: tb.night, ot_h: tb.ot, src: src,
        ups_n: ups.n, ups_sum: ups.sum, ups_bonus: ups.bonus,
        advance_day: ym + '-15', published_at: k === 2 ? null : iso(ymAdd(ym, 1) + '-03', '17:20'), published_by: k === 2 ? null : 'e2', paid_at: k === 2 ? null : iso(ymAdd(ym, 1) + '-05', '11:00'),
        updated_at: iso(k === 2 ? T : ymAdd(ym, 1) + '-03', '16:00'), updated_by: 'e2' };
      var inp = { bonus: [], fine: [] };
      if (i % 5 === 0) inp.bonus.push({ amount: 200000 + (i % 4) * 100000, comment: BONUS_TXT[(i + k) % BONUS_TXT.length] });
      if (i % 7 === 3 && k < 2) inp.fine.push({ amount: 50000 + (i % 3) * 25000, comment: FINE_TXT[(i + k) % FINE_TXT.length] });
      if (e.login === 'barno.r') {
        inp = { bonus: [{ amount: k === 1 ? 300000 : 250000, comment: k === 1 ? 'Премия за подготовку конференции' : 'Премия за генеральную уборку этажа' }], fine: k === 1 ? [{ amount: 60000, comment: 'Порча белья, акт о списании' }] : [] };
      }
      if (e.login === 'zikrullo.b' && k === 1) inp.bonus.push({ amount: 400000, comment: 'Премия за замену коллеги на больничном' });
      P.push(ps); putLines(ps, calc(ps, inp));
    });
  });
  // вопросы: один отвеченный (Барно, август), один ждёт ответа (Зикрулло, сентябрь)
  function psOf(login, ym) { var e = E.filter(function (x) { return x.login === login; })[0]; return e && P.filter(function (p) { return p.employee_id === e.id && p.ym === ym; })[0]; }
  var pb = psOf('barno.r', M0), pz = psOf('zikrullo.b', M1);
  if (pb) Q.push({ id: ++seq, payslip_id: pb.id, employee_id: pb.employee_id, ym: M0, line_kind: 'advance', text: 'Почему аванс меньше, чем в прошлом месяце?', status: 'answered', created_at: iso(ymAdd(M0, 1) + '-06', '09:12'), answer: 'Аванс считается как 40% оклада. В июле была доплата за отпуск — поэтому он был больше.', answered_by: 'e3', answered_at: iso(ymAdd(M0, 1) + '-06', '11:40') });
  if (pz) Q.push({ id: ++seq, payslip_id: pz.id, employee_id: pz.employee_id, ym: M1, line_kind: 'upsell', text: 'В сентябре было 3 допродажи, а бонус как за две?', status: 'open', created_at: iso(T, '08:50'), answer: null, answered_by: null, answered_at: null });
  }

  // ---- права ----
  function meEmp() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null;
    try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (x) {}
    return (DB.employees || []).filter(function (e) { return a ? e.login === a[1] : s && s.user && e.user_id === s.user.id; })[0];
  }
  function posName(id) { var p = (DB.positions || []).filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; }
  function isAcc(e) { return !!e && ['Главный бухгалтер', 'Бухгалтер'].indexOf(posName(e.position_id)) >= 0; }
  function isDir(e) { return !!e && e.role === 'director'; }
  function accountants() { return (DB.employees || []).filter(function (e) { return e.active !== false && isAcc(e); }); }
  function notify(to, title, body, rt, rid) { DB.notifications = DB.notifications || []; var n = { id: ++seq, employee_id: to, at: new Date().toISOString(), title: title, body: body || '', ref_type: rt, ref_id: rid || null, urgent: false, read_at: null }; DB.notifications.push(n); MYN.push(n); }
  function fio(e) { return e ? e.last_name + ' ' + e.first_name : ''; }
  var MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  function monName(ym) { return MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
  var LINE_RU = { base: 'Оклад', hours: 'Отработано часов', shifts: 'Смены', night: 'Ночные', overtime: 'Сверхурочные', upsell: 'Бонус допродаж', bonus: 'Премии и штрафы', fine: 'Премии и штрафы', advance: 'Аванс', tax: 'Налог', total: 'К выплате', other: 'Другое' };
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function no(m) { return Promise.resolve({ data: null, error: { message: m } }); }

  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w12payslip) return c; c.__w12payslip = true;
    // RLS-эмуляция: чтение своих данных; запись — только RPC
    var from0 = c.from;
    c.from = function (t) {
      P = DB.payslips = DB.payslips || []; L = DB.payslip_lines = DB.payslip_lines || []; Q = DB.payslip_questions = DB.payslip_questions || []; /* волна 3: те же массивы, что после фильтра учебных записей */ 
      var q = from0.apply(this, arguments);
      if (['payslips', 'payslip_lines', 'payslip_questions'].indexOf(t) < 0 || !q || !q.f) return q;
      var me = meEmp(), all = isAcc(me) || isDir(me);
      if (!all) {
        var mine = me ? me.id : '-';
        if (t === 'payslips') q.f.push(function (r) { return r.employee_id === mine && r.status !== 'draft'; });
        else if (t === 'payslip_lines') q.f.push(function (r) { if (r.employee_id !== mine) return false; var p = P.filter(function (x) { return x.id === r.payslip_id; })[0]; return !!p && p.status !== 'draft'; });
        else q.f.push(function (r) { return r.employee_id === mine; });
      }
      ['insert', 'update', 'upsert', 'delete'].forEach(function (op) { q[op] = function () { q.f.push(function () { return false; }); q.op = 'select'; return q; }; });
      return q;
    };
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      P = DB.payslips = DB.payslips || []; L = DB.payslip_lines = DB.payslip_lines || []; Q = DB.payslip_questions = DB.payslip_questions || []; /* волна 3: те же массивы, что после фильтра учебных записей */ 
      if (/^payslip_|^payroll_fund$/.test(n)) { var res = rpcPs.apply(this, arguments); if (res) { res.then(save); return res; } }
      return rpc0.apply(this, arguments);
    };
    function rpcPs(n, a) {
      a = a || {}; var me = meEmp();
      if (n === 'payslip_ask') {
        var ps = P.filter(function (x) { return x.id === +a.p_payslip; })[0], txt = String(a.p_text || '').trim();
        if (!me || !ps || ps.employee_id !== me.id || ps.status === 'draft') return no('Нет доступа');
        if (txt.length < 3) return no('Напишите вопрос');
        if (Q.filter(function (x) { return x.employee_id === me.id && x.status === 'open'; }).length >= 10) return no('Дождитесь ответа на прежние вопросы');
        var qq = { id: ++seq, payslip_id: ps.id, employee_id: me.id, ym: ps.ym, line_kind: a.p_line || 'other', text: txt.slice(0, 500), status: 'open', created_at: new Date().toISOString(), answer: null, answered_by: null, answered_at: null };
        Q.push(qq);
        accountants().forEach(function (x) { if (x.id !== me.id) notify(x.id, 'Вопрос по расчётному листу', fio(me) + ' · ' + monName(ps.ym) + ' · ' + (LINE_RU[qq.line_kind] || ''), 'payroll', qq.id); });
        return ok({ ok: true, id: qq.id });
      }
      if (n === 'payslip_answer') {
        if (!isAcc(me)) return no('Отвечает бухгалтерия');
        var q2 = Q.filter(function (x) { return x.id === +a.p_id; })[0], ans = String(a.p_text || '').trim();
        if (!q2) return no('Вопрос не найден'); if (q2.status !== 'open') return no('На вопрос уже ответили'); if (ans.length < 2) return no('Напишите ответ');
        q2.answer = ans.slice(0, 1000); q2.status = 'answered'; q2.answered_by = me.id; q2.answered_at = new Date().toISOString();
        notify(q2.employee_id, 'Ответ бухгалтерии по расчёту', monName(q2.ym) + ' · ' + (LINE_RU[q2.line_kind] || ''), 'payslip', q2.payslip_id);   // сумм и текста в уведомлении нет — видно на заблокированном экране
        return ok({ ok: true });
      }
      if (n === 'payslip_save' || n === 'payslip_import') {
        if (!isAcc(me)) return no('Расчёт правит только бухгалтерия');
        var rows = n === 'payslip_save' ? [a] : (a.p_rows || []), done = 0, skipped = 0;
        if (n === 'payslip_save') { var p0 = P.filter(function (x) { return x.id === +a.p_payslip; })[0]; if (!p0) return no('Нет доступа'); if (p0.status === 'paid') return no('Месяц выплачен — правка закрыта'); }
        rows.forEach(function (r) {
          var p = r.p_payslip ? P.filter(function (x) { return x.id === +r.p_payslip && (n === 'payslip_save' || (x.employee_id === r.employee_id && x.ym === a.p_ym)); })[0] : null;
          if (!p && n === 'payslip_import') p = P.filter(function (x) { return x.employee_id === r.employee_id && x.ym === a.p_ym; })[0];
          if (!p) {
            var e = (DB.employees || []).filter(function (x) { return x.id === r.employee_id; })[0]; if (!e) return;
            var ym = r.ym || a.p_ym, tb = tabel(e.id, ym), up = upsellOf(e.id, ym);
            p = { id: ++seq, employee_id: e.id, ym: ym, status: 'draft', oklad: prevOklad(e.id, ym), shifts: tb.shifts, norm_shifts: tb.shifts, hours: tb.hours, night_h: tb.night, ot_h: tb.ot, src: 'tabel', ups_n: up.n, ups_sum: up.sum, ups_bonus: up.bonus, advance_day: ym + '-15' };
            P.push(p);
          }
          if (p.status === 'paid') { skipped++; return; }
          var h = r.p_head || r;
          if (n === 'payslip_import') {   // пустая ячейка — оставить как есть: премии/штрафы, аванс и налог из текущего листа
            var cur = L.filter(function (l) { return l.payslip_id === p.id; });
            var keep = function (k) { return cur.filter(function (l) { return l.kind === k; }).map(function (l) { return { amount: l.amount, comment: l.comment }; }); };
            if (!(r.bonus || []).length) r.bonus = keep('bonus'); if (!(r.fine || []).length) r.fine = keep('fine');
            if (r.advance == null && keep('advance')[0]) r.advance = keep('advance')[0].amount;
          }
          if (h.oklad != null && +h.oklad > 0) p.oklad = Math.round(+h.oklad);
          ['norm_shifts', 'night_h', 'ot_h'].forEach(function (k) { if (h[k] != null && h[k] !== '' && !isNaN(+h[k])) p[k] = +h[k]; });
          putLines(p, calc(p, { bonus: r.bonus || [], fine: r.fine || [], advance: r.advance, tax: r.tax, upsell: r.upsell }));
          p.updated_at = new Date().toISOString(); p.updated_by = me.id; done++;
          if (p.status === 'published') notify(p.employee_id, 'Расчёт изменён', monName(p.ym) + ' — бухгалтерия обновила расчёт', 'payslip', p.id);
        });
        return ok({ ok: true, n: done, skipped_paid: skipped });
      }
      if (n === 'payslip_prepare') {
        if (!isAcc(me)) return no('Только бухгалтерия');
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(a.p_ym || '')) return no('Неверный месяц');
        if (a.p_ym > YM) return no('Месяц ещё не начался');
        var cr = 0, rf = 0;
        E.forEach(function (e) {
          var p = P.filter(function (x) { return x.employee_id === e.id && x.ym === a.p_ym; })[0], tb = tabel(e.id, a.p_ym), up = upsellOf(e.id, a.p_ym);
          if (!p) { p = { id: ++seq, employee_id: e.id, ym: a.p_ym, status: 'draft', oklad: prevOklad(e.id, a.p_ym), norm_shifts: tb.shifts, advance_day: a.p_ym + '-15' }; P.push(p); cr++; }
          else if (p.status === 'draft') rf++; else return;
          Object.assign(p, { shifts: tb.shifts, hours: tb.hours, night_h: tb.night, ot_h: tb.ot, src: tb.n ? 'tabel' : 'archive', ups_n: up.n, ups_sum: up.sum, ups_bonus: up.bonus, updated_at: new Date().toISOString(), updated_by: me.id });
          if (!p.norm_shifts || p.norm_shifts < p.shifts) p.norm_shifts = p.shifts;
          var cur = L.filter(function (l) { return l.payslip_id === p.id; }), keep = function (k) { return cur.filter(function (l) { return l.kind === k; }).map(function (l) { return { amount: l.amount, comment: l.comment }; }); };
          putLines(p, calc(p, { bonus: keep('bonus'), fine: keep('fine') }));
        });
        return ok({ ok: true, created: cr, refreshed: rf });
      }
      if (n === 'payroll_fund') {
        if (!isAcc(me) && !isDir(me)) return no('Нет доступа');
        var prevYm = ymAdd(a.p_ym, -1), dd = {};
        P.forEach(function (p) {
          if (p.ym !== a.p_ym && p.ym !== prevYm) return;
          var e = (DB.employees || []).filter(function (x) { return x.id === p.employee_id; })[0]; if (!e || e.active === false) return; /* волна 3: только активные сотрудники заведения */
          var d = dd[e.dept_id] = dd[e.dept_id] || { dept_id: e.dept_id, people: 0, accrued: 0, to_pay: 0, tax: 0, prev_accrued: 0 };
          if (p.ym === prevYm) { d.prev_accrued += p.accrued || 0; return; }
          d.people++; d.accrued += p.accrued || 0; d.to_pay += p.to_pay || 0;
          d.tax += L.filter(function (l) { return l.payslip_id === p.id && l.kind === 'tax'; }).reduce(function (s, l) { return s + l.amount; }, 0);
        });
        var res = Object.keys(dd).map(function (k) { return dd[k]; }).filter(function (d) { return d.people; }).sort(function (x, y) { return y.accrued - x.accrued; });
        res.forEach(function (d) { if (!d.prev_accrued) d.prev_accrued = null; });
        return ok({ ym: a.p_ym, depts: res, total: res.reduce(function (s, d) { return s + d.accrued; }, 0) });
      }
      if (n === 'payslip_publish' || n === 'payslip_paid') {
        if (!isAcc(me)) return no('Только бухгалтерия');
        if (n === 'payslip_publish' && P.some(function (p) { return p.ym === a.p_ym && p.status === 'draft' && !(p.oklad > 0); })) return no('Есть листы без оклада — заполните перед публикацией');
        if (n === 'payslip_paid' && !P.some(function (p) { return p.ym === a.p_ym && p.status === 'published'; })) return no('Сначала опубликуйте месяц');
        var from = n === 'payslip_publish' ? 'draft' : 'published', to = n === 'payslip_publish' ? 'published' : 'paid', cnt = 0, now = new Date().toISOString();
        P.forEach(function (p) {
          if (p.ym !== a.p_ym || p.status !== from) return;
          p.status = to; cnt++;
          if (to === 'published') { p.published_at = now; p.published_by = me.id; notify(p.employee_id, 'Расчётный лист готов', monName(p.ym), 'payslip', p.id); }
          else p.paid_at = now;
        });
        return ok({ ok: true, n: cnt });
      }
      return null;
    }
    return c;
  };
})();
