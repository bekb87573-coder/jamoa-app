/* Jamoa — демо-мок волны 4 «Меню и заказы» (основа, часть 00-core, группа 0.1 DEV_WAVE4).
   Подключается после всех моков (сборка w4/build.py). Только учёт внутри Jamoa: без касс, без Payme/Click по сети, без ИИ.
   Таблицы: menu_cat, menu_item, menu_price_log, stations, halls, tables, table_assign, orders, order_items, bills, bill_pays,
            fiscal_marks, cancel_requests, deliveries, devices.
   Вызовы sb.rpc: order_open, order_add, order_send, item_state, order_move, order_merge, order_pass, bill_make, bill_split, bill_pay,
            bill_fiscal, cancel_req, cancel_decide, stop_set, delivery_state; дополнительно: item_del, item_qty, order_close, menu_save,
            menu_cat_save, menu_import, w4_demo_orders.
   Обмен между окнами: каждое изменение сохраняет таблицы в localStorage['jamoa-w4-orders'] и пишет метку времени в
   localStorage['jamoa-orders-tick']. Другие окна получают событие storage (и сверяют метку перед каждым чтением) и перечитывают таблицы.
   Подробный интерфейс — w4/log/core.md. */
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !window.supabase.createClient) return;
  var LS = 'jamoa-w4-orders', TICK = 'jamoa-orders-tick', SKEW = 'jamoa-w4-skew', TZ = 'Asia/Tashkent';
  var T = ['menu_cat', 'menu_item', 'menu_price_log', 'stations', 'halls', 'tables', 'table_assign', 'orders', 'order_items', 'bills', 'bill_pays', 'fiscal_marks', 'cancel_requests', 'deliveries', 'devices'];
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsJ(k) { try { return JSON.parse(lsGet(k) || 'null'); } catch (e) { return null; } }
  function skew() { return +lsGet(SKEW) || 0; }
  function nowMs() { return Date.now() + skew(); }
  function nowIso() { return new Date(nowMs()).toISOString(); }
  function day(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms == null ? nowMs() : ms)); }
  function hm(ms) { return new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms == null ? nowMs() : ms)); }
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  /* следующее 06:00 по Ташкенту — когда стоп и «осталось N» снимаются сами */
  function next06() { var d = day(), t = Date.parse(d + 'T06:00:00+05:00'); return new Date(nowMs() < t ? t : Date.parse(addDays(d, 1) + 'T06:00:00+05:00')).toISOString(); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function OK(d) { return { data: d == null ? null : clone(d), error: null }; }
  function E(m, extra) { return { data: null, error: Object.assign({ message: m }, extra || {}) }; }
  function byId(t, id) { return (DB[t] || []).filter(function (r) { return r.id === id || String(r.id) === String(id); })[0] || null; }
  function nid(t) { var mx = 0; (DB[t] || []).forEach(function (r) { if (typeof r.id === 'number' && r.id > mx) mx = r.id; }); return mx + 1; }

  /* ---------- тип заведения: как в app.html (prefs.venue_profile.type, без анкеты — org_type, по умолчанию учебный отель) ---------- */
  function prefs() { var hs = (DB.hotel_settings || [])[0]; return Object.assign({}, (hs && hs.prefs) || {}, lsJ('mlx-one-prefs') || {}); }
  function vtype() { var p = prefs(), vp = p.venue_profile; return vp && vp.type ? vp.type : (p.org_type || 'hotel'); }
  function sig() { var p = prefs(); return vtype() + '|' + (p.org_name || ''); }
  /* меню по типу: кафе и сеть — как ресторан, гостевой дом — свой набор */
  function menuType(t) { return ({ rest: 'rest', cafe: 'rest', chain: 'rest', coffee: 'coffee', fast: 'fast', toyxona: 'toyxona', catering: 'catering', hotel: 'hotel', hostel: 'hostel', guest: 'guest' })[t] || 'rest'; }

  /* ---------- кто вызывает (как в mock-w16) ---------- */
  function byLogin(l) { return (DB.employees || []).filter(function (e) { return e.login === l; })[0] || null; }
  var AS0 = /as=([a-z0-9._]+)/.exec(location.hash || '');
  function me() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || '') || AS0, uid = null;
    if (a) return byLogin(a[1]);
    try { var s = JSON.parse(lsGet('mock-session')); uid = s && s.user && s.user.id; } catch (x) {}
    return (DB.employees || []).filter(function (x) { return x.user_id === uid; })[0] || null;
  }
  function meId() { var m = me(); return m ? m.id : null; }

  /* ================== учебное меню ==================
     Строка: [категория, название, nazvanie_uz, цена, цех, единица, выход, доп.]
     доп.: sz — объёмы [[S, цена, '250 мл'], …], m — группы модификаторов (ключи MG), a — аллергены, c — курс, k — раздел меню (kind), d — блюдо дня */
  var MG = {
    onion: { name: 'Лук', name_uz: 'Piyoz', kind: 'many', opts: [['Без лука', 'Piyozsiz', 0]] },
    spice: { name: 'Острота', name_uz: 'Achchiqlik', kind: 'one', req: true, opts: [['Обычно', 'Odatdagidek', 0, 1], ['Острее', 'Achchiqroq', 0], ['Не остро', 'Achchiq emas', 0]] },
    done: { name: 'Прожарка', name_uz: 'Qovurilishi', kind: 'one', req: true, opts: [['С кровью', 'Qonli', 0], ['Средняя', 'Oʻrtacha', 0, 1], ['Хорошо прожарить', 'Yaxshi qovurilgan', 0]] },
    garnish: { name: 'Гарнир', name_uz: 'Garnir', kind: 'one', opts: [['Картофель фри', 'Kartoshka fri', 0, 1], ['Рис', 'Guruch', 0], ['Овощи гриль', 'Grill sabzavotlar', 5000]] },
    milk: { name: 'Молоко', name_uz: 'Sut', kind: 'one', opts: [['Обычное', 'Oddiy', 0, 1], ['Овсяное', 'Suli suti', 6000], ['Безлактозное', 'Laktozasiz', 5000]] },
    syrup: { name: 'Сироп', name_uz: 'Sirop', kind: 'many', opts: [['Карамель', 'Karamel', 4000], ['Ваниль', 'Vanil', 4000], ['Лесной орех', 'Oʻrmon yongʻogʻi', 4000]] },
    shot: { name: 'Крепость', name_uz: 'Kuchliligi', kind: 'many', opts: [['Доп. эспрессо', 'Qoʻshimcha espresso', 7000]] },
    sugar: { name: 'Сахар', name_uz: 'Shakar', kind: 'one', opts: [['С сахаром', 'Shakarli', 0, 1], ['Без сахара', 'Shakarsiz', 0]] },
    sauce: { name: 'Соус', name_uz: 'Sous', kind: 'many', opts: [['Кетчуп', 'Ketchup', 2000], ['Чесночный', 'Sarimsoqli', 2000], ['Сырный', 'Pishloqli', 3000]] },
    cheese: { name: 'Добавки', name_uz: 'Qoʻshimchalar', kind: 'many', opts: [['Двойной сыр', 'Ikki hissa pishloq', 6000], ['Халапеньо', 'Xalapenyo', 4000], ['Без лука', 'Piyozsiz', 0]] },
    plov: { name: 'К плову', name_uz: 'Oshga', kind: 'many', opts: [['Перепелиное яйцо', 'Bedana tuxumi', 5000], ['Конина (казы)', 'Qazi', 18000], ['Без нута', 'Noʻxatsiz', 0]] },
    ice: { name: 'Лёд', name_uz: 'Muz', kind: 'one', opts: [['Со льдом', 'Muzli', 0, 1], ['Без льда', 'Muzsiz', 0]] }
  };
  var ST = {
    hot: ['Горячий цех', 'Issiq sex'], cold: ['Холодный цех', 'Sovuq sex'], grill: ['Мангал', 'Mangal'], tandir: ['Тандыр', 'Tandir'],
    kazan: ['Казан', 'Qozon'], pastry: ['Кондитерский цех', 'Qandolat sexi'], bar: ['Бар', 'Bar']
  };
  var M = {
    rest: { st: ['hot', 'cold', 'grill', 'tandir', 'pastry', 'bar'],
      cats: [['sal', 'Салаты и закуски', 'Salatlar va gazaklar'], ['soup', 'Супы', 'Shoʻrvalar'], ['hot', 'Горячие блюда', 'Issiq taomlar'], ['grill', 'Шашлык и гриль', 'Shashlik va grill'], ['bake', 'Из тандыра', 'Tandirdan'], ['des', 'Десерты', 'Desertlar'], ['tea', 'Чай и кофе', 'Choy va qahva'], ['drink', 'Напитки', 'Ichimliklar']],
      items: [
        ['sal', 'Ачичук', 'Achchiq-chuchuk', 18000, 'cold', 'port', '250 г', { c: '1' }],
        ['sal', 'Салат «Ташкент»', '«Toshkent» salati', 38000, 'cold', 'port', '220 г', { a: ['eggs'], c: '1' }],
        ['sal', 'Салат «Чинор»', '«Chinor» salati', 42000, 'cold', 'port', '230 г', { a: ['nuts', 'milk'], c: '1' }],
        ['sal', 'Овощная нарезка', 'Sabzavotli assorti', 32000, 'cold', 'port', '400 г', { c: '1' }],
        ['sal', 'Казы с лепёшкой', 'Qazi non bilan', 65000, 'cold', 'port', '150 г', { a: ['gluten'], c: '1' }],
        ['sal', 'Сузьма с зеленью', 'Koʻkatli suzma', 16000, 'cold', 'port', '150 г', { a: ['milk'], c: '1' }],
        ['soup', 'Шурпа из баранины', 'Qoʻy goʻshtidan shoʻrva', 42000, 'hot', 'port', '400 мл', { m: ['onion'], c: '1' }],
        ['soup', 'Мастава', 'Mastava', 34000, 'hot', 'port', '400 мл', { a: ['milk'], c: '1' }],
        ['soup', 'Чучвара', 'Chuchvara', 36000, 'hot', 'port', '350 г', { a: ['gluten', 'milk'], c: '1' }],
        ['hot', 'Лагман', 'Lagʻmon', 42000, 'hot', 'port', '450 г', { m: ['onion', 'spice'], a: ['gluten', 'sesame'], c: '2', d: 1 }],
        ['hot', 'Плов «Чайханский»', '«Choyxona» oshi', 45000, 'hot', 'port', '400 г', { m: ['plov'], c: '2' }],
        ['hot', 'Манты (4 шт)', 'Manti (4 dona)', 38000, 'hot', 'port', '4 шт', { m: ['onion'], a: ['gluten', 'milk'], c: '2' }],
        ['hot', 'Казан-кабоб', 'Qozon kabob', 78000, 'hot', 'port', '400 г', { m: ['garnish'], c: '2' }],
        ['hot', 'Димлама', 'Dimlama', 52000, 'hot', 'port', '450 г', { c: '2' }],
        ['hot', 'Нарын', 'Norin', 48000, 'hot', 'port', '300 г', { a: ['gluten'], c: '2' }],
        ['grill', 'Шашлык из баранины', 'Qoʻy goʻshtidan shashlik', 28000, 'grill', 'pcs', '1 шампур', { m: ['done', 'onion'], c: '2' }],
        ['grill', 'Шашлык из говядины', 'Mol goʻshtidan shashlik', 26000, 'grill', 'pcs', '1 шампур', { m: ['done', 'onion'], c: '2' }],
        ['grill', 'Люля-кебаб', 'Lyulya kabob', 24000, 'grill', 'pcs', '1 шампур', { m: ['onion', 'spice'], c: '2' }],
        ['grill', 'Крылышки на мангале', 'Mangalda qanotchalar', 45000, 'grill', 'port', '6 шт', { m: ['sauce'], c: '2' }],
        ['grill', 'Стейк рибай', 'Ribay steyk', 185000, 'grill', '100g', '100 г', { m: ['done', 'garnish'], c: '2' }],
        ['bake', 'Самса с мясом', 'Goʻshtli somsa', 12000, 'tandir', 'pcs', '1 шт', { a: ['gluten'] }],
        ['bake', 'Самса с тыквой', 'Qovoqli somsa', 9000, 'tandir', 'pcs', '1 шт', { a: ['gluten'] }],
        ['bake', 'Лепёшка тандырная', 'Tandir non', 6000, 'tandir', 'pcs', '1 шт', { a: ['gluten', 'sesame'] }],
        ['bake', 'Патыр', 'Patir', 9000, 'tandir', 'pcs', '1 шт', { a: ['gluten', 'milk'] }],
        ['des', 'Чак-чак', 'Chak-chak', 22000, 'pastry', 'port', '150 г', { a: ['gluten', 'eggs'], c: '3' }],
        ['des', 'Медовик', 'Medovik', 28000, 'pastry', 'port', '130 г', { a: ['gluten', 'eggs', 'milk'], c: '3' }],
        ['des', 'Пахлава', 'Paxlava', 24000, 'pastry', 'port', '120 г', { a: ['nuts', 'gluten'], c: '3' }],
        ['des', 'Фруктовая тарелка', 'Meva assorti', 55000, 'cold', 'port', '700 г', { c: '3' }],
        ['tea', 'Зелёный чай (чайник)', 'Koʻk choy (choynak)', 8000, 'bar', 'pcs', '1 л', { m: ['sugar'], c: 'now' }],
        ['tea', 'Чёрный чай с лимоном', 'Limonli qora choy', 10000, 'bar', 'pcs', '1 л', { m: ['sugar'], c: 'now' }],
        ['tea', 'Американо', 'Amerikano', 18000, 'bar', 'pcs', '250 мл', { m: ['sugar'], c: 'now' }],
        ['tea', 'Капучино', 'Kapuchino', 24000, 'bar', 'pcs', '300 мл', { m: ['milk', 'syrup'], a: ['milk'], c: 'now' }],
        ['drink', 'Компот домашний', 'Uy kompoti', 18000, 'bar', 'pcs', '1 л', { c: 'now' }],
        ['drink', 'Лимонад тархун', 'Tarxun limonadi', 32000, 'bar', 'pcs', '1 л', { m: ['ice'], c: 'now' }],
        ['drink', 'Вода Hydrolife', 'Hydrolife suvi', 7000, 'bar', 'pcs', '0,5 л', { c: 'now' }],
        ['drink', 'Свежевыжатый сок', 'Yangi siqilgan sharbat', 35000, 'bar', 'pcs', '300 мл', { m: ['ice'], c: 'now' }]
      ] },
    coffee: { st: ['bar', 'pastry', 'cold'],
      cats: [['cof', 'Кофе', 'Qahva'], ['tea', 'Чай', 'Choy'], ['cold', 'Холодные напитки', 'Sovuq ichimliklar'], ['bake', 'Выпечка', 'Pishiriqlar'], ['des', 'Десерты', 'Desertlar'], ['bf', 'Завтраки', 'Nonushtalar']],
      items: [
        ['cof', 'Эспрессо', 'Espresso', 16000, 'bar', 'pcs', '30 мл', { m: ['sugar', 'shot'] }],
        ['cof', 'Американо', 'Amerikano', 0, 'bar', 'pcs', '', { sz: [['S', 18000, '250 мл'], ['M', 22000, '350 мл'], ['L', 26000, '450 мл']], m: ['sugar', 'shot'] }],
        ['cof', 'Капучино', 'Kapuchino', 0, 'bar', 'pcs', '', { sz: [['S', 24000, '250 мл'], ['M', 28000, '350 мл'], ['L', 32000, '450 мл']], m: ['milk', 'syrup', 'shot'], a: ['milk'], d: 1 }],
        ['cof', 'Латте', 'Latte', 0, 'bar', 'pcs', '', { sz: [['S', 25000, '300 мл'], ['M', 29000, '400 мл'], ['L', 33000, '500 мл']], m: ['milk', 'syrup', 'shot'], a: ['milk'] }],
        ['cof', 'Флэт уайт', 'Flet uayt', 30000, 'bar', 'pcs', '200 мл', { m: ['milk'], a: ['milk'] }],
        ['cof', 'Раф ванильный', 'Vanilli raf', 0, 'bar', 'pcs', '', { sz: [['M', 32000, '350 мл'], ['L', 36000, '450 мл']], m: ['milk'], a: ['milk'] }],
        ['cof', 'Мокко', 'Mokko', 0, 'bar', 'pcs', '', { sz: [['M', 32000, '350 мл'], ['L', 36000, '450 мл']], m: ['milk', 'syrup'], a: ['milk'] }],
        ['cof', 'Какао', 'Kakao', 26000, 'bar', 'pcs', '350 мл', { m: ['milk'], a: ['milk'] }],
        ['tea', 'Чай чёрный', 'Qora choy', 14000, 'bar', 'pcs', '500 мл', { m: ['sugar'] }],
        ['tea', 'Чай зелёный', 'Koʻk choy', 14000, 'bar', 'pcs', '500 мл', { m: ['sugar'] }],
        ['tea', 'Чай облепиховый', 'Chakanda choyi', 26000, 'bar', 'pcs', '500 мл', {}],
        ['tea', 'Матча латте', 'Matcha latte', 34000, 'bar', 'pcs', '350 мл', { m: ['milk'], a: ['milk'] }],
        ['cold', 'Айс латте', 'Ays latte', 0, 'bar', 'pcs', '', { sz: [['M', 30000, '400 мл'], ['L', 34000, '500 мл']], m: ['milk', 'syrup', 'ice'], a: ['milk'] }],
        ['cold', 'Бамбл', 'Bambl', 34000, 'bar', 'pcs', '400 мл', { m: ['ice'] }],
        ['cold', 'Лимонад маракуйя', 'Marakuyya limonadi', 28000, 'bar', 'pcs', '400 мл', { m: ['ice'] }],
        ['cold', 'Смузи ягодный', 'Rezavorli smuzi', 32000, 'bar', 'pcs', '350 мл', { a: ['milk'] }],
        ['cold', 'Вода без газа', 'Gazsiz suv', 6000, 'bar', 'pcs', '0,5 л', {}],
        ['bake', 'Круассан классический', 'Klassik kruassan', 18000, 'pastry', 'pcs', '1 шт', { a: ['gluten', 'milk', 'eggs'] }],
        ['bake', 'Круассан с миндалём', 'Bodomli kruassan', 26000, 'pastry', 'pcs', '1 шт', { a: ['gluten', 'milk', 'eggs', 'nuts'] }],
        ['bake', 'Синнабон', 'Sinnabon', 24000, 'pastry', 'pcs', '1 шт', { a: ['gluten', 'milk', 'eggs'] }],
        ['bake', 'Самса слоёная', 'Qatlama somsa', 14000, 'pastry', 'pcs', '1 шт', { a: ['gluten'] }],
        ['des', 'Чизкейк', 'Chizkeyk', 32000, 'pastry', 'pcs', '130 г', { a: ['gluten', 'milk', 'eggs'] }],
        ['des', 'Тирамису', 'Tiramisu', 34000, 'pastry', 'pcs', '140 г', { a: ['gluten', 'milk', 'eggs'] }],
        ['des', 'Брауни', 'Brauni', 22000, 'pastry', 'pcs', '90 г', { a: ['gluten', 'eggs', 'nuts'] }],
        ['des', 'Макарон (3 шт)', 'Makaron (3 dona)', 27000, 'pastry', 'port', '3 шт', { a: ['nuts', 'eggs'] }],
        ['bf', 'Сырники со сметаной', 'Smetanali sirniki', 36000, 'cold', 'port', '220 г', { a: ['milk', 'eggs', 'gluten'] }],
        ['bf', 'Овсяная каша с ягодами', 'Rezavorli suli boʻtqasi', 28000, 'cold', 'port', '300 г', { a: ['milk', 'gluten'] }],
        ['bf', 'Тост с авокадо и яйцом', 'Avokado va tuxumli tost', 42000, 'cold', 'port', '250 г', { a: ['gluten', 'eggs', 'sesame'] }],
        ['bf', 'Сэндвич с курицей', 'Tovuqli sendvich', 38000, 'cold', 'pcs', '1 шт', { a: ['gluten', 'eggs'] }]
      ] },
    fast: { st: ['kazan', 'tandir', 'grill', 'hot', 'cold', 'bar'],
      cats: [['plov', 'Плов', 'Osh'], ['samsa', 'Самса', 'Somsa'], ['grill', 'Шашлык', 'Shashlik'], ['fast', 'Лаваш и бургеры', 'Lavash va burgerlar'], ['side', 'Салаты и добавки', 'Salatlar va qoʻshimchalar'], ['drink', 'Напитки', 'Ichimliklar']],
      items: [
        ['plov', 'Ош (порция)', 'Osh (porsiya)', 38000, 'kazan', 'port', '350 г', { m: ['plov'], d: 1 }],
        ['plov', 'Ош (полпорции)', 'Osh (yarim porsiya)', 22000, 'kazan', 'port', '200 г', { m: ['plov'] }],
        ['plov', 'Ош на вынос (кг)', 'Olib ketish uchun osh (kg)', 98000, 'kazan', 'kg', '1 кг', { m: ['plov'] }],
        ['plov', 'Свадебный ош', 'Toʻy oshi', 42000, 'kazan', 'port', '350 г', { m: ['plov'] }],
        ['plov', 'Казы к плову', 'Oshga qazi', 18000, 'kazan', 'port', '50 г', {}],
        ['samsa', 'Самса с мясом', 'Goʻshtli somsa', 10000, 'tandir', 'pcs', '1 шт', { a: ['gluten'] }],
        ['samsa', 'Самса с курицей', 'Tovuqli somsa', 9000, 'tandir', 'pcs', '1 шт', { a: ['gluten'] }],
        ['samsa', 'Самса с тыквой', 'Qovoqli somsa', 7000, 'tandir', 'pcs', '1 шт', { a: ['gluten'] }],
        ['samsa', 'Самса с зеленью', 'Koʻkatli somsa', 7000, 'tandir', 'pcs', '1 шт', { a: ['gluten'] }],
        ['samsa', 'Лепёшка', 'Non', 5000, 'tandir', 'pcs', '1 шт', { a: ['gluten', 'sesame'] }],
        ['grill', 'Шашлык из баранины', 'Qoʻy goʻshtidan shashlik', 22000, 'grill', 'pcs', '1 шампур', { m: ['onion'] }],
        ['grill', 'Шашлык из курицы', 'Tovuq shashlik', 16000, 'grill', 'pcs', '1 шампур', { m: ['onion'] }],
        ['grill', 'Люля-кебаб', 'Lyulya kabob', 18000, 'grill', 'pcs', '1 шампур', { m: ['onion', 'spice'] }],
        ['grill', 'Жиз', 'Jiz', 48000, 'grill', 'port', '300 г', {}],
        ['fast', 'Лаваш с говядиной', 'Mol goʻshtli lavash', 32000, 'hot', 'pcs', '1 шт', { m: ['sauce', 'cheese'], a: ['gluten', 'milk'] }],
        ['fast', 'Лаваш с курицей', 'Tovuqli lavash', 28000, 'hot', 'pcs', '1 шт', { m: ['sauce', 'cheese'], a: ['gluten', 'milk'] }],
        ['fast', 'Бургер классический', 'Klassik burger', 34000, 'hot', 'pcs', '1 шт', { m: ['cheese', 'sauce'], a: ['gluten', 'milk', 'sesame'] }],
        ['fast', 'Чизбургер', 'Chizburger', 38000, 'hot', 'pcs', '1 шт', { m: ['cheese', 'sauce'], a: ['gluten', 'milk', 'sesame'] }],
        ['fast', 'Хот-дог', 'Xot-dog', 20000, 'hot', 'pcs', '1 шт', { m: ['sauce'], a: ['gluten'] }],
        ['fast', 'Картофель фри', 'Kartoshka fri', 16000, 'hot', 'port', '150 г', { m: ['sauce'] }],
        ['fast', 'Наггетсы (6 шт)', 'Naggets (6 dona)', 24000, 'hot', 'port', '6 шт', { m: ['sauce'], a: ['gluten', 'eggs'] }],
        ['side', 'Ачичук', 'Achchiq-chuchuk', 10000, 'cold', 'port', '200 г', {}],
        ['side', 'Салат из редьки', 'Turp salati', 9000, 'cold', 'port', '150 г', {}],
        ['side', 'Катык', 'Qatiq', 8000, 'cold', 'port', '200 г', { a: ['milk'] }],
        ['side', 'Соус дополнительно', 'Qoʻshimcha sous', 3000, 'cold', 'pcs', '30 г', {}],
        ['drink', 'Чай зелёный (чайник)', 'Koʻk choy (choynak)', 5000, 'bar', 'pcs', '1 л', { m: ['sugar'] }],
        ['drink', 'Чай чёрный (чайник)', 'Qora choy (choynak)', 5000, 'bar', 'pcs', '1 л', { m: ['sugar'] }],
        ['drink', 'Кока-кола', 'Koka-kola', 0, 'bar', 'pcs', '', { sz: [['0,5 л', 9000, '0,5 л'], ['1 л', 14000, '1 л'], ['1,5 л', 18000, '1,5 л']] }],
        ['drink', 'Компот', 'Kompot', 10000, 'bar', 'pcs', '0,5 л', {}],
        ['drink', 'Вода', 'Suv', 5000, 'bar', 'pcs', '0,5 л', {}],
        ['drink', 'Айран', 'Ayron', 8000, 'bar', 'pcs', '0,5 л', { a: ['milk'] }]
      ] },
    toyxona: { st: ['kazan', 'hot', 'cold', 'tandir', 'pastry', 'bar'],
      cats: [['set', 'Стол на 10 гостей', '10 mehmonlik dasturxon'], ['cold', 'Холодные закуски', 'Sovuq gazaklar'], ['hot', 'Горячее', 'Issiq taomlar'], ['plov', 'Плов', 'Osh'], ['fruit', 'Фрукты и сладости', 'Mevalar va shirinliklar'], ['drink', 'Напитки', 'Ichimliklar'], ['svc', 'Зал и услуги', 'Zal va xizmatlar']],
      items: [
        ['set', 'Банкет «Стандарт» (на гостя)', '«Standart» banketi (mehmon boshiga)', 180000, 'hot', 'port', '1 гость', { k: 'banquet', d: 1 }],
        ['set', 'Банкет «Премиум» (на гостя)', '«Premium» banketi (mehmon boshiga)', 250000, 'hot', 'port', '1 гость', { k: 'banquet' }],
        ['set', 'Утренний плов (на гостя)', 'Nahorgi osh (mehmon boshiga)', 95000, 'kazan', 'port', '1 гость', { k: 'banquet' }],
        ['set', 'Детское меню (на ребёнка)', 'Bolalar menyusi (bola boshiga)', 120000, 'hot', 'port', '1 ребёнок', { k: 'banquet' }],
        ['cold', 'Нарезка мясная (стол)', 'Goʻshtli assorti (stol)', 210000, 'cold', 'port', '1,2 кг', { k: 'banquet', c: '1' }],
        ['cold', 'Казы и карта (стол)', 'Qazi va qarta (stol)', 260000, 'cold', 'port', '1 кг', { k: 'banquet', c: '1' }],
        ['cold', 'Салат «Оливье» (стол)', '«Olivye» salati (stol)', 90000, 'cold', 'port', '1,5 кг', { k: 'banquet', a: ['eggs'], c: '1' }],
        ['cold', 'Салат «Ачичук» (стол)', '«Achchiq-chuchuk» (stol)', 45000, 'cold', 'port', '1,5 кг', { k: 'banquet', c: '1' }],
        ['cold', 'Овощи и зелень (стол)', 'Sabzavot va koʻkatlar (stol)', 70000, 'cold', 'port', '2 кг', { k: 'banquet', c: '1' }],
        ['cold', 'Сыр и маслины (стол)', 'Pishloq va zaytun (stol)', 120000, 'cold', 'port', '800 г', { k: 'banquet', a: ['milk'], c: '1' }],
        ['hot', 'Жаркое по-ташкентски (стол)', 'Toshkentcha qovurma (stol)', 240000, 'hot', 'port', '10 порций', { k: 'banquet', c: '2' }],
        ['hot', 'Шашлык ассорти (стол)', 'Assorti shashlik (stol)', 320000, 'hot', 'port', '20 шампуров', { k: 'banquet', c: '2' }],
        ['hot', 'Манты (стол)', 'Manti (stol)', 180000, 'hot', 'port', '40 шт', { k: 'banquet', a: ['gluten'], c: '2' }],
        ['hot', 'Шурпа (стол)', 'Shoʻrva (stol)', 160000, 'hot', 'port', '10 порций', { k: 'banquet', c: '2' }],
        ['plov', 'Свадебный плов (казан на 50 гостей)', 'Toʻy oshi (50 mehmonlik qozon)', 2600000, 'kazan', 'pcs', '1 казан', { k: 'banquet', m: ['plov'], c: '3' }],
        ['plov', 'Плов (стол)', 'Osh (stol)', 260000, 'kazan', 'port', '10 порций', { k: 'banquet', c: '3' }],
        ['fruit', 'Фруктовая ваза (стол)', 'Meva vazasi (stol)', 180000, 'cold', 'port', '3 кг', { k: 'banquet', c: '3' }],
        ['fruit', 'Сладости и сухофрукты (стол)', 'Shirinlik va quruq mevalar (stol)', 150000, 'pastry', 'port', '1,5 кг', { k: 'banquet', a: ['nuts'], c: '3' }],
        ['fruit', 'Свадебный торт (кг)', 'Toʻy torti (kg)', 180000, 'pastry', 'kg', '1 кг', { k: 'banquet', a: ['gluten', 'eggs', 'milk'], c: '3' }],
        ['fruit', 'Лепёшки (стол)', 'Nonlar (stol)', 30000, 'tandir', 'port', '5 шт', { k: 'banquet', a: ['gluten', 'sesame'] }],
        ['drink', 'Чай и сахар (стол)', 'Choy va qand (stol)', 25000, 'bar', 'port', '3 чайника', { k: 'banquet', c: 'now' }],
        ['drink', 'Компот (кувшин)', 'Kompot (koʻza)', 30000, 'bar', 'pcs', '2 л', { k: 'banquet', c: 'now' }],
        ['drink', 'Газированные напитки (стол)', 'Gazli ichimliklar (stol)', 60000, 'bar', 'port', '4 × 1,5 л', { k: 'banquet', c: 'now' }],
        ['drink', 'Вода (стол)', 'Suv (stol)', 30000, 'bar', 'port', '6 × 0,5 л', { k: 'banquet', c: 'now' }],
        ['svc', 'Аренда большого зала (вечер)', 'Katta zal ijarasi (kechqurun)', 6000000, 'hot', 'pcs', '1 вечер', { k: 'service' }],
        ['svc', 'Оформление зала', 'Zalni bezatish', 3500000, 'hot', 'pcs', '1 вечер', { k: 'service' }],
        ['svc', 'Сцена и звук', 'Sahna va ovoz', 1500000, 'hot', 'pcs', '1 вечер', { k: 'service' }]
      ] },
    catering: { st: ['hot', 'cold', 'kazan', 'pastry', 'bar'],
      cats: [['lunch', 'Комплексные обеды', 'Kompleks tushliklar'], ['soup', 'Первые блюда', 'Birinchi taomlar'], ['main', 'Вторые блюда', 'Ikkinchi taomlar'], ['sal', 'Салаты', 'Salatlar'], ['bq', 'Выездной банкет', 'Koʻchma banket'], ['drink', 'Напитки и выпечка', 'Ichimliklar va pishiriqlar']],
      items: [
        ['lunch', 'Обед «Офис» (суп, второе, салат, чай)', '«Ofis» tushligi (shoʻrva, ikkinchi, salat, choy)', 45000, 'hot', 'port', '1 комплект', { d: 1 }],
        ['lunch', 'Обед «Лёгкий» (второе, салат, чай)', '«Yengil» tushlik (ikkinchi, salat, choy)', 35000, 'hot', 'port', '1 комплект', {}],
        ['lunch', 'Обед для стройки (суп, второе, хлеб)', 'Qurilish uchun tushlik (shoʻrva, ikkinchi, non)', 30000, 'hot', 'port', '1 комплект', { a: ['gluten'] }],
        ['soup', 'Мастава', 'Mastava', 16000, 'hot', 'port', '350 мл', { a: ['milk'] }],
        ['soup', 'Шурпа', 'Shoʻrva', 18000, 'hot', 'port', '350 мл', {}],
        ['soup', 'Суп с фрикадельками', 'Frikadelkali shoʻrva', 15000, 'hot', 'port', '350 мл', { a: ['gluten', 'eggs'] }],
        ['soup', 'Чечевичный суп', 'Yasmiq shoʻrva', 14000, 'hot', 'port', '350 мл', {}],
        ['main', 'Плов', 'Osh', 28000, 'kazan', 'port', '300 г', { m: ['plov'] }],
        ['main', 'Котлета с пюре', 'Pyureli kotlet', 26000, 'hot', 'port', '300 г', { a: ['gluten', 'milk', 'eggs'] }],
        ['main', 'Гуляш с гречкой', 'Grechkali gulyash', 27000, 'hot', 'port', '320 г', {}],
        ['main', 'Курица с рисом', 'Guruchli tovuq', 25000, 'hot', 'port', '320 г', {}],
        ['main', 'Лагман', 'Lagʻmon', 26000, 'hot', 'port', '400 г', { a: ['gluten'] }],
        ['main', 'Голубцы', 'Golubtsi', 24000, 'hot', 'port', '300 г', {}],
        ['sal', 'Ачичук', 'Achchiq-chuchuk', 8000, 'cold', 'port', '150 г', {}],
        ['sal', 'Винегрет', 'Vinegret', 9000, 'cold', 'port', '150 г', {}],
        ['sal', 'Салат из капусты', 'Karam salati', 7000, 'cold', 'port', '150 г', {}],
        ['sal', 'Салат «Оливье»', '«Olivye» salati', 12000, 'cold', 'port', '150 г', { a: ['eggs'] }],
        ['bq', 'Фуршет (на гостя)', 'Furshet (mehmon boshiga)', 180000, 'cold', 'port', '1 гость', { k: 'banquet' }],
        ['bq', 'Банкет (на гостя)', 'Banket (mehmon boshiga)', 260000, 'hot', 'port', '1 гость', { k: 'banquet' }],
        ['bq', 'Кофе-брейк (на гостя)', 'Kofe-breyk (mehmon boshiga)', 60000, 'pastry', 'port', '1 гость', { k: 'banquet', a: ['gluten', 'milk'] }],
        ['bq', 'Выездной казан плова (на 30 гостей)', 'Koʻchma osh qozoni (30 mehmonga)', 1500000, 'kazan', 'pcs', '1 казан', { k: 'banquet' }],
        ['bq', 'Канапе ассорти (50 шт)', 'Kanape assorti (50 dona)', 450000, 'cold', 'pcs', '50 шт', { k: 'banquet', a: ['gluten', 'milk'] }],
        ['bq', 'Доставка и сервировка', 'Yetkazish va dasturxon tuzash', 300000, 'hot', 'pcs', '1 выезд', { k: 'service' }],
        ['bq', 'Официант на выезд (смена)', 'Koʻchma ofitsiant (smena)', 250000, 'hot', 'pcs', '1 смена', { k: 'service' }],
        ['drink', 'Чай (термос 3 л)', 'Choy (termos 3 l)', 25000, 'bar', 'pcs', '3 л', {}],
        ['drink', 'Компот (5 л)', 'Kompot (5 l)', 40000, 'bar', 'pcs', '5 л', {}],
        ['drink', 'Вода (0,5 л)', 'Suv (0,5 l)', 4000, 'bar', 'pcs', '0,5 л', {}],
        ['drink', 'Самса с мясом', 'Goʻshtli somsa', 9000, 'pastry', 'pcs', '1 шт', { a: ['gluten'] }],
        ['drink', 'Булочка с маком', 'Koʻknorli bulochka', 6000, 'pastry', 'pcs', '1 шт', { a: ['gluten', 'milk'] }]
      ] },
    hotel: { st: ['hot', 'cold', 'pastry', 'bar'],
      cats: [['bf', 'Завтрак', 'Nonushta'], ['sal', 'Салаты и закуски', 'Salatlar va gazaklar'], ['hot', 'Горячие блюда', 'Issiq taomlar'], ['des', 'Десерты', 'Desertlar'], ['drink', 'Напитки', 'Ichimliklar'],
        ['mb', 'Мини-бар', 'Mini-bar'], ['ld', 'Прачечная', 'Kir yuvish'], ['pr', 'Мелочи для гостей', 'Mehmonlar uchun mayda narsalar']],
      items: [
        ['bf', 'Завтрак «шведский стол» для гостя не из номера', 'Tashqi mehmon uchun «shved stoli» nonushtasi', 120000, 'hot', 'port', '1 гость', {}],
        ['bf', 'Омлет с овощами', 'Sabzavotli omlet', 38000, 'hot', 'port', '220 г', { a: ['eggs', 'milk'] }],
        ['bf', 'Сырники', 'Sirniki', 36000, 'hot', 'port', '200 г', { a: ['milk', 'eggs', 'gluten'] }],
        ['bf', 'Каша рисовая молочная', 'Sutli guruch boʻtqasi', 26000, 'hot', 'port', '300 г', { a: ['milk'] }],
        ['sal', 'Цезарь с курицей', 'Tovuqli Sezar', 62000, 'cold', 'port', '250 г', { a: ['gluten', 'eggs', 'milk', 'fish'], c: '1' }],
        ['sal', 'Греческий салат', 'Grek salati', 52000, 'cold', 'port', '250 г', { a: ['milk'], c: '1' }],
        ['sal', 'Ачичук', 'Achchiq-chuchuk', 22000, 'cold', 'port', '250 г', { c: '1' }],
        ['hot', 'Лагман', 'Lagʻmon', 52000, 'hot', 'port', '450 г', { m: ['onion', 'spice'], a: ['gluten'], c: '2', d: 1 }],
        ['hot', 'Плов', 'Osh', 55000, 'hot', 'port', '400 г', { m: ['plov'], c: '2' }],
        ['hot', 'Стейк из говядины', 'Mol goʻshti steyki', 165000, 'hot', 'port', '250 г', { m: ['done', 'garnish'], c: '2' }],
        ['hot', 'Паста карбонара', 'Karbonara pastasi', 72000, 'hot', 'port', '300 г', { a: ['gluten', 'eggs', 'milk'], c: '2' }],
        ['hot', 'Клаб-сэндвич', 'Klab-sendvich', 68000, 'hot', 'port', '350 г', { m: ['garnish'], a: ['gluten', 'eggs'], c: '2' }],
        ['des', 'Чизкейк', 'Chizkeyk', 42000, 'pastry', 'pcs', '130 г', { a: ['gluten', 'milk', 'eggs'], c: '3' }],
        ['des', 'Мороженое (3 шарика)', 'Muzqaymoq (3 shar)', 30000, 'pastry', 'port', '150 г', { a: ['milk'], c: '3' }],
        ['drink', 'Американо', 'Amerikano', 25000, 'bar', 'pcs', '250 мл', { m: ['sugar'], c: 'now' }],
        ['drink', 'Капучино', 'Kapuchino', 32000, 'bar', 'pcs', '300 мл', { m: ['milk', 'syrup'], a: ['milk'], c: 'now' }],
        ['drink', 'Чай чёрный или зелёный', 'Qora yoki koʻk choy', 18000, 'bar', 'pcs', '500 мл', { m: ['sugar'], c: 'now' }],
        ['drink', 'Свежевыжатый апельсиновый сок', 'Yangi siqilgan apelsin sharbati', 45000, 'bar', 'pcs', '300 мл', { m: ['ice'], c: 'now' }],
        ['drink', 'Лимонад домашний', 'Uy limonadi', 38000, 'bar', 'pcs', '400 мл', { m: ['ice'], c: 'now' }],
        ['mb', 'Вода Hydrolife 0,5 л', 'Hydrolife suvi 0,5 l', 12000, 'bar', 'pcs', '0,5 л', { k: 'minibar' }],
        ['mb', 'Кока-кола 0,33 л', 'Koka-kola 0,33 l', 18000, 'bar', 'pcs', '0,33 л', { k: 'minibar' }],
        ['mb', 'Сок в коробке 0,2 л', 'Quti sharbati 0,2 l', 15000, 'bar', 'pcs', '0,2 л', { k: 'minibar' }],
        ['mb', 'Шоколад', 'Shokolad', 22000, 'bar', 'pcs', '50 г', { k: 'minibar', a: ['milk', 'nuts'] }],
        ['mb', 'Орешки солёные', 'Shoʻr yongʻoqlar', 25000, 'bar', 'pcs', '50 г', { k: 'minibar', a: ['nuts'] }],
        ['mb', 'Чипсы', 'Chips', 20000, 'bar', 'pcs', '70 г', { k: 'minibar' }],
        ['mb', 'Энергетик', 'Energetik', 28000, 'bar', 'pcs', '0,25 л', { k: 'minibar' }],
        ['mb', 'Минеральная вода с газом', 'Gazli mineral suv', 14000, 'bar', 'pcs', '0,5 л', { k: 'minibar' }],
        ['ld', 'Стирка рубашки', 'Koʻylak yuvish', 35000, 'hot', 'pcs', '1 шт', { k: 'laundry' }],
        ['ld', 'Стирка брюк', 'Shim yuvish', 40000, 'hot', 'pcs', '1 шт', { k: 'laundry' }],
        ['ld', 'Глажка рубашки', 'Koʻylak dazmollash', 20000, 'hot', 'pcs', '1 шт', { k: 'laundry' }],
        ['ld', 'Химчистка костюма', 'Kostyumni kimyoviy tozalash', 120000, 'hot', 'pcs', '1 шт', { k: 'laundry' }],
        ['ld', 'Стирка и сушка (пакет до 5 кг)', 'Yuvish va quritish (5 kg gacha paket)', 90000, 'hot', 'pcs', '1 пакет', { k: 'laundry' }],
        ['pr', 'Зубная щётка и паста', 'Tish choʻtkasi va pastasi', 15000, 'bar', 'pcs', '1 набор', { k: 'price' }],
        ['pr', 'Бритвенный набор', 'Soqol olish toʻplami', 25000, 'bar', 'pcs', '1 набор', { k: 'price' }],
        ['pr', 'Зарядка для телефона (залог)', 'Telefon quvvatlagichi (garov)', 50000, 'bar', 'pcs', '1 шт', { k: 'price' }],
        ['pr', 'Трансфер в аэропорт', 'Aeroportga transfer', 150000, 'bar', 'pcs', '1 поездка', { k: 'service' }],
        ['pr', 'Поздний выезд до 18:00', 'Kechki chiqish 18:00 gacha', 300000, 'bar', 'pcs', '1 раз', { k: 'service' }]
      ] },
    hostel: { st: ['bar'],
      cats: [['stay', 'Для проживающих', 'Yashovchilar uchun'], ['shop', 'Маленький магазин', 'Kichik doʻkon'], ['svc', 'Услуги', 'Xizmatlar']],
      items: [
        ['stay', 'Полотенце в аренду', 'Sochiq ijarasi', 10000, 'bar', 'pcs', '1 шт', { k: 'price' }],
        ['stay', 'Замок для шкафчика', 'Shkafcha qulfi', 15000, 'bar', 'pcs', '1 шт', { k: 'price' }],
        ['stay', 'Тапочки одноразовые', 'Bir martalik shippak', 8000, 'bar', 'pcs', '1 пара', { k: 'price' }],
        ['stay', 'Беруши и маска для сна', 'Quloq tiqini va uyqu niqobi', 12000, 'bar', 'pcs', '1 набор', { k: 'price' }],
        ['stay', 'Зубная щётка и паста', 'Tish choʻtkasi va pastasi', 10000, 'bar', 'pcs', '1 набор', { k: 'price' }],
        ['stay', 'Адаптер для розетки', 'Rozetka adapteri', 20000, 'bar', 'pcs', '1 шт', { k: 'price' }],
        ['shop', 'Вода 0,5 л', 'Suv 0,5 l', 5000, 'bar', 'pcs', '0,5 л', { k: 'price' }],
        ['shop', 'Вода 1,5 л', 'Suv 1,5 l', 8000, 'bar', 'pcs', '1,5 л', { k: 'price' }],
        ['shop', 'Лапша быстрого приготовления', 'Tez tayyorlanadigan lapsha', 12000, 'bar', 'pcs', '1 шт', { k: 'price', a: ['gluten'] }],
        ['shop', 'Кофе 3 в 1', 'Qahva 3 in 1', 4000, 'bar', 'pcs', '1 пакетик', { k: 'price', a: ['milk'] }],
        ['shop', 'Печенье', 'Pechenye', 9000, 'bar', 'pcs', '1 пачка', { k: 'price', a: ['gluten', 'eggs'] }],
        ['shop', 'Сим-карта с интернетом', 'Internetli SIM-karta', 60000, 'bar', 'pcs', '1 шт', { k: 'price' }],
        ['svc', 'Стирка (1 загрузка)', 'Kir yuvish (1 marta)', 30000, 'bar', 'pcs', '1 загрузка', { k: 'laundry' }],
        ['svc', 'Сушка (1 загрузка)', 'Quritish (1 marta)', 20000, 'bar', 'pcs', '1 загрузка', { k: 'laundry' }],
        ['svc', 'Хранение багажа (сутки)', 'Yuk saqlash (sutka)', 15000, 'bar', 'pcs', '1 сутки', { k: 'service' }],
        ['svc', 'Завтрак', 'Nonushta', 35000, 'bar', 'port', '1 гость', { k: 'service' }],
        ['svc', 'Трансфер из аэропорта', 'Aeroportdan transfer', 120000, 'bar', 'pcs', '1 поездка', { k: 'service' }],
        ['svc', 'Поздний выезд', 'Kechki chiqish', 50000, 'bar', 'pcs', '1 раз', { k: 'service' }],
        ['svc', 'Экскурсия по городу (место)', 'Shahar boʻylab ekskursiya (joy)', 150000, 'bar', 'pcs', '1 место', { k: 'service' }],
        ['svc', 'Ранний заезд', 'Erta kirish', 50000, 'bar', 'pcs', '1 раз', { k: 'service' }]
      ] },
    guest: { st: ['hot', 'bar'],
      cats: [['food', 'Домашняя кухня', 'Uy taomlari'], ['stay', 'Для гостей', 'Mehmonlar uchun'], ['svc', 'Услуги', 'Xizmatlar']],
      items: [
        ['food', 'Завтрак домашний', 'Uy nonushtasi', 45000, 'hot', 'port', '1 гость', { d: 1 }],
        ['food', 'Плов', 'Osh', 45000, 'hot', 'port', '400 г', {}],
        ['food', 'Лагман', 'Lagʻmon', 40000, 'hot', 'port', '450 г', { a: ['gluten'] }],
        ['food', 'Шурпа', 'Shoʻrva', 38000, 'hot', 'port', '400 мл', {}],
        ['food', 'Самса', 'Somsa', 10000, 'hot', 'pcs', '1 шт', { a: ['gluten'] }],
        ['food', 'Чай с лепёшкой и сладостями', 'Non va shirinlik bilan choy', 20000, 'bar', 'pcs', '1 чайник', { a: ['gluten', 'nuts'] }],
        ['stay', 'Вода 1,5 л', 'Suv 1,5 l', 8000, 'bar', 'pcs', '1,5 л', { k: 'price' }],
        ['stay', 'Зубная щётка и паста', 'Tish choʻtkasi va pastasi', 10000, 'bar', 'pcs', '1 набор', { k: 'price' }],
        ['stay', 'Тапочки', 'Shippak', 10000, 'bar', 'pcs', '1 пара', { k: 'price' }],
        ['stay', 'Адаптер для розетки', 'Rozetka adapteri', 20000, 'bar', 'pcs', '1 шт', { k: 'price' }],
        ['svc', 'Стирка (1 загрузка)', 'Kir yuvish (1 marta)', 35000, 'bar', 'pcs', '1 загрузка', { k: 'laundry' }],
        ['svc', 'Трансфер из аэропорта', 'Aeroportdan transfer', 120000, 'bar', 'pcs', '1 поездка', { k: 'service' }],
        ['svc', 'Хранение багажа (сутки)', 'Yuk saqlash (sutka)', 15000, 'bar', 'pcs', '1 сутки', { k: 'service' }],
        ['svc', 'Поздний выезд', 'Kechki chiqish', 60000, 'bar', 'pcs', '1 раз', { k: 'service' }]
      ] }
  };
  /* залы и столы: [зал, имя, вид, мест, [номера столов], мест за столом, форма] */
  var HALLS = {
    rest: [['Основной зал', 'Asosiy zal', 'hall', 64, 16, 4, 'sq'], ['Терраса', 'Terrasa', 'terrace', 24, 6, 4, 'round'], ['VIP-кабинет', 'VIP-xona', 'vip', 16, 2, 8, 'rect']],
    coffee: [['Зал', 'Zal', 'hall', 28, 8, 2, 'round'], ['Терраса', 'Terrasa', 'terrace', 16, 4, 4, 'round'], ['Стойка у окна', 'Deraza yonidagi stol', 'hall', 6, 3, 2, 'rect']],
    hotel: [['Ресторан', 'Restoran', 'hall', 40, 10, 4, 'sq'], ['Лобби-бар', 'Lobbi-bar', 'hall', 12, 4, 3, 'round']],
    toyxona: [['Большой зал', 'Katta zal', 'banquet', 300, 30, 10, 'round'], ['Малый зал', 'Kichik zal', 'banquet', 120, 12, 10, 'round']]
  };
  var IKPU = { menu: '10822001001000000', banquet: '10822001002000000', minibar: '10822002001000000', laundry: '09601001001000000', price: '04700001001000000', service: '09609001001000000' };

  function seed() {
    var vt = vtype(), mt = menuType(vt), S0 = M[mt], out = {}; T.forEach(function (k) { out[k] = []; });
    out.stations = S0.st.map(function (k, i) { return { id: i + 1, code: k, name: ST[k][0], name_uz: ST[k][1], kind: k, sort: i + 1 }; });
    var stId = {}; out.stations.forEach(function (s) { stId[s.kind] = s.id; });
    var catId = {}, cid = 0;
    /* категория — один раздел меню (kind): берётся по первой позиции категории */
    S0.cats.forEach(function (c, i) { var first = S0.items.filter(function (x) { return x[0] === c[0]; })[0], k = (first && first[7].k) || 'menu';
      catId[c[0]] = ++cid; out.menu_cat.push({ id: cid, code: c[0], name: c[1], name_uz: c[2], sort: i + 1, hidden: false, sell_from: c[0] === 'bf' ? '07:00' : null, sell_to: c[0] === 'bf' ? '11:30' : null, kind: k }); });
    var n = 0, plu = {};
    S0.items.forEach(function (r) {
      var o = r[7] || {}, k = o.k || 'menu', ci = catId[r[0]], pc = (plu[ci] = (plu[ci] || 0) + 1);
      n++;
      out.menu_item.push({
        id: n, cat_id: ci, name: r[1], name_uz: r[2], price: r[3] || (o.sz ? o.sz[0][1] : 0), photo: null, unit: r[5] || 'port', yield_txt: r[6] || '',
        station: r[4], station_id: stId[r[4]] || null,
        sizes: (o.sz || []).map(function (s) { return { n: s[0], price: s[1], vol: s[2] || '' }; }),
        mod_groups: (o.m || []).map(function (g, gi) { var G = MG[g]; return { id: g, name: G.name, name_uz: G.name_uz, kind: G.kind, req: !!G.req, opts: G.opts.map(function (p, pi) { return { id: g + '-' + (pi + 1), name: p[0], name_uz: p[1], add: p[2] || 0, def: !!p[3] }; }) }; }),
        allergens: o.a || [], course_def: o.c || (k === 'menu' ? '2' : 'now'),
        ikpu: IKPU[k] || IKPU.menu, pos_code: String(ci * 100 + pc),
        stop: false, left_n: null, stop_until: null, stop_at: null, stop_by: null,
        is_combo: false, combo_items: [], recipe: [], kind: k, archived: false, dish_day: !!o.d, sell_from: null, sell_to: null,
        sort: pc, created_at: nowIso()
      });
    });
    var H = HALLS[mt === 'rest' ? 'rest' : mt] || (vt === 'cafe' || vt === 'chain' ? HALLS.rest : null), tid = 0;
    (H || []).forEach(function (hh, hi) {
      out.halls.push({ id: hi + 1, name: hh[0], name_uz: hh[1], kind: hh[2], seats: hh[3], sort: hi + 1 });
      var cols = hh[4] > 12 ? 6 : 4;
      for (var i = 0; i < hh[4]; i++) {
        var no = hh[2] === 'vip' ? 'VIP-' + (i + 1) : String(hi === 0 ? i + 1 : (hi * 20) + i + 1);
        out.tables.push({ id: ++tid, hall_id: hi + 1, no: no, seats: hh[5], x: Math.round(8 + (i % cols) * (84 / Math.max(1, cols - 1))), y: Math.round(10 + Math.floor(i / cols) * 22), shape: hh[6] });
      }
    });
    return out;
  }

  /* ---------- хранение и обмен между окнами ---------- */
  var seen = null; /* метка, которую это окно уже прочитало */
  function load(o) { T.forEach(function (k) { var src = (o && Array.isArray(o.t[k])) ? o.t[k] : []; if (!Array.isArray(DB[k])) DB[k] = []; DB[k].length = 0; Array.prototype.push.apply(DB[k], src); }); }
  function save() {
    var t = {}; T.forEach(function (k) { t[k] = DB[k] || []; });
    /* старше 7 дней — не храним */
    var lim = addDays(day(), -7); t.orders = t.orders.filter(function (o) { return !o.day || o.day >= lim; });
    var ok = lsSet(LS, JSON.stringify({ sig: sig(), t: t }));
    if (!ok) { var ph = 0; t.menu_item = t.menu_item.map(function (x) { if (x.photo && ph++ > 4) { x = Object.assign({}, x, { photo: null }); } return x; }); lsSet(LS, JSON.stringify({ sig: sig(), t: t })); console.warn('w4: мало места в браузере — часть фото меню не сохранена'); }
    seen = nowMs() + '.' + Math.random().toString(36).slice(2, 7); lsSet(TICK, seen);
    fire(false);
  }
  function sync() { var tk = lsGet(TICK); if (tk && tk !== seen) { var o = lsJ(LS); if (o && o.sig === sig() && o.t) load(o); seen = tk; return true; } return false; }
  (function init() {
    T.forEach(function (k) { if (!Array.isArray(DB[k])) DB[k] = []; });
    var o = lsJ(LS);
    if (o && o.sig === sig() && o.t && Array.isArray(o.t.menu_item)) { load(o); seen = lsGet(TICK); }
    else { var s = seed(); T.forEach(function (k) { DB[k].length = 0; Array.prototype.push.apply(DB[k], s[k]); }); var t = {}; T.forEach(function (k) { t[k] = DB[k]; }); lsSet(LS, JSON.stringify({ sig: sig(), t: t })); seen = lsGet(TICK); }
  })();
  /* слушатели: экраны подписываются через window.__W4O.on(fn) (в app — w4OnTick) */
  var subs = [], fq = 0;
  function fire(remote) { clearTimeout(fq); fq = setTimeout(function () { subs.slice().forEach(function (s) { try { s.fn({ remote: remote }); } catch (e) { console.warn(e); } }); }, remote ? 0 : 30); }
  window.addEventListener('storage', function (ev) { if (ev.key === TICK && ev.newValue && ev.newValue !== seen) { if (sync()) fire(true); } else if (ev.key === LS && !ev.newValue) { /* сброс демо */ } });
  /* запасной путь: опрос раз в 2 с (если событие storage не пришло) */
  setInterval(function () { if (sync()) fire(true); }, 2000);

  /* стоп и «осталось N» снимаются сами в 06:00 (если не «до отмены») */
  function sweep() {
    var t = nowMs(), ch = false;
    (DB.menu_item || []).forEach(function (x) { if (x.stop_until && x.stop_until !== 'manual' && t >= Date.parse(x.stop_until)) { x.stop = false; x.left_n = null; x.stop_until = null; x.stop_at = null; x.stop_by = null; ch = true; } });
    return ch;
  }

  /* ---------- расчёты ---------- */
  function itemPrice(it, size, mods) {
    var p = +it.price || 0, sz = null;
    if (size && (it.sizes || []).length) { sz = it.sizes.filter(function (s) { return s.n === size; })[0]; if (sz) p = +sz.price || 0; }
    (mods || []).forEach(function (m) { p += +m.add || 0; });
    return p;
  }
  function liveItems(oid) { return (DB.order_items || []).filter(function (x) { return x.order_id === oid && x.state !== 'cancelled'; }); }
  function orderSum(oid) { return liveItems(oid).reduce(function (a, x) { return a + (+x.price || 0) * (+x.qty || 0); }, 0); }
  function billRecalc(b) {
    var items = b.item_ids && b.item_ids.length ? liveItems(b.order_id).filter(function (x) { return b.item_ids.indexOf(x.id) >= 0; }) : null;
    var tot = orderSum(b.order_id), sub;
    if (items) sub = items.reduce(function (a, x) { return a + x.price * x.qty; }, 0);
    else if (b.rest) sub = tot - (DB.bills || []).filter(function (x) { return x.order_id === b.order_id && x.status !== 'void' && x.id !== b.id && x.share != null && !x.rest; }).reduce(function (a, x) { return a + Math.round(tot * x.share); }, 0); /* последняя часть — остаток, сумма частей сходится до сума */
    else sub = b.share != null ? Math.round(tot * b.share) : tot;
    b.subtotal = sub; b.service = Math.round(sub * (+b.service_pct || 0) / 100); b.discount = Math.min(sub + b.service, Math.round(+b.discount || 0));
    var raw = sub + b.service - b.discount, rs = +b.round_to || 0; b.round = rs ? (Math.round(raw / rs) * rs - raw) : (+b.round || 0); b.total = raw + b.round;
    b.paid = (DB.bill_pays || []).filter(function (p) { return p.bill_id === b.id; }).reduce(function (a, p) { return a + Math.round((+p.amount || 0) * (+p.rate || 1)); }, 0);
    return b;
  }
  function orderBills(oid) { return (DB.bills || []).filter(function (b) { return b.order_id === oid && b.status !== 'void'; }); }
  function orderView(o) {
    var v = Object.assign({}, o); v.items = (DB.order_items || []).filter(function (x) { return x.order_id === o.id; });
    v.total = orderSum(o.id); v.bills = orderBills(o.id).map(billRecalc); var tb = byId('tables', o.table_id); v.table_no = tb ? tb.no : null; return v;
  }
  function priceLog(it, old, nw) { if (+old === +nw) return; DB.menu_price_log.push({ id: nid('menu_price_log'), item_id: it.id, name: it.name, old: +old || 0, new: +nw || 0, by: meId(), at: nowIso() }); }
  function stopIt(it, by) { it.stop = true; it.stop_at = nowIso(); it.stop_by = by || meId(); if (it.stop_until == null) it.stop_until = next06(); }
  function ret(it, qty) { if (it && it.left_n != null) { it.left_n = +it.left_n + qty; unauto(it); } }
  function unauto(it) { if (it && it.left_n > 0 && it.stop && it.stop_auto) { it.stop = false; it.stop_at = null; it.stop_by = null; it.stop_auto = false; } }

  /* ---------- вызовы ---------- */
  var R = {};
  R.order_open = function (a) {
    var ty = a.type || 'table', d = day();
    if (ty === 'table' && a.table_id != null) { var ex = (DB.orders || []).filter(function (o) { return o.table_id === a.table_id && (o.status === 'open' || o.status === 'bill'); })[0]; if (ex) return OK(Object.assign(orderView(ex), { existing: true })); }
    var o = { id: nid('orders'), no: (DB.orders || []).filter(function (x) { return x.day === d; }).length + 1, day: d, type: ty,
      table_id: a.table_id == null ? null : a.table_id, room_no: a.room_no || null, booking_id: a.booking_id || null, event_id: a.event_id || null, client_id: a.client_id || null,
      waiter_id: a.waiter_id || meId(), guests: +a.guests || null, name: a.name || null, phone: a.phone || null, address: a.address || null, landmark: a.landmark || null,
      due_at: a.due_at || null, source: a.source || null, comment: a.comment || null, status: 'open', created_at: nowIso(), created_by: meId(), shift_id: a.shift_id || null, closed_at: null };
    DB.orders.push(o); save(); return OK(orderView(o));
  };
  R.order_add = function (a) {
    var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден'); if (o.status !== 'open' && o.status !== 'bill') return E('Заказ уже закрыт');
    var it = byId('menu_item', a.item_id); if (!it || it.archived) return E('Позиция не найдена'); sweep();
    var q = Math.max(0.001, +a.qty || 1);
    if (it.stop) return E('Закончилось', { code: 'stop', stop_at: it.stop_at });
    if (it.left_n != null && q > +it.left_n) return E('Осталось ' + it.left_n, { code: 'left', left_n: it.left_n });
    var mods = (a.mods || []).map(function (m) { return { g: m.g || null, o: m.o || null, name: m.name, name_uz: m.name_uz || null, add: +m.add || 0 }; });
    var oi = { id: nid('order_items'), order_id: o.id, item_id: it.id, name: it.name + (a.size ? ' ' + a.size : ''), name_uz: (it.name_uz || it.name) + (a.size ? ' ' + a.size : ''), pos_code: it.pos_code || null, ikpu: it.ikpu || null,
      price: a.price != null ? +a.price : itemPrice(it, a.size, mods), qty: q, size: a.size || null, mods: mods, comment: a.comment || null, allergy: a.allergy || null,
      course: a.course || it.course_def || 'now', guest_no: a.guest_no == null ? null : +a.guest_no, station: it.station, station_id: it.station_id || null,
      state: 'draft', sent_at: null, ready_at: null, served_at: null, ticket_no: null, added_by: meId(), added_at: nowIso() };
    DB.order_items.push(oi);
    if (it.left_n != null) { it.left_n = +it.left_n - q; if (it.left_n <= 0) { it.left_n = 0; stopIt(it); it.stop_auto = true; } }
    save(); return OK(Object.assign({}, oi, { left_n: it.left_n, stop: it.stop }));
  };
  R.item_del = function (a) { var oi = byId('order_items', a.id); if (!oi) return E('Позиция не найдена'); if (oi.state !== 'draft') return E('Позиция уже отправлена — нужна отмена с причиной', { code: 'sent' });
    DB.order_items.splice(DB.order_items.indexOf(oi), 1); ret(byId('menu_item', oi.item_id), oi.qty); save(); return OK({ ok: true }); };
  R.item_qty = function (a) { var oi = byId('order_items', a.id); if (!oi) return E('Позиция не найдена'); if (oi.state !== 'draft') return E('Позиция уже отправлена', { code: 'sent' });
    var it = byId('menu_item', oi.item_id), q = Math.max(0.001, +a.qty || 1), d = q - oi.qty; if (d > 0 && it && it.stop) return E('Закончилось', { code: 'stop' });
    if (d > 0 && it && it.left_n != null && d > it.left_n) return E('Осталось ' + it.left_n, { code: 'left', left_n: it.left_n });
    if (it && it.left_n != null) { it.left_n -= d; if (it.left_n <= 0) { it.left_n = 0; stopIt(it); it.stop_auto = true; } else unauto(it); }
    oi.qty = q; save(); return OK(oi); };
  var TK = 0;
  R.order_send = function (a) {
    var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден');
    var L = (DB.order_items || []).filter(function (x) { return x.order_id === o.id && x.state === 'draft' && (!a.ids || a.ids.indexOf(x.id) >= 0); }); if (!L.length) return E('Нечего отправлять');
    var d = day(), base = 0; (DB.order_items || []).forEach(function (x) { if (x.ticket_no && x.sent_at && day(Date.parse(x.sent_at)) === d && x.ticket_no > base) base = x.ticket_no; });
    var t = nowIso(), per = {}; L.forEach(function (x) { var k = x.station || 'hot'; if (!per[k]) per[k] = ++base; x.state = 'wait'; x.sent_at = t; x.ticket_no = per[k]; x.sent_by = meId(); });
    save(); return OK({ sent: L.length, tickets: Object.keys(per).map(function (k) { return { station: k, ticket_no: per[k] }; }) });
  };
  R.item_state = function (a) {
    var ids = a.ids || [a.id], t = nowIso(), n = 0, ok = ['wait', 'cooking', 'ready', 'served'];
    if (ok.indexOf(a.state) < 0) return E('Неизвестное состояние');
    ids.forEach(function (id) { var x = byId('order_items', id); if (!x || x.state === 'cancelled' || x.state === 'draft') return; x.state = a.state; if (a.state === 'cooking') x.cook_at = t; if (a.state === 'ready') { x.ready_at = t; x.ready_by = meId(); } if (a.state === 'served') x.served_at = t; n++; });
    save(); return OK({ changed: n });
  };
  R.order_move = function (a) { var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден'); var busy = (DB.orders || []).filter(function (x) { return x.id !== o.id && x.table_id === a.table_id && (x.status === 'open' || x.status === 'bill'); })[0];
    if (busy) return E('Стол занят — объедините заказы', { code: 'busy', order_id: busy.id }); o.table_id = a.table_id; save(); return OK(orderView(o)); };
  R.order_merge = function (a) { var f = byId('orders', a.from_id), t = byId('orders', a.to_id); if (!f || !t) return E('Заказ не найден'); if (f.id === t.id) return E('Это один и тот же заказ');
    (DB.order_items || []).forEach(function (x) { if (x.order_id === f.id) { x.order_id = t.id; x.from_order = f.id; } }); f.status = 'closed'; f.merged_into = t.id; f.closed_at = nowIso();
    (DB.bills || []).forEach(function (b) { if (b.order_id === f.id && b.status === 'open') b.status = 'void'; }); save(); return OK(orderView(t)); };
  R.order_pass = function (a) { var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден'); o.pass_from = o.waiter_id; o.waiter_id = a.waiter_id; o.pass_at = nowIso(); save(); return OK(orderView(o)); };
  R.order_close = function (a) { var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден'); if (a.cancel) { if (liveItems(o.id).some(function (x) { return x.state !== 'draft'; })) return E('В заказе есть отправленные позиции — отмените их с причиной'); liveItems(o.id).forEach(function (x) { ret(byId('menu_item', x.item_id), x.qty); x.state = 'cancelled'; }); o.status = 'cancelled'; }
    else o.status = 'closed'; o.closed_at = nowIso(); o.closed_by = meId(); save(); return OK(orderView(o)); };
  R.bill_make = function (a) {
    var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден');
    var b = orderBills(o.id).filter(function (x) { return x.status === 'open'; })[0];
    if (!b) { b = { id: nid('bills'), order_id: o.id, part: 1, parts: 1, item_ids: null, share: null, subtotal: 0, service_pct: 0, service: 0, discount_id: null, discount: 0, discount_note: null, round: 0, round_to: 0, total: 0, status: 'open', created_at: nowIso(), by: meId() }; DB.bills.push(b); }
    ['service_pct', 'discount', 'discount_id', 'discount_note', 'round_to'].forEach(function (k) { if (a[k] !== undefined) b[k] = a[k]; });
    billRecalc(b); if (o.status === 'open') o.status = 'bill'; save(); return OK(Object.assign({}, b));
  };
  R.bill_split = function (a) {
    var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден');
    var old = orderBills(o.id); if (old.some(function (b) { return b.status === 'paid' || (DB.bill_pays || []).some(function (p) { return p.bill_id === b.id; }); })) return E('По счёту уже есть оплата — делить нельзя');
    var proto = old[0] || {}; old.forEach(function (b) { b.status = 'void'; });
    var groups = a.groups || null, n = groups ? groups.length : Math.max(2, Math.min(20, +a.parts || 2)), out = [];
    for (var i = 0; i < n; i++) { var b = { id: nid('bills'), order_id: o.id, part: i + 1, parts: n, item_ids: groups ? groups[i] : null, share: groups ? null : 1 / n, subtotal: 0, service_pct: +proto.service_pct || 0, service: 0, discount_id: null, discount: groups ? 0 : Math.round((+proto.discount || 0) / n), discount_note: proto.discount_note || null, round: 0, round_to: +proto.round_to || 0, total: 0, status: 'open', created_at: nowIso(), by: meId() };
      DB.bills.push(billRecalc(b)); out.push(b); }
    if (!groups) { var last = out[out.length - 1]; last.rest = true; billRecalc(last); }
    o.status = 'bill'; save(); return OK(out);
  };
  R.bill_pay = function (a) {
    var b = byId('bills', a.bill_id); if (!b || b.status === 'void') return E('Счёт не найден'); billRecalc(b);
    var pays = a.pays || [{ method: a.method, amount: a.amount, currency: a.currency, rate: a.rate, tip: a.tip }], t = nowIso();
    pays.forEach(function (p) { if (!p || !p.method) return; DB.bill_pays.push({ id: nid('bill_pays'), bill_id: b.id, method: p.method, amount: +p.amount || 0, currency: p.currency || 'UZS', rate: +p.rate || 1, tip: +p.tip || 0, by: meId(), at: t }); });
    billRecalc(b); var change = Math.max(0, b.paid - b.total); if (b.paid >= b.total) { b.status = 'paid'; b.paid_at = t; }
    var o = byId('orders', b.order_id); if (o && orderBills(o.id).every(function (x) { return x.status === 'paid'; })) { o.status = 'paid'; o.paid_at = t; }
    save(); return OK({ bill: b, paid: b.paid, left: Math.max(0, b.total - b.paid), change: change, order_status: o ? o.status : null });
  };
  R.bill_fiscal = function (a) {
    var b = byId('bills', a.bill_id); if (!b) return E('Счёт не найден');
    DB.fiscal_marks = DB.fiscal_marks.filter(function (f) { return f.bill_id !== b.id; });
    var f = { id: nid('fiscal_marks'), bill_id: b.id, order_id: b.order_id, state: a.state === 'none' ? 'none' : 'done', method: a.method || null, check_last4: a.check_last4 || null, photo: a.photo || null, reason: a.reason || null, done_lines: a.done_lines || null, by: meId(), at: nowIso() };
    DB.fiscal_marks.push(f); save(); return OK(f);
  };
  R.cancel_req = function (a) {
    var oi = byId('order_items', a.order_item_id); if (!oi) return E('Позиция не найдена');
    if (oi.state === 'draft') return R.item_del({ id: oi.id });
    if (oi.state === 'cancel_req' || oi.state === 'cancelled') return E('Отмена уже запрошена');
    var r = { id: nid('cancel_requests'), order_item_id: oi.id, order_id: oi.order_id, prev_state: oi.state, reason: a.reason || '', by: meId(), decided_by: null, ok: null, at: nowIso(), decided_at: null };
    oi.state = 'cancel_req'; DB.cancel_requests.push(r); save(); return OK(r);
  };
  R.cancel_decide = function (a) {
    var r = byId('cancel_requests', a.id); if (!r) return E('Запрос не найден'); if (r.ok != null) return E('Уже решено');
    var oi = byId('order_items', r.order_item_id); r.ok = !!a.ok; r.decided_by = meId(); r.decided_at = nowIso(); r.note = a.note || null;
    if (oi) { if (r.ok) { oi.state = 'cancelled'; oi.cancelled_at = r.decided_at; if (r.prev_state === 'wait') ret(byId('menu_item', oi.item_id), oi.qty); } else oi.state = r.prev_state || 'wait'; }
    (DB.bills || []).forEach(function (b) { if (oi && b.order_id === oi.order_id && b.status === 'open') billRecalc(b); });
    save(); return OK(r);
  };
  R.stop_set = function (a) {
    var it = byId('menu_item', a.item_id); if (!it) return E('Позиция не найдена');
    var until = a.until === 'manual' ? 'manual' : next06();
    if (a.left_n !== undefined) { if (a.left_n === null || a.left_n === '') { it.left_n = null; } else { it.left_n = Math.max(0, +a.left_n); it.stop_until = until; if (it.left_n === 0) { stopIt(it); } else if (it.stop) { it.stop = false; it.stop_at = null; } } }
    if (a.stop !== undefined) { if (a.stop) { it.stop_until = until; stopIt(it); it.stop_auto = false; } else { it.stop = false; it.stop_at = null; it.stop_by = null; it.stop_auto = false; if (it.left_n === 0) it.left_n = null; if (it.left_n == null) it.stop_until = null; } }
    if (!it.stop && it.left_n == null) it.stop_until = null;
    save(); return OK(it);
  };
  R.delivery_state = function (a) {
    var o = byId('orders', a.order_id); if (!o) return E('Заказ не найден');
    var d = (DB.deliveries || []).filter(function (x) { return x.order_id === o.id; })[0]; if (!d) { d = { id: nid('deliveries'), order_id: o.id, courier_id: null, state: 'new', cash: 0, at_new: nowIso() }; DB.deliveries.push(d); }
    if (a.courier_id !== undefined) d.courier_id = a.courier_id; if (a.cash !== undefined) d.cash = +a.cash || 0; if (a.note !== undefined) d.note = a.note;
    if (a.state) { d.state = a.state; d['at_' + a.state] = nowIso(); d.by = meId(); }
    save(); return OK(d);
  };
  /* меню: сохранить позицию целиком (цена пишется в журнал), категорию, загрузка таблицей */
  var ITEM_KEYS = ['cat_id', 'name', 'name_uz', 'price', 'photo', 'unit', 'yield_txt', 'station', 'station_id', 'sizes', 'mod_groups', 'allergens', 'course_def', 'ikpu', 'pos_code', 'is_combo', 'combo_items', 'recipe', 'kind', 'archived', 'dish_day', 'sell_from', 'sell_to', 'sort'];
  R.menu_save = function (a) {
    var p = a.item || a, it = p.id != null ? byId('menu_item', p.id) : null;
    if (!it) { it = { id: nid('menu_item'), stop: false, left_n: null, stop_until: null, stop_at: null, stop_by: null, sizes: [], mod_groups: [], allergens: [], combo_items: [], recipe: [], kind: 'menu', archived: false, course_def: '2', unit: 'port', created_at: nowIso(), created_by: meId() }; DB.menu_item.push(it); if (p.price != null) priceLog(it, 0, p.price); }
    else if (p.price != null) priceLog(it, it.price, p.price);
    ITEM_KEYS.forEach(function (k) { if (p[k] !== undefined) it[k] = p[k]; });
    if (it.station && !it.station_id) { var s = (DB.stations || []).filter(function (x) { return x.kind === it.station; })[0]; if (s) it.station_id = s.id; }
    it.updated_at = nowIso(); it.updated_by = meId(); save(); return OK(it);
  };
  R.menu_cat_save = function (a) {
    var p = a.cat || a, c = p.id != null ? byId('menu_cat', p.id) : null;
    if (!c) { c = { id: nid('menu_cat'), name: '', name_uz: '', sort: (DB.menu_cat || []).length + 1, hidden: false, sell_from: null, sell_to: null, kind: 'menu' }; DB.menu_cat.push(c); }
    ['name', 'name_uz', 'sort', 'hidden', 'sell_from', 'sell_to', 'kind'].forEach(function (k) { if (p[k] !== undefined) c[k] = p[k]; });
    if (Array.isArray(a.order)) a.order.forEach(function (id, i) { var x = byId('menu_cat', id); if (x) x.sort = i + 1; });
    save(); return OK(c);
  };
  /* строки: [{name, cat, price, yield_txt, station, pos_code, ikpu, kind, name_uz, unit}] — новые категории создаются по имени */
  R.menu_import = function (a) {
    var rows = a.rows || [], added = [], kind = a.kind || 'menu';
    rows.forEach(function (r) {
      if (!r || !r.name) return; var cn = String(r.cat || 'Без категории').trim();
      var c = (DB.menu_cat || []).filter(function (x) { return x.name.toLowerCase() === cn.toLowerCase() && (x.kind || 'menu') === kind; })[0];
      if (!c) { c = { id: nid('menu_cat'), name: cn, name_uz: r.cat_uz || '', sort: (DB.menu_cat || []).length + 1, hidden: false, sell_from: null, sell_to: null, kind: kind }; DB.menu_cat.push(c); }
      var st = (DB.stations || []).filter(function (s) { return s.kind === r.station || s.name.toLowerCase() === String(r.station || '').toLowerCase(); })[0] || (DB.stations || [])[0] || null;
      var it = { id: nid('menu_item'), cat_id: c.id, name: String(r.name).trim(), name_uz: r.name_uz || '', price: Math.round(+r.price || 0), photo: null, unit: r.unit || 'port', yield_txt: r.yield_txt || '', station: st ? st.kind : 'hot', station_id: st ? st.id : null,
        sizes: [], mod_groups: [], allergens: [], course_def: kind === 'menu' ? '2' : 'now', ikpu: r.ikpu || '', pos_code: r.pos_code ? String(r.pos_code) : '', stop: false, left_n: null, stop_until: null, stop_at: null, stop_by: null,
        is_combo: false, combo_items: [], recipe: [], kind: kind, archived: false, dish_day: false, sell_from: null, sell_to: null, sort: 999, created_at: nowIso(), created_by: meId() };
      DB.menu_item.push(it); priceLog(it, 0, it.price); added.push(it);
    });
    save(); return OK({ added: added.length, items: added });
  };
  /* учебные заказы для проверки экранов кухни и кассы (только по запросу) */
  R.w4_demo_orders = function () {
    var items = (DB.menu_item || []).filter(function (x) { return !x.archived && !x.stop && x.kind === 'menu'; }); if (!items.length) return E('Нет меню');
    var ws = (DB.employees || []).filter(function (e) { return e.active !== false && e.dept_id === 'fnb'; }), tbs = (DB.tables || []).slice(0, 3), made = 0;
    (tbs.length ? tbs : [null, null]).forEach(function (tb, i) {
      var o = R.order_open({ type: tb ? 'table' : 'counter', table_id: tb ? tb.id : null, guests: 2 + i, waiter_id: ws.length ? ws[i % ws.length].id : meId() }).data; if (!o || o.existing) return;
      [0, 1, 2].forEach(function (k) { var it = items[(i * 5 + k * 3) % items.length]; R.order_add({ order_id: o.id, item_id: it.id, qty: 1 + (k === 0 ? 1 : 0), size: (it.sizes || []).length ? it.sizes[0].n : null }); });
      R.order_send({ order_id: o.id }); made++;
    });
    return OK({ orders: made });
  };

  /* ---------- подключение к клиенту ---------- */
  var prev = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), w = Object.create(c), rpc0 = c.rpc.bind(c), from0 = c.from.bind(c);
    w.rpc = function (n, a) { if (R[n]) { sync(); sweep(); var r; try { r = R[n](a || {}); } catch (e) { console.warn(e); r = E(String(e && e.message || e)); } return Promise.resolve(r); } return rpc0(n, a); };
    /* простые таблицы: перед чтением — свежие данные из другого окна; после записи — сохранить и метка; цена позиции — в журнал */
    w.from = function (t) {
      var q = from0(t); if (T.indexOf(t) < 0) return q;
      var run0 = q.run, ins0 = q.insert;
      q.insert = function (p) { var n = nid(t); [].concat(p).forEach(function (x) { if (x && x.id == null) x.id = n++; }); return ins0.apply(this, arguments); };
      q.run = function () {
        sync(); if (t === 'menu_item' && sweep() && this.op === 'select') save();
        var before = null;
        if (t === 'menu_item' && this.op === 'update' && this.payload && this.payload.price != null) { var self = this; before = (DB.menu_item || []).filter(function (r) { return self.f.every(function (fn) { return fn(r); }); }).map(function (r) { return [r, r.price]; }); }
        var r = run0.apply(this, arguments);
        if (before) before.forEach(function (x) { priceLog(x[0], x[1], x[0].price); });
        if (this.op !== 'select') save();
        return r;
      };
      return q;
    };
    return w;
  };
  /* для экранов (через w4OnTick в app) и для проверки в консоли */
  window.__W4O = {
    tables: T, tick: TICK, key: LS, sync: sync, save: save, sweep: sweep, next06: next06, now: nowMs, day: day, hm: hm,
    on: function (fn, key) { if (key) subs = subs.filter(function (s) { return s.key !== key; }); var s = { fn: fn, key: key || null }; subs.push(s); return function () { subs = subs.filter(function (x) { return x !== s; }); }; },
    off: function (key) { subs = subs.filter(function (s) { return s.key !== key; }); },
    itemPrice: itemPrice, orderSum: orderSum, billRecalc: billRecalc,
    /* демо «наутро»: сдвиг часов мока, например __W4O.skewDays(1) */
    skewDays: function (n) { lsSet(SKEW, String(Math.round((+n || 0) * 864e5))); sweep(); save(); },
    reset: function () { try { localStorage.removeItem(LS); localStorage.removeItem(SKEW); } catch (e) {} }
  };
})();
