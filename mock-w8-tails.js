/* w8-tails: демо-брони импортированы из Fidelio как «Гость 6402» — в «Заездах сегодня», «Счёте в номер» и допродажах это читалось как интерфейс.
   Даём учебные (вымышленные) имена по номеру брони — детерминированно, без реальных персональных данных. Подключать после mock-w7-data.js. */
(function () {
  var DB = window.__DB; if (!DB || !DB.pms_bookings) return;
  var L = ['Каримов', 'Юсупова', 'Рахимов', 'Ахмедова', 'Ибрагимов', 'Назарова', 'Тошпулатов', 'Мирзаева', 'Холматов', 'Сафарова', 'Smith', 'Müller', 'Kim', 'Rossi', 'Ivanov', 'Tanaka', 'Novak', 'Petrova', 'Schmidt', 'Lee', 'Garcia', 'Özdemir'];
  var F = ['А.', 'Д.', 'Ж.', 'М.', 'Н.', 'О.', 'С.', 'Ш.', 'J.', 'A.', 'M.', 'L.', 'K.', 'T.', 'E.'];
  DB.pms_bookings.forEach(function (b) {
    if (b.last_name !== 'Гость' || !/^\d+$/.test(String(b.first_name || ''))) return;
    var n = +b.first_name, i = (n * 7 + 3) % L.length, lat = /[A-Za-zÖÜü]/.test(L[i]);
    b.last_name = L[i]; b.first_name = lat ? F[8 + n % 7] : F[n % 8];
  });
})();
/* w8-tails: ремонт 204 (заявка 301) — по нему открыта закупка №802 «Смеситель…», значит заявка на паузе «Ждёт запчасть», а не «В работе». */
(function () {
  var DB = window.__DB; if (!DB || !DB.maint_requests) return;
  var m = DB.maint_requests.filter(function (x) { return x.id === 301; })[0], p = (DB.purchase_requests || []).filter(function (x) { return x.id === 802; })[0];
  if (!m || !p || m.status === 'done') return;
  var t = Date.parse(m.taken_at || m.created_at) || Date.now();
  m.paused_at = new Date(Math.min(Date.now() - 6e4, t + 20 * 6e4)).toISOString(); m.pause_reason = 'Ждёт запчасть'; m.paused_by = m.assigned_to || m.taken_by || null;
  if (m.room_no && /номер \d+/.test(p.items || '')) p.items = p.items.replace(/номер \d+/, 'номер ' + m.room_no);
})();
