/* w9-breakfast: демо «Завтрак сегодня» — отметки гостей (breakfast_visits), закрытие дня (breakfast_days, RPC breakfast_close).
   Подключается после остальных mock-*.js (после mock-w8-tails.js). Данные учебные, детерминированные. */
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !DB.pms_bookings) return;
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  function at(hm) { return T + 'T' + hm + ':00+05:00'; }
  var NOW = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  function live(b) { return b.room_no && b.status !== 'cancelled' && b.status !== 'noshow' && b.arrival < T && b.departure >= T; }
  DB.breakfast_visits = DB.breakfast_visits || []; DB.breakfast_days = DB.breakfast_days || [];
  var seq = 7700;
  // 412 — учебный пример «уже был в 07:42 (2 чел.)»: завтрак включён, 2 взрослых
  var b412 = DB.pms_bookings.filter(function (b) { return b.room_no === '412' && live(b); })[0];
  if (b412) { b412.meal = 'BB'; b412.adults = 2; b412.children = 0; }
  // 305 — без завтрака (RO); третий по списку номер — завтрак, 1 взрослый + 1 ребёнок, ещё не приходил
  DB.pms_bookings.forEach(function (b) { if (!live(b)) return; if (b.room_no === '305') b.meal = 'RO'; });
  if (!DB.breakfast_visits.some(function (v) { return v.seed_bf; })) {
    var seen = {}, list = DB.pms_bookings.filter(function (b) { if (!live(b) || seen[b.room_no] || b.meal === 'RO') return false; seen[b.room_no] = 1; return true; });
    list.sort(function (a, b) { return a.room_no < b.room_no ? -1 : 1; });
    if (list[2] && list[2].room_no !== '412') { list[2].adults = 1; list[2].children = 1; window.__BF_KID = list[2].room_no; }
    var who = ['e34', 'e35', 'e33'];
    list.forEach(function (b, i) {
      if (i % 3 === 2 && b.room_no !== '412') return;                // каждый третий ещё не приходил
      var mm = 5 + (i * 7) % 95, hh = 7 + Math.floor(mm / 60); mm = mm % 60;
      var t = b.room_no === '412' ? '07:42' : ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
      if (b.room_no !== '412' && t > NOW) return;                    // ещё не наступило — гость пока не приходил
      var a = +b.adults || 1, c = +b.children || 0;
      DB.breakfast_visits.push({ id: ++seq, seed_bf: 1, day: T, room_no: b.room_no, booking_id: b.id, guest: (b.last_name || '') + (b.first_name ? ' ' + b.first_name : ''), meal: b.meal,
        adults: a, children: c, incl_adults: a, incl_children: c, pay: 'incl', amount: 0, charge_ref: null, by_emp: who[i % 3], at: at(t) });
    });
    // сверх тарифа: в 506 привели третьего (в счёт номера), уличный гость оплатил на месте
    var x = list.filter(function (b) { return b.room_no !== '412' && +b.adults === 2; })[0];
    if (x && NOW >= '08:16') DB.breakfast_visits.push({ id: ++seq, seed_bf: 1, day: T, room_no: x.room_no, booking_id: x.id, guest: (x.last_name || '') + (x.first_name ? ' ' + x.first_name : ''), meal: x.meal,
      adults: 1, children: 0, incl_adults: 0, incl_children: 0, pay: 'room', amount: 120000, charge_ref: 'чек 207', by_emp: 'e34', at: at('08:16') });
    if (NOW >= '08:31') DB.breakfast_visits.push({ id: ++seq, seed_bf: 1, day: T, room_no: null, booking_id: null, guest: null, meal: null,
      adults: 1, children: 0, incl_adults: 0, incl_children: 0, pay: 'cash', amount: 120000, charge_ref: null, by_emp: 'e35', at: at('08:31') });
  }
  function meId(c) { try { var s = JSON.parse(localStorage.getItem('mock-session')); var e = DB.employees.filter(function (z) { return s && z.user_id === s.user.id; })[0]; return e ? e.id : null; } catch (x) { return null; } }
  // итог дня — та же логика, что у RPC breakfast_close на сервере
  /* волна 3 (А5): «ожидается» считается так же, как в приложении (bfMealIncl): завтрак только в тарифах BB, HB, FB */
  function incl(m) { return m === 'BB' || m === 'HB' || m === 'FB'; }
  function totals(day) {
    var V = DB.breakfast_visits.filter(function (v) { return v.day === day; }), seen = {}, exp = DB.pms_bookings.slice().sort(function (x, y) { return (y.status === 'inhouse') - (x.status === 'inhouse'); }).filter(function (b) {
      if (!b.room_no || b.status === 'cancelled' || b.status === 'noshow' || !(b.arrival < day && b.departure >= day) || seen[b.room_no]) return false; seen[b.room_no] = 1; return true; });
    var o = { day: day, exp_rooms: 0, exp_persons: 0, incl_persons: 0, incl_rooms: 0, cash_persons: 0, cash_amount: 0, room_persons: 0, room_amount: 0, noshow: [], charges: [] }, came = {};
    exp.forEach(function (b) { if (!incl(b.meal)) return; o.exp_rooms++; o.exp_persons += (+b.adults || 0) + (+b.children || 0); });
    V.forEach(function (v) {
      var inc = (+v.incl_adults || 0) + (+v.incl_children || 0), ex = (+v.adults || 0) + (+v.children || 0) - inc;
      o.incl_persons += inc; if (inc && v.room_no) came[v.room_no] = 1;
      if (ex > 0 && v.pay === 'cash') { o.cash_persons += ex; o.cash_amount += +v.amount || 0; }
      if (ex > 0 && v.pay === 'room') { o.room_persons += ex; o.room_amount += +v.amount || 0; o.charges.push({ room: v.room_no, persons: ex, amount: +v.amount || 0, ref: v.charge_ref }); }
    });
    o.incl_rooms = Object.keys(came).length;
    exp.forEach(function (b) { if (incl(b.meal) && !came[b.room_no]) o.noshow.push(b.room_no); });
    return o;
  }
  function meEmp() { var id = meId(); return DB.employees.filter(function (z) { return z.id === id; })[0] || null; }
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function bad(m) { return Promise.resolve({ data: null, error: { message: m } }); }
  function hmT(ts) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts)); }
  function book(room, day) { return DB.pms_bookings.slice().sort(function (x, y) { return (y.status === 'inhouse') - (x.status === 'inhouse'); }).filter(function (b) { return String(b.room_no) === room && b.status !== 'cancelled' && b.status !== 'noshow' && b.arrival < day && b.departure >= day; })[0] || null; }
  var make = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = make.apply(this, arguments);
    if (c.__bf) return c; c.__bf = 1;
    var rpc = c.rpc;
    c.rpc = function (n, a) {
      if (n === 'breakfast_close') {
        var day = (a && a.p_day) || T, ex = DB.breakfast_days.filter(function (d) { return d.day === day; })[0], mc = meEmp();
        if (ex) return Promise.resolve({ data: ex, error: null });                 // повторное закрытие — тот же итог
        // права как в bfCanClose(): директор; F&B — по настройке директора breakfast_close_by ('all' — вся служба, 'lead' — F&B-менеджер/супервайзер/хостес)
        var cby = (((DB.hotel_settings || [])[0] || {}).prefs || {}).breakfast_close_by, dir = mc && mc.role === 'director', fnbM = mc && (mc.dept_id === 'fnb' || mc.lead_dept === 'fnb');
        var lead = fnbM && (mc.role === 'manager' || /хостес/i.test(((DB.positions || []).filter(function (q) { return q.id === mc.position_id; })[0] || {}).name || ''));
        if (!(dir || (fnbM && (cby !== 'lead' || lead)))) return bad('Нет доступа');
        if (!dir && day !== T) return bad('Прошлые дни закрывает руководитель ресторана или директор');
        var row = { day: day, closed_at: new Date().toISOString(), closed_by: meId(), totals: totals(day) };
        DB.breakfast_days.push(row); return Promise.resolve({ data: JSON.parse(JSON.stringify(row)), error: null });
      }
      // breakfast_mark — как на сервере (sql/notes.md): сервер сам считает места по тарифу; «в счёт номера» — charge_to_room в той же операции
      if (n === 'breakfast_mark') {
        a = a || {}; var me = meEmp(), room = a.p_room == null || a.p_room === '' ? null : String(a.p_room), ad = +a.p_adults || 0, ch = +a.p_children || 0, pay = a.p_pay || 'incl';
        if (!me || !(me.role === 'director' || me.dept_id === 'fnb' || me.lead_dept === 'fnb')) return bad('Нет доступа');
        if (DB.breakfast_days.some(function (d) { return d.day === T; })) return bad('Завтрак за этот день уже закрыт — попросите руководителя открыть день');
        if (!(ad + ch) || ad + ch > 30) return bad('Проверьте число гостей');
        var bk = null, V = DB.breakfast_visits.filter(function (v) { return v.day === T && room && v.room_no === room; });
        if (room) {
          if (!(DB.pms_rooms || []).some(function (r) { return String(r.no) === room; })) return bad('Номера ' + room + ' нет в отеле');
          bk = book(room, T); if (!bk) return bad('Номер ' + room + ' свободен — гостя нет');
          if (V.length && !a.p_force) { var lv = V[V.length - 1]; return ok({ ok: false, already: true, at: hmT(lv.at), persons: (+lv.adults || 0) + (+lv.children || 0) }); }
        } else if (pay !== 'cash') return bad('Гость без номера — только оплата на месте');
        var inc = bk && bk.meal !== 'RO', ua = 0, uc = 0; V.forEach(function (v) { ua += +v.incl_adults || 0; uc += +v.incl_children || 0; });
        var ia = inc ? Math.min(ad, Math.max(0, (+bk.adults || 1) - ua)) : 0, ic = inc ? Math.min(ch, Math.max(0, (+bk.children || 0) - uc)) : 0, ex = ad + ch - ia - ic;
        if (ex > 0 && pay === 'incl') return bad('Не входит в тариф: ' + ex + ' чел. — выберите «В счёт номера» или «Оплата на месте»');
        var price = +(((DB.hotel_settings || [])[0] || {}).prefs || {}).breakfast_price || 120000, amt = ex > 0 ? (a.p_amount != null ? +a.p_amount : ex * price) : 0;
        var vr = { id: ++seq, day: T, room_no: room, booking_id: bk ? bk.id : null, guest: bk ? (bk.last_name || '') + (bk.first_name ? ' ' + bk.first_name : '') : null, meal: bk ? bk.meal || 'BB' : null,
          adults: ad, children: ch, incl_adults: ia, incl_children: ic, pay: ex > 0 ? pay : 'incl', amount: amt, charge_ref: null, by_emp: me.id, at: new Date().toISOString() };
        var fin = function (ref) { vr.charge_ref = ref || null; DB.breakfast_visits.push(vr); return { data: { ok: true, visit: JSON.parse(JSON.stringify(vr)), incl: ia + ic, extra: ex, charge_ref: vr.charge_ref }, error: null }; };
        if (ex > 0 && pay === 'room') return rpc.call(c, 'charge_to_room', { p_room: room, p_amount: amt, p_desc: 'Завтрак сверх тарифа: ' + ex + ' чел.', p_kind: 'breakfast' }).then(function (r) { return r.error ? r : fin(r.data); });
        return Promise.resolve(fin(null));
      }
      if (n === 'breakfast_undo') {
        var me2 = meEmp(), v = DB.breakfast_visits.filter(function (z) { return z.id === (a && a.p_id); })[0];
        if (!v) return bad('Отметка не найдена');
        if (DB.breakfast_days.some(function (d) { return d.day === v.day; })) return bad('Завтрак за этот день уже закрыт — попросите руководителя открыть день');
        var lead = me2 && (me2.role === 'director' || (me2.dept_id === 'fnb' && me2.role === 'manager'));
        if (!lead) {
          if (!me2 || v.by_emp !== me2.id) return bad('Нет доступа');
          if (v.pay === 'room') return bad('Начислено в счёт номера — отменить может руководитель ресторана');
          var um = +(((DB.hotel_settings || [])[0] || {}).prefs || {}).breakfast_undo_min || 10;
          if (Date.now() - Date.parse(v.at) > um * 6e4) return bad('Время на отмену вышло — обратитесь к руководителю ресторана');
        }
        DB.breakfast_visits = DB.breakfast_visits.filter(function (z) { return z !== v; });
        return ok({ ok: true, charge_ref: v.charge_ref, warn: v.pay === 'room' && v.charge_ref ? 'Сторнируйте начисление ' + v.charge_ref + ' в Fidelio' : null });
      }
      if (n === 'breakfast_counts') {
        var dd = (a && a.p_day) || T, tt = totals(dd), cl = DB.breakfast_days.filter(function (d) { return d.day === dd; })[0], VV = DB.breakfast_visits.filter(function (v) { return v.day === dd; });
        var cr = {}; VV.forEach(function (v) { if (v.room_no) cr[v.room_no] = 1; });
        return ok({ day: dd, exp_persons: tt.exp_persons, exp_rooms: tt.exp_rooms, came_persons: tt.incl_persons, came_rooms: tt.incl_rooms, extra_persons: tt.cash_persons + tt.room_persons, closed: cl ? { closed_at: cl.closed_at, closed_by: cl.closed_by } : null });
      }
      if (n === 'breakfast_reopen') { var d0 = (a && a.p_day) || T, mr = meEmp(); if (!mr || mr.role !== 'director') return bad('Открыть день может только директор'); DB.breakfast_days = DB.breakfast_days.filter(function (d) { return d.day !== d0; }); return Promise.resolve({ data: true, error: null }); }
      return rpc.call(c, n, a);
    };
    return c;
  };
})();
