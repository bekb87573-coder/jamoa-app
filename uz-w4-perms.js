/* 92y «Полномочия» — узбекский (латиница). Кириллица — автоматически (94-cyr). */
(function () {
  var T = {
    'Полномочия': 'Vakolatlar',
    'включено': 'yoqilgan',
    'Дополнительные права сотрудника. Руководитель сохраняет права над своей командой.': 'Xodimning qöşimça huquqlari. Rahbar öz jamoasi ustidagi huquqlarini saqlab qoladi.',
    'Своя служба': 'Öz bölimi',
    'Всё заведение': 'Butun muassasa',
    'своя служба': 'öz bölimi',
    'всё заведение': 'butun muassasa',
    'Доступ открыт': 'Ruxsat oçildi',
    'Доступ закрыт': 'Ruxsat yopildi',
    'Открыт доступ': 'Ruxsat oçildi',
    'Закрыт доступ': 'Ruxsat yopildi',
    'Ваши полномочия': 'Sizning vakolatlaringiz',
    'Пульт по вашим полномочиям. Их даёт владелец.': 'Panel vakolatlaringiz böyiça. Ularni egasi beradi.',
    'График службы': 'Bölim jadvali',
    'Составить, изменить и опубликовать график': 'Jadvalni tuziş, özgartiriş va eʼlon qiliş',
    'Охват: всё заведение': 'Qamrov: butun muassasa',
    'Охват: своя служба': 'Qamrov: öz bölimi',
    /* направления */
    'Карта сотрудников': 'Xodimlar xaritasi',
    'Смотреть, где отмечались люди': 'Odamlar qayerda belgilanganini köriş',
    'График': 'Jadval',
    'Составлять, менять и публиковать график': 'Jadvalni tuziş, özgartiriş va eʼlon qiliş',
    'Приход и уход': 'Keliş va ketiş',
    'Смотреть отметки, решать «вне зоны» и «забыл отметиться», принимать объяснительные': 'Belgilarni köriş, «hududdan taşqari» va «belgilaşni unutdi»ni hal qiliş, tuşuntiriş xatlarini qabul qiliş',
    'Задачи': 'Vazifalar',
    'Ставить задачи другим, принимать и возвращать, фото-отчёты': 'Boşqalarga vazifa beriş, qabul qiliş va qaytariş, foto-hisobotlar',
    'Отпуска и отгулы': 'Taʼtil va dam oliş kunlari',
    'Решать отпуска, отгулы, «Отпроситься» и обмены сменами': 'Taʼtil, dam oliş kuni, «Ruxsat söraş» va smena almaşişni hal qiliş',
    'Команда': 'Jamoa',
    'Приглашать, менять данные, переводить и увольнять сотрудников': 'Xodimlarni taklif qiliş, maʼlumotlarini özgartiriş, ötkaziş va işdan böşatiş',
    'Заработок и расчётные листы': 'Daromad va hisob varaqalari',
    'Смотреть и править заработок и расчётные листы': 'Daromad va hisob varaqalarini köriş va tuzatiş',
    'Штрафы, премии, аванс': 'Jarimalar, mukofotlar, avans',
    'Ставить штрафы и премии, решать аванс': 'Jarima va mukofot beriş, avansni hal qiliş',
    'Заявки': 'Arizalar',
    'Ремонт — назначать, находки — выдавать, закупки — одобрять': 'Taʼmir — tayinlaş, topilmalar — beriş, xaridlar — maʼqullaş',
    'Объявления': 'Eʼlonlar',
    'Писать объявления': 'Eʼlon yoziş',
    'Рейтинг и награды': 'Reyting va mukofotlar',
    'Номинации, споры по баллам, «Допуск к работе» — засчитывать навыки': 'Nominatsiyalar, ballar böyiça bahslar, «Işga ruxsat» — könikmalarni qabul qiliş',
    'Отчёты и итоги дня': 'Hisobotlar va kun yakunlari',
    'Смотреть отчёты и сводку дня': 'Hisobotlar va kun xulosasini köriş',
    'Настройки заведения': 'Muassasa sozlamalari',
    'Настройки отметки и приложения (только всё заведение)': 'Belgilaş va ilova sozlamalari (faqat butun muassasa)',
    /* ошибки сервера */
    'Себе полномочия не дают': 'Özingizga vakolat berilmaydi',
    'Владелец и так может всё': 'Egasi baribir hammasini qila oladi',
    'Неизвестное полномочие': 'Nomaʼlum vakolat',
    'Охват — «Своя служба» или «Всё заведение»': 'Qamrov — «Öz bölimi» yoki «Butun muassasa»',
    'Настройки заведения — только «Всё заведение»': 'Muassasa sozlamalari — faqat «Butun muassasa»',
    'Полномочия видит владелец': 'Vakolatlarni egasi köradi',
    'Нужно полномочие на всё заведение': 'Butun muassasaga vakolat kerak',
    'Приглашать можно только сотрудников': 'Faqat xodimlarni taklif qiliş mumkin',
    'Начальник — человек из вашей службы': 'Boşliq — bölimingizdagi odam',
    'Роль меняет владелец': 'Rolni egasi özgartiradi',
    'Перевести можно только в вашу службу': 'Faqat öz bölimingizga ötkaziş mumkin',
    'Руководителя и бухгалтера переводит владелец': 'Rahbar va buxgalterni egasi ötkazadi',
    'Уволить можно сотрудника из вашего охвата; руководителя — владелец': 'Faqat qamrovingizdagi xodimni böşatiş mumkin; rahbarni — egasi',
    'Расчёт этого сотрудника вам не доступен': 'Bu xodimning hisobi sizga oçiq emas',
    'Потолки премий, аванса и видимость заработка меняет владелец': 'Mukofot va avans çegaralarini, daromad körinişini egasi özgartiradi'
  };
  /* заголовки и тексты уведомлений сервера: «Вам открыт доступ: …», «Доступ закрыт: …», «Владелец закрыл полномочие «…»» */
  var P = [['Карта сотрудников', 'Xodimlar xaritasi'], ['График', 'Jadval'], ['Приход и уход', 'Keliş va ketiş'], ['Задачи', 'Vazifalar'],
    ['Отпуска, отгулы и обмены сменами', 'Taʼtil, dam oliş kunlari va smena almaşiş'], ['Отпуска и отгулы', 'Taʼtil va dam oliş kunlari'], ['Команда', 'Jamoa'],
    ['Заработок и расчётные листы', 'Daromad va hisob varaqalari'], ['Штрафы, премии, аванс', 'Jarimalar, mukofotlar, avans'], ['Заявки', 'Arizalar'],
    ['Объявления', 'Eʼlonlar'], ['Рейтинг, награды и допуск к работе', 'Reyting, mukofotlar va işga ruxsat'], ['Рейтинг и награды', 'Reyting va mukofotlar'],
    ['Отчёты и итоги дня', 'Hisobotlar va kun yakunlari'], ['Настройки заведения', 'Muassasa sozlamalari']];
  P.forEach(function (p) {
    T['Вам открыт доступ: ' + p[0]] = 'Sizga ruxsat oçildi: ' + p[1];
    T['Доступ закрыт: ' + p[0]] = 'Ruxsat yopildi: ' + p[1];
    T['Владелец закрыл полномочие «' + p[0] + '»'] = 'Egasi «' + p[1] + '» vakolatini yopdi';
  });
  Object.assign(window.MLX_UZ_EXTRA = window.MLX_UZ_EXTRA || {}, T);
})();
