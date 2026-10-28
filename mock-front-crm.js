// mock-front-crm.js — только демо: чистка CRM-данных и подстраховки мока (пакет front-crm, круг 03)
(function () {
  var DB = window.__DB; if (!DB || !DB.crm_deals) return;
  var TZ = 'Asia/Tashkent';
  var today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function iso(d, hm) { return new Date(d + 'T' + (hm || '10:00') + ':00+05:00').toISOString(); }

  // 1) комментарии без «Найдено агентом CRM…» и без сырых ссылок
  DB.crm_deals.forEach(function (d) {
    if (!d.comment) return;
    var c = String(d.comment).replace(/Найдено агентом CRM\s*\d{2}\.\d{2}:?\s*/g, '')
      .replace(/(Источник:\s*)?https?:\/\/\S+(\s*\(лист[^)]*\))?/g, '')
      .replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
    if (c) c = c.charAt(0).toUpperCase() + c.slice(1);
    d.comment = c || null;
  });

  // 2) учебные телефоны вместо масок «+998 •• ••• •• ••» (код оператора 00 не существует)
  var n = 0, MASK = /\+998 •• ••• •• ••/g;
  function fake() { n++; return '+998 00 000 ' + String(Math.floor(n / 100)).padStart(2, '0') + ' ' + String(n % 100).padStart(2, '0'); }
  var byDeal = {};
  DB.crm_deals.forEach(function (d) {
    if (d.contact_phone && MASK.test(d.contact_phone)) { MASK.lastIndex = 0; d.contact_phone = d.contact_phone.replace(MASK, fake); }
    MASK.lastIndex = 0; byDeal[d.id] = d;
  });
  (DB.crm_tasks || []).forEach(function (t) {
    if (!t.text || t.text.indexOf('••') < 0) return;
    var d = byDeal[t.deal_id], ph = d && d.contact_phone ? d.contact_phone.split(/[,;]/).map(function (x) { return x.trim(); }) : [], i = 0;
    t.text = t.text.replace(MASK, function () { return ph[i++] || fake(); });
  });

  // 3) суммы и даты событий у части сделок — чтобы воронка показывала деньги и сроки
  var AMT = [18e6, 24.5e6, 32e6, 45e6, 60e6, 15e6, 27e6, 38e6, 52e6, 21e6, 33.6e6, 41e6, 16.8e6, 29e6, 48e6, 55e6, 19.2e6, 36e6, 26e6, 44e6, 58e6, 22.4e6, 31e6, 17.5e6, 39e6, 47e6, 23e6, 35e6];
  var k = 0;
  // A1017-01..05 (по решению ревизора) + все сделки на этапах «КП» и «Переговоры» + несколько «Первый контакт»
  var pick = DB.crm_deals.filter(function (d) { return /^A1017-0[1-5]$/.test(d.id); })
    .concat(DB.crm_deals.filter(function (d) { return d.stage === 'kp' || d.stage === 'talks'; }))
    .concat(DB.crm_deals.filter(function (d) { return d.stage === 'contact'; }).slice(0, 5));
  pick.forEach(function (d, i) {
    if (!(+d.amount > 0) && k < AMT.length) d.amount = AMT[k++];
    if (!d.event_date && i % 2 === 0) d.event_date = addDays(today, 10 + (i * 7) % 31);
  });

  // 4) старые сделки из таблицы (L…) — этап менялся давно: видно «N дн. без движения»
  DB.crm_deals.forEach(function (d, i) {
    if (/^L\d+$/.test(d.id) && d.stage !== 'new') { var ago = 8 + (i * 5) % 38; d.stage_changed_at = iso(addDays(today, -ago), '11:00'); d.updated_at = iso(addDays(today, -Math.max(1, ago - 6)), '12:00'); }
  });

  // 5) подстраховки мока: время у заметок CRM и «дата смены этапа» при смене этапа
  var prev = window.supabase && window.supabase.createClient;
  if (!prev) return;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), from = c.from;
    if (c.__crmWrapped) return c;
    c.from = function (t) {
      var q = from.apply(c, arguments);
      if (t === 'crm_notes') { var ins = q.insert; q.insert = function (p) { var now = new Date().toISOString(); p = [].concat(p).map(function (x) { return x.ts ? x : Object.assign({ ts: now }, x); }); return ins.call(q, p); }; }
      if (t === 'crm_deals') { var up = q.update; q.update = function (p) { if (p && p.stage && !p.stage_changed_at) { var now = new Date().toISOString(); p = Object.assign({ stage_changed_at: now, updated_at: now }, p); } return up.call(q, p); }; }
      return q;
    };
    c.__crmWrapped = true;
    return c;
  };
})();
