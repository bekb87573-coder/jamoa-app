/* Mir Luxe One — мок пакета w8-ar (волна 08): дебиторка корпоративных клиентов.
   Источник в бою — выгрузка Fidelio City Ledger (счета на компании и оплаты), приложение только читает.
   Демо: 13 учебных компаний (10 в сумах, 3 в USD — без конвертации), счета за 8 месяцев, оплаты с разной дисциплиной.
   Таблицы: ar_companies, ar_invoices, ar_payments, ar_sync. Даты считаются от сегодняшнего дня (Ташкент). */
(function () {
  var DB = window.__DB; if (!DB || DB.__w8ArSeed) return; DB.__w8ArSeed = true;
  var TZ = 'Asia/Tashkent';
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function add(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  var seed = 20261021; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  // e4 — Сирож (менеджер продаж), e5 — Шахриёр (второй менеджер продаж). Названия и телефоны учебные.
  // lag — на сколько дней после срока обычно платят; stop — с какого месяца назад перестали платить; part — доля частичных оплат
  var CO = [
    ['c01', 'ООО «Навоий Кон-Металл»', 'UZS', 15, 'e4', 34, 0, .35, [18, 46]],
    ['c02', 'ООО «Silk Way Logistics»', 'UZS', 30, 'e4', 4, 0, 0, [9, 24]],
    ['c03', 'АО «Тошкент Агро Экспорт»', 'UZS', 30, 'e4', 72, 0, .3, [22, 58]],
    ['c04', 'ООО «Orient Pharm Group»', 'UZS', 15, 'e5', 9, 0, 0, [12, 30]],
    ['c05', 'АО «Узбек Энерго Сервис»', 'UZS', 30, 'e4', 24, 0, .2, [26, 64]],
    ['c06', 'ООО «Golden Cotton Textile»', 'UZS', 30, 'e5', 44, 0, .25, [14, 38]],
    ['c07', 'ООО «Самарканд Авто Трейд»', 'UZS', 15, 'e4', 0, 0, 0, [7, 19]],
    ['c08', 'ООО «Fergana Build Invest»', 'UZS', 30, 'e4', 20, 4, 0, [16, 42]],
    ['c09', 'Ассоциация «Шёлковый путь — туризм»', 'UZS', 7, 'e5', 14, 0, .2, [8, 26]],
    ['c10', 'ООО «Чирчик Кимё Савдо»', 'UZS', 30, 'e4', 13, 0, 0, [10, 28]],
    ['c11', 'EuroAsia Travel GmbH', 'USD', 30, 'e4', 18, 0, .2, [2400, 7800]],
    ['c12', 'Central Asia Development Forum', 'USD', 15, 'e4', 52, 0, .3, [3100, 9600]],
    ['c13', 'Nordic Engineering Consult', 'USD', 30, 'e5', 5, 0, 0, [1800, 5200]]
  ];
  var WHAT = ['Проживание сотрудников', 'Командировка: проживание и завтраки', 'Конференц-зал и кофе-брейк', 'Групповое размещение', 'Банкет', 'Проживание делегации'];
  var companies = [], inv = [], pay = [], invNo = 3000, payId = 1;
  CO.forEach(function (c, ci) {
    companies.push({ id: c[0], name: c[1], currency: c[2], terms_days: c[3], manager_id: c[4], inn: String(301000000 + ci * 7919 + 1234), contact: 'Бухгалтерия', phone: '+998 71 200 ' + (10 + ci) + ' ' + (40 + ci * 3) });
    for (var m = 8; m >= 0; m--) {
      var n = c[0] === 'c07' || c[0] === 'c13' ? 1 : rnd() < .45 ? 2 : 1;
      for (var k = 0; k < n; k++) {
        var d = add(T, -(m * 30 + Math.floor(rnd() * 26) + (m === 0 ? 0 : 2)));
        if (d > T) d = T;
        if (m === 0 && d > add(T, -1)) d = add(T, -1 - Math.floor(rnd() * 12));
        var lo = c[8][0], hi = c[8][1], amt = lo + rnd() * (hi - lo);
        amt = c[2] === 'USD' ? Math.round(amt / 10) * 10 : Math.round(amt * 10) * 100000;   // сумы: шаг 100 тыс.
        var due = add(d, c[3]), nights = 4 + Math.floor(rnd() * 30), w = pick(WHAT);
        var id = 'i' + (++invNo);
        inv.push({ id: id, no: 'CL-' + d.slice(0, 4) + '-' + invNo, company_id: c[0], inv_date: d, due_date: due, amount: amt, currency: c[2], descr: w + (w.indexOf('Проживание') === 0 ? ' · ' + nights + ' ночей' : '') });
        var stop = c[6] && m < c[6];
        var lag = Math.max(0, Math.round(c[5] + (rnd() - .5) * Math.min(24, c[5] + 6)));
        var pd = add(due, lag), parts = rnd() < c[7] ? [Math.round(amt * (.4 + rnd() * .2) / (c[2] === 'USD' ? 10 : 100000)) * (c[2] === 'USD' ? 10 : 100000)] : [];
        if (parts.length) parts.push(amt - parts[0]);
        else parts = [amt];
        for (var p = 0; p < parts.length; p++) {
          var pdx = p ? add(pd, 20 + Math.floor(rnd() * 25)) : pd;
          if (stop || pdx > T) break;
          pay.push({ id: payId++, invoice_id: id, company_id: c[0], pay_date: pdx, amount: parts[p], currency: c[2], method: c[2] === 'USD' ? 'SWIFT' : 'Перечисление' });
        }
      }
    }
  });
  DB.ar_companies = companies; DB.ar_invoices = inv; DB.ar_payments = pay;
  // время последней выгрузки City Ledger: ночной аудит, сегодня в 06:40 (если сейчас раньше — вчера в 06:40)
  var nowHM = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  DB.ar_sync = [{ id: 1, source: 'Fidelio City Ledger (выгрузка)', synced_at: (nowHM >= '06:40' ? T : add(T, -1)) + 'T06:40:00+05:00', rows: inv.length + pay.length }];
})();
