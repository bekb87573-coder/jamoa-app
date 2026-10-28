/* front-desk (круг 03): учебные телефоны для «Позвонить» в карточке сотрудника.
   Формат +998 00 000 00 NN — код оператора 00 не существует, реальным номером быть не может. */
(function () {
  var DB = window.__DB; if (!DB || !DB.employees) return;
  var ids = ['e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e34'];
  DB.employees.forEach(function (e) {
    var i = ids.indexOf(e.id);
    if (i >= 0 && !e.phone) { var n = String(+e.id.slice(1)); e.phone = '+998 00 000 00 ' + (n.length < 2 ? '0' + n : n); }
  });
})();
