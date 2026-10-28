/* Mir Luxe One — демо-мок пакета ops-maint (заявки инженерам).
   Подключается сразу после demo-mock.js. Даты демо уже сдвинуты на сегодня. */
(function () {
  var DB = window.__DB; if (!DB) return;
  var now = Date.now(), tday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  var dayStart = Date.parse(tday + 'T00:00:00+05:00');
  // сид: заявка, выполненная сегодня (≈2 ч назад, но не раньше начала суток)
  var done = Math.max(now - 2 * 3600e3, dayStart + 5 * 60e3);
  DB.maint_requests = DB.maint_requests || [];
  if (!DB.maint_requests.some(function (x) { return x.id === 304; })) DB.maint_requests.push({
    id: 304, room_no: '507', place: null, text: 'Не горит свет в санузле', urgent: false, status: 'done',
    created_by: 'e14', created_at: new Date(Math.max(done - 80 * 60e3, dayStart)).toISOString(),
    assigned_to: 'e40', taken_at: new Date(Math.max(done - 60 * 60e3, dayStart)).toISOString(),
    done_at: new Date(done).toISOString(), done_note: 'Заменил лампу в санузле', photo_path: null
  });

  var sess = null;
  var orig = window.supabase && window.supabase.createClient; if (!orig) return;
  window.supabase.createClient = function () {
    var c = orig.apply(this, arguments);
    if (c.__opsMaint) return c; c.__opsMaint = true;
    try { c.auth.onAuthStateChange(function (ev, s) { sess = s; }); } catch (e) {}
    var from = c.from;
    c.from = function (t) {
      var q = from.call(c, t);
      if (t !== 'maint_requests') return q;
      var then = q.then;
      q.then = function (res, rej) {
        var p = this.op === 'update' ? this.payload : null;
        return then.call(this, function (r) {
          try {
            var me = sess && DB.employees.filter(function (e) { return e.user_id === sess.user.id; })[0];
            if (p && p.assigned_to && (!me || p.assigned_to !== me.id) && r && !r.error) {
              DB.notifications = DB.notifications || [];
              (r.data || []).forEach(function (x) {
                DB.notifications.push({ id: 9000 + DB.notifications.length, employee_id: p.assigned_to, at: new Date().toISOString(),
                  title: 'Вам назначена заявка', body: (x.room_no || x.place || '') + ': ' + x.text,
                  ref_type: 'maint', ref_id: x.id, urgent: !!x.urgent, read_at: null });
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
