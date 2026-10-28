/* Mir Luxe One — демо-данные пакета ops-supply (закупки и платежи). Подключается сразу после demo-mock.js. */
(function () {
  var DB = window.__DB; if (!DB) return;
  var TZ = 'Asia/Tashkent';
  function dayStr(off) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + (off || 0) * 86400000)); }
  function agoIso(h) { return new Date(Date.now() - h * 3600000).toISOString(); }
  function byLogin(l, def) { var e = (DB.employees || []).filter(function (x) { return x.login === l; })[0]; return e ? e.id : def; }

  // Закупки: категория из справочника PQ_CAT; у 804 фактическая сумма и поставщик
  (DB.purchase_requests || []).forEach(function (x) {
    if (x.category === 'Бельё и текстиль') x.category = 'Бельё и полотенца';
    if (x.id === 804) { x.cost = 2300000; x.supplier = 'Посуда-Опт, Чорсу'; }
  });

  // Платежи (раньше было пусто)
  if (!DB.payments) DB.payments = [];
  if (!DB.payments.length) {
    var acc = byLogin('azamat.x', 'e2');
    DB.payments.push(
      { id: 9101, supplier: 'ООО «Мясной двор»', amount: 18500000, currency: 'UZS', purpose: 'Счёт № 412 от ' + dayStr(-1).slice(8, 10) + '.' + dayStr(-1).slice(5, 7) + ': говядина и курица для банкета', due_date: dayStr(2), status: 'pending', created_by: acc, created_at: agoIso(5), file_path: null, note: null },
      { id: 9102, supplier: 'Booking.com', amount: 1240, currency: 'USD', purpose: 'Комиссия за сентябрь, инвойс BK-0925', due_date: dayStr(-1), status: 'pending', created_by: acc, created_at: agoIso(30), file_path: null, note: null },
      { id: 9103, supplier: 'Узэлектро', amount: 3200000, currency: 'UZS', purpose: 'Электротовары по договору № 17: кабель, автоматы', due_date: dayStr(5), status: 'approved', created_by: acc, created_at: agoIso(26), file_path: null, note: null },
      { id: 9104, supplier: 'Чистый дом', amount: 2300000, currency: 'UZS', purpose: 'Бытовая химия для номеров, счёт № 88', due_date: dayStr(-3), status: 'paid', created_by: acc, created_at: agoIso(96), file_path: null, note: null }
    );
  }
})();
