/* 92i-polish — волна D, часть I: узбекская латиница (кириллица получается сама) */
Object.assign(window.MLX_UZ_EXTRA = window.MLX_UZ_EXTRA || {}, {
  'Мой график': 'Mening jadvalim',
  'График команды': 'Jamoa jadvali',
  'Кнопка «Пришёл» наверху главной': 'Bosh sahifa tepasidagi «Keldim» tugmasi',
  'На главной нажмите «Пришёл». Уходя — «Ушёл». Если отметка не прошла, приложение покажет причину и предложит отметиться по фото.': 'Bosh sahifada «Keldim» tugmasini bosing. Ketayotganda — «Ketdim». Belgi oʻtmasa, ilova sababini koʻrsatadi va surat orqali belgilashni taklif qiladi.',
  'Вы в отеле. Нажмите «Пришёл»': 'Siz mehmonxonadasiz. «Keldim» tugmasini bosing',
  'нет разрешения на геолокацию': 'geolokatsiyaga ruxsat yoʻq',
  'Вход закрыт: сотрудник в архиве. Обратитесь к руководителю.': 'Kirish yopilgan: xodim arxivda. Rahbaringizga murojaat qiling.',
  'Ежедневная задача': 'Kundalik vazifa',
  'Для должности ежедневных задач нет': 'Bu lavozim uchun kundalik vazifalar yoʻq',
  'Вы сегодня здоровы — нет температуры и недомогания?': 'Bugun sogʻlommisiz — harorat va behollik yoʻqmi?',
  'дд.мм.гггг': 'kk.oo.yyyy',
  'мм.гггг': 'oo.yyyy',
  'решает владелец': 'egasi hal qiladi',
  'Сообщений пока нет': 'Hozircha xabarlar yoʻq'
});
/* учебные задачи «Генуборка: …» и «Плановые работы: …» (часть 21) — в ядре словарь модуля не грузится */
(function () {
  var X = window.MLX_UZ_EXTRA, N = {
    'Люстры в холле': 'Xolldagi qandillar', 'Матрасы перевернуть': 'Matraslarni agʻdarish', 'Шторы постирать': 'Pardalarni yuvish',
    'Общая кухня — холодильник': 'Umumiy oshxona — muzlatkich', 'Вытяжка над плитой': 'Plita ustidagi soʻrgich', 'Люстры в зале': 'Zaldagi qandillar',
    'Окна и витрины': 'Derazalar va vitrinalar', 'Холодильные камеры': 'Sovutish kameralari', 'Склад — полки': 'Ombor — tokchalar',
    'Мойка — сифоны': 'Yuvish joyi — sifonlar', 'Плитка за плитой': 'Plita orqasidagi kafel', 'Вентиляция зала': 'Zal ventilyatsiyasi',
    'Стулья — чистка обивки': 'Stullar — qoplamani tozalash', 'Подсобка': 'Yordamchi xona', 'Терраса': 'Terrasa', 'Санузлы — генеральная': 'Sanuzellar — general tozalash',
    'Кондиционеры — чистка фильтров': 'Konditsionerlar — filtrlarni tozalash', 'Вытяжка — проверка': 'Soʻrgich — tekshirish', 'Бойлер — промывка': 'Boyler — yuvish'
  };
  for (var i = 100; i < 1000; i++) N['Номер ' + i] = 'Xona ' + i;
  Object.keys(N).forEach(function (k) { X['Генуборка: ' + k] = 'General tozalash: ' + N[k]; X['Плановые работы: ' + k] = 'Rejali ishlar: ' + N[k]; X[k] = X[k] || N[k]; });
  /* «Раз в 90 дн. Последний раз 23.07.» */
  var P = [7, 30, 60, 90, 180], d = new Date(2026, 0, 1);
  for (var j = 0; j < 400; j++) {
    var x = new Date(2025, 9, 1 + j), dm = ('0' + x.getDate()).slice(-2) + '.' + ('0' + (x.getMonth() + 1)).slice(-2);
    P.forEach(function (p) { X['Раз в ' + p + ' дн. Последний раз ' + dm + '.'] = p + ' kunda bir marta. Oxirgi marta ' + dm + '.'; });
  }
  void d;
})();
