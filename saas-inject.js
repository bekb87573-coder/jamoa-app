
/* ===================== Mir Luxe One для бизнеса (демо) =====================
   Вставлено в конец основного скрипта приложения. Добавляет:
   1) фирменную заставку Mir Luxe One (логотип с движением) вместо 3D-облёта здания;
   2) регистрацию нового заведения (#signup) с ценой «$1 × сотрудник, первый месяц бесплатно»;
   3) новые вкладки в «Пульте» директора: Заведение, Оформление, Подписка, Заработок, Рейтинг и награды, Отделы и должности;
   4) новые группы в «Настройках приложения»: тест дня, фото-проверки, доступ, отчёты, Telegram;
   5) сохранение всех настроек в браузере, чтобы они не пропадали при смене должности в демо. */
var SX_RATE = 11966, SX_PK = 'mlx-one-prefs', SX_RK = 'mlx-one-roles', SX_START = 'mlx-one-start';
function sxLS(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function sxJ(k, d) { try { var v = JSON.parse(sxLS(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
function sxToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()); }
function sxAddDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
var SX_MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function sxDate(d) { return +d.slice(8, 10) + ' ' + SX_MON[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4); }
function sxStart() { var s = sxLS(SX_START); if (!s) { s = sxToday(); sxLS(SX_START, s); } return s; }

/* ---------- сохранение настроек между перезагрузками демо ---------- */
(function () {
  var DB = window.__DB; if (!DB) return;
  var hs = (DB.hotel_settings || [])[0]; if (hs) hs.prefs = Object.assign({}, hs.prefs || {}, sxJ(SX_PK, {}));
  var R = sxJ(SX_RK, null);
  if (R) {
    (R.newDepts || []).forEach(function (d) { if (!DB.departments.some(function (x) { return x.id === d.id; })) DB.departments.push(d); });
    (R.newPos || []).forEach(function (p) { if (!DB.positions.some(function (x) { return x.id === p.id; })) DB.positions.push(p); });
    Object.keys(R.depts || {}).forEach(function (id) { DB.departments.forEach(function (d) { if (String(d.id) === id) Object.assign(d, R.depts[id]); }); });
    Object.keys(R.pos || {}).forEach(function (id) { DB.positions.forEach(function (p) { if (String(p.id) === id) Object.assign(p, R.pos[id]); }); });
    (R.delPos || []).forEach(function (id) { DB.positions = DB.positions.filter(function (p) { return String(p.id) !== String(id); }); });
  }
  var rpc0 = sb.rpc;
  sb.rpc = function (n, a) {
    if (n === 'prefs_save' && a && a.p) { var all = sxJ(SX_PK, {}); Object.assign(all, a.p); sxLS(SX_PK, JSON.stringify(all)); sxApplyBrand(all); }
    return rpc0.apply(this, arguments);
  };
})();
function sxRoles(fn) { var R = sxJ(SX_RK, { depts: {}, pos: {}, newDepts: [], newPos: [], delPos: [] }); fn(R); sxLS(SX_RK, JSON.stringify(R)); }

/* ---------- фирменный цвет ---------- */
var SX_ACC = [['gold', 'Золото', ''], ['emerald', 'Изумруд', '#3E8E6E'], ['sapphire', 'Сапфир', '#4A78C2'], ['bordeaux', 'Бордо', '#A8475A'], ['graphite', 'Графит', '#6B7785']];
function sxApplyBrand(p) {
  p = p || sxJ(SX_PK, {});
  var a = SX_ACC.filter(function (x) { return x[0] === p.brand_accent; })[0], r = document.documentElement.style;
  if (a && a[2]) { r.setProperty('--gold', a[2]); r.setProperty('--goldbg', 'color-mix(in srgb,' + a[2] + ' 14%,var(--card))'); r.setProperty('--goldink', a[2]); }
  else { r.removeProperty('--gold'); r.removeProperty('--goldbg'); r.removeProperty('--goldink'); }
}
sxApplyBrand();

/* ---------- логотип Mir Luxe One ---------- */
function sxMark(cls) {
  var g = (SPLASH.match(/class="lg-m"[^>]*?d="([^"]+)"/) || LOGO.match(/fill="#D1A958" d="([^"]+)"/) || [])[1] || '';
  var d = (LOGO.match(/fill="#2A2E30" d="([^"]+)"/) || [])[1] || '';
  return '<svg class="ox-mk ' + (cls || '') + '" viewBox="0 0 120 120" aria-hidden="true"><circle class="ox-ring" cx="60" cy="60" r="57" pathLength="1"/><circle class="ox-ring2" cx="60" cy="60" r="51.5"/>' +
    '<svg x="19" y="22" width="82" height="76" viewBox="1503 -694 18750 11146"><path class="ox-g" pathLength="1" d="' + g + '"/><path class="ox-d" d="' + d + '"/></svg></svg>';
}
function sxLockup(tag, anim) {
  var p = sxJ(SX_PK, {}), title = (p.brand_title || 'Mir Luxe').trim() || 'Mir Luxe', i = 0;
  var word = title.split('').map(function (c) { return c === ' ' ? '<span class="ox-sp"> </span>' : '<span class="ox-l" style="--i:' + (i++) + '">' + h(c) + '</span>'; }).join('');
  var logo = p.brand_logo ? '<img class="ox-img" src="' + h(p.brand_logo) + '" alt="">' : sxMark();
  return '<div class="ox' + (anim ? ' go' : '') + '">' + logo + '<div class="ox-w" aria-label="' + h(title) + ' One">' + word + '</div><div class="ox-rule"></div><div class="ox-one">ONE</div>' + (tag ? '<div class="ox-tag">' + h(tag) + '</div>' : '') + '</div>';
}
(function () {
  var st = document.createElement('style'); st.textContent =
    '.ox{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}' +
    '.ox-mk{width:112px;height:112px;overflow:visible}.ox-img{width:112px;height:112px;object-fit:contain;border-radius:24px}' +
    '.ox-ring{fill:none;stroke:var(--gold);stroke-width:1.3;transform-box:fill-box;transform-origin:center;transform:rotate(-90deg)}.ox-ring2{fill:none;stroke:color-mix(in srgb,var(--gold) 35%,transparent);stroke-width:.6}' +
    '.ox-g{fill:var(--gold)}.ox-d{fill:var(--ink)}' +
    '.ox-w{font:600 36px/1 var(--serif);color:var(--ink);letter-spacing:.01em;margin-top:6px}.ox-l,.ox-sp{display:inline-block;white-space:pre}' +
    '.ox-rule{width:56px;height:1px;background:var(--gold)}' +
    '.ox-one{font:700 12px/1 var(--sans);letter-spacing:.55em;padding-left:.55em;color:var(--gold)}' +
    '.ox-tag{font:500 13px/1.45 var(--sans);color:var(--muted);max-width:30ch;margin-top:6px}' +
    '@media (prefers-reduced-motion:no-preference){' +
    '.ox.go .ox-ring{stroke-dasharray:1;stroke-dashoffset:1;animation:oxDraw 1s var(--ease) .05s forwards}' +
    '.ox.go .ox-ring2{opacity:0;animation:oxFade .8s ease .7s forwards}' +
    '.ox.go .ox-g{fill-opacity:0;stroke:var(--gold);stroke-width:70;stroke-dasharray:1;stroke-dashoffset:1;animation:oxDraw 1.1s var(--ease) .3s forwards,oxFill .5s ease 1.15s forwards}' +
    '.ox.go .ox-d{opacity:0;animation:oxFade .6s ease 1s forwards}' +
    '.ox.go .ox-img{opacity:0;transform:scale(.92);animation:oxPop .8s var(--ease) .2s forwards}' +
    '.ox.go .ox-l{opacity:0;transform:translateY(.4em);animation:oxUp .55s var(--ease) forwards;animation-delay:calc(1.05s + var(--i) * 45ms)}' +
    '.ox.go .ox-rule{width:0;animation:oxRule .7s var(--ease) 1.45s forwards}' +
    '.ox.go .ox-one{opacity:0;letter-spacing:1.4em;animation:oxTrack .9s var(--ease) 1.5s forwards}' +
    '.ox.go .ox-tag{opacity:0;animation:oxFade .6s ease 1.9s forwards}}' +
    '@keyframes oxDraw{to{stroke-dashoffset:0}}@keyframes oxFill{to{fill-opacity:1;stroke-width:0}}@keyframes oxFade{to{opacity:1}}@keyframes oxPop{to{opacity:1;transform:none}}' +
    '@keyframes oxUp{to{opacity:1;transform:none}}@keyframes oxRule{to{width:56px}}@keyframes oxTrack{to{opacity:1;letter-spacing:.55em}}' +
    '.splash .spl-bar{margin-top:18px}' +
    /* регистрация */
    '.sx-su{position:fixed;inset:0;z-index:9000;background:var(--bg);overflow:auto;padding:calc(20px + env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}' +
    '.sx-in{max-width:460px;margin:0 auto;display:flex;flex-direction:column;gap:14px}.sx-in .ox{margin:6px 0 4px}.sx-in .ox-mk,.sx-in .ox-img{width:72px;height:72px}.sx-in .ox-w{font-size:28px}' +
    '.sx-steps{display:flex;gap:6px}.sx-steps i{flex:1;height:3px;border-radius:3px;background:var(--line)}.sx-steps i.on{background:var(--gold)}' +
    '.sx-h{font:var(--t-title);margin:0;color:var(--ink)}.sx-sub{color:var(--muted);font-size:14px;line-height:1.45;margin:-6px 0 0}' +
    '.sx-types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
    '.sx-type{all:unset;box-sizing:border-box;cursor:pointer;background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:4px;min-height:92px}' +
    '.sx-type b{font-size:16px;color:var(--ink)}.sx-type span{font-size:12.5px;color:var(--muted);line-height:1.35}.sx-type.on{border-color:var(--gold);background:var(--goldbg)}.sx-type:focus-visible{outline:2px solid var(--gold);outline-offset:2px}' +
    '.sx-price{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:10px}' +
    '.sx-big{font:700 40px/1 var(--sans);color:var(--ink);font-variant-numeric:tabular-nums}.sx-big small{font-size:15px;font-weight:600;color:var(--muted)}' +
    '.sx-free{display:inline-flex;align-self:flex-start;align-items:center;gap:6px;background:var(--goldbg);color:var(--goldink,var(--gold));font-weight:700;font-size:13px;border-radius:99px;padding:5px 12px}' +
    '.sx-ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;line-height:1.4;color:var(--ink)}.sx-ul li::marker{color:var(--gold)}' +
    '.sx-row{display:flex;gap:10px}.sx-row>*{flex:1}.sx-range{width:100%;accent-color:var(--gold)}' +
    /* пульт */
    '.sx-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}.sx-kpi .card{margin:0;padding:12px 14px}.sx-kv{font:700 24px/1.1 var(--sans);font-variant-numeric:tabular-nums;color:var(--ink)}.sx-kl{font-size:12px;color:var(--muted);margin-top:4px}' +
    '@media (max-width:640px){.sx-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '.sx-tbl{width:100%;border-collapse:collapse;font-size:13.5px}.sx-tbl th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}' +
    '.sx-tbl td{padding:8px;border-bottom:1px solid var(--line2);font-variant-numeric:tabular-nums;vertical-align:middle}.sx-tbl td.r,.sx-tbl th.r{text-align:right}.sx-wrap{overflow-x:auto}' +
    '.sx-in2{height:40px;font-size:14px;padding:0 10px;width:100%}.pfrow .sx-in2{width:auto;max-width:58%;flex:none}.sx-num{width:110px}.sx-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media (max-width:560px){.sx-grid{grid-template-columns:minmax(0,1fr)}}' +
    '.sx-day{display:grid;grid-template-columns:44px 46px minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line2)}.sx-day b{font-size:14px}' +
    '.sx-acc{display:flex;gap:8px;flex-wrap:wrap}.sx-acc label{display:flex;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:99px;padding:6px 12px 6px 6px;cursor:pointer;font-size:13.5px}.sx-acc input{position:absolute;opacity:0}' +
    '.sx-acc i{width:22px;height:22px;border-radius:50%;display:block}.sx-acc input:checked+i{box-shadow:0 0 0 2px var(--card),0 0 0 4px var(--ink)}.sx-acc input:focus-visible+i{outline:2px solid var(--gold);outline-offset:3px}' +
    '.sx-prev{border:1px dashed var(--line);border-radius:16px;padding:18px;background:var(--bg)}' +
    '.sx-pay{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sx-pay label{display:flex;gap:8px;align-items:center;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;font-weight:600;font-size:14px}.sx-pay label:has(input:checked){border-color:var(--gold);background:var(--goldbg)}' +
    '.sx-pos{border-top:1px solid var(--line2);padding:8px 0}.sx-pos summary{cursor:pointer;list-style:none;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:14px;min-height:32px}.sx-pos summary::before{content:"›";color:var(--gold);font-weight:700;display:inline-block;transition:transform .2s}.sx-pos[open] summary::before{transform:rotate(90deg)}' +
    '.sx-pos .sx-grid{padding:8px 0 4px 14px}.sx-lbl{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)}' +
    '.sx-prize{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}@media (max-width:560px){.sx-prize{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '.sx-warn{color:#B3261E;font-size:12.5px}.sx-ok{color:#2E8B5B;font-size:12.5px}' +
    '.sx-dept{border:1px solid var(--line);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:var(--card)}.sx-prow{display:grid;grid-template-columns:minmax(0,1fr) 172px 40px;gap:8px;align-items:center}' +
    '.sx-x{all:unset;cursor:pointer;width:40px;height:40px;display:grid;place-items:center;border-radius:10px;color:var(--muted)}.sx-x:hover{background:var(--line2)}.sx-x:disabled{opacity:.3;cursor:default}' +
    '@media (max-width:560px){.sx-prow{grid-template-columns:minmax(0,1fr) 110px 40px}}';
  document.head.appendChild(st);
})();

/* ---------- заставка: фирменный логотип с движением ---------- */
(function () {
  var p = sxJ(SX_PK, {}), on = p.splash_on !== false && p.splash_on !== 'false', motion = matchMedia('(prefers-reduced-motion: no-preference)').matches;
  var total = !on ? 250 : (p.splash_len === 'short' ? 1600 : 2700); if (!motion && on) total = 700;
  introLogo = function () { var sp = $('splash'); if (!sp || sp.querySelector('.ox')) return; SPLASH_T0 = Date.now(); sp.innerHTML = (on ? sxLockup('Команда отеля и ресторана в одном телефоне', motion) : '') + '<div class="spl-bar"><i></i></div>'; };
  introRun = function () { if (INTRO_P) return INTRO_P; introLogo(); INTRO_P = Promise.resolve(); return INTRO_P; };
  splashWait = function () { return (INTRO_P || Promise.resolve()).then(function () { var d = total - (Date.now() - SPLASH_T0); return new Promise(function (r) { setTimeout(r, Math.max(0, d)); }); }); };
})();

/* ---------- регистрация нового заведения ---------- */
var SX_TYPES = [['hotel', 'Отель', 'Номера, уборка, ресепшен, завтраки'], ['rest', 'Ресторан', 'Зал, кухня, бар, доставка'], ['cafe', 'Кафе или кофейня', 'Небольшая команда, смены'], ['chain', 'Сеть заведений', 'Несколько точек, один кабинет']];
var SX_HOTEL_ONLY = ['rooms', 'pms', 'roomcharge', 'breakfast', 'guestmem', 'lost'];
function sxSignup() {
  var st = { step: 1, type: 'rest', name: '', city: 'Ташкент', phone: '+998 ', n: 25 };
  var w = document.createElement('div'); w.className = 'sx-su'; w.id = 'sxSu'; document.body.appendChild(w);
  function price(n) { return Math.max(0, Math.round(n)); }
  function draw() {
    var start = sxToday(), end = sxAddDays(start, 30), n = price(st.n);
    var html = '<div class="sx-in">' + sxLockup('', st.step === 1 && !draw.done) + '<div class="sx-steps"><i class="on"></i><i class="' + (st.step > 1 ? 'on' : '') + '"></i><i class="' + (st.step > 2 ? 'on' : '') + '"></i></div>';
    if (st.step === 1) {
      html += '<h1 class="sx-h">Какое у вас заведение?</h1><p class="sx-sub">От этого зависит, какие разделы включатся сразу. Потом всё можно поменять в «Пульте».</p><div class="sx-types">' +
        SX_TYPES.map(function (t) { return '<button type="button" class="sx-type' + (st.type === t[0] ? ' on' : '') + '" data-ty="' + t[0] + '"><b>' + t[1] + '</b><span>' + t[2] + '</span></button>'; }).join('') + '</div>' +
        '<button class="btn dark full" id="sxN1">Дальше</button>';
    } else if (st.step === 2) {
      html += '<h1 class="sx-h">Расскажите о заведении</h1><p class="sx-sub">Эти данные увидят только вы и ваши сотрудники.</p>' +
        '<label class="f">Название<input class="in" id="sxName" placeholder="Например, «Чинор»" value="' + h(st.name) + '"></label>' +
        '<div class="sx-row"><label class="f">Город<input class="in" id="sxCity" value="' + h(st.city) + '"></label><label class="f">Телефон владельца<input class="in" id="sxPh" type="tel" value="' + h(st.phone) + '"></label></div>' +
        '<label class="f">Сколько сотрудников будут пользоваться<input class="in" id="sxCnt" type="number" min="1" max="2000" value="' + n + '"></label><input class="sx-range" id="sxRng" type="range" min="1" max="200" value="' + Math.min(200, n) + '" aria-label="Число сотрудников">' +
        '<div class="sx-row"><button class="btn ghost" id="sxB2">Назад</button><button class="btn dark" id="sxN2">Посмотреть цену</button></div>';
    } else {
      html += '<h1 class="sx-h">Ваша цена</h1><div class="sx-price"><span class="sx-free">Первый месяц бесплатно</span>' +
        '<div class="sx-big">$' + n + ' <small>в месяц · ' + n + ' ' + sxPl(n, 'сотрудник', 'сотрудника', 'сотрудников') + ' × $1</small></div>' +
        '<div class="muted" style="font-size:14px">≈ ' + money(n * SX_RATE) + ' сум по курсу ЦБ 11 966 сум за $1</div>' +
        '<div style="font-size:14px">Бесплатно до <b>' + sxDate(sxAddDays(start, 29)) + '</b>. Первый платёж — <b>' + sxDate(end) + '</b>.</div>' +
        '<ul class="sx-ul"><li>Платите только за тех, кто заходил в приложение в этом месяце.</li><li>Уволили сотрудника — со следующего месяца он не считается.</li><li>Оплата через Payme, Click или счёт для перечисления от ООО.</li><li>Без договора на год: отключиться можно в любой день.</li></ul></div>' +
        '<div class="sx-row"><button class="btn ghost" id="sxB3">Назад</button><button class="btn gold" id="sxGo">Создать кабинет</button></div>' +
        '<p class="sx-sub" style="margin:0;font-size:12.5px">В демо кабинет откроется с учебными данными отеля, а выбранные настройки сохранятся.</p>';
    }
    w.innerHTML = html + '</div>'; draw.done = true;
    w.querySelectorAll('[data-ty]').forEach(function (b) { b.onclick = function () { st.type = b.getAttribute('data-ty'); draw(); }; });
    function keep() { if ($('sxName')) { st.name = $('sxName').value.trim(); st.city = $('sxCity').value.trim(); st.phone = $('sxPh').value.trim(); st.n = +$('sxCnt').value || 1; } }
    if ($('sxN1')) $('sxN1').onclick = function () { st.step = 2; draw(); };
    if ($('sxRng')) { $('sxRng').oninput = function () { $('sxCnt').value = this.value; }; $('sxCnt').oninput = function () { $('sxRng').value = Math.min(200, +this.value || 1); }; }
    if ($('sxB2')) $('sxB2').onclick = function () { keep(); st.step = 1; draw(); };
    if ($('sxN2')) $('sxN2').onclick = function () { keep(); if (!st.name) { $('sxName').focus(); return toast('Укажите название заведения'); } st.step = 3; draw(); };
    if ($('sxB3')) $('sxB3').onclick = function () { st.step = 2; draw(); };
    if ($('sxGo')) $('sxGo').onclick = function () {
      var all = sxJ(SX_PK, {});
      Object.assign(all, { org_name: st.name, org_type: st.type, org_city: st.city, org_phone: st.phone, org_staff_plan: st.n, modules_off: st.type === 'hotel' ? [] : SX_HOTEL_ONLY.slice() });
      sxLS(SX_PK, JSON.stringify(all)); sxLS(SX_START, sxToday()); sxLS('mlx-one-new', '1');
      location.hash = 'as=bekzod.a'; location.reload();
    };
    window.scrollTo(0, 0);
  }
  draw();
}
function sxPl(n, a, b, c) { var m = n % 10, k = n % 100; return m === 1 && k !== 11 ? a : m >= 2 && m <= 4 && (k < 10 || k >= 20) ? b : c; }
if (/signup/.test(location.hash || '')) { if (document.body) sxSignup(); else document.addEventListener('DOMContentLoaded', sxSignup); }
(function () {
  if (sxLS('mlx-one-new') !== '1') return;
  var t = setInterval(function () { if (!S.me || S.loading) return; clearInterval(t); sxLS('mlx-one-new', null); var p = sxJ(SX_PK, {});
    S.sub.desk = 'bill'; go('desk'); toast('Кабинет «' + (p.org_name || 'заведение') + '» создан. Бесплатно до ' + sxDate(sxAddDays(sxStart(), 29)), 5000); }, 300);
})();

/* ---------- модули: выключенные разделы скрываются у всех ---------- */
(function () {
  var s0 = sections;
  sections = function () { var off = P('modules_off', []) || []; var out = s0.apply(this, arguments); return off.length ? out.filter(function (s) { return off.indexOf(s[0]) < 0; }) : out; };
})();

/* ---------- новые группы в «Настройках приложения» ---------- */
(function () {
  var g0 = prefGroups, c0 = prefCtl;
  prefCtl = function (it, v) {
    var id = 'pf_' + it.k;
    if (it.tx) return '<input class="in pfin" id="' + id + '" data-pk="' + it.k + '" value="' + h(v) + '"' + (it.ph ? ' placeholder="' + h(it.ph) + '"' : '') + '>';
    if (it.num) return '<input class="in pfin" type="number" style="width:110px" id="' + id + '" data-pk="' + it.k + '" min="' + (it.min || 0) + '" max="' + (it.max || 999999) + '" value="' + h(v) + '">';
    return c0(it, v);
  };
  prefGroups = function () {
    var o = function (a, u) { return a.map(function (x) { return [x, x + (u || '')]; }); };
    return g0().concat([
      { t: '🧠 Тест дня', i: [
        { k: 'quiz_on', t: 'Тест дня включён', b: 1, d: true },
        { k: 'quiz_count', t: 'Вопросов в день', o: o([5, 10, 15, 20]), d: 10 },
        { k: 'quiz_open', t: 'Открывается в', tm: 1, d: '08:00' },
        { k: 'quiz_close', t: 'Закрывается в', tm: 1, d: '23:00' },
        { k: 'quiz_sec', t: 'Время на один вопрос', o: [[0, 'Без ограничения'], [15, '15 сек'], [30, '30 сек'], [60, '1 мин']], d: 30 },
        { k: 'quiz_points', t: 'Очков за правильный ответ', o: o([5, 10, 20]), d: 10 },
        { k: 'quiz_lang', t: 'Язык вопросов', o: [['user', 'Как у сотрудника'], ['ru', 'Только русский'], ['uz', 'Только узбекский'], ['both', 'Оба языка сразу']], d: 'user' },
        { k: 'quiz_shuffle', t: 'Перемешивать варианты ответов', b: 1, d: true },
        { k: 'quiz_show_right', t: 'Показывать правильный ответ после теста', b: 1, d: true },
        { k: 'quiz_repeat_days', t: 'Не повторять вопрос раньше чем через', o: [[7, '7 дней'], [14, '14 дней'], [30, '30 дней']], d: 14 },
        { k: 'quiz_for_off', t: 'Тест доступен в выходной', b: 1, d: false }
      ] },
      { t: '📸 Фото-проверки открытия и закрытия', i: [
        { k: 'ph_open', t: 'Фото при открытии смены', b: 1, d: true, h: 'Зал, бар, касса, кухня — список точек задаёт руководитель службы' },
        { k: 'ph_close', t: 'Фото при закрытии смены', b: 1, d: true },
        { k: 'ph_digest1', t: 'Утренняя сводка фото в', tm: 1, d: '09:00' },
        { k: 'ph_digest2', t: 'Вечерняя сводка фото в', tm: 1, d: '23:30' },
        { k: 'ph_late_min', t: 'Фото не сдано — напомнить через', o: o([10, 15, 30], ' мин'), d: 15 },
        { k: 'ph_miss_to', t: 'Фото так и не сдано — сообщить', o: [['lead', 'Руководителю службы'], ['director', 'Директору'], ['both', 'Обоим']], d: 'lead' },
        { k: 'ph_keep', t: 'Хранить фото', o: [[30, '30 дней'], [90, '90 дней'], [365, '1 год']], d: 90 },
        { k: 'ph_gallery', t: 'Разрешить фото из галереи', b: 1, d: false, h: 'Выключено — только снимок камерой в момент проверки' }
      ] },
      { t: '🔒 Доступ и безопасность', i: [
        { k: 'sec_login', t: 'Вход сотрудников', o: [['pass', 'Логин и пароль'], ['tg', 'Код в Telegram'], ['both', 'Пароль или код в Telegram']], d: 'pass' },
        { k: 'sec_pw_days', t: 'Менять пароль каждые', o: [[0, 'Не требовать'], [90, '90 дней'], [180, '180 дней']], d: 0 },
        { k: 'sec_idle_h', t: 'Выходить из приложения после бездействия', o: [[0, 'Никогда'], [8, '8 часов'], [24, '1 сутки'], [168, '7 дней']], d: 0 },
        { k: 'sec_phones', t: 'Кто видит телефоны сотрудников', o: [['all', 'Все сотрудники'], ['leads', 'Руководители'], ['director', 'Только директор']], d: 'leads' },
        { k: 'sec_salary', t: 'Кто видит заработок сотрудников', o: [['self', 'Каждый только свой'], ['leads', 'Свой + руководитель службы'], ['director', 'Свой + только директор']], d: 'leads' },
        { k: 'sec_export', t: 'Кто может выгружать отчёты в Excel', o: [['director', 'Только директор'], ['leads', 'Директор и руководители']], d: 'director' }
      ] },
      { t: '🧾 Отчёты владельцу', i: [
        { k: 'rep_daily', t: 'Ежедневный отчёт', b: 1, d: true },
        { k: 'rep_daily_t', t: 'Присылать в', tm: 1, d: '22:00' },
        { k: 'rep_week', t: 'Недельный отчёт', o: [['off', 'Выключен'], ['1', 'В понедельник'], ['5', 'В пятницу'], ['7', 'В воскресенье']], d: '1' },
        { k: 'rep_month', t: 'Месячный отчёт 1-го числа', b: 1, d: true },
        { k: 'rep_where', t: 'Куда присылать', o: [['app', 'В приложение'], ['tg', 'В Telegram'], ['both', 'В приложение и Telegram']], d: 'both' },
        { k: 'rep_money', t: 'Показывать деньги в отчётах', b: 1, d: true, h: 'Выручка, заработок сотрудников, списания' }
      ] },
      { t: '💬 Telegram', i: [
        { k: 'tg_dup', t: 'Дублировать уведомления в Telegram', b: 1, d: true },
        { k: 'tg_chat', t: 'Общий чат команды', tx: 1, d: '', ph: 't.me/…' },
        { k: 'tg_news', t: 'Объявления публиковать и в чат', b: 1, d: false },
        { k: 'tg_bday', t: 'Поздравления с днём рождения в чат', b: 1, d: true }
      ] }
    ]);
  };
})();

/* ---------- «Пульт»: новые вкладки ---------- */
var SX_TABS = [['att', 'Приход и уход'], ['tasks', 'Задачи'], ['month', 'Табель месяца'], ['staff', 'Персонал'], ['map', 'Карта сотрудников'], ['face', 'Телефоны'], ['rep', 'Отчёты'],
  ['org', 'Заведение'], ['brand', 'Оформление'], ['bill', 'Подписка'], ['earn', 'Заработок'], ['award', 'Рейтинг и награды'], ['roles', 'Отделы и должности'], ['prefs', 'Настройки приложения'], ['set', 'Настройки отметки']];
vDesk = function () {
  if (!isDirector()) return go('home');
  var tab = S.sub.desk || 'att';
  if (!SX_TABS.some(function (t) { return t[0] === tab; })) tab = 'att';
  var m = $('main');
  m.innerHTML = '<div class="seg" style="overflow-x:auto" id="sxSeg">' + SX_TABS.map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '" style="white-space:nowrap">' + t[1] + '</button>'; }).join('') + '</div><div id="dk"><div class="empty">Загрузка…</div></div>';
  m.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { S.sub.desk = b.getAttribute('data-tab'); vDesk(); }; });
  var on = m.querySelector('#sxSeg .on'); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  ({ att: dAtt, map: dMap, tasks: dTasks, month: dMonth, staff: dStaff, rep: dReports, face: dDevices, set: dSet, prefs: dPrefs, org: sxOrg, brand: sxBrand, bill: sxBill, earn: sxEarn, award: sxAward, roles: sxRolesTab })[tab]();
};
async function sxSave(p, msg) {
  var r = await sb.rpc('prefs_save', { p: p });
  if (r.error) return toast(err(r.error));
  if (r.data) S.prefs = r.data; else S.prefs = Object.assign(S.prefs || {}, p);
  toast(msg || 'Сохранено');
}
function sxIn(id, v, attrs) { return '<input class="in sx-in2" id="' + id + '" value="' + h(v == null ? '' : v) + '"' + (attrs || '') + '>'; }
function sxSel(id, opts, v) { return '<select class="in sx-in2" id="' + id + '">' + opts.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join('') + '</select>'; }
function sxSw(id, on) { return '<label class="sw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span></span></label>'; }
function sxRow(t, ctl, hint) { return '<div class="pfrow"><div class="grow"><div class="pft">' + t + '</div>' + (hint ? '<div class="meta">' + hint + '</div>' : '') + '</div>' + ctl + '</div>'; }
function sxSaveBar(id, t) { return '<div class="pfsave"><button class="btn dark full" id="' + id + '">' + (t || 'Сохранить') + '</button></div>'; }
function sxActive() { return (S.emps || []).filter(function (e) { return e.active !== false; }); }

/* --- Заведение --- */
async function sxOrg() {
  await loadPrefs();
  var box = $('dk'), hrs = P('org_hours', null) || {}, br = (P('org_branches', null) || [{ n: P('org_name', 'Mir Luxe Plaza'), a: 'Ташкент, Мирабадский район', main: true }]).slice(), off = (P('modules_off', []) || []).slice();
  var DAYS = [['1', 'Пн'], ['2', 'Вт'], ['3', 'Ср'], ['4', 'Чт'], ['5', 'Пт'], ['6', 'Сб'], ['7', 'Вс']];
  function draw() {
    var html = '<div class="note t-info" style="margin-bottom:10px">Всё о вашем заведении: как оно называется, когда работает, какие разделы нужны. Изменения сразу видят все сотрудники.</div><div class="dgrid"><div style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="card pfcard"><h2>Профиль заведения</h2><div class="sx-grid">' +
      '<label class="sx-lbl">Название' + sxIn('oName', P('org_name', 'Mir Luxe Plaza')) + '</label>' +
      '<label class="sx-lbl">Тип' + sxSel('oType', SX_TYPES.map(function (t) { return [t[0], t[1]]; }), P('org_type', 'hotel')) + '</label>' +
      '<label class="sx-lbl">Город' + sxIn('oCity', P('org_city', 'Ташкент')) + '</label>' +
      '<label class="sx-lbl">Адрес' + sxIn('oAddr', P('org_addr', 'Мирабадский район')) + '</label>' +
      '<label class="sx-lbl">Телефон' + sxIn('oPh', P('org_phone', '+998 '), ' type="tel"') + '</label>' +
      '<label class="sx-lbl">Почта для счетов' + sxIn('oMail', P('org_email', ''), ' type="email" placeholder="buh@…"') + '</label>' +
      '<label class="sx-lbl">ИНН' + sxIn('oInn', P('org_inn', ''), ' inputmode="numeric" placeholder="9 цифр"') + '</label>' +
      '<label class="sx-lbl">Часовой пояс' + sxSel('oTz', [['Asia/Tashkent', 'Ташкент, UTC+5'], ['Asia/Samarkand', 'Самарканд, UTC+5'], ['Asia/Almaty', 'Алматы, UTC+5']], P('org_tz', 'Asia/Tashkent')) + '</label>' +
      '<label class="sx-lbl">Деньги показывать в' + sxSel('oCur', [['uzs', 'сумах'], ['usd', 'долларах'], ['both', 'сумах и долларах']], P('org_cur', 'uzs')) + '</label>' +
      '<label class="sx-lbl">Язык приложения по умолчанию' + sxSel('oLang', [['user', 'Сотрудник выбирает сам'], ['ru', 'Русский'], ['uz', 'Oʻzbekcha']], P('org_lang', 'user')) + '</label>' +
      '<label class="sx-lbl">Неделя начинается с' + sxSel('oWk', [['1', 'понедельника'], ['7', 'воскресенья']], P('org_week', '1')) + '</label>' +
      '<label class="sx-lbl">Формат даты' + sxSel('oDf', [['dmy', '23.10.2026'], ['dm', '23 окт']], P('org_datef', 'dmy')) + '</label>' +
      '</div></div>' +
      '<div class="card pfcard"><h2>Часы работы</h2><div class="meta" style="margin:-4px 0 6px">Для напоминаний, сводок и смен по умолчанию</div>' + DAYS.map(function (d) {
        var x = hrs[d[0]] || { on: true, f: d[0] === '7' ? '10:00' : '08:00', t: '23:00' };
        return '<div class="sx-day"><b>' + d[1] + '</b>' + sxSw('oD' + d[0], x.on) + '<input class="in sx-in2" type="time" id="oF' + d[0] + '" value="' + x.f + '" aria-label="' + d[1] + ' с"><input class="in sx-in2" type="time" id="oT' + d[0] + '" value="' + x.t + '" aria-label="' + d[1] + ' до"></div>';
      }).join('') + '</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="card pfcard"><h2>Филиалы</h2><div class="meta" style="margin:-4px 0 6px">У каждого филиала своя точка на карте и свои смены. Подписка считается по сотрудникам всех филиалов вместе.</div>' +
      br.map(function (b, i) { return '<div class="sx-prow" style="padding:6px 0;border-top:1px solid var(--line2);grid-template-columns:minmax(0,1fr) auto 40px"><div class="sx-grid"><input class="in sx-in2" data-bn="' + i + '" value="' + h(b.n) + '" aria-label="Название филиала"><input class="in sx-in2" data-ba="' + i + '" value="' + h(b.a) + '" aria-label="Адрес филиала"></div><span class="meta">' + (b.main ? 'основной' : '') + '</span><button class="sx-x" data-bx="' + i + '"' + (b.main ? ' disabled' : '') + ' aria-label="Удалить филиал">✕</button></div>'; }).join('') +
      '<button class="btn ghost full" id="oBr" style="margin-top:8px">+ Добавить филиал</button></div>' +
      '<div class="card pfcard"><h2>Разделы заведения</h2><div class="meta" style="margin:-4px 0 6px">Снимите галочку — раздел пропадёт у всех, включая вас. Для ресторана и кафе гостиничные разделы выключены сразу.</div><div class="pfchips" style="padding-left:0">' +
      SECTION_LIST.map(function (s) { return '<label class="pfchk"><input type="checkbox" data-mod="' + s[0] + '"' + (off.indexOf(s[0]) < 0 ? ' checked' : '') + '> ' + h(s[1]) + '</label>'; }).join('') + '</div></div></div></div>' +
      sxSaveBar('oSave', 'Сохранить заведение');
    box.innerHTML = html;
    function grab() {
      box.querySelectorAll('[data-bn]').forEach(function (el) { br[+el.getAttribute('data-bn')].n = el.value; });
      box.querySelectorAll('[data-ba]').forEach(function (el) { br[+el.getAttribute('data-ba')].a = el.value; });
      off = []; box.querySelectorAll('[data-mod]').forEach(function (el) { if (!el.checked) off.push(el.getAttribute('data-mod')); });
    }
    $('oBr').onclick = function () { grab(); br.push({ n: 'Новый филиал', a: '' }); draw(); };
    box.querySelectorAll('[data-bx]').forEach(function (b) { b.onclick = function () { grab(); br.splice(+b.getAttribute('data-bx'), 1); draw(); }; });
    $('oType').onchange = function () {
      grab(); var t = this.value;
      SX_HOTEL_ONLY.forEach(function (id) { var i = off.indexOf(id); if (t === 'hotel' && i >= 0) off.splice(i, 1); if (t !== 'hotel' && i < 0) off.push(id); });
      box.querySelectorAll('[data-mod]').forEach(function (el) { el.checked = off.indexOf(el.getAttribute('data-mod')) < 0; });
      toast(t === 'hotel' ? 'Гостиничные разделы включены' : 'Гостиничные разделы выключены — проверьте список');
    };
    $('oSave').onclick = async function () {
      grab(); var hh = {};
      DAYS.forEach(function (d) { hh[d[0]] = { on: $('oD' + d[0]).checked, f: $('oF' + d[0]).value, t: $('oT' + d[0]).value }; });
      if (!$('oName').value.trim()) return toast('Укажите название заведения');
      if ($('oInn').value && !/^\d{9}$/.test($('oInn').value.trim())) return toast('ИНН — 9 цифр');
      this.disabled = true;
      await sxSave({ org_name: $('oName').value.trim(), org_type: $('oType').value, org_city: $('oCity').value.trim(), org_addr: $('oAddr').value.trim(), org_phone: $('oPh').value.trim(), org_email: $('oMail').value.trim(), org_inn: $('oInn').value.trim(),
        org_tz: $('oTz').value, org_cur: $('oCur').value, org_lang: $('oLang').value, org_week: $('oWk').value, org_datef: $('oDf').value, org_hours: hh, org_branches: br, modules_off: off }, 'Заведение сохранено');
      this.disabled = false;
    };
  }
  draw();
}

/* --- Оформление --- */
async function sxBrand() {
  await loadPrefs();
  var box = $('dk'), logo = P('brand_logo', '');
  function draw() {
    var acc = P('brand_accent', 'gold');
    box.innerHTML = '<div class="dgrid"><div style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="card pfcard"><h2>Логотип и название</h2>' +
      sxRow('Логотип заведения', '<label class="btn ghost" style="cursor:pointer">Загрузить<input type="file" id="bFile" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></label>', 'PNG, JPG или SVG до 300 КБ. Без своего — знак Mir Luxe One') +
      (logo ? sxRow('Сейчас свой логотип', '<button class="btn ghost" id="bDel">Убрать</button>') : '') +
      '<label class="sx-lbl" style="margin-top:8px">Название на заставке и экране входа' + sxIn('bTitle', P('brand_title', 'Mir Luxe'), ' maxlength="22"') + '</label></div>' +
      '<div class="card pfcard"><h2>Фирменный цвет</h2><div class="meta" style="margin:-4px 0 8px">Кнопки, выделения и акценты во всём приложении</div><div class="sx-acc">' +
      SX_ACC.map(function (a) { return '<label><input type="radio" name="bAcc" value="' + a[0] + '"' + (acc === a[0] ? ' checked' : '') + '><i style="background:' + (a[2] || '#A57F35') + '"></i>' + a[1] + '</label>'; }).join('') + '</div></div>' +
      '<div class="card pfcard"><h2>Заставка при запуске</h2>' +
      sxRow('Показывать заставку с логотипом', sxSw('bSpl', P('splash_on', true) !== false && P('splash_on', true) !== 'false')) +
      sxRow('Длительность', sxSel('bLen', [['normal', 'Обычная, 2,7 сек'], ['short', 'Короткая, 1,6 сек']], P('splash_len', 'normal'))) +
      sxRow('Тема по умолчанию', sxSel('bTheme', [['auto', 'Как в телефоне'], ['light', 'Светлая'], ['dark', 'Тёмная']], P('theme_default', 'auto')), 'Сотрудник может сменить у себя в профиле') + '</div></div>' +
      '<div class="card pfcard"><h2>Как это выглядит</h2><div class="sx-prev" id="bPrev">' + sxLockup('Команда отеля и ресторана в одном телефоне', true) + '</div><button class="btn ghost full" id="bPlay" style="margin-top:10px">Проиграть заставку ещё раз</button></div></div>' +
      sxSaveBar('bSave', 'Сохранить оформление');
    function prev() { var p = Object.assign(sxJ(SX_PK, {}), { brand_title: $('bTitle').value, brand_logo: logo }); var keep = sxLS(SX_PK); sxLS(SX_PK, JSON.stringify(p)); $('bPrev').innerHTML = sxLockup('Команда отеля и ресторана в одном телефоне', true); sxLS(SX_PK, keep); }
    $('bPlay').onclick = prev; $('bTitle').oninput = prev;
    box.querySelectorAll('[name=bAcc]').forEach(function (r) { r.onchange = function () { sxApplyBrand(Object.assign({}, sxJ(SX_PK, {}), { brand_accent: r.value })); }; });
    $('bFile').onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 300 * 1024) return toast('Файл больше 300 КБ — уменьшите картинку');
      var rd = new FileReader(); rd.onload = function () { logo = rd.result; draw(); toast('Логотип загружен — не забудьте сохранить'); }; rd.readAsDataURL(f);
    };
    if ($('bDel')) $('bDel').onclick = function () { logo = ''; draw(); };
    $('bSave').onclick = async function () {
      this.disabled = true;
      var a = (box.querySelector('[name=bAcc]:checked') || {}).value || 'gold';
      await sxSave({ brand_title: $('bTitle').value.trim() || 'Mir Luxe', brand_logo: logo, brand_accent: a, splash_on: $('bSpl').checked, splash_len: $('bLen').value, theme_default: $('bTheme').value }, 'Оформление сохранено');
      this.disabled = false;
    };
  }
  draw();
}

/* --- Подписка --- */
async function sxBill() {
  await loadPrefs();
  var box = $('dk'), act = sxActive(), n = act.length, start = sxStart(), end = sxAddDays(start, 30), left = Math.max(0, Math.round((Date.parse(end) - Date.parse(sxToday())) / 864e5));
  var byDept = {}; act.forEach(function (e) { byDept[e.dept_id] = (byDept[e.dept_id] || 0) + 1; });
  var req = P('bill_req', null) || {}, meth = P('bill_method', 'payme');
  var html = '<div class="sx-kpi">' +
    '<div class="card"><div class="sx-kv">$' + n + '</div><div class="sx-kl">в месяц после бесплатного</div></div>' +
    '<div class="card"><div class="sx-kv">' + n + '</div><div class="sx-kl">активных сотрудников × $1</div></div>' +
    '<div class="card"><div class="sx-kv">' + left + '</div><div class="sx-kl">' + sxPl(left, 'день', 'дня', 'дней') + ' бесплатно осталось</div></div>' +
    '<div class="card"><div class="sx-kv">' + money(n * SX_RATE) + '</div><div class="sx-kl">сум в месяц по курсу ЦБ</div></div></div>' +
    '<div class="dgrid"><div style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="card pfcard"><h2>Тариф: $1 за сотрудника в месяц</h2><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:-2px 0 8px"><span class="chip t-ok">Бесплатный месяц</span><span class="meta">с ' + sxDate(start) + ' по ' + sxDate(sxAddDays(start, 29)) + '</span></div>' +
    '<ul class="sx-ul"><li>Первый платёж — <b>' + sxDate(end) + '</b>, сумма считается по сотрудникам, которые заходили в приложение в этом месяце.</li><li>Уволили или перевели в архив — со следующего месяца он не считается.</li><li>Все функции входят в тариф: тест дня, фото-проверки, заработок, рейтинг, пульт.</li><li>Отключиться можно в любой день, данные хранятся 90 дней.</li></ul></div>' +
    '<div class="card pfcard"><h2>Кого считаем</h2><div class="sx-wrap"><table class="sx-tbl"><thead><tr><th>Отдел</th><th class="r">Сотрудников</th><th class="r">В месяц</th></tr></thead><tbody>' +
    Object.keys(byDept).sort(function (a, b) { return byDept[b] - byDept[a]; }).map(function (d) { return '<tr><td>' + h(deptName(d)) + '</td><td class="r">' + byDept[d] + '</td><td class="r">$' + byDept[d] + '</td></tr>'; }).join('') +
    '<tr><td><b>Итого</b></td><td class="r"><b>' + n + '</b></td><td class="r"><b>$' + n + '</b></td></tr></tbody></table></div></div>' +
    '<div class="card pfcard"><h2>Платежи</h2><div class="sx-wrap"><table class="sx-tbl"><thead><tr><th>Месяц</th><th class="r">Сотрудников</th><th class="r">Сумма</th><th>Статус</th></tr></thead><tbody>' +
    '<tr><td>' + sxDate(start).replace(/^\d+ /, '') + '</td><td class="r">' + n + '</td><td class="r">$0</td><td><span class="chip t-ok">бесплатно</span></td></tr>' +
    [0, 1, 2].map(function (i) { var d = sxAddDays(end, i * 30); return '<tr><td>' + sxDate(d).replace(/^\d+ /, '') + '</td><td class="r">≈ ' + n + '</td><td class="r">$' + n + '</td><td><span class="chip t-info">ожидается ' + d.slice(8, 10) + '.' + d.slice(5, 7) + '</span></td></tr>'; }).join('') +
    '</tbody></table></div></div></div>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="card pfcard"><h2>Способ оплаты</h2><div class="sx-pay">' + [['payme', 'Payme'], ['click', 'Click'], ['uzum', 'Uzum Bank'], ['bank', 'Перечисление от ООО']].map(function (m) { return '<label><input type="radio" name="bM" value="' + m[0] + '"' + (meth === m[0] ? ' checked' : '') + '> ' + m[1] + '</label>'; }).join('') + '</div>' +
    sxRow('Списывать автоматически', sxSw('bAuto', P('bill_auto', true) !== false && P('bill_auto', true) !== 'false'), 'Payme, Click и Uzum — с привязанной карты') +
    sxRow('День оплаты', sxSel('bDay', [['start', 'В день начала подписки'], ['1', '1-го числа'], ['15', '15-го числа']], P('bill_day', 'start'))) +
    sxRow('Напомнить об оплате за', sxSel('bRem', [[1, '1 день'], [3, '3 дня'], [7, '7 дней']], P('bill_remind', 3))) +
    sxRow('Счёт и чек отправлять', sxSel('bTo', [['tg', 'В Telegram'], ['mail', 'На почту'], ['both', 'В Telegram и на почту']], P('bill_to', 'both'))) + '</div>' +
    '<div class="card pfcard"><h2>Реквизиты для счёта</h2><div class="meta" style="margin:-4px 0 8px">Нужны для оплаты перечислением и электронного счёта-фактуры</div><div class="sx-grid">' +
    '<label class="sx-lbl">Название организации' + sxIn('rN', req.n || '', ' placeholder="ООО «…»"') + '</label><label class="sx-lbl">ИНН' + sxIn('rI', req.i || P('org_inn', ''), ' inputmode="numeric"') + '</label>' +
    '<label class="sx-lbl">Расчётный счёт' + sxIn('rA', req.a || '', ' inputmode="numeric" placeholder="20 цифр"') + '</label><label class="sx-lbl">МФО банка' + sxIn('rM', req.m || '', ' inputmode="numeric" placeholder="5 цифр"') + '</label>' +
    '<label class="sx-lbl">Банк' + sxIn('rB', req.b || '') + '</label><label class="sx-lbl">Юридический адрес' + sxIn('rJ', req.j || '') + '</label></div></div>' +
    '<div class="card pfcard"><h2>Приостановить подписку</h2><div class="meta" style="margin:-4px 0 8px">Сотрудники потеряют доступ, данные сохранятся 90 дней. Вернуться можно в любой момент.</div><button class="btn ghostbad full" id="bStop">Приостановить</button></div>' +
    '</div></div>' + sxSaveBar('bSv', 'Сохранить оплату');
  box.innerHTML = html;
  $('bStop').onclick = async function () { if (await askSure('Приостановить подписку?', { ok: 'Приостановить', danger: true, sub: 'В демо ничего не отключится' })) toast('В рабочей версии доступ закроется в конце оплаченного месяца'); };
  $('bSv').onclick = async function () {
    var a = $('rA').value.replace(/\s/g, ''), mf = $('rM').value.trim();
    if (a && !/^\d{20}$/.test(a)) return toast('Расчётный счёт — 20 цифр');
    if (mf && !/^\d{5}$/.test(mf)) return toast('МФО — 5 цифр');
    this.disabled = true;
    await sxSave({ bill_method: (box.querySelector('[name=bM]:checked') || {}).value || 'payme', bill_auto: $('bAuto').checked, bill_day: $('bDay').value, bill_remind: +$('bRem').value, bill_to: $('bTo').value,
      bill_req: { n: $('rN').value.trim(), i: $('rI').value.trim(), a: a, m: mf, b: $('rB').value.trim(), j: $('rJ').value.trim() } }, 'Оплата сохранена');
    this.disabled = false;
  };
}

/* --- Заработок --- */
var SX_EARN = [['salary', 'Только оклад'], ['pct', 'Оклад + % от выручки'], ['unit', 'Оклад + за единицу работы'], ['hour', 'Почасовая оплата']];
var SX_BASES = [['own', 'выручка его столов / чеков'], ['bar', 'выручка бара'], ['kitchen', 'выручка кухни'], ['hall', 'выручка всего зала'], ['extra', 'продажи допуслуг'], ['direct', 'прямые брони']];
function sxEarnDefault(p) {
  var n = (p.name || '').toLowerCase();
  if (/официант/.test(n)) return { m: 'pct', s: 3000000, r: 5, b: 'own', show: true };
  if (/бармен/.test(n)) return { m: 'pct', s: 3200000, r: 4, b: 'bar', show: true };
  if (/повар|шеф/.test(n)) return { m: 'pct', s: 4500000, r: 1, b: 'kitchen', show: true };
  if (/горничн/.test(n)) return { m: 'unit', s: 2800000, u: 'убранный номер', up: 10000, show: true };
  if (/продаж|брон/.test(n)) return { m: 'pct', s: 5000000, r: 1, b: 'direct', show: true };
  return { m: 'salary', s: 4000000, show: true };
}
async function sxEarn() {
  await loadPrefs();
  var box = $('dk'), rules = Object.assign({}, P('earn_rules', null) || {});
  var poss = S.pos.filter(function (p) { return p.access !== 'director'; });
  function rule(p) { return rules[p.id] || sxEarnDefault(p); }
  function draw() {
    var html = '<div class="note t-info" style="margin-bottom:10px">Правило для каждой должности. Сотрудник видит свой заработок за смену в течение дня — это главный повод открывать приложение.</div>' +
      '<div class="dgrid"><div class="card pfcard"><h2>Правила по должностям</h2><div class="meta" style="margin:-4px 0 6px">Нажмите на должность, чтобы изменить</div>' +
      poss.map(function (p) {
        var r = rule(p), sum = r.m === 'salary' ? 'оклад ' + money(r.s) + ' сум' : r.m === 'pct' ? money(r.s) + ' + ' + r.r + '%' : r.m === 'unit' ? money(r.s) + ' + ' + money(r.up) + ' за ' + (r.u || 'единицу') : money(r.ph || 25000) + ' сум/час';
        return '<details class="sx-pos" data-p="' + p.id + '"><summary><b>' + h(p.name) + '</b> <span class="meta">' + h(deptName(p.dept_id)) + ' · ' + h(sum) + '</span></summary><div class="sx-grid">' +
          '<label class="sx-lbl">Как платим' + sxSel('em' + p.id, SX_EARN, r.m) + '</label>' +
          (r.m === 'hour' ? '<label class="sx-lbl">Ставка в час, сум' + sxIn('eh' + p.id, r.ph || 25000, ' type="number" min="0" step="1000"') + '</label>' : '<label class="sx-lbl">Оклад в месяц, сум' + sxIn('es' + p.id, r.s, ' type="number" min="0" step="100000"') + '</label>') +
          (r.m === 'pct' ? '<label class="sx-lbl">Процент' + sxIn('er' + p.id, r.r, ' type="number" min="0" max="50" step="0.5"') + '</label><label class="sx-lbl">От чего считаем' + sxSel('eb' + p.id, SX_BASES, r.b || 'own') + '</label>' : '') +
          (r.m === 'unit' ? '<label class="sx-lbl">Единица работы' + sxIn('eu' + p.id, r.u || 'убранный номер') + '</label><label class="sx-lbl">Сумма за единицу, сум' + sxIn('ep' + p.id, r.up || 10000, ' type="number" min="0" step="1000"') + '</label>' : '') +
          '<label class="pfchk" style="grid-column:1/-1"><input type="checkbox" id="ev' + p.id + '"' + (r.show !== false ? ' checked' : '') + '> Показывать сотруднику заработок за день</label></div></details>';
      }).join('') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:12px"><div class="card pfcard"><h2>Общие правила</h2>' +
      sxRow('Удержание за опоздание', sxSel('eLate', [['none', 'Не удерживать'], ['min', 'За каждую минуту'], ['fix', 'Фиксированная сумма']], P('earn_late_mode', 'none'))) +
      sxRow('Сумма удержания, сум', '<input class="in pfin" type="number" style="width:120px" id="eLateS" min="0" step="1000" value="' + h(P('earn_late_sum', 2000)) + '">', 'За минуту или за одно опоздание') +
      sxRow('Бонус за тест дня 10 из 10, сум', '<input class="in pfin" type="number" style="width:120px" id="eQuiz" min="0" step="1000" value="' + h(P('earn_quiz_bonus', 10000)) + '">') +
      sxRow('Бонус за все фото-проверки вовремя за месяц, сум', '<input class="in pfin" type="number" style="width:120px" id="ePh" min="0" step="10000" value="' + h(P('earn_photo_bonus', 100000)) + '">') +
      sxRow('Выплата', sxSel('ePay', [['month', 'Раз в месяц'], ['twice', 'Аванс и зарплата'], ['week', 'Каждую неделю'], ['day', 'После каждой смены']], P('earn_pay_mode', 'twice'))) +
      sxRow('Аванс', sxSel('eAdv', [[10, '10-го числа'], [15, '15-го числа'], [20, '20-го числа']], P('earn_adv_day', 15))) +
      sxRow('Зарплата', sxSel('eSal', [[1, '1-го числа'], [5, '5-го числа'], [10, '10-го числа']], P('earn_sal_day', 5))) +
      sxRow('Выручку смены брать', sxSel('eSrc', [['manual', 'Вносит менеджер в конце смены'], ['pos', 'Из кассы (iiko, Poster, R-Keeper)'], ['pms', 'Из PMS отеля']], P('earn_src', 'manual'))) + '</div>' +
      '<div class="card pfcard"><h2>Пример: официант за смену</h2><div id="eEx"></div></div></div></div>' + sxSaveBar('eSave', 'Сохранить правила');
    box.innerHTML = html;
    var ex = poss.filter(function (p) { return /официант/i.test(p.name); })[0] || poss[0];
    function example() { var r = collect(ex.id) || rule(ex), rev = 9840000, base = Math.round(r.s / 26), add = r.m === 'pct' ? rev * r.r / 100 : r.m === 'unit' ? 12 * r.up : 0;
      $('eEx').innerHTML = '<div class="sx-wrap"><table class="sx-tbl"><tbody><tr><td>Оклад за смену (из 26)</td><td class="r">' + money(base) + '</td></tr>' + (r.m === 'pct' ? '<tr><td>' + r.r + '% от ' + money(rev) + ' сум</td><td class="r">' + money(add) + '</td></tr>' : '') + (r.m === 'unit' ? '<tr><td>12 × ' + money(r.up) + ' сум</td><td class="r">' + money(add) + '</td></tr>' : '') +
        '<tr><td>Тест дня 10 из 10</td><td class="r">' + money(+$('eQuiz').value || 0) + '</td></tr><tr><td><b>Итого за смену</b></td><td class="r"><b>' + money(base + add + (+$('eQuiz').value || 0)) + ' сум</b></td></tr></tbody></table></div><div class="meta" style="margin-top:6px">' + h(ex.name) + ', учебные цифры</div>'; }
    function collect(id) { var m = $('em' + id); if (!m) return null; var r = { m: m.value, show: $('ev' + id).checked };
      if ($('es' + id)) r.s = +$('es' + id).value || 0; if ($('eh' + id)) { r.ph = +$('eh' + id).value || 0; r.s = 0; }
      if ($('er' + id)) { r.r = +$('er' + id).value || 0; r.b = $('eb' + id).value; } if ($('eu' + id)) { r.u = $('eu' + id).value.trim(); r.up = +$('ep' + id).value || 0; } return r; }
    box.querySelectorAll('[id^=em]').forEach(function (s) { s.onchange = function () { var id = s.id.slice(2); var cur = collect(id); var r = Object.assign(sxEarnDefault(S.pos.filter(function (p) { return String(p.id) === id; })[0] || {}), cur, { m: s.value });
      rules[id] = r; draw(); var d = box.querySelector('[data-p="' + id + '"]'); if (d) d.open = true; }; });
    box.addEventListener('input', example); example();
    $('eSave').onclick = async function () {
      poss.forEach(function (p) { var r = collect(p.id); if (r) rules[p.id] = r; });
      this.disabled = true;
      await sxSave({ earn_rules: rules, earn_late_mode: $('eLate').value, earn_late_sum: +$('eLateS').value || 0, earn_quiz_bonus: +$('eQuiz').value || 0, earn_photo_bonus: +$('ePh').value || 0, earn_pay_mode: $('ePay').value, earn_adv_day: +$('eAdv').value, earn_sal_day: +$('eSal').value, earn_src: $('eSrc').value }, 'Правила заработка сохранены');
      this.disabled = false;
    };
  }
  draw();
}

/* --- Рейтинг и награды --- */
async function sxAward() {
  await loadPrefs();
  var box = $('dk'), pr = (P('award_prizes', null) || [500000, 300000, 200000, 120000, 100000, 80000, 60000, 50000, 40000, 30000]).slice(), w = Object.assign({ disc: 40, task: 40, quiz: 20 }, P('award_w', null) || {}), ex = (P('award_excl', null) || []).slice();
  var poss = S.pos.filter(function (p) { return p.access !== 'director'; });
  box.innerHTML = '<div class="note t-info" style="margin-bottom:10px">Очки сравниваются внутри своей должности. Поэтому у ресепшена с множеством мелких задач нет преимущества перед поваром или охранником.</div><div class="dgrid"><div style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="card pfcard"><h2>Как считаем очки</h2>' +
    sxRow('Дисциплина: приход вовремя, отметки, фото', '<input class="in pfin" type="number" style="width:90px" id="aD" min="0" max="100" value="' + w.disc + '">', '% от итога') +
    sxRow('Задачи: сделано вовремя', '<input class="in pfin" type="number" style="width:90px" id="aT" min="0" max="100" value="' + w.task + '">', '% от итога') +
    sxRow('Тест дня', '<input class="in pfin" type="number" style="width:90px" id="aQ" min="0" max="100" value="' + w.quiz + '">', '% от итога') +
    '<div id="aSum" class="sx-ok" style="padding:4px 0 8px"></div>' +
    sxRow('Сравнивать только внутри своей должности', sxSw('aRole', P('award_in_role', true) !== false && P('award_in_role', true) !== 'false')) +
    sxRow('Период рейтинга', sxSel('aPer', [['week', 'Неделя'], ['month', 'Месяц']], P('award_period', 'month'))) +
    sxRow('Участвует, если отработал не меньше', sxSel('aMin', [[3, '3 смен'], [5, '5 смен'], [10, '10 смен'], [15, '15 смен']], P('rating_min_shifts', 5))) +
    sxRow('Кто видит рейтинг', sxSel('aVis', [['all', 'Все видят всех'], ['top', 'Все видят топ-10 и своё место'], ['self', 'Каждый только своё место']], P('award_visible', 'top'))) + '</div>' +
    '<div class="card pfcard"><h2>Кто не участвует</h2><div class="meta" style="margin:-4px 0 6px">Например, руководители служб</div><div class="pfchips" style="padding-left:0">' +
    poss.map(function (p) { return '<label class="pfchk"><input type="checkbox" data-ex="' + p.id + '"' + (ex.indexOf(p.id) >= 0 || ex.indexOf(String(p.id)) >= 0 ? ' checked' : '') + '> ' + h(p.name) + '</label>'; }).join('') + '</div></div></div>' +
    '<div style="display:flex;flex-direction:column;gap:12px"><div class="card pfcard"><h2>Награды топ-10, сум</h2><div class="meta" style="margin:-4px 0 8px">Чем выше место, тем больше награда</div><div class="sx-prize">' +
    pr.map(function (v, i) { return '<label class="sx-lbl">' + (i + 1) + ' место<input class="in sx-in2" type="number" min="0" step="10000" data-pr="' + i + '" value="' + v + '"></label>'; }).join('') + '</div><div id="aFund" style="margin-top:10px;font-size:14px"></div></div>' +
    '<div class="card pfcard"><h2>Как вручаем</h2>' +
    sxRow('Вид награды', sxSel('aKind', [['money', 'Деньги к зарплате'], ['gift', 'Подарок или сертификат'], ['day', 'Дополнительный выходной'], ['mix', 'Топ-3 деньги, остальные — подарок']], P('award_kind', 'money'))) +
    sxRow('Объявлять победителей', sxSel('aAnn', [['news', 'В объявлениях приложения'], ['chat', 'В чате команды'], ['both', 'Везде'], ['none', 'Не объявлять']], P('award_announce', 'news'))) +
    sxRow('Подводить итоги', sxSel('aWhen', [['last', 'В последний день периода'], ['first', 'В первый день следующего']], P('award_when', 'last'))) + '</div></div></div>' + sxSaveBar('aSave', 'Сохранить рейтинг');
  function check() {
    var s = (+$('aD').value || 0) + (+$('aT').value || 0) + (+$('aQ').value || 0), el = $('aSum');
    el.className = s === 100 ? 'sx-ok' : 'sx-warn'; el.textContent = s === 100 ? 'Сумма 100% — всё верно' : 'Сумма ' + s + '% — должна быть 100%';
    var v = [].map.call(box.querySelectorAll('[data-pr]'), function (x) { return +x.value || 0; }), bad = v.some(function (x, i) { return i && x > v[i - 1]; }), tot = v.reduce(function (a, b) { return a + b; }, 0);
    $('aFund').innerHTML = 'Фонд наград за период: <b>' + money(tot) + ' сум</b> ≈ $' + Math.round(tot / SX_RATE) + (bad ? '<div class="sx-warn">Награда за место ниже не должна быть больше, чем за место выше</div>' : '');
    return s === 100 && !bad;
  }
  box.addEventListener('input', check); check();
  $('aSave').onclick = async function () {
    if (!check()) return toast('Проверьте проценты и награды');
    var exl = []; box.querySelectorAll('[data-ex]').forEach(function (el) { if (el.checked) exl.push(el.getAttribute('data-ex')); });
    this.disabled = true;
    await sxSave({ award_w: { disc: +$('aD').value, task: +$('aT').value, quiz: +$('aQ').value }, award_in_role: $('aRole').checked, award_period: $('aPer').value, rating_min_shifts: +$('aMin').value, award_visible: $('aVis').value,
      award_prizes: [].map.call(box.querySelectorAll('[data-pr]'), function (x) { return +x.value || 0; }), award_excl: exl, award_kind: $('aKind').value, award_announce: $('aAnn').value, award_when: $('aWhen').value }, 'Рейтинг сохранён');
    this.disabled = false;
  };
}

/* --- Отделы и должности --- */
var SX_ACCESS = [['staff', 'Сотрудник'], ['manager', 'Руководитель']];
function sxRolesTab() {
  var box = $('dk');
  function cnt(pid) { return (S.emps || []).filter(function (e) { return e.position_id === pid && e.active !== false; }).length; }
  function draw() {
    var depts = S.depts.filter(function (d) { return d.id !== 'dir'; });
    box.innerHTML = '<div class="note t-info" style="margin-bottom:10px">Назовите отделы и должности так, как принято у вас. Уровень доступа решает, видит ли человек свою команду и пульт службы. Удалить можно только должность без сотрудников.</div>' +
      '<div class="dgrid" style="align-items:start">' + depts.map(function (d) {
        var ps = S.pos.filter(function (p) { return p.dept_id === d.id; });
        return '<div class="sx-dept"><label class="sx-lbl">Отдел<input class="in sx-in2" data-dn="' + h(d.id) + '" value="' + h(d.name) + '"></label>' +
          ps.map(function (p) { var c = cnt(p.id); return '<div class="sx-prow"><input class="in sx-in2" data-pn="' + p.id + '" value="' + h(p.name) + '" aria-label="Должность"><select class="in sx-in2" data-pa="' + p.id + '" aria-label="Доступ">' + SX_ACCESS.map(function (a) { return '<option value="' + a[0] + '"' + (p.access === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select><button class="sx-x" data-px="' + p.id + '"' + (c ? ' disabled title="Есть сотрудники: ' + c + '"' : '') + ' aria-label="Удалить должность">✕</button></div>'; }).join('') +
          '<div class="meta">' + ps.reduce(function (a, p) { return a + cnt(p.id); }, 0) + ' сотрудников</div><button class="btn ghost" data-padd="' + h(d.id) + '">+ Должность</button></div>';
      }).join('') + '<div class="sx-dept"><label class="sx-lbl">Новый отдел<input class="in sx-in2" id="rNew" placeholder="Например, «Доставка»"></label><button class="btn ghost" id="rAdd">+ Добавить отдел</button></div></div>' + sxSaveBar('rSave', 'Сохранить названия и доступ');
    box.querySelectorAll('[data-padd]').forEach(function (b) { b.onclick = async function () {
      var d = b.getAttribute('data-padd'), np = { id: 9000 + Math.floor(Math.random() * 99999), name: 'Новая должность', dept_id: d, access: 'staff', sort: 999 };
      await sb.from('positions').insert(np); sxRoles(function (R) { R.newPos.push(np); }); await loadBase(); draw(); toast('Должность добавлена — переименуйте её');
    }; });
    box.querySelectorAll('[data-px]').forEach(function (b) { b.onclick = async function () {
      var id = +b.getAttribute('data-px'), p = S.pos.filter(function (x) { return x.id === id; })[0];
      if (!(await askSure('Удалить должность?', { ok: 'Удалить', danger: true, sub: p ? p.name : '' }))) return;
      await sb.from('positions').delete().eq('id', id); sxRoles(function (R) { R.delPos.push(id); R.newPos = R.newPos.filter(function (x) { return x.id !== id; }); }); await loadBase(); draw(); toast('Должность удалена');
    }; });
    $('rAdd').onclick = async function () {
      var n = $('rNew').value.trim(); if (!n) return toast('Напишите название отдела');
      var nd = { id: 'd' + Date.now().toString(36), name: n, sort: 900 };
      await sb.from('departments').insert(nd); sxRoles(function (R) { R.newDepts.push(nd); }); await loadBase(); draw(); toast('Отдел добавлен');
    };
    $('rSave').onclick = async function () {
      this.disabled = true; var nD = 0, nP = 0;
      var dn = box.querySelectorAll('[data-dn]'), pn = box.querySelectorAll('[data-pn]');
      for (var i = 0; i < dn.length; i++) { var id = dn[i].getAttribute('data-dn'), d = S.depts.filter(function (x) { return x.id === id; })[0], v = dn[i].value.trim(); if (d && v && v !== d.name) { await sb.from('departments').update({ name: v }).eq('id', id); sxRoles(function (R) { R.depts[id] = { name: v }; }); nD++; } }
      for (var j = 0; j < pn.length; j++) { var pid = +pn[j].getAttribute('data-pn'), p = S.pos.filter(function (x) { return x.id === pid; })[0], pv = pn[j].value.trim(), pa = box.querySelector('[data-pa="' + pid + '"]').value;
        if (p && pv && (pv !== p.name || pa !== p.access)) { await sb.from('positions').update({ name: pv, access: pa }).eq('id', pid); sxRoles(function (R) { R.pos[pid] = { name: pv, access: pa }; }); nP++; } }
      await loadBase(); this.disabled = false; draw();
      toast(nD + nP ? 'Сохранено: отделов ' + nD + ', должностей ' + nP : 'Изменений нет');
    };
  }
  draw();
}
/* =================== конец пакета «для бизнеса» =================== */
