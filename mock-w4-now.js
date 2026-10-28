/* Mir Luxe One — демо-мок пакета w4-now («Моё сейчас»). Подключается после последнего mock-*.js.
   Только дописывает учебные данные в window.__DB (даты относительно «сейчас»). На боевом сервере не нужен. */
(function () {
  var DB = window.__DB; if (!DB) return;
  try {
    var TZN = 'Asia/Tashkent', now = Date.now();
    var tday = new Intl.DateTimeFormat('en-CA', { timeZone: TZN }).format(new Date());
    var yday = new Date(Date.parse(tday + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
    var hmT = function (ms) { return new Intl.DateTimeFormat('en-GB', { timeZone: TZN, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms)); };
    var iso = function (ms) { return new Date(ms).toISOString(); };
    var has = function (tb, id) { return (DB[tb] || []).some(function (x) { return x.id === id; }); };
    DB.tasks = DB.tasks || []; DB.guest_requests = DB.guest_requests || []; DB.maint_requests = DB.maint_requests || []; DB.shift_handover = DB.shift_handover || [];

    // barno.r (e14): просроченная со вчера, задача с фото через 40 мин (если ещё сегодня), просьба № 305 в работе
    if (!has('tasks', 7701)) DB.tasks.push({ id: 7701, title: 'Проверить мини-бар 305', notes: 'Пересчитать позиции и пополнить', assignee_id: 'e14', created_by: 'e13', day: yday, due_time: '17:00:00', status: 'work', urgent: false, needs_photo: false, template_id: null, created_at: iso(now - 20 * 3600e3) });
    var d40 = now + 40 * 6e4, t40 = hmT(d40);
    if (!has('tasks', 7702)) DB.tasks.push({ id: 7702, title: 'Уборка 308 после выезда — фото готового номера', assignee_id: 'e14', created_by: 'e13', day: tday, due_time: (t40 > hmT(now) ? t40 : '23:59') + ':00', status: 'work', urgent: false, needs_photo: true, template_id: null, created_at: iso(now - 2 * 3600e3) });
    if (!has('guest_requests', 7703)) DB.guest_requests.push({ id: 7703, room_no: '305', kind: 'towels', dept_id: 'hk', text: 'Ещё два полотенца и халат', status: 'work', taken_by: 'e14', taken_at: iso(now - 12 * 6e4), created_at: iso(now - 18 * 6e4), lang: 'ru' });

    // maxmud.m (e37) и shaxriyor.m (e38): срочные заявки, назначенные им и взятые в работу
    if (!has('maint_requests', 7704)) DB.maint_requests.push({ id: 7704, room_no: '406', place: null, text: 'Не работает кондиционер, гость ждёт', urgent: true, status: 'work', created_by: 'e8', created_at: iso(now - 35 * 6e4), assigned_to: 'e38', taken_at: iso(now - 25 * 6e4), photo_path: null });
    if (!has('maint_requests', 7705)) DB.maint_requests.push({ id: 7705, room_no: null, place: 'Конференц-зал', text: 'Проверить кондиционер перед мероприятием', urgent: true, status: 'work', created_by: 'e0', created_at: iso(now - 50 * 6e4), assigned_to: 'e37', taken_at: iso(now - 40 * 6e4), photo_path: null });

    // zikrullo.b (e8): передача смены ему, ещё не принята
    if (!has('shift_handover', 7706)) DB.shift_handover.push({ id: 7706, cash: 1250000, cash_note: null, open_items: '412 — поздний выезд до 14:00', notes: 'Такси для 305 в 15:00 заказано', created_by: 'e9', to_id: 'e8', acked_by: null, acked_at: null, created_at: iso(now - 15 * 6e4) });

    // tursunboy.y (e43): обход в текущем окне (T−15 … T+45), отметок нет
    var H = +new Intl.DateTimeFormat('en-GB', { timeZone: TZN, hour: '2-digit', hour12: false }).format(new Date()) % 24;
    var M = +new Intl.DateTimeFormat('en-GB', { timeZone: TZN, minute: '2-digit' }).format(new Date());
    var T = ((M < 45 ? H : H + 1) % 24), tt = (T < 10 ? '0' : '') + T + ':00';
    var hs = DB.hotel_settings && DB.hotel_settings[0];
    if (hs) {
      var base = (hs.prefs && hs.prefs.patrol_times) || ['14:00', '18:00', '22:00', '00:00', '02:00', '04:00', '06:00'];
      if (typeof base === 'string') { try { base = JSON.parse(base); } catch (e) { base = String(base).split(','); } }
      base = base.slice(); if (base.indexOf(tt) < 0) base.push(tt);
      hs.prefs = Object.assign({}, hs.prefs || {}, { patrol_times: base });
      var Tm = Date.parse(tday + 'T' + tt + ':00+05:00'); if (T === 0 && H === 23) Tm += 864e5;
      DB.patrol_scans = (DB.patrol_scans || []).filter(function (s) { var x = Date.parse(s.at); return !(x >= Tm - 15 * 6e4 && x <= Tm + 45 * 6e4); });
    }
    // akbarjon.a: утренний замер холодильника 1 не записан — данные ops-fnb не трогаем (у холодильника 1 записи нет)
  } catch (e) {}
})();
