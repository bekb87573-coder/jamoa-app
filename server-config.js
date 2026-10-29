/* Jamoa · S4 · режим работы приложения: демо (учебные данные в браузере) или настоящий сервер.
   Здесь нет ничего секретного: адрес проекта и publishable-ключ (публичный по природе, права даёт только RLS в базе).
   mode: 'demo' — по умолчанию; 'server' — сборка W4OUT=srv JAMOA_DEMO=false (build.py подставляет сам).
   Проверить сервер с телефона: selfcheck.html рядом с app.html. */
window.JAMOA_SERVER = {
  mode: 'server',
  url: 'https://yysodxwxpfdaalwjfizs.supabase.co',          // Supabase-проект jamoa-dev (только учебные данные)
  key: 'sb_publishable_qIUfJQ-qTgJ3L1wGrR6img_iPJhg9pA',     // publishable-ключ (публичный)
  staffDomain: 'staff.jamoa.uz',                            // почта входа сотрудника = <логин>@staff.jamoa.uz (как в staff-auth)
  bucket: 'jamoa-photos',                                   // фото: приватный бакет, путь <venue_id>/<member_id>/...
  lib: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
};
(function () {
  var C = window.JAMOA_SERVER;
  /* рабочий сайт: всегда настоящий сервер, учебного режима нет */
  try { localStorage.setItem('jamoa-mode', 'server'); } catch (e) {}
  if (C.mode === 'server' && window.JAMOA_DEMO === undefined) window.JAMOA_DEMO = false;
  if (window.JAMOA_DEMO === false && !window.JAMOA_SELFCHECK) {   /* selfcheck.html берёт только адрес и ключ */
    C.mode = 'server';
    document.write('<script src="' + C.lib + '"><\/script><script src="sv-adapter.js"><\/script>');
  }
})();
