/* 92y «Полномочия» — узбекский (латиница). Кириллица — автоматически (94-cyr). */
(function () {
  var T = {
    'Полномочия': 'Vakolatlar',
    'включено': 'yoqilgan',
    'Дополнительные права сотрудника. Руководитель сохраняет права над своей командой.': 'Xodimning qoʻshimcha huquqlari. Rahbar oʻz jamoasi ustidagi huquqlarini saqlab qoladi.',
    'Своя служба': 'Oʻz boʻlimi',
    'Всё заведение': 'Butun muassasa',
    'своя служба': 'oʻz boʻlimi',
    'всё заведение': 'butun muassasa',
    'Доступ открыт': 'Ruxsat ochildi',
    'Доступ закрыт': 'Ruxsat yopildi',
    'Открыт доступ': 'Ruxsat ochildi',
    'Закрыт доступ': 'Ruxsat yopildi',
    'Ваши полномочия': 'Sizning vakolatlaringiz',
    'Пульт по вашим полномочиям. Их даёт владелец.': 'Panel vakolatlaringiz boʻyicha. Ularni egasi beradi.',
    'График службы': 'Boʻlim jadvali',
    'Составить, изменить и опубликовать график': 'Jadvalni tuzish, oʻzgartirish va eʼlon qilish',
    'Охват: всё заведение': 'Qamrov: butun muassasa',
    'Охват: своя служба': 'Qamrov: oʻz boʻlimi',
    /* направления */
    'Карта сотрудников': 'Xodimlar xaritasi',
    'Смотреть, где отмечались люди': 'Odamlar qayerda belgilanganini koʻrish',
    'График': 'Jadval',
    'Составлять, менять и публиковать график': 'Jadvalni tuzish, oʻzgartirish va eʼlon qilish',
    'Приход и уход': 'Kelish va ketish',
    'Смотреть отметки, решать «вне зоны» и «забыл отметиться», принимать объяснительные': 'Belgilarni koʻrish, «hududdan tashqari» va «belgilashni unutdi»ni hal qilish, tushuntirish xatlarini qabul qilish',
    'Задачи': 'Vazifalar',
    'Ставить задачи другим, принимать и возвращать, фото-отчёты': 'Boshqalarga vazifa berish, qabul qilish va qaytarish, foto-hisobotlar',
    'Отпуска и отгулы': 'Taʼtil va dam olish kunlari',
    'Решать отпуска, отгулы, «Отпроситься» и обмены сменами': 'Taʼtil, dam olish kuni, «Ruxsat soʻrash» va smena almashishni hal qilish',
    'Команда': 'Jamoa',
    'Приглашать, менять данные, переводить и увольнять сотрудников': 'Xodimlarni taklif qilish, maʼlumotlarini oʻzgartirish, oʻtkazish va ishdan boʻshatish',
    'Заработок и расчётные листы': 'Daromad va hisob varaqalari',
    'Смотреть и править заработок и расчётные листы': 'Daromad va hisob varaqalarini koʻrish va tuzatish',
    'Штрафы, премии, аванс': 'Jarimalar, mukofotlar, avans',
    'Ставить штрафы и премии, решать аванс': 'Jarima va mukofot berish, avansni hal qilish',
    'Заявки': 'Arizalar',
    'Ремонт — назначать, находки — выдавать, закупки — одобрять': 'Taʼmir — tayinlash, topilmalar — berish, xaridlar — maʼqullash',
    'Объявления': 'Eʼlonlar',
    'Писать объявления': 'Eʼlon yozish',
    'Рейтинг и награды': 'Reyting va mukofotlar',
    'Номинации, споры по баллам, «Допуск к работе» — засчитывать навыки': 'Nominatsiyalar, ballar boʻyicha bahslar, «Ishga ruxsat» — koʻnikmalarni qabul qilish',
    'Отчёты и итоги дня': 'Hisobotlar va kun yakunlari',
    'Смотреть отчёты и сводку дня': 'Hisobotlar va kun xulosasini koʻrish',
    'Настройки заведения': 'Muassasa sozlamalari',
    'Настройки отметки и приложения (только всё заведение)': 'Belgilash va ilova sozlamalari (faqat butun muassasa)',
    /* ошибки сервера */
    'Себе полномочия не дают': 'Oʻzingizga vakolat berilmaydi',
    'Владелец и так может всё': 'Egasi baribir hammasini qila oladi',
    'Неизвестное полномочие': 'Nomaʼlum vakolat',
    'Охват — «Своя служба» или «Всё заведение»': 'Qamrov — «Oʻz boʻlimi» yoki «Butun muassasa»',
    'Настройки заведения — только «Всё заведение»': 'Muassasa sozlamalari — faqat «Butun muassasa»',
    'Полномочия видит владелец': 'Vakolatlarni egasi koʻradi',
    'Нужно полномочие на всё заведение': 'Butun muassasaga vakolat kerak',
    'Приглашать можно только сотрудников': 'Faqat xodimlarni taklif qilish mumkin',
    'Начальник — человек из вашей службы': 'Boshliq — boʻlimingizdagi odam',
    'Роль меняет владелец': 'Rolni egasi oʻzgartiradi',
    'Перевести можно только в вашу службу': 'Faqat oʻz boʻlimingizga oʻtkazish mumkin',
    'Руководителя и бухгалтера переводит владелец': 'Rahbar va buxgalterni egasi oʻtkazadi',
    'Уволить можно сотрудника из вашего охвата; руководителя — владелец': 'Faqat qamrovingizdagi xodimni boʻshatish mumkin; rahbarni — egasi',
    'Расчёт этого сотрудника вам не доступен': 'Bu xodimning hisobi sizga ochiq emas',
    'Потолки премий, аванса и видимость заработка меняет владелец': 'Mukofot va avans chegaralarini, daromad koʻrinishini egasi oʻzgartiradi'
  };
  /* заголовки и тексты уведомлений сервера: «Вам открыт доступ: …», «Доступ закрыт: …», «Владелец закрыл полномочие «…»» */
  var P = [['Карта сотрудников', 'Xodimlar xaritasi'], ['График', 'Jadval'], ['Приход и уход', 'Kelish va ketish'], ['Задачи', 'Vazifalar'],
    ['Отпуска, отгулы и обмены сменами', 'Taʼtil, dam olish kunlari va smena almashish'], ['Отпуска и отгулы', 'Taʼtil va dam olish kunlari'], ['Команда', 'Jamoa'],
    ['Заработок и расчётные листы', 'Daromad va hisob varaqalari'], ['Штрафы, премии, аванс', 'Jarimalar, mukofotlar, avans'], ['Заявки', 'Arizalar'],
    ['Объявления', 'Eʼlonlar'], ['Рейтинг, награды и допуск к работе', 'Reyting, mukofotlar va ishga ruxsat'], ['Рейтинг и награды', 'Reyting va mukofotlar'],
    ['Отчёты и итоги дня', 'Hisobotlar va kun yakunlari'], ['Настройки заведения', 'Muassasa sozlamalari']];
  P.forEach(function (p) {
    T['Вам открыт доступ: ' + p[0]] = 'Sizga ruxsat ochildi: ' + p[1];
    T['Доступ закрыт: ' + p[0]] = 'Ruxsat yopildi: ' + p[1];
    T['Владелец закрыл полномочие «' + p[0] + '»'] = 'Egasi «' + p[1] + '» vakolatini yopdi';
  });
  Object.assign(window.MLX_UZ_EXTRA = window.MLX_UZ_EXTRA || {}, T);
})();
