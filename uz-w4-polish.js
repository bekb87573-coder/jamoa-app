/* 92i-polish — волна D, часть I: узбекская латиница (кириллица получается сама) */
Object.assign(window.MLX_UZ_EXTRA = window.MLX_UZ_EXTRA || {}, {
  'Мой график': 'Mening jadvalim',
  'График команды': 'Jamoa jadvali',
  'Кнопка «Пришёл» наверху главной': 'Boş sahifa tepasidagi «Keldim» tugmasi',
  'На главной нажмите «Пришёл». Уходя — «Ушёл». Если отметка не прошла, приложение покажет причину и предложит отметиться по фото.': 'Boş sahifada «Keldim» tugmasini bosing. Ketayotganda — «Ketdim». Belgi ötmasa, ilova sababini körsatadi va surat orqali belgilaşni taklif qiladi.',
  'Вы в отеле. Нажмите «Пришёл»': 'Siz mehmonxonadasiz. «Keldim» tugmasini bosing',
  'нет разрешения на геолокацию': 'geolokatsiyaga ruxsat yöq',
  'Вход закрыт: сотрудник в архиве. Обратитесь к руководителю.': 'Kiriş yopilgan: xodim arxivda. Rahbaringizga murojaat qiling.',
  'Ежедневная задача': 'Kundalik vazifa',
  'Для должности ежедневных задач нет': 'Bu lavozim uçun kundalik vazifalar yöq',
  'Вы сегодня здоровы — нет температуры и недомогания?': 'Bugun soğlommisiz — harorat va behollik yöqmi?',
  'дд.мм.гггг': 'kk.oo.yyyy',
  'мм.гггг': 'oo.yyyy',
  'решает владелец': 'egasi hal qiladi',
  'Сообщений пока нет': 'Hozirça xabarlar yöq'
});
/* учебные задачи «Генуборка: …» и «Плановые работы: …» (часть 21) — в ядре словарь модуля не грузится */
(function () {
  var X = window.MLX_UZ_EXTRA, N = {
    'Люстры в холле': 'Xolldagi qandillar', 'Матрасы перевернуть': 'Matraslarni ağdariş', 'Шторы постирать': 'Pardalarni yuviş',
    'Общая кухня — холодильник': 'Umumiy oşxona — muzlatkiç', 'Вытяжка над плитой': 'Plita ustidagi sörgiç', 'Люстры в зале': 'Zaldagi qandillar',
    'Окна и витрины': 'Derazalar va vitrinalar', 'Холодильные камеры': 'Sovutiş kameralari', 'Склад — полки': 'Ombor — tokçalar',
    'Мойка — сифоны': 'Yuviş joyi — sifonlar', 'Плитка за плитой': 'Plita orqasidagi kafel', 'Вентиляция зала': 'Zal ventilyatsiyasi',
    'Стулья — чистка обивки': 'Stullar — qoplamani tozalaş', 'Подсобка': 'Yordamçi xona', 'Терраса': 'Terrasa', 'Санузлы — генеральная': 'Sanuzellar — general tozalaş',
    'Кондиционеры — чистка фильтров': 'Konditsionerlar — filtrlarni tozalaş', 'Вытяжка — проверка': 'Sörgiç — tekşiriş', 'Бойлер — промывка': 'Boyler — yuviş'
  };
  for (var i = 100; i < 1000; i++) N['Номер ' + i] = 'Xona ' + i;
  Object.keys(N).forEach(function (k) { X['Генуборка: ' + k] = 'General tozalaş: ' + N[k]; X['Плановые работы: ' + k] = 'Rejali işlar: ' + N[k]; X[k] = X[k] || N[k]; });
  /* «Раз в 90 дн. Последний раз 23.07.» */
  var P = [7, 30, 60, 90, 180], d = new Date(2026, 0, 1);
  for (var j = 0; j < 400; j++) {
    var x = new Date(2025, 9, 1 + j), dm = ('0' + x.getDate()).slice(-2) + '.' + ('0' + (x.getMonth() + 1)).slice(-2);
    P.forEach(function (p) { X['Раз в ' + p + ' дн. Последний раз ' + dm + '.'] = p + ' kunda bir marta. Oxirgi marta ' + dm + '.'; });
  }
  void d;
})();
