/* Mir Luxe One — демо-мок пакета front-access (круг 03).
   Подключается сразу после demo-mock.js. Оборачивает window.supabase.createClient цепочкой:
   - rpc('leave_decide'): решение по запросу «отпроситься» с проверкой прав (директор или руководитель цепочки);
   - имитация серверного триггера уведомлений на новые задачи (tasks.insert);
   - учебный запрос «отпроситься» у сотрудника бухгалтерии (уже решён) — чтобы было видно, что руководитель видит только свою команду. */
(function () {
  var DB = window.__DB; if (!DB || !window.supabase || !window.supabase.createClient) return;
  function tzDay(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d || new Date()); }
  function emp(id) { return (DB.employees || []).filter(function (e) { return e.id === id; })[0] || null; }
  var AS0 = /as=([a-z0-9._]+)/.exec(location.hash || ''); // приложение потом убирает #as= из адреса — запоминаем при загрузке, как demo-mock
  function me() {
    var a = /as=([a-z0-9._]+)/.exec(location.hash || '') || AS0, uid = null;
    if (a) { var e = (DB.employees || []).filter(function (x) { return x.login === a[1]; })[0]; return e || null; }
    try { var s = JSON.parse(localStorage.getItem('mock-session')); uid = s && s.user && s.user.id; } catch (x) {}
    return (DB.employees || []).filter(function (x) { return x.user_id === uid; })[0] || null;
  }
  function nextId(t) { var m = 0; (DB[t] || []).forEach(function (r) { if (typeof r.id === 'number' && r.id > m) m = r.id; }); return Math.max(m, 9000) + 1; }
  function inChain(empId, bossId) { var e = emp(empId), guard = 0; while (e && e.manager_id && guard++ < 20) { if (e.manager_id === bossId) return true; e = emp(e.manager_id); } return false; }
  function dm(d) { return d ? d.slice(8, 10) + '.' + d.slice(5, 7) : ''; }
  function t5(t) { return t ? String(t).slice(0, 5) : ''; }
  function what(x) { return x.kind === 'out' ? 'выйти в ' + t5(x.from_time) + ' на ' + x.minutes + ' мин' : x.kind === 'late' ? 'придёт к ' + t5(x.from_time) : 'уйти в ' + t5(x.from_time); }

  // учебный решённый запрос сотрудника бухгалтерии (e3 → руководитель e2 azamat.x)
  DB.leave_requests = DB.leave_requests || [];
  if (!DB.leave_requests.some(function (x) { return x.id === 602; })) {
    var yd = tzDay(new Date(Date.now() - 864e5));
    DB.leave_requests.push({ id: 602, employee_id: 'e3', kind: 'out', day: yd, from_time: '12:30:00', minutes: 60, reason: 'В банк — подать документы', status: 'yes', decided_by: 'e0', decided_at: yd + 'T10:05:00+05:00', created_at: yd + 'T09:40:00+05:00' });
  }

  function leaveDecide(a) {
    var m = me(), x = (DB.leave_requests || []).filter(function (r) { return r.id === +a.p_id; })[0];
    if (!m) return { data: null, error: { message: 'Нет доступа' } };
    if (!x) return { data: null, error: { message: 'Запрос не найден' } };
    if (m.role !== 'director' && !inChain(x.employee_id, m.id)) return { data: null, error: { message: 'Нет доступа' } };
    if (x.status !== 'new') return { data: null, error: { message: 'Запрос уже решён' } };
    var now = new Date().toISOString();
    x.status = a.p_ok ? 'yes' : 'no'; x.decided_by = m.id; x.decided_at = now; x.decision_note = a.p_note || null;
    var dirs = {}; (DB.employees || []).forEach(function (e) { if (e.role === 'director') dirs[e.id] = 1; });
    (DB.notifications || []).forEach(function (n) { if (n.ref_type === 'leave' && !n.read_at && dirs[n.employee_id] && (n.ref_id === x.id || n.ref_id == null)) n.read_at = now; });
    DB.notifications = DB.notifications || [];
    DB.notifications.push({ id: nextId('notifications'), employee_id: x.employee_id, ref_type: 'leave', ref_id: x.id, title: a.p_ok ? 'Разрешено' : 'Отказано', body: dm(x.day) + ', ' + what(x) + (a.p_note ? ' · ' + a.p_note : ''), urgent: false, at: now, read_at: null });
    return { data: { ok: true, status: x.status }, error: null };
  }

  function taskNotify(rows) {
    DB.notifications = DB.notifications || [];
    [].concat(rows || []).forEach(function (r) {
      if (!r || !r.assignee_id || r.assignee_id === r.created_by) return;
      DB.notifications.push({ id: nextId('notifications'), employee_id: r.assignee_id, ref_type: 'task', ref_id: r.id, title: r.urgent ? 'Срочная задача' : 'Новая задача', body: r.title + (r.due_time ? ' · до ' + t5(r.due_time) : ''), urgent: !!r.urgent, at: new Date().toISOString(), read_at: null });
    });
  }

  var prev = window.supabase.createClient;
  window.supabase.createClient = function () {
    var c = prev.apply(this, arguments), w = Object.create(c);
    w.rpc = function (n, a) {
      if (n === 'leave_decide') return Promise.resolve(leaveDecide(a || {}));
      return c.rpc.apply(c, arguments);
    };
    w.from = function (t) {
      var q = c.from.apply(c, arguments);
      if (t !== 'tasks') return q;
      var then0 = q.then;
      q.then = function (res, rej) {
        return then0.call(q, function (r) { if (q.op === 'insert' && r && !r.error) { try { taskNotify(r.data); } catch (x) {} } return r; }).then(res, rej);
      };
      return q;
    };
    return w;
  };
})();
