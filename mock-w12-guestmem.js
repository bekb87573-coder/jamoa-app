// mock-w12-guestmem.js — только демо (пакет w12-guestmem, волна 12): «Память о госте»
// Учебные карточки постоянных гостей, привязанные к броням Fidelio по номеру профиля (fid_profile).
// RPC: gm_room, gm_badges, gm_list, gm_profile, gm_pref_add, gm_pref_del, gm_profile_set — права как в RLS (см. changes.md).
(function () {
  var DB = window.__DB; if (!DB || !DB.pms_bookings || !DB.employees) return;
  var TZ = 'Asia/Tashkent';
  function dstr(dt) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(dt || new Date()); }
  var T = dstr();
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function byLogin(l) { return DB.employees.filter(function (e) { return e.login === l; })[0] || {}; }
  function emp(id) { return DB.employees.filter(function (e) { return e.id === id; })[0]; }
  function meEmp() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null;
    try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {}
    return DB.employees.filter(function (e) { return a ? e.login === a[1] : s && s.user && e.user_id === s.user.id; })[0];
  }
  // кто что видит (то же правило — в RLS): all — ресепшен/нач. приёма/директор; room — хаускипинг; food — F&B и кухня
  var VIS = { all: ['pillow', 'floor', 'quiet', 'allergy', 'drink', 'kids', 'clean', 'dates'], room: ['pillow', 'floor', 'quiet', 'kids', 'clean'], food: ['allergy', 'drink', 'kids'] };
  function scopeOf(e) {
    if (!e) return null;
    if (e.role === 'director' || e.dept_id === 'fo' || e.position_id === 7) return 'all';
    if (e.dept_id === 'hk') return 'room';
    if (e.dept_id === 'fnb' || e.dept_id === 'kitchen') return 'food';
    return null;
  }
  function canDelAny(e) { return !!e && (e.role === 'director' || (e.role === 'manager' && scopeOf(e) === 'all')); }

  var z = byLogin('zikrullo.b'), sk = byLogin('shaxriyor.k'), si = byLogin('shoxrux.i'), br = byLogin('barno.r'), ib = byLogin('ibroxim.r'), ob = byLogin('obidjon.t'), da = byLogin('dilshodbek.a'), ak = byLogin('akbarjon.a');
  function iso(daysBack, hmTime) { return new Date(addDays(T, -daysBack) + 'T' + hmTime + ':00+05:00').toISOString(); }
  function live(b) { return b.status !== 'cancelled' && b.status !== 'noshow' && b.status !== 'out'; }

  if (!DB.guest_profiles) {
    var arr = DB.pms_bookings.filter(function (b) { return b.arrival === T && b.room_no && live(b); });
    var inh = DB.pms_bookings.filter(function (b) { return b.status === 'inhouse' && b.arrival < T && b.departure >= T && b.room_no; });
    // план: [бронь, vip, визитов, телефон, предпочтения [cat, text, src, кто, дней назад]]
    var plan = [
      [arr[2], true, 6, '+998 90 000 12 01', [['pillow', 'Две подушки', 'guest', z, 40], ['floor', 'Высокий этаж', 'guest', sk, 120], ['allergy', 'Аллергия на орехи', 'guest', z, 40], ['drink', 'Зелёный чай', 'staff', da, 12], ['clean', 'Не беспокоить до 10:00', 'guest', br, 40], ['dates', 'День рождения 14.03', 'guest', sk, 300]]],
      [arr[5], false, 3, '+998 90 000 12 02', [['quiet', 'Тихий номер', 'guest', z, 60], ['drink', 'Чёрный кофе без сахара', 'staff', ob, 60], ['pillow', 'Жёсткая', 'staff', br, 60]]],
      [arr[0], false, 2, '+998 90 000 12 03', [['kids', 'Детская кроватка', 'guest', sk, 90], ['allergy', 'Без лактозы', 'guest', z, 90], ['kids', 'Детский стул', 'staff', da, 90]]],
      [arr[8], true, 9, '+998 90 000 12 04', [['floor', 'Вид на город', 'guest', si, 200], ['clean', 'Уборка после 14:00', 'guest', ib, 30], ['allergy', 'Только халяль', 'guest', z, 200], ['dates', 'Годовщина свадьбы 02.11', 'guest', si, 200]]],
      [inh[0], false, 4, '+998 90 000 12 05', [['pillow', 'Гипоаллергенная', 'guest', z, 3], ['allergy', 'Аллергия на пыльцу — без живых цветов', 'guest', z, 3], ['drink', 'Вода без газа', 'staff', da, 2]]],
      [inh[3], false, 2, '+998 90 000 12 06', [['quiet', 'Подальше от лифта', 'guest', sk, 5], ['clean', 'Уборка вечером', 'staff', br, 2]]],
      [inh[6], true, 5, '+998 90 000 12 07', [['drink', 'Кофе с молоком', 'staff', ob, 4], ['allergy', 'Без глютена', 'guest', z, 4], ['floor', 'Высокий этаж', 'guest', z, 4]]],
      [inh[9], false, 3, '+998 90 000 12 08', [['pillow', 'Мягкая', 'guest', br, 2]]]
    ];
    var pid = 700, xid = 7000, P = [], R = [];
    plan.forEach(function (p, i) {
      var b = p[0]; if (!b) return;
      var id = ++pid, fp = 'F-' + (20410 + i * 37);
      b.fid_profile = fp;
      P.push({ id: id, fid_profile: fp, last_name: b.last_name, first_name: b.first_name, phone: p[3], vip: p[1], visits: p[2], last_stay: addDays(T, -(30 + i * 11)), created_by: (p[4][0][3] || z).id, created_at: iso(p[4][0][4], '12:00') });
      p[4].forEach(function (q, k) { R.push({ id: ++xid, profile_id: id, cat: q[0], text: q[1], src: q[2], by_id: (q[3] || z).id, at: iso(q[4], ['09:40', '13:15', '16:05', '19:30', '21:10', '11:20'][k % 6]) }); });
    });
    // постоянные гости, которых сейчас нет в отеле (для списка директора)
    [['Каримова', 'Л.', true, 7, [['floor', 'Низкий этаж', 'guest'], ['allergy', 'Вегетарианец', 'guest'], ['dates', 'День рождения 05.01', 'guest']]],
     ['Becker', 'H.', false, 4, [['pillow', 'Две подушки', 'guest'], ['drink', 'Чёрный кофе без сахара', 'staff']]],
     ['Усманов', 'Б.', false, 3, [['quiet', 'Окна во двор', 'guest'], ['clean', 'Только по просьбе', 'guest']]]
    ].forEach(function (g, i) {
      var id = ++pid;
      P.push({ id: id, fid_profile: 'F-' + (19870 + i * 53), last_name: g[0], first_name: g[1], phone: '+998 90 000 13 0' + (i + 1), vip: g[2], visits: g[3], last_stay: addDays(T, -(45 + i * 20)), created_by: sk.id, created_at: iso(200 + i, '12:00') });
      g[4].forEach(function (q, k) { R.push({ id: ++xid, profile_id: id, cat: q[0], text: q[1], src: q[2], by_id: (k ? z : sk).id, at: iso(60 + i * 20, '15:0' + k) }); });
    });
    DB.guest_profiles = P; DB.guest_prefs = R;
  }

  function curBooking(room, day) {
    var c = DB.pms_bookings.filter(function (b) { return b.room_no === String(room) && live(b) && b.arrival <= day && b.departure >= day; });
    // в день смены гостя важнее заезжающий
    c.sort(function (a, b) { return (b.arrival === day) - (a.arrival === day) || (a.departure === day) - (b.departure === day); });
    return c[0] || null;
  }
  function profOf(b) { return b && b.fid_profile ? DB.guest_profiles.filter(function (p) { return p.fid_profile === b.fid_profile; })[0] || null : null; }
  function prefsOf(pid, sc, me) {
    var vis = VIS[sc] || [];
    return DB.guest_prefs.filter(function (x) { return x.profile_id === pid && !x.deleted_at && vis.indexOf(x.cat) >= 0; }).map(function (x) {
      var e = emp(x.by_id); return Object.assign({}, x, { by_name: e ? e.first_name : '—', can_del: canDelAny(me) || x.by_id === me.id });
    }).sort(function (a, b) { return (b.cat === 'allergy') - (a.cat === 'allergy') || (a.at < b.at ? 1 : -1); });
  }
  function profOut(p, sc) {
    if (!p) return null;
    var o = { id: p.id, last_name: p.last_name, first_name: p.first_name, vip: !!p.vip, visits: p.visits || 1, last_stay: p.last_stay };
    if (sc === 'all') { o.phone = p.phone || null; o.fid_profile = p.fid_profile; }
    return o;
  }
  function bkOut(b) { return b ? { id: b.id, room_no: b.room_no, last_name: b.last_name, first_name: b.first_name, arrival: b.arrival, departure: b.departure, status: b.status, children: b.children || 0 } : null; }
  function ok(d) { return Promise.resolve({ data: d, error: null }); }
  function bad(m) { return Promise.resolve({ data: null, error: { message: m } }); }

  var prev = window.supabase && window.supabase.createClient;
  if (!prev) return;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), rpc0 = c.rpc;
    if (c.__gmWrapped) return c; c.__gmWrapped = true;
    c.rpc = function (n, a) {
      if (!/^gm_/.test(n)) return rpc0.apply(c, arguments);
      a = a || {}; var me = meEmp(), sc = scopeOf(me);
      if (!sc) return bad('Нет доступа');
      var day = a.p_day || dstr();
      if (n === 'gm_room') {
        var b = curBooking(a.p_room, day), p = profOf(b);
        return ok({ scope: sc, booking: bkOut(b), profile: profOut(p, sc), prefs: p ? prefsOf(p.id, sc, me) : [] });
      }
      if (n === 'gm_badges') {
        var out = [];
        DB.pms_bookings.forEach(function (b) {
          if (!b.room_no || !live(b) || b.arrival > day || b.departure < day) return;
          var p = profOf(b); if (!p) return;
          var pr = prefsOf(p.id, sc, me);
          out.push({ room_no: b.room_no, booking_id: b.id, profile_id: p.id, arrival: b.arrival, departure: b.departure, last_name: b.last_name, first_name: b.first_name, n: pr.length, allergy: pr.some(function (x) { return x.cat === 'allergy'; }), vip: !!p.vip, visits: p.visits || 1, top: pr.slice(0, 3).map(function (x) { return { cat: x.cat, text: x.text }; }) });
        });
        return ok(out);
      }
      if (n === 'gm_list') {
        var q = String(a.p_q || '').trim().toLowerCase(), qd = q.replace(/\D/g, '');
        var inRoom = {};
        DB.pms_bookings.forEach(function (b) { if (b.fid_profile && b.room_no && live(b) && b.arrival <= day && b.departure >= day) inRoom[b.fid_profile] = b.room_no; });
        var L = DB.guest_profiles.filter(function (p) {
          if (sc !== 'all' && !inRoom[p.fid_profile]) return false; // хаускипинг и F&B — только гости в отеле
          if (!q) return true;
          return (p.last_name + ' ' + p.first_name).toLowerCase().indexOf(q) >= 0 || (sc === 'all' && qd.length >= 3 && String(p.phone || '').replace(/\D/g, '').indexOf(qd) >= 0) || (sc === 'all' && String(p.fid_profile).toLowerCase() === q);
        }).map(function (p) {
          var pr = prefsOf(p.id, sc, me), o = profOut(p, sc);
          o.room_no = inRoom[p.fid_profile] || null; o.n = pr.length; o.allergy = pr.some(function (x) { return x.cat === 'allergy'; });
          return o;
        });
        return ok(L);
      }
      if (n === 'gm_profile') {
        var pp = DB.guest_profiles.filter(function (p) { return p.id === +a.p_id; })[0];
        if (!pp) return bad('Карточка не найдена');
        var rb = DB.pms_bookings.filter(function (b) { return b.fid_profile === pp.fid_profile && b.room_no && live(b) && b.arrival <= day && b.departure >= day; })[0];
        if (sc !== 'all' && !rb) return bad('Нет доступа');
        return ok({ scope: sc, booking: bkOut(rb), profile: profOut(pp, sc), prefs: prefsOf(pp.id, sc, me) });
      }
      if (n === 'gm_pref_add') {
        if ((VIS[sc] || []).indexOf(a.p_cat) < 0) return bad('Нет доступа');
        var txt = String(a.p_text || '').trim().slice(0, 160); if (!txt) return bad('Пустая запись');
        var pid2 = a.p_profile ? +a.p_profile : null;
        if (!pid2) {
          var bb = DB.pms_bookings.filter(function (b) { return b.id === +a.p_booking; })[0];
          if (!bb) return bad('Бронь не найдена');
          var ex = profOf(bb);
          if (ex) pid2 = ex.id; else {
            if (!bb.fid_profile) bb.fid_profile = 'F-' + (30000 + bb.id);
            pid2 = Math.max.apply(null, DB.guest_profiles.map(function (p) { return p.id; }).concat([700])) + 1;
            DB.guest_profiles.push({ id: pid2, fid_profile: bb.fid_profile, last_name: bb.last_name, first_name: bb.first_name, phone: null, vip: false, visits: 1, last_stay: null, created_by: me.id, created_at: new Date().toISOString() });
          }
        }
        var dup = DB.guest_prefs.filter(function (x) { return !x.deleted_at && x.profile_id === pid2 && x.cat === a.p_cat && x.text.toLowerCase() === txt.toLowerCase(); })[0];
        if (dup) return ok({ profile_id: pid2, id: dup.id, dup: true });
        var row = { id: Math.max.apply(null, DB.guest_prefs.map(function (x) { return x.id; }).concat([7000])) + 1, profile_id: pid2, cat: a.p_cat, text: txt, src: a.p_src === 'staff' ? 'staff' : 'guest', by_id: me.id, at: new Date().toISOString() };
        DB.guest_prefs.push(row);
        return ok({ profile_id: pid2, id: row.id });
      }
      if (n === 'gm_pref_del') {
        var i = -1; DB.guest_prefs.forEach(function (x, k) { if (x.id === +a.p_id && !x.deleted_at) i = k; });
        if (i < 0) return bad('Запись не найдена');
        var x0 = DB.guest_prefs[i];
        if (!(canDelAny(me) || x0.by_id === me.id)) return bad('Удалить может автор записи или руководитель приёма');
        if ((VIS[sc] || []).indexOf(x0.cat) < 0) return bad('Нет доступа');
        x0.deleted_at = new Date().toISOString(); x0.deleted_by = me.id; // мягкое удаление: остаётся в журнале
        return ok({ ok: true });
      }
      if (n === 'gm_profile_set') {
        if (sc !== 'all') return bad('Нет доступа');
        var pz = DB.guest_profiles.filter(function (p) { return p.id === +a.p_id; })[0]; if (!pz) return bad('Карточка не найдена');
        if (a.p_phone !== undefined) pz.phone = a.p_phone ? String(a.p_phone).slice(0, 32) : null;
        if (a.p_vip !== undefined) { if (!(me.role === 'director' || me.role === 'manager')) return bad('VIP отмечает руководитель'); pz.vip = !!a.p_vip; }
        return ok({ ok: true });
      }
      return bad('Неизвестный запрос');
    };
    return c;
  };
})();
