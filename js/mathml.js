/* ============================================================================
 * mathml.js — типографски модул за математически формули
 * ----------------------------------------------------------------------------
 * Превръща компактен текстов запис в native MathML.
 * НЕ използва LaTeX. Резултатът се изобразява от браузъра с математически
 * шрифт (Cambria Math / STIX Two Math), т.е. изглежда като Word Equations:
 * истинска дробна черта, наклонени променливи, изправени имена на функции,
 * разтягащи се скоби и радикали.
 *
 * Синтаксис (примери):
 *   x^2 + 3x - 1          степен
 *   x_1, x_(n+1)          индекс
 *   (x^2-1)/(x-1)         дроб (скобите изчезват)
 *   sqrt(x+1), root(3)(x) корен
 *   abs(x)                модул
 *   lim(x->2) f(x)        граница с подпис
 *   f'(x), f''(x)         производни
 *   x in RR, D(f)         множества: RR NN ZZ QQ CC, uu nn, oo (безкрайност)
 *   alpha beta Delta pi   гръцки букви
 *   "текст"               текст вътре във формула
 *   piece{x^2, x>=0; -x, x<0}   функция, зададена на части
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- речник */

  var GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ',
    epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ', iota: 'ι',
    kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ',
    pi: 'π', Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ',
    phi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω'
  };

  /* имената на функциите се пишат изправено (както в Word) */
  var FUNCS = [
    'arcsin', 'arccos', 'arctan', 'arccot', 'arctg', 'arcctg', 'arccotg',
    'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan', 'cotg', 'cot', 'ctg', 'tg',
    'ln', 'lg', 'log', 'exp', 'sgn', 'max', 'min', 'sup', 'grad', 'rot'
  ];

  var CONSTS = {
    RR: 'ℝ', NN: 'ℕ', ZZ: 'ℤ', QQ: 'ℚ', CC: 'ℂ',
    oo: '∞', emptyset: '∅', deg: '°'
  };

  /* релации и логически символи, записани с думи */
  var RELWORDS = {
    'in': '∈', 'notin': '∉', 'sub': '⊂', 'sube': '⊆', 'supset': '⊃',
    'iff': '⇔', 'implies': '⇒', 'to': '→', 'mapsto': '↦', 'approx': '≈'
  };
  var ADDWORDS = { 'uu': '∪', 'nn': '∩', 'setminus': '∖' };

  var KEYWORDS = {
    sqrt: 1, root: 1, abs: 1, norm: 1, lim: 1, sum: 1, prod: 1,
    piece: 1, vec: 1, bar: 1, hat: 1, ul: 1, ol: 1, text: 1, int: 1
  };

  /* допълнително разстояние между два израза на един ред (без LaTeX \quad) */
  var SPACERS = { quad: '1em', qquad: '2em' };

  /* всички думи, подредени по дължина (най-дългата се разпознава първа) */
  var WORDS = {};
  FUNCS.forEach(function (f) { WORDS[f] = { t: 'fn', v: f }; });
  Object.keys(GREEK).forEach(function (g) { WORDS[g] = { t: 'greek', v: GREEK[g] }; });
  Object.keys(CONSTS).forEach(function (c) { WORDS[c] = { t: 'const', v: CONSTS[c] }; });
  Object.keys(RELWORDS).forEach(function (r) { WORDS[r] = { t: 'rel', v: RELWORDS[r] }; });
  Object.keys(ADDWORDS).forEach(function (a) { WORDS[a] = { t: 'addop', v: ADDWORDS[a] }; });
  Object.keys(KEYWORDS).forEach(function (k) { WORDS[k] = { t: 'kw', v: k }; });
  Object.keys(SPACERS).forEach(function (s) { WORDS[s] = { t: 'space', v: SPACERS[s] }; });
  var WORDLIST = Object.keys(WORDS).sort(function (a, b) { return b.length - a.length; });

  /* символи, също подредени по дължина */
  var SYMBOLS = [
    ['<=>', 'rel', '⇔'], ['<->', 'rel', '↔'], ['...', 'atom', '…'],
    ['->', 'rel', '→'], ['=>', 'rel', '⇒'], ['<=', 'rel', '≤'], ['>=', 'rel', '≥'],
    ['!=', 'rel', '≠'], ['~~', 'rel', '≈'], ['==', 'rel', '≡'], [':=', 'rel', '≔'],
    ['+-', 'addop', '±'], ['-+', 'addop', '∓'], ['**', 'mulop', '·'], ['//', 'mulop', '∕'],
    ['≤', 'rel', '≤'], ['≥', 'rel', '≥'], ['≠', 'rel', '≠'], ['≈', 'rel', '≈'],
    ['→', 'rel', '→'], ['∈', 'rel', '∈'], ['∉', 'rel', '∉'], ['⊂', 'rel', '⊂'],
    ['∪', 'addop', '∪'], ['∩', 'addop', '∩'], ['∞', 'const', '∞'], ['±', 'addop', '±'],
    ['·', 'mulop', '·'], ['×', 'mulop', '×'], ['÷', 'mulop', '÷'], ['−', 'addop', '−'],
    ['+', 'addop', '+'], ['-', 'addop', '−'],
    ['*', 'mulop', '·'], ['/', 'frac', '/'],
    ['=', 'rel', '='], ['<', 'rel', '<'], ['>', 'rel', '>'],
    [',', 'punct', ','], [';', 'punct', ';'], [':', 'punct', ':'],
    ['|', 'punct', '|'], ['!', 'atom', '!'], ['%', 'atom', '%'], ['°', 'atom', '°'],
    ['^', 'sup', '^'], ['_', 'sub', '_'], ["'", 'prime', '′'], ['’', 'prime', '′'],
    ['(', 'open', '('], ['[', 'open', '['], ['{', 'open', '{'],
    [')', 'close', ')'], [']', 'close', ']'], ['}', 'close', '}']
  ];

  /* ------------------------------------------------------------- лексер */

  function tokenize(src) {
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var ch = src[i];
      if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }

      /* текст в кавички */
      if (ch === '"') {
        var j = src.indexOf('"', i + 1);
        if (j < 0) j = n;
        toks.push({ t: 'text', v: src.slice(i + 1, j) });
        i = j + 1; continue;
      }

      /* число */
      if (/[0-9]/.test(ch)) {
        var m = /^[0-9]+(?:[.,][0-9]+)?/.exec(src.slice(i));
        toks.push({ t: 'num', v: m[0] });
        i += m[0].length; continue;
      }

      /* дума от речника */
      var matched = null;
      if (/[A-Za-z]/.test(ch)) {
        for (var w = 0; w < WORDLIST.length; w++) {
          var word = WORDLIST[w];
          if (src.startsWith(word, i)) {
            /* не режем по средата на по-дълга латинска дума */
            var after = src[i + word.length];
            if (after && /[A-Za-z]/.test(after) && WORDS[word].t !== 'kw') {
              /* позволено е напр. „pi x“ да се раздели, но „sinx“ -> sin·x */
            }
            matched = word; break;
          }
        }
      }
      if (matched) {
        var info = WORDS[matched];
        toks.push({ t: info.t, v: info.v });
        i += matched.length; continue;
      }

      /* една буква = променлива */
      if (/[A-Za-zА-Яа-я]/.test(ch)) {
        toks.push({ t: 'id', v: ch });
        i++; continue;
      }

      /* символ */
      var found = false;
      for (var s = 0; s < SYMBOLS.length; s++) {
        if (src.startsWith(SYMBOLS[s][0], i)) {
          toks.push({ t: SYMBOLS[s][1], v: SYMBOLS[s][2] });
          i += SYMBOLS[s][0].length; found = true; break;
        }
      }
      if (found) continue;

      toks.push({ t: 'atom', v: ch });
      i++;
    }
    return toks;
  }

  /* ------------------------------------------------------------- парсер */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* възел: s = как се изобразява, bare = без външни скоби (за дроби/степени) */
  function node(s, bare) { return { s: s, bare: bare === undefined ? s : bare }; }
  function row(list) {
    if (list.length === 1) return list[0];
    return '<mrow>' + list.join('') + '</mrow>';
  }
  function op(v, attrs) { return '<mo' + (attrs || '') + '>' + esc(v) + '</mo>'; }

  function Parser(toks) { this.k = toks; this.i = 0; }
  Parser.prototype.peek = function (o) { return this.k[this.i + (o || 0)] || { t: 'eof', v: '' }; };
  Parser.prototype.next = function () { return this.k[this.i++] || { t: 'eof', v: '' }; };
  Parser.prototype.eat = function (t, v) {
    var p = this.peek();
    if (p.t === t && (v === undefined || p.v === v)) { this.i++; return p; }
    return null;
  };

  var STARTS_FACTOR = {
    num: 1, id: 1, greek: 1, const: 1, fn: 1, kw: 1, open: 1, text: 1, atom: 1
  };

  /* най-ниско ниво: изброявания със запетая / точка и запетая */
  Parser.prototype.expr = function () {
    var parts = [this.rel()];
    for (;;) {
      var p = this.peek();
      if (p.t === 'punct') {
        this.next();
        var sep = p.v === '|' ? ' stretchy="false"' : '';
        parts.push(op(p.v, sep));
      } else if (p.t === 'space') {
        this.next();
        parts.push('<mspace width="' + p.v + '"></mspace>');
      } else {
        break;
      }
      if (STARTS_FACTOR[this.peek().t] || this.peek().t === 'addop') parts.push(this.rel());
    }
    return row(parts);
  };

  Parser.prototype.rel = function () {
    var parts = [this.add()];
    while (this.peek().t === 'rel') {
      parts.push(op(this.next().v));
      parts.push(this.add());
    }
    return row(parts);
  };

  Parser.prototype.add = function () {
    var parts = [];
    if (this.peek().t === 'addop') parts.push(op(this.next().v, ' form="prefix"'));
    parts.push(this.mul());
    while (this.peek().t === 'addop') {
      parts.push(op(this.next().v));
      parts.push(this.mul());
    }
    return row(parts);
  };

  Parser.prototype.mul = function () {
    var first = this.pow();
    if (first && first.op && STARTS_FACTOR[this.peek().t]) {
      /* Голям оператор (lim, sum, prod, int) обхваща ЦЯЛОТО следващо
         мултипликативно изражение — включително дроб, ако има такава —
         не само първия съседен член. Затова "lim(x->1) (x^2-1)/(x-1)"
         означава lim от цялата дроб, а не (lim * (x^2-1)) / (x-1). */
      var arg = this.mul();
      return sfull(first) + '<mspace width="0.2em"></mspace>' + sfull(arg);
    }
    var acc = [first];
    for (;;) {
      var p = this.peek();
      if (p.t === 'frac') {
        this.next();
        var num = acc.length === 1 ? bare(acc[0]) :
          '<mrow>' + acc.map(function (a) { return a.s !== undefined ? a.s : a; }).join('') + '</mrow>';
        var den = bare(this.pow());
        acc = [{ s: '<mfrac>' + num + den + '</mfrac>' }];
        continue;
      }
      if (p.t === 'mulop') {
        this.next();
        acc.push({ s: op(p.v) });
        acc.push(this.pow());
        continue;
      }
      if (STARTS_FACTOR[p.t]) {          /* неявно умножение: 2x, f(x), 3 sin x */
        acc.push({ s: '<mo>&#x2062;</mo>' });
        acc.push(this.pow());
        continue;
      }
      break;
    }
    return row(acc.map(function (a) { return a.s !== undefined ? a.s : a; }));
  };

  function bare(x) { return typeof x === 'string' ? x : (x && x.bare) || (x && x.s) || ''; }
  function sfull(x) { return typeof x === 'string' ? x : (x && x.s) || ''; }

  Parser.prototype.pow = function () {
    var base = this.postfix();
    var sub = null, sup = null;
    for (;;) {
      if (this.peek().t === 'sub' && sub === null) {
        this.next(); sub = bare(this.postfix());
      } else if (this.peek().t === 'sup' && sup === null) {
        this.next();
        if (this.peek().t === 'addop') {
          var signTok = this.next();
          if (STARTS_FACTOR[this.peek().t]) {      /* x^-1 */
            sup = '<mrow>' + op(signTok.v, ' form="prefix"') + bare(this.postfix()) + '</mrow>';
          } else {
            /* самостоятелен знак — едностранна граница, напр. x -> a^- */
            sup = op(signTok.v);
          }
        } else {
          sup = bare(this.postfix());
        }
      } else break;
    }
    var b = sfull(base);
    if (sub !== null && sup !== null) return { s: '<msubsup>' + b + sub + sup + '</msubsup>' };
    if (sub !== null) return { s: '<msub>' + b + sub + '</msub>' };
    if (sup !== null) return { s: '<msup>' + b + sup + '</msup>' };
    return base;
  };

  Parser.prototype.postfix = function () {
    var a = this.atom();
    var primes = '';
    while (this.peek().t === 'prime') { this.next(); primes += '′'; }
    if (primes) return { s: '<msup>' + sfull(a) + '<mo>' + primes + '</mo></msup>' };
    return a;
  };

  var CLOSERS = { '(': ')', '[': ']', '{': '}' };

  Parser.prototype.group = function () {
    /* очаква отваряща скоба; връща {s: със скоби, bare: без скоби} */
    var o = this.eat('open');
    if (!o) return node('<mrow></mrow>');
    var inner = (this.peek().t === 'close') ? '<mrow></mrow>' : this.expr();
    var c = this.eat('close');
    var closeCh = c ? c.v : CLOSERS[o.v];
    var withFences = '<mrow>' + op(o.v, ' fence="true" stretchy="true"') + inner +
      op(closeCh, ' fence="true" stretchy="true"') + '</mrow>';
    return node(withFences, inner);
  };

  Parser.prototype.atom = function () {
    var p = this.peek();

    if (p.t === 'num') { this.next(); return node('<mn>' + esc(p.v.replace(',', '.')) + '</mn>'); }
    if (p.t === 'id') { this.next(); return node('<mi>' + esc(p.v) + '</mi>'); }
    if (p.t === 'greek') { this.next(); return node('<mi>' + esc(p.v) + '</mi>'); }
    if (p.t === 'const') { this.next(); return node('<mi mathvariant="normal">' + esc(p.v) + '</mi>'); }
    if (p.t === 'text') {
      this.next();
      return node('<mtext>' + esc(p.v).replace(/ /g, '&#xA0;') + '</mtext>');
    }
    if (p.t === 'atom') { this.next(); return node('<mo>' + esc(p.v) + '</mo>'); }
    if (p.t === 'open') return this.group();
    if (p.t === 'fn') {
      this.next();
      return node('<mi mathvariant="normal" class="mt-fn">' + esc(p.v) + '</mi><mo>&#x2061;</mo>');
    }
    if (p.t === 'kw') { this.next(); return this.keyword(p.v); }

    /* нищо разпознаваемо */
    this.next();
    return node('<mi>' + esc(p.v || '') + '</mi>');
  };

  Parser.prototype.keyword = function (kw) {
    switch (kw) {
      case 'sqrt':
        return node('<msqrt>' + bare(this.group()) + '</msqrt>');
      case 'root': {
        var idx = bare(this.group());
        var rad = bare(this.group());
        return node('<mroot>' + rad + idx + '</mroot>');
      }
      case 'abs':
        return node('<mrow><mo stretchy="true" fence="true">|</mo>' +
          bare(this.group()) + '<mo stretchy="true" fence="true">|</mo></mrow>');
      case 'norm':
        return node('<mrow><mo stretchy="true">‖</mo>' + bare(this.group()) +
          '<mo stretchy="true">‖</mo></mrow>');
      case 'vec':
        return node('<mover accent="true">' + bare(this.group()) + '<mo>→</mo></mover>');
      case 'bar': case 'ol':
        return node('<mover accent="true">' + bare(this.group()) + '<mo>‾</mo></mover>');
      case 'hat':
        return node('<mover accent="true">' + bare(this.group()) + '<mo>^</mo></mover>');
      case 'ul':
        return node('<munder>' + bare(this.group()) + '<mo>_</mo></munder>');
      case 'text':
        return node('<mtext>' + esc(bareText(this)).replace(/ /g, '&#xA0;') + '</mtext>');
      case 'lim': {
        this.eat('sub');
        var under = (this.peek().t === 'open') ? bare(this.group()) : '';
        var limOp = '<mo movablelimits="false" class="mt-fn">lim</mo>';
        var limRes = under ? node('<munder>' + limOp + under + '</munder>') : node(limOp);
        limRes.op = true;      /* голям оператор — иска видимо разстояние преди аргумента си */
        return limRes;
      }
      case 'sum': case 'prod': case 'int': {
        var glyph = kw === 'sum' ? '∑' : (kw === 'prod' ? '∏' : '∫');
        var lo = '', hi = '';
        if (this.eat('sub')) lo = bare(this.peek().t === 'open' ? this.group() : this.postfix());
        if (this.eat('sup')) hi = bare(this.peek().t === 'open' ? this.group() : this.postfix());
        var big = '<mo largeop="true" movablelimits="false">' + glyph + '</mo>';
        var bigRes;
        if (lo && hi) bigRes = node((kw === 'int' ? '<msubsup>' : '<munderover>') + big + lo + hi +
          (kw === 'int' ? '</msubsup>' : '</munderover>'));
        else if (lo) bigRes = node((kw === 'int' ? '<msub>' : '<munder>') + big + lo +
          (kw === 'int' ? '</msub>' : '</munder>'));
        else bigRes = node(big);
        bigRes.op = true;
        return bigRes;
      }
      case 'piece':
        return node(this.piecewise());
      default:
        return node('<mi>' + esc(kw) + '</mi>');
    }
  };

  function bareText(P) {
    var o = P.eat('open'), out = '';
    if (!o) return '';
    while (P.peek().t !== 'close' && P.peek().t !== 'eof') out += P.next().v + ' ';
    P.eat('close');
    return out.trim();
  }

  /* fallback вариант вътре във формула (рядко ползван — виж renderCases) */
  Parser.prototype.piecewise = function () {
    var rows = this.pieceRows();
    var body = rows.map(function (r) {
      return '<mtr>' + r.map(function (c) { return '<mtd>' + c + '</mtd>'; }).join('') + '</mtr>';
    }).join('');
    return '<mrow><mo stretchy="true" fence="true">{</mo>' +
      '<mtable columnalign="left left" columnspacing="1.4em" rowspacing="0.4em">' +
      body + '</mtable></mrow>';
  };

  Parser.prototype.pieceRows = function () {
    this.eat('open');
    var rows = [], cur = [];
    for (;;) {
      var p = this.peek();
      if (p.t === 'close' || p.t === 'eof') { this.next(); break; }
      cur.push(this.rel());
      var q = this.peek();
      if (q.t === 'punct' && q.v === ',') { this.next(); continue; }
      if (q.t === 'punct' && q.v === ';') { this.next(); rows.push(cur); cur = []; continue; }
    }
    if (cur.length) rows.push(cur);
    return rows;
  };

  /* --------------------------------------------------------------- API */

  var MATH_OPEN_INLINE = '<math xmlns="http://www.w3.org/1998/Math/MathML">';
  var MATH_OPEN_BLOCK = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">';

  function compile(src) {
    var P = new Parser(tokenize(String(src)));
    var out = P.expr();
    return out;
  }

  /* формула в рамките на текста */
  function inline(src) {
    try {
      return '<span class="mt">' + MATH_OPEN_INLINE + compile(src) + '</math></span>';
    } catch (e) {
      return '<code class="mt-err">' + esc(src) + '</code>';
    }
  }

  /* самостоятелна формула на отделен ред */
  function block(src) {
    try {
      if (/piece\s*\{/.test(src)) return renderCases(src);
      return '<div class="mt-block">' + MATH_OPEN_BLOCK + compile(src) + '</math></div>';
    } catch (e) {
      return '<pre class="mt-err">' + esc(src) + '</pre>';
    }
  }

  /* функция, зададена на части — рендира се с HTML, за да е скобата идеална */
  function renderCases(src) {
    var idx = src.indexOf('piece');
    var head = src.slice(0, idx).trim();
    var P = new Parser(tokenize(src.slice(idx + 5)));
    var rows = P.pieceRows();
    var brace = Math.min(1.6 + rows.length * 1.05, 5.2);
    var html = '<div class="mt-block mt-cases">';
    if (head) html += '<span class="mt">' + MATH_OPEN_INLINE + compile(head) + '</math></span>';
    html += '<span class="mt-brace" style="font-size:' + brace.toFixed(2) + 'em" aria-hidden="true">{</span>';
    html += '<span class="mt-caserows">';
    rows.forEach(function (cells) {
      html += '<span class="mt-caserow">';
      cells.forEach(function (c, i) {
        html += '<span class="mt-casecell' + (i ? ' mt-casecond' : '') + '">' +
          MATH_OPEN_INLINE + c + '</math></span>';
      });
      html += '</span>';
    });
    html += '</span></div>';
    return html;
  }

  /* текст с вградени формули между обратни апострофи + **удебелен** текст */
  function rich(str) {
    if (str == null) return '';
    var parts = String(str).split('`');
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        out += inline(parts[i]);
      } else {
        out += esc(parts[i])
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');
      }
    }
    return out;
  }

  global.MathText = {
    inline: inline,
    block: block,
    rich: rich,
    escape: esc
  };
})(window);
