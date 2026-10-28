/* Mir Luxe One — демо-мок пакета w7-ops (волна 07): пауза заявки инженерам, правка/отзыв закупки,
   уведомление «Запчасть куплена», отчёт охранника старшему, отложенный обход.
   Подключается в app.html сразу после demo-mock.js. На боевом сервере вместо этого нужны RPC/триггер (см. changes.md).
   ВНИМАНИЕ: заглушки fmtMin / askSure ниже — только до слияния с w7-core (в слияние не попадают). */
(function () {
  // ---- заглушки помощников w7-core (локальные объявления ядра перекроют их после слияния) ----
  window.fmtMin = window.fmtMin || function (m) {
    if (m == null || isNaN(+m)) return '—';
    m = Math.max(0, Math.round(+m));
    var uz = false; try { uz = localStorage.getItem('mlx-lang') === 'uz'; } catch (e) {}
    var H = uz ? ' soat' : ' ч', M = uz ? ' daq' : ' мин';
    if (m < 60) return m + M;
    var hh = Math.floor(m / 60), mm = m % 60;
    return mm ? hh + H + ' ' + mm + M : hh + H;
  };
  window.askSure = window.askSure || function (text, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var d = document.createElement('div');
      d.className = 'sure-stub';
      d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:flex-end';
      d.innerHTML = '<div style="width:100%;box-sizing:border-box;background:var(--card,#1B1C1F);color:var(--ink,#EEE);border-radius:22px 22px 0 0;padding:20px 16px calc(16px + env(safe-area-inset-bottom))">' +
        '<div class="sure-tx" style="font-size:16px;font-weight:600;line-height:1.45;margin-bottom:14px"></div>' +
        '<button type="button" class="btn ' + (opt.danger ? 'ghostbad' : 'gold') + ' full" data-y style="min-height:48px"></button>' +
        '<button type="button" class="btn ghost full" data-n style="min-height:48px;margin-top:8px"></button></div>';
      d.querySelector('.sure-tx').textContent = text;
      d.querySelector('[data-y]').textContent = opt.ok || 'Да';
      d.querySelector('[data-n]').textContent = opt.cancel || 'Нет';
      function done(v) { d.remove(); document.removeEventListener('keydown', esc); res(v); }
      function esc(e) { if (e.key === 'Escape') done(false); }
      d.querySelector('[data-y]').onclick = function () { done(true); };
      d.querySelector('[data-n]').onclick = function () { done(false); };
      d.onclick = function (e) { if (e.target === d) done(false); };
      document.addEventListener('keydown', esc);
      document.body.appendChild(d);
    });
  };

  var DB = window.__DB; if (!DB) return;
  var seq = 77000;
  function meEmp() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || ''), s = null;
    try { s = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {}
    return (DB.employees || []).filter(function (e) { return a ? e.login === a[1] : s && e.user_id === s.user.id; })[0];
  }
  function emp(id) { return (DB.employees || []).filter(function (e) { return e.id === id; })[0]; }
  function notify(to, title, body, refType, refId) {
    if (!to) return;
    DB.notifications = DB.notifications || [];
    DB.notifications.push({ id: ++seq, employee_id: to, at: new Date().toISOString(), title: title, body: body || '', ref_type: refType || null, ref_id: refId || null, urgent: false, read_at: null });
  }
  function secBoss(me) {
    var b = me && me.manager_id && emp(me.manager_id);
    if (b && b.dept_id === 'sec') return b;
    return (DB.employees || []).filter(function (e) { return e.dept_id === 'sec' && e.role === 'manager' && e.active !== false; })[0] || b || null;
  }
  function ok(d) { return Promise.resolve({ data: d == null ? { ok: true } : d, error: null }); }
  function bad(m) { return Promise.resolve({ data: null, error: { message: m } }); }

  var SB = window.supabase; if (!SB || !SB.createClient) return;
  var orig = SB.createClient;
  SB.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__w7ops) return c; c.__w7ops = true;
    var rpc0 = c.rpc;
    c.rpc = function (n, a) {
      a = a || {};
      var me = meEmp();
      // пауза заявки инженерам: p_reason — причина (пауза), null — снять паузу («Вернуть в работу»)
      if (n === 'maint_pause') {
        var m = (DB.maint_requests || []).filter(function (x) { return x.id === a.p_id; })[0];
        if (!m) return bad('Заявка не найдена');
        if (m.status !== 'new' && m.status !== 'work') return bad('Заявка уже закрыта');
        if (a.p_reason) {
          if (!m.paused_at) m.paused_at = new Date().toISOString();
          m.pause_reason = String(a.p_reason).slice(0, 200); m.paused_by = me ? me.id : null;
        } else if (m.paused_at) {
          m.pause_min = (m.pause_min || 0) + Math.max(0, Math.round((Date.now() - Date.parse(m.paused_at)) / 6e4));
          m.paused_at = null; m.pause_reason = null; m.paused_by = null;
          if (m.status === 'work' && me && !m.assigned_to) m.assigned_to = me.id;
        }
        return ok(JSON.parse(JSON.stringify(m)));
      }
      // своя закупка «Ждёт одобрения»: исправить / отозвать
      if (n === 'purchase_edit' || n === 'purchase_withdraw') {
        var p = (DB.purchase_requests || []).filter(function (x) { return x.id === a.p_id; })[0];
        if (!p) return bad('Заявка не найдена');
        if (!me || (p.created_by !== me.id && me.role !== 'director')) return bad('Можно менять только свою заявку');
        if (p.status !== 'new') return bad('Заявку уже рассмотрели — изменить нельзя');
        if (n === 'purchase_withdraw') { p.status = 'withdrawn'; p.withdrawn_at = new Date().toISOString(); return ok(); }
        if (!a.p_items || !String(a.p_items).trim()) return bad('Впишите, что купить');
        p.items = String(a.p_items).trim(); p.est_cost = a.p_est || null; p.urgency = a.p_urgency === 'urgent' ? 'urgent' : 'normal';
        if (a.p_category) p.category = a.p_category;
        p.edited_at = new Date().toISOString();
        return ok();
      }
      // охранник сдаёт смену старшему: уведомление (задача не создаётся)
      if (n === 'patrol_shift_report') {
        var b = secBoss(me); if (!b) return bad('Старший охраны не найден');
        if (b.id === (me && me.id)) return bad('Вы и есть старший смены');
        DB.patrol_reports = DB.patrol_reports || [];
        DB.patrol_reports.push({ id: ++seq, by_emp: me && me.id, to_id: b.id, at: new Date().toISOString(), text: a.p_text || '', note: a.p_note || null, photo_path: a.p_photo || null });
        notify(b.id, 'Охрана: смена сдана', (me ? me.first_name + ': ' : '') + (a.p_note ? 'есть происшествия. ' : '') + String(a.p_text || '').slice(0, 300), 'patrol', null);
        return ok({ ok: true, to: b.id });
      }
      // обход отложен в «Сейчас» — уведомить старшего (настройка директора patrol_snooze_notify)
      if (n === 'patrol_snooze_notice') {
        var b2 = secBoss(me); if (!b2 || (me && b2.id === me.id)) return ok({ ok: false });
        notify(b2.id, 'Обход отложен', (me ? me.first_name + ' · ' : '') + 'Обход ' + (a.p_time || '') + ' · +30 мин', 'patrol', null);
        return ok({ ok: true, to: b2.id });
      }
      return rpc0.apply(this, arguments);
    };
    // «Куплено» / «Доставлено» по закупке с maint_id → подсказка инженеру (заявку он возвращает в работу сам)
    var from0 = c.from;
    c.from = function (t) {
      var q = from0.apply(this, arguments);
      if (t !== 'purchase_requests') return q;
      var then = q.then;
      q.then = function (res, rej) {
        var pl = this.op === 'update' ? this.payload : null;
        return then.call(this, function (r) {
          try {
            if (pl && (pl.status === 'bought' || pl.status === 'delivered') && r && !r.error) {
              (r.data || []).forEach(function (p) {
                if (!p.maint_id) return;
                var m = (DB.maint_requests || []).filter(function (x) { return x.id === p.maint_id; })[0];
                if (!m || m.status === 'done' || m.status === 'cancelled') return;
                var to = m.assigned_to || p.created_by;
                notify(to, pl.status === 'bought' ? 'Запчасть куплена — вернуть в работу?' : 'Запчасть доставлена — вернуть в работу?', (m.room_no ? 'Номер ' + m.room_no + ': ' : (m.place ? m.place + ': ' : '')) + m.text, 'maint', m.id);
              });
            }
          } catch (e) {}
          return res ? res(r) : r;
        }, rej);
      };
      return q;
    };
    return c;
  };
})();
