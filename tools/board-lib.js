/* ============================================================================
 * board-lib.js — авторски помощник за картите „дъска“ (не се зарежда от приложението)
 * ----------------------------------------------------------------------------
 * Текстов запис, по една стъпка на ред:
 *     ред на решението  @@ формула  // бележка
 *     !ограден краен отговор
 * JSON запис (както е в js/content-boards.js):
 *     { line, formula?, note?, boxed? }
 * Ползва се от tools/board-convert.html и tools/check-content.html.
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BoardLib = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* Формулите в зелената колона се пишат точно с тези низове, за да изглежда
     едно и също правило еднакво навсякъде. Ново правило се добавя тук първо. */
  var FORMULA_BANK = [
    "(c)' = 0",
    "(x)' = 1",
    "(x^n)' = n·x^(n-1)",
    "(c·u)' = c·u'",
    "(u ± v)' = u' ± v'",
    "(u · v)' = u'·v + u·v'",
    "(u / v)' = (u'·v - u·v') / v^2",
    "(u^n)' = n·u^(n-1) · u'",
    "(e^x)' = e^x",
    "(e^u)' = e^u · u'",
    "(ln u)' = u' / u",
    "(sin x)' = cos x",
    "(cos x)' = -sin x",
    "(sin u)' = cos u · u'",
    "y - y0 = f'(x0)(x - x0)",
    "f' > 0 ⇒ f расте;  f' < 0 ⇒ f намалява",
    "екстремум ⇒ f'(x0) = 0",
    "(f ∘ g)(x) = f(g(x))",
    "y = f(x)  ⇔  x = f^(-1)(y)",
    "f(f^(-1)(x)) = x",
    "a^2 - b^2 = (a - b)(a + b)",
    "a · b = 0  ⇒  a = 0  или  b = 0",
    "lim (x→∞) 1/x^n = 0,  n > 0",
    "f е непрекъсната в x0  ⇔  lim (x→x0) f(x) = f(x0)",
    /* Тема „Интеграли“ */
    "F' = f  ⇒  ∫ f(x) dx = F(x) + C",
    "∫ x^n dx = x^(n+1)/(n+1) + C,  n ≠ -1",
    "∫ 1/x dx = ln|x| + C",
    "∫ e^x dx = e^x + C",
    "∫ sin x dx = -cos x + C",
    "∫ cos x dx = sin x + C",
    "∫ (c·f + g) dx = c·∫ f dx + ∫ g dx",
    "∫ f(ax + b) dx = F(ax + b)/a + C",
    "d(ax + b) = a dx",
    "g'(x) dx = d(g(x))",
    "f(x) dx = d(F(x)),  F' = f",
    "∫ f(g(x)) d(g(x)) = F(g(x)) + C",
    "∫ g'(x)/g(x) dx = ln|g(x)| + C",
    "∫ u dv = u·v - ∫ v du",
    "∫ 1/(x^2 + a^2) dx = (1/a)·arctg(x/a) + C",
    "1/((x - a)(x - b)) = A/(x - a) + B/(x - b)",
    "Δx = (b - a)/n,  S_n = ∑ f(x_i)·Δx",
    "∫_a^b f(x) dx = F(b) - F(a)",
    "∫_a^b f(g(x)) d(g(x)) = F(g(b)) - F(g(a))",
    "∫_a^b u dv = (u·v)|_a^b - ∫_a^b v du",
    "(∫_a^x f(t) dt)' = f(x)",
    "(f(u))' = f'(u)·u'",
    "f нечетна  ⇒  ∫_(-a)^a f(x) dx = 0",
    "f четна  ⇒  ∫_(-a)^a f(x) dx = 2·∫_0^a f(x) dx",
    "S = ∫_a^b (f(x) - g(x)) dx,  f ≥ g",
    "V = π·∫_a^b f(x)^2 dx",
    "lim (b→∞) ∫_a^b f(x) dx = ∫_a^∞ f(x) dx"
  ];

  /* текст → стъпки */
  function parse(text) {
    var out = [];
    String(text).split(/\r?\n/).forEach(function (raw) {
      var main = raw.trim();
      if (!main) return;
      var note = '', formula = '';
      var i = main.indexOf('//');
      if (i >= 0) { note = main.slice(i + 2).trim(); main = main.slice(0, i); }
      var j = main.indexOf('@@');
      if (j >= 0) { formula = main.slice(j + 2).trim(); main = main.slice(0, j); }
      main = main.trim();
      var boxed = false;
      if (main.charAt(0) === '!') { boxed = true; main = main.slice(1).trim(); }
      if (!main) return;
      var s = { line: main };
      if (formula) s.formula = formula;
      if (note) s.note = note;
      if (boxed) s.boxed = true;
      out.push(s);
    });
    return out;
  }

  /* стъпки → текст */
  function toText(steps) {
    return steps.map(function (s) {
      return (s.boxed ? '!' : '') + s.line +
        (s.formula ? '  @@ ' + s.formula : '') +
        (s.note ? '  // ' + s.note : '');
    }).join('\n');
  }

  /* формулите от един ред се отделят със запетая, но запетая има и вътре в
     някои формули от банката — затова търсим най-дългото покритие с банката */
  function splitFormulas(f) {
    var parts = [], rest = f.trim();
    while (rest) {
      var hit = FORMULA_BANK.filter(function (b) { return rest.indexOf(b) === 0; })
        .sort(function (a, b) { return b.length - a.length; })[0];
      if (!hit) return null;
      parts.push(hit);
      rest = rest.slice(hit.length).replace(/^\s*,\s*/, '');
    }
    return parts;
  }

  /* проблеми в една дъска (празен масив = всичко е наред) */
  function validate(board, where) {
    var p = [];
    where = where || 'дъска';
    if (!board || !Array.isArray(board.steps) || !board.steps.length) return [where + ': няма стъпки'];
    board.steps.forEach(function (s, i) {
      var at = where + ' [' + (i + 1) + ']';
      if (!s.line || typeof s.line !== 'string') p.push(at + ': липсва line');
      Object.keys(s).forEach(function (k) {
        if (['line', 'formula', 'note', 'boxed'].indexOf(k) < 0) p.push(at + ': непознато поле ' + k);
      });
      if (s.formula && !splitFormulas(s.formula)) p.push(at + ': формулата не е от банката: ' + s.formula);
      [s.line, s.formula].forEach(function (t) {
        if (t && /\^\([^)]*\^/.test(t)) p.push(at + ': вложена степен: ' + t);
        if (t && /\/\/|@@/.test(t)) p.push(at + ': останали // или @@: ' + t);
      });
    });
    if (!board.steps.some(function (s) { return s.boxed; })) p.push(where + ': няма ограден отговор');
    return p;
  }

  return { FORMULA_BANK: FORMULA_BANK, parse: parse, toText: toText, splitFormulas: splitFormulas, validate: validate };
});
