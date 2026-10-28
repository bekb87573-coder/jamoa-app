/* Mir Luxe One — демо-мок пакета w16-receiving: «Приход товара через охрану → склад службы → пересчёт → себестоимость».
   Подключается после mock-w14-bfcast.js (нужны склад mock-w4-guard / mock-w9-stockreq, поездки mock-w9-trip, завтраки mock-w9-breakfast / mock-w14-bfcast).
   Общий каталог (с w15-kitchenorder): таблица catalog_items {id, dept, section, name, name_uz, unit, norm_name, hidden, last_price, created_by, created_at},
     RPC catalog_add(p_dept,p_section,p_name,p_name_uz,p_unit) → {id, existing}; catalog_hide(p_id,p_hidden) → {ok}.
     Если catalog_add/catalog_hide уже обработал мок w15 — берётся его ответ (этот мок отвечает, только когда предыдущий вернул пусто).
   Таблицы пакета: rv_suppliers, rv_receipts, rv_lines, rv_counts, rv_count_lines; связь склада: stock_items.catalog_id, stock_moves.rv_id.
   RPC (формат = sql/migration.sql): rv_trips, rv_suppliers, rv_supplier_add, rv_create, rv_list, rv_check, rv_hist,
     rv_count_form, rv_count_save, rv_counts. Задачи не создаются — только уведомления (ref_type 'rcv').
   Состояние после действий хранится в localStorage `mlx-w16rv` (только демо: сценарий «охрана → шеф → директор» при смене пользователя). */
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !window.supabase.createClient) return;
  var LS = 'mlx-w16rv', TZ = 'Asia/Tashkent';
  function tzDay(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d || new Date()); }
  function at(daysAgo, hhmm) { var d = new Date(Date.now() - daysAgo * 864e5); return new Date(tzDay(d) + 'T' + (hhmm || '10:00') + ':00+05:00').toISOString(); }
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function wd(d) { return (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; }
  function byLogin(l) { return (DB.employees || []).filter(function (e) { return e.login === l; })[0] || null; }
  function empById(id) { return (DB.employees || []).filter(function (e) { return e.id === id; })[0] || null; }
  function posOf(e) { return (DB.positions || []).filter(function (x) { return e && x.id === e.position_id; })[0] || null; }
  var AS0 = /as=([a-z0-9._]+)/.exec(location.hash || '');
  function me() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || '') || AS0, uid = null;
    if (a) return byLogin(a[1]);
    try { var s = JSON.parse(localStorage.getItem('mock-session')); uid = s && s.user && s.user.id; } catch (x) {}
    return (DB.employees || []).filter(function (x) { return x.user_id === uid; })[0] || null;
  }
  function money(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function r2(n) { return Math.round((+n || 0) * 1000) / 1000; }
  function norm(s) { return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase(); }
  function normE(s) { return norm(s).replace(/ё/g, 'е'); }
  function E(m) { return { data: null, error: { message: m } }; }
  function OK(d) { return { data: d, error: null }; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  var seq = 17000;
  function nid() { return ++seq; }
  ['catalog_items', 'rv_suppliers', 'rv_receipts', 'rv_lines', 'rv_counts', 'rv_count_lines', 'stock_items', 'stock_moves', 'notifications', 'writeoffs'].forEach(function (t) { DB[t] = DB[t] || []; });

  // ---------- роли (как rv_role()/rv_stores() в SQL) ----------
  // склады: кухня — шеф (руководитель службы kitchen), техслужба — гл. инженер (руководитель eng),
  // общий (hk + office) — кладовщик (positions.stock_role = 'keeper'), ресторан и бар — руководитель fnb. Директор — все.
  var STORES = { kitchen: ['kitchen'], eng: ['eng'], main: ['hk', 'office'], fnb: ['fnb', 'bar'] };
  var STORE_NAME = { kitchen: 'Кухня', eng: 'Техслужба', main: 'Общий склад', fnb: 'Ресторан и бар' };
  var DEPT_STORE = { kitchen: 'kitchen', eng: 'eng', hk: 'main', office: 'main', fnb: 'fnb', bar: 'fnb' };
  var STOCK_DEPT = { kitchen: 'kitchen', eng: 'eng', hk: 'hk', office: 'fo', fnb: 'fnb', bar: 'fnb' };
  var PR_STORE = { kitchen: 'kitchen', eng: 'eng', hk: 'main', fo: 'main', adm: 'main', lobby: 'main', fnb: 'fnb', sec: 'main' };
  function isDir(e) { return !!e && e.role === 'director'; }
  function stockRole(e) { var p = posOf(e); return p ? (p.stock_role !== undefined ? p.stock_role : (p.name === 'Закупки и логистика' || p.name === 'Кладовщик' ? 'keeper' : null)) : null; }
  function isAcc(e) { var p = posOf(e); return !!p && (p.name === 'Главный бухгалтер' || p.name === 'Бухгалтер'); }
  function isBuyer(e) { var p = posOf(e); return !!p && (p.purch_access === true || p.name === 'Закупки и логистика'); }
  function isSec(e) { return !!e && e.active !== false && (e.dept_id === 'sec' || e.lead_dept === 'sec'); }
  function lead(e, d) { return !!e && e.role === 'manager' && (e.dept_id === d || e.lead_dept === d); }
  function myStores(e) {
    if (!e || e.active === false) return [];
    if (isDir(e)) return ['kitchen', 'eng', 'main', 'fnb'];
    var o = [];
    if (lead(e, 'kitchen')) o.push('kitchen');
    if (lead(e, 'eng')) o.push('eng');
    if (stockRole(e) === 'keeper') o.push('main');
    if (lead(e, 'fnb')) o.push('fnb');
    return o;
  }
  function respOf(store) {
    var out = (DB.employees || []).filter(function (e) { return e.active !== false && !isDir(e) && myStores(e).indexOf(store) >= 0; }).map(function (e) { return e.id; });
    if (!out.length) out = (DB.employees || []).filter(function (e) { return e.active !== false && isDir(e); }).map(function (e) { return e.id; });
    return out;
  }
  // КТО ПРОВЕРЯЕТ (как rv_can_check в SQL и rvWhoChecks в app.html): ответственный склада; если он сам привёз эту поездку —
  // хаускипинг (все позиции из каталога hk) проверяет менеджер ХК, остальное — директор. Директор — всегда.
  function tripBuyer(r) { var t = r.trip_id ? (DB.trips || []).filter(function (x) { return x.id === r.trip_id; })[0] : null; return t ? t.buyer_id : null; }
  function hkOnly(r) { var L = DB.rv_lines.filter(function (l) { return l.receipt_id === r.id; }); return L.length > 0 && L.every(function (l) { var c = cat(l.catalog_id); return c && c.dept === 'hk'; }); }
  function canCheck(r, e) {
    if (!r || !e || e.active === false || r.status !== 'pending') return false;
    if (isDir(e)) return true;
    var b = tripBuyer(r);
    if (b && myStores(empById(b)).indexOf(r.store) >= 0) {
      if (e.id === b) return false;
      if (hkOnly(r)) return lead(e, 'hk');
      return false;
    }
    return myStores(e).indexOf(r.store) >= 0;
  }
  function checkers(r) {
    var out = (DB.employees || []).filter(function (e) { return !isDir(e) && canCheck(r, e); }).map(function (e) { return e.id; });
    if (!out.length) out = (DB.employees || []).filter(function (e) { return e.active !== false && isDir(e); }).map(function (e) { return e.id; });
    return out;
  }
  function canMoney(e) { return isDir(e) || isAcc(e) || isBuyer(e) || myStores(e).length > 0 || isSec(e); }

  // ---------- каталог: стартовые позиции (названия кухни — как в каталоге w15) ----------
  var CAT0 = [
    ['kitchen', 'Овощи', 'Лук репчатый', 'Piyoz', 'кг', 6000], ['kitchen', 'Овощи', 'Картофель', 'Kartoshka', 'кг', 7000], ['kitchen', 'Овощи', 'Морковь', 'Sabzi', 'кг', 6000],
    ['kitchen', 'Овощи', 'Помидоры', 'Pomidor', 'кг', 14000], ['kitchen', 'Овощи', 'Огурцы', 'Bodring', 'кг', 12000], ['kitchen', 'Овощи', 'Перец болгарский', 'Bulgʻor qalampiri', 'кг', 18000],
    ['kitchen', 'Овощи', 'Капуста', 'Karam', 'кг', 5000], ['kitchen', 'Овощи', 'Шампиньоны', 'Qoʻziqorin (shampinyon)', 'кг', 35000],
    ['kitchen', 'Зелень', 'Укроп', 'Shivit', 'пучок', 2000], ['kitchen', 'Зелень', 'Кинза', 'Kashnich', 'пучок', 2000],
    ['kitchen', 'Фрукты', 'Яблоки', 'Olma', 'кг', 15000], ['kitchen', 'Фрукты', 'Бананы', 'Banan', 'кг', 22000], ['kitchen', 'Фрукты', 'Лимоны', 'Limon', 'кг', 25000],
    ['kitchen', 'Мясо', 'Говядина (мякоть)', 'Mol goʻshti (lahm)', 'кг', 120000], ['kitchen', 'Мясо', 'Баранина', 'Qoʻy goʻshti', 'кг', 125000],
    ['kitchen', 'Птица', 'Курица (тушка)', 'Tovuq (butun)', 'кг', 38000], ['kitchen', 'Птица', 'Куриное филе', 'Tovuq filesi', 'кг', 55000], ['kitchen', 'Рыба', 'Форель', 'Gulmohi (forel)', 'кг', 95000],
    ['kitchen', 'Молочные', 'Молоко 3,2 %', 'Sut 3,2 %', 'л', 12000], ['kitchen', 'Молочные', 'Сливки 33 %', 'Qaymoq 33 %', 'л', 55000], ['kitchen', 'Молочные', 'Сметана', 'Smetana', 'кг', 30000],
    ['kitchen', 'Молочные', 'Творог', 'Tvorog', 'кг', 35000], ['kitchen', 'Молочные', 'Сыр твёрдый', 'Qattiq pishloq', 'кг', 110000], ['kitchen', 'Молочные', 'Масло сливочное', 'Sariyogʻ', 'кг', 95000],
    ['kitchen', 'Молочные', 'Йогурт', 'Yogurt', 'шт', 6000], ['kitchen', 'Яйца', 'Яйца куриные (лоток 30 шт)', 'Tovuq tuxumi (lotok 30 dona)', 'лоток', 36000],
    ['kitchen', 'Бакалея', 'Масло подсолнечное', 'Kungaboqar yogʻi', 'л', 21000], ['kitchen', 'Бакалея', 'Мука высший сорт', 'Oliy navli un', 'кг', 7500], ['kitchen', 'Бакалея', 'Рис девзира', 'Devzira guruch', 'кг', 24000],
    ['kitchen', 'Бакалея', 'Сахар', 'Shakar', 'кг', 13000], ['kitchen', 'Напитки', 'Чай чёрный', 'Qora choy', 'пачка', 30000], ['kitchen', 'Напитки', 'Кофе в зёрнах', 'Kofe donlari', 'кг', 210000],
    ['kitchen', 'Хлеб', 'Лепёшка', 'Non', 'шт', 4000], ['kitchen', 'Хлеб', 'Хлеб для тостов', 'Tost noni', 'пачка', 15000], ['kitchen', 'Бакалея', 'Соль', 'Tuz', 'пачка', 3000],
    ['kitchen', 'Напитки', 'Сок апельсиновый', 'Apelsin sharbati', 'л', 18000],
    ['eng', 'Электрика', 'Лампа E27', 'E27 lampa', 'шт', 18000], ['eng', 'Электрика', 'Лампа E27 LED', 'E27 LED lampa', 'шт', 22000], ['eng', 'Электрика', 'Лампа GU10', 'GU10 lampa', 'шт', 16000],
    ['eng', 'Электрика', 'Батарейки АА', 'AA batareyalar', 'шт', 4000], ['eng', 'Электрика', 'Кабель ВВГ 3×2,5', 'VVG 3×2,5 kabel', 'м', 9000], ['eng', 'Электрика', 'Автомат 16 А', 'Avtomat 16 A', 'шт', 45000],
    ['eng', 'Сантехника', 'Картридж смесителя 40 мм', 'Aralashtirgich kartriji 40 mm', 'шт', 65000], ['eng', 'Сантехника', 'Сифон для раковины', 'Rakovina sifoni', 'шт', 55000],
    ['eng', 'Отделка', 'Герметик силиконовый', 'Silikon germetik', 'шт', 38000], ['eng', 'Отделка', 'Краска водоэмульсионная', 'Suv emulsiyali boʻyoq', 'л', 30000],
    ['hk', 'Химия', 'Моющее для полов', 'Pol yuvish vositasi', 'л', 24000], ['hk', 'Химия', 'Средство для стёкол', 'Oyna tozalash vositasi', 'л', 26000], ['hk', 'Химия', 'Перчатки резиновые', 'Rezina qoʻlqoplar', 'шт', 6000],
    ['hk', 'Химия', 'Губки', 'Gubkalar', 'шт', 1500], ['hk', 'Бельё', 'Полотенце банное', 'Hammom sochiqi', 'шт', 45000], ['hk', 'Бельё', 'Простыня 2-сп.', 'Ikki kishilik choyshab', 'шт', 85000],
    ['hk', 'Бельё', 'Наволочка', 'Yostiq jildi', 'шт', 28000], ['hk', 'Косметика', 'Шампунь 30 мл', 'Shampun 30 ml', 'шт', 3500], ['hk', 'Косметика', 'Мыло 20 г', 'Sovun 20 g', 'шт', 1800],
    ['hk', 'Номер', 'Пакеты для мусора 30 л', 'Axlat paketlari 30 l', 'упак', 14000],
    ['office', 'Канцелярия', 'Бумага А4', 'A4 qogʻoz', 'упак', 52000], ['office', 'Канцелярия', 'Ручки шариковые', 'Sharikli ruchkalar', 'шт', 2500],
    ['fnb', 'Посуда', 'Салфетки бумажные', 'Qogʻoz salfetkalar', 'упак', 9000], ['fnb', 'Расходники', 'Трубочки', 'Trubochkalar', 'упак', 12000],
    ['fnb', 'Напитки', 'Вода 0,5 л', 'Suv 0,5 l', 'шт', 2500], ['fnb', 'Напитки', 'Сок 0,2 л', 'Sharbat 0,2 l', 'шт', 6000],
    ['bar', 'Напитки', 'Вода минеральная 1 л', 'Mineral suv 1 l', 'шт', 7000], ['bar', 'Напитки', 'Кола 0,33 л', 'Kola 0,33 l', 'шт', 6500]
  ];
  // общий каталог хранится в localStorage `mlx-catalog-items` (тот же ключ, что у мока w15-kitchenorder)
  var LSC = 'mlx-catalog-items';
  if (!window.__CAT_LS_LOADED) (function () { var C = null; try { C = JSON.parse(localStorage.getItem(LSC) || 'null'); } catch (x) { C = null; } // merge15: мок w15 уже загрузил каталог
    if (Array.isArray(C)) C.forEach(function (it) { var i = DB.catalog_items.map(function (z) { return z.id; }).indexOf(it.id); if (i >= 0) DB.catalog_items[i] = it; else DB.catalog_items.push(it); }); })();
  function catBy(dept, name) { var n = norm(name), ne = normE(name); return DB.catalog_items.filter(function (c) { return c.dept === dept && (c.norm_name || norm(c.name)) === n; })[0] || DB.catalog_items.filter(function (c) { return c.dept === dept && normE(c.name) === ne; })[0] || null; }
  function cat(id) { return DB.catalog_items.filter(function (c) { return c.id === +id; })[0] || null; }
  CAT0.forEach(function (x, i) {
    if (catBy(x[0], x[2])) return;
    DB.catalog_items.push({ id: 16001 + i, dept: x[0], section: x[1], name: x[2], name_uz: x[3], unit: x[4], norm_name: norm(x[2]), hidden: false, last_price: x[5], created_by: null, created_at: at(40, '09:00') });
  });
  DB.catalog_items.forEach(function (c) { if (!c.norm_name) c.norm_name = norm(c.name); });
  // связь склада с каталогом: существующие позиции склада по названию (как backfill в M110)
  function stockFor(c) {
    var sd = STOCK_DEPT[c.dept];
    var s = (c.stock_item_id ? DB.stock_items.filter(function (x) { return x.id === c.stock_item_id; })[0] : null) || DB.stock_items.filter(function (x) { return x.dept_id === sd && norm(x.name) === c.norm_name; })[0] || null;
    if (s && !c.stock_item_id) c.stock_item_id = s.id;
    return s;
  }
  DB.catalog_items.forEach(stockFor);
  var SK_CAT = { kitchen: 'Продукты', eng: 'Тех. запчасти', office: 'Канцелярия', bar: 'Напитки' };
  function skCat(c) { if (SK_CAT[c.dept]) return SK_CAT[c.dept]; if (c.dept === 'hk') return ['Химия', 'Бельё', 'Косметика'].indexOf(c.section) >= 0 ? c.section : 'Номер'; if (c.dept === 'fnb') return c.section === 'Напитки' ? 'Напитки' : 'Посуда и инвентарь'; return 'Другое'; }
  function stockEnsure(c) {
    var s = stockFor(c); if (s) return s;
    s = { id: nid(), name: c.name, unit: c.unit, dept_id: STOCK_DEPT[c.dept] || 'fo', category: skCat(c), min_qty: 0, price: c.last_price || null, sale_price: null, created_at: new Date().toISOString(), _rv: 1 };
    DB.stock_items.push(s); c.stock_item_id = s.id; return s;
  }

  // ---------- поставщики ----------
  var BUY = byLogin('shuxrat.r'), CHEF = byLogin('akbarjon.a'), ENG = byLogin('maxmud.m'), DIR = byLogin('bekzod.a');
  var G1 = byLogin('tursunboy.y'), G2 = byLogin('abdullo.x'), G0 = byLogin('zoirjon.n');
  function id0(e) { return e ? e.id : null; }
  var SUP0 = [
    [16201, 'Sifat Agro', '+998 90 112 45 67', 'Овощи, зелень, фрукты'], [16202, 'Halol Meat', '+998 93 540 11 20', 'Мясо, птица'],
    [16203, 'Musaffo Sut', '+998 97 701 33 08', 'Молочные продукты, яйца'], [16204, 'Makro', '+998 71 205 00 00', 'Бакалея, напитки'],
    [16205, 'Elektro Servis (Kuyluk)', '+998 99 830 64 12', 'Электрика'], [16206, 'SantexOpt', '+998 90 977 15 50', 'Сантехника, отделка'],
    [16207, 'Toza Uy', '+998 95 145 20 80', 'Химия, бельё']
  ];
  SUP0.forEach(function (x) { if (!DB.rv_suppliers.some(function (s) { return s.id === x[0]; })) DB.rv_suppliers.push({ id: x[0], name: x[1], phone: x[2], goods: x[3], buyer_id: null, norm_name: norm(x[1]), hidden: false, created_by: null, created_at: at(60) }); });
  function buyerSupplier(empId) {
    var s = DB.rv_suppliers.filter(function (x) { return x.buyer_id === empId; })[0]; if (s) return s;
    var e = empById(empId);
    s = { id: nid(), name: 'Закупщик: ' + (e ? e.first_name : '') + ' (базар)', phone: null, goods: 'Поездки на базар', buyer_id: empId, norm_name: norm('Закупщик: ' + (e ? e.first_name : '') + ' (базар)'), hidden: false, created_by: null, created_at: new Date().toISOString() };
    DB.rv_suppliers.push(s); return s;
  }
  if (BUY) { var bs = buyerSupplier(BUY.id); if (bs.id > 16299) { bs.id = 16208; } }

  // ---------- поездка закупщика сегодня (ещё не принята охраной) ----------
  DB.trips = DB.trips || []; DB.trip_items = DB.trip_items || []; DB.trip_stops = DB.trip_stops || []; DB.purchase_requests = DB.purchase_requests || [];
  function H(h) { return new Date(Date.now() - h * 3600e3).toISOString(); }
  if (BUY && !DB.trips.some(function (t) { return t.id === 9360; })) {
    DB.purchase_requests.push(
      { id: 8601, dept_id: 'kitchen', created_by: id0(CHEF), created_at: H(26), items: 'Помидоры — 15 кг\nОгурцы — 10 кг\nКартофель — 30 кг', urgency: 'normal', est_cost: 1000000, status: 'bought', category: 'Продукты', cost: 960000, supplier: 'Алайский базар', bought_at: H(2), buyer: BUY.id, trip_id: 9360, receipt_check: 'ok' },
      { id: 8603, dept_id: 'hk', created_by: id0(byLogin('ibroxim.r')), created_at: H(28), items: 'Перчатки резиновые — 30 шт\nГубки — 50 шт', urgency: 'normal', est_cost: 300000, status: 'bought', category: 'Бытовая химия', cost: 255000, supplier: 'Алайский базар', bought_at: H(2.2), buyer: BUY.id, trip_id: 9360, receipt_check: 'ok' },
      { id: 8602, dept_id: 'eng', created_by: id0(ENG), created_at: H(27), items: 'Лампа E27 LED — 20 шт', urgency: 'normal', est_cost: 500000, status: 'bought', category: 'Электрика', cost: 460000, supplier: 'Куйлюк', bought_at: H(1.6), buyer: BUY.id, trip_id: 9360, receipt_check: 'ok' }
    );
    DB.trips.push({ id: 9360, buyer_id: BUY.id, status: 'back', created_at: H(4), returned_at: H(1), advance_id: null, spent: 1675000 });
    DB.trip_items.push({ id: 9561, trip_id: 9360, purchase_id: 8601, place: 'Алайский базар', state: 'bought', price: 960000, sort: 1 }, { id: 9563, trip_id: 9360, purchase_id: 8603, place: 'Алайский базар', state: 'bought', price: 255000, sort: 3 }, { id: 9562, trip_id: 9360, purchase_id: 8602, place: 'Куйлюк', state: 'bought', price: 460000, sort: 2 });
    DB.trip_stops.push({ id: 9461, trip_id: 9360, place: 'Алайский базар', receipt_path: 'e46/receipt-demo3.jpg', check: 'ok', reason: null }, { id: 9462, trip_id: 9360, place: 'Куйлюк', receipt_path: 'e46/receipt-demo4.jpg', check: 'ok', reason: null });
  }

  // ---------- приходы за 2 недели ----------
  function priceSet(c, p) { if (c && p > 0) c.last_price = Math.round(p); }
  function makeReceipt(o) {
    // o: {id, t (ISO), store, sup, guard, lines:[[name, qty, price, ordered?, purchase?]], status, checker, chkMin, note, qtyOk:{name:qty}, trip, mode, total}
    var deps = STORES[o.store], L = [], tot = 0;
    o.lines.forEach(function (x, i) {
      var c = null; deps.some(function (d) { c = catBy(d, x[0]); return !!c; }); if (!c) return;
      var sum = Math.round(x[1] * x[2]); tot += sum;
      L.push({ id: o.id * 100 + i, receipt_id: o.id, catalog_id: c.id, name: c.name, unit: c.unit, qty_ordered: x[3] == null ? null : x[3], qty: x[1], qty_ok: null, sum: sum, purchase_id: x[4] || null, _c: c });
    });
    if (o.total) { var k = o.total / tot, acc = 0; L.forEach(function (l, i) { l.sum = i === L.length - 1 ? o.total - acc : Math.round(l.sum * k / 100) * 100; acc += l.sum; }); tot = o.total; }
    var rec = { id: o.id, store: o.store, supplier_id: o.sup, trip_id: o.trip || null, total: tot, total_mode: o.mode || 'lines', photo_path: 'demo/rv-' + o.id + '.jpg', photo_goods: o.id % 2 ? 'demo/rv-g' + o.id + '.jpg' : null, note: o.gnote || null,
      status: o.status || 'ok', created_by: o.guard, created_at: o.t, checked_by: o.status === 'pending' ? null : (o.checker || null), checked_at: o.status === 'pending' ? null : new Date(Date.parse(o.t) + (o.chkMin || 40) * 6e4).toISOString(), check_note: o.note || null };
    DB.rv_receipts.push(rec);
    L.forEach(function (l) {
      if (o.qtyOk && o.qtyOk[l.name] != null) l.qty_ok = o.qtyOk[l.name]; else if (rec.status !== 'pending') l.qty_ok = l.qty;
      var s = stockEnsure(l._c); l.stock_item_id = s.id;
      DB.stock_moves.push({ id: o.id * 100 + 50 + L.indexOf(l), item_id: s.id, kind: 'in', qty: l.qty_ok != null ? l.qty_ok : l.qty, reason: 'Приход №' + o.id, room_no: null, by_emp: o.guard, at: o.t, rv_id: o.id, _rv: 1 });
      if (rec.status === 'ok') priceSet(l._c, l.sum / l.qty);
      delete l._c; DB.rv_lines.push(l);
    });
    return rec;
  }
  var dNow = tzDay(), dw = wd(dNow), s1 = dw === 6 ? 7 : dw + 1, s2 = s1 + 7, s3 = s2 + 7;   // s1 — прошлое воскресенье (дней назад), s2 — позапрошлое, s3 — три недели назад
  if (!DB.rv_receipts.length && CHEF) {
    var SA = 16201, HM = 16202, MS = 16203, MK = 16204, ES = 16205, SO = 16206, TU = 16207, g1 = id0(G1), g2 = id0(G2), g0 = id0(G0), ch = CHEF.id, en = id0(ENG), kp = id0(BUY);
    var veg = function (k) { return [['Лук репчатый', 30, 6000 * k], ['Картофель', 40, 7000 * k], ['Морковь', 25, 6000], ['Помидоры', 20, 14000 * k], ['Огурцы', 15, 12000], ['Укроп', 20, 2000], ['Кинза', 20, 2000]]; };
    var milk = [['Молоко 3,2 %', 40, 12000], ['Сливки 33 %', 6, 55000], ['Сметана', 8, 30000], ['Творог', 10, 35000], ['Сыр твёрдый', 6, 110000], ['Масло сливочное', 5, 95000], ['Йогурт', 60, 6000], ['Яйца куриные (лоток 30 шт)', 20, 36000]];
    var id = 16301;
    var R = function (o) { o.id = id++; return makeReceipt(o); };
    // неделя три недели назад (s3 → s2): для динамики себестоимости и истории цен
    R({ t: at(s3 - 1, '08:25'), store: 'kitchen', sup: SA, guard: g1, checker: ch, lines: [['Лук репчатый', 25, 5500], ['Картофель', 35, 6500], ['Морковь', 20, 5500], ['Помидоры', 18, 13000], ['Огурцы', 12, 11000], ['Укроп', 15, 2000], ['Кинза', 15, 2000]] });
    R({ t: at(s3 - 1, '09:15'), store: 'kitchen', sup: MS, guard: g1, checker: ch, lines: milk });
    R({ t: at(s3 - 2, '08:35'), store: 'kitchen', sup: HM, guard: g2, checker: ch, lines: [['Говядина (мякоть)', 20, 118000], ['Курица (тушка)', 25, 37000], ['Куриное филе', 12, 54000]] });
    R({ t: at(s3 - 3, '10:05'), store: 'kitchen', sup: MK, guard: g2, checker: ch, lines: [['Мука высший сорт', 25, 7500], ['Рис девзира', 15, 24000], ['Сахар', 10, 13000], ['Масло подсолнечное', 15, 21000], ['Кофе в зёрнах', 2, 205000]] });
    R({ t: at(s3 - 4, '08:30'), store: 'kitchen', sup: HM, guard: g1, checker: ch, lines: [['Баранина', 10, 124000], ['Курица (тушка)', 15, 37000], ['Говядина (мякоть)', 10, 118000]] });
    R({ t: at(s3 - 4, '09:40'), store: 'kitchen', sup: SA, guard: g1, checker: ch, lines: [['Помидоры', 15, 13500], ['Огурцы', 10, 11500], ['Лимоны', 4, 24000], ['Яблоки', 10, 14000]] });
    R({ t: at(s3 - 5, '09:05'), store: 'kitchen', sup: MS, guard: g1, checker: ch, lines: [['Молоко 3,2 %', 40, 12000], ['Яйца куриные (лоток 30 шт)', 20, 35000], ['Йогурт', 50, 6000]] });
    R({ t: at(s2 + 2, '08:20'), store: 'kitchen', sup: SA, guard: g2, checker: ch, lines: [['Лук репчатый', 30, 5500], ['Помидоры', 20, 13000], ['Картофель', 40, 6500], ['Огурцы', 15, 11000], ['Яблоки', 12, 14000], ['Бананы', 10, 21000]] });
    R({ t: at(s2 + 1, '10:10'), store: 'eng', sup: ES, guard: g1, checker: en, lines: [['Кабель ВВГ 3×2,5', 50, 9000], ['Лампа GU10', 20, 16000]] });
    // неделя, по которой был пересчёт (пн–вс)
    R({ t: at(s2 - 1, '08:20'), store: 'kitchen', sup: SA, guard: g1, checker: ch, lines: veg(1) });
    R({ t: at(s2 - 1, '09:10'), store: 'kitchen', sup: MS, guard: g1, checker: ch, lines: milk });
    R({ t: at(s2 - 2, '08:40'), store: 'kitchen', sup: HM, guard: g2, checker: ch, lines: [['Говядина (мякоть)', 25, 120000], ['Курица (тушка)', 30, 38000], ['Куриное филе', 15, 55000]] });
    R({ t: at(s2 - 3, '10:15'), store: 'kitchen', sup: MK, guard: g2, checker: ch, mode: 'total', total: 2190000, lines: [['Мука высший сорт', 25, 7500], ['Рис девзира', 20, 24000], ['Сахар', 15, 13000], ['Масло подсолнечное', 20, 21000], ['Чай чёрный', 10, 30000], ['Кофе в зёрнах', 3, 210000]] });
    R({ t: at(s2 - 4, '08:30'), store: 'kitchen', sup: SA, guard: g0, checker: ch, lines: [['Помидоры', 20, 14000], ['Огурцы', 15, 12000], ['Яблоки', 15, 15000], ['Бананы', 12, 22000], ['Лимоны', 5, 25000]] });
    R({ t: at(s2 - 5, '09:00'), store: 'kitchen', sup: MS, guard: g1, checker: ch, lines: [['Молоко 3,2 %', 40, 12000], ['Яйца куриные (лоток 30 шт)', 20, 36000], ['Йогурт', 60, 6000], ['Сметана', 6, 30000]] });
    R({ t: at(s2 - 5, '11:30'), store: 'eng', sup: SO, guard: g1, checker: en, lines: [['Картридж смесителя 40 мм', 4, 65000], ['Сифон для раковины', 3, 55000], ['Герметик силиконовый', 6, 38000]] });
    R({ t: at(s2 - 6, '08:45'), store: 'kitchen', sup: MK, guard: g2, checker: ch, lines: [['Лепёшка', 200, 4000], ['Хлеб для тостов', 20, 15000], ['Сок апельсиновый', 20, 18000]] });
    R({ t: at(s2 - 6, '15:20'), store: 'main', sup: TU, guard: g2, checker: kp, lines: [['Моющее для полов', 20, 24000], ['Средство для стёкол', 10, 26000], ['Перчатки резиновые', 30, 6000], ['Губки', 50, 1500]] });
    R({ t: at(s1, '08:20'), store: 'kitchen', sup: HM, guard: g1, checker: ch, lines: [['Говядина (мякоть)', 15, 120000], ['Баранина', 10, 125000], ['Курица (тушка)', 20, 38000]] });
    // эта неделя
    R({ t: at(s1 - 1, '08:30'), store: 'kitchen', sup: SA, guard: g2, checker: ch, lines: veg(1.05) });
    R({ t: at(s1 - 1, '09:05'), store: 'kitchen', sup: MS, guard: g2, checker: ch, lines: milk.slice(0, 2).concat(milk.slice(6)) });
    // спорный приход: шеф «Не хватает» — говядина недовес
    R({ t: at(Math.max(s1 - 2, 1), '08:40'), store: 'kitchen', sup: HM, guard: g1, checker: ch, chkMin: 25, status: 'issue', note: 'Говядина: недовес 1,5 кг — перевесили при мне. Курица в порядке.', qtyOk: { 'Говядина (мякоть)': 18.5 }, lines: [['Говядина (мякоть)', 20, 122000], ['Курица (тушка)', 15, 38000]] });
  }
  // приход по поездке закупщика вчера (9301): заказали лук 20 кг — пришло 18; принят шефом
  if (CHEF && !DB.rv_receipts.some(function (r) { return r.trip_id === 9301; }) && DB.trips.some(function (t) { return t.id === 9301; })) {
    var tr = DB.trips.filter(function (t) { return t.id === 9301; })[0], tt = new Date(Date.parse(tr.returned_at || H(20)) + 20 * 6e4).toISOString(), bsup = BUY ? buyerSupplier(BUY.id).id : null;
    makeReceipt({ id: 16330, t: tt, store: 'kitchen', sup: bsup, trip: 9301, guard: id0(G2), checker: CHEF.id, chkMin: 35, mode: 'total', total: 2300000,
      lines: [['Лук репчатый', 18, 5000, 20, 797], ['Морковь', 20, 6000, 20, 797], ['Лимоны', 5, 25000, 5, 795], ['Укроп', 15, 2000, null, 795], ['Кинза', 15, 2000, null, 795]] });
    var fnbLead = byLogin('obidjon.t');
    makeReceipt({ id: 16331, t: new Date(Date.parse(tt) + 6 * 6e4).toISOString(), store: 'fnb', sup: bsup, trip: 9301, guard: id0(G2), checker: id0(fnbLead), chkMin: 90, mode: 'total', total: 1250000,
      lines: [['Салфетки бумажные', 20, 9000, 20, 796], ['Трубочки', 5, 12000, 5, 796]] });
  }
  // сегодня: два прихода ждут проверки (кухня — шеф, техслужба — гл. инженер)
  if (CHEF && !DB.rv_receipts.some(function (r) { return r.id === 16340; })) {
    var tNow = Date.now(), t1 = Math.min(tNow - 20 * 6e4, Date.parse(at(0, '08:40'))), t2 = Math.min(tNow - 10 * 6e4, Date.parse(at(0, '09:30')));
    makeReceipt({ id: 16340, t: new Date(t1).toISOString(), store: 'kitchen', sup: 16203, guard: id0(G1), status: 'pending', lines: [['Молоко 3,2 %', 40, 12000], ['Яйца куриные (лоток 30 шт)', 20, 36000], ['Сыр твёрдый', 4, 112000]] });
    makeReceipt({ id: 16341, t: new Date(t2).toISOString(), store: 'eng', sup: 16205, guard: id0(G1), status: 'pending', lines: [['Лампа E27 LED', 30, 22000], ['Автомат 16 А', 4, 45000]] });
    // общий склад от поставщика — кладовщик (он же закупщик) проверяет сам
    makeReceipt({ id: 16342, t: new Date(Math.min(tNow - 5 * 6e4, Date.parse(at(0, '09:50')))).toISOString(), store: 'main', sup: 16207, guard: id0(G1), status: 'pending', lines: [['Моющее для полов', 20, 24000], ['Средство для стёкол', 10, 26000]] });
  }
  // списания кухни (раздел «Кухня: температура и списания») — учитываются в пересчёте
  if (!DB.writeoffs.some(function (w) { return w._rv; }) && CHEF) {
    DB.writeoffs.push(
      { id: 16451, item: 'Сливки 33 %', qty: 1, unit: 'л', reason: 'Просрочено', cost: 55000, photo_path: null, dept_id: 'kitchen', status: 'approved', by_emp: id0(byLogin('sunnat.u')), at: at(s2 - 3, '21:10'), decided_by: CHEF.id, _rv: 1 },
      { id: 16452, item: 'Помидоры', qty: 2, unit: 'кг', reason: 'Испортились', cost: 28000, photo_path: null, dept_id: 'kitchen', status: 'approved', by_emp: CHEF.id, at: at(s2 - 5, '18:40'), decided_by: CHEF.id, _rv: 1 },
      { id: 16453, item: 'Йогурт', qty: 6, unit: 'шт', reason: 'Вздутая упаковка', cost: 36000, photo_path: null, dept_id: 'kitchen', status: 'new', by_emp: id0(byLogin('shuxrat.x')), at: at(Math.max(s1 - 1, 0), '07:20'), _rv: 1 }
    );
  }

  // ---------- пересчёт: расчёт (как rv_count_calc в SQL) ----------
  function bfPersons(d) {
    var bd = (DB.breakfast_days || []).filter(function (x) { return x.day === d; })[0], t = bd && bd.totals;
    if (t) return (+t.incl_persons || 0) + (+t.cash_persons || 0) + (+t.room_persons || 0);
    return (DB.breakfast_visits || []).filter(function (v) { return v.day === d; }).reduce(function (s, v) { return s + (+v.adults || 0) + (+v.children || 0); }, 0);
  }
  function avgPrice(c, toTs) {
    var from = new Date(Date.parse(toTs) - 60 * 864e5).toISOString(), q = 0, s = 0;
    DB.rv_lines.forEach(function (l) {
      if (l.catalog_id !== c.id) return; var r = DB.rv_receipts.filter(function (x) { return x.id === l.receipt_id; })[0];
      if (!r || r.created_at > toTs || r.created_at < from) return; q += +l.qty || 0; s += +l.sum || 0;
    });
    return q > 0 ? s / q : (+c.last_price || 0);
  }
  function countCalc(store, day, ts, facts, prev) {
    // facts: {catalog_id: qty}; prev: предыдущий пересчёт этого склада или null
    var deps = STORES[store], prevF = {}, items = {}, L = [];
    if (prev) DB.rv_count_lines.filter(function (l) { return l.count_id === prev.id; }).forEach(function (l) { prevF[l.catalog_id] = +l.fact || 0; });
    var fromTs = prev ? prev.created_at : null;
    var inQ = {}, inS = {};
    DB.rv_receipts.forEach(function (r) {
      if (r.store !== store || r.created_at > ts || (fromTs && r.created_at <= fromTs)) return;
      DB.rv_lines.filter(function (l) { return l.receipt_id === r.id; }).forEach(function (l) { var q = l.qty_ok != null ? +l.qty_ok : +l.qty; inQ[l.catalog_id] = (inQ[l.catalog_id] || 0) + q; inS[l.catalog_id] = (inS[l.catalog_id] || 0) + (+l.sum || 0); });
    });
    var woQ = {}, woS = 0, sdeps = deps.map(function (d) { return STOCK_DEPT[d]; }), tsN = Date.parse(ts), fromN = fromTs ? Date.parse(fromTs) : -Infinity;
    (DB.writeoffs || []).forEach(function (w) {
      var wn = Date.parse(w.at); if (w.status === 'rejected' || !(wn <= tsN && wn > fromN)) return;
      if (sdeps.indexOf(w.dept_id || 'kitchen') < 0) return;
      var c = null; deps.some(function (d) { c = catBy(d, w.item); return !!c; }); if (!c) return;
      woQ[c.id] = (woQ[c.id] || 0) + (+w.qty || 0); woS += +w.cost || 0;
    });
    Object.keys(facts).concat(Object.keys(prevF), Object.keys(inQ)).forEach(function (k) { items[k] = 1; });
    var used = 0, inSum = 0;
    Object.keys(items).forEach(function (k) {
      var c = cat(k); if (!c) return;
      var p = prevF[k] || 0, iq = inQ[k] || 0, wq = woQ[k] || 0, f = facts[k] != null ? +facts[k] : 0;
      var u = prev ? r2(p + iq - f - wq) : null, pr = avgPrice(c, ts), us = u == null ? null : Math.round(u * pr);
      if (u != null) used += us; inSum += inS[k] || 0;
      L.push({ catalog_id: c.id, name: c.name, name_uz: c.name_uz, unit: c.unit, section: c.section, prev: prev ? p : null, inq: r2(iq), wo: r2(wq), fact: f, used: u, price: Math.round(pr), used_sum: us, neg: u != null && u < -0.001 });
    });
    L.sort(function (a, b) { return (b.used_sum || 0) - (a.used_sum || 0); });
    var bf = 0; if (prev && store === 'kitchen') { for (var d = addDays(prev.day, 1); d <= day; d = addDays(d, 1)) bf += bfPersons(d); }
    return { store: store, day: day, prev_day: prev ? prev.day : null, base: !prev, used_sum: prev ? used : null, in_sum: inSum, wo_sum: woS, breakfasts: store === 'kitchen' && prev ? bf : null, per_guest: store === 'kitchen' && prev && bf > 0 ? Math.round(used / bf) : null, lines: L };
  }
  function countSave(store, facts, by, ts, forceId) {
    var day = tzDay(new Date(ts)), prev = DB.rv_counts.filter(function (c) { return c.store === store && c.created_at < ts; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; })[0] || null;
    var res = countCalc(store, day, ts, facts, prev), id = forceId || nid();
    var row = { id: id, store: store, day: day, created_by: by, created_at: ts, prev_id: prev ? prev.id : null, prev_day: res.prev_day, used_sum: res.used_sum, in_sum: res.in_sum, wo_sum: res.wo_sum, breakfasts: res.breakfasts, per_guest: res.per_guest };
    DB.rv_counts.push(row);
    res.lines.forEach(function (l) { DB.rv_count_lines.push(Object.assign({ id: nid(), count_id: id }, l)); });
    return row;
  }
  if (!DB.rv_counts.length && CHEF) {
    var F0 = { 'Лук репчатый': 8, 'Картофель': 10, 'Морковь': 5, 'Помидоры': 4, 'Огурцы': 3, 'Укроп': 4, 'Кинза': 5, 'Молоко 3,2 %': 10, 'Сливки 33 %': 2, 'Сметана': 3, 'Творог': 2, 'Сыр твёрдый': 2, 'Масло сливочное': 2, 'Йогурт': 15, 'Яйца куриные (лоток 30 шт)': 5, 'Говядина (мякоть)': 6, 'Курица (тушка)': 8, 'Куриное филе': 4, 'Мука высший сорт': 12, 'Рис девзира': 10, 'Сахар': 8, 'Масло подсолнечное': 10, 'Чай чёрный': 2, 'Кофе в зёрнах': 1.5, 'Яблоки': 3, 'Бананы': 2, 'Лимоны': 1 };
    var F1 = { 'Лук репчатый': 10, 'Картофель': 14, 'Морковь': 8, 'Помидоры': 6, 'Огурцы': 4, 'Укроп': 6, 'Кинза': 3, 'Молоко 3,2 %': 12, 'Сливки 33 %': 2, 'Сметана': 3, 'Творог': 3, 'Сыр твёрдый': 2.5, 'Масло сливочное': 2, 'Йогурт': 20, 'Яйца куриные (лоток 30 шт)': 6, 'Говядина (мякоть)': 9, 'Баранина': 4, 'Курица (тушка)': 10, 'Куриное филе': 3, 'Мука высший сорт': 15, 'Рис девзира': 12, 'Сахар': 9, 'Масло подсолнечное': 12, 'Чай чёрный': 5, 'Кофе в зёрнах': 1.2, 'Яблоки': 4, 'Бананы': 2, 'Лимоны': 1.5, 'Хлеб для тостов': 3, 'Лепёшка': 0, 'Сок апельсиновый': 4 };
    var toIds = function (F) { var o = {}; Object.keys(F).forEach(function (n) { var c = catBy('kitchen', n); if (c) o[c.id] = F[n]; }); return o; };
    var Fm = { 'Лук репчатый': 6, 'Картофель': 8, 'Морковь': 4, 'Помидоры': 3, 'Огурцы': 2, 'Укроп': 3, 'Кинза': 3, 'Молоко 3,2 %': 8, 'Сливки 33 %': 1, 'Сметана': 2, 'Творог': 2, 'Сыр твёрдый': 1.5, 'Масло сливочное': 1.5, 'Йогурт': 12, 'Яйца куриные (лоток 30 шт)': 4, 'Говядина (мякоть)': 5, 'Курица (тушка)': 6, 'Куриное филе': 3, 'Мука высший сорт': 10, 'Рис девзира': 8, 'Сахар': 6, 'Масло подсолнечное': 8, 'Чай чёрный': 3, 'Кофе в зёрнах': 1, 'Яблоки': 2, 'Бананы': 1, 'Лимоны': 1 };
    countSave('kitchen', toIds(Fm), CHEF.id, at(s3, '20:35'), 16800);
    countSave('kitchen', toIds(F0), CHEF.id, at(s2, '20:30'), 16801);
    countSave('kitchen', toIds(F1), CHEF.id, at(s1, '20:40'), 16802);
  }

  // ---------- состояние демо между пользователями ----------
  var TBL = ['rv_suppliers', 'rv_receipts', 'rv_lines', 'rv_counts', 'rv_count_lines'];
  function save() {
    try {
      var o = { day: tzDay(), seq: seq };
      TBL.forEach(function (t) { o[t] = DB[t]; });
      o.stock_items = DB.stock_items.filter(function (x) { return x._rv; });
      localStorage.setItem(LSC, JSON.stringify(DB.catalog_items));
      o.stock_moves = DB.stock_moves.filter(function (x) { return x._rv; });
      o.notifications = DB.notifications.filter(function (x) { return x._rv; });
      o.writeoffs = DB.writeoffs.filter(function (x) { return x._rv; });
      localStorage.setItem(LS, JSON.stringify(o));
    } catch (x) {}
  }
  (function load() {
    var o = null; try { o = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (x) { o = null; }
    if (!o || o.day !== tzDay()) return;
    TBL.forEach(function (t) { if (o[t]) DB[t] = o[t]; });
    function merge(t, rows, replace) { (rows || []).forEach(function (r) { var i = DB[t].findIndex(function (x) { return x.id === r.id; }); if (i >= 0) { if (replace) DB[t][i] = r; } else DB[t].push(r); }); }
    merge('stock_items', o.stock_items, true); merge('stock_moves', o.stock_moves, true); merge('notifications', o.notifications, true); merge('writeoffs', o.writeoffs, true);
    if (o.seq) seq = Math.max(seq, o.seq);
  })();

  // ---------- уведомления ----------
  function notify(to, title, body, refId) {
    if (!to) return; var m = me(); if (m && m.id === to) return;
    DB.notifications.push({ id: nid(), employee_id: to, at: new Date().toISOString(), title: title, body: body || '', ref_type: 'rcv', ref_id: refId || null, urgent: false, read_at: null, _rv: 1 });
  }

  // ---------- данные для ответа ----------
  function supView(s) { if (!s) return null; var e = s.buyer_id ? empById(s.buyer_id) : null; return { id: s.id, name: s.name, phone: s.phone, goods: s.goods, buyer_id: s.buyer_id, buyer_first: e ? e.first_name : null }; }
  function empView(id) { var e = empById(id); return e ? { id: e.id, first_name: e.first_name, last_name: e.last_name } : null; }
  function tripSpent(t) { if (!t) return 0; if (t.status === 'back') return +t.spent || 0; return DB.trip_items.filter(function (i) { return i.trip_id === t.id && i.state === 'bought'; }).reduce(function (s, i) { return s + (+i.price || 0); }, 0); }
  function tripRecv(tid) { return DB.rv_receipts.filter(function (r) { return r.trip_id === tid; }).reduce(function (s, r) { return s + (+r.total || 0); }, 0); }
  function recView(r, m) {
    var money_ = canMoney(m), tr = r.trip_id ? DB.trips.filter(function (t) { return t.id === r.trip_id; })[0] : null, showTrip = isDir(m) || isAcc(m) || (isBuyer(m) && tr && tr.buyer_id === m.id) || myStores(m).indexOf(r.store) >= 0;
    return {
      id: r.id, store: r.store, status: r.status, created_at: r.created_at, created_by: r.created_by, guard: empView(r.created_by), supplier: supView(DB.rv_suppliers.filter(function (s) { return s.id === r.supplier_id; })[0]),
      trip_id: r.trip_id, trip: tr && showTrip ? { id: tr.id, buyer_id: tr.buyer_id, buyer: empView(tr.buyer_id), status: tr.status, spent: tripSpent(tr), recv: tripRecv(tr.id), returned_at: tr.returned_at } : null,
      total: money_ ? r.total : null, total_mode: r.total_mode, photo_path: r.photo_path, photo_goods: r.photo_goods, note: r.note,
      checked_by: r.checked_by, checker: empView(r.checked_by), checked_at: r.checked_at, check_note: r.check_note,
      can_check: canCheck(r, m), trip_buyer: tripBuyer(r),
      can_comment: r.status === 'pending' && !!m && !isSec(m) && (isDir(m) || canCheck(r, m) || myStores(m).indexOf(r.store) >= 0 || tripBuyer(r) === m.id),
      comments: (r.comments || []).map(function (c) { return Object.assign({}, c, { who: empView(c.by) }); }),
      lines: DB.rv_lines.filter(function (l) { return l.receipt_id === r.id; }).map(function (l) { var c = cat(l.catalog_id) || {}; return { id: l.id, catalog_id: l.catalog_id, name: l.name, name_uz: c.name_uz || null, unit: l.unit, dept: c.dept || null, qty_ordered: l.qty_ordered, qty: l.qty, qty_ok: l.qty_ok, sum: money_ ? l.sum : null, purchase_id: l.purchase_id }; })
    };
  }
  function visible(r, m, scope) {
    if (!m) return false;
    if (scope === 'mine') return isSec(m) && (r.created_by === m.id || lead(m, 'sec'));
    if (scope === 'check') return canCheck(r, m);
    if (isDir(m) || isAcc(m)) return true;
    if (myStores(m).indexOf(r.store) >= 0 || canCheck(r, m) || r.checked_by === m.id) return true;
    if (isBuyer(m) && r.trip_id && DB.trips.some(function (t) { return t.id === r.trip_id && t.buyer_id === m.id; })) return true;
    if (isSec(m)) return r.created_by === m.id || lead(m, 'sec');
    return false;
  }

  // ---------- разбор текста заявки «Помидоры — 15 кг» (то же правило — в клиенте rvParse) ----------
  function trips(m) {
    if (!m || !(isSec(m) || isDir(m) || isBuyer(m) || isAcc(m))) return E('Нет доступа');
    var since = Date.now() - 3 * 864e5;
    var list = DB.trips.filter(function (t) { return (t.status === 'open' || t.status === 'back') && Date.parse(t.returned_at || t.created_at) >= since && (!isBuyer(m) || isDir(m) || isAcc(m) || isSec(m) || t.buyer_id === m.id); });
    list.sort(function (a, b) { return (b.returned_at || b.created_at) > (a.returned_at || a.created_at) ? 1 : -1; });
    return OK(list.map(function (t) {
      var pids = DB.trip_items.filter(function (i) { return i.trip_id === t.id && i.state !== 'missing' && i.state !== 'tomorrow'; }).map(function (i) { return i.purchase_id; });
      var purch = DB.purchase_requests.filter(function (p) { return pids.indexOf(p.id) >= 0; }).map(function (p) {
        var kl = (DB.kitchen_order_lines || []).filter(function (l) { return p.kitchen_order_id && l.order_id === p.kitchen_order_id && +l.qty > 0; }).map(function (l) { return { catalog_id: l.catalog_id || l.product_id || null, name: l.name, unit: l.unit, qty: +l.qty }; });
        return { id: p.id, dept_id: p.dept_id, store: PR_STORE[p.dept_id] || 'main', category: p.category, items: p.items, lines: kl.length ? kl : null };
      });
      var rec = DB.rv_receipts.filter(function (r) { return r.trip_id === t.id; }).map(function (r) { return { id: r.id, store: r.store, at: r.created_at }; });
      var showMoney = !isSec(m) || isDir(m);
      return { id: t.id, buyer_id: t.buyer_id, buyer: empView(t.buyer_id), status: t.status, created_at: t.created_at, returned_at: t.returned_at, spent: showMoney ? tripSpent(t) : null, recv: showMoney ? tripRecv(t.id) : null, purchases: purch, received: rec, supplier_id: buyerSupplier(t.buyer_id).id };
    }));
  }
  function suppliers(m) {
    if (!m || !(isSec(m) || isDir(m) || isBuyer(m) || isAcc(m) || myStores(m).length)) return E('Нет доступа');
    var sm = canMoney(m) && !isSec(m);
    return OK(DB.rv_suppliers.filter(function (s) { return !s.hidden; }).map(function (s) {
      var rs = DB.rv_receipts.filter(function (r) { return r.supplier_id === s.id; });
      var v = supView(s); v.n = rs.length; v.last_at = rs.map(function (r) { return r.created_at; }).sort().pop() || null; v.total = sm ? rs.reduce(function (a, r) { return a + (+r.total || 0); }, 0) : null;
      v.stores = rs.map(function (r) { return r.store; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      return v;
    }).sort(function (a, b) { return (b.last_at || '') > (a.last_at || '') ? 1 : -1; }));
  }
  function supplierAdd(a, m) {
    if (!m || !(isSec(m) || isDir(m) || isBuyer(m) || myStores(m).length)) return E('Нет доступа');
    var name = String(a.p_name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) return E('Название поставщика: от 2 до 80 символов');
    var ph = String(a.p_phone || '').trim(); if (ph && !/^[+\d][\d\s()-]{6,19}$/.test(ph)) return E('Проверьте телефон');
    var ex = DB.rv_suppliers.filter(function (s) { return s.norm_name === norm(name); })[0];
    if (ex) { if (ex.hidden) ex.hidden = false; save(); return OK({ id: ex.id, existing: true }); }
    var s = { id: nid(), name: name, phone: ph || null, goods: String(a.p_goods || '').trim().slice(0, 120) || null, buyer_id: null, norm_name: norm(name), hidden: false, created_by: m.id, created_at: new Date().toISOString() };
    DB.rv_suppliers.push(s); save(); return OK({ id: s.id, existing: false });
  }
  function spread(lines, total) {
    // общая сумма → по позициям пропорционально last_price × кол-во; если цены есть не у всех — поровну
    var w = lines.map(function (l) { var c = cat(l.catalog_id); return c && +c.last_price > 0 ? +c.last_price * l.qty : 0; });
    var all = w.every(function (x) { return x > 0; }), sw = w.reduce(function (s, x) { return s + x; }, 0), acc = 0, big = 0;
    lines.forEach(function (l, i) { l.sum = all ? Math.floor(total * w[i] / sw) : Math.floor(total / lines.length); acc += l.sum; if (l.sum > lines[big].sum) big = i; });
    lines[big].sum += total - acc;
  }
  function create(a, m) {
    if (!m || !(isSec(m) || isDir(m))) return E('Приход записывает охрана');
    var store = a.p_store; if (!STORES[store]) return E('Выберите, для кого товар');
    var tr = null, sup = null;
    if (a.p_trip != null) { tr = DB.trips.filter(function (t) { return t.id === +a.p_trip; })[0]; if (!tr || (tr.status !== 'open' && tr.status !== 'back')) return E('Поездка закупщика не найдена'); sup = buyerSupplier(tr.buyer_id); }
    else { sup = DB.rv_suppliers.filter(function (s) { return s.id === +a.p_supplier && !s.hidden; })[0]; if (!sup) return E('Выберите поставщика'); }
    var L = (a.p_lines || []).slice(0, 61); if (!L.length) return E('Отметьте, что пришло'); if (L.length > 60) return E('Не больше 60 позиций в одном приходе');
    if (!a.p_photo) return E('Нужно фото чека или накладной');
    var seen = {}, lines = [];
    for (var i = 0; i < L.length; i++) {
      var x = L[i], c = cat(x.catalog_id);
      if (!c || STORES[store].indexOf(c.dept) < 0) return E('Товар не из каталога этой службы');
      if (seen[c.id]) return E('Товар повторяется: ' + c.name); seen[c.id] = 1;
      var q = +x.qty; if (!(q > 0 && q < 100000)) return E('Проверьте количество: ' + c.name);
      var sm = x.sum == null || x.sum === '' ? null : +x.sum;
      if (a.p_total == null && !(sm > 0 && sm < 1e11)) return E('Впишите сумму: ' + c.name);
      lines.push({ catalog_id: c.id, qty: q, sum: a.p_total == null ? Math.round(sm) : 0, qty_ordered: x.qty_ordered == null || x.qty_ordered === '' ? null : +x.qty_ordered, purchase_id: x.purchase_id || null, _c: c });
    }
    var total;
    if (a.p_total != null) { total = Math.round(+a.p_total); if (!(total > 0 && total < 1e11)) return E('Проверьте общую сумму'); spread(lines, total); }
    else total = lines.reduce(function (s, l) { return s + l.sum; }, 0);
    var now = new Date().toISOString(), rec = { id: nid(), store: store, supplier_id: sup.id, trip_id: tr ? tr.id : null, total: total, total_mode: a.p_total != null ? 'total' : 'lines', photo_path: a.p_photo, photo_goods: a.p_photo_goods || null, note: String(a.p_note || '').trim().slice(0, 300) || null, status: 'pending', created_by: m.id, created_at: now, checked_by: null, checked_at: null, check_note: null };
    DB.rv_receipts.push(rec);
    lines.forEach(function (l) {
      var s = stockEnsure(l._c), row = { id: nid(), receipt_id: rec.id, catalog_id: l.catalog_id, name: l._c.name, unit: l._c.unit, qty_ordered: l.qty_ordered, qty: l.qty, qty_ok: null, sum: l.sum, purchase_id: l.purchase_id, stock_item_id: s.id };
      DB.rv_lines.push(row);
      DB.stock_moves.push({ id: nid(), item_id: s.id, kind: 'in', qty: l.qty, reason: 'Приход №' + rec.id, room_no: null, by_emp: m.id, at: now, rv_id: rec.id, _rv: 1 });
    });
    checkers(rec).forEach(function (to) { notify(to, 'Проверьте приход', STORE_NAME[store] + ' · ' + lines.length + ' поз. · ' + money(total) + ' сум', rec.id); });
    save();
    return OK({ id: rec.id, total: total, n: lines.length, lines: DB.rv_lines.filter(function (l) { return l.receipt_id === rec.id; }).map(function (l) { return { id: l.id, catalog_id: l.catalog_id, sum: l.sum }; }) });
  }
  function list(a, m) {
    if (!m) return E('Нет доступа');
    var scope = a.p_scope || 'all', days = Math.min(62, Math.max(1, +a.p_days || (scope === 'mine' ? 7 : 14)));
    if (scope === 'mine' && !isSec(m)) return OK([]);
    if (scope === 'mine' || (isSec(m) && !isDir(m))) days = Math.min(days, 7);   // охрана видит только за 7 дней (как rv_list в SQL)
    var since = new Date(Date.now() - days * 864e5).toISOString();
    return OK(DB.rv_receipts.filter(function (r) { return (scope === 'check' || r.created_at >= since) && visible(r, m, scope); })
      .sort(function (x, y) { return x.created_at < y.created_at ? 1 : -1; }).map(function (r) { return recView(r, m); }));
  }
  function check(a, m) {
    var r = DB.rv_receipts.filter(function (x) { return x.id === +a.p_id; })[0];
    if (!r || !m) return E('Приход не найден');
    if (r.status !== 'pending') return E('Приход уже проверен');
    if (!canCheck(r, m)) return E(tripBuyer(r) === m.id ? 'Свою покупку проверяет другой сотрудник — оставьте комментарий' : 'Проверяет ответственный службы');
    var ok = a.p_ok !== false, note = String(a.p_note || '').trim();
    var L = DB.rv_lines.filter(function (l) { return l.receipt_id === r.id; }), patch = {};
    (a.p_lines || []).forEach(function (x) { patch[+x.id] = x; });
    if (!ok && note.length < 3) return E('Напишите, что не так');
    if (note.length > 300) return E('Комментарий — до 300 символов');
    var sums = L.map(function (l) { var p = patch[l.id]; return p && p.sum != null && p.sum !== '' ? Math.round(+p.sum) : +l.sum; });
    if (sums.some(function (s) { return !(s >= 0 && s < 1e11); })) return E('Проверьте сумму');
    if (Object.keys(patch).some(function (k) { return patch[k].sum != null && patch[k].sum !== ''; }) && Math.abs(sums.reduce(function (s, x) { return s + x; }, 0) - r.total) > 1) return E('Сумма по позициям должна быть равна сумме прихода');
    for (var i = 0; i < L.length; i++) {
      var l = L[i], p = patch[l.id], q = p && p.qty_ok != null && p.qty_ok !== '' ? +p.qty_ok : +l.qty;
      if (!(q >= 0 && q < 100000)) return E('Проверьте количество: ' + l.name);
      l.qty_ok = ok ? +l.qty : q; l.sum = sums[i];
      DB.stock_moves.filter(function (mv) { return mv.rv_id === r.id && mv.item_id === l.stock_item_id; }).forEach(function (mv) { mv.qty = l.qty_ok; });
      var c = cat(l.catalog_id); if (c && l.qty_ok === +l.qty && l.qty > 0 && l.sum > 0) c.last_price = Math.round(l.sum / l.qty);
    }
    r.status = ok ? 'ok' : 'issue'; r.checked_by = m.id; r.checked_at = new Date().toISOString(); r.check_note = note || null;
    if (!ok) {
      var body = STORE_NAME[r.store] + ' · №' + r.id + ' · ' + note.slice(0, 80), tos = {};
      (DB.employees || []).filter(function (e) { return e.active !== false && isDir(e); }).forEach(function (e) { tos[e.id] = 1; });
      tos[r.created_by] = 1;
      var tr = r.trip_id ? DB.trips.filter(function (t) { return t.id === r.trip_id; })[0] : null; if (tr) tos[tr.buyer_id] = 1;
      Object.keys(tos).forEach(function (to) { notify(to, 'Приход: не то или не хватает', body, r.id); });
    }
    save(); return OK({ ok: true, status: r.status });
  }
  function comment(a, m) {
    var r = DB.rv_receipts.filter(function (x) { return x.id === +a.p_id; })[0];
    if (!r || !m || !visible(r, m, 'all')) return E('Приход не найден');
    if (r.status !== 'pending') return E('Приход уже проверен');
    if (isSec(m) || !(isDir(m) || canCheck(r, m) || myStores(m).indexOf(r.store) >= 0 || tripBuyer(r) === m.id)) return E('Нет доступа');
    var t = String(a.p_text || '').trim(); if (t.length < 2) return E('Напишите комментарий'); if (t.length > 300) return E('Комментарий — до 300 символов');
    r.comments = r.comments || []; if (r.comments.length >= 20) return E('Слишком много комментариев');
    r.comments.push({ at: new Date().toISOString(), by: m.id, text: t });
    checkers(r).forEach(function (to) { notify(to, 'Комментарий к приходу', STORE_NAME[r.store] + ' · №' + r.id + ' · ' + t.slice(0, 80), r.id); });
    save(); return OK({ ok: true });
  }
  function hist(a, m) {
    if (!m || !(isDir(m) || isAcc(m) || isBuyer(m) || myStores(m).length)) return E('Нет доступа');
    var c = cat(a.p_catalog); if (!c) return E('Товар не найден');
    var out = DB.rv_lines.filter(function (l) { return l.catalog_id === c.id && l.qty > 0; }).map(function (l) {
      var r = DB.rv_receipts.filter(function (x) { return x.id === l.receipt_id; })[0]; if (!r) return null;
      return { at: r.created_at, receipt_id: r.id, status: r.status, supplier: supView(DB.rv_suppliers.filter(function (s) { return s.id === r.supplier_id; })[0]), qty: l.qty_ok != null ? l.qty_ok : l.qty, unit: l.unit, sum: l.sum, price: Math.round(l.sum / l.qty) };
    }).filter(Boolean).sort(function (x, y) { return x.at < y.at ? 1 : -1; }).slice(0, 20);
    return OK({ item: { id: c.id, name: c.name, name_uz: c.name_uz, unit: c.unit, last_price: c.last_price }, rows: out });
  }
  function countForm(a, m) {
    var st = a.p_store; if (!STORES[st]) return E('Склад не найден');
    if (myStores(m).indexOf(st) < 0) return E('Пересчёт делает ответственный службы');
    var last = DB.rv_counts.filter(function (c) { return c.store === st; }).sort(function (x, y) { return x.created_at < y.created_at ? 1 : -1; })[0] || null;
    var items = DB.catalog_items.filter(function (c) { return STORES[st].indexOf(c.dept) >= 0 && !c.hidden; }).map(function (c) { return { catalog_id: c.id, name: c.name, name_uz: c.name_uz, unit: c.unit, section: c.section, dept: c.dept }; });
    return OK({ store: st, last: last ? { id: last.id, day: last.day, created_at: last.created_at } : null, items: items });
  }
  function countSaveRpc(a, m) {
    var st = a.p_store; if (!STORES[st]) return E('Склад не найден');
    if (myStores(m).indexOf(st) < 0) return E('Пересчёт делает ответственный службы');
    var F = {}, bad = null;
    (a.p_lines || []).forEach(function (x) { var c = cat(x.catalog_id), q = +x.qty; if (!c || STORES[st].indexOf(c.dept) < 0) bad = 'Товар не из каталога этой службы'; else if (!(q >= 0 && q < 100000)) bad = 'Проверьте количество: ' + c.name; else F[c.id] = q; });
    if (bad) return E(bad); if (!Object.keys(F).length) return E('Впишите остатки');
    var now = new Date().toISOString();
    if (DB.rv_counts.some(function (c) { return c.store === st && Date.parse(now) - Date.parse(c.created_at) < 3600e3; })) return E('Пересчёт уже сохранён — следующий не раньше чем через час');
    var row = countSave(st, F, m.id, now);
    // склад службы: фактический остаток (движение «Инвентаризация» на разницу, как stock_move count)
    Object.keys(F).forEach(function (cid) {
      var c = cat(cid), s = c && stockFor(c); if (!s) return;
      var cur = DB.stock_moves.reduce(function (t, mv) { if (mv.item_id !== s.id) return t; var q = +mv.qty || 0; return t + (mv.kind === 'in' || mv.kind === 'count' ? q : -q); }, 0);
      if (Math.abs(F[cid] - cur) > 0.0005) DB.stock_moves.push({ id: nid(), item_id: s.id, kind: 'count', qty: r2(F[cid] - cur), counted: F[cid], reason: 'Пересчёт ' + row.day, room_no: null, by_emp: m.id, at: now, _rv: 1 });
    });
    save();
    return OK(countView(row, m));
  }
  function countView(c, m) {
    var v = Object.assign({}, c); v.by = empView(c.created_by);
    v.lines = DB.rv_count_lines.filter(function (l) { return l.count_id === c.id; }).map(function (l) { var o = Object.assign({}, l); delete o.id; delete o.count_id; return o; });
    return v;
  }
  function counts(a, m) {
    var st = a.p_store || 'kitchen'; if (!STORES[st]) return E('Склад не найден');
    if (!(myStores(m).indexOf(st) >= 0 || isAcc(m))) return E('Нет доступа');
    var n = Math.min(26, Math.max(1, +a.p_n || 8));
    return OK(DB.rv_counts.filter(function (c) { return c.store === st; }).sort(function (x, y) { return x.created_at < y.created_at ? 1 : -1; }).slice(0, n).map(function (c) { return countView(c, m); }));
  }
  // общий каталог (контракт w15 + w16) — merge15: одна реализация RPC catalog_add/catalog_hide/catalog_edit (мок w15-kitchenorder);
  // отсюда только права w16 (как cat_can_add / rv_cat_manage в M110): охрана и ответственные складов добавляют, ответственный склада скрывает.
  window.__CAT_CAN = {
    add: function (e) { return !!e && e.active !== false && (isSec(e) || myStores(e).length > 0 || ['kitchen', 'fnb'].indexOf(e.dept_id) >= 0); },
    manage: function (e, dept) { return !!e && myStores(e).indexOf(DEPT_STORE[dept]) >= 0; }
  };

  var MINE = { rv_trips: function (a, m) { return trips(m); }, rv_suppliers: function (a, m) { return suppliers(m); }, rv_supplier_add: supplierAdd, rv_create: create, rv_list: list, rv_check: check, rv_comment: comment, rv_hist: hist,
    rv_count_form: countForm, rv_count_save: countSaveRpc, rv_counts: counts };
  var prev = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), w = Object.create(c), rpc0 = c.rpc.bind(c);
    w.rpc = function (n, a) {
      a = a || {};
      if (MINE[n]) { var m = me(); return Promise.resolve(MINE[n](a, m)).then(function (r) { return clone(r); }); }
      return rpc0(n, a);
    };
    return w;
  };
  window.__W16RV = { save: save, countCalc: countCalc };
})();
