/* ============================================================================
 * content-integrals.js — Раздел В: Интеграли (неопределени и определени)
 * ----------------------------------------------------------------------------
 * Водеща идея: интегрирането е обратното на диференцирането (примитивна), а
 * определеният интеграл е натрупване — лице под графиката. Двете се свързват
 * от формулата на Нютон–Лайбниц и основната теорема.
 *
 * Редът в страницата: тук са помощните чертежи и мета-данните на раздела;
 * подтемите са в content-integrals-1…4.js и се добавят в SECTION_INTEGRALS.subtopics
 * по реда на зареждане. Решенията „на дъската“ са в content-boards-integrals.js.
 * ========================================================================== */

/* ---------------------------------------------------------------- помощни */

/* Числено интегриране (правило на Симпсън) — само за показаните в чертежите стойности. */
function intSimpson(f, a, b, n) {
  n = n || 600;
  if (n % 2) n++;
  var h = (b - a) / n, s = f(a) + f(b);
  for (var i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return s * h / 3;
}
/* число с десетична запетая и „−“ за минус */
function intNum(v, d) {
  var s = Number(v).toFixed(d === undefined ? 3 : d);
  if (parseFloat(s) === 0) s = s.replace('-', '');
  return s.replace('.', ',').replace('-', '−');
}
function intRgba(hex, a) {
  var n = parseInt(String(hex).slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}
function intVal(v, params) { return typeof v === 'string' ? Expr.evalAt(v, params) : v; }

/* Контур на областта между y = g(x) (по подразбиране оста Ox) и y = f(x) за x от a до b. */
function intRegion(ctx, P, f, a, b, g) {
  var N = Math.max(80, Math.round(Math.abs(P.X(b) - P.X(a)) / 2));
  var i, x;
  ctx.beginPath();
  ctx.moveTo(P.X(a), P.Y(g ? g(a) : 0));
  for (i = 0; i <= N; i++) { x = a + (b - a) * i / N; ctx.lineTo(P.X(x), P.Y(f(x))); }
  for (i = N; i >= 0; i--) { x = a + (b - a) * i / N; ctx.lineTo(P.X(x), P.Y(g ? g(x) : 0)); }
  ctx.closePath();
}

/* вертикалните граници a и b като пунктир с означение */
function intBounds(c, a, b, la, lb) {
  var ctx = c.ctx, P = c.P, bx = P.box;
  ctx.save();
  ctx.strokeStyle = 'rgba(47,54,64,.55)'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]);
  [a, b].forEach(function (x) {
    if (x < P.xmin || x > P.xmax) return;
    ctx.beginPath(); ctx.moveTo(P.X(x), bx.y); ctx.lineTo(P.X(x), bx.y + bx.h); ctx.stroke();
  });
  ctx.restore();
  if (la && a >= P.xmin && a <= P.xmax) c.plot.tag(P.X(a) + 4, bx.y + bx.h - 10, la, '#2f3640');
  if (lb && b >= P.xmin && b <= P.xmax) c.plot.tag(P.X(b) + 4, bx.y + bx.h - 10, lb, '#2f3640');
}

/* Защриховка на лицето между кривата и Ox за x от a до b. Лице над оста — синьо,
   под оста — оранжево. a и b са числа или изрази с параметри ('b', 'a + 1').
   o: { alpha, bounds: [ 'a', 'b' ] надписи, readout: false | function(info) → [html] } */
function intShadeUnder(expr, from, to, o) {
  o = o || {};
  var f = Expr.toFunction(expr);
  return function (c) {
    var ctx = c.ctx, P = c.P, bx = P.box;
    var a = intVal(from, c.params), b = intVal(to, c.params);
    if (!isFinite(a) || !isFinite(b)) return;
    var lo = Math.min(a, b), hi = Math.max(a, b);
    var y0 = Math.max(bx.y, Math.min(bx.y + bx.h, P.Y(0)));
    ctx.save();
    ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.w, bx.h); ctx.clip();
    [1, -1].forEach(function (sign) {
      ctx.save();
      ctx.beginPath();
      if (sign > 0) ctx.rect(bx.x, bx.y, bx.w, y0 - bx.y); else ctx.rect(bx.x, y0, bx.w, bx.y + bx.h - y0);
      ctx.clip();
      ctx.fillStyle = intRgba(c.col(sign > 0 ? (o.color || 'blue') : (o.negColor || 'orange')), o.alpha || .24);
      intRegion(ctx, P, function (x) { return f(x, c.params); }, lo, hi);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
    if (o.bounds) intBounds(c, lo, hi, o.bounds[0], o.bounds[1]);
    if (o.readout === false) return;
    var g = function (x) { return f(x, c.params); };
    var total = intSimpson(g, a, b);
    var pos = intSimpson(function (x) { return Math.max(g(x), 0); }, lo, hi);
    var neg = intSimpson(function (x) { return Math.min(g(x), 0); }, lo, hi);
    var info = { a: a, b: b, total: total, pos: pos, neg: neg, params: c.params };
    var lines = typeof o.readout === 'function' ? o.readout(info) :
      (neg < -1e-9 && pos > 1e-9 ?
        ['лице над оста <b>' + intNum(pos, 3) + '</b>', 'лице под оста <b>' + intNum(-neg, 3) + '</b>', 'интеграл <b>' + intNum(total, 3) + '</b>'] :
        ['интеграл <b>' + intNum(total, 3) + '</b>']);
    lines.forEach(function (t) { c.plot.readoutLines.push(t); });
  };
}

/* Лице между две криви: горната f и долната g (изрази), за x от a до b. */
function intShadeBetween(topExpr, botExpr, from, to, o) {
  o = o || {};
  var f = Expr.toFunction(topExpr), g = Expr.toFunction(botExpr);
  return function (c) {
    var ctx = c.ctx, P = c.P, bx = P.box;
    var a = intVal(from, c.params), b = intVal(to, c.params);
    if (!isFinite(a) || !isFinite(b) || a >= b) return;
    var F = function (x) { return f(x, c.params); }, G = function (x) { return g(x, c.params); };
    ctx.save();
    ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.w, bx.h); ctx.clip();
    ctx.fillStyle = intRgba(c.col(o.color || 'purple'), o.alpha || .22);
    intRegion(ctx, P, F, a, b, G);
    ctx.fill();
    ctx.restore();
    if (o.bounds) intBounds(c, a, b, o.bounds[0], o.bounds[1]);
    if (o.readout === false) return;
    var area = intSimpson(function (x) { return F(x) - G(x); }, a, b);
    var lines = typeof o.readout === 'function' ? o.readout({ a: a, b: b, area: area, params: c.params }) :
      ['лице <b>' + intNum(area, 3) + '</b>'];
    lines.forEach(function (t) { c.plot.readoutLines.push(t); });
  };
}

/* Суми на Риман: n правоъгълника върху [a; b]; mode: 'left' | 'mid' | 'right'.
   Броят n идва от параметър на чертежа (име в nParam) или от state.n. */
function intRiemann(expr, a, b, mode, nParam) {
  var f = Expr.toFunction(expr);
  return function (c) {
    var ctx = c.ctx, P = c.P, bx = P.box;
    var n = Math.max(1, Math.round(c.params[nParam || 'n']));
    var dx = (b - a) / n, sum = 0, i;
    ctx.save();
    ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.w, bx.h); ctx.clip();
    ctx.lineWidth = n > 40 ? .6 : 1.2;
    var fillC = intRgba(c.col('blue'), .22), lineC = intRgba(c.col('blue'), n > 80 ? .35 : .85);
    for (i = 0; i < n; i++) {
      var xl = a + i * dx;
      var xs = mode === 'right' ? xl + dx : mode === 'mid' ? xl + dx / 2 : xl;
      var h = f(xs, c.params);
      sum += h * dx;
      var x1 = P.X(xl), x2 = P.X(xl + dx), y1 = P.Y(0), y2 = P.Y(h);
      ctx.fillStyle = fillC; ctx.fillRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1));
      ctx.strokeStyle = lineC; ctx.strokeRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1));
    }
    ctx.restore();
    var exact = intSimpson(function (x) { return f(x, c.params); }, a, b, 2000);
    c.plot.readoutLines.push('<b>n = ' + n + '</b> правоъгълника, <b>Δx = ' + intNum(dx, 3) + '</b>');
    c.plot.readoutLines.push('сума <b>Sₙ = ' + intNum(sum, 4) + '</b>');
    c.plot.readoutLines.push('точно лице <b>' + intNum(exact, 4) + '</b> (грешка ' + intNum(Math.abs(sum - exact), 4) + ')');
  };
}

/* Функция на горна граница: горе f със защриховано лице от a до влачената точка x,
   долу F(x) = ∫_a^x f. FExpr е примитивната, нормирана така, че F(a) = 0.
   Допирателна не се рисува (tangent.hidden), а само се влачи точката. */
function intAccumulation(fExpr, FExpr, a, win, labels, x0) {
  var f = Expr.toFunction(fExpr), F = Expr.toFunction(FExpr);
  function xAt(c) {
    var x = c.params.__tx !== undefined ? c.params.__tx : x0;
    return Math.max(a, Math.min(c.P.xmax, x));
  }
  return {
    panelHeight: 190,
    tangent: { curve: 0, draggable: true, hidden: true, x: x0 },
    panels: [
      {
        xmin: win[0], xmax: win[1], ymin: win[2], ymax: win[3], ylabel: 'y', xlabel: 't', tangent: null,
        curves: [{ expr: fExpr, color: 'blue', label: labels[0] }],
        custom: function (c) {
          var x = xAt(c);
          intShadeUnder(fExpr, a, x, { readout: false })(c);
          intBounds(c, a, x);
          c.plot.drawPoint(c.P, { x: x, y: f(x), color: 'orange', guides: false });
        }
      },
      {
        xmin: win[0], xmax: win[1], ymin: win[4], ymax: win[5], ylabel: 'y', xlabel: 'x', tangent: null,
        curves: [{ expr: FExpr, color: 'pink', label: labels[1] }],
        hlines: [{ y: 0, color: 'gray' }],
        custom: function (c) {
          var x = xAt(c), v = F(x);
          c.plot.drawPoint(c.P, { x: x, y: v, color: 'orange', guides: true });
          c.plot.readoutLines.push('<b>x = ' + intNum(x, 2) + '</b>');
          c.plot.readoutLines.push('<b>F(x) = ' + intNum(v, 3) + '</b> — лицето от ' + intNum(a, 0) + ' до x');
          c.plot.readoutLines.push('височината на горната графика <b>f(x) = ' + intNum(f(x), 3) + '</b> е наклонът на долната');
        }
      }
    ],
    alt: 'Горе графиката на f със защриховано лице до избраната точка, долу графиката на функцията на горната граница F.'
  };
}

/* Тяло от въртене около Ox: n тънки диска (елипси в перспектива) върху [a; b]. */
function intDiscs(expr, a, b, nParam) {
  var f = Expr.toFunction(expr);
  return function (c) {
    var ctx = c.ctx, P = c.P, bx = P.box;
    var n = Math.max(1, Math.round(c.params[nParam || 'n']));
    var dx = (b - a) / n, vol = 0, i;
    ctx.save();
    ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.w, bx.h); ctx.clip();
    for (i = 0; i < n; i++) {
      var xm = a + (i + .5) * dx, r = Math.abs(f(xm, c.params));
      vol += Math.PI * r * r * dx;
      var ry = Math.abs(P.Y(0) - P.Y(r)), rx = Math.max(2, Math.min(ry * .3, P.X(a + dx) - P.X(a)));
      ctx.beginPath();
      ctx.ellipse(P.X(xm), P.Y(0), rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = intRgba(c.col('blue'), n > 25 ? .12 : .17); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = intRgba(c.col('blue'), n > 25 ? .45 : .8); ctx.stroke();
    }
    ctx.restore();
    var exact = Math.PI * intSimpson(function (x) { var y = f(x, c.params); return y * y; }, a, b, 2000);
    c.plot.readoutLines.push('<b>n = ' + n + '</b> диска');
    c.plot.readoutLines.push('сума на обемите <b>' + intNum(vol, 3) + '</b>');
    c.plot.readoutLines.push('точен обем <b>' + intNum(exact, 3) + '</b>');
  };
}

/* Семейство от криви с едно и също `F′` (напр. x² − 2, x², x² + 2): влачи се точка,
   а допирателните към всички криви при тази абсциса са успоредни. */
function intFamily(exprs, colors, labels, win, x0) {
  var fs = exprs.map(function (e) { return Expr.toFunction(e); });
  return {
    xmin: win[0], xmax: win[1], ymin: win[2], ymax: win[3], height: win[4] || 290,
    tangent: { curve: 0, draggable: true, hidden: true, x: x0 },
    curves: exprs.map(function (e, i) { return { expr: e, color: colors[i], label: labels[i] }; }),
    custom: function (c) {
      var ctx = c.ctx, P = c.P, bx = P.box;
      var x = c.params.__tx !== undefined ? c.params.__tx : x0;
      x = Math.max(P.xmin, Math.min(P.xmax, x));
      var d = (P.xmax - P.xmin) * .09;
      ctx.save();
      ctx.beginPath(); ctx.rect(bx.x, bx.y, bx.w, bx.h); ctx.clip();
      ctx.strokeStyle = '#e8590c'; ctx.lineWidth = 2;
      fs.forEach(function (f) {
        var y = f(x, c.params), m = Expr.derivative(f, x, c.params);
        ctx.beginPath(); ctx.moveTo(P.X(x - d), P.Y(y - m * d)); ctx.lineTo(P.X(x + d), P.Y(y + m * d)); ctx.stroke();
      });
      ctx.restore();
      fs.forEach(function (f) { c.plot.drawPoint(P, { x: x, y: f(x, c.params), color: 'orange' }); });
      c.plot.readoutLines.push('<b>x = ' + intNum(x, 2) + '</b>');
      c.plot.readoutLines.push('наклонът на всяка от кривите е <b>' + intNum(Expr.derivative(fs[0], x, c.params), 2) + '</b> — един и същ');
    },
    alt: 'Няколко криви, получени една от друга чрез вертикално преместване, с успоредни допирателни при една и съща абсциса.'
  };
}

/* Двупанелен чертеж „примитивна горе, функция долу“ с влачена допирателна
   (това е fAndDerivativePlot от content-derivatives.js — F е „f“, а f е „f′“). */
function intPair(F, f, FLabel, fLabel, win, x0) {
  return fAndDerivativePlot(F, f, FLabel, fLabel, win, x0);
}

/* ------------------------------------------------------------ данни на раздела */

window.SECTION_INTEGRALS = {
  id: 'integrals',
  topic: 'Интегрално смятане',
  title: 'Интеграли — неопределени и определени',
  short: 'Интеграли',
  lead: 'Примитивна функция и неопределен интеграл, методи за интегриране, определен интеграл и приложения.',
  description: 'Разделът надгражда производните: интегрирането е обратното на диференцирането, а определеният интеграл измерва натрупване — лице под графиката. Най-важна е връзката между двете.',

  /* ------------------------------------------------------- входящ тест */
  diagnostic: {
    intro: 'Три въпроса, около 3 минути. Не се притеснявайте, ако не сте учили интеграли — тестът само предлага откъде да започнете.',
    questions: [
      {
        type: 'mc',
        q: 'Функцията `F` е примитивна функция на `f`. Каква е връзката между тях?',
        options: [
          '`F′(x) = f(x)`',
          '`f′(x) = F(x)`',
          '`F(x) = f(x) + C`',
          '`F(x) * f(x) = 1`'
        ],
        correct: 0,
        why: [
          'Точно така — примитивната е функция, чиято производна е дадената функция.',
          'Обратното: производната на примитивната функция `F` е `f`, а не обратното.',
          'Това би означавало, че двете функции се различават само с константа. Връзката е през производната: `F′ = f`.',
          'Произведението няма отношение към примитивната.'
        ],
        solution: 'Примитивната `F` на `f` е такава функция, че `F′(x) = f(x)`. Интегрирането е обратната операция на диференцирането.'
      },
      {
        type: 'mc',
        q: 'Колко е `int 2x dx`?',
        options: ['`x^2 + C`', '`2x^2 + C`', '`2 + C`', '`x + C`'],
        correct: 0,
        why: [
          'Вярно — `(x^2)′ = 2x`, а константата `C` остава неопределена.',
          'Производната на `2x^2` е `4x`, не `2x`.',
          'Производната на `2` е нула.',
          'Производната на `x` е `1`, не `2x`.'
        ],
        solution: 'Търсим функция с производна `2x`. Това е `x^2`, а към нея винаги се добавя константа: `int 2x dx = x^2 + C`.'
      },
      {
        type: 'mc',
        q: 'Какво показва определеният интеграл `int_a^b f(x) dx`, когато `f(x) >= 0` на `[a; b]`?',
        options: [
          'Лицето на фигурата под графиката, между `x = a` и `x = b`',
          'Наклона на графиката в точката `x = a`',
          'Най-голямата стойност на `f` в `[a; b]`',
          'Дължината на отсечката `[a; b]`'
        ],
        correct: 0,
        plot: {
          xmin: -0.5, xmax: 4.5, ymin: -0.5, ymax: 5, height: 250,
          curves: [{ expr: '0.25*x^2+1', color: 'blue', label: '`y = f(x)`' }],
          custom: intShadeUnder('0.25*x^2+1', 1, 3, { bounds: ['a', 'b'], readout: false })
        },
        why: [
          'Верният отговор — определеният интеграл е лицето под графиката (за неотрицателна функция).',
          'Наклонът на графиката е производната, не интегралът.',
          'Най-голямата стойност се намира с производната.',
          'Дължината на отсечката е просто `b - a`.'
        ],
        solution: 'За неотрицателна функция `int_a^b f(x) dx` е лицето на фигурата, заградена от графиката, оста `Ox` и правите `x = a` и `x = b`.'
      }
    ]
  },

  subtopics: []
};
