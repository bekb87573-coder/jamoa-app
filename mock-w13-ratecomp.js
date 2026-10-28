/* Mir Luxe One — мок пакета w13-ratecomp (волна 12): «Цены рынка» — цены 6 конкурентов на 14 дней вперёд.
   Источник в бою — Google-таблица «Mir Luxe — цены конкурентов» (лист «Конкуренты», лист «Цены»),
   её раз в час читает edge-функция rates_sync в таблицы comp_hotels / comp_rates; приложение только читает
   (+ ручной ввод цены начальником приёма). Демо: цены USD за ночь (Standard DBL), даты от сегодняшнего дня (Ташкент).
   Подключать после остальных mock-*.js. */
(function () {
  var DB = window.__DB; if (!DB || DB.__w13RcSeed) return; DB.__w13RcSeed = true;
  var TZ = 'Asia/Tashkent';
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function add(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function wd(d) { return (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; }       // 0 = пн … 6 = вс
  var seed = 20261048; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  var SHEET = '1A_LuNyTLjahDoGXHeboTJXQHI9z6T-dyofgRoEDQb94';
  // лист «Конкуренты»: ID, Отель, Класс, Почему в списке, Ссылка, Активен, Примечание; mlx — мы
  DB.comp_hotels = [
    { id: 'mlx', name: 'Mir Luxe Plaza', class: '4*', why: 'Мы', url: '', active: true, note: 'Наша цена — из Fidelio / экстранета' },
    { id: 'afr', name: 'Grand Afrosiyob', class: '4*', why: 'Тот же район, деловые гости', url: 'https://www.booking.com/', active: true, note: '' },
    { id: 'dnh', name: 'Daniel Hill', class: '4*', why: 'Похожий номерной фонд и цена', url: 'https://www.booking.com/', active: true, note: '' },
    { id: 'osc', name: 'Oscar Boutique', class: '4*', why: 'Бутик-отель рядом', url: 'https://www.booking.com/', active: true, note: '' },
    { id: 'cor', name: 'Corner Hotel Tashkent', class: '3*', why: 'Нижняя граница рынка', url: 'https://www.booking.com/', active: true, note: 'Цена без завтрака' },
    { id: 'mir', name: 'Miran International', class: '4*', why: 'Конференции и группы', url: 'https://www.booking.com/', active: true, note: '' },
    { id: 'lot', name: 'LOTTE City Palace', class: '5*', why: 'Верхняя граница рынка', url: 'https://www.lottehotel.com/', active: true, note: 'Сайт отеля, цена без завтрака' }
  ];
  // база (будни), надбавка выходных, завтрак, источник
  var H = { afr: [74, 6, true, 'Booking.com'], dnh: [82, 8, true, 'Booking.com'], osc: [66, 4, true, 'Booking.com'], cor: [52, 3, false, 'Booking.com'], mir: [96, 10, true, 'Booking.com'], lot: [148, 14, false, 'Сайт отеля'] };
  // день 0 = сегодня. 4–6 — мы подняли цену (дороже рынка ~12 %); 9–10 — большое мероприятие в городе: нет мест у 4 из 6, рынок вверх, мы отстаём
  var OUR = [78, 78, 80, 84, 92, 94, 92, 80, 78, 80, 82, 84, 78, 76];
  var SOLD = { 9: ['afr', 'osc', 'mir', 'lot'], 10: ['afr', 'dnh', 'mir', 'lot'], 5: ['osc'] };
  var FEW = { 9: ['cor', 'dnh'], 10: ['osc', 'cor'], 4: ['mir'], 11: ['dnh'] };
  var rates = [], id = 1;
  var nowHM = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  var col = nowHM >= '08:40' ? T : add(T, -1);                       // ежедневный сбор в 08:40
  function push(c, d, hid, price, bf, av, src, who) {
    var h = DB.comp_hotels.filter(function (x) { return x.id === hid; })[0];
    rates.push({ id: id++, collected_at: c, stay_date: d, hotel_id: hid, hotel: h.name, category: 'Standard DBL', price_usd: price, breakfast: bf, avail: av, source: src, entered_by: who });
  }
  for (var i = 0; i < 14; i++) {
    var d = add(T, i), we = wd(d) >= 4 && wd(d) <= 5;                  // пт, сб — дороже
    push(col, d, 'mlx', OUR[i], true, i === 9 || i === 10 ? 'few' : 'yes', 'Fidelio', 'Claude');
    Object.keys(H).forEach(function (k) {
      var h = H[k], ev = i === 9 || i === 10 ? 1.22 : i >= 4 && i <= 6 ? 1.0 : 1;
      var p = Math.round((h[0] + (we ? h[1] : 0)) * ev * (0.95 + rnd() * 0.1));
      var sold = (SOLD[i] || []).indexOf(k) >= 0, few = (FEW[i] || []).indexOf(k) >= 0;
      push(col, d, k, sold ? null : p, h[2], sold ? 'no' : few ? 'few' : 'yes', h[3], 'Claude');
      // вчерашний сбор — чуть другие цены (в расчёт идёт только последний)
      if (i < 13) push(add(col, -1), d, k, Math.round(p * (0.96 + rnd() * 0.05)), h[2], 'yes', h[3], 'Claude');
    });
  }
  // ручной ввод начальника приёма вчера: Corner позвонили — цена на 26-е
  push(add(T, -1), add(T, 5), 'cor', 58, false, 'few', 'Звонок на ресепшен', 'Шохрух Ибодуллаев');
  DB.comp_rates = rates;
  DB.comp_sync = [{ id: 1, sheet_id: SHEET, source: 'Google-таблица «Mir Luxe — цены конкурентов»', synced_at: col + 'T08:44:00+05:00', collected_at: col + 'T08:40:00+05:00', rows: rates.length }];
})();
