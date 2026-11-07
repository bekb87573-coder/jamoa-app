/* 92zl-legal «Документы и согласия» — узбекский (латиница). Свой словарь window.DLG_UZ (переводит dlg_t на экране согласия,
   в галочке регистрации, в «Профиле» и на входе), чтобы короткие куски предложения («и», «Я принимаю») не перебивали переводы
   во всём приложении. Кириллица — автоматически (MLX_CYR.lat). В общий MLX_UZ_EXTRA — только длинные строки. */
(function () {
  var D = {
    'Без согласия работать в приложении нельзя': 'Roziliksiz ilovada işlaş mumkin emas',
    'Вернуться к согласию': 'Rozilikka qaytiş',
    'Версия': 'Versiya',
    'версия': 'versiya',
    'Выйти': 'Çiqiş',
    'Документы': 'Hujjatlar',
    'Ещё не принимал(а)': 'Hali qabul qilmagan',
    'Закрыть': 'Yopiş',
    'Есть': 'Bor',
    'Нет': 'Yöq',
    'Нажатие «Принимаю» записывается с датой и временем и равнозначно вашей подписи.': '«Qabul qilaman» tugmasini bosiş sana va vaqt bilan yoziladi va imzoingizga teng.',
    'Не принимаю': 'Qabul qilmayman',
    'Принимаю': 'Qabul qilaman',
    'Отметьте согласие с документами': 'Hujjatlarga roziligingizni belgilang',
    'Политика конфиденциальности': 'Maxfiylik siyosati',
    'Политику конфиденциальности': 'Maxfiylik siyosatini',
    'Полный текст согласия': 'Rozilikning töliq matni',
    'Пользовательское соглашение': 'Foydalanuvçi kelişuvi',
    'Прежде чем продолжить, примите документы Jamoa. Главное — коротко:': 'Davom etişdan oldin Jamoa hujjatlarini qabul qiling. Asosiysi — qisqaça:',
    'Приняли': 'Qabul qilganlar',
    'Принято': 'Qabul qilingan',
    'Работодатель': 'Iş beruvçi',
    'Согласие на обработку данных': 'Maʼlumotlarni qayta işlaşga rozilik',
    'Согласие сотрудник даёт сам при первом входе. Кто ещё не входил — увидит экран согласия при входе. Получить согласие — обязанность заведения как работодателя.':
      'Xodim roziligini birinçi kirişda özi beradi. Hali kirmaganlar kirişda rozilik ekranini köradi. Rozilik oliş — iş beruvçi sifatida muassasaning majburiyati.',
    'Согласие сотрудника': 'Xodim roziligi',
    'Согласия сотрудников': 'Xodimlar roziligi',
    'Соглашение и конфиденциальность': 'Kelişuv va maxfiylik',
    'Спасибо, согласие сохранено': 'Rahmat, rozilik saqlandi',
    'Я принимаю': 'Men',
    'и': 'va',
    'и подтверждаю, что получу согласия сотрудников': 'qabul qilaman hamda xodimlarning roziligini olişimni tasdiqlayman',
    'ведёт учёт работы в Jamoa. Вот что это значит для ваших данных:': 'Jamoa’da iş hisobini yuritadi. Bu maʼlumotlaringiz uçun nimani anglatadi:',
    'Вы приняли документы': 'Siz hujjatlarni qabul qilgansiz',
    'Вы дали согласие': 'Siz rozilik bergansiz',
    'Jamoa можно пользоваться только после принятия Пользовательского соглашения и Политики конфиденциальности. Если вы не согласны, не пользуйтесь приложением: вы можете закрыть заведение в настройках или написать команде Jamoa через «Помощь».':
      'Jamoa’dan faqat Foydalanuvçi kelişuvi va Maxfiylik siyosatini qabul qilgandan keyin foydalaniş mumkin. Agar rozi bölmasangiz, ilovadan foydalanmang: sozlamalarda muassasani yopişingiz yoki «Yordam» orqali Jamoa jamoasiga yozişingiz mumkin.',
    'Jamoa хранит данные о вашей работе по поручению работодателя. Без вашего согласия вход в приложение невозможен. Если у вас есть вопросы или вы не согласны — обратитесь к работодателю: руководителю или владельцу заведения.':
      'Jamoa işingiz haqidagi maʼlumotlarni iş beruvçi topşiriği böyiça saqlaydi. Roziligingizsiz ilovaga kiriş mumkin emas. Savollaringiz bölsa yoki rozi bölmasangiz — iş beruvçiga: rahbar yoki muassasa egasiga murojaat qiling.',
    /* владелец */
    'Вы отвечаете за данные сотрудников': 'Xodimlar maʼlumotlari uçun siz javob berasiz',
    'Заведение — оператор персональных данных своих сотрудников: получите их согласие и ознакомьте с Политикой. Jamoa обрабатывает данные по вашему поручению.':
      'Muassasa — öz xodimlari şaxsga doir maʼlumotlarining operatori: ularning roziligini oling va Siyosat bilan taniştiring. Jamoa maʼlumotlarni sizning topşiriğingiz böyiça qayta işlaydi.',
    'Решения — за заведением': 'Qarorlar — muassasa zimmasida',
    'Расчёты, штрафы, премии и увольнения по данным приложения — ответственность заведения. Jamoa — инструмент учёта «как есть».':
      'Ilova maʼlumotlari böyiça hisob-kitoblar, jarimalar, mukofotlar va işdan böşatiş — muassasa javobgarligi. Jamoa — «boriça» hisob vositasi.',
    'Место и фото — только при действии': 'Joylaşuv va surat — faqat harakat vaqtida',
    'Место определяется в момент отметки, задачи, передачи смены или заявки; фото — только к задачам. Биометрии нет.':
      'Joylaşuv belgi, vazifa, smenani topşiriş yoki ariza paytida aniqlanadi; surat — faqat vazifalarga. Biometriya yöq.',
    'ИИ-помощник и хранение': 'SI yordamçisi va saqlaş',
    'Тексты команд помощнику обрабатывает поставщик ИИ (Anthropic, США); данные хранятся в облаке, в том числе за рубежом. Данные не продаются.':
      'Yordamçiga buyruqlar matnini SI provayderi (Anthropic, AQŞ) qayta işlaydi; maʼlumotlar bulutda, şu jumladan çet elda saqlanadi. Maʼlumotlar sotilmaydi.',
    'Сейчас бесплатно': 'Hozirça bepul',
    'О введении платы предупредим за 30 дней.': 'Tölov joriy etilişi haqida 30 kun oldin ogohlantiramiz.',
    /* сотрудник */
    'Данные о работе': 'Iş haqidagi maʼlumotlar',
    'Имя, должность, график, отметки, задачи, заработок и заявки — для учёта работы у вашего работодателя.':
      'Ism, lavozim, jadval, belgilar, vazifalar, iş haqi va arizalar — iş beruvçingizda iş hisobini yuritiş uçun.',
    'Место — только в момент действия': 'Joylaşuv — faqat harakat vaqtida',
    'Когда вы сами нажимаете «Пришёл», «Ушёл», отмечаете задачу, передаёте смену или отправляете заявку. Постоянного слежения нет.':
      'Siz özingiz «Keldim», «Ketdim» tugmasini bosganingizda, vazifani belgilaganingizda, smenani topşirganingizda yoki ariza yuborganingizda. Doimiy kuzatuv yöq.',
    'Фото — только к задачам и отчётам': 'Surat — faqat vazifa va hisobotlarga',
    'Фото вы делаете сами как подтверждение работы. Распознавания лица и биометрии нет.': 'Suratni iş tasdiği sifatida özingiz olasiz. Yuzni tanib oliş va biometriya yöq.',
    'Где хранятся данные': 'Maʼlumotlar qayerda saqlanadi',
    'На защищённых серверах, в том числе за рубежом. Данные не продаются и не используются для рекламы.': 'Himoyalangan serverlarda, şu jumladan çet elda. Maʼlumotlar sotilmaydi va reklama uçun işlatilmaydi.',
    'Ваши права': 'Huquqlaringiz',
    'Узнать, исправить, удалить данные и отозвать согласие — через работодателя или Jamoa.': 'Maʼlumotlarni biliş, tuzatiş, öçiriş va rozilikni qaytarib oliş — iş beruvçi yoki Jamoa orqali.'
  };
  window.DLG_UZ = Object.assign(window.DLG_UZ || {}, D);
  var X = {};
  Object.keys(D).forEach(function (k) { if (k.length >= 24) X[k] = D[k]; });
  X['Политика конфиденциальности'] = D['Политика конфиденциальности']; X['Пользовательское соглашение'] = D['Пользовательское соглашение'];
  Object.assign(window.MLX_UZ_EXTRA = window.MLX_UZ_EXTRA || {}, X);
})();
