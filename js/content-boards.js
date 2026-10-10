/* ============================================================================
 * content-boards.js — решенията за „Маркерна дъска“ (виж js/board.js)
 * ----------------------------------------------------------------------------
 * Всяка дъска: { title, steps: [{ line, formula?, note?, boxed? }], link?, hidden? }
 * Дъските се показват в картата „Разработен пример“ (worked.boards) и след
 * опит в „Практика“ (поле board на задачата). Не и в „Самопроверка“.
 *
 * Пиши ги като текст и ги превърни с tools/board-convert.html:
 *     ред  @@ формула  // бележка        !ограден отговор
 * Формулите (зелената колона) са точно низовете от банката в tools/board-lib.js.
 * ========================================================================== */
window.BOARDS = {

  /* ------------------------------------------------- Тема 11 */
  fn_domain: {
    title: 'Дефиниционна област',
    steps: [
      { line: 'f(x) = sqrt(x - 2) / (x - 5)', note: 'Намери дефиниционната област' },
      { line: 'под корена: x >= 2', note: 'Квадратен корен се дефинира само за неотрицателни числа' },
      { line: 'в знаменателя: x - 5 != 0', note: 'На нула не се дели' },
      { line: 'x != 5' },
      { line: 'D = [2; 5) ∪ (5; +∞)', boxed: true }
    ]
  },

  fn_composite: {
    title: 'Съставна функция',
    steps: [
      { line: 'f(x) = 2x + 1,   g(x) = x^2', note: 'Намери f(g(x)) и g(f(x))' },
      { line: 'f(g(x)) = f(x^2) = 2x^2 + 1', formula: '(f ∘ g)(x) = f(g(x))', note: 'Слагаме g(x) на мястото на x във f' },
      { line: 'g(f(x)) = g(2x + 1) = (2x + 1)^2 = 4x^2 + 4x + 1' },
      { line: 'f(g(x)) ≠ g(f(x))', note: 'Редът на съставяне има значение', boxed: true }
    ]
  },

  fn_inverse: {
    title: 'Обратна функция',
    steps: [
      { line: 'f(x) = 2x + 3', note: 'Намери обратната функция f^(-1)(x)' },
      { line: 'y = 2x + 3', note: 'Записваме f(x) като y' },
      { line: 'x = (y - 3) / 2', formula: 'y = f(x)  ⇔  x = f^(-1)(y)', note: 'Решаваме относно x' },
      { line: 'f^(-1)(y) = (y - 3) / 2', note: 'Разменяме x и y, за да запишем функцията по обичайния начин' },
      { line: 'f^(-1)(x) = (x - 3) / 2', boxed: true },
      { line: 'проверка: f(f^(-1)(x)) = 2 · (x - 3) / 2 + 3 = x', formula: 'f(f^(-1)(x)) = x' }
    ]
  },

  lim_00: {
    title: 'Граница от вида 0/0',
    steps: [
      { line: 'lim (x→2) (x^2 - 4) / (x - 2)', note: 'Заместването дава 0/0' },
      { line: 'x^2 - 4 = (x - 2)(x + 2)', formula: 'a^2 - b^2 = (a - b)(a + b)', note: 'Разлагаме числителя' },
      { line: '(x - 2)(x + 2) / (x - 2) = x + 2', note: 'Съкращаваме, защото x ≠ 2' },
      { line: 'x + 2 → 4 при x → 2' },
      { line: 'lim = 4', boxed: true }
    ]
  },

  lim_inf: {
    title: 'Граница в безкрайност',
    steps: [
      { line: 'lim (x→∞) (3x^2 + x) / (2x^2 - 5)', note: 'Намери границата' },
      { line: 'делим числителя и знаменателя на x^2', note: 'Най-високата степен в знаменателя' },
      { line: '= lim (x→∞) (3 + 1/x) / (2 - 5/x^2)' },
      { line: '1/x → 0   и   5/x^2 → 0 при x → ∞', formula: 'lim (x→∞) 1/x^n = 0,  n > 0' },
      { line: 'lim = 3/2', boxed: true }
    ]
  },

  cont_point: {
    title: 'Непрекъснатост в точка',
    steps: [
      { line: 'f(x) = (x^2 - 1) / (x - 1) при x ≠ 1,   f(1) = a', note: 'За коя стойност на a функцията е непрекъсната в x = 1?' },
      { line: 'изискваме lim (x→1) f(x) = f(1)', formula: 'f е непрекъсната в x0  ⇔  lim (x→x0) f(x) = f(x0)' },
      { line: 'lim (x→1) (x^2 - 1) / (x - 1) = lim (x→1) (x - 1)(x + 1) / (x - 1)', formula: 'a^2 - b^2 = (a - b)(a + b)' },
      { line: '= lim (x→1) (x + 1) = 2', note: 'Съкращаваме, защото x ≠ 1' },
      { line: 'a = 2', boxed: true }
    ]
  },

  /* ------------------------------------------------- Тема 12 */
  d_sum: {
    title: 'Сбор и степен',
    steps: [
      { line: 'f(x) = 4x^3 - 5x^2 + 7x - 2', note: "Намери f'(x)" },
      { line: "f'(x) = (4x^3)' - (5x^2)' + (7x)' - (2)'", formula: "(u ± v)' = u' ± v'", note: 'Производната на сбор е сбор от производните' },
      { line: "(4x^3)' = 4 · 3x^2 = 12x^2", formula: "(x^n)' = n·x^(n-1)", note: 'Константата остава, степенният показател слиза' },
      { line: "(5x^2)' = 5 · 2x = 10x", formula: "(x^n)' = n·x^(n-1)" },
      { line: "(7x)' = 7", formula: "(x)' = 1" },
      { line: "(2)' = 0", formula: "(c)' = 0", note: 'Производната на константа е нула' },
      { line: "f'(x) = 12x^2 - 10x + 7", boxed: true }
    ]
  },

  d_product_trig: {
    title: 'Произведение с тригонометрична функция',
    steps: [
      { line: 'f(x) = x^2 · sin x', note: "Намери f'(x)" },
      { line: 'u = x^2,   v = sin x', note: 'Разпознаваме произведение на две функции' },
      { line: "u' = 2x,   v' = cos x", formula: "(x^n)' = n·x^(n-1),  (sin x)' = cos x" },
      { line: "f'(x) = u'v + uv'", formula: "(u · v)' = u'·v + u·v'" },
      { line: "f'(x) = 2x · sin x + x^2 · cos x", note: "Заместваме u, v, u' и v'" },
      { line: "f'(x) = 2x sin x + x^2 cos x", boxed: true }
    ]
  },

  d_product_exp: {
    title: 'Произведение с експоненциална функция',
    steps: [
      { line: 'f(x) = x · e^x', note: "Намери f'(x)" },
      { line: 'u = x,   v = e^x' },
      { line: "u' = 1,   v' = e^x", formula: "(x)' = 1,  (e^x)' = e^x" },
      { line: "f'(x) = u'v + uv' = 1 · e^x + x · e^x", formula: "(u · v)' = u'·v + u·v'" },
      { line: "f'(x) = e^x (1 + x)", note: 'Изнасяме общия множител e^x', boxed: true }
    ]
  },

  d_quotient: {
    title: 'Частно',
    steps: [
      { line: 'f(x) = (x^2 + 1) / (x - 3)', note: "Намери f'(x)" },
      { line: 'u = x^2 + 1,   v = x - 3', note: 'Числител и знаменател' },
      { line: "u' = 2x,   v' = 1", formula: "(x^n)' = n·x^(n-1)" },
      { line: "f'(x) = (u'v - uv') / v^2", formula: "(u / v)' = (u'·v - u·v') / v^2" },
      { line: "f'(x) = (2x(x - 3) - (x^2 + 1) · 1) / (x - 3)^2", note: 'Заместваме' },
      { line: "f'(x) = (2x^2 - 6x - x^2 - 1) / (x - 3)^2", note: 'Разкриваме скобите' },
      { line: "f'(x) = (x^2 - 6x - 1) / (x - 3)^2", boxed: true }
    ]
  },

  d_quotient_simplify: {
    title: 'Частно с опростяване',
    steps: [
      { line: 'f(x) = x / (x^2 + 1)', note: "Намери f'(x)" },
      { line: 'u = x,   v = x^2 + 1' },
      { line: "u' = 1,   v' = 2x", formula: "(x)' = 1,  (x^n)' = n·x^(n-1)" },
      { line: "f'(x) = (u'v - uv') / v^2", formula: "(u / v)' = (u'·v - u·v') / v^2" },
      { line: "f'(x) = (1 · (x^2 + 1) - x · 2x) / (x^2 + 1)^2", note: 'Заместваме' },
      { line: "f'(x) = (x^2 + 1 - 2x^2) / (x^2 + 1)^2", note: 'Умножаваме в числителя' },
      { line: "f'(x) = (1 - x^2) / (x^2 + 1)^2", boxed: true }
    ]
  },

  d_chain_power: {
    title: 'Верижно правило, степен',
    steps: [
      { line: 'f(x) = (3x^2 + 1)^4', note: "Намери f'(x)" },
      { line: 'външна функция: u^4,   вътрешна: u = 3x^2 + 1', note: 'Разпознаваме съставна функция' },
      { line: "f'(x) = 4(3x^2 + 1)^3 · (3x^2 + 1)'", formula: "(u^n)' = n·u^(n-1) · u'", note: 'Първо външната, после умножаваме по производната на вътрешната' },
      { line: "(3x^2 + 1)' = 6x", formula: "(x^n)' = n·x^(n-1)" },
      { line: "f'(x) = 4(3x^2 + 1)^3 · 6x" },
      { line: "f'(x) = 24x(3x^2 + 1)^3", boxed: true }
    ]
  },

  d_chain_sin: {
    title: 'Верижно правило, синус',
    steps: [
      { line: 'f(x) = sin(3x^2)', note: "Намери f'(x)" },
      { line: 'u = 3x^2', note: 'Вътрешна функция' },
      { line: "f'(x) = cos(3x^2) · (3x^2)'", formula: "(sin u)' = cos u · u'" },
      { line: "(3x^2)' = 6x", formula: "(x^n)' = n·x^(n-1)" },
      { line: "f'(x) = 6x cos(3x^2)", boxed: true }
    ]
  },

  d_chain_ln: {
    title: 'Верижно правило, логаритъм',
    steps: [
      { line: 'f(x) = ln(x^2 + 1)', note: "Намери f'(x)" },
      { line: "u = x^2 + 1,   u' = 2x", formula: "(x^n)' = n·x^(n-1)" },
      { line: "f'(x) = u' / u = 2x / (x^2 + 1)", formula: "(ln u)' = u' / u" },
      { line: "f'(x) = 2x / (x^2 + 1)", boxed: true }
    ]
  },

  d_chain_exp: {
    title: 'Верижно правило, експонента',
    steps: [
      { line: 'f(x) = e^(3x)', note: "Намери f'(x)" },
      { line: "u = 3x,   u' = 3", formula: "(x)' = 1,  (c·u)' = c·u'" },
      { line: "f'(x) = e^(3x) · 3", formula: "(e^u)' = e^u · u'" },
      { line: "f'(x) = 3e^(3x)", boxed: true }
    ]
  },

  d_tangent: {
    title: 'Допирателна',
    link: { href: '#/section/derivatives/level/1/derivative_intro', label: 'Виж картата „Връзка f → f′“' },
    steps: [
      { line: 'f(x) = x^2,   x0 = 3', note: 'Намери допирателната към графиката в точката x0' },
      { line: "f'(x) = 2x", formula: "(x^n)' = n·x^(n-1)", note: 'Производната е ъгловият коефициент' },
      { line: "f'(3) = 6", note: 'Наклонът на допирателната' },
      { line: 'f(3) = 9', note: 'Точката лежи на графиката' },
      { line: 'y - 9 = 6(x - 3)', formula: "y - y0 = f'(x0)(x - x0)" },
      { line: 'y = 6x - 9', boxed: true }
    ]
  },

  /* Скрита: f(x) = x^3 - 3x е функцията от задача 3 в секция „Тест“
     (README: „Не повтаряй теста“). Връща се с махане на hidden или с друга функция. */
  d_monotonic: {
    title: 'Монотонност и екстремуми',
    hidden: true,
    link: { href: '#/section/derivatives/level/1/derivative_intro', label: 'Виж картата „Връзка f → f′“' },
    steps: [
      { line: 'f(x) = x^3 - 3x', note: 'Намери монотонността и екстремумите' },
      { line: "f'(x) = 3x^2 - 3", formula: "(x^n)' = n·x^(n-1)", note: 'Диференцираме всеки член' },
      { line: '3x^2 - 3 = 0', formula: "екстремум ⇒ f'(x0) = 0", note: "Критичните точки са там, където f' = 0" },
      { line: 'x^2 = 1,   x = -1   или   x = 1' },
      { line: "x < -1:  f' > 0  →  f расте", formula: "f' > 0 ⇒ f расте;  f' < 0 ⇒ f намалява" },
      { line: "-1 < x < 1:  f' < 0  →  f намалява" },
      { line: "x > 1:  f' > 0  →  f расте" },
      { line: 'максимум при x = -1:  f(-1) = 2;   минимум при x = 1:  f(1) = -2', note: "f' сменя знака от + на − в −1 и от − на + в 1", boxed: true }
    ]
  }
};
