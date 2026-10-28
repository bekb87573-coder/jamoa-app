/* w15-kitchenorder: демо «Заявка кухни на день» — тот же контракт, что sql/migration.sql (M104–M107).
   Подключается последним (после mock-w14-bfcast.js и mock-w9-trip.js).
   - Общий каталог товаров: таблица catalog_items (DB.catalog_items; читается через sb.from('catalog_items'),
     пишется RPC catalog_add / catalog_edit / catalog_hide). Хранится в localStorage `mlx-catalog-items` — общий ключ с w16-receiving.
   - Заявка кухни: kitchen_orders / kitchen_order_parts / kitchen_part_lines / kitchen_order_lines + строка purchase_requests
     (kitchen_order_id). RPC ko_freq, ko_day, ko_part_save, ko_adj_save, ko_submit, ko_dir_edit, ko_return, ko_line_mark,
     ko_last_part, ko_history, ko_order.
   - Состояние дня хранится в localStorage `mlx-w15ko` (только демо: чтобы цепочка повар → шеф → директор → закупщик
     проходила при смене пользователя). Новый день — новые демо-данные.
   Данные строятся от сегодняшнего дня (Asia/Tashkent): каталог 75 продуктов, история за 7 дней (части поваров и заявки,
   одобренные и купленные), сегодня отправили части 2 повара (Шухрат Х., Назим Н.), Суннат У. — ещё нет (у него есть вчерашняя
   часть для «Как вчера»). Задачи не создаются — только уведомления (urgent: false). */
(function () {
var KO_CAT = {"products": [{"id": 1, "section": "Овощи", "name": "Лук репчатый", "name_uz": "Piyoz", "unit": "кг", "price": 6000, "stock_item_id": null, "sort": 10}, {"id": 2, "section": "Овощи", "name": "Картофель", "name_uz": "Kartoshka", "unit": "кг", "price": 7000, "stock_item_id": null, "sort": 20}, {"id": 3, "section": "Овощи", "name": "Морковь", "name_uz": "Sabzi", "unit": "кг", "price": 6000, "stock_item_id": null, "sort": 30}, {"id": 4, "section": "Овощи", "name": "Морковь жёлтая", "name_uz": "Sariq sabzi", "unit": "кг", "price": 8000, "stock_item_id": null, "sort": 40}, {"id": 5, "section": "Овощи", "name": "Помидоры", "name_uz": "Pomidor", "unit": "кг", "price": 14000, "stock_item_id": null, "sort": 50}, {"id": 6, "section": "Овощи", "name": "Огурцы", "name_uz": "Bodring", "unit": "кг", "price": 12000, "stock_item_id": null, "sort": 60}, {"id": 7, "section": "Овощи", "name": "Перец болгарский", "name_uz": "Bulgʻor qalampiri", "unit": "кг", "price": 18000, "stock_item_id": null, "sort": 70}, {"id": 8, "section": "Овощи", "name": "Капуста", "name_uz": "Karam", "unit": "кг", "price": 5000, "stock_item_id": null, "sort": 80}, {"id": 9, "section": "Овощи", "name": "Баклажаны", "name_uz": "Baqlajon", "unit": "кг", "price": 10000, "stock_item_id": null, "sort": 90}, {"id": 10, "section": "Овощи", "name": "Чеснок", "name_uz": "Sarimsoq", "unit": "кг", "price": 30000, "stock_item_id": null, "sort": 100}, {"id": 11, "section": "Овощи", "name": "Свёкла", "name_uz": "Lavlagi", "unit": "кг", "price": 6000, "stock_item_id": null, "sort": 110}, {"id": 12, "section": "Овощи", "name": "Редька", "name_uz": "Turp", "unit": "кг", "price": 6000, "stock_item_id": null, "sort": 120}, {"id": 13, "section": "Овощи", "name": "Кабачки", "name_uz": "Qovoqcha", "unit": "кг", "price": 9000, "stock_item_id": null, "sort": 130}, {"id": 14, "section": "Овощи", "name": "Шампиньоны", "name_uz": "Qoʻziqorin (shampinyon)", "unit": "кг", "price": 35000, "stock_item_id": null, "sort": 140}, {"id": 15, "section": "Зелень", "name": "Укроп", "name_uz": "Shivit", "unit": "пучок", "price": 2000, "stock_item_id": null, "sort": 150}, {"id": 16, "section": "Зелень", "name": "Петрушка", "name_uz": "Petrushka", "unit": "пучок", "price": 2000, "stock_item_id": null, "sort": 160}, {"id": 17, "section": "Зелень", "name": "Кинза", "name_uz": "Kashnich", "unit": "пучок", "price": 2000, "stock_item_id": null, "sort": 170}, {"id": 18, "section": "Зелень", "name": "Зелёный лук", "name_uz": "Koʻk piyoz", "unit": "пучок", "price": 2000, "stock_item_id": null, "sort": 180}, {"id": 19, "section": "Зелень", "name": "Салат листовой", "name_uz": "Barg salat", "unit": "пучок", "price": 5000, "stock_item_id": null, "sort": 190}, {"id": 20, "section": "Зелень", "name": "Базилик", "name_uz": "Rayhon", "unit": "пучок", "price": 3000, "stock_item_id": null, "sort": 200}, {"id": 21, "section": "Фрукты", "name": "Яблоки", "name_uz": "Olma", "unit": "кг", "price": 15000, "stock_item_id": null, "sort": 210}, {"id": 22, "section": "Фрукты", "name": "Бананы", "name_uz": "Banan", "unit": "кг", "price": 22000, "stock_item_id": null, "sort": 220}, {"id": 23, "section": "Фрукты", "name": "Лимоны", "name_uz": "Limon", "unit": "кг", "price": 25000, "stock_item_id": null, "sort": 230}, {"id": 24, "section": "Фрукты", "name": "Апельсины", "name_uz": "Apelsin", "unit": "кг", "price": 22000, "stock_item_id": null, "sort": 240}, {"id": 25, "section": "Фрукты", "name": "Виноград", "name_uz": "Uzum", "unit": "кг", "price": 18000, "stock_item_id": null, "sort": 250}, {"id": 26, "section": "Фрукты", "name": "Гранат", "name_uz": "Anor", "unit": "кг", "price": 20000, "stock_item_id": null, "sort": 260}, {"id": 27, "section": "Фрукты", "name": "Арбуз", "name_uz": "Tarvuz", "unit": "шт", "price": 25000, "stock_item_id": null, "sort": 270}, {"id": 28, "section": "Мясо", "name": "Говядина (мякоть)", "name_uz": "Mol goʻshti (lahm)", "unit": "кг", "price": 120000, "stock_item_id": null, "sort": 280}, {"id": 29, "section": "Мясо", "name": "Баранина", "name_uz": "Qoʻy goʻshti", "unit": "кг", "price": 125000, "stock_item_id": null, "sort": 290}, {"id": 30, "section": "Мясо", "name": "Фарш говяжий", "name_uz": "Mol goʻshti qiymasi", "unit": "кг", "price": 110000, "stock_item_id": null, "sort": 300}, {"id": 31, "section": "Мясо", "name": "Курдючный жир", "name_uz": "Dumba yogʻi", "unit": "кг", "price": 60000, "stock_item_id": null, "sort": 310}, {"id": 32, "section": "Мясо", "name": "Казы", "name_uz": "Qazi", "unit": "кг", "price": 180000, "stock_item_id": null, "sort": 320}, {"id": 33, "section": "Птица", "name": "Курица (тушка)", "name_uz": "Tovuq (butun)", "unit": "кг", "price": 38000, "stock_item_id": null, "sort": 330}, {"id": 34, "section": "Птица", "name": "Куриное филе", "name_uz": "Tovuq filesi", "unit": "кг", "price": 55000, "stock_item_id": null, "sort": 340}, {"id": 35, "section": "Птица", "name": "Куриные бёдра", "name_uz": "Tovuq soni", "unit": "кг", "price": 42000, "stock_item_id": null, "sort": 350}, {"id": 36, "section": "Птица", "name": "Индейка", "name_uz": "Kurka goʻshti", "unit": "кг", "price": 75000, "stock_item_id": null, "sort": 360}, {"id": 37, "section": "Рыба", "name": "Форель", "name_uz": "Gulmohi (forel)", "unit": "кг", "price": 95000, "stock_item_id": null, "sort": 370}, {"id": 38, "section": "Рыба", "name": "Судак", "name_uz": "Sudak baliq", "unit": "кг", "price": 70000, "stock_item_id": null, "sort": 380}, {"id": 39, "section": "Рыба", "name": "Сёмга", "name_uz": "Losos baliq", "unit": "кг", "price": 230000, "stock_item_id": null, "sort": 390}, {"id": 40, "section": "Молочные", "name": "Молоко 3,2 %", "name_uz": "Sut 3,2 %", "unit": "л", "price": 12000, "stock_item_id": null, "sort": 400}, {"id": 41, "section": "Молочные", "name": "Сливки 33 %", "name_uz": "Qaymoq 33 %", "unit": "л", "price": 55000, "stock_item_id": null, "sort": 410}, {"id": 42, "section": "Молочные", "name": "Сметана", "name_uz": "Smetana", "unit": "кг", "price": 30000, "stock_item_id": null, "sort": 420}, {"id": 43, "section": "Молочные", "name": "Творог", "name_uz": "Tvorog", "unit": "кг", "price": 35000, "stock_item_id": null, "sort": 430}, {"id": 44, "section": "Молочные", "name": "Сыр твёрдый", "name_uz": "Qattiq pishloq", "unit": "кг", "price": 110000, "stock_item_id": null, "sort": 440}, {"id": 45, "section": "Молочные", "name": "Масло сливочное", "name_uz": "Sariyogʻ", "unit": "кг", "price": 95000, "stock_item_id": null, "sort": 450}, {"id": 46, "section": "Молочные", "name": "Катык", "name_uz": "Qatiq", "unit": "л", "price": 12000, "stock_item_id": null, "sort": 460}, {"id": 47, "section": "Молочные", "name": "Йогурт", "name_uz": "Yogurt", "unit": "шт", "price": 6000, "stock_item_id": null, "sort": 470}, {"id": 48, "section": "Яйца", "name": "Яйца куриные (лоток 30 шт)", "name_uz": "Tovuq tuxumi (lotok 30 dona)", "unit": "лоток", "price": 36000, "stock_item_id": null, "sort": 480}, {"id": 49, "section": "Яйца", "name": "Яйца перепелиные", "name_uz": "Bedana tuxumi", "unit": "лоток", "price": 25000, "stock_item_id": null, "sort": 490}, {"id": 50, "section": "Бакалея", "name": "Рис девзира", "name_uz": "Devzira guruch", "unit": "кг", "price": 24000, "stock_item_id": 740, "sort": 500}, {"id": 51, "section": "Бакалея", "name": "Мука высший сорт", "name_uz": "Oliy navli un", "unit": "кг", "price": 7500, "stock_item_id": 739, "sort": 510}, {"id": 52, "section": "Бакалея", "name": "Сахар", "name_uz": "Shakar", "unit": "кг", "price": 13000, "stock_item_id": null, "sort": 520}, {"id": 53, "section": "Бакалея", "name": "Соль", "name_uz": "Tuz", "unit": "пачка", "price": 3000, "stock_item_id": null, "sort": 530}, {"id": 54, "section": "Бакалея", "name": "Масло подсолнечное", "name_uz": "Kungaboqar yogʻi", "unit": "л", "price": 21000, "stock_item_id": 738, "sort": 540}, {"id": 55, "section": "Бакалея", "name": "Масло хлопковое", "name_uz": "Paxta yogʻi", "unit": "л", "price": 23000, "stock_item_id": null, "sort": 550}, {"id": 56, "section": "Бакалея", "name": "Макароны", "name_uz": "Makaron", "unit": "пачка", "price": 9000, "stock_item_id": null, "sort": 560}, {"id": 57, "section": "Бакалея", "name": "Гречка", "name_uz": "Grechka", "unit": "кг", "price": 18000, "stock_item_id": null, "sort": 570}, {"id": 58, "section": "Бакалея", "name": "Нут", "name_uz": "Noʻxat", "unit": "кг", "price": 16000, "stock_item_id": null, "sort": 580}, {"id": 59, "section": "Бакалея", "name": "Овсяные хлопья", "name_uz": "Suli yormasi", "unit": "пачка", "price": 12000, "stock_item_id": null, "sort": 590}, {"id": 60, "section": "Бакалея", "name": "Томатная паста", "name_uz": "Tomat pastasi", "unit": "банка", "price": 15000, "stock_item_id": null, "sort": 600}, {"id": 61, "section": "Бакалея", "name": "Мёд", "name_uz": "Asal", "unit": "кг", "price": 70000, "stock_item_id": null, "sort": 610}, {"id": 62, "section": "Хлеб", "name": "Лепёшка", "name_uz": "Non", "unit": "шт", "price": 4000, "stock_item_id": null, "sort": 620}, {"id": 63, "section": "Хлеб", "name": "Хлеб белый", "name_uz": "Oq non", "unit": "шт", "price": 6000, "stock_item_id": null, "sort": 630}, {"id": 64, "section": "Хлеб", "name": "Хлеб для тостов", "name_uz": "Tost noni", "unit": "пачка", "price": 15000, "stock_item_id": null, "sort": 640}, {"id": 65, "section": "Хлеб", "name": "Багет", "name_uz": "Baget", "unit": "шт", "price": 8000, "stock_item_id": null, "sort": 650}, {"id": 66, "section": "Специи", "name": "Зира", "name_uz": "Zira", "unit": "кг", "price": 90000, "stock_item_id": null, "sort": 660}, {"id": 67, "section": "Специи", "name": "Перец чёрный молотый", "name_uz": "Qora murch", "unit": "пачка", "price": 8000, "stock_item_id": null, "sort": 670}, {"id": 68, "section": "Специи", "name": "Паприка", "name_uz": "Paprika", "unit": "пачка", "price": 9000, "stock_item_id": null, "sort": 680}, {"id": 69, "section": "Специи", "name": "Лавровый лист", "name_uz": "Dafna yaprogʻi", "unit": "пачка", "price": 4000, "stock_item_id": null, "sort": 690}, {"id": 70, "section": "Специи", "name": "Кориандр", "name_uz": "Kashnich urugʻi", "unit": "пачка", "price": 6000, "stock_item_id": null, "sort": 700}, {"id": 71, "section": "Напитки", "name": "Чай чёрный", "name_uz": "Qora choy", "unit": "пачка", "price": 30000, "stock_item_id": null, "sort": 710}, {"id": 72, "section": "Напитки", "name": "Чай зелёный", "name_uz": "Koʻk choy", "unit": "пачка", "price": 25000, "stock_item_id": null, "sort": 720}, {"id": 73, "section": "Напитки", "name": "Кофе в зёрнах", "name_uz": "Donli qahva", "unit": "кг", "price": 210000, "stock_item_id": 704, "sort": 730}, {"id": 74, "section": "Напитки", "name": "Сок апельсиновый", "name_uz": "Apelsin sharbati", "unit": "л", "price": 18000, "stock_item_id": null, "sort": 740}, {"id": 75, "section": "Напитки", "name": "Вода 1,5 л", "name_uz": "Suv 1,5 l", "unit": "шт", "price": 4000, "stock_item_id": null, "sort": 750}]};
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !window.supabase.createClient) return;
  var TZ = 'Asia/Tashkent', LS = 'mlx-w15ko', LSC = 'mlx-catalog-items';
  var T = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function tday() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); }
  function add(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function nowHM() { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
  function rnd(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function at(d, hm) { return d + 'T' + hm + ':00+05:00'; }
  function iso() { return new Date().toISOString(); }
  function E(m) { return Promise.resolve({ data: null, error: { message: m } }); }
  function OK(d) { return Promise.resolve({ data: JSON.parse(JSON.stringify(d)), error: null }); }
  function norm(s) { return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase(); }
  function normE(s) { return norm(s).replace(/ё/g, 'е'); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function num(n) { return String(r2(n)).replace('.', ','); }
  var SECTIONS = ['Овощи', 'Зелень', 'Фрукты', 'Мясо', 'Птица', 'Рыба', 'Молочные', 'Яйца', 'Бакалея', 'Хлеб', 'Специи', 'Напитки'];
  var UNITS = ['кг', 'шт', 'л', 'пачка', 'лоток', 'м', 'упак', 'пучок', 'банка'];
  function emp(id) { return (DB.employees || []).filter(function (e) { return e.id === id; })[0] || null; }
  function byLogin(l, d) { var e = (DB.employees || []).filter(function (x) { return x.login === l; })[0]; return e ? e.id : d; }
  function pos(e) { return (DB.positions || []).filter(function (p) { return e && p.id === e.position_id; })[0] || {}; }
  function meEmp() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || '');
    if (a) { var x = (DB.employees || []).filter(function (e) { return e.login === a[1]; })[0]; if (x) return x; }
    try { var s = JSON.parse(localStorage.getItem('mock-session')); return (DB.employees || []).filter(function (z) { return s && z.user_id === s.user.id; })[0] || null; } catch (x) { return null; }
  }
  // роль — как ko_role_of() на сервере
  function role(e) {
    if (!e || e.active === false) return null;
    var p = pos(e), kit = e.dept_id === 'kitchen' || e.lead_dept === 'kitchen', kr = p.ko_role || null;
    if (e.role === 'director') return 'director';
    if (kr === 'chef' || p.name === 'Шеф-повар' || p.name === 'Су-шеф') return 'chef';
    if (e.role === 'manager' && kit && kr !== 'none') return 'chef';
    if (kr === 'cook') return 'cook';
    if (e.dept_id === 'kitchen' && !kr && !/^Посудомо/i.test(p.name || '')) return 'cook';
    if (p.purch_access === true || p.name === 'Закупки и логистика') return 'buyer';
    if (e.role === 'manager' && (e.dept_id === 'fnb' || e.lead_dept === 'fnb')) return 'fnb';
    return null;
  }
  // merge15: права других пакетов на общий каталог (w16-receiving: охрана, ответственные складов) — window.__CAT_CAN.add/manage
  function catExt(k, e, dept) { var x = window.__CAT_CAN; try { return !!(x && x[k] && x[k](e, dept)); } catch (z) { return false; } }
  function canAdd(e, dept) { var r = role(e); if (!e) return false; if (r === 'director' || r === 'buyer' || catExt('add', e, dept)) return true; if (dept === 'kitchen') return ['cook', 'chef', 'fnb'].indexOf(r) >= 0; return e.dept_id === dept || e.lead_dept === dept; }
  function canManage(e, dept) { var r = role(e); if (!e) return false; if (r === 'director' || catExt('manage', e, dept)) return true; if (dept === 'kitchen') return r === 'chef'; return e.role === 'manager' && (e.dept_id === dept || e.lead_dept === dept); }
  function prefs() { var hs = (DB.hotel_settings || [])[0]; if (!hs) return {}; hs.prefs = hs.prefs || {}; return hs.prefs; }
  function deadline() { var x = prefs().ko_deadline; return /^([01]\d|2[0-3]):[0-5]\d$/.test(x || '') ? x : '12:00'; }
  function needAppr() { var x = prefs().ko_approve; return !(x === false || x === 'false'); }

  // ---------- общий каталог catalog_items (контракт w15 + w16)
  var C = null; try { C = JSON.parse(localStorage.getItem(LSC) || 'null'); } catch (x) { C = null; }
  DB.catalog_items = DB.catalog_items || [];
  if (Array.isArray(C)) C.forEach(function (it) { var i = DB.catalog_items.map(function (z) { return z.id; }).indexOf(it.id); if (i >= 0) DB.catalog_items[i] = it; else DB.catalog_items.push(it); });
  window.__CAT_LS_LOADED = true; // merge15: каталог из localStorage загружен один раз (мок w16 повторно не читает)
  if (!DB.catalog_items.some(function (x) { return x.dept === 'kitchen'; })) {
    var chef0 = byLogin('akbarjon.a', 'e26');
    KO_CAT.products.forEach(function (p) {
      if (DB.catalog_items.some(function (x) { return x.dept === 'kitchen' && x.norm_name === norm(p.name); })) return;
      DB.catalog_items.push({ id: 5000 + p.id, dept: 'kitchen', section: p.section, name: p.name, name_uz: p.name_uz, unit: p.unit, norm_name: norm(p.name), hidden: false,
        last_price: p.price, created_by: chef0, created_at: add(T, -40) + 'T09:00:00+05:00', sort: p.sort, stock_item_id: p.stock_item_id });
    });
  }
  function cat(id) { return DB.catalog_items.filter(function (x) { return x.id === +id; })[0] || null; }
  function catByName(n) { return DB.catalog_items.filter(function (x) { return x.dept === 'kitchen' && x.name === n; })[0] || null; }
  function cseq() { var m = 9000; DB.catalog_items.forEach(function (x) { if (x.id > m) m = x.id; }); return m + 1; }

  // ---------- состояние заявок кухни
  var ST = null; try { ST = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (x) { ST = null; }
  var K = { orders: [], parts: [], plines: [], olines: [], seq: 96000 };
  function nid() { return ++K.seq; }
  var CHEF = byLogin('akbarjon.a', 'e26'), C1 = byLogin('shuxrat.x', 'e27'), C2 = byLogin('sunnat.u', 'e28'), C3 = byLogin('nazim.n', 'e29'), DIR = byLogin('bekzod.a', 'e0');
  DB.purchase_requests = DB.purchase_requests || []; DB.notifications = DB.notifications || [];
  function prOf(o) { return o && o.purchase_id ? DB.purchase_requests.filter(function (p) { return p.id === o.purchase_id; })[0] || null : null; }
  function orderOf(d) { return K.orders.filter(function (o) { return o.day === d; })[0] || null; }
  function partOf(d, cook) { return K.parts.filter(function (p) { return p.day === d && p.cook_id === cook; })[0] || null; }
  function linesOfPart(pid) { return K.plines.filter(function (l) { return l.part_id === pid; }); }
  function notify(to, title, body, id) {
    var me = meEmp(); if (!to || (me && to === me.id)) return;
    DB.notifications.unshift({ id: nid(), employee_id: to, at: iso(), title: title, body: body || '', ref_type: 'ko', ref_id: id, urgent: false, read_at: null });
  }
  function partSave(d, cook, lines, note, ts) {
    var p = partOf(d, cook);
    if (!p) { p = { id: nid(), day: d, cook_id: cook, note: null, sent_at: ts }; K.parts.push(p); }
    p.note = note || null; p.sent_at = ts;
    K.plines = K.plines.filter(function (l) { return l.part_id !== p.id; });
    lines.forEach(function (x) {
      var ex = K.plines.filter(function (l) { return l.part_id === p.id && l.product_id === x.product_id; })[0];
      if (ex) ex.qty = r2(ex.qty + x.qty); else K.plines.push({ id: nid(), part_id: p.id, product_id: x.product_id, qty: x.qty });
    });
    return p;
  }
  // сводная шефа — как ko_summary()
  function summary(d) {
    var o = orderOf(d), adj = (o && o.adj) || {}, agg = {}, ord = [];
    K.parts.filter(function (p) { return p.day === d; }).forEach(function (p) {
      linesOfPart(p.id).forEach(function (l) { if (!agg[l.product_id]) { agg[l.product_id] = { q: 0, by: [] }; ord.push(l.product_id); } agg[l.product_id].q = r2(agg[l.product_id].q + l.qty); agg[l.product_id].by.push({ emp: p.cook_id, qty: l.qty }); });
    });
    var out = ord.map(function (pid) {
      var k = cat(pid) || { id: pid, name: '—', unit: 'шт', section: 'Другое', sort: 9999 }, a = agg[pid], ch = typeof adj[pid] === 'number';
      a.by.sort(function (x, y) { return x.emp < y.emp ? -1 : 1; });
      return { product_id: k.id, name: k.name, name_uz: k.name_uz || null, unit: k.unit, section: k.section || 'Другое', price: k.last_price || null, qty_req: a.q, qty: ch ? adj[pid] : a.q, changed: ch, by: a.by, _s: k.sort || 1000 };
    });
    out.sort(function (x, y) { return (x._s - y._s) || (x.product_id - y.product_id); }); out.forEach(function (x) { delete x._s; });
    return out;
  }
  function itemsText(o) {
    var L = K.olines.filter(function (l) { return l.order_id === o.id && l.qty > 0; }).sort(function (a, b) { return a.sort - b.sort; }), secs = [], g = {};
    L.forEach(function (l) { if (!g[l.section]) { g[l.section] = []; secs.push(l.section); } g[l.section].push(l.name + ' — ' + num(l.qty) + ' ' + l.unit); });
    return 'Заявка кухни · ' + o.day.slice(8, 10) + '.' + o.day.slice(5, 7) + ' · ' + L.length + ' поз.' + (o.late ? ' · после срока' : '') +
      (secs.length ? '\n' + secs.map(function (s) { return s + ': ' + g[s].join(', '); }).join('\n') : '') + (o.note ? '\nШеф: ' + o.note : '');
  }
  function est(o) { var s = 0; K.olines.forEach(function (l) { if (l.order_id === o.id && l.qty > 0 && l.price) s += l.qty * l.price; }); return s ? Math.round(s) : null; }
  function freeze(o) {
    K.olines = K.olines.filter(function (l) { return l.order_id !== o.id; });
    var n = 0; summary(o.day).forEach(function (x) { if (!(x.qty > 0)) return; n++; K.olines.push({ id: nid(), order_id: o.id, product_id: x.product_id, name: x.name, unit: x.unit, section: x.section, qty_req: x.qty_req, qty_chef: x.qty, qty: x.qty, by_cook: x.by, price: x.price, buy_state: 'todo', sort: n }); });
    return n;
  }
  function olinesJson(o) {
    return K.olines.filter(function (l) { return l.order_id === o.id; }).sort(function (a, b) { return a.sort - b.sort; }).map(function (l) {
      var k = cat(l.product_id); return { id: l.id, product_id: l.product_id, name: l.name, name_uz: k ? k.name_uz : null, unit: l.unit, section: l.section, qty_req: l.qty_req, qty_chef: l.qty_chef, qty: l.qty, by: l.by_cook, price: l.price, buy_state: l.buy_state };
    });
  }
  function prJson(pr) { return pr ? { id: pr.id, status: pr.status, est_cost: pr.est_cost, cost: pr.cost || null, director_note: pr.director_note || null, trip_note: pr.trip_note || null } : null; }

  // ---------- демо-данные (новый день — заново)
  function L(arr) { return arr.map(function (x) { var k = catByName(x[0]); return k ? { product_id: k.id, qty: x[1] } : null; }).filter(Boolean); }
  function vary(arr, s) { return arr.map(function (x, i) { var q = x[1] * (0.8 + rnd(s * 31 + i) * 0.4); return [x[0], q >= 10 ? Math.round(q) : Math.round(q * 2) / 2]; }); }
  var P1 = [['Лук репчатый', 12], ['Картофель', 15], ['Морковь жёлтая', 10], ['Помидоры', 8], ['Огурцы', 6], ['Перец болгарский', 3], ['Зелёный лук', 5], ['Кинза', 6], ['Укроп', 5], ['Лимоны', 2]];
  var P2 = [['Говядина (мякоть)', 12], ['Баранина', 6], ['Курица (тушка)', 15], ['Рис девзира', 10], ['Масло подсолнечное', 5], ['Яйца куриные (лоток 30 шт)', 4], ['Молоко 3,2 %', 10], ['Лепёшка', 40], ['Зира', 0.5]];
  var P3 = [['Мука высший сорт', 10], ['Сахар', 5], ['Масло сливочное', 3], ['Сливки 33 %', 4], ['Яйца куриные (лоток 30 шт)', 3], ['Яблоки', 5], ['Творог', 2]];
  function dnum(d) { return Math.round(Date.parse(d + 'T00:00:00Z') / 864e5) % 1000; }
  // прошлый день: части трёх поваров + отправленная, одобренная и купленная заявка (если за этот день ещё ничего нет)
  function seedHist(d, k) {
    var s = dnum(d);
    partSave(d, C1, L(vary(P1, s)), null, at(d, '09:4' + (s % 10)));
    partSave(d, C2, L(vary(P2, s + 10)), k === 1 ? 'Плов на банкет' : null, at(d, '10:1' + (s % 10)));
    partSave(d, C3, L(vary(P3, s + 20)), null, at(d, '10:3' + (s % 10)));
    var late = k === 3, o = { id: nid(), day: d, status: 'sent', adj: {}, note: k === 2 ? 'Банкет 120 гостей' : null, chef_id: CHEF, sent_at: at(d, late ? '12:25' : '11:4' + (s % 10)), late: late, deadline: '12:00', need_approval: true, purchase_id: null, return_note: null, created_at: at(d, '09:00') };
    K.orders.push(o); freeze(o);
    K.olines.forEach(function (l) { if (l.order_id !== o.id) return; l.buy_state = k === 1 && /Сливки/.test(l.name) ? 'missing' : 'bought'; });
    var pr = { id: nid(), dept_id: 'kitchen', created_by: CHEF, created_at: o.sent_at, items: '', urgency: 'normal', est_cost: null, status: k === 1 ? 'bought' : 'delivered', category: 'Продукты',
      decided_by: DIR, decided_at: at(d, late ? '12:40' : '12:05'), kitchen_order_id: o.id, cost: null, supplier: 'Алайский базар', bought_at: at(d, '16:30') };
    o.purchase_id = pr.id; pr.items = itemsText(o); pr.est_cost = est(o); pr.cost = Math.round(pr.est_cost * (0.92 + rnd(s) * 0.12));
    DB.purchase_requests.push(pr);
  }
  // состояние прошлых сессий (демо) сохраняется — в том числе вчерашние части, сделанные в сценарии («Как вчера»)
  if (ST && ST.K) {
    K = ST.K;
    (ST.pr || []).forEach(function (p) { DB.purchase_requests = DB.purchase_requests.filter(function (x) { return x.id !== p.id; }); DB.purchase_requests.push(p); });
    (ST.nt || []).forEach(function (n) { if (!DB.notifications.some(function (x) { return x.id === n.id; })) DB.notifications.push(n); });
    if (ST.prefs) Object.assign(prefs(), ST.prefs);
  }
  for (var k0 = 7; k0 >= 1; k0--) { var d0 = add(T, -k0); if (!orderOf(d0) && !K.parts.some(function (p) { return p.day === d0; })) seedHist(d0, k0); }
  if (!orderOf(T) && !K.parts.some(function (p) { return p.day === T; })) {
    partSave(T, C1, L(vary(P1, 99)), null, at(T, '09:40'));
    partSave(T, C3, L(vary(P3, 98)), 'Торт на день рождения гостя — сливки обязательно', at(T, '10:05'));
  }
  var prSt = {}; DB.purchase_requests.forEach(function (p) { if (p.kitchen_order_id) prSt[p.id] = p.status; });
  function save() {
    // одобрение обычной кнопкой (update purchase_requests) → уведомления, как триггер ko_purchase_notify
    DB.purchase_requests.forEach(function (p) {
      if (!p.kitchen_order_id) return;
      if (prSt[p.id] === 'new' && p.status === 'approved') {
        var o = K.orders.filter(function (x) { return x.id === p.kitchen_order_id; })[0];
        if (o) { var dd = o.day.slice(8, 10) + '.' + o.day.slice(5, 7); notify(o.chef_id, 'Заявка кухни одобрена', dd + (p.director_note ? ' · ' + p.director_note : ''), o.id);
          DB.employees.filter(function (e) { return e.active !== false && role(e) === 'buyer'; }).forEach(function (e) { notify(e.id, 'Заявка кухни — купить сегодня', dd, o.id); }); }
      }
      prSt[p.id] = p.status;
    });
    try {
      var kp = {}; ['ko_deadline', 'ko_approve'].forEach(function (k) { if (prefs()[k] !== undefined) kp[k] = prefs()[k]; });
      localStorage.setItem(LS, JSON.stringify({ T: T, K: K, pr: DB.purchase_requests.filter(function (p) { return p.kitchen_order_id; }), nt: DB.notifications.filter(function (n) { return n.ref_type === 'ko'; }), prefs: kp }));
      localStorage.setItem(LSC, JSON.stringify(DB.catalog_items));
    } catch (x) {}
  }
  save();

  // ---------- RPC
  function needRole(me, list) { var r = role(me); return !!me && r && (!list || list.indexOf(r) >= 0); }
  var R = {};
  R.catalog_add = function (a, me) {
    var dept = String(a.p_dept || '').trim(), sec = String(a.p_section || '').trim() || null, nm = String(a.p_name || '').trim().replace(/\s+/g, ' '), uz = String(a.p_name_uz || '').trim().replace(/\s+/g, ' ') || null;
    if (!me || !dept || !canAdd(me, dept)) return E('Нет доступа');
    if (nm.length < 2 || nm.length > 60 || !/[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʻʼ']/.test(nm)) return E('Впишите название продукта');
    if (UNITS.indexOf(a.p_unit) < 0) return E('Выберите единицу');
    if (dept === 'kitchen' && SECTIONS.indexOf(sec) < 0) return E('Выберите раздел');
    if (dept !== 'kitchen' && !sec) sec = 'Другое'; // merge15: как в моке w16
    if (uz && uz.length > 60) return E('Слишком длинное название');
    var ex = DB.catalog_items.filter(function (x) { return x.dept === dept && x.norm_name === norm(nm); })[0] || DB.catalog_items.filter(function (x) { return x.dept === dept && normE(x.name) === normE(nm); })[0];
    if (ex) return OK({ id: ex.id, existing: true, name: ex.name, name_uz: ex.name_uz, unit: ex.unit, section: ex.section, hidden: ex.hidden });
    var it = { id: cseq(), dept: dept, section: sec, name: nm, name_uz: uz, unit: a.p_unit, norm_name: norm(nm), hidden: false, last_price: null, created_by: me.id, created_at: iso(), sort: 1000, stock_item_id: null };
    DB.catalog_items.push(it); return OK({ id: it.id, existing: false });
  };
  R.catalog_hide = function (a, me) { var k = cat(a.p_id); if (!k) return E('Продукт не найден'); if (!canManage(me, k.dept)) return E('Скрыть продукт может руководитель службы или директор'); k.hidden = a.p_hidden !== false; k.updated_by = me.id; k.updated_at = iso(); return OK({ ok: true }); };
  R.catalog_edit = function (a, me) {
    var k = cat(a.p_id); if (!k) return E('Продукт не найден'); if (!canManage(me, k.dept)) return E('Продукт меняет руководитель службы или директор');
    var nm = String(a.p_name || '').trim().replace(/\s+/g, ' '), sec = String(a.p_section || '').trim() || null;
    if (nm.length < 2 || nm.length > 60) return E('Впишите название продукта'); if (UNITS.indexOf(a.p_unit) < 0) return E('Выберите единицу');
    if (k.dept === 'kitchen' && SECTIONS.indexOf(sec) < 0) return E('Выберите раздел');
    if (a.p_last_price != null && !(+a.p_last_price > 0 && +a.p_last_price < 1e10)) return E('Проверьте цену');
    if (DB.catalog_items.some(function (x) { return x.dept === k.dept && x.id !== k.id && (x.norm_name === norm(nm) || normE(x.name) === normE(nm)); })) return E('Такой продукт уже есть в каталоге');
    k.name = nm; k.norm_name = norm(nm); k.name_uz = String(a.p_name_uz || '').trim() || null; k.unit = a.p_unit; k.section = sec; if (a.p_last_price != null) k.last_price = +a.p_last_price; k.updated_by = me.id; k.updated_at = iso();
    return OK({ ok: true });
  };
  R.ko_freq = function (a, me) {
    if (!needRole(me)) return E('Нет доступа');
    var f = {}, from = add(tday(), -30);
    K.parts.filter(function (p) { return p.cook_id === me.id && p.day >= from; }).forEach(function (p) { linesOfPart(p.id).forEach(function (l) { f[l.product_id] = (f[l.product_id] || 0) + 1; }); });
    return OK({ freq: f, can_edit: canManage(me, 'kitchen'), can_add: canAdd(me, 'kitchen') });
  };
  R.ko_day = function (a, me) {
    var r = role(me); if (!me || !r) return E('Нет доступа');
    var d = a && a.p_day || tday(), o = orderOf(d), pr = prOf(o), all = r === 'chef' || r === 'director' || r === 'fnb';
    var cooks = DB.employees.filter(function (e) { return e.active !== false && (role(e) === 'cook' || partOf(d, e.id)); }).map(function (e) {
      var p = partOf(d, e.id); return { id: e.id, first_name: e.first_name, last_name: e.last_name, role: role(e), sent_at: p ? p.sent_at : null, n: p ? linesOfPart(p.id).length : 0, note: p && all ? p.note : null };
    }).sort(function (x, y) { return ((x.role === 'chef') - (y.role === 'chef')) || (x.last_name < y.last_name ? -1 : 1); });
    var parts = K.parts.filter(function (p) { return p.day === d && (all || (r === 'cook' && p.cook_id === me.id)); }).map(function (p) {
      return { cook_id: p.cook_id, sent_at: p.sent_at, note: p.note, lines: linesOfPart(p.id).map(function (l) { return { product_id: l.product_id, qty: l.qty }; }) };
    });
    return OK({ day: d, today: tday(), now: nowHM(), deadline: deadline(), need_approval: needAppr(), role: r, me: me.id,
      cooks: r === 'buyer' ? [] : cooks, sent_n: cooks.filter(function (c) { return c.role === 'cook' && c.sent_at; }).length, cooks_n: cooks.filter(function (c) { return c.role === 'cook'; }).length,
      parts: r === 'buyer' ? [] : parts,
      summary: all && (!o || o.status !== 'sent') ? summary(d) : null,
      order: o ? { id: o.id, status: o.status, sent_at: o.sent_at, late: o.late, deadline: o.deadline, note: o.note, adj: r === 'cook' ? null : o.adj, return_note: o.return_note, returned_at: o.returned_at || null,
        chef_id: o.chef_id, lines: (o.status === 'sent' || o.status === 'returned') && r !== 'cook' ? olinesJson(o) : null, purchase: prJson(pr) } : null });
  };
  R.ko_part_save = function (a, me) {
    var r = role(me); if (r !== 'cook' && r !== 'chef') return E('Заявку кухни пишут повара и шеф');
    var d = tday(), o = orderOf(d); if (o && o.status === 'sent') return E('Шеф уже отправил заявку — изменения только через шефа');
    var L0 = a.p_lines; if (!Array.isArray(L0)) return E('Нет позиций'); if (L0.length > 150) return E('Слишком много позиций');
    if (!L0.length) { var p0 = partOf(d, me.id); if (p0) { K.parts = K.parts.filter(function (p) { return p !== p0; }); K.plines = K.plines.filter(function (l) { return l.part_id !== p0.id; }); } return OK({ ok: true, n: 0 }); }
    var L1 = [];
    for (var i = 0; i < L0.length; i++) {
      var q = L0[i].qty == null ? NaN : r2(+L0[i].qty), k = cat(L0[i].product_id);
      if (!(q > 0 && q < 10000)) return E('Проверьте количество');
      if (!k || k.dept !== 'kitchen' || k.hidden) return E('Продукт не найден в каталоге');
      L1.push({ product_id: k.id, qty: q });
    }
    partSave(d, me.id, L1, String(a.p_note || '').trim().slice(0, 300) || null, iso());
    return OK({ ok: true, n: L1.length });
  };
  R.ko_adj_save = function (a, me) {
    if (role(me) !== 'chef') return E('Сводную правит шеф');
    var A = a.p_adj, out = {}; if (!A || typeof A !== 'object' || Array.isArray(A)) return E('Проверьте количество');
    for (var key in A) { var v = A[key]; if (!/^\d{1,12}$/.test(key) || typeof v !== 'number' || !(v >= 0 && v < 10000)) return E('Проверьте количество'); out[key] = r2(v); }
    var d = tday(), o = orderOf(d);
    if (!o) { o = { id: nid(), day: d, status: 'draft', adj: {}, note: null, chef_id: me.id, sent_at: null, late: false, deadline: null, need_approval: null, purchase_id: null, return_note: null, created_at: iso() }; K.orders.push(o); }
    if (o.status === 'sent') return E('Заявка уже отправлена');
    o.adj = out; o.note = String(a.p_note || '').trim().slice(0, 500) || null; o.chef_id = me.id;
    return OK({ ok: true });
  };
  R.ko_submit = function (a, me) {
    if (role(me) !== 'chef') return E('Заявку кухни отправляет шеф');
    var d = tday(), o = orderOf(d);
    if (!o) { o = { id: nid(), day: d, status: 'draft', adj: {}, note: null, chef_id: me.id, purchase_id: null, created_at: iso() }; K.orders.push(o); }
    if (o.status === 'sent') return E('Заявка уже отправлена');
    var n = freeze(o); if (!n) return E('Заявка пустая — добавьте продукты');
    var dl = deadline(), appr = needAppr(), late = nowHM() > dl, nt = String(a.p_note || '').trim().slice(0, 500);
    Object.assign(o, { status: 'sent', sent_at: iso(), chef_id: me.id, late: late, deadline: dl, need_approval: appr, return_note: null }); if (nt) o.note = nt;
    var st = appr ? 'new' : 'approved', pr = prOf(o);
    if (pr && (pr.status === 'rejected' || pr.status === 'new')) Object.assign(pr, { items: itemsText(o), est_cost: est(o), status: st, director_note: null });
    else { pr = { id: nid(), dept_id: 'kitchen', created_by: me.id, created_at: iso(), items: itemsText(o), urgency: 'normal', est_cost: est(o), status: st, category: 'Продукты', kitchen_order_id: o.id }; DB.purchase_requests.push(pr); o.purchase_id = pr.id; }
    prSt[pr.id] = st;
    var dd = d.slice(8, 10) + '.' + d.slice(5, 7);
    DB.employees.filter(function (e) { return e.active !== false && (appr ? e.role === 'director' : role(e) === 'buyer'); }).forEach(function (e) {
      notify(e.id, appr ? 'Заявка кухни на одобрение' : 'Заявка кухни — купить сегодня', dd + ' · ' + n + ' поз.' + (late ? ' · после срока' : ''), o.id);
    });
    return OK({ ok: true, purchase_id: pr.id, n: n, late: late, status: st });
  };
  function openForDir(id) { var o = K.orders.filter(function (x) { return x.id === +id; })[0], pr = prOf(o); return o && o.status === 'sent' && pr && pr.status === 'new' ? o : null; }
  R.ko_dir_edit = function (a, me) {
    if (role(me) !== 'director') return E('Количества правит директор');
    var o = openForDir(a.p_order); if (!o) return E('Заявка уже рассмотрена');
    if (!Array.isArray(a.p_lines)) return E('Проверьте количество');
    for (var i = 0; i < a.p_lines.length; i++) { var q = a.p_lines[i].qty == null ? NaN : +a.p_lines[i].qty; if (!(q >= 0 && q < 10000)) return E('Проверьте количество'); }
    var bak = K.olines.map(function (l) { return l.qty; });
    a.p_lines.forEach(function (x) { K.olines.forEach(function (l) { if (l.id === +x.id && l.order_id === o.id) l.qty = r2(+x.qty); }); });
    if (!K.olines.some(function (l) { return l.order_id === o.id && l.qty > 0; })) { K.olines.forEach(function (l, i) { l.qty = bak[i]; }); return E('В заявке не осталось позиций — лучше верните шефу'); }
    var pr = prOf(o); pr.items = itemsText(o); pr.est_cost = est(o);
    return OK({ ok: true });
  };
  R.ko_return = function (a, me) {
    if (role(me) !== 'director') return E('Вернуть заявку может директор');
    var nt = String(a.p_note || '').trim().slice(0, 300); if (!nt) return E('Напишите шефу, что исправить');
    var o = openForDir(a.p_order); if (!o) return E('Заявка уже рассмотрена');
    Object.assign(o, { status: 'returned', return_note: nt, returned_at: iso(), returned_by: me.id });
    var pr = prOf(o); pr.status = 'rejected'; pr.director_note = 'Вернул шефу: ' + nt; prSt[pr.id] = 'rejected';
    notify(o.chef_id, 'Директор вернул заявку кухни', nt, o.id);
    return OK({ ok: true });
  };
  R.ko_line_mark = function (a, me) {
    var r = role(me); if (r !== 'buyer' && r !== 'director') return E('Отмечает закупщик');
    if (['todo', 'bought', 'missing'].indexOf(a.p_state) < 0) return E('Неизвестная отметка');
    var l = K.olines.filter(function (x) { return x.id === +a.p_line; })[0]; if (!l) return E('Позиция не найдена');
    var o = K.orders.filter(function (x) { return x.id === l.order_id; })[0], pr = prOf(o);
    if (!pr || ['approved', 'bought'].indexOf(pr.status) < 0) return E('Заявка ещё не одобрена');
    if (!(l.qty > 0)) return E('Позиция убрана из заявки');
    l.buy_state = a.p_state; l.buy_at = a.p_state === 'todo' ? null : iso(); l.buy_by = a.p_state === 'todo' ? null : me.id;
    return OK({ ok: true });
  };
  R.ko_last_part = function (a, me) {
    var r = role(me); if (r !== 'cook' && r !== 'chef') return E('Нет доступа');
    var P = K.parts.filter(function (p) { return p.cook_id === me.id && p.day < tday(); }).sort(function (x, y) { return x.day < y.day ? 1 : -1; })[0];
    if (!P) return OK({ day: null, lines: [] });
    return OK({ day: P.day, note: P.note, lines: linesOfPart(P.id).filter(function (l) { var k = cat(l.product_id); return k && !k.hidden; }).map(function (l) { return { product_id: l.product_id, qty: l.qty }; }) });
  };
  R.ko_history = function (a, me) {
    var r = role(me); if (['chef', 'director', 'fnb', 'buyer'].indexOf(r) < 0) return E('Нет доступа');
    var n = Math.max(1, Math.min(31, +(a && a.p_days) || 7)), from = add(tday(), -n);
    return OK(K.orders.filter(function (o) { return o.day >= from && o.day < tday() && o.status === 'sent'; }).sort(function (x, y) { return x.day < y.day ? 1 : -1; }).map(function (o) {
      var L2 = K.olines.filter(function (l) { return l.order_id === o.id && l.qty > 0; }), pr = prOf(o);
      return { id: o.id, day: o.day, status: o.status, late: o.late, sent_at: o.sent_at, n: L2.length, bought: L2.filter(function (l) { return l.buy_state === 'bought'; }).length,
        missing: L2.filter(function (l) { return l.buy_state === 'missing'; }).length, purchase_id: o.purchase_id, p_status: pr ? pr.status : null, est_cost: pr ? pr.est_cost : null, cost: pr ? pr.cost || null : null };
    }));
  };
  R.ko_order = function (a, me) {
    var r = role(me); if (['chef', 'director', 'fnb', 'buyer'].indexOf(r) < 0) return E('Нет доступа');
    var o = K.orders.filter(function (x) { return x.id === +a.p_id; })[0]; if (!o || o.status === 'draft') return E('Заявка не найдена');
    return OK({ id: o.id, day: o.day, status: o.status, late: o.late, deadline: o.deadline, sent_at: o.sent_at, note: o.note, chef_id: o.chef_id, return_note: o.return_note, purchase: prJson(prOf(o)), lines: olinesJson(o) });
  };
  // настройки директора (как триггер ko_prefs_chk)
  function prefsChk(p, me) {
    if (!p || (p.ko_deadline === undefined && p.ko_approve === undefined)) return null;
    if (!me || me.role !== 'director') return 'Настройки заявки кухни меняет только директор';
    if (p.ko_deadline != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.ko_deadline)) return 'Проверьте время';
    if (p.ko_approve != null && [true, false, 'true', 'false'].indexOf(p.ko_approve) < 0) return 'Одобрение директора: да или нет';
    return null;
  }

  var make = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = make.apply(this, arguments);
    if (c.__ko) return c; c.__ko = 1;
    var rpc = c.rpc, from = c.from;
    c.rpc = function (n, a) {
      a = a || {};
      if (R[n]) { var res = R[n](a, meEmp()); save(); return res; }
      if (n === 'prefs_save') { var m = prefsChk(a.p, meEmp()); if (m) return E(m); }
      // сохраняем состояние только после записей (поездка, закупки, настройки), чтобы не замедлять чтения
      if (!/^(trip_|adv_|receipt_|purchase_|prefs_save)/.test(n)) return rpc.call(c, n, a);
      return Promise.resolve(rpc.call(c, n, a)).then(function (r) { save(); return r; });
    };
    c.from = function (t) {
      var q = from.call(c, t), th = q.then;
      if (t !== 'purchase_requests' && t !== 'notifications') return q;
      q.then = function (ok, bad) { if (q.op === 'select') return th.call(q, ok, bad); return th.call(q, function (r) { save(); return ok ? ok(r) : r; }, bad); };
      return q;
    };
    return c;
  };
})();
})();
