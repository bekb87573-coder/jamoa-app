/* Jamoa · S4 · переходник (адаптер) «демо-таблицы → настоящий сервер Supabase».
   Подключается только в режиме сервера (window.JAMOA_DEMO === false) из server-config.js, ПОСЛЕ supabase-js.
   Экраны приложения написаны на учебной схеме (employees, shift_types, schedule.kind = u/o/h/b, cb_forgot, ca_advances …).
   Здесь эти вызовы переводятся в схему ядра (members, shift_presets, rpc из server/log/s2.md):
   - чтение: «теневые таблицы» в памяти (SV.T), их заполняют запросы к серверу по доменам (RLS + venue_id), свежесть 15 с;
   - запись: каждая учебная таблица → свой rpc (или разрешённая прямая запись), после записи домен перечитывается;
   - rpc демо → rpc сервера с переводом параметров и ответа; functions.invoke('clock' | 'staff-admin') → rpc clock | member_invite + staff-auth.
   Чего нет на сервере — в SV.miss (видно в selfcheck и в консоли), экран получает пустой ответ без ошибки JS.
   Файл без зависимостей от app.html: проверяется юнит-тестами в node (server/tests/s4/adapter.test.js). */
(function (root) {
  'use strict';
  var TZ = 'Asia/Tashkent';
  var DEMO_DOMAIN = /@staff\.mirluxeplaza\.uz$/i;          // DOMAIN из app.html (учебный)
  var TTL = 15000;

  function tday(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d || new Date()); }
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function hms(ts) { if (!ts) return null; var p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(ts)); return p; }
  function t8(t) { if (!t) return null; t = String(t); return t.length === 5 ? t + ':00' : t.slice(0, 8); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function num(x) { return x == null || x === '' ? null : /^\d+$/.test(String(x)) ? +x : x; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  async function sha256(s) {
    try { var c = (root.crypto && root.crypto.subtle) || (typeof require === 'function' ? require('crypto').webcrypto.subtle : null); if (c) return hex(await c.digest('SHA-256', new TextEncoder().encode(String(s)))); } catch (e) {}
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return ('dev' + h + '0000000000000000').slice(0, 24);
  }

  /* ---------------- движок запросов (как в demo-mock.js, плюс запись фильтров для переводчиков записи) ---------------- */
  function Q(sv, t) { this.sv = sv; this.t = t; this.f = []; this.fv = []; this.op = 'select'; this.ord = []; this.lim = null; this.one = null; this.payload = null; this.ret = false; this.cols = null; this.cnt = null; }
  Q.prototype.select = function (c, o) { if (this.op !== 'select') this.ret = true; else this.cols = c || '*'; if (o && o.count) this.cnt = o.count; if (o && o.head) this.head = true; return this; };
  function cmpv(a, b) { if (a == null || b == null) return null; if (typeof a === 'number' || typeof b === 'number') { a = +a; b = +b; } else { a = String(a); b = String(b); } return a > b ? 1 : a < b ? -1 : 0; }
  function eqv(a, b) { if (a === b) return true; if (a == null || b == null) return false; return String(a) === String(b); }
  Q.prototype._f = function (op, c, v, fn) { this.fv.push([op, c, v]); this.f.push(fn); return this; };
  Q.prototype.eq = function (c, v) { return this._f('eq', c, v, function (r) { return eqv(r[c], v); }); };
  Q.prototype.neq = function (c, v) { return this._f('neq', c, v, function (r) { return !eqv(r[c], v); }); };
  Q.prototype.gte = function (c, v) { return this._f('gte', c, v, function (r) { var k = cmpv(r[c], v); return k !== null && k >= 0; }); };
  Q.prototype.gt = function (c, v) { return this._f('gt', c, v, function (r) { var k = cmpv(r[c], v); return k !== null && k > 0; }); };
  Q.prototype.lte = function (c, v) { return this._f('lte', c, v, function (r) { var k = cmpv(r[c], v); return k !== null && k <= 0; }); };
  Q.prototype.lt = function (c, v) { return this._f('lt', c, v, function (r) { var k = cmpv(r[c], v); return k !== null && k < 0; }); };
  Q.prototype.is = function (c, v) { return this._f('is', c, v, function (r) { return v === null ? r[c] == null : v === true ? r[c] === true : v === false ? r[c] === false : (r[c] == null) === (v === null); }); };
  Q.prototype.not = function (c, op, v) { return this._f('not', c, v, function (r) { if (op === 'is' && v === null) return r[c] != null; if (op === 'eq') return !eqv(r[c], v); if (op === 'in') { var L = String(v).replace(/^\(|\)$/g, '').split(','); return L.indexOf(String(r[c])) < 0; } return r[c] != null; }); };
  Q.prototype.in = function (c, v) { v = v || []; return this._f('in', c, v, function (r) { return v.some(function (x) { return eqv(r[c], x); }); }); };
  Q.prototype.like = function (c, v) { var p = String(v).replace(/%/g, ''); return this._f('like', c, v, function (r) { return String(r[c]).indexOf(p) >= 0; }); };
  Q.prototype.ilike = function (c, v) { var p = String(v).replace(/%/g, '').toLowerCase(); return this._f('ilike', c, v, function (r) { return String(r[c]).toLowerCase().indexOf(p) >= 0; }); };
  Q.prototype.contains = function (c, v) { return this._f('contains', c, v, function (r) { return [].concat(v).every(function (x) { return (r[c] || []).indexOf(x) >= 0; }); }); };
  Q.prototype.or = function (expr) {
    var parts = String(expr).split(',').map(function (p) { var a = p.split('.'); return [a[0], a[1], a.slice(2).join('.')]; });
    return this._f('or', null, expr, function (r) { return parts.some(function (p) { var v = r[p[0]]; if (p[1] === 'is') return p[2] === 'null' ? v == null : String(v) === p[2]; if (p[1] === 'gte') return String(v) >= p[2]; if (p[1] === 'lte') return String(v) <= p[2]; if (p[1] === 'neq') return String(v) !== p[2]; return String(v) === p[2]; }); });
  };
  Q.prototype.match = function (o) { var self = this; Object.keys(o || {}).forEach(function (k) { self.eq(k, o[k]); }); return this; };
  Q.prototype.filter = function (c, op, v) { return op === 'eq' ? this.eq(c, v) : op === 'in' ? this.in(c, String(v).replace(/^\(|\)$/g, '').split(',')) : this; };
  Q.prototype.order = function (c, o) { this.ord.push([c, !(o && o.ascending === false)]); return this; };
  Q.prototype.limit = function (n) { this.lim = n; return this; };
  Q.prototype.range = function (a, b) { this.rg = [a, b]; return this; };
  Q.prototype.single = function () { this.one = 'single'; return this; };
  Q.prototype.maybeSingle = function () { this.one = 'maybe'; return this; };
  Q.prototype.abortSignal = function () { return this; };
  Q.prototype.insert = function (p) { this.op = 'insert'; this.payload = [].concat(p); return this; };
  Q.prototype.update = function (p) { this.op = 'update'; this.payload = p; return this; };
  Q.prototype.upsert = function (p, o) { this.op = 'upsert'; this.payload = [].concat(p); this.conf = (o && o.onConflict || 'id').split(','); return this; };
  Q.prototype.delete = function () { this.op = 'delete'; return this; };
  Q.prototype.val = function (c) { for (var i = 0; i < this.fv.length; i++) if (this.fv[i][0] === 'eq' && this.fv[i][1] === c) return this.fv[i][2]; return undefined; };
  Q.prototype.match1 = function (r) { return this.f.every(function (fn) { return fn(r); }); };
  Q.prototype.pick = function (rows) {
    var self = this, out = rows.filter(function (r) { return self.match1(r); }).slice();
    if (this.ord.length) { var O = this.ord; out.sort(function (x, y) { for (var i = 0; i < O.length; i++) { var k = cmpv(x[O[i][0]], y[O[i][0]]); if (k === null) k = x[O[i][0]] == null ? (y[O[i][0]] == null ? 0 : 1) : -1; if (k) return k * (O[i][1] ? 1 : -1); } return 0; }); }
    var count = out.length;
    if (this.rg) out = out.slice(this.rg[0], this.rg[1] + 1);
    if (this.lim) out = out.slice(0, this.lim);
    out = clone(out);
    if (this.one) return { data: out[0] || null, error: (!out[0] && this.one === 'single') ? { message: 'Строка не найдена', code: 'PGRST116' } : null, count: count };
    return { data: this.head ? null : out, error: null, count: count };
  };
  Q.prototype.run = function () { return this.sv.exec(this); };
  Q.prototype.then = function (res, rej) { return this.run().then(res, rej); };
  Q.prototype.catch = function (rej) { return this.run().catch(rej); };
  Q.prototype.finally = function (f) { return this.run().finally(f); };

  /* ---------------- фабрика ---------------- */
  function make(real, cfg) {
    cfg = cfg || {};
    var SV = {
      real: real, cfg: cfg, T: {}, at: {}, busy: {}, miss: {}, log: [], venueId: null, venue: null, me: null, uid: null, venues: [],
      dep: { toLoc: {}, toSrv: {} }, presets: {}, health: null, ready: false, state: 'out', ui: {}, listeners: [], quizCache: {}, hooks: {}
    };
    function miss(kind, name, note) { var k = kind + ':' + name; if (!SV.miss[k]) { SV.miss[k] = { kind: kind, name: name, note: note || '', n: 0 }; try { console.info('[jamoa server] не покрыто: ' + k + (note ? ' — ' + note : '')); } catch (e) {} } SV.miss[k].n++; }
    SV.missing = function () { return Object.keys(SV.miss).map(function (k) { return SV.miss[k]; }); };
    function E(message, code) { return { message: message, details: code || 'sv', code: code || 'sv' }; }
    function V() { return SV.venueId; }
    function dl(id) { return id == null ? null : SV.dep.toLoc[id] || ('d' + id); }            // отдел сервера → id демо
    function ds(loc) { if (loc == null || loc === '') return null; if (SV.dep.toSrv[loc] != null) return SV.dep.toSrv[loc]; return /^d?\d+$/.test(String(loc)) ? +String(loc).replace(/^d/, '') : null; }
    function role(r) { return r === 'owner' ? 'director' : r === 'manager' ? 'manager' : 'staff'; }

    /* ----- чтение с сервера (всегда с venue_id текущего заведения) ----- */
    async function q(table, build) {
      var b = real.from(table).select('*').eq('venue_id', V()); if (build) b = build(b);
      var r = await b; if (r.error) { SV.log.push({ t: table, e: r.error.message }); throw r.error; } return r.data || [];
    }
    async function rpc(n, a) { var r = await real.rpc(n, a || {}); return r; }

    /* ----- домены теневых таблиц ----- */
    var DOM = {
      base: async function () {
        var r = await Promise.all([
          q('members'), q('departments', function (b) { return b.order('sort'); }), q('positions', function (b) { return b.order('sort'); }),
          q('shift_presets', function (b) { return b.order('sort'); }), real.from('venues').select(VCOLS).eq('id', V()).maybeSingle(),
          real.rpc('colleagues'), real.rpc('my_profile')
        ]);
        var mem = r[0], dep = r[1], pos = r[2], pr = r[3], ven = Object.assign({}, (r[4] && r[4].data) || SV.venue || {}), col = (r[5] && r[5].data) || [], prof = (r[6] && r[6].data) || null;
        /* 0012: координаты заведения отдаёт только my_profile (владельцу и руководителю), venues читается списком колонок */
        if (prof && prof.venue) { ['lat', 'lng', 'has_point', 'offline_max_min', 'adj_max', 'mgr_bonus_max'].forEach(function (k) { if (prof.venue[k] !== undefined) ven[k] = prof.venue[k]; }); }
        SV.profile = prof;
        SV.venue = ven; SV.dep = { toLoc: {}, toSrv: {} }; var used = {};
        dep.forEach(function (d) { var c = d.code && !used[d.code] ? d.code : 'd' + d.id; used[c] = 1; SV.dep.toLoc[d.id] = c; SV.dep.toSrv[c] = d.id; });
        var heads = {}; dep.forEach(function (d) { if (d.head_id) heads[d.head_id] = dl(d.id); });
        var seen = {}, emps = mem.map(function (m) { seen[m.id] = 1; return memRow(m, heads); });
        col.forEach(function (c) { if (seen[c.id]) return; emps.push({ id: c.id, user_id: null, first_name: c.first_name, last_name: c.last_name || '', gender: c.gender, dept_id: dl(c.dept_id), position_id: c.position_id, manager_id: null, role: role(c.role), jrole: c.role, login: null, active: true, photo: c.photo_path || null, colleague: true, lead_dept: heads[c.id] || null }); });
        SV.T.employees = emps;
        SV.me = mem.filter(function (m) { return m.user_id === SV.uid; })[0] || SV.me;
        var acc = {}; mem.concat(col).forEach(function (m) { if (m.position_id == null) return; var a = m.role === 'owner' ? 'director' : m.role === 'manager' ? 'manager' : 'staff'; if (!acc[m.position_id] || a === 'director' || (a === 'manager' && acc[m.position_id] === 'staff')) acc[m.position_id] = a; });
        SV.T.positions = pos.map(function (p) { return { id: p.id, sid: p.id, dept_id: dl(p.dept_id), name: p.name, name_uz: p.name_uz, gender: p.gender, sort: p.sort, access: acc[p.id] || 'staff', has_pms: false }; });
        SV.T.departments = dep.map(function (d) { return { id: dl(d.id), sid: d.id, code: d.code, name: d.name, name_uz: d.name_uz, sort: d.sort, parent_id: dl(d.parent_id), head_id: d.head_id }; });
        SV.presets = {}; pr.forEach(function (p) { SV.presets[p.id] = p; });
        SV.T.shift_types = pr.map(function (p) { return { id: p.id, dept_id: dl(p.dept_id), code: 'p' + p.id, name: p.name, name_uz: p.name_uz, start_time: t8(p.t_start), end_time: t8(p.t_end), active: p.active !== false, sort: p.sort, is_night: p.is_night }; });
        var pf = Object.assign({}, ven.prefs || {});
        var vpx = dnVenueProfile(ven, pf, mem, dep, pos);   /* dn (п. 3 аудита): анкета заведения — люди по службам и «веду сам» из членов заведения */
        SV.T.hotel_settings = [{ id: 1, lat: ven.lat, lng: ven.lng, radius_m: ven.radius_m, late_grace_min: ven.late_grace_min, require_geo: ven.geo_mode !== 'off', require_wifi: false,
          prefs: Object.assign(pf, { org_name: ven.name, org_type: ven.type, venue_profile: vpx,
            geo_mode: ven.geo_mode, photo_in: ven.photo_in, early_clock_min: ven.early_clock_min, auto_close_h: ven.auto_close_h, health_log: ven.health_log, kiosk_on: ven.kiosk_on, adv_limit_pct: ven.adv_limit_pct,
            mgr_sees_earn: ven.mgr_sees_earn, forgot_days: ven.forgot_days, noshow_min: ven.noshow_min, foreign_reg_h: ven.foreign_reg_h, offline_max_min: ven.offline_max_min, adj_max: ven.adj_max, mgr_bonus_max: ven.mgr_bonus_max, has_point: ven.has_point != null ? ven.has_point : ven.lat != null,
            cb_radius: ven.radius_m, cb_early_min: ven.early_clock_min, cb_auto_h: ven.auto_close_h, cb_health: ven.health_log, cb_kiosk: ven.kiosk_on, late_grace_min: ven.late_grace_min }) }];
      },
      sched: async function () {
        var d = tday(), L = await q('schedule', function (b) { return b.gte('day', addDays(d, -62)).lte('day', addDays(d, 62)); });
        SV.T.schedule = L.map(schRow);
        /* сотрудник по RLS видит только свой график; смены коллег своей службы (для «Поменяться сменой») — rpc dept_schedule (0013) */
        if (SV.me && SV.me.role === 'staff') {
          try {
            var r = await real.rpc('dept_schedule', { p_from: addDays(d, -7), p_to: addDays(d, 35) }), have = {};
            SV.T.schedule.forEach(function (x) { have[x.employee_id + '|' + x.day] = 1; });
            (r.data || []).forEach(function (x) { if (have[x.member_id + '|' + x.day]) return; var row = schRow({ id: 'c' + x.member_id + '|' + x.day, member_id: x.member_id, day: x.day, kind: x.kind === 'away' ? 'vacation' : x.kind, preset_id: x.preset_id, t_start: x.t_start, t_end: x.t_end }); row.peer = true; SV.T.schedule.push(row); });
          } catch (e) {}
        }
      },
      att: async function () {
        var L = await q('attendance', function (b) { return b.gte('day', addDays(tday(), -70)).order('clock_in', { ascending: false }); });
        var sk = {}; (SV.T.schedule || []).forEach(function (s) { sk[s.employee_id + '|' + s.day] = s.kind; });
        SV.T.attendance = L.map(function (a) { return attRow(a, sk[a.member_id + '|' + a.day]); });
      },
      notif: async function () {
        if (!SV.me) { SV.T.notifications = []; return; }
        var L = await q('notifications', function (b) { return b.eq('member_id', SV.me.id).is('cancelled_at', null).order('created_at', { ascending: false }).limit(80); });
        SV.T.notifications = L.map(notRow);
      },
      tasks: async function () {
        var d = tday(), L = await q('tasks', function (b) { return b.or('day.gte.' + addDays(d, -40) + ',status.in.(new,work,review,returned)').order('day', { ascending: false }).limit(600); });
        var ids = L.map(function (t) { return t.id; });
        var r = await Promise.all([
          ids.length ? q('task_items', function (b) { return b.in('task_id', ids).order('sort'); }) : [],
          ids.length ? q('task_photos', function (b) { return b.in('task_id', ids); }) : [],
          ids.length ? q('task_events', function (b) { return b.in('task_id', ids).order('at'); }) : [],
          q('task_templates'),
          ids.length ? q('task_submits', function (b) { return b.in('task_id', ids); }) : []
        ]);
        SV.T.tasks = L.map(taskRow); SV.T.task_items = r[0]; SV.T.task_photos = r[1]; SV.T.task_submits = r[4];
        SV.T.task_events = r[2].map(function (e) { return { id: e.id, task_id: e.task_id, at: e.at, actor_id: e.actor_id, employee_id: e.member_id, action: e.action, text: e.text }; });
        SV.T.task_templates = r[3].map(function (t) { return { id: t.id, title: t.title, title_uz: t.title_uz, notes: t.notes, employee_id: t.assignee_id, position_id: t.position_id, dept_id: dl(t.dept_id), weekdays: t.weekdays || [1, 2, 3, 4, 5, 6, 7], due_time: t8(t.due_time), needs_photo: !!t.needs_photo, checklist_id: t.checklist_id, active: t.active !== false, sort: 0 }; });
        /* чек-листы и фото задач в виде учебных cd_ck / cd_ph (92d-tasks) */
        var by = {}; SV.T.task_items.forEach(function (i) { (by[i.task_id] = by[i.task_id] || []).push(i); });
        SV.T.cd_ck = Object.keys(by).map(function (tid) { var it = by[tid].sort(function (a, b) { return a.sort - b.sort; }); return { id: +tid, task_id: +tid, items: it.map(function (i) { return { t: i.text, t_uz: i.text_uz, ph: !!i.needs_photo, done: !!i.done, by: i.done_by, at: i.done_at, sid: i.id }; }) }; });
        SV.T.cd_ph = SV.T.task_photos.map(function (p) { var it = (by[p.task_id] || []).sort(function (a, b) { return a.sort - b.sort; }); var k = -1; it.forEach(function (i, n) { if (i.id === p.item_id) k = n; }); return { id: p.id, task_id: p.task_id, item: k >= 0 ? k : null, path: p.path, at: p.taken_at, by: p.member_id, submit_no: p.submit_no }; });
        await thumbs();
      },
      ann: async function () {
        var r = await Promise.all([q('announcements', function (b) { return b.order('created_at', { ascending: false }).limit(100); }), q('announcement_reads')]);
        SV.T.announcements = r[0].map(function (a) { return { id: a.id, title: a.title_ru, body: a.body_ru, title_uz: a.title_uz, body_uz: a.body_uz, need_ack: !!a.need_ack, pinned: !!a.pinned, audience: a.audience, dept_id: dl(a.aud_dept_id), position_id: a.aud_position_id, employee_id: a.aud_member_id, created_by: a.created_by, created_at: a.created_at, expires_at: a.expires_at }; });
        SV.T.announcement_reads = r[1].map(function (x) { return { id: x.ann_id + ':' + x.member_id, ann_id: x.ann_id, employee_id: x.member_id, read_at: x.read_at, acked_at: x.acked_at }; });
      },
      req: async function () {
        var d0 = addDays(tday(), -70);
        if (!SV.at.sched) { try { await load('sched'); } catch (e) {} }
        var r = await Promise.all([
          q('leave_requests', function (b) { return b.gte('day_to', d0).order('created_at', { ascending: false }); }),
          q('shift_swaps', function (b) { return b.order('created_at', { ascending: false }).limit(200); }),
          q('clock_requests', function (b) { return b.gte('day', d0).order('created_at', { ascending: false }); }),
          q('advance_requests', function (b) { return b.gte('day', d0).order('created_at', { ascending: false }); }),
          q('pay_adjustments', function (b) { return b.gte('day', d0).order('created_at', { ascending: false }); }),
          q('health_checks', function (b) { return b.gte('day', addDays(tday(), -40)); })
        ]);
        var LS = { yes: 'approved', no: 'rejected', new: 'new', cancel: 'cancel' };
        SV.T.leave_requests = r[0].filter(function (l) { return l.kind === 'late' || l.kind === 'early'; }).map(function (l) { return { id: l.id, employee_id: l.member_id, kind: l.kind, day: l.day_from, day_to: l.day_to, from_time: t8(l.from_time), minutes: l.minutes, reason: l.reason, status: LS[l.status] || l.status, decided_by: l.decided_by, decided_at: l.decided_at, decide_note: l.decide_note, created_at: l.created_at }; })
          .concat(r[0].filter(function (l) { return l.kind === 'dayoff' && l.day_from === l.day_to; }).map(function (l) { return { id: l.id, employee_id: l.member_id, kind: 'absent', day: l.day_from, day_to: l.day_to, reason: l.reason, status: LS[l.status] || l.status, sv_dup: true, created_at: l.created_at }; }));
        SV.T.schedule_requests = r[0].filter(function (l) { return l.kind === 'dayoff' || l.kind === 'vacation' || l.kind === 'sick'; }).map(function (l) { return { id: l.id, employee_id: l.member_id, kind: l.kind === 'dayoff' ? 'off' : l.kind, day: l.day_from, day_to: l.day_to, note: l.reason, reason: l.reason, status: l.status, decided_by: l.decided_by, decided_at: l.decided_at, decide_note: l.decide_note, created_at: l.created_at }; });
        SV.T.shift_exchanges = r[1].map(xcRow);
        SV.T.cb_forgot = r[2].map(function (c) { return { id: c.id, employee_id: c.member_id, src: c.src, kind: c.action, day: c.day, at: c.at, at2: c.at2, why: c.why, note: c.note, reason: c.why ? c.why + (c.note ? ' · ' + c.note : '') : c.note, pos: c.lat != null ? { lat: c.lat, lng: c.lng, dist: c.dist_m } : null, status: c.status, decided_by: c.decided_by, decided_at: c.decided_at, decide_note: c.decide_note, created_at: c.created_at, attendance_id: c.attendance_id }; });
        SV.T.ca_advances = r[3].map(function (a) { return { id: a.id, employee_id: a.member_id, amount: +a.amount, reason: a.reason, day: a.day, limit_amount: +a.limit_amount || null, status: a.status, decided_by: a.decided_by, decided_at: a.decided_at, decide_note: a.decide_note, paid_at: a.paid_at, created_at: a.created_at }; });
        SV.T.ca_adj = r[4].map(function (p) { return { id: p.id, emp_id: p.member_id, employee_id: p.member_id, kind: p.kind, amount: +p.amount, reason_code: p.reason_code, reason: p.reason, note: p.note, day: p.day, by: p.created_by, src: p.src, ref: p.ref_id, status: p.status || 'ok', deleted: !!p.cancelled_at || p.status === 'rejected', created_at: p.created_at }; });
        SV.T.health_checks = r[5].map(function (x) { return { id: x.id, employee_id: x.member_id, day: x.day, at: x.at, a: x.answers, answers: x.answers, ok: x.ok, status: x.checked_by ? (x.ok ? 'admit' : 'susp') : (x.ok ? 'ok' : 'wait'), by: x.checked_by, by_at: x.checked_at, note: x.note, attendance_id: x.attendance_id }; });
      },
      subs: async function () {
        var L = await q('sub_requests', function (b) { return b.gte('day', addDays(tday(), -7)).order('created_at'); });
        var ids = L.map(function (x) { return x.id; }), O = ids.length ? await q('sub_offers', function (b) { return b.in('sub_id', ids); }) : [];
        SV.T.shift_swaps = L.map(subRow);
        SV.T.shift_swap_offers = O.map(function (o) { return { id: o.id, swap_id: o.sub_id, emp_id: o.member_id, status: o.status, rank: o.rank, off_day: o.off_day, week_min: o.week_min, rest_min: o.rest_min, sent_by: o.sent_by, sent_at: o.sent_at, answered_at: o.answered_at }; });
      },
      quiz: async function () {
        var L = await q('quiz_attempts', function (b) { return b.gte('day', addDays(tday(), -70)).order('day', { ascending: false }); });
        SV.T.quiz_attempts = L.map(function (a) { return { id: a.id, employee_id: a.member_id, day: a.day, attempt_no: a.attempt_no, qids: a.qids, answers: a.answers, correct: a.correct, total: a.total, score: (a.correct || 0) * 10, score_pct: a.score_pct, sec: a.sec, eligible: a.eligible }; });
      },
      pay: async function () {
        var L = await q('payslips', function (b) { return b.order('ym', { ascending: false }).limit(400); });
        var ids = L.map(function (p) { return p.id; }), ln = ids.length ? await q('payslip_lines', function (b) { return b.in('payslip_id', ids).order('sort'); }) : [];
        SV.T.payslips = L.map(function (p) { return Object.assign({}, p, { employee_id: p.member_id, accrued: +p.accrued, deducted: +p.deducted, to_pay: +p.to_pay, oklad: +p.oklad }); });
        var ymOf = {}; L.forEach(function (p) { ymOf[p.id] = p.ym; });
        /* dn: вопросы к расчётному листу (сотрудник — свои, владелец/бухгалтер — все; статус new → open, как в демо) */
        /* dn: закрытые месяцы (кнопка «Закрыть месяц» в «Расчётных листах»; читают владелец и бухгалтер) */
        try { SV.T.month_closes = await q('month_closes'); } catch (e) { SV.T.month_closes = []; }
        var QS = []; try { QS = await q('payslip_questions', function (b) { return b.order('created_at', { ascending: false }).limit(300); }); } catch (e) { QS = []; }
        SV.T.payslip_questions = QS.map(function (x) { return { id: x.id, payslip_id: x.payslip_id, employee_id: x.member_id, ym: ymOf[x.payslip_id] || null, line_kind: x.line_kind, text: x.text,
          status: x.status === 'new' ? 'open' : x.status, sv_status: x.status, answer: x.answer, answered_by: x.answered_by, answered_at: x.answered_at, created_at: x.created_at }; });
        SV.T.payslip_lines = ln.map(function (l) { return Object.assign({ ym: ymOf[l.payslip_id] }, l, { employee_id: l.member_id, amount: +l.amount * (l.sign < 0 && ['fine', 'advance', 'other_minus', 'debt_out', 'debt_in'].indexOf(l.kind) < 0 ? -1 : 1) }); });
      },
      /* dn: банк вопросов теста (карточка «Банк вопросов» у владельца); сотруднику таблица закрыта — пусто */
      qbank: async function () {
        if (!SV.me || (SV.me.role !== 'owner' && SV.me.role !== 'manager')) { SV.T.quiz_questions = []; return; }
        var L = await q('quiz_questions', function (b) { return b.order('id').limit(5000); });
        SV.T.quiz_questions = L.filter(function (x) { return x.skill_qid == null; }).map(function (x) { return { id: x.id, cat: x.cat, dept_id: dl(x.dept_id), q_ru: x.q_ru, q_uz: x.q_uz, opts_ru: x.opts_ru, opts_uz: x.opts_uz, correct: x.correct, expl_ru: x.expl_ru, expl_uz: x.expl_uz, active: x.active !== false }; });
      },
      /* dn (п. 7): телефоны сотрудников — rpc devices_list (0018), хэш телефона не приходит никогда */
      dev: async function () {
        if (!SV.me || (SV.me.role !== 'owner' && SV.me.role !== 'manager')) { SV.T.staff_devices = []; return; }
        var r = await real.rpc('devices_list'); if (r.error) throw r.error;
        SV.T.staff_devices = (r.data || []).map(function (d) { return { id: d.id, employee_id: d.member_id, label: d.label, first_seen: d.first_seen, last_seen: d.last_seen, blocked: !!d.blocked, revoked_at: null }; });
      },
      prefs: async function () {
        var L = await q('notify_prefs');
        SV.T.jc_nprefs = L.map(function (p) { return { id: p.member_id, employee_id: p.member_id, on: p.kinds || {}, at: p.updated_at, quiet_from: p.quiet_from, quiet_to: p.quiet_to }; });
      }
    };
    async function thumbs() {
      var L = (SV.T.cd_ph || []).filter(function (p) { return p.path && !p.thumb; }); if (!L.length) return;
      try {
        var B = real.storage.from(SV.bucket), r = B.createSignedUrls ? await B.createSignedUrls(L.map(function (p) { return p.path; }), 3600) : { data: [] };
        (r.data || []).forEach(function (x, i) { if (x && x.signedUrl) L[i].thumb = x.signedUrl; });
      } catch (e) {}
    }
    /* dn (п. 3): venue_profile на сервере. Приложение считает по анкете людей (vTotal: «Карта сотрудников» от 5 человек, «Сотрудников N»)
       и «веду сам» (vp.self: 'acc' — владелец сам готовит расчётные листы). На сервере анкета берётся из настоящих людей заведения:
       staff[код службы] = [[должность, сколько]]; если бухгалтера нет — self += 'acc'. Сохранённые владельцем поля анкеты остаются. */
    function dnVenueProfile(ven, pf, mem, dep, pos) {
      var saved = pf.venue_profile && pf.venue_profile.type === ven.type ? pf.venue_profile : {};
      var vp = Object.assign({ type: ven.type, svc: dep.filter(function (d) { return d.code && d.code !== 'dir'; }).map(function (d) { return dl(d.id); }) }, saved);
      vp.svc = (vp.svc || []).slice();
      var pn = {}; pos.forEach(function (p) { pn[p.id] = p.name; });
      var act = mem.filter(function (m) { return !m.archived_at && m.role !== 'owner'; }), st = {};
      act.forEach(function (m) {
        var c = m.dept_id != null ? dl(m.dept_id) : 'other'; if (c === 'dir') c = 'adm';
        if (vp.svc.indexOf(c) < 0) vp.svc.push(c);
        var n = pn[m.position_id] || 'Сотрудник', L = st[c] = st[c] || [], row = L.filter(function (x) { return x[0] === n; })[0];
        if (row) row[1]++; else L.push([n, 1]);
      });
      if (act.length) vp.staff = st; else vp.staff = saved.staff || {};
      var hasAcc = act.some(function (m) { return m.role === 'accountant' || /бухгалтер/i.test(pn[m.position_id] || ''); });
      vp.self = Array.isArray(saved.self) ? saved.self.slice() : [];
      if (!hasAcc && vp.self.indexOf('acc') < 0) vp.self.push('acc');
      return vp;
    }
    /* 0012: select('*') по venues запрещён (lat/lng скрыты) — только перечень колонок */
    var VCOLS = 'id,name,type,lang,tz,radius_m,geo_mode,photo_in,late_grace_min,early_clock_min,auto_close_h,forgot_days,noshow_min,health_log,health_dept_ids,kiosk_on,adv_limit_pct,mgr_sees_earn,foreign_reg_h,prefs,district,is_demo,active';
    var TD = { employees: 'base', departments: 'base', positions: 'base', shift_types: 'base', hotel_settings: 'base', schedule: 'sched', attendance: 'att', notifications: 'notif',
      tasks: 'tasks', task_items: 'tasks', task_photos: 'tasks', task_events: 'tasks', task_templates: 'tasks', task_submits: 'tasks', cd_ck: 'tasks', cd_ph: 'tasks',
      announcements: 'ann', announcement_reads: 'ann', leave_requests: 'req', schedule_requests: 'req', shift_exchanges: 'req', cb_forgot: 'req', ca_advances: 'req', ca_adj: 'req',
      health_checks: 'req', quiz_attempts: 'quiz', shift_swaps: 'subs', shift_swap_offers: 'subs', payslips: 'pay', payslip_lines: 'pay', jc_nprefs: 'prefs',
      payslip_questions: 'pay', quiz_questions: 'qbank', staff_devices: 'dev' };   /* dn: вопросы к листу, банк теста, телефоны */
    /* таблицы только на этом телефоне (серверу не нужны: сервер сам делает напоминания, сводки, дубли уведомлений) */
    var LOCAL = { jc_remind: 1, late_warns: 1, template_skips: 1, shift_photos: 1, __jc: 1, __w3: 1, __w4fx: 1, __w4i: 1, __w4r: 1, cb_pins: 1, problem_reports: 1 };
    SV.TD = TD;

    function memRow(m, heads) {
      return { id: m.id, user_id: m.user_id, first_name: m.first_name, last_name: m.last_name || '', gender: m.gender, login: m.login, phone: m.phone, photo: m.photo_path, photo_path: m.photo_path,
        dept_id: dl(m.dept_id), position_id: m.position_id, manager_id: m.manager_id, role: role(m.role), jrole: m.role, hire_date: m.hire_date, lang: m.lang,
        active: !m.archived_at, archived_at: m.archived_at, must_change_password: !!m.must_change_password, lead_dept: (heads || {})[m.id] || null, default_preset_id: m.default_preset_id,
        birth_date: m.birth_date || null, tg_username: m.tg_username || null,   /* dn: 0018 — день рождения и ник Telegram */
        geo_free: !!m.geo_free };   /* 92w: 0026 — «Отмечаться без геолокации» */
    }
    function schKind(s) {
      if (s.kind === 'work') return s.preset_id ? 'p' + s.preset_id : 'u';
      return { off: 'o', dayoff: 'o', vacation: 'h', sick: 'b' }[s.kind] || 'o';
    }
    function schRow(s) {
      var k = schKind(s), p = s.preset_id ? SV.presets[s.preset_id] : null, same = p && t8(p.t_start) === t8(s.t_start) && t8(p.t_end) === t8(s.t_end);
      return { id: s.id, employee_id: s.member_id, day: s.day, kind: k, sv_kind: s.kind, preset_id: s.preset_id, t_start: s.kind === 'work' && !same ? t8(s.t_start) : null, t_end: s.kind === 'work' && !same ? t8(s.t_end) : null,
        confirmed: s.confirmed, confirmed_at: s.confirmed_at, note: s.note, overnight: s.overnight };
    }
    function attRow(a, kind) {
      return { id: a.id, employee_id: a.member_id, day: a.day, clock_in: a.clock_in, clock_out: a.clock_out, is_late: (a.late_min || 0) > 0, late_min: a.late_min || 0,
        shift_start: hms(a.plan_start), shift_end: hms(a.plan_end), shift_kind: kind || (a.plan_start ? 'u' : null), worked_min: a.worked_min, early_min: a.early_min || 0, left_early: (a.early_min || 0) > 0,
        overtime_min: a.overtime_min || 0, night_min: a.night_min || 0, late_why: a.late_why, explain_text: a.late_note, explain_at: a.late_explained_at || (a.late_why || a.late_note ? (a.updated_at || a.clock_in) : null), mgr_ok_at: a.late_ok_at || null, mgr_ok_by: a.late_ok_by || null, mgr_ok_note: a.late_ok_note || null, /* 92m: 0017 */
        cb_auto: !!a.auto_closed, cb_off: !!a.offline, offline: !!a.offline, time_status: a.time_status || 'ok', delayed: a.time_status === 'pending', in_tap_at: a.in_tap_at, in_sent_at: a.in_sent_at,
        out_zone: a.zone_status !== 'ok', zone_status: a.zone_status, zone_ok: a.zone_status === 'approved', zone_no: a.zone_status === 'rejected', zone_m: a.in_dist_m,
        cb_zone: a.zone_status !== 'ok' ? { dist: a.in_dist_m, lat: a.in_lat, lng: a.in_lng, why: a.in_zone === 'nogps' ? 'nogps' : 'far' } : null,
        in_lat: a.in_lat, in_lng: a.in_lng, in_zone: a.in_zone, in_dist_m: a.in_dist_m, out_lat: a.out_lat, out_lng: a.out_lng, out_zone: a.out_zone, out_dist_m: a.out_dist_m, /* 92m: точки отметок для карты */
        in_photo: a.in_photo_path, out_photo: a.out_photo_path, in_source: a.in_source, in_device: a.in_source === 'kiosk' ? 'kiosk' : 'phone', cb_kiosk: a.in_source === 'kiosk', face_flag: false,
        geo_free: !!a.geo_free };   /* 92w: 0026 — отметка без геолокации (разрешено) */
    }
    /* ссылки уведомлений: на сервере «swap» — обмен сменами (в демо — xchg), «sub» — замена заболевшего (в демо — swap) */
    var REFT = { swap: 'xchg', sub: 'swap' };
    function notRow(n) {
      var rid = n.ref_id == null ? null : String(n.ref_id).split(':')[0];
      return { id: n.id, employee_id: n.member_id, at: n.created_at, title: n.title, body: n.body, kind: n.kind, ref_type: REFT[n.ref_type] || n.ref_type, ref_id: num(rid), urgent: !!n.urgent, read_at: n.read_at, ans: n.answer, answer: n.answer };
    }
    /* код смены демо по строке графика сервера: смена службы p<id>, своё время u, выходной o, отпуск h, больничный b */
    function kindCode(kind, preset) { if (!kind) return null; if (kind === 'work') return preset ? 'p' + preset : 'u'; return { off: 'o', dayoff: 'o', vacation: 'h', sick: 'b' }[kind] || 'o'; }
    /* обмен сменами: статусы демо peer | boss | done | declined | rejected | cancelled; «снимок» клеток — текущий график (обмен по живому графику) */
    var XST = { new: 'peer', peer_yes: 'boss', peer_no: 'declined', yes: 'done', no: 'rejected', cancel: 'cancelled' };
    function xcCell(mid, day) { if (!day) return null; var s = (SV.T.schedule || []).filter(function (x) { return x.employee_id === mid && x.day === day; })[0]; return s ? { kind: s.kind, t_start: s.t_start || null, t_end: s.t_end || null, xchg_id: null } : null; }
    function xcRow(s) {
      var live = s.status === 'new' || s.status === 'peer_yes';
      return { id: s.id, kind: s.to_day ? 'swap' : 'give', from_id: s.from_member, to_id: s.to_member, day: s.from_day, from_day: s.from_day, to_day: s.to_day || null, status: XST[s.status] || s.status, sv_status: s.status,
        note: s.note, created_at: s.created_at, peer_at: s.peer_at, boss_at: s.decided_at, decided_by: s.decided_by, decided_at: s.decided_at, cancel_at: s.cancelled_at, boss_id: null,
        cells: live ? { fA: xcCell(s.from_member, s.from_day), tA: xcCell(s.to_member, s.from_day), fB: s.to_day ? xcCell(s.from_member, s.to_day) : null, tB: s.to_day ? xcCell(s.to_member, s.to_day) : null } : {} };
    }
    /* замена заболевшего: строка sub_requests → shift_swaps демо (w9-swap) */
    function subRow(x) {
      var pk = x.absent_prev && x.absent_prev.kind ? kindCode(x.absent_prev.kind, x.absent_prev.preset_id) : null;
      return { id: x.id, dept_id: dl(x.dept_id), day: x.day, kind: x.preset_id ? 'p' + x.preset_id : 'u', t_start: t8(x.t_start), t_end: t8(x.t_end), starts_at: x.starts_at, ends_at: x.ends_at,
        absent_id: x.absent_id, reason: x.reason, note: x.note, status: x.status, absent_prev_kind: pk, absent_set_kind: x.absent_set_kind === 'sick' ? 'b' : null,
        created_by: x.created_by, created_at: x.created_at, filled_by: x.filled_by, filled_at: x.filled_at, closed_by: x.closed_by, closed_at: x.closed_at };
    }
    var TS = { returned: 'work' };
    function taskRow(t) {
      return { id: t.id, title: t.title, notes: t.notes, assignee_id: t.assignee_id, created_by: t.created_by, day: t.day, due_time: t8(t.due_time), status: TS[t.status] || t.status, sv_status: t.status, returned: t.status === 'returned',
        urgent: !!t.urgent, needs_photo: !!t.needs_photo, template_id: t.template_id, checklist_id: t.checklist_id, dept_id: dl(t.dept_id), submit_no: t.submit_no, done_at: t.done_at, created_at: t.created_at, updated_at: t.updated_at, project: null };
    }
    SV.map = { memRow: memRow, schRow: schRow, attRow: attRow, notRow: notRow, taskRow: taskRow, schKind: schKind, xcRow: xcRow, subRow: subRow, kindCode: kindCode };

    async function load(dom, force) {
      if (!V()) return;
      if (dom !== 'base' && !SV.at.base) await load('base');
      if (!force && SV.at[dom] && Date.now() - SV.at[dom] < TTL) return;
      if (SV.busy[dom]) return SV.busy[dom];
      SV.busy[dom] = (async function () { try { await DOM[dom](); SV.at[dom] = Date.now(); } catch (e) { SV.log.push({ dom: dom, e: e && e.message }); if (!SV.at[dom]) throw e; } finally { SV.busy[dom] = null; } })();
      return SV.busy[dom];
    }
    SV.load = load;
    SV.stale = function () { [].slice.call(arguments).forEach(function (d) { SV.at[d] = 0; }); };
    SV.refresh = async function () { var L = [].slice.call(arguments); for (var i = 0; i < L.length; i++) await load(L[i], true); };

    /* ----- выполнение запроса к учебной таблице ----- */
    SV.exec = async function (qq) {
      try {
        var t = qq.t, dom = TD[t];
        if (qq.op === 'select') {
          if (dom) { if (!V()) return { data: qq.one ? null : [], error: null }; await load(dom); return qq.pick(SV.T[t] || []); }
          if (!LOCAL[t]) miss('table', t, 'нет в ядре сервера — пустой ответ');
          return qq.pick(SV.T[t] || []);
        }
        var w = WR[t];
        if (w && dom && V()) await load(dom);
        if (!w) {
          if (LOCAL[t]) return localWrite(qq);
          miss('write', t + '.' + qq.op, 'запись не переносится на сервер'); return localWrite(qq);
        }
        var res = await w(qq);
        if (res && res.error) return { data: null, error: res.error };
        if (dom) await load(dom, true);
        if (res && res.rows) { var rr = res.rows; return { data: qq.one ? rr[0] || null : rr, error: null }; }
        if (qq.op === 'update' && dom) { var up = (SV.T[t] || []).filter(function (r) { return qq.match1(r); }); return { data: qq.one ? up[0] || null : up, error: null }; }
        return { data: res && res.data !== undefined ? res.data : null, error: null };
      } catch (e) { return { data: null, error: e && e.message ? e : E(String(e)) }; }
    };
    var seq = 9e8;
    function localWrite(qq) {
      var T = SV.T[qq.t] = SV.T[qq.t] || [];
      if (qq.op === 'insert' || qq.op === 'upsert') {
        var out = qq.payload.map(function (p) {
          var ex = qq.op === 'upsert' ? T.filter(function (r) { return qq.conf.every(function (c) { return eqv(r[c], p[c]); }); })[0] : null;
          if (ex) { Object.assign(ex, p); return ex; } var r = Object.assign({ id: ++seq, created_at: new Date().toISOString() }, p); T.push(r); return r;
        });
        return { data: qq.one ? clone(out[0]) : clone(out), error: null };
      }
      if (qq.op === 'update') { var up = T.filter(function (r) { return qq.match1(r); }); up.forEach(function (r) { Object.assign(r, qq.payload); }); return { data: clone(up), error: null }; }
      SV.T[qq.t] = T.filter(function (r) { return !qq.match1(r); }); return { data: null, error: null };
    }
    function rows(t, ids) { ids = [].concat(ids).map(String); return (SV.T[t] || []).filter(function (r) { return ids.indexOf(String(r.id)) >= 0; }); }
    async function call(n, a) { var r = await real.rpc(n, a); if (r.error) throw r.error; return r.data; }
    function target(qq, t) { var id = qq.val('id'); if (id !== undefined) return rows(t, id); return (SV.T[t] || []).filter(function (r) { return qq.match1(r); }); }

    /* ----- переводчики записи: учебная таблица → rpc / таблица сервера ----- */
    var KIND2 = { o: 'off', h: 'vacation', b: 'sick' };
    async function schPut(r) { return call('schedule_set', schP(r)); }
    /* dn (п. 9): вся неделя одной rpc schedule_set_many (0018); если её ещё нет на сервере — по одной клетке, как раньше */
    async function schPutMany(L) {
      if (L.length < 2) { for (var i = 0; i < L.length; i++) await schPut(L[i]); return; }
      var rowsP = L.map(function (r) { var p = schP(r); return { member: p.p_member, day: p.p_day, kind: p.p_kind, preset: p.p_preset, start: p.p_start, end: p.p_end }; });
      var x = await real.rpc('schedule_set_many', { p_rows: rowsP });
      if (!x.error) return;
      if (x.error.code === 'PGRST202' || /schedule_set_many/.test(x.error.message || '')) { miss('rpc', 'schedule_set_many', 'нет на сервере — клетки по одной'); for (var j = 0; j < L.length; j++) await schPut(L[j]); return; }
      throw x.error;
    }
    function schP(r) {
      var k = r.kind, p = { p_member: r.employee_id, p_day: r.day, p_kind: 'work', p_preset: null, p_start: r.t_start ? String(r.t_start).slice(0, 5) : null, p_end: r.t_end ? String(r.t_end).slice(0, 5) : null, p_week: false };
      if (KIND2[k]) { p.p_kind = KIND2[k]; p.p_start = p.p_end = null; }
      else if (/^p\d+$/.test(k)) p.p_preset = +k.slice(1);
      else if (!p.p_start) { var e = (SV.T.employees || []).filter(function (x) { return x.id === r.employee_id; })[0]; var st = (SV.T.shift_types || []).filter(function (s) { return e && s.dept_id === e.dept_id && s.active; }); if (st.length) p.p_preset = st[0].id; }
      return p;
    }
    var WR = {
      schedule: async function (qq) {
        if (qq.op === 'delete') { var m = qq.val('employee_id'), d = qq.val('day'); if (!m || !d) throw E('Нужны сотрудник и день', 'bad_input'); await call('schedule_clear', { p_member: m, p_day: d, p_week: false }); return {}; }
        if (qq.op === 'update') {
          var p0 = qq.payload, L = target(qq, 'schedule');
          if (p0.confirmed && Object.keys(p0).every(function (k) { return k === 'confirmed' || k === 'confirmed_at'; })) { miss('write', 'schedule.confirmed', 'подтверждение смены идёт через notify_answer'); return {}; }
          if (!L.length && qq.val('employee_id') && qq.val('day')) L = [{ employee_id: qq.val('employee_id'), day: qq.val('day'), kind: 'u' }];
          await schPutMany(L.map(function (x) { return Object.assign({}, x, p0); })); return {};
        }
        await schPutMany(qq.payload); return {};
      },
      shift_types: async function (qq) {
        if (qq.op === 'delete') { var L0 = target(qq, 'shift_types'); for (var a = 0; a < L0.length; a++) await call('preset_delete', { p_id: L0[a].id, p_force: false }); return {}; }
        if (qq.op === 'update') {
          var L = target(qq, 'shift_types'), p = qq.payload, out = [];
          for (var i = 0; i < L.length; i++) {
            var s = L[i];
            if (p.active === false && Object.keys(p).length === 1) { await call('preset_delete', { p_id: s.id, p_force: false }); continue; }
            await call('preset_save', { p_id: s.id, p_dept: ds(p.dept_id || s.dept_id), p_name: p.name || s.name, p_name_uz: p.name_uz || s.name_uz || null, p_start: String(p.start_time || s.start_time).slice(0, 5), p_end: String(p.end_time || s.end_time).slice(0, 5), p_sort: p.sort != null ? p.sort : s.sort });
            out.push(s.id);
          }
          await load('base', true); return { rows: rows('shift_types', out) };
        }
        var ids = [];
        for (var j = 0; j < qq.payload.length; j++) { var r = qq.payload[j]; ids.push(await call('preset_save', { p_id: null, p_dept: ds(r.dept_id), p_name: r.name, p_name_uz: r.name_uz || null, p_start: String(r.start_time).slice(0, 5), p_end: String(r.end_time).slice(0, 5), p_sort: r.sort || 0 })); }
        await load('base', true); return { rows: rows('shift_types', ids) };
      },
      notifications: async function (qq) {
        if (qq.op === 'insert') return notifySend(qq.payload);
        if (qq.op === 'update') {
          var p = qq.payload, L = target(qq, 'notifications'), ids = L.map(function (n) { return n.id; });
          if (p.ans || p.answer) { for (var i = 0; i < ids.length; i++) await call('notify_answer', { p_id: ids[i], p_answer: (p.ans || p.answer) === 'late' ? 'late' : 'coming', p_minutes: p.minutes || null }); return {}; }
          if (p.read_at !== undefined && ids.length) { await call('notify_read', { p_ids: ids }); return {}; }
          if (!ids.length && qq.val('employee_id') && p.read_at) { var mine = (SV.T.notifications || []).filter(function (n) { return !n.read_at; }).map(function (n) { return n.id; }); if (mine.length) await call('notify_read', { p_ids: mine }); return {}; }
          miss('write', 'notifications.update', 'на сервере меняются только «прочитано» и ответ'); return {};
        }
        miss('write', 'notifications.' + qq.op); return {};
      },
      hotel_settings: async function (qq) { var p = Object.assign({}, qq.payload); delete p.id; return settingsSave(p); },
      cb_forgot: async function (qq) {
        if (qq.op === 'insert') {
          var ids = [];
          for (var i = 0; i < qq.payload.length; i++) {
            var r = qq.payload[i], src = r.src === 'forgot' ? 'forgot' : 'explain', act = r.kind === 'both' || r.kind === 'out' || r.kind === 'in' ? r.kind : 'in';
            ids.push(await call('clock_request', { p_src: src, p_action: act, p_day: r.day, p_at: r.at, p_at2: r.at2 || null, p_why: r.why || null, p_note: r.note || r.reason || null, p_lat: r.pos && r.pos.lat || null, p_lng: r.pos && r.pos.lng || null }));
          }
          await load('req', true); SV.stale('att'); return { rows: rows('cb_forgot', ids) };
        }
        if (qq.op === 'update' && qq.payload.status) { var L = target(qq, 'cb_forgot'); for (var j = 0; j < L.length; j++) if (L[j].status === 'new' && (qq.payload.status === 'yes' || qq.payload.status === 'no')) await call('clock_request_decide', { p_id: L[j].id, p_yes: qq.payload.status === 'yes', p_note: qq.payload.decide_note || null }); SV.stale('att'); return {}; }
        miss('write', 'cb_forgot.' + qq.op); return {};
      },
      ca_advances: async function (qq) {
        if (qq.op === 'insert') { var ids = []; for (var i = 0; i < qq.payload.length; i++) { var r = await call('advance_request', { p_amount: qq.payload[i].amount, p_reason: qq.payload[i].reason || null }); ids.push(r && (r.id || r.advance_id)); } await load('req', true); return { rows: rows('ca_advances', ids) }; }
        if (qq.op === 'update') {
          var L = target(qq, 'ca_advances'), st = qq.payload.status;
          for (var j = 0; j < L.length; j++) {
            if (st === 'yes' || st === 'no') await call('advance_decide', { p_id: L[j].id, p_yes: st === 'yes', p_note: qq.payload.decide_note || null });
            else if (st === 'paid') await call('advance_paid', { p_id: L[j].id });
            else miss('write', 'ca_advances.update', 'меняется только статус');
          }
          return {};
        }
        miss('write', 'ca_advances.' + qq.op); return {};
      },
      ca_adj: async function (qq) {
        if (qq.op === 'insert') { for (var i = 0; i < qq.payload.length; i++) await adjAdd(qq.payload[i]); return {}; }
        if (qq.op === 'update' && qq.payload.deleted) { var L = target(qq, 'ca_adj'); for (var j = 0; j < L.length; j++) await call('adj_cancel', { p_id: L[j].id }); return {}; }
        miss('write', 'ca_adj.' + qq.op); return {};
      },
      jc_nprefs: async function (qq) {
        var p = qq.op === 'update' ? qq.payload : qq.payload[0], mid = qq.val('employee_id') || p.employee_id || (SV.me && SV.me.id);
        var r = await real.from('notify_prefs').upsert({ venue_id: V(), member_id: mid, kinds: p.on || {}, updated_at: new Date().toISOString() }, { onConflict: 'member_id' });
        if (r.error) throw r.error; return {};
      },
      announcements: async function (qq) {
        if (qq.op !== 'insert') { miss('write', 'announcements.' + qq.op, 'объявление меняется только созданием'); return {}; }
        var ids = [];
        for (var i = 0; i < qq.payload.length; i++) {
          var a = qq.payload[i], aud = a.employee_id ? 'member' : a.position_id ? 'position' : a.dept_id ? 'dept' : 'all';
          var r = await call('ann_create', { p_title_ru: a.title, p_body_ru: a.body || '', p_title_uz: a.title_uz || null, p_body_uz: a.body_uz || null, p_audience: aud, p_dept: ds(a.dept_id), p_position: a.position_id || null, p_member: a.employee_id || null, p_need_ack: !!a.need_ack, p_pinned: !!a.pinned });
          ids.push(r && r.id);
        }
        await load('ann', true); return { rows: rows('announcements', ids) };
      },
      announcement_reads: async function (qq) {
        var L = qq.op === 'update' ? [qq.payload] : qq.payload;
        for (var i = 0; i < L.length; i++) { var x = L[i], aid = x.ann_id || qq.val('ann_id'); if (x.acked_at) await call('ann_ack', { p_id: aid }); else { var r = await real.from('announcement_reads').upsert({ venue_id: V(), ann_id: aid, member_id: SV.me.id, read_at: x.read_at || new Date().toISOString() }, { onConflict: 'ann_id,member_id' }); if (r.error) throw r.error; } }
        return {};
      },
      schedule_requests: async function (qq) {
        if (qq.op === 'insert') { var ids = []; for (var i = 0; i < qq.payload.length; i++) { var r = qq.payload[i]; if (r.kind === 'swap') { miss('write', 'schedule_requests.swap', 'обмен — rpc swap_request'); continue; } ids.push(await call('leave_create', { p_kind: r.kind === 'off' ? 'dayoff' : r.kind, p_from: r.day, p_to: r.day_to || r.day, p_from_time: null, p_minutes: null, p_reason: r.note || r.reason || null })); } await load('req', true); return { rows: rows('schedule_requests', ids) }; }
        if (qq.op === 'update' && qq.payload.status) { var L = target(qq, 'schedule_requests'); for (var j = 0; j < L.length; j++) { var s = qq.payload.status; if (s === 'cancel') await call('leave_cancel', { p_id: L[j].id }); else await call('leave_decide', { p_id: L[j].id, p_ok: s === 'yes' || s === 'approved', p_note: qq.payload.decide_note || null }); } SV.stale('sched'); return {}; }
        miss('write', 'schedule_requests.' + qq.op); return {};
      },
      leave_requests: async function (qq) {
        if (qq.op === 'insert') { var ids = []; for (var i = 0; i < qq.payload.length; i++) { var r = qq.payload[i], k = r.kind === 'absent' ? 'dayoff' : r.kind; ids.push(await call('leave_create', { p_kind: k, p_from: r.day, p_to: r.day_to || r.day, p_from_time: r.from_time ? String(r.from_time).slice(0, 5) : null, p_minutes: r.minutes || null, p_reason: r.reason || r.note || null })); } await load('req', true); return { rows: rows('leave_requests', ids) }; }
        if (qq.op === 'update' && qq.payload.status) { var L = target(qq, 'leave_requests'); for (var j = 0; j < L.length; j++) { var s = qq.payload.status; if (s === 'cancel' || s === 'cancelled') await call('leave_cancel', { p_id: L[j].id }); else await call('leave_decide', { p_id: L[j].id, p_ok: ['yes', 'approved', 'ok'].indexOf(s) >= 0, p_note: qq.payload.decide_note || null }); } SV.stale('sched'); return {}; }
        miss('write', 'leave_requests.' + qq.op); return {};
      },
      tasks: async function (qq) {
        if (qq.op === 'insert') {
          var ids = [];
          for (var i = 0; i < qq.payload.length; i++) {
            var t = qq.payload[i], ck = t.checklist || t.items || null;
            /* чек-лист, собранный на экране постановки (92d CD_NEW), — сразу в task_create (p_checklist) */
            if (!ck && SV.hooks.ckFor) { try { ck = SV.hooks.ckFor(t) || null; } catch (e) { ck = null; } }
            if (Array.isArray(ck)) ck = ck.map(function (x) { return { t: x.t || x.text, ph: x.ph || x.needs_photo ? 1 : 0 }; }).filter(function (x) { return x.t; });
            if (Array.isArray(ck) && !ck.length) ck = null;
            ids.push(await call('task_create', { p_title: t.title, p_notes: t.notes || null, p_assignee: t.assignee_id || null, p_dept: ds(t.dept_id), p_day: t.day || tday(), p_due: t.due_time ? String(t.due_time).slice(0, 5) : null, p_needs_photo: !!t.needs_photo, p_checklist: ck, p_urgent: !!t.urgent }));
          }
          await load('tasks', true); return { rows: rows('tasks', ids) };
        }
        var L = target(qq, 'tasks');
        if (qq.op === 'delete') { for (var a = 0; a < L.length; a++) await call('task_cancel', { p_id: L[a].id }); return { rows: L.map(function (x) { return Object.assign({}, x, { status: 'cancel' }); }) }; }
        /* правка задачи (название, описание, исполнитель, срок, срочность, «фото обязательно») — rpc task_update, только изменённые поля */
        var p = qq.payload, ED = { title: 1, notes: 1, assignee_id: 1, day: 1, due_time: 1, urgent: 1, needs_photo: 1 };
        var other = Object.keys(p).filter(function (k) { return !ED[k] && ['status', 'updated_at', 'done_at', 'photo_path', 'review_note', 'grade', 'created_by'].indexOf(k) < 0; });
        if (other.length) miss('write', 'tasks.update(' + other.join(',') + ')', 'эти поля задачи сервер не меняет');
        for (var e = 0; e < L.length; e++) {
          var ch = {}, t0 = L[e];
          Object.keys(ED).forEach(function (k) {
            if (p[k] === undefined) return; var v = p[k];
            if (k === 'due_time') { v = v ? String(v).slice(0, 5) : null; if (v === (t0.due_time ? String(t0.due_time).slice(0, 5) : null)) return; }
            else if (k === 'urgent' || k === 'needs_photo') { v = !!v; if (v === !!t0[k]) return; }
            else if (k === 'notes') { v = v || null; if (v === (t0.notes || null)) return; }
            else if (v === t0[k]) return;
            ch[k] = v;
          });
          if (Object.keys(ch).length) await call('task_update', { p_id: t0.id, p: ch });
        }
        if (p.status) for (var j = 0; j < L.length; j++) await taskStatus(L[j], p.status, p);
        return {};
      },
      task_templates: async function (qq) {
        var L = qq.op === 'insert' ? qq.payload.map(function (x) { return Object.assign({ id: null, active: true }, x); }) : target(qq, 'task_templates').map(function (x) { return Object.assign({}, x, qq.op === 'delete' ? { active: false } : qq.payload); });
        for (var i = 0; i < L.length; i++) { var t = L[i]; await call('task_template_save', { p_id: t.id, p_title: t.title, p_title_uz: t.title_uz || null, p_notes: t.notes || null, p_assignee: t.employee_id || null, p_position: t.position_id || null, p_dept: ds(t.dept_id), p_weekdays: t.weekdays || [1, 2, 3, 4, 5, 6, 7], p_due: t.due_time ? String(t.due_time).slice(0, 5) : null, p_needs_photo: !!t.needs_photo, p_checklist: t.checklist_id || null, p_active: t.active !== false }); }
        return {};
      },
      departments: async function (qq) {
        if (qq.op === 'insert') { for (var i = 0; i < qq.payload.length; i++) { var d = qq.payload[i]; var r = await real.from('departments').insert({ venue_id: V(), code: /^[a-z][a-z0-9_]{0,31}$/.test(String(d.id || '')) ? d.id : /^[a-z][a-z0-9_]{0,31}$/.test(String(d.code || '')) ? d.code : 'd' + Date.now().toString(36) + i, name: d.name, name_uz: d.name_uz || null, sort: d.sort || 0, parent_id: ds(d.parent_id) }); if (r.error) throw r.error; } await load('base', true); return {}; }
        var L = target(qq, 'departments');
        for (var j = 0; j < L.length; j++) { var r2 = qq.op === 'delete' ? await real.from('departments').delete().eq('id', L[j].sid) : await real.from('departments').update(pick(qq.payload, ['name', 'name_uz', 'sort'])).eq('id', L[j].sid); if (r2.error) throw r2.error; }
        await load('base', true); return {};
      },
      positions: async function (qq) {
        if (qq.op === 'insert') { var ids = []; for (var i = 0; i < qq.payload.length; i++) { var p = qq.payload[i]; var r = await real.from('positions').insert({ venue_id: V(), dept_id: ds(p.dept_id), name: p.name, name_uz: p.name_uz || null, sort: p.sort || 0 }).select('id').single(); if (r.error) throw r.error; ids.push(r.data.id); } await load('base', true); return { rows: rows('positions', ids) }; }
        var L = target(qq, 'positions');
        for (var j = 0; j < L.length; j++) { var o = pick(qq.payload, ['name', 'name_uz', 'sort']); if (qq.payload.dept_id) o.dept_id = ds(qq.payload.dept_id); var r2 = qq.op === 'delete' ? await real.from('positions').delete().eq('id', L[j].id) : await real.from('positions').update(o).eq('id', L[j].id); if (r2.error) throw r2.error; }
        await load('base', true); return {};
      },
      health_checks: async function (qq) {
        if (qq.op === 'insert') { var h = qq.payload[0]; SV.health = { day: h.day || tday(), answers: h.a || h.answers || {}, ok: h.ok }; return { rows: [Object.assign({ id: -1, status: h.ok ? 'ok' : 'wait' }, h)] }; }
        if (qq.op === 'update' && qq.payload.status) { var L = target(qq, 'health_checks'); for (var i = 0; i < L.length; i++) await call('health_decide', { p_id: L[i].id, p_ok: qq.payload.status === 'admit' || qq.payload.status === 'ok', p_note: qq.payload.note || null }); return {}; }
        miss('write', 'health_checks.' + qq.op); return {};
      },
      attendance: async function (qq) {
        /* отметки пишет только сервер (rpc clock / clock_request_decide / zone_decide / late_explain); прямые правки демо — без действия */
        var p = qq.payload || {}, L = qq.op === 'update' ? target(qq, 'attendance') : [];
        /* 92m: «Подтвердить / причина принята» (mgr_ok_at) — rpc late_accept (0017); у отметки вне зоны дальше идёт zone_decide */
        if (qq.op === 'update' && p.mgr_ok_at !== undefined) { for (var k = 0; k < L.length; k++) if ((L[k].late_min || 0) > 0) await call('late_accept', { p_att: L[k].id, p_yes: !!p.mgr_ok_at, p_note: p.mgr_ok_note || null }); if (!p.zone_ok && !p.zone_no) return {}; }
        if (qq.op === 'update' && (p.zone_ok || p.zone_no)) { for (var i = 0; i < L.length; i++) await call('zone_decide', { p_att: L[i].id, p_yes: !!p.zone_ok, p_note: p.zone_note || null }); return {}; }
        if (qq.op === 'update' && (p.explain_text || p.late_why)) { for (var j = 0; j < L.length; j++) await call('late_explain', { p_att: L[j].id, p_why: lateWhy(p.late_why), p_note: p.explain_text || null }); return {}; }
        miss('write', 'attendance.' + qq.op, 'отметки меняет только сервер'); return {};
      },
      cb_pins: async function (qq) {
        /* PIN планшета: на сервере только bcrypt-хэш своего PIN (pin_set); открытые PIN других людей не хранятся нигде */
        var L = qq.op === 'update' ? [Object.assign({ employee_id: qq.val('employee_id') }, qq.payload)] : qq.payload || [];
        for (var i = 0; i < L.length; i++) if (SV.me && L[i].employee_id === SV.me.id && L[i].pin) await call('pin_set', { p_pin: String(L[i].pin) });
        localWrite(qq); return {};
      },
      quiz_attempts: async function () { miss('write', 'quiz_attempts', 'тест пишет rpc quiz_submit'); return {}; },
      payslips: async function () { miss('write', 'payslips', 'листы — rpc payslip_*'); return {}; },
      payslip_lines: async function () { miss('write', 'payslip_lines', 'строки листа считает сервер'); return {}; },
      staff_devices: async function (qq) {
        if (qq.op !== 'update') { miss('write', 'staff_devices.' + qq.op, 'телефон привязывает отметка'); return {}; }
        var L = target(qq, 'staff_devices'), bl = !!qq.payload.blocked;
        for (var i = 0; i < L.length; i++) await call(bl ? 'device_block' : 'device_reset', bl ? { p_id: L[i].id, p_on: true } : { p_id: L[i].id });
        return { rows: L };
      },
      employees: async function (qq) {
        if (qq.op === 'update') { var L = target(qq, 'employees'); for (var i = 0; i < L.length; i++) { var o = pick(qq.payload, ['first_name', 'last_name', 'phone', 'hire_date', 'gender', 'lang']); if (qq.payload.photo !== undefined) o.photo_path = qq.payload.photo; if (Object.keys(o).length) await call('member_update', { p_id: L[i].id, p: o }); } await load('base', true); return {}; }
        miss('write', 'employees.' + qq.op, 'сотрудника добавляет staff-admin → member_invite'); return {};
      }
    };
    /* dn (п. 4): уведомление с телефона → rpc notify_send (0018: права — владелец всем, руководитель своей команде, сотрудник своему руководителю).
       «Прочитайте объявление» → ann_remind (сервер сам находит непрочитавших; один вызов на объявление за 10 с). */
    var SREFT = { xchg: 'swap', swap: 'sub' }, annRem = {};
    async function notifySend(L) {
      var out = [], err0 = null, mine = false;
      for (var i = 0; i < L.length; i++) {
        var p = L[i], to = p.employee_id || p.member_id, fake = Object.assign({ id: -(Date.now() + i), at: new Date().toISOString() }, p);
        if (!to) continue;
        if (p.kind === 'ann_rem' && p.ref_type === 'ann' && p.ref_id != null) {
          var k = String(p.ref_id); if (!annRem[k] || Date.now() - annRem[k] > 10000) { annRem[k] = Date.now(); var a = await real.rpc('ann_remind', { p_id: +p.ref_id }); if (a.error) { err0 = a.error; continue; } }
          out.push(fake); continue;
        }
        var rt = p.ref_type ? (SREFT[p.ref_type] || String(p.ref_type)).toLowerCase() : null; if (rt && !/^[a-z_]{1,32}$/.test(rt)) rt = null;
        var r = await real.rpc('notify_send', { p_to: [to], p_kind: p.kind || 'info', p_title: String(p.title || '').slice(0, 200) || 'Jamoa', p_body: p.body ? String(p.body).slice(0, 2000) : null,
          p_ref_type: rt, p_ref_id: p.ref_id == null ? null : String(p.ref_id).slice(0, 64), p_urgent: !!p.urgent });
        if (r.error) { if (r.error.code === 'PGRST202') miss('rpc', 'notify_send', 'нет на сервере (0018 не загружена)'); err0 = r.error; continue; }
        var ids = (r.data && r.data.sent) || []; if (SV.me && to === SV.me.id) mine = true;
        out.push(ids.length ? Object.assign(fake, { id: ids[0] }) : fake);
      }
      if (mine) SV.stale('notif');
      if (!out.length && err0) return { error: err0 };
      return { rows: out };
    }
    function pick(o, ks) { var r = {}; ks.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; }
    function lateWhy(w) { return ['transport', 'family', 'warned', 'other'].indexOf(w) >= 0 ? w : 'other'; }
    async function adjAdd(r) {
      var mid = r.emp_id || r.employee_id; return call('adj_add', { p_member: mid, p_kind: r.kind === 'fine' ? 'fine' : 'bonus', p_amount: Math.abs(+r.amount || 0), p_reason_code: r.reason_code || null, p_reason: r.reason || (r.kind === 'fine' ? 'Штраф' : 'Премия'), p_note: r.note || null, p_day: r.day || tday(), p_src: ['card', 'late', 'task', 'acc', 'award'].indexOf(r.src) >= 0 ? r.src : 'card', p_ref_type: r.ref ? (r.src === 'task' ? 'task' : r.src === 'late' ? 'attendance' : null) : null, p_ref_id: typeof r.ref === 'number' ? r.ref : null });
    }
    SV.adjAdd = async function (r) { var x = await adjAdd(r); await load('req', true); return x; };
    async function taskStatus(t, st, extra) {
      extra = extra || {}; var cur = t.sv_status || t.status, mineAs = SV.me && t.assignee_id === SV.me.id;
      if (st === 'cancel') return call('task_cancel', { p_id: t.id });
      if (st === 'work' || st === 'new') {
        if (cur === 'review' && !mineAs) return call('task_review', { p_id: t.id, p_accept: false, p_grade: extra.grade || null, p_comment: extra.review_note || extra.comment || null });
        if (cur === 'new' || cur === 'returned') return call('task_take', { p_id: t.id });
        if (cur === 'done') return call('task_reopen', { p_id: t.id, p_reason: extra.p_reason || extra.reason || 'Отменено «Выполнено»' });
        return null;
      }
      if (st === 'done' || st === 'review') {
        if (cur === 'review' && !mineAs) return call('task_review', { p_id: t.id, p_accept: true, p_grade: extra.grade || null, p_comment: extra.comment || null });
        if (cur === 'new' || cur === 'returned') { try { await call('task_take', { p_id: t.id }); } catch (e) {} }
        return call('task_submit', { p_id: t.id });
      }
      miss('rpc', 'task_status:' + st); return null;
    }
    SV.taskStatus = taskStatus;
    async function settingsSave(p) {
      var KEYS = { radius_m: 1, lat: 1, lng: 1, geo_mode: 1, photo_in: 1, late_grace_min: 1, early_clock_min: 1, auto_close_h: 1, forgot_days: 1, noshow_min: 1, health_log: 1, health_dept_ids: 1, kiosk_on: 1, adv_limit_pct: 1, mgr_sees_earn: 1, foreign_reg_h: 1, district: 1, name: 1, lang: 1, offline_max_min: 1, adj_max: 1, mgr_bonus_max: 1 };
      var ALIAS = { cb_radius: 'radius_m', cb_early_min: 'early_clock_min', cb_auto_h: 'auto_close_h', cb_health: 'health_log', cb_kiosk: 'kiosk_on', org_name: 'name', require_geo: null };
      var top = {}, pf = {};
      Object.keys(p || {}).forEach(function (k) {
        var v = p[k], a = ALIAS[k];
        if (a === null) { top.geo_mode = v ? 'soft' : 'off'; return; }
        if (a) { if (a === 'radius_m') v = Math.max(25, Math.min(500, +v || 150)); top[a] = v; pf[k] = v; return; }
        if (KEYS[k]) { if (k === 'radius_m') v = Math.max(25, Math.min(500, +v || 150)); top[k] = v; return; }
        if (k === 'venue_profile' && v && typeof v === 'object') { v = Object.assign({}, v); }   /* dn: анкету сохраняем целиком (staff нужен «Карте» и счётчикам) */
        pf[k] = v;
      });
      if (Object.keys(pf).length) top.prefs = pf;
      if (!Object.keys(top).length) return {};
      if (!SV.me || SV.me.role !== 'owner') { miss('rpc', 'venue_settings_save(не владелец)', 'настройки сохраняет только владелец'); return { error: E('Настройки заведения меняет владелец', 'no_rights') }; }   /* dn: не молча */
      var d = await call('venue_settings_save', { p: top }); await load('base', true);
      if (pf.earn_rules && SV.hooks.paySync) { try { await SV.hooks.paySync(pf.earn_rules); } catch (e) { SV.log.push({ t: 'pay_sync', e: e && e.message }); } }   /* dn (п. 2) */
      return { data: d };
    }
    SV.settingsSave = settingsSave;

    /* ----- rpc демо → rpc сервера ----- */
    var PASS = { password_changed: 1, leave_decide: 1, ann_ack: 1, payslip_publish: 1, payslip_paid: 1, month_close: 1, month_reopen: 1, now_in_venue: 1, pending_all: 1, earn_today: 1, my_month: 1, member_month: 1,
      timesheet: 1, rating: 1, rating_recalc: 1, award_grant: 1, adj_add: 1, adj_cancel: 1, advance_request: 1, advance_decide: 1, advance_paid: 1, payslip_ask: 1, payslip_answer: 1, revenue_set: 1, earn_recalc: 1,
      task_create: 1, task_take: 1, task_item_done: 1, task_photo_add: 1, task_submit: 1, task_review: 1, task_cancel: 1, task_template_save: 1, tasks_generate_daily: 1, checklists_reset: 1, task_report: 1,
      schedule_set: 1, schedule_clear: 1, schedule_publish: 1, preset_save: 1, preset_delete: 1, presets_reset: 1, swap_request: 1, swap_decide: 1, leave_create: 1, leave_cancel: 1,
      clock: 1, clock_request: 1, clock_request_decide: 1, zone_decide: 1, health_decide: 1, pin_set: 1, kiosk_pair: 1, kiosk_unpair: 1, kiosk_mark: 1, delay_decide: 1, adj_decide: 1, checklist_save: 1, quiz_question_save: 1,
      notify_read: 1, notify_answer: 1, ann_create: 1, ann_unread: 1, ann_remind: 1, venue_settings_save: 1, member_invite: 1, invite_accept: 1, member_update: 1, member_transfer: 1, member_archive: 1, pay_rule_set: 1, my_profile: 1,
      venue_create: 1, colleagues: 1, quiz_reset: 1, founder_summary: 1, founder_venues: 1,
      pay_sync: 1, notify_send: 1, devices_list: 1, device_reset: 1, device_block: 1, schedule_set_many: 1, set_my_birth_date: 1, set_my_contact: 1,   /* dn: 0018 */
      task_update: 1, task_reopen: 1, swap_cancel: 1, founder_report: 1, notify_me: 1, sub_candidates: 1, sub_request: 1, sub_offer_more: 1, sub_take: 1, sub_cancel: 1, late_accept: 1, late_remind: 1 /* 92m: 0017 */ };
    var AFTER = { leave_decide: ['req', 'sched'], ann_ack: ['ann'], swap_answer: ['req'], swap_decide: ['req', 'sched'], payslip_publish: ['pay'], payslip_paid: ['pay'], payslip_prepare: ['pay'], adj_add: ['req'], adj_cancel: ['req'],
      advance_request: ['req'], advance_decide: ['req'], adj_decide: ['req'], delay_decide: ['att'], kiosk_mark: ['att'], advance_paid: ['req'], clock: ['att'], clock_request_decide: ['req', 'att'], zone_decide: ['att'], late_explain: ['att'], late_accept: ['att'], schedule_set: ['sched'], schedule_clear: ['sched'],
      notify_read: ['notif'], notify_answer: ['notif', 'sched'], task_take: ['tasks'], task_submit: ['tasks'], task_review: ['tasks'], task_cancel: ['tasks'], task_item_done: ['tasks'], task_photo_add: ['tasks'], tasks_generate_daily: ['tasks'],
      preset_save: ['base'], preset_delete: ['base'], presets_reset: ['base'], member_update: ['base'], member_transfer: ['base'], member_archive: ['base'], venue_settings_save: ['base'], quiz_submit: ['quiz'], password_changed: ['base'],
      task_update: ['tasks'], task_reopen: ['tasks'], swap_request: ['req'], swap_cancel: ['req'], sub_request: ['subs', 'sched'], sub_offer_more: ['subs'], sub_take: ['subs', 'sched'], sub_cancel: ['subs', 'sched'],
      kiosk_pair: ['base'], kiosk_unpair: ['base'], pin_set: ['base'], device_reset: ['dev'], device_block: ['dev'], month_close: ['pay'], month_reopen: ['pay'], pay_sync: ['pay'], quiz_question_save: ['qbank'], quiz_import: ['qbank'] };
    function ok(d) { return { data: d === undefined ? null : d, error: null }; }
    async function rr(n, a) { var r = await real.rpc(n, a || {}); if (!r.error && AFTER[n]) SV.stale.apply(null, AFTER[n]); return r; }
    var RPC = {
      task_status: async function (a) { await load('tasks'); var t = rows('tasks', a.p_id)[0]; if (!t) return { data: null, error: E('Задача не найдена', 'not_found') }; await taskStatus(t, a.p_status, a); await load('tasks', true); return ok(rows('tasks', a.p_id)[0] || null); },
      generate_daily_tasks: async function () { if (!SV.me || SV.me.role === 'staff' || SV.me.role === 'accountant') return ok(0); var r = await real.rpc('tasks_generate_daily', { p_day: tday() }); SV.stale('tasks'); return r.error ? ok(0) : r; },
      late_explain: async function (a) { var LW = { 'Транспорт, пробка': 'transport', 'Семейные обстоятельства': 'family', 'Предупредил руководителя': 'warned' }, w = a.p_why || LW[a.p_text] || null; /* 92m: готовая причина из 92b приходит текстом — сохраняем кодом, без дубля в late_note */ return rr('late_explain', { p_att: a.p_att, p_why: lateWhy(w), p_note: w && w !== 'other' ? null : (a.p_text || a.p_note || null) }); },
      prefs_save: async function (a) { try { var r = await settingsSave(a.p || {}); if (r && r.error) return { data: null, error: r.error }; var hs = (SV.T.hotel_settings || [])[0] || {}; return ok(Object.assign({ radius_m: hs.radius_m, late_grace_min: hs.late_grace_min, require_geo: hs.require_geo }, hs.prefs || {}, r && r.data ? {} : {})); } catch (e) { return { data: null, error: e }; } },
      quiz_today: async function (a) {
        var hs = (SV.T.hotel_settings || [])[0] || {}, n = Math.max(1, Math.min(20, +(a && a.p_count) || +((hs.prefs || {}).quiz_count) || 10));
        var r = await real.rpc('quiz_today', { p_count: n }); if (r.error) return r;
        var D = r.data || {}, day = D.day || tday(), key = (SV.me && SV.me.id) + '|' + day, c = SV.quizCache[key] || lsGet('sv-quiz:' + key);
        if (D.attempts > 0 && c) return ok(Object.assign({ day: day, done: true }, c));
        if (D.attempts > 0) { await load('quiz', true); var qa = (SV.T.quiz_attempts || []).filter(function (x) { return SV.me && x.employee_id === SV.me.id && x.day === day; })[0]; if (qa) return ok({ day: day, done: true, correct: qa.correct, total: qa.total, score: qa.correct * 10, sec: qa.sec, questions: [] }); }
        SV.quizQ = {}; (D.questions || []).forEach(function (q) { SV.quizQ[q.id] = q; });
        return ok({ day: day, done: false, attempts: D.attempts || 0, questions: (D.questions || []).map(function (q) { return { id: q.id, cat: q.cat, q_ru: q.q_ru, q_uz: q.q_uz, opts_ru: q.opts_ru, opts_uz: q.opts_uz, rep: !!q.repeat }; }) });
      },
      quiz_submit: async function (a) {
        var ids = a.p_qids || [], ans = a.p_answers || [], list = ids.map(function (id, i) { return { id: id, a: ans[i] == null ? -1 : ans[i] }; });
        var r = await real.rpc('quiz_submit', { p_answers: list, p_sec: a.p_sec == null ? null : Math.round(a.p_sec) }); if (r.error) return r; SV.stale('quiz');
        var R = r.data || {}, it = {}; (R.items || []).forEach(function (x) { it[x.id] = x; });
        var qs = ids.map(function (id, i) { var q = (SV.quizQ || {})[id] || { id: id }; var x = it[id] || {}; return { id: id, cat: q.cat, q_ru: q.q_ru, q_uz: q.q_uz, opts_ru: q.opts_ru, opts_uz: q.opts_uz, correct: x.correct, expl_ru: x.expl_ru, expl_uz: x.expl_uz, ans: ans[i] }; });
        var day = tday(), c = { correct: R.correct, total: R.total, score: (R.correct || 0) * 10, sec: a.p_sec, attempt: R.attempt, eligible: R.eligible, questions: qs };
        SV.quizCache[(SV.me && SV.me.id) + '|' + day] = c; lsSet('sv-quiz:' + (SV.me && SV.me.id) + '|' + day, c);
        return ok(Object.assign({ day: day, done: true }, c));
      },
      quiz_import: async function (a) { var L = (a.p || a.p_rows || []).map(function (x) { return { cat: x.cat || 'own', q_ru: x.q_ru || x.q, q_uz: x.q_uz || null, opts_ru: x.opts_ru || x.opts, opts_uz: x.opts_uz || null, correct: x.correct, expl_ru: x.expl_ru || x.expl || null, expl_uz: x.expl_uz || null }; }); return rr('quiz_import', { p_rows: L }); },
      staff_rating: async function (a) {
        var ym = String((a && (a.p_from || a.p_to)) || tday()).slice(0, 7), r = await real.rpc('rating', { p_ym: ym }); if (r.error) return r;
        return ok((r.data || []).map(function (x) { var p = x.parts || {}; return { id: x.member_id, name: x.name, dept_id: dl(x.dept_id), position_id: x.position_id, shifts: p.shifts || 0, disc: p.disc, tpct: p.tpct, qpct: p.quiz, eligible: !!p.eligible, score: +p.score || x.points || 0, rank: x.rank, me: x.me }; }));
      },
      staff_update: async function (a) { return rr('member_update', { p_id: a.p_id, p: pick({ first_name: a.p_first, last_name: a.p_last, phone: a.p_phone, hire_date: a.p_hire || undefined }, ['first_name', 'last_name', 'phone', 'hire_date']) }); },
      staff_transfer: async function (a) { await load('base'); var p = rows('positions', a.p_position)[0]; return rr('member_transfer', { p_id: a.p_id, p_dept: p ? ds(p.dept_id) : null, p_position: a.p_position, p_manager: a.p_manager || null, p_role: p && p.access === 'manager' ? 'manager' : null }); },
      photo_set: async function (a) { if (!SV.me) return ok(null); var path = a.p_photo; if (path && /^data:/.test(path)) path = await SV.upload(path, 'profile'); return rr('member_update', { p_id: SV.me.id, p: { photo_path: path || null } }); },
      ann_mark_read: async function (a) { for (var i = 0; i < (a.p_ids || []).length; i++) { var r = await real.from('announcement_reads').upsert({ venue_id: V(), ann_id: a.p_ids[i], member_id: SV.me.id, read_at: new Date().toISOString() }, { onConflict: 'ann_id,member_id' }); if (r.error) return r; } SV.stale('ann'); return ok(true); },
      /* «Обмен сменами» (w12, таблица демо shift_exchanges) → shift_swaps сервера */
      shift_exchange_create: async function (a) { var r = await rr('swap_request', { p_to: a.p_to, p_from_day: a.p_from_day, p_to_day: a.p_kind === 'give' ? null : (a.p_to_day || a.p_from_day), p_note: a.p_note || null }); return r.error ? r : ok({ ok: true, id: r.data }); },
      shift_exchange_answer: async function (a) { var r = await rr('swap_answer', { p_id: a.p_id, p_yes: !!a.p_yes }); SV.stale('req'); return r.error ? r : ok({ ok: r.data !== false }); },
      shift_exchange_decide: async function (a) { var r = await rr('swap_decide', { p_id: a.p_id, p_yes: !!a.p_yes }); SV.stale('req', 'sched'); return r.error ? r : ok({ ok: true }); },
      shift_exchange_cancel: async function (a) { var r = await rr('swap_cancel', { p_id: a.p_id }); return r.error ? r : ok({ ok: true }); },
      /* «Срочная замена» (w9: демо shift_swaps / shift_swap_offers, rpc swap_*) → sub_* сервера */
      swap_candidates: async function (a) {
        await load('base'); var r = await real.rpc('sub_candidates', { p_absent: a.p_absent, p_day: a.p_day || null, p_include_busy: !!a.p_include_busy }); if (r.error) return r;
        return ok((r.data || []).map(function (c) { return { emp_id: c.member_id, name: c.name, position_id: c.position_id, kind_today: kindCode(c.kind_today, c.preset_today), off_day: !!c.off_day, busy: !!c.busy,
          rest_min: c.rest_min, week_min: c.week_min || 0, worked_min: c.worked_min || 0, offered: c.offered || null, rank: c.rank }; }));
      },
      swap_open: async function (a) { var r = await rr('sub_request', { p_absent: a.p_absent, p_day: a.p_day || tday(), p_reason: a.p_reason || 'sick', p_note: a.p_note || null, p_members: a.p_emps || [] }); if (r.error) return r; await load('subs', true); return ok(r.data); },
      swap_offer_more: async function (a) { var r = await rr('sub_offer_more', { p_id: a.p_id, p_members: a.p_emps || [] }); if (r.error) return r; await load('subs', true); return ok(r.data); },
      swap_answer: async function (a) { var r = await rr('sub_take', { p_id: a.p_id, p_yes: !!a.p_yes }); if (r.error) return r; await load('subs', true); var d = Object.assign({}, r.data || {}); if (d.t_start) d.t_start = t8(d.t_start); if (d.t_end) d.t_end = t8(d.t_end); return ok(d); },
      swap_cancel: async function (a) { var r = await rr('sub_cancel', { p_id: a.p_id }); if (r.error) return r; await load('subs', true); return ok(r.data); },
      swap_brief: async function () { var r = await real.rpc('mgr_brief'); return r.error ? r : ok(briefSwap((r.data || {}).swap)); },
      swap_expire: async function () { return ok(0); },
      /* «Руководителю»: сводка, рейтинг */
      mgr_brief: async function () { await load('base'); var r = await real.rpc('mgr_brief'); if (r.error) return r; var d = r.data || {}; d.swap = briefSwap(d.swap); return ok(d); },
      team_rating: async function (a) { await load('base'); var r = await real.rpc('team_rating', { p_from: a.p_from, p_to: a.p_to }); if (r.error) return r; return ok((r.data || []).map(function (x) { return Object.assign({}, x, { dept_id: dl(x.dept_id) }); })); },
      payslip_prepare: async function (a) { return rr('payslip_prepare', { p_ym: a.p_ym, p_member: a.p_member || null }); },
      /* dn: демо шлёт p_line, сервер ждёт p_line_kind */
      /* «Фонд оплаты» считается в приложении по строкам листов (payslip_lines.ym) — отдельной rpc не нужно */
      payroll_fund: async function () { return ok(null); },
      payslip_ask: async function (a) { var r = await rr('payslip_ask', { p_payslip: a.p_payslip, p_line_kind: a.p_line_kind || a.p_line || null, p_text: a.p_text }); SV.stale('pay'); return r; },
      payslip_answer: async function (a) { var r = await rr('payslip_answer', { p_id: a.p_id, p_text: a.p_text }); SV.stale('pay'); return r; },
      /* dn (п. 9): публикация недели — отдел демо → id сервера */
      schedule_publish: async function (a) { var r = await rr('schedule_publish', { p_week_start: a.p_week_start, p_dept: a.p_dept == null || a.p_dept === 'all' ? null : ds(a.p_dept), p_confirm_holes: a.p_confirm_holes !== false }); SV.stale('notif'); return r; },
      /* dn (п. 7): «Попросить руководителя сбросить телефон» — хэш как у отметки */
      device_ask: async function (a) { var dev = a.p_device_id ? await sha256('jamoa|' + a.p_device_id) : null; return rr('device_ask', { p_device: dev }); },
      register_push: async function (a) { if (!SV.me) return ok(null); var r = await real.from('push_subscriptions').upsert({ venue_id: V(), member_id: SV.me.id, endpoint: a.p_endpoint, p256dh: a.p_p256dh, auth_key: a.p_auth, ua: a.p_ua || null }, { onConflict: 'member_id,endpoint' }); return r.error ? r : ok(true); },
      brief_to_me: async function () { miss('rpc', 'brief_to_me', 'сводку в Telegram сервер не шлёт — кнопка скрыта в режиме сервера'); return ok(null); },
      native_token_forget: async function () { return ok(null); },
      whoami: async function () { return ok(SV.me ? { id: SV.me.id, role: role(SV.me.role) } : null); }
    };
    SV.rpcMap = RPC;
    function briefSwap(b) { if (!b) return b; return Object.assign({}, b, { items: (b.items || []).map(function (x) { return Object.assign({}, x, { dept_id: dl(x.dept_id), kind: x.preset_id ? 'p' + x.preset_id : 'u' }); }) }); }
    function lsGet(k) { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function lsSet(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

    /* ----- functions.invoke ----- */
    async function clockFn(b) {
      if (b.action === 'probe') return { data: { ok: true }, error: null };
      if (/^kiosk_/.test(b.action)) { miss('function', 'clock:kiosk', 'планшет: на сервере kiosk_pair/kiosk_mark (0012) — экран 92b пока проверяет PIN локально'); return { data: { ok: false, reason: 'server', message: 'Общий планшет на сервере пока не подключён — отметьтесь со своего телефона' }, error: null }; }
      if (!b.action) return { data: { ok: false, reason: 'server', message: 'Нет действия' }, error: null };
      var photo = b.selfie || b.photo || null;
      if (photo && /^data:|^blob:/.test(photo)) { try { photo = await SV.upload(photo, 'clock'); } catch (e) { return { data: { ok: false, reason: 'cam', message: 'Фото не загрузилось: ' + (e.message || e) }, error: null }; } }
      /* путь фото демо («<сотрудник>/clock-….jpg» в корзине task-photos) → путь в бакете сервера; чужой или непонятный путь не отправляем */
      if (photo && SV.me) { var pre = V() + '/' + SV.me.id + '/';
        if (String(photo).indexOf(pre) !== 0) { var mp = SV.pmap['task-photos|' + photo] || SV.pmap['media|' + photo] || null; photo = mp && mp.indexOf(pre) === 0 ? mp : null; } }
      var dev = b.device_id ? await sha256('jamoa|' + b.device_id) : null;
      var hp = null; if (b.action === 'in' && SV.health && SV.health.day === tday()) hp = SV.health.answers;
      var p = { p_action: b.action, p_at: b.at || null, p_lat: b.lat == null ? null : +b.lat, p_lng: b.lng == null ? null : +b.lng, p_acc: b.acc == null ? null : Math.round(+b.acc), p_photo_path: photo, p_device: dev, p_offline: !!b.offline, p_late_why: b.late_why || null, p_late_note: b.late_note || null, p_health: hp };
      var r = await real.rpc('clock', p);
      if (r.error) { var c = r.error.details || r.error.code; if (/no_auth|JWT|jwt/.test(String(c) + r.error.message)) return { data: { ok: false, reason: 'auth', message: r.error.message }, error: null };
        if (c === 'must_change') return { data: { ok: false, reason: 'server', message: 'Сначала смените временный пароль' }, error: null }; return { data: { ok: false, reason: 'server', message: r.error.message }, error: null }; }
      var d = r.data || {}; SV.stale('att', 'notif');
      if (!d.ok) return { data: { ok: false, reason: d.reason || 'server', message: d.message, dist: d.dist_m != null ? d.dist_m : undefined, dist_m: d.dist_m, radius_m: d.radius_m, photo: d.photo, opens_at: d.opens_at, health: d.health }, error: null };
      if (b.action === 'in' && hp) SV.health = null;
      await load('att', true);
      var a = rows('attendance', d.attendance_id)[0] || {};
      return { data: { ok: true, action: b.action, dup: !!d.dup, repeat: !!d.repeat, late_min: a.late_min || d.late_min || 0, is_late: (a.late_min || d.late_min || 0) > 0, worked_min: a.worked_min || d.worked_min || 0,
        early_min: a.early_min || 0, left_early: (a.early_min || 0) > 0, overtime_min: a.overtime_min || 0, outside: d.zone_status === 'pending', zone: d.zone, dist: d.dist_m != null ? d.dist_m : undefined, radius_m: d.radius_m, offline: !!d.offline, time_status: d.time_status || 'ok', delayed: d.time_status === 'pending', attendance_id: d.attendance_id }, error: null };
    }
    async function staffAdmin(b) {
      await load('base');
      var A = function (x) { return real.functions.invoke('staff-auth', { body: x }); };
      async function fd(r) { if (r.error) { var m = r.error.message; try { var j = r.error.context && r.error.context.json ? await r.error.context.json() : null; if (j && j.message) m = j.message; } catch (e) {} return { ok: false, error: m, message: m }; } return r.data; }
      if (b.action === 'create') {
        var p = rows('positions', b.position_id)[0] || null, rl = b.role === 'manager' || (p && p.access === 'manager') ? 'manager' : b.role === 'accountant' ? 'accountant' : 'staff';
        var r = await real.rpc('member_invite', { p_first: b.first_name, p_last: b.last_name || '', p_gender: b.gender || null, p_phone: b.phone || null, p_dept: p ? ds(p.dept_id) : ds(b.dept_id), p_position: b.position_id || null, p_role: rl, p_manager: b.manager_id || null, p_preset: b.preset_id || null,
          p_rate: SV.me && (SV.me.role === 'owner' || SV.me.role === 'accountant') ? (+b.rate || +b.cf_salary || null) : null,   /* dn (п. 2): оклад из приглашения (cf_salary) */
          p_scheme: b.scheme || (SV.hooks.schemeFor ? SV.hooks.schemeFor(b.position_id) : null) || 'month' });
        if (r.error) return { data: { ok: false, error: r.error.message, message: r.error.message }, error: null };
        var mid = r.data && r.data.member_id, a = await fd(await A({ action: 'create', member_id: mid }));
        await load('base', true);
        if (SV.hooks.paySync) { try { await SV.hooks.paySync(); } catch (e) {} }   /* dn: правило должности новичку (если оклад не указан) */
        if (!a || !a.ok) return { data: { ok: false, id: mid, login: r.data.login, error: (a && a.message) || 'Вход не создан — нажмите «Сбросить пароль» в карточке', message: (a && a.message) || '' }, error: null };
        return { data: { ok: true, id: mid, login: a.login || r.data.login, password: a.password, code: r.data.code, warn_phone: r.data.warn_phone }, error: null };
      }
      if (b.action === 'reset_password') { var x = await fd(await A({ action: 'reset', member_id: b.id })); SV.stale('base'); return { data: x && x.ok ? { ok: true, password: x.password, login: x.login } : { ok: false, error: x && x.message, message: x && x.message }, error: null }; }
      if (b.action === 'archive' || b.action === 'restore') {
        var on = b.action === 'archive', r2 = await real.rpc('member_archive', { p_id: b.id, p_on: on });
        if (r2.error) return { data: { ok: false, error: r2.error.message, message: r2.error.message }, error: null };
        var y = await fd(await A({ action: on ? 'disable' : 'enable', member_id: b.id })); await load('base', true);
        return { data: { ok: true, auth: y && y.ok, message: y && !y.ok ? y.message : null }, error: null };
      }
      miss('function', 'staff-admin:' + b.action); return { data: { ok: false, error: 'Не поддерживается' }, error: null };
    }

    /* ----- фото: Supabase Storage, бакет jamoa-photos, путь <venue_id>/<member_id>/<вид>-<время>.jpg ----- */
    SV.bucket = cfg.bucket || 'jamoa-photos';
    SV.upload = async function (src, kind) {
      if (!SV.me || !V()) throw E('Нет входа', 'no_auth');
      var blob;
      if (typeof src === 'string') { var res = await fetch(src); blob = await res.blob(); } else blob = src;
      var ext = /png/.test(blob.type) ? 'png' : 'jpg', path = V() + '/' + SV.me.id + '/' + (kind || 'photo') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
      var r = await real.storage.from(SV.bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if (r.error) throw r.error; return path;
    };
    /* корзины демо (task-photos, media, rv-photos …) → один приватный бакет jamoa-photos; путь всегда <venue_id>/<member_id>/<корзина>-<имя>.
       Папка участника — первая часть пути демо, если это сотрудник этого заведения (демо пишет «<id сотрудника>/…»), иначе — я. */
    var UUIDRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^m-[a-z0-9-]+$/i;
    SV.spath = function (bucket, path, up) {
      path = String(path || '');
      if (V() && path.indexOf(V() + '/') === 0) return path;
      var seg = path.split('/'), own = seg.length > 1 && UUIDRE.test(seg[0]) ? seg[0] : null;
      if (up && own && SV.me && own !== SV.me.id) own = null;   // загрузить можно только в свою папку
      var who = own || (SV.me && SV.me.id) || 'anon', rest = own ? seg.slice(1).join('_') : path.replace(/\//g, '_');
      return V() + '/' + who + '/' + (bucket === SV.bucket ? '' : bucket + '-') + rest;
    };
    SV.pmap = {};
    SV.store = function (bucket) {
      var B = real.storage.from(SV.bucket);
      function P(p, up) { return SV.pmap[bucket + '|' + p] || SV.spath(bucket, p, up); }
      return {
        upload: async function (p, body, o) { var np = P(p, true); SV.pmap[bucket + '|' + p] = np; var r = await B.upload(np, body, o); if (r.error) return r; return { data: Object.assign({}, r.data, { path: p, fullPath: np, svPath: np }), error: null }; },
        createSignedUrl: function (p, sec, o) { return B.createSignedUrl(P(p), sec, o); },
        createSignedUrls: function (L, sec) { return B.createSignedUrls ? B.createSignedUrls(L.map(function (p) { return P(p); }), sec) : Promise.resolve({ data: [], error: null }); },
        download: function (p) { return B.download(P(p)); },
        remove: function (L) { return B.remove([].concat(L).map(function (p) { return P(p); })); },
        getPublicUrl: function (p) { miss('storage', 'getPublicUrl', 'бакет приватный — только подписанные ссылки'); return { data: { publicUrl: '' } }; }
      };
    };
    /* ----- «Планшет заведения» (0012/0013): токен планшета — только в localStorage этого устройства; PIN проверяет сервер ----- */
    function kKey() { return 'sv-kiosk:' + V(); }
    function rpcData(r) { if (r.error) throw r.error; return r.data; }
    SV.kiosk = {
      get: function () { if (!V()) return null; var k = lsGet(kKey()); return k && k.token ? k : null; },
      forget: function () { try { root.localStorage.removeItem(kKey()); } catch (e) {} },
      pair: async function (name) {
        var d = rpcData(await real.rpc('kiosk_pair', { p_name: name || null }));
        lsSet(kKey(), { token: d.token, kiosk_id: d.kiosk_id, name: d.name, by: SV.me && SV.me.id, at: new Date().toISOString() });
        SV.stale('base'); return { ok: true, kiosk_id: d.kiosk_id, name: d.name };
      },
      /* PIN без фото: сервер проверяет PIN (счётчик ошибок, блокировки) и просит фото — ответ pin_ok */
      check: async function (memberId, pin, action) {
        var k = SV.kiosk.get(); if (!k) return { ok: false, reason: 'nokiosk', message: 'Планшет не подключён' };
        var r = await real.rpc('kiosk_mark', { p_token: k.token, p_member: memberId, p_pin: String(pin || ''), p_action: action || null, p_photo_path: null });
        if (r.error) { if (/не подключено как планшет/.test(r.error.message || '')) SV.kiosk.forget(); return { ok: false, reason: 'server', message: r.error.message }; }
        var d = r.data || {}; if (d.reason === 'cam' && d.pin_ok) return { ok: true, pin_ok: true }; return d;
      },
      /* отметка: фото — в папку вошедшего на планшете, имя kiosk-…; сервер записывает его в отметку сотрудника */
      mark: async function (memberId, pin, action, photo) {
        var k = SV.kiosk.get(); if (!k) return { ok: false, reason: 'nokiosk', message: 'Планшет не подключён' };
        var path = null; try { path = await SV.upload(photo, 'kiosk'); } catch (e) { return { ok: false, reason: 'cam', message: 'Фото не загрузилось: ' + (e.message || e) }; }
        var r = await real.rpc('kiosk_mark', { p_token: k.token, p_member: memberId, p_pin: String(pin || ''), p_action: action || null, p_photo_path: path });
        SV.stale('att', 'notif');
        if (r.error) return { ok: false, reason: 'server', message: r.error.message };
        return r.data || {};
      },
      /* выход из режима планшета по PIN владельца (без токена — все планшеты заведения, только из приложения владельца) */
      unpair: async function (ownerPin, all) {
        var k = SV.kiosk.get(), r = await real.rpc('kiosk_unpair', { p_owner_pin: String(ownerPin || ''), p_token: all ? null : (k ? k.token : null) });
        if (r.error) { if (!all && /не найден|уже выключен/.test(r.error.message || '')) { SV.kiosk.forget(); SV.stale('base'); return { ok: true, gone: true }; } return { ok: false, reason: 'server', message: r.error.message }; }
        var d = r.data || {}; if (d.ok) { SV.kiosk.forget(); SV.stale('base'); } return d;
      }
    };
    SV.photoUrl = async function (path, sec) { if (!path || /^(data:|https?:|blob:)/.test(path)) return path; var r = await real.storage.from(SV.bucket).createSignedUrl(path, sec || 3600); return r.error ? null : r.data.signedUrl; };

    /* ----- realtime: колокольчик ----- */
    SV.rt = null;
    SV.subscribe = function (onNew) {
      if (!real.channel || !SV.me) return null;
      try { if (SV.rt) real.removeChannel(SV.rt); } catch (e) {}
      SV.rt = real.channel('jamoa-notif-' + SV.me.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'member_id=eq.' + SV.me.id }, function (ev) { SV.stale('notif'); load('notif', true).then(function () { if (onNew) onNew(ev); }); })
        .subscribe();
      return SV.rt;
    };

    /* ----- вход, выбор заведения ----- */
    SV.setVenue = function (id) { SV.venueId = id; SV.at = {}; SV.T = {}; lsSet('sv-venue', id); };
    SV.boot = async function (session) {
      SV.uid = session && session.user && session.user.id; SV.ready = false; SV.at = {}; SV.T = {}; SV.me = null;
      if (!SV.uid) { SV.state = 'out'; return; }
      var r = await real.from('members').select('id,venue_id,role,first_name,last_name,must_change_password,archived_at,venues(name,type)').eq('user_id', SV.uid).is('archived_at', null);
      if (r.error) { SV.state = 'error'; SV.err = r.error; return; }
      SV.venues = (r.data || []).map(function (m) { return { venue_id: m.venue_id, member_id: m.id, role: m.role, name: m.venues && m.venues.name, type: m.venues && m.venues.type }; });
      if (!SV.venues.length) { SV.state = 'novenue'; if (SV.ui.noVenue) { var nv = await SV.ui.noVenue(); if (nv) return SV.boot(session); } return; }
      var saved = lsGet('sv-venue'), pick0 = SV.venues.filter(function (v) { return v.venue_id === saved; })[0];
      var vid = pick0 ? pick0.venue_id : SV.venues.length === 1 ? SV.venues[0].venue_id : null;
      if (!vid) vid = SV.ui.pickVenue ? await SV.ui.pickVenue(SV.venues) : SV.venues[0].venue_id;
      SV.setVenue(vid);
      try { await load('base', true); } catch (e) { SV.state = 'error'; SV.err = e; return; }
      SV.state = 'in'; SV.ready = true;
      /* новое заведение: только «Руководство / Владелец» — заполнить отделы, должности и быстрые смены по типу (90-server, SV.seed) */
      if (SV.seed) { try { if (await SV.seed()) await load('base', true); } catch (e) { try { console.warn('[sv] seed', e); } catch (x) {} } }
    };

    /* ----- клиент для приложения ----- */
    var authL = [], lastSession = null;
    var client = {
      __sv: SV,
      from: function (t) { return new Q(SV, t); },
      rpc: function (n, a) {
        a = a || {};
        var p = (async function () {
          try {
            if (RPC[n]) return await RPC[n](a);
            if (PASS[n]) return await rr(n, a);
            miss('rpc', n, 'нет на сервере ядра'); return ok(null);
          } catch (e) { return { data: null, error: e && e.message ? e : E(String(e)) }; }
        })();
        return p;
      },
      functions: { invoke: async function (n, o) {
        var b = (o && o.body) || {}; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
        try {
          if (n === 'clock') return await clockFn(b);
          if (n === 'staff-admin') return await staffAdmin(b);
          if (n === 'staff-auth') return await real.functions.invoke(n, o);
          miss('function', n); return { data: { ok: false, reason: 'server', message: 'Функция недоступна на сервере' }, error: null };
        } catch (e) { return { data: null, error: e && e.message ? e : E(String(e)) }; }
      } },
      storage: { from: function (bucket) { return SV.store(bucket); } },
      channel: function () { return real.channel.apply(real, arguments); },
      removeChannel: function (c) { return real.removeChannel ? real.removeChannel(c) : null; },
      auth: {
        onAuthStateChange: function (cb) { authL.push(cb); return { data: { subscription: { unsubscribe: function () { authL = authL.filter(function (x) { return x !== cb; }); } } } }; },
        signInWithPassword: function (c) { c = Object.assign({}, c); if (c.email && DEMO_DOMAIN.test(c.email)) c.email = c.email.replace(DEMO_DOMAIN, '@' + (cfg.staffDomain || 'staff.jamoa.uz')); return real.auth.signInWithPassword(c); },
        signUp: function (c) { return real.auth.signUp(c); },
        updateUser: function (c) { return real.auth.updateUser(c); },
        signOut: function () { try { lsSet('sv-venue', null); } catch (e) {} return real.auth.signOut(); },
        getSession: function () { return real.auth.getSession(); },
        getUser: function () { return real.auth.getUser(); },
        refreshSession: function () { return real.auth.refreshSession(); },
        resetPasswordForEmail: function (e, o) { return real.auth.resetPasswordForEmail(e, o); }
      }
    };
    SV.client = client;
    SV.real = real;   /* «голый» клиент — для разовой начальной настройки заведения (90-server, SV.seed) */
    /* события входа доходят до приложения после того, как выбран заведение и загружена база */
    var chain = Promise.resolve();
    real.auth.onAuthStateChange(function (ev, session) {
      chain = chain.then(async function () {
        var had = lastSession && lastSession.user && lastSession.user.id, now = session && session.user && session.user.id;
        if ((ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') && now && (now !== had || !SV.ready)) { try { await SV.boot(session); } catch (e) { SV.state = 'error'; SV.err = e; } }
        if (ev === 'SIGNED_OUT') { SV.state = 'out'; SV.ready = false; SV.me = null; SV.venueId = null; SV.T = {}; SV.at = {}; }
        if (ev === 'SIGNED_IN' && now && had === now) { lastSession = session; return; }   // обновление токена при возврате на вкладку — приложению не нужно
        lastSession = session;
        var evOut = ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED' ? null : ev;
        if (evOut && session && SV.state !== 'in' && evOut !== 'SIGNED_OUT') { if (SV.ui.blocked) SV.ui.blocked(SV.state, SV.err); return; }
        if (evOut) authL.slice().forEach(function (cb) { try { cb(evOut, session); } catch (e) { console.error(e); } });
      });
    });
    return client;
  }

  var api = { make: make, Q: Q, tday: tday, addDays: addDays, hms: hms };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SVAdapter = api;
  /* в браузере: подменяем createClient — приложение (app.html) получает переходник вместо «голого» клиента */
  if (root.supabase && root.supabase.createClient && root.JAMOA_DEMO === false && !root.supabase.__sv) {
    var cc = root.supabase.createClient;
    root.supabase = Object.assign({}, root.supabase, { __sv: true, createClient: function (url, key, opts) {
      var C = root.JAMOA_SERVER || {}, holder = { venue: null };
      var o = Object.assign({}, opts || {}, { auth: Object.assign({ persistSession: true, autoRefreshToken: true, storageKey: 'jamoa-srv' }, (opts || {}).auth, { storageKey: 'jamoa-srv' }),
        global: { fetch: function (u, init) { init = init || {}; var hd = new Headers(init.headers || {}); if (holder.venue && !hd.has('x-venue-id')) hd.set('x-venue-id', holder.venue); init.headers = hd; return fetch(u, init); } } });
      var real = cc(C.url, C.key, o);
      var cl = make(real, C);
      Object.defineProperty(cl.__sv, 'venueId', { get: function () { return holder.venue; }, set: function (v) { holder.venue = v; } });
      root.JAMOA_SV = cl.__sv;
      return cl;
    } });
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* === 92o features === */
/* Часть do (92o-features, 0019_features.sql): «Экстренно», «Сообщить о проблеме», «Инструкции», переписка в задаче, «Отчёты», проверочный push.
   Блок не трогает код выше: оборачивает SVAdapter.make и supabase.createClient и дополняет объект SV —
   exec (свои таблицы раньше общего кода), rpcMap (свои rpc), store (анонимное фото, тип файла без «;codecs=…»). */
(function (root) {
  'use strict';
  var A = root.SVAdapter; if (!A || A.__do) return; A.__do = true;
  function ext(cl) {
    var SV = cl && cl.__sv; if (!SV || SV.__do) return cl; SV.__do = true;
    var real = SV.real, TTL = 4000, C = { ev: null, evAt: 0 };
    function V() { return SV.venueId; }
    function E(m, c) { return { message: m, details: c || 'sv', code: c || 'sv' }; }
    function ok(d) { return { data: d === undefined ? null : d, error: null }; }
    function dl(id) { return id == null ? null : SV.dep.toLoc[id] || ('d' + id); }
    function ds(loc) { if (loc == null || loc === '') return null; if (SV.dep.toSrv[loc] != null) return SV.dep.toSrv[loc]; return /^d?\d+$/.test(String(loc)) ? +String(loc).replace(/^d/, '') : null; }
    function iso(t) { return t ? new Date(t).toISOString() : t; }
    function many(qq, rows) { var r = qq.pick(rows); return r; }
    async function rpc(n, a) { var r = await real.rpc(n, a || {}); return r; }
    function fpath(bucket, p) { if (!p) return null; return SV.pmap[bucket + '|' + p] || SV.spath(bucket, p); }
    function noWrite(t) { return { data: null, error: E('Запись «' + t + '» идёт через сервер', 'bad_input') }; }

    /* ----- «Экстренно»: события и отметки ----- */
    function evRow(e) { return Object.assign({}, e, { started_at: iso(e.started_at), ended_at: iso(e.ended_at) }); }
    async function evLoad(force) {
      if (!V()) return [];
      if (!force && C.ev && Date.now() - C.evAt < TTL && C.evV === V()) return C.ev;
      var r = await real.from('emergency_events').select('*').eq('venue_id', V()).gte('started_at', new Date(Date.now() - 400 * 864e5).toISOString()).order('started_at', { ascending: false }).limit(200);
      if (r.error) throw r.error;
      C.ev = (r.data || []).map(evRow); C.evAt = Date.now(); C.evV = V(); return C.ev;
    }
    function evStale() { C.evAt = 0; }
    var TBL = {
      emergency_events: async function (qq) { if (qq.op !== 'select') return noWrite('emergency_events'); return many(qq, await evLoad(qq.val('id') !== undefined)); },
      emergency_marks: async function (qq) {
        if (qq.op !== 'select') return noWrite('emergency_marks');
        var id = qq.val('event_id'); if (id === undefined || !V()) return many(qq, []);
        var r = await real.from('emergency_marks').select('*').eq('venue_id', V()).eq('event_id', +id).order('at').limit(1000); if (r.error) throw r.error;
        return many(qq, (r.data || []).map(function (m) { return { id: m.id, event_id: m.event_id, kind: m.kind, ref: m.ref, text: m.text, at: iso(m.at), by: m.by_member, on: m.is_on !== false }; }));
      },
      /* «Сообщить о проблеме»: чтение — rpc list_problems (анонимность), запись — problem_create */
      problem_reports: async function (qq) {
        if (qq.op === 'insert') {
          var out = [];
          for (var i = 0; i < qq.payload.length; i++) {
            var p = qq.payload[i];
            var r = await rpc('problem_create', { p_category: p.category || 'Другое', p_text: p.text, p_place: p.place || null, p_anonymous: !!p.anonymous, p_photo_path: fpath('task-photos', p.photo_path) });
            if (r.error) return { data: null, error: r.error };
            out.push(Object.assign({}, p, { id: r.data, status: 'new', created_at: new Date().toISOString() }));
          }
          return { data: qq.one ? out[0] || null : out, error: null };
        }
        if (qq.op !== 'select') return noWrite('problem_reports');
        var x = await rpc('list_problems'); if (x.error) throw x.error;
        return many(qq, (x.data || []).map(probRow));
      },
      /* «Инструкции»: чтение — таблица (RLS: своё заведение), запись — guide_save / guide_delete */
      guides: async function (qq) {
        if (qq.op === 'select') {
          if (!V()) return many(qq, []);
          var r = await real.from('guides').select('*').eq('venue_id', V()).eq('active', true).order('sort').order('id').limit(500); if (r.error) throw r.error;
          return many(qq, (r.data || []).map(function (g) { return Object.assign({}, g, { dept_id: dl(g.dept_id) }); }));
        }
        var L = qq.op === 'insert' || qq.op === 'upsert' ? qq.payload.map(function (x) { return Object.assign({ id: qq.op === 'upsert' ? x.id : null }, x); }) : [Object.assign({ id: qq.val('id') }, qq.payload || {})];
        var ids = [];
        for (var j = 0; j < L.length; j++) {
          var g = L[j], rr;
          if (qq.op === 'delete' || g.active === false) rr = await rpc('guide_delete', { p_id: g.id });
          else {
            if (g.id != null && (g.title === undefined || g.body === undefined)) {
              var cur = await real.from('guides').select('*').eq('id', g.id).maybeSingle(); if (cur.error) return { data: null, error: cur.error };
              g = Object.assign({}, cur.data || {}, { dept_id: dl(cur.data && cur.data.dept_id) }, g);
            }
            rr = await rpc('guide_save', { p_id: g.id || null, p_title: g.title, p_body: g.body, p_position: g.position_id || null, p_dept: g.position_id ? null : ds(g.dept_id),
              p_title_uz: g.title_uz || null, p_body_uz: g.body_uz || null, p_sort: g.sort != null ? g.sort : null, p_active: true });
          }
          if (rr.error) return { data: null, error: rr.error };
          ids.push(rr.data === true ? g.id : rr.data);
        }
        var rows = ids.map(function (id, k) { return Object.assign({}, L[k], { id: id }); });
        return { data: qq.one ? rows[0] || null : rows, error: null };
      },
      /* старые «отчёты дня» демо: на сервере их заменяют reports_month / reports_daily (92o) — пусто, без «не покрыто» */
      daily_reports: async function (qq) { return qq.op === 'select' ? many(qq, []) : noWrite('daily_reports'); },
      /* переписка в задаче (таблица демо messages, scope = task); чат руководителей и прочее — общим кодом */
      messages: async function (qq, ex0) {
        if (qq.op === 'select') {
          if (qq.val('scope') !== 'task' || qq.val('ref_id') === undefined) return ex0(qq);
          var r = await rpc('task_messages', { p_task: +qq.val('ref_id') }); if (r.error) throw r.error;
          return many(qq, (r.data || []).map(function (m) { return Object.assign({ scope: 'task', ref_id: m.task_id }, m); }));
        }
        if (qq.op !== 'insert' || !qq.payload.every(function (m) { return m.scope === 'task'; })) return ex0(qq);
        var out = [];
        for (var i = 0; i < qq.payload.length; i++) {
          var m = qq.payload[i];
          var x = await rpc('task_message_add', { p_task: +m.ref_id, p_text: m.text || null, p_file_path: fpath('media', m.file_path), p_file_type: m.file_type || null, p_file_name: m.file_name || null, p_voice_sec: m.voice_sec != null ? Math.round(m.voice_sec) : null });
          if (x.error) return { data: null, error: x.error };
          out.push(Object.assign({}, m, { id: x.data, created_at: new Date().toISOString() }));
        }
        return { data: qq.one ? out[0] || null : out, error: null };
      }
    };
    function probRow(p) { return Object.assign({}, p, { dept_id: dl(p.dept_id) }); }
    SV.doTables = TBL;
    var ex0 = SV.exec;
    SV.exec = async function (qq) {
      var h = TBL[qq.t]; if (!h) return ex0.call(SV, qq);
      try { return await h(qq, function (q) { return ex0.call(SV, q); }); } catch (e) { return { data: null, error: e && e.message ? e : E(String(e)) }; }
    };

    /* ----- rpc демо → rpc сервера ----- */
    var R = SV.rpcMap;
    function pass(n, after) { return async function (a) { var r = await rpc(n, a); if (after) after(r); return r; }; }
    R.emergency_start = async function (a) {
      var r = await rpc('emergency_raise', { p_kind: a.p_kind, p_note: a.p_note || null, p_lat: a.p_lat == null ? null : +a.p_lat, p_lng: a.p_lng == null ? null : +a.p_lng, p_drill: !!a.p_drill, p_place: a.p_place || null });
      evStale(); SV.stale('notif'); return r;
    };
    R.emergency_raise = R.emergency_start;
    R.emergency_onshift = async function () { var r = await rpc('emergency_onshift'); if (r.error) return r; return ok((r.data || []).map(function (x) { return { employee_id: x.member_id, clock_in: x.clock_in }; })); };
    R.emergency_rooms = async function () { return ok([]); };                       /* доски номеров в ядре нет */
    R.emergency_alert = async function (a) { var r = await rpc('emergency_alert', { p_event: a.p_event, p_members: a.p_emps || a.p_members || [] }); return r; };
    ['emergency_place', 'emergency_mark', 'emergency_log'].forEach(function (n) { R[n] = pass(n); });
    R.emergency_ack = pass('emergency_ack', function () { SV.stale('notif'); });
    R.emergency_end = pass('emergency_end', function () { evStale(); SV.stale('notif'); });
    R.emergency_close = R.emergency_end;
    R.list_problems = async function () { var r = await rpc('list_problems'); if (r.error) return r; return ok((r.data || []).map(probRow)); };
    R.problem_reply = pass('problem_reply');
    R.task_messages = pass('task_messages');
    R.task_message_add = pass('task_message_add');
    R.guide_save = pass('guide_save');
    R.guide_delete = pass('guide_delete');
    function repDep(d) { return Object.assign({}, d, { dept_id: dl(d.dept_id) }); }
    R.reports_month = async function (a) { var r = await rpc('reports_month', { p_ym: (a && a.p_ym) || null }); if (r.error) return r; var d = Object.assign({}, r.data || {}); d.depts = (d.depts || []).map(repDep); return ok(d); };
    R.reports_daily = async function (a) { var r = await rpc('reports_daily', { p_days: (a && a.p_days) || 14, p_to: (a && a.p_to) || null }); if (r.error) return r; return ok((r.data || []).map(function (x) { return Object.assign({}, x, { depts: (x.depts || []).map(repDep) }); })); };
    R.test_push = pass('test_push', function () { SV.stale('notif'); });

    /* ----- файлы: анонимное фото проблемы — в <заведение>/anon/ (без id автора); тип файла без параметров (audio/webm;codecs=opus → audio/webm) ----- */
    var st0 = SV.store;
    SV.store = function (bucket) {
      var s = st0.call(SV, bucket), up0 = s.upload;
      s.upload = async function (p, body, o) {
        o = Object.assign({}, o || {}); if (o.contentType) o.contentType = String(o.contentType).split(';')[0].trim();
        if (/^anon\//.test(String(p)) && V()) {
          var np = V() + '/anon/' + String(p).slice(5).replace(/[^A-Za-z0-9._-]/g, '_').slice(-120);
          var r = await real.storage.from(SV.bucket).upload(np, body, o); if (r.error) return r;
          SV.pmap[bucket + '|' + p] = np; return { data: Object.assign({}, r.data, { path: p, fullPath: np, svPath: np }), error: null };
        }
        return up0.call(s, p, body, o);
      };
      return s;
    };
    return cl;
  }
  A.doExt = ext;
  var mk0 = A.make; A.make = function () { return ext(mk0.apply(this, arguments)); };
  if (root.supabase && root.supabase.__sv && root.supabase.createClient) {
    var cc0 = root.supabase.createClient;
    root.supabase.createClient = function () { return ext(cc0.apply(this, arguments)); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* === end 92o === */

/* === 92q shift === */
/* Часть dq (92q-shift2, 0021_shift.sql): фото открытия и закрытия смены, «Опаздываю», подтверждение смены, передача смены.
   Блок не трогает код выше: как 92o — оборачивает SVAdapter.make и supabase.createClient и дополняет объект SV:
   exec (свои таблицы раньше общего кода: shift_photos, late_warns, dq_handovers, schedule.confirmed, уведомления latewarn/handover)
   и rpcMap (rpc 0021 напрямую). Ошибки сервера отдаются экрану как { error } — не «молча». */
(function (root) {
  'use strict';
  var A = root.SVAdapter; if (!A || A.__dq) return; A.__dq = true;
  function ext(cl) {
    var SV = cl && cl.__sv; if (!SV || SV.__dq) return cl; SV.__dq = true;
    var real = SV.real, C = { ph: {}, sig: {} };
    function V() { return SV.venueId; }
    function E(m, c) { return { message: m, details: c || 'sv', code: c || 'sv' }; }
    function ok(d) { return { data: d === undefined ? null : d, error: null }; }
    function dl(id) { return id == null ? null : SV.dep.toLoc[id] || ('d' + id); }
    function tday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()); }
    function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
    async function rpc(n, a) { return real.rpc(n, a || {}); }
    function fpath(bucket, p) { if (!p) return null; return SV.pmap[bucket + '|' + p] || SV.spath(bucket, p); }
    function noWrite(t) { return { data: null, error: E('Запись «' + t + '» идёт через сервер', 'bad_input') }; }
    function out(qq, rows) { return { data: qq.one ? rows[0] || null : rows, error: null }; }
    /* подписанные ссылки на миниатюры (кэш 50 мин) */
    async function signAll(paths) {
      var need = paths.filter(function (p) { return p && !(C.sig[p] && C.sig[p].t > Date.now()); });
      if (need.length) {
        try {
          var B = real.storage.from(SV.bucket), r = B.createSignedUrls ? await B.createSignedUrls(need, 3600) : { data: [] };
          (r.data || []).forEach(function (x, i) { if (x && x.signedUrl) C.sig[need[i]] = { u: x.signedUrl, t: Date.now() + 3e6 }; });
        } catch (e) {}
      }
      var o = {}; paths.forEach(function (p) { if (C.sig[p]) o[p] = C.sig[p].u; }); return o;
    }

    /* ----- фото смены: таблица сервера shift_photos (RLS: я, моя команда, владелец) ----- */
    function phRow(x, th) { return { id: x.id, employee_id: x.member_id, day: x.day, kind: x.kind, point: x.point, path: x.path, at: x.taken_at, thumb: th || null }; }
    async function phSelect(qq) {
      if (!V()) return qq.pick([]);
      var b = real.from('shift_photos').select('*').eq('venue_id', V()), d = qq.val('day'), m = qq.val('employee_id'), k = qq.val('kind');
      b = d !== undefined ? b.eq('day', d) : b.gte('day', addDays(tday(), -40));
      if (m !== undefined) b = b.eq('member_id', m); if (k !== undefined) b = b.eq('kind', k);
      var r = await b.order('taken_at').limit(1000); if (r.error) throw r.error;
      var L = r.data || [], sg = await signAll(L.map(function (x) { return x.path; }));
      return qq.pick(L.map(function (x) { return phRow(x, sg[x.path]); }));
    }
    /* ----- «Опаздываю»: late_warns ----- */
    function lwRow(x) { return { id: x.id, employee_id: x.member_id, day: x.day, minutes: x.minutes, reason: x.reason, shift_start: x.shift_start ? String(x.shift_start).slice(0, 5) : null, at: x.created_at }; }
    /* ----- передача смены: rpc handovers / handover_create / handover_ack ----- */
    function hoRow(x) {
      return { id: x.id, from_id: x.from_member, to_id: x.to_member, dept_id: dl(x.dept_id), day: x.day, cash: x.cash == null ? null : +x.cash, cash_note: x.cash_note,
        open_items: x.open_items, notes: x.notes, tasks: x.tasks || [], photos: x.photos || [], created_at: x.created_at, acked_by: x.acked_by, acked_at: x.acked_at,
        ack_note: x.ack_note, esc_at: x.esc_at, mine: !!x.mine, for_me: !!x.for_me };
    }
    var TBL = {
      shift_photos: async function (qq) {
        if (qq.op === 'select') return phSelect(qq);
        if (qq.op === 'insert' || qq.op === 'upsert') {
          var rows = [];
          for (var i = 0; i < qq.payload.length; i++) {
            var p = qq.payload[i];
            if (SV.me && p.employee_id && p.employee_id !== SV.me.id) return { data: null, error: E('Фото смены сдаёт сам сотрудник', 'no_rights') };
            var r = await rpc('shift_photo_add', { p_kind: p.kind, p_point: p.point, p_path: fpath('task-photos', p.path), p_day: p.day || null });
            if (r.error) return { data: null, error: r.error };
            rows.push(phRow({ id: r.data.id, member_id: r.data.member_id, day: r.data.day, kind: r.data.kind, point: r.data.point, path: r.data.path, taken_at: r.data.taken_at }, p.thumb));
          }
          return out(qq, rows);
        }
        if (qq.op === 'delete') {
          var id = qq.val('id'); if (id === undefined) return noWrite('shift_photos');
          var x = await rpc('shift_photo_remove', { p_id: +id }); if (x.error) return { data: null, error: x.error };
          return ok(null);
        }
        return noWrite('shift_photos');
      },
      late_warns: async function (qq) {
        if (qq.op === 'select') {
          if (!V()) return qq.pick([]);
          var d = qq.val('day'), b = real.from('late_warns').select('*').eq('venue_id', V());
          b = d !== undefined ? b.eq('day', d) : b.gte('day', addDays(tday(), -62));
          var m = qq.val('employee_id'); if (m !== undefined) b = b.eq('member_id', m);
          var r = await b.order('day', { ascending: false }).limit(2000); if (r.error) throw r.error;
          return qq.pick((r.data || []).map(lwRow));
        }
        if (qq.op === 'insert' || qq.op === 'upsert') {
          var rows = [];
          for (var i = 0; i < qq.payload.length; i++) {
            var p = qq.payload[i];
            var x = await rpc('late_warn', { p_minutes: +p.minutes, p_reason: p.reason || null, p_shift_start: p.shift_start ? String(p.shift_start).slice(0, 5) : null, p_day: p.day || null });
            if (x.error) return { data: null, error: x.error };
            rows.push(Object.assign({}, p, lwRow({ id: x.data.id, member_id: x.data.member_id, day: x.data.day, minutes: x.data.minutes, reason: x.data.reason, shift_start: x.data.shift_start, created_at: x.data.at })));
          }
          SV.stale('notif'); return out(qq, rows);
        }
        return noWrite('late_warns');
      },
      dq_handovers: async function (qq) {
        if (qq.op === 'select') {
          if (!V()) return qq.pick([]);
          var r = await rpc('handovers', { p_days: 31 }); if (r.error) throw r.error;
          return qq.pick((r.data || []).map(hoRow));
        }
        if (qq.op === 'insert') {
          var rows = [];
          for (var i = 0; i < qq.payload.length; i++) {
            var p = qq.payload[i];
            var x = await rpc('handover_create', { p_to: p.to_id || null, p_cash: p.cash == null || p.cash === '' ? null : +p.cash, p_cash_note: p.cash_note || null,
              p_open_items: p.open_items || null, p_notes: p.notes || null, p_photos: (p.photos || []).map(function (f) { return fpath('task-photos', f); }),
              p_tasks: (p.tasks || []).filter(function (t) { return /^\d+$/.test(String(t.id)); }).map(function (t) { return { id: +t.id, act: t.act }; }) });
            if (x.error) return { data: null, error: x.error };
            rows.push(Object.assign({}, p, { id: x.data.id, notified: x.data.notified, created_at: new Date().toISOString(), mine: true }));
          }
          SV.stale('notif'); return out(qq, rows);
        }
        if (qq.op === 'update' && qq.payload && qq.payload.acked_at !== undefined) {
          var id = qq.val('id'); if (id === undefined) return noWrite('dq_handovers');
          var y = await rpc('handover_ack', { p_id: +id, p_note: qq.payload.ack_note || null }); if (y.error) return { data: null, error: y.error };
          SV.stale('notif', 'tasks');
          return out(qq, [Object.assign({ id: +id, acked_by: SV.me && SV.me.id, acked_at: new Date().toISOString() }, { already: !!(y.data && y.data.already), passed: y.data && y.data.passed })]);
        }
        return noWrite('dq_handovers');
      },
      /* подтверждение смены: schedule.update({ confirmed }) у своей смены → schedule_confirm; остальное — общим кодом */
      schedule: async function (qq, ex0) {
        var p = qq.payload;
        if (qq.op !== 'update' || !p || p.confirmed === undefined || !Object.keys(p).every(function (k) { return k === 'confirmed' || k === 'confirmed_at'; })) return ex0(qq);
        var m = qq.val('employee_id'), d = qq.val('day');
        if (d === undefined && qq.val('id') !== undefined) { await SV.load('sched'); var s = (SV.T.schedule || []).filter(function (x) { return String(x.id) === String(qq.val('id')); })[0]; if (s) { m = s.employee_id; d = s.day; } }
        if (!d || (m !== undefined && SV.me && m !== SV.me.id)) return { data: null, error: E('Подтвердить смену может только сам сотрудник', 'no_rights') };
        var r = await rpc('schedule_confirm', { p_day: d, p_answer: p.confirmed === 'yes' || p.confirmed === 'late' ? p.confirmed : 'no' });
        if (r.error) return { data: null, error: r.error };
        await SV.load('sched', true);
        return out(qq, (SV.T.schedule || []).filter(function (x) { return x.employee_id === (SV.me && SV.me.id) && x.day === d; }));
      },
      /* уведомления «Опоздает» и «Передача смены» сервер шлёт сам (late_warn, handover_*) — копия с телефона не нужна */
      notifications: async function (qq, ex0) {
        if (qq.op === 'insert' && qq.payload.length && qq.payload.every(function (n) { return n && (n.ref_type === 'latewarn' || n.ref_type === 'handover'); })) {
          return out(qq, qq.payload.map(function (n, i) { return Object.assign({ id: -(Date.now() + i), sv_skip: true }, n); }));
        }
        return ex0(qq);
      }
    };
    SV.dqTables = TBL;
    var ex0 = SV.exec;
    SV.exec = async function (qq) {
      var h = TBL[qq.t]; if (!h) return ex0.call(SV, qq);
      try { return await h(qq, function (q) { return ex0.call(SV, q); }); } catch (e) { return { data: null, error: e && e.message ? e : E(String(e)) }; }
    };
    /* ----- rpc 0021 напрямую ----- */
    var R = SV.rpcMap;
    function pass(n, st) { return async function (a) { var r = await rpc(n, a); if (!r.error && st) SV.stale.apply(null, st); return r; }; }
    R.shift_photo_add = pass('shift_photo_add'); R.shift_photo_remove = pass('shift_photo_remove');
    R.late_warn = pass('late_warn', ['notif']); R.schedule_confirm = pass('schedule_confirm', ['sched']);
    R.handover_create = pass('handover_create', ['notif']); R.handover_ack = pass('handover_ack', ['notif', 'tasks']);
    R.handovers = async function (a) { var r = await rpc('handovers', { p_days: (a && a.p_days) || 31 }); if (r.error) return r; return ok((r.data || []).map(hoRow)); };
    return cl;
  }
  A.dqExt = ext;
  var mk0 = A.make; A.make = function () { return ext(mk0.apply(this, arguments)); };
  if (root.supabase && root.supabase.__sv && root.supabase.createClient) {
    var cc0 = root.supabase.createClient;
    root.supabase.createClient = function () { return ext(cc0.apply(this, arguments)); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* === end 92q === */
/* === 92r requests === */
/* Часть dr (92r-requests, 0022_requests.sql): заявки на ремонт, бюро находок, заявки на закупку, список оборудования.
   Блок не трогает код выше: как 92o/92q — оборачивает SVAdapter.make и supabase.createClient и дополняет SV.rpcMap.
   Приложение зовёт те же имена, что и сервер (repair_* / equip_* / found_* / buy_* / requests_home); здесь — только пути фото
   (путь демо «<я>/dr-…» → настоящий <заведение>/<я>/task-photos-dr-…), службы сервера → коды приложения и «колокольчик» после действия.
   Ошибки сервера отдаются экрану как { error }. */
(function (root) {
  'use strict';
  var A = root.SVAdapter; if (!A || A.__dr) return; A.__dr = true;
  function ext(cl) {
    var SV = cl && cl.__sv; if (!SV || SV.__dr) return cl; SV.__dr = true;
    var real = SV.real;
    function V() { return SV.venueId; }
    function dl(id) { return id == null ? null : SV.dep.toLoc[id] || ('d' + id); }
    function fpath(p) { if (!p) return null; p = String(p); if (V() && p.indexOf(V() + '/') === 0) return p; return SV.pmap['task-photos|' + p] || SV.spath('task-photos', p); }
    function rows(r) { if (r.error || !Array.isArray(r.data)) return r; return { data: r.data.map(function (x) { return x && x.dept_id != null ? Object.assign({}, x, { dept_id: dl(x.dept_id) }) : x; }), error: null }; }
    function call(n, photo) {
      return async function (a) {
        a = Object.assign({}, a || {});
        if (photo && a[photo]) a[photo] = fpath(a[photo]);
        var r = await real.rpc(n, a);
        if (!r.error && !/_list$|^requests_home$/.test(n)) SV.stale('notif');
        return /_list$/.test(n) && n !== 'equip_list' ? rows(r) : r;
      };
    }
    var R = SV.rpcMap;
    ['repair_list', 'repair_assign', 'repair_take', 'repair_cancel', 'equip_list', 'equip_save', 'found_list', 'found_give',
     'buy_list', 'buy_create', 'buy_decide', 'buy_received', 'buy_cancel', 'requests_home'].forEach(function (n) { R[n] = call(n); });
    R.repair_create = call('repair_create', 'p_photo_path');
    R.repair_done = call('repair_done', 'p_photo_path');
    R.found_create = call('found_create', 'p_photo_path');
    R.buy_bought = call('buy_bought', 'p_receipt_path');
    return cl;
  }
  A.drExt = ext;
  var mk0 = A.make; A.make = function () { return ext(mk0.apply(this, arguments)); };
  if (root.supabase && root.supabase.__sv && root.supabase.createClient) {
    var cc0 = root.supabase.createClient;
    root.supabase.createClient = function () { return ext(cc0.apply(this, arguments)); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* === end 92r === */
/* === 92s misc === */
/* Часть ds (92s-misc, 0023_misc.sql): мелочи «демо → сервер». Блок не трогает код выше: как 92o/92q — оборачивает SVAdapter.make
   и supabase.createClient и дополняет SV: exec (свои таблицы раньше общего кода), rpcMap, functions.invoke (проба «я на месте»).
   Таблицы демо: template_skips («Не ставить»), allowed_networks (Wi-Fi), clock_attempts (неудачные попытки), audit_log («История изменений»),
   task_grades (оценки), messages scope=mgr (чат руководителей), hotel_settings (логотип из бакета → подписанная ссылка).
   rpc: task_item_add, wifi_*, task_grade, task_status 'back' («Переделать»), set_auto_clock / my_auto_clock, payslip_save / payslip_import,
   prefs_save (логотип-картинка → файл <заведение>/brand/…, в настройках только путь). Ошибки сервера отдаются экрану как { error }. */
(function (root) {
  'use strict';
  var A = root.SVAdapter; if (!A || A.__ds) return; A.__ds = true;
  var GR = { 5: 'good', 4: 'better', 3: 'better', 2: 'redo', 1: 'redo' };
  function ext(cl) {
    var SV = cl && cl.__sv; if (!SV || SV.__ds) return cl; SV.__ds = true;
    var real = SV.real, C = { redo: {}, sig: {}, titles: {} };
    function V() { return SV.venueId; }
    function E(m, c) { return { message: m, details: c || 'sv', code: c || 'sv' }; }
    function ok(d) { return { data: d === undefined ? null : d, error: null }; }
    function tday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()); }
    function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
    async function rpc(n, a) { return real.rpc(n, a || {}); }
    function fpath(bucket, p) { if (!p) return null; return SV.pmap[bucket + '|' + p] || SV.spath(bucket, p); }
    function out(qq, rows) { return { data: qq.one ? rows[0] || null : rows, error: null }; }
    function noWrite(t) { return { data: null, error: E('Запись «' + t + '» идёт через сервер', 'bad_input') }; }
    async function sign(path, sec) {
      var c = C.sig[path]; if (c && c.t > Date.now()) return c.u;
      try { var r = await real.storage.from(SV.bucket).createSignedUrl(path, sec || 604800); if (r && r.data && r.data.signedUrl) { C.sig[path] = { u: r.data.signedUrl, t: Date.now() + (sec || 604800) * 900 }; return r.data.signedUrl; } } catch (e) {}
      return null;
    }

    /* ----- задачи: заголовки для оценок ----- */
    async function titles(ids) {
      var need = ids.filter(function (id) { return C.titles[id] === undefined; });
      (SV.T.tasks || []).forEach(function (t) { C.titles[t.id] = t.title; });
      need = need.filter(function (id) { return C.titles[id] === undefined; });
      if (need.length) { var r = await real.from('tasks').select('id,title,day').in('id', need); (r.data || []).forEach(function (t) { C.titles[t.id] = t.title; }); }
    }
    function grRow(g) { return { id: g.id, task_id: g.task_id, employee_id: g.member_id, grade: GR[g.grade] || 'good', score: g.grade, reason: g.reason, by: g.graded_by, at: g.at, day: String(g.at || '').slice(0, 10), title: C.titles[g.task_id] || '' }; }

    var TBL = {
      /* «Каждый день» → «Не ставить»: пропуск ежедневной задачи одному человеку (0023 template_skip) */
      template_skips: async function (qq) {
        if (qq.op === 'select') {
          if (!V()) return qq.pick([]);
          var b = real.from('template_skips').select('*').eq('venue_id', V()), m = qq.val('employee_id'); if (m !== undefined) b = b.eq('member_id', m);
          var r = await b.limit(2000); if (r.error) throw r.error;
          return qq.pick((r.data || []).map(function (x) { return { id: x.id, employee_id: x.member_id, template_id: x.template_id, by: x.created_by, created_at: x.created_at }; }));
        }
        var L = qq.op === 'delete' ? [{ employee_id: qq.val('employee_id'), template_id: qq.val('template_id'), off: true }] : (qq.payload || []);
        for (var i = 0; i < L.length; i++) {
          var x = L[i]; if (x.employee_id == null || x.template_id == null) return { data: null, error: E('Нужны сотрудник и задача', 'bad_input') };
          var w = await rpc('template_skip', { p_template: +x.template_id, p_member: x.employee_id, p_on: !x.off }); if (w.error) return { data: null, error: w.error };
        }
        SV.stale('tasks');
        return out(qq, L.map(function (x) { return { employee_id: x.employee_id, template_id: +x.template_id }; }));
      },
      /* «Настройки отметки»: сети Wi-Fi заведения (rpc wifi_list — с адресом этого телефона) */
      allowed_networks: async function (qq) {
        if (qq.op !== 'select') return noWrite('allowed_networks');
        if (!V() || !SV.me || (SV.me.role !== 'owner' && SV.me.role !== 'manager')) return qq.pick([]);
        var r = await rpc('wifi_list'); if (r.error) throw r.error; SV.dsWifi = r.data || null;
        return qq.pick(((r.data && r.data.nets) || []).map(function (n) { return { id: n.id, label: n.label, ssid: n.label, net: n.net, ip: String(n.net || '').replace(/\/(32|128)$/, ''), created_at: n.created_at }; }));
      },
      /* неудачные (и удачные) попытки отметки: RLS people — владелец всех, руководитель команду */
      clock_attempts: async function (qq) {
        if (qq.op !== 'select') return noWrite('clock_attempts');
        if (!V()) return qq.pick([]);
        var b = real.from('clock_attempts').select('*').eq('venue_id', V()).gte('at', new Date(Date.now() - 40 * 864e5).toISOString()), o = qq.val('ok'), m = qq.val('employee_id');
        if (o !== undefined) b = b.eq('ok', o); if (m !== undefined) b = b.eq('member_id', m);
        var r = await b.order('at', { ascending: false }).limit(Math.min(500, qq.lim || 200)); if (r.error) throw r.error;
        return qq.pick((r.data || []).map(function (x) { return { id: x.id, employee_id: x.member_id, at: x.at, action: x.action, ok: x.ok, reason: x.detail === 'wifi' ? 'wifi' : x.reason, sv_reason: x.reason, dist_m: x.dist_m, ip: x.ip, source: x.source }; }));
      },
      /* «История изменений» в карточке: audit_log (читает только владелец) */
      audit_log: async function (qq) {
        if (qq.op !== 'select') return noWrite('audit_log');
        if (!V() || !SV.me || SV.me.role !== 'owner') return qq.pick([]);
        var b = real.from('audit_log').select('*').eq('venue_id', V()), tg = qq.val('target_id'); if (tg !== undefined) b = b.eq('target_id', tg);
        var r = await b.order('at', { ascending: false }).limit(Math.min(200, qq.lim || 50)); if (r.error) throw r.error;
        return qq.pick(r.data || []);
      },
      /* оценки задач: «Хорошо» 5 · «Можно лучше» 4 · «Переделать» 2 */
      task_grades: async function (qq) {
        if (qq.op === 'insert') {
          var outR = [];
          for (var i = 0; i < qq.payload.length; i++) {
            var g = qq.payload[i], w = await rpc('task_grade', { p_task: +g.task_id, p_grade: g.grade || 'good', p_reason: g.reason || null });
            if (w.error) return { data: null, error: w.error };
            if (g.grade === 'redo') C.redo[g.task_id] = g.reason || null;
            C.titles[g.task_id] = g.title || C.titles[g.task_id];
            outR.push(Object.assign({}, g, { id: w.data, at: g.at || new Date().toISOString() }));
            if (SV.dsGrades) SV.dsGrades.unshift({ id: w.data, task_id: +g.task_id, employee_id: g.employee_id, grade: g.grade || 'good', reason: g.reason || null, by: SV.me && SV.me.id, at: new Date().toISOString(), day: tday(), title: g.title || C.titles[g.task_id] || '' });
          }
          C.gAt = 0; SV.stale('tasks');
          return out(qq, outR);
        }
        if (qq.op !== 'select') return noWrite('task_grades');
        if (!V()) return qq.pick([]);
        var b = real.from('task_grades').select('*').eq('venue_id', V()).gte('at', new Date(Date.now() - 62 * 864e5).toISOString()), m = qq.val('employee_id'), t = qq.val('task_id');
        if (m !== undefined) b = b.eq('member_id', m); if (t !== undefined) b = b.eq('task_id', +t);
        var r = await b.order('at', { ascending: false }).limit(1000); if (r.error) throw r.error;
        await titles((r.data || []).map(function (x) { return x.task_id; }));
        var L = (r.data || []).map(grRow);
        if (m === undefined && t === undefined) { SV.dsGrades = L; C.gAt = Date.now(); }
        return qq.pick(L);
      },
      /* чат руководителей (scope = mgr); переписка в задаче и прочее — дальше (92o и общий код) */
      messages: async function (qq, ex0) {
        if (qq.op === 'select') {
          if (qq.val('scope') !== 'mgr') return ex0(qq);
          if (!SV.me || (SV.me.role !== 'owner' && SV.me.role !== 'manager')) return qq.pick([]);
          var r = await rpc('mgr_chat_list', { p_limit: Math.min(300, qq.lim || 100) }); if (r.error) throw r.error;
          return qq.pick((r.data || []).map(function (m) { return Object.assign({ scope: 'mgr', ref_id: null }, m); }));
        }
        if (qq.op !== 'insert' || !qq.payload.every(function (m) { return m.scope === 'mgr'; })) return ex0(qq);
        var o = [];
        for (var i = 0; i < qq.payload.length; i++) {
          var m = qq.payload[i];
          var x = await rpc('mgr_chat_send', { p_text: m.text || null, p_file_path: fpath('media', m.file_path), p_file_type: m.file_type || null, p_file_name: m.file_name || null, p_voice_sec: m.voice_sec != null ? Math.round(m.voice_sec) : null });
          if (x.error) return { data: null, error: x.error };
          o.push(Object.assign({}, m, { id: x.data, created_at: new Date().toISOString() }));
        }
        return out(qq, o);
      },
      /* логотип из бакета: в настройках путь brand_logo_path, приложению — подписанная ссылка (7 дней) */
      hotel_settings: async function (qq, ex0) {
        var r = await ex0(qq); if (qq.op !== 'select' || !r || r.error || !r.data) return r;
        var L = Array.isArray(r.data) ? r.data : [r.data];
        for (var i = 0; i < L.length; i++) { var p = L[i] && L[i].prefs; if (p && p.brand_logo_path && !p.brand_logo) { var u = await sign(p.brand_logo_path); if (u) p.brand_logo = u; } }
        return r;
      }
    };
    SV.dsTables = TBL;
    var ex0 = SV.exec;
    SV.exec = async function (qq) {
      var h = TBL[qq.t]; if (!h) return ex0.call(SV, qq);
      try { return await h(qq, function (q) { return ex0.call(SV, q); }); } catch (e) { return { data: null, error: e && e.message ? e : E(String(e)) }; }
    };

    /* ----- rpc ----- */
    var R = SV.rpcMap;
    function pass(n, st) { return async function (a) { var r = await rpc(n, a); if (!r.error && st) SV.stale.apply(null, st); return r; }; }
    R.task_item_add = pass('task_item_add', ['tasks']);
    R.task_grade = pass('task_grade', ['tasks']);
    R.template_skip = pass('template_skip', ['tasks']);
    R.wifi_list = async function () { var r = await rpc('wifi_list'); if (!r.error) SV.dsWifi = r.data || null; return r; };
    R.wifi_add = pass('wifi_add'); R.wifi_remove = pass('wifi_remove', ['base']); R.wifi_set = pass('wifi_set', ['base']);
    R.set_auto_clock = pass('set_auto_clock'); R.my_auto_clock = pass('my_auto_clock');
    R.mgr_chat_list = pass('mgr_chat_list'); R.mgr_chat_send = pass('mgr_chat_send', ['notif']);
    /* «Переделать» (45-mgr: task_status 'back'): на проверке — вернуть с причиной; принятая — снова в работу */
    var ts0 = R.task_status;
    R.task_status = async function (a) {
      if (!a || a.p_status !== 'back') return ts0(a);
      await SV.load('tasks', true); var t = (SV.T.tasks || []).filter(function (x) { return String(x.id) === String(a.p_id); })[0];
      if (!t) return { data: null, error: E('Задача не найдена', 'not_found') };
      var why = a.p_reason || a.p_comment || C.redo[t.id] || 'Переделать', cur = t.sv_status || t.status, r = null;
      if (cur === 'review') r = await rpc('task_review', { p_id: t.id, p_accept: false, p_grade: null, p_comment: why });
      else if (cur === 'done') r = await rpc('task_reopen', { p_id: t.id, p_reason: why });
      if (r && r.error) return r;
      delete C.redo[t.id]; await SV.load('tasks', true);
      return ok((SV.T.tasks || []).filter(function (x) { return x.id === t.id; })[0] || null);
    };
    /* расчётный лист: экран (92s) присылает уже серверный вид — p_head/p_lines или p_rows [{member_id, head, lines}] */
    R.payslip_save = async function (a) {
      if (!a || (a.p_lines === undefined && !a.p_reset)) return { data: null, error: E('Обновите приложение — правка листа изменилась', 'bad_input') };
      var r = await rpc('payslip_save', { p_payslip: +a.p_payslip, p_head: a.p_head || null, p_lines: a.p_lines || null, p_reset: !!a.p_reset }); if (!r.error) SV.stale('pay'); return r;
    };
    R.payslip_import = async function (a) {
      var rows = (a && a.p_rows) || [];
      if (rows.some(function (x) { return !x.member_id || !Array.isArray(x.lines); })) return { data: null, error: E('Обновите приложение — вставка из таблицы изменилась', 'bad_input') };
      var r = await rpc('payslip_import', { p_ym: a.p_ym, p_rows: rows }); if (!r.error) SV.stale('pay'); return r;
    };
    /* «Оформление»: логотип-картинка — файлом в бакет (<заведение>/brand/…), в настройках только путь; SVG до 80 КБ — как есть */
    var ps0 = R.prefs_save;
    R.prefs_save = async function (a) {
      var p = Object.assign({}, (a && a.p) || {});
      if (p.brand_logo !== undefined) {
        var s = String(p.brand_logo || '');
        if (!s) p.brand_logo_path = null;
        else if (/^data:image\/svg\+xml/i.test(s)) { if (s.length > 80000) return { data: null, error: E('SVG больше 80 КБ — сохраните логотип как PNG', 'bad_input') }; p.brand_logo_path = null; }
        else if (/^data:image\/(png|jpe?g|webp)/i.test(s)) {
          if (!V()) return { data: null, error: E('Нет входа', 'no_auth') };
          try {
            var bl = await (await fetch(s)).blob(), ext = /png/.test(bl.type) ? 'png' : /webp/.test(bl.type) ? 'webp' : 'jpg', path = V() + '/brand/logo-' + Date.now() + '.' + ext;
            var u = await real.storage.from(SV.bucket).upload(path, bl, { contentType: bl.type || 'image/png', upsert: false });
            if (u.error) return { data: null, error: u.error };
            p.brand_logo = ''; p.brand_logo_path = path;
          } catch (e) { return { data: null, error: E('Логотип не загрузился: ' + (e.message || e), 'server') }; }
        } else if (/^https?:/.test(s)) delete p.brand_logo;              /* подписанная ссылка уже сохранённого файла — путь не меняется */
      }
      var r = await ps0(Object.assign({}, a, { p: p }));
      if (r && !r.error && r.data && r.data.brand_logo_path && !r.data.brand_logo) { var su = await sign(r.data.brand_logo_path); if (su) r.data.brand_logo = su; }
      return r;
    };

    /* ----- «Подсказка о приходе»: проба «я на месте» — только да/нет (0023 clock_probe) ----- */
    var inv0 = cl.functions.invoke;
    cl.functions.invoke = async function (n, o) {
      var b = (o && o.body) || {}; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      if (n === 'clock' && b.action === 'probe' && b.lat != null) {
        var r = await rpc('clock_probe', { p_lat: +b.lat, p_lng: +b.lng });
        return { data: { ok: true, in_hotel: !!(r.data && r.data.in_zone) }, error: null };
      }
      return inv0.apply(this, arguments);
    };
    return cl;
  }
  A.dsExt = ext;
  var mk0 = A.make; A.make = function () { return ext(mk0.apply(this, arguments)); };
  if (root.supabase && root.supabase.__sv && root.supabase.createClient) {
    var cc0 = root.supabase.createClient;
    root.supabase.createClient = function () { return ext(cc0.apply(this, arguments)); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* === end 92s === */
/* === 92v praise === */
/* Часть dv (92v-praise, 0025_praise.sql): «Спасибо», доска почёта, «Оспорить баллы». Блок не трогает код выше: как 92s — оборачивает
   SVAdapter.make / supabase.createClient и дополняет SV.rpcMap. rpc 0025 идут на сервер как есть; staff_rating (рейтинг) дополняется
   строками разбора (опоздания, задачи, «Спасибо», корректировка) и bonus — баллы «Спасибо» + принятые корректировки
   (экран пересчитывает основу баллов сам, bonus прибавляет 92v). Уведомления о «Спасибо» и спорах шлёт сервер — с телефона не дублируются. */
(function (root) {
  'use strict';
  var A = root.SVAdapter; if (!A || A.__dv) return; A.__dv = true;
  function ext(cl) {
    var SV = cl && cl.__sv; if (!SV || SV.__dv) return cl; SV.__dv = true;
    var real = SV.real, R = SV.rpcMap; if (!R) return cl;
    function pass(n, st) { return async function (a) { var r = await real.rpc(n, a || {}); if (!r.error && st) SV.stale.apply(null, st); return r; }; }
    R.praise_send = pass('praise_send', ['notif']);
    R.praise_feed = pass('praise_feed');
    R.honor_get = pass('honor_get'); R.honor_set = pass('honor_set', ['notif']); R.honor_clear = pass('honor_clear');
    R.rating_dispute = pass('rating_dispute', ['notif']); R.dispute_list = pass('dispute_list'); R.dispute_decide = pass('dispute_decide', ['notif']);
    var sr0 = R.staff_rating;
    if (sr0) R.staff_rating = async function (a) {
      var ym = String((a && (a.p_from || a.p_to)) || '').slice(0, 7), r = await real.rpc('rating', ym ? { p_ym: ym } : {}); if (r.error) return r;
      var by = {}; (r.data || []).forEach(function (x) { by[x.member_id] = x.parts || {}; });
      var o = await sr0(a); if (!o || o.error || !Array.isArray(o.data)) return o;
      o.data.forEach(function (x) { var p = by[x.id] || {};
        x.late_days = p.late_days; x.tasks_done = p.tasks_done; x.tasks_all = p.tasks_all; x.base = p.base;
        x.praise = +p.praise || 0; x.praise_pts = +p.praise_pts || 0; x.adj = +p.adj || 0; x.bonus = (+p.praise_pts || 0) + (+p.adj || 0); x.sv_bonus = true; });
      return o;
    };
    return cl;
  }
  A.dvExt = ext;
  var mk0 = A.make; A.make = function () { return ext(mk0.apply(this, arguments)); };
  if (root.supabase && root.supabase.__sv && root.supabase.createClient) {
    var cc0 = root.supabase.createClient;
    root.supabase.createClient = function () { return ext(cc0.apply(this, arguments)); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* === end 92v === */
/* === 92u daily === */
/* Часть du (92u-daily, 0024_daily.sql): «Ушёл раньше», «Итоги вчера», дни рождения, знакомство один раз. Блок не трогает код выше:
   как 92o/92q/92s — оборачивает SVAdapter.make и supabase.createClient и дополняет SV.rpcMap.
   rpc: bday_today (карточка «Сегодня день рождения»), tour_state / tour_done (знакомство с приложением — один раз на любом телефоне).
   Уведомления «Ушёл раньше», «Итоги вчера», «День рождения» шлёт сервер (задание jamoa-daily) — с телефона их не шлём. */
(function (root) {
  'use strict';
  var A = root.SVAdapter; if (!A || A.__du) return; A.__du = true;
  function ext(cl) {
    var SV = cl && cl.__sv; if (!SV || SV.__du) return cl; SV.__du = true;
    var real = SV.real, R = SV.rpcMap;
    function pass(n) { return async function (a) { return real.rpc(n, a || {}); }; }
    R.bday_today = pass('bday_today'); R.tour_state = pass('tour_state'); R.tour_done = pass('tour_done');
    return cl;
  }
  A.duExt = ext;
  var mk0 = A.make; A.make = function () { return ext(mk0.apply(this, arguments)); };
  if (root.supabase && root.supabase.__sv && root.supabase.createClient) {
    var cc0 = root.supabase.createClient;
    root.supabase.createClient = function () { return ext(cc0.apply(this, arguments)); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* === end 92u === */
/* === 92w geofree === */
/* Часть dw (92w-geofree, 0026_geofree.sql): «Отмечаться без геолокации» для конкретного сотрудника. Блок не трогает код выше
   (кроме одного поля geo_free в memRow / attRow): как 92s/92u — оборачивает SVAdapter.make / supabase.createClient и дополняет SV.rpcMap.
   rpc: member_geo_free (переключатель в карточке; после — перечитать сотрудников и уведомления), my_geo_free (спрашивать ли геолокацию).
   Журнал (audit_log) и уведомление сотруднику пишет сервер (триггер members_dw_geo) — с телефона не дублируются. */
(function (root) {
  'use strict';
  var A = root.SVAdapter; if (!A || A.__dw) return; A.__dw = true;
  function ext(cl) {
    var SV = cl && cl.__sv; if (!SV || SV.__dw) return cl; SV.__dw = true;
    var real = SV.real, R = SV.rpcMap; if (!R) return cl;
    R.member_geo_free = async function (a) {
      var r = await real.rpc('member_geo_free', { p_member: a && (a.p_member || a.p_id), p_on: !!(a && a.p_on) }); if (r.error) return r;
      var e = (SV.T.employees || []).filter(function (x) { return x.id === (a.p_member || a.p_id); })[0]; if (e) e.geo_free = !!(r.data && r.data.geo_free);
      SV.stale('base', 'notif'); return r;
    };
    R.my_geo_free = async function () {
      var r = await real.rpc('my_geo_free'); if (r.error) return r;
      if (SV.me) SV.me.geo_free = r.data === true; var e = SV.me && (SV.T.employees || []).filter(function (x) { return x.id === SV.me.id; })[0]; if (e) e.geo_free = r.data === true;
      return r;
    };
    return cl;
  }
  A.dwExt = ext;
  var mk0 = A.make; A.make = function () { return ext(mk0.apply(this, arguments)); };
  if (root.supabase && root.supabase.__sv && root.supabase.createClient) {
    var cc0 = root.supabase.createClient;
    root.supabase.createClient = function () { return ext(cc0.apply(this, arguments)); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
/* === end 92w === */
