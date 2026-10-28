// Мок пакета front-home (круг 03): учебная просьба гостя, уже взятая официантом (e34, Дилшодбек).
(function () {
  var DB = window.__DB; if (!DB) return;
  try {
    var t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    DB.guest_requests = DB.guest_requests || [];
    if (!DB.guest_requests.some(function (x) { return x.id === 405; }))
      DB.guest_requests.push({ id: 405, room_no: '318', kind: 'food', dept_id: 'fnb', text: 'Чай и фрукты в номер', status: 'work', taken_by: 'e34', taken_at: t + 'T11:40:00+05:00', created_at: t + 'T11:35:00+05:00', lang: 'ru' });
  } catch (e) {}
})();
