/* ===== 94 «Ўзбекча» — узбекский на кириллице (префикс cy_ / MLX_CYR) =====
   Третий язык интерфейса строится автоматически из готового перевода на латиницу:
     русская строка → перевод на латиницу (i18n.js, saas-uz.js, w4/uz/*) → транслитерация по таблице ниже.
   Здесь только движок и словари исключений. Переключатель, память языка у сотрудника и «Пульт» — w4/frag/94-cyr.js.
   Подключается до i18n.js (как все w4/uz/*). i18n.js (w4/files) вызывает MLX_CYR, если он есть; без него — два языка, как раньше.
   Что не трогаем: цифры и суммы, логины, почта, ссылки, коды (PLU, OOO, BB…), названия брендов, русские имена и блюда
   (они в базе по-русски и остаются как есть), всё, что внутри элемента с классом cy-keep. */
(function () {
'use strict';

/* ---------- 1. Таблица букв ---------- */
var L = { a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'ц', w: 'в', e: 'е' };
var VOW = 'aeiouаеиоуўэяёю';
var OKINA = /[ʻ‘'`]/;          /* после o и g: oʻ → ў, gʻ → ғ */
var TUTUQ = /[ʼ’]/;            /* тутуқ белгиси → ъ */
var AP = /[ʻʼ‘’'`]/;

/* ---------- 2. Русские заимствования и слова, где таблица ошибается ----------
   WORD — целое слово (в нижнем регистре, апостроф oʻ/gʻ = ʻ). STEM — начало слова, дальше узбекские окончания по таблице. */
var WORD = {
  /* мягкий знак на конце (без окончания) */
  'parol': 'пароль', 'profil': 'профиль', 'fayl': 'файл', 'mebel': 'мебель', 'model': 'модель', 'film': 'фильм', 'rol': 'роль', 'stil': 'стиль',
  'kontrol': 'контроль', 'avtomobil': 'автомобиль', 'medal': 'медаль', 'portfel': 'портфель', 'festival': 'фестиваль', 'kalendar': 'календарь',
  'dvigatel': 'двигатель', 'shampun': 'шампунь', 'tyul': 'тюль', 'rul': 'руль', 'spektakl': 'спектакль', 'ansambl': 'ансамбль', 'otel': 'отель',
  'yanvar': 'январь', 'fevral': 'февраль', 'aprel': 'апрель', 'iyun': 'июнь', 'iyul': 'июль', 'sentabr': 'сентябрь', 'sentyabr': 'сентябрь',
  'oktabr': 'октябрь', 'oktyabr': 'октябрь', 'noyabr': 'ноябрь', 'dekabr': 'декабрь', 'pochtalyon': 'почтальон', 'motel': 'мотель', 'modul': 'модуль',
  'kafel': 'кафель', 'tunnel': 'туннель', 'shnitsel': 'шницель', 'pastil': 'пастила', 'detal': 'деталь', 'material': 'материал', 'potensial': 'потенциал',
  'signal': 'сигнал', 'vestibyul': 'вестибюль', 'gel': 'гель', 'tyulpan': 'тюльпан', 'rubl': 'рубль', 'normal': 'нормал', 'personal': 'персонал',
  'ventil': 'вентиль', 'filtr': 'фильтр', 'dizel': 'дизель', 'portal': 'портал', 'kupyura': 'купюра', 'pyure': 'пюре', 'kompyuter': 'компьютер',
  'bilyard': 'бильярд', 'menejer': 'менеджер', 'menejeri': 'менеджери', 'menejerlar': 'менеджерлар', 'menejerga': 'менеджерга', 'menejerni': 'менеджерни',
  'aktyor': 'актёр', 'obyekt': 'объект', 'obyektlar': 'объектлар', 'subyekt': 'субъект', 'obyom': 'объём', 'podyezd': 'подъезд', 'konveyer': 'конвейер',
  'proyektor': 'проектор', 'koeffitsiyent': 'коэффициент', 'koeffitsient': 'коэффициент', 'poezd': 'поезд', 'proekt': 'проект', 'proyekt': 'проект',
  'diyeta': 'диета', 'kliyent': 'клиент', 'kliyentlar': 'клиентлар', 'pasiyent': 'пациент', 'oriyentir': 'ориентир', 'sotsial': 'социал',
  'sex': 'цех', 'sexi': 'цехи', 'sexlar': 'цехлар', 'sexga': 'цехга', 'sexda': 'цехда', 'sexning': 'цехнинг', 'sexni': 'цехни', 'sexdan': 'цехдан', 'sexlari': 'цехлари',
  'sentner': 'центнер', 'sement': 'цемент', 'sitrus': 'цитрус', 'sirk': 'цирк', 'sikl': 'цикл',
  'litsenziya': 'лицензия', 'litsey': 'лицей', 'vaktsina': 'вакцина', 'patrul': 'патруль', 'tabel': 'табель', 'karamel': 'карамель', 'panel': 'панель',
  'vanil': 'ваниль', 'alkogol': 'алкоголь', 'forel': 'форель', 'nol': 'ноль', 'shtempel': 'штемпель', 'algoritm': 'алгоритм',
  'dona': 'дона', 'yoʻq': 'йўқ', 'yoʻl': 'йўл', 'yoʻriqnoma': 'йўриқнома', 'yoʻqolgan': 'йўқолган',
  'iyn': 'июн', 'iyl': 'июл', 'mln': 'млн', 'mlrd': 'млрд', 'daq': 'дақ', 'kg': 'кг', 'g': 'г', 'l': 'л', 'm': 'м', 'km': 'км', 'sm': 'см', 'ml': 'мл',
  'soʻm': 'сўм', 'jamoa': 'жамоа',
  /* ручная проверка 25.10: */
  'pult': 'пульт', 'pulti': 'пульти', 'pultda': 'пультда', 'pultga': 'пультга', 'pultni': 'пультни', 'pultdan': 'пультдан', 'pultning': 'пультнинг',
  'gastroyomkost': 'гастроёмкость', 'gastroyomkostlar': 'гастроёмкостлар', 'konsentratsiya': 'концентрация', 'shtrix': 'штрих', 'shtrixkod': 'штрихкод'
};
var STEM = {
  /* -ция, -ционный (в латинице -siya / -tsiya) */
  'aksiya': 'акция', 'funksiya': 'функция', 'seksiya': 'секция', 'reaksiya': 'реакция', 'kolleksiya': 'коллекция', 'instruksiya': 'инструкция',
  'stansiya': 'станция', 'inspeksiya': 'инспекция', 'konstruksiya': 'конструкция', 'distansiya': 'дистанция', 'lisenziya': 'лицензия', 'korreksiya': 'коррекция',
  'tsiya': 'ция', 'sertifikat': 'сертификат', 'tsex': 'цех', 'tsent': 'цент', 'protsent': 'процент', 'sentr': 'центр', 'markaz': 'марказ',
  'menyu': 'меню', 'kompyuter': 'компьютер', 'menejer': 'менеджер', 'kliyent': 'клиент', 'obyekt': 'объект', 'koeffitsiyent': 'коэффициент', 'pasiyent': 'пациент',
  'pyure': 'пюре', 'kupyura': 'купюра', 'bilyard': 'бильярд', 'aktyor': 'актёр', 'proyekt': 'проект', 'konveyer': 'конвейер', 'oriyentir': 'ориентир',
  'telefon': 'телефон', 'resepshn': 'ресепшн', 'resepshen': 'ресепшен', 'xauskiping': 'хаускипинг', 'supervayzer': 'супервайзер', 'kassir': 'кассир',
  'sotsial': 'социал', 'patsiyent': 'пациент', 'restoran': 'ресторан', 'shokolad': 'шоколад', 'kapuchino': 'капучино', 'kappuchino': 'капучино',
  'espresso': 'эспрессо', 'amerikano': 'американо', 'latte': 'латте', 'parfyum': 'парфюм', 'byudjet': 'бюджет', 'byuro': 'бюро', 'kyuvet': 'кювет',
  'yanvar': 'январ', 'fevral': 'феврал', 'aprel': 'апрел', 'sentabr': 'сентябр', 'sentyabr': 'сентябр', 'oktabr': 'октябр', 'oktyabr': 'октябр', 'noyabr': 'ноябр', 'dekabr': 'декабр',
  'avtomobil': 'автомобил', 'kalendar': 'календар', 'festival': 'фестивал', 'profil': 'профил', 'parol': 'парол', 'kontrol': 'контрол', 'filtr': 'фильтр',
  'mebel': 'мебел', 'fayl': 'файл', 'porsiya': 'порция', 'kuryer': 'курьер', 'konsyerj': 'консьерж', 'kanselyar': 'канцеляр', 'vaktsina': 'вакцина',
  'tabel': 'табел', 'patrul': 'патрул', 'panel': 'панел', 'alkogol': 'алкогол', 'interyer': 'интерьер', 'premyer': 'премьер', 'barer': 'барьер', 'pavilyon': 'павильон', 'obyom': 'объём', 'podyezd': 'подъезд', 'diyeta': 'диета', 'litsenziya': 'лицензия'
};
/* «ts» между корнем на -t и окончанием (ketsin, aytsin, otsiz) — не «ц» */
var TS_KEEP = /^(in|iz|a|ang|am|ak|ay|ib|ik)(?!ya)/;

/* ---------- 3. Что никогда не переводим на кириллицу ---------- */
var BRAND = ['Mir Luxe One', 'Mir Luxe Plaza', 'Mir Luxe', 'MirLuxe', 'Wi-Fi', 'WiFi', 'iPhone', 'iOS', 'Android', 'Excel', 'Clockster', 'Workly', 'Payme', 'Click', 'Uzum Tezkor', 'Uzum Bank', 'Uzum',
  'Wolt', 'Yandex Eda', 'Yandex Go', 'Yandex', 'Booking.com', 'Booking', 'Fidelio', 'Opera', 'Google Sheets', 'Google Maps', 'Google', 'Supabase', 'HoReCa', 'Instagram', 'WhatsApp',
  'Facebook', 'E-mehmon', 'Out of Service', 'Out of Order', 'RevPAR', 'Express', 'Humo', 'Uzcard', 'Visa', 'Mastercard', 'Apple', 'Chrome', 'Safari', 'PDF', 'Word', 'Airbnb', 'Ostrovok', 'Trip.com', 'Expedia', 'Hydrolife', 'Coca-Cola', 'Pepsi', 'Fanta', 'Sprite', 'Nestle', 'Lavazza', 'Makro', 'Korzinka', 'Havas', 'Telegram'];
var BRAND_RX = new RegExp('(?<![A-Za-z])(' + BRAND.map(function (b) { return b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![A-Za-z])', 'g');
var PROT_RX = /(?:https?:\/\/|www\.)[^\s«»"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|@[\w.]+|#[\w=&.-]+|\b[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+(?:#[\w=&.-]*)?/g;
/* заглавные коды, которые по-кириллице тоже пишут кириллицей */
var CAPS_CY = { IKPU: 'ИКПУ', MXIK: 'МХИК', STIR: 'СТИР', JSHSHIR: 'ЖШШИР', SOʻM: 'СЎМ', XDP: 'ХДП' };

/* ---------- 4. Слово ---------- */
function up(ch) { return ch.toUpperCase(); }
function isUp(ch) { return ch !== ch.toLowerCase(); }
function norm(w) { return w.replace(/([oOgG])[‘'`’]/g, '$1ʻ').replace(/[’']/g, 'ʼ').toLowerCase(); }
function caseLike(src, out) {
  if (src.length > 1 && src === src.toUpperCase() && src !== src.toLowerCase()) return out.toUpperCase();
  if (isUp(src.charAt(0))) return out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}
function rule(w, start) {
  var o = '', n = w.length, i = 0;
  while (i < n) {
    var c = w.charAt(i), lc = c.toLowerCase(), nx = w.charAt(i + 1), nl = nx.toLowerCase(), cap = isUp(c), r;
    var prev = o.slice(-1).toLowerCase();
    if ((lc === 'o' || lc === 'g') && nx && OKINA.test(nx)) { r = lc === 'o' ? 'ў' : 'ғ'; i += 2; }
    else if (lc === 's' && nl === 'h') { r = 'ш'; i += 2; }
    else if (lc === 'c' && nl === 'h') { r = 'ч'; i += 2; }
    else if (lc === 'y' && (nl === 'a' || nl === 'u' || nl === 'e' || (nl === 'o' && !OKINA.test(w.charAt(i + 2))))) { r = { a: 'я', u: 'ю', e: 'е', o: 'ё' }[nl]; i += 2; }
    else if (lc === 't' && nl === 's' && w.charAt(i + 2).toLowerCase() !== 'h' && !TS_KEEP.test(w.slice(i + 2).toLowerCase())) { r = 'ц'; i += 2; }
    else if (lc === 's' && /[kn]/.test(prev === 'к' ? 'k' : prev === 'н' ? 'n' : '') && /^iya/i.test(w.slice(i + 1)) && !/^(pen|ekspan)/i.test(w)) { r = 'ц'; i += 1; }
    else if (lc === 'e') { r = (i === 0 && start) || (prev && VOW.indexOf(prev) >= 0) ? 'э' : 'е'; i += 1; }
    else if (AP.test(c)) { r = (i > 0 && i < n - 1 && !/^(da|dan|dagi|ga|gacha|ni|ning|lar|larni|larga|dek|siz|li|ga|cha)$/i.test(w.slice(i + 1))) ? 'ъ' : ''; i += 1; cap = false; }
    else if (L[lc] != null) { r = L[lc]; i += 1; }
    else { r = c; i += 1; cap = false; }
    o += cap ? up(r) : r;
  }
  return o;
}
var WCACHE = {};
function word(w, start) {
  if (start == null) start = true;
  var key = (start ? '1' : '0') + w;
  if (WCACHE[key] != null) return WCACHE[key];
  var lw = norm(w), out = null;
  if (NOT_UZ[lw] || /c(?!h)|w|th/i.test(w)) out = w;           /* английское слово (service, show) — как есть */
  else if (WORD[lw] != null) out = caseLike(w, WORD[lw]);
  else {
    var best = '';
    for (var s in STEM) if (lw.indexOf(s) === 0 && s.length > best.length) best = s;
    if (!best) for (var s2 in STEM) if (s2.charAt(0) !== lw.charAt(0) || s2.length < 5) continue; else if (lw.indexOf(s2) > 0 && s2.length > best.length && lw.indexOf(s2) + s2.length <= lw.length && /tsiya|siya$/.test(s2)) best = s2;
    if (best && lw.indexOf(best) === 0) {
      var tail = w.slice(best.length);
      out = caseLike(w.slice(0, best.length), STEM[best]) + rule(tail, false);
      if (w === w.toUpperCase() && w.length > 1) out = out.toUpperCase();
    }
  }
  if (out == null) out = rule(w, start);
  WCACHE[key] = out; return out;
}

/* ---------- 5. Текст ---------- */
var VOCAB = Object.create(null), VN = 0;
function addVocab(list) {
  (list || []).forEach(function (s) {
    if (typeof s !== 'string' || !/[A-Za-z]/.test(s)) return;
    s.replace(BRAND_RX, ' ').replace(PROT_RX, ' ').replace(/[A-Za-z](?:[A-Za-z]|[ʻʼ‘’'`](?=[A-Za-z]))*[ʻ‘]?/g, function (t) {
      if (t.length > 1 && t === t.toUpperCase()) return t;
      var k = norm(t); if (!VOCAB[k]) { VOCAB[k] = 1; VN++; } return t;
    });
  });
}
/* английские и служебные слова, которые попали в узбекский перевод, — не признак узбекского текста */
var NOT_UZ = { in: 1, guest: 1, amenities: 1, revenue: 1, dirty: 1, double: 1, single: 1, suite: 1, early: 1, late: 1, no: 1, up: 1, upsell: 1, pick: 1, by: 1, to: 1, for: 1, at: 1, is: 1, it: 1, do: 1, not: 1, disturb: 1, make: 1, please: 1, minibar: 0, of: 1, the: 1, and: 1, out: 1, service: 1, order: 1, room: 1, only: 1, bed: 1, breakfast: 1, night: 1, check: 1, online: 1, offline: 1, push: 1, ok: 1, bot: 1, app: 1, html: 1, staff: 1, guest: 1, house: 1, plaza: 1, luxe: 1, mir: 1, one: 1, group: 1, travel: 1, global: 1, tour: 1, events: 1, event: 1, expo: 1, team: 1, airlines: 1, international: 1, invest: 1, energy: 1, corporation: 1, university: 1, school: 1, medical: 1, mail: 1, oil: 1, booking: 1, wi: 1, fi: 1 };
function uzTok(t) { var k = norm(t); if (NOT_UZ[k]) return false; if (/[ʻʼ]/.test(t) || /[oOgG][‘'`]/.test(t)) return true; return !!VOCAB[k]; }
/* oʻ/gʻ — первой альтернативой, иначе «yogʻ», «sariyogʻ» (знак в конце слова) теряли ʻ */
var TOK = /[A-Za-z](?:[oOgG][ʻ‘'`]|[A-Za-z]|[ʻʼ‘’'`](?=[A-Za-z]))*/g;
/* mode: 'all' — вся латиница (готовый перевод), 'auto' — только если строка похожа на узбекскую, 'strict' — только знакомые слова (строка с русским) */
function text(s, mode) {
  if (s == null) return s;
  s = String(s);
  if (!/[A-Za-z]/.test(s)) return s;
  mode = mode || 'all';
  var keep = [], z = s.replace(BRAND_RX, function (m) { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0002'; })
    .replace(PROT_RX, function (m) { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0002'; });
  if (mode === 'auto') {
    if (s.trim().length < 2) return s;                                                     /* одна буква (буквы логотипа, «A», «x») */
    var any = false; z.replace(TOK, function (t) { if (!any && uzTok(t)) any = true; return t; });
    if (!any) return s;
  }
  var out = z.replace(TOK, function (t, off, all) {
    var pc = all.charAt(off - 1), nc = all.charAt(off + t.length);
    if (/[0-9\u0001\u0002]/.test(pc) && !/[\s-]/.test(pc) || /[0-9]/.test(nc)) return t;           /* A4, 3D, S7 — код */
    if (mode === 'strict' && !uzTok(t)) return t;
    if (t.length > 1 && t === t.toUpperCase()) {                                         /* заглавные: PLU, BB, OOO — код */
      if (CAPS_CY[t]) return CAPS_CY[t];
      return VOCAB[norm(t)] && t.length >= 4 ? word(t, true) : t;
    }
    if (/[A-Z]/.test(t.slice(1)) && t !== t.toUpperCase()) return t;                     /* iPhone, RevPAR */
    if (t.length === 1 && isUp(t)) {                                                     /* одна заглавная: «U yerda» — слово, «Z-hisobot», «A blok» — код */
      if (!/^\s+[a-zʻ]/.test(all.slice(off + 1, off + 3))) return t;
    }
    var start = !(pc && /[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]/.test(pc));
    return word(t, start);
  });
  return out.replace(/\u0001(\d+)\u0002/g, function (m, i) { return keep[+i]; });
}

/* ---------- 6. Ручные поправки ----------
   FIX: точная русская строка → кириллица (главнее автоматики). Заполняется в разделе 7 после ручной проверки.
   LFIX: точная строка на латинице → кириллица (для текста, который код пишет сразу по-узбекски). */
var FIX = Object.create(null), LFIX = Object.create(null);

window.MLX_CYR = {
  word: word, text: text, addVocab: addVocab, uzTok: uzTok,
  vocabSize: function () { return VN; },
  FIX: FIX, LFIX: LFIX, WORD: WORD, STEM: STEM,
  init: function (UZ) {
    var v = []; for (var k in UZ) { var x = UZ[k]; if (typeof x === 'string') v.push(x); }
    addVocab(v);
    addVocab(['yan fev mar apr may iyn iyl avg sen okt noy dek mln mlrd daq soat kun oy hafta yil dona ta kg soʻm', 'va bilan uchun yoki emas bor yoʻq ha']);
  },
  /* перевод готовой латиницы: точная поправка → таблица */
  lat: function (s) {
    if (s == null) return s;
    var t = String(s), core = t.trim();
    if (LFIX[core] != null) return t.replace(core, LFIX[core]);
    return text(t, 'all');
  }
};
})();
