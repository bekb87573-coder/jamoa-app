/* Mir Luxe One — мок пакета w7-rooms (волна 07). Подключается сразу после mock-ops-rooms.js.
   1) Заглушка помощника ядра askSure (w7-core): после слияния её перекроет локальная функция в app.html. В слияние не берётся.
   2) RPC room_hk: «Проверен» только из «Чистый / Ждёт проверки»; при «Проверен» закрывается существующая задача «Уборка N».
   3) hk_assign: вчерашнее распределение для «Как вчера» (только если вчера пусто).
   4) Превью фото уборки — нейтральная графитовая заглушка вместо сиреневой (только пути room-*). */
(function () {
  // ---- 1. заглушка askSure (контракт §1.1: Promise<boolean>) ----
  window.askSure = window.askSure || function (text) { return Promise.resolve(window.confirm(text)); };

  var DB = window.__DB; if (!DB || !DB.pms_rooms) return;
  var TZ = 'Asia/Tashkent', now = Date.now();
  function dOf(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms)); }
  var yday = dOf(now - 864e5);
  function room(no) { return DB.pms_rooms.filter(function (r) { return r.no === no; })[0]; }
  // задача уборки этого номера, которая ещё не закрыта (новая задача не создаётся)
  function closeCleanTasks(no, at) {
    var re = new RegExp('^Уборка\\s+' + no + '(\\D|$)');
    (DB.tasks || []).forEach(function (t) { if (re.test(t.title || '') && t.status !== 'done' && t.status !== 'cancelled') { t.status = 'done'; t.done_at = at; } });
  }

  if (!DB.__w7RoomsSeed) {
    DB.__w7RoomsSeed = true;
    // номер уже проверен — его задача уборки не должна висеть «в работе»
    DB.pms_rooms.forEach(function (r) { if (r.hk === 'inspected' && r.inspected_at && dOf(new Date(r.inspected_at).getTime()) === dOf(now)) closeCleanTasks(r.no, r.inspected_at); });
    // ---- 3. вчерашнее распределение (для «Как вчера») ----
    DB.hk_assign = DB.hk_assign || [];
    if (!DB.hk_assign.some(function (a) { return a.day === yday; })) {
      [['e14', '3'], ['e16', '4']]  /* вчера e15 в отпуске (график) */.forEach(function (p) {
        for (var i = 1; i <= 14; i++) { var no = p[1] + (i < 10 ? '0' : '') + i, r = room(no); if (r && r.hk !== 'ooo') DB.hk_assign.push({ day: yday, room_no: no, emp_id: p[0], by_emp: 'e13', at: new Date(now - 864e5 - 4 * 3600e3).toISOString() }); }
      });
    }
  }

  var PH = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#2A2B2E"/><rect x="40" y="150" width="320" height="90" rx="10" fill="#3A3B3F"/><rect x="60" y="120" width="120" height="44" rx="10" fill="#E9E4D8"/><rect x="220" y="120" width="120" height="44" rx="10" fill="#E9E4D8"/><rect x="40" y="236" width="320" height="10" fill="#B8975A"/><circle cx="330" cy="60" r="22" fill="none" stroke="#B8975A" stroke-width="3"/></svg>');

  var orig = window.supabase && window.supabase.createClient; if (!orig) return;
  window.supabase.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w7Rooms) return c; c.__w7Rooms = true;
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      if (n !== 'room_hk') return rpc0.apply(c, arguments);
      a = a || {};
      var r = room(String(a.p_no));
      // ---- 2. «Проверен» только после уборки ----
      if (r && a.p_hk === 'inspected' && r.hk !== 'clean' && r.hk !== 'inspected') return Promise.resolve({ data: null, error: { message: 'Сначала уборка' } });
      return rpc0.apply(c, arguments).then(function (res) {
        if (!res.error && r && a.p_hk === 'inspected') closeCleanTasks(r.no, new Date().toISOString());
        return res;
      });
    };
    // ---- 4. превью фото уборки ----
    try {
      var st0 = c.storage.from.bind(c.storage);
      c.storage.from = function (b) {
        var o = st0(b), su = o.createSignedUrl;
        o.createSignedUrl = function (p) { if (/(^|\/)room-\d+/.test(String(p))) return Promise.resolve({ data: { signedUrl: PH }, error: null }); return su.apply(o, arguments); };
        return o;
      };
    } catch (e) {}
    return c;
  };
})();
