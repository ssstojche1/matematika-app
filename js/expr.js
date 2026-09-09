/* ============================================================================
 * expr.js — числов калкулатор на изрази
 * ----------------------------------------------------------------------------
 * Използва се на две места:
 *   1) чертане на графики от текстово зададена функция ("x^2-2x+1");
 *   2) проверка на отговорите на студентите — отговорът се сравнява с
 *      еталона чрез числено оценяване в много точки, така че „6x“, „6*x“
 *      и „x*6“ се приемат еднакво за верни.
 * Не използва eval() — изразът се компилира до дърво от функции.
 * ========================================================================== */
(function (global) {
  'use strict';

  var FN = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan,
    cot: function (x) { return 1 / Math.tan(x); },
    ctg: function (x) { return 1 / Math.tan(x); },
    cotg: function (x) { return 1 / Math.tan(x); },
    arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, arctg: Math.atan,
    arccot: function (x) { return Math.PI / 2 - Math.atan(x); },
    arcctg: function (x) { return Math.PI / 2 - Math.atan(x); },
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, lg: function (x) { return Math.log(x) / Math.LN10; },
    log: Math.log, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs,
    sgn: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round
  };
  var CONST = { pi: Math.PI, e: Math.E, oo: Infinity, infinity: Infinity };

  function normalize(src) {
    return String(src)
      .replace(/[−–—]/g, '-')
      .replace(/[·×∙]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/\*\*/g, '^')
      .replace(/√/g, 'sqrt')
      .replace(/π/g, 'pi')
      .replace(/∞/g, 'oo')
      .replace(/(\d),(\d)/g, '$1.$2')   /* десетична запетая */
      .replace(/\s+/g, ' ');
  }

  function tokenize(src) {
    var t = [], i = 0, s = normalize(src);
    while (i < s.length) {
      var c = s[i];
      if (c === ' ') { i++; continue; }
      if (/[0-9.]/.test(c)) {
        var m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
        if (!m) throw new Error('число');
        t.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if (/[A-Za-z]/.test(c)) {
        var w = /^[A-Za-z]+/.exec(s.slice(i))[0];
        t.push({ t: 'name', v: w }); i += w.length; continue;
      }
      if ('+-*/^(),|'.indexOf(c) >= 0) { t.push({ t: c }); i++; continue; }
      throw new Error('непознат символ: ' + c);
    }
    return t;
  }

  function Parser(toks) { this.k = toks; this.i = 0; this.vars = {}; }
  Parser.prototype.peek = function () { return this.k[this.i] || { t: 'eof' }; };
  Parser.prototype.next = function () { return this.k[this.i++] || { t: 'eof' }; };
  Parser.prototype.eat = function (t) { if (this.peek().t === t) { this.i++; return true; } return false; };

  Parser.prototype.expr = function () {
    var a = this.term();
    for (;;) {
      if (this.eat('+')) { a = bin(a, this.term(), function (x, y) { return x + y; }); }
      else if (this.eat('-')) { a = bin(a, this.term(), function (x, y) { return x - y; }); }
      else return a;
    }
  };
  Parser.prototype.term = function () {
    var a = this.unary();
    for (;;) {
      if (this.eat('*')) a = bin(a, this.unary(), function (x, y) { return x * y; });
      else if (this.eat('/')) a = bin(a, this.unary(), function (x, y) { return x / y; });
      else if (this.startsFactor()) a = bin(a, this.unary(), function (x, y) { return x * y; });
      else return a;
    }
  };
  Parser.prototype.startsFactor = function () {
    var p = this.peek();
    return p.t === 'num' || p.t === 'name' || p.t === '(' || p.t === '|';
  };
  Parser.prototype.unary = function () {
    if (this.eat('-')) { var a = this.unary(); return function (s) { return -a(s); }; }
    if (this.eat('+')) return this.unary();
    return this.power();
  };
  Parser.prototype.power = function () {
    var base = this.atom();
    if (this.eat('^')) {
      var ex = this.unary();
      return bin(base, ex, function (x, y) { return Math.pow(x, y); });
    }
    return base;
  };
  Parser.prototype.atom = function () {
    var p = this.next();
    var self = this;
    if (p.t === 'num') { var v = p.v; return function () { return v; }; }
    if (p.t === '(') { var e = this.expr(); this.eat(')'); return e; }
    if (p.t === '|') { var e2 = this.expr(); this.eat('|'); return function (s) { return Math.abs(e2(s)); }; }
    if (p.t === 'name') {
      var nm = p.v;
      if (FN[nm]) {
        var f = FN[nm], arg;
        if (this.peek().t === '(') { this.next(); arg = this.expr(); this.eat(')'); }
        else arg = this.power();
        return function (s) { return f(arg(s)); };
      }
      if (CONST[nm] !== undefined) { var cv = CONST[nm]; return function () { return cv; }; }
      if (nm.length > 1) {                       /* xy -> x*y */
        var chain = nm.split('').map(function (ch) {
          self.vars[ch] = true;
          return function (s) { return s[ch] !== undefined ? s[ch] : NaN; };
        });
        return function (s) {
          var r = 1;
          for (var i = 0; i < chain.length; i++) r *= chain[i](s);
          return r;
        };
      }
      this.vars[nm] = true;
      return function (s) { return s[nm] !== undefined ? s[nm] : NaN; };
    }
    throw new Error('неочакван край на израза');
  };
  function bin(a, b, f) { return function (s) { return f(a(s), b(s)); }; }

  var cache = {};

  /** compile("x^2-1") -> {fn(scope), vars:[...]}  (хвърля грешка при невалиден израз) */
  function compile(src) {
    var key = String(src);
    if (cache[key]) return cache[key];
    var P = new Parser(tokenize(src));
    var f = P.expr();
    if (P.i < P.k.length) throw new Error('излишни символи');
    var res = { fn: f, vars: Object.keys(P.vars) };
    cache[key] = res;
    return res;
  }

  /** Безопасно оценяване: връща NaN вместо грешка. */
  function evalAt(src, scope) {
    try { return compile(src).fn(scope || {}); } catch (e) { return NaN; }
  }

  /** Прави функция f(x, params) от текст. */
  function toFunction(src, extraParams) {
    var c = compile(src);
    return function (x, params) {
      var scope = Object.create(null);
      scope.x = x;
      if (params) for (var k in params) scope[k] = params[k];
      if (extraParams) for (var k2 in extraParams) if (scope[k2] === undefined) scope[k2] = extraParams[k2];
      return c.fn(scope);
    };
  }

  /**
   * Проверка дали отговорът на студента съвпада с еталона.
   * Сравнява числено в много точки от даден интервал.
   */
  function equivalent(userSrc, refSrc, opts) {
    opts = opts || {};
    var vname = opts.variable || 'x';
    var lo = opts.min === undefined ? -3.17 : opts.min;
    var hi = opts.max === undefined ? 3.23 : opts.max;
    var tol = opts.tol === undefined ? 1e-6 : opts.tol;
    var u, r;
    try { u = compile(userSrc); } catch (e) { return false; }
    try { r = compile(refSrc); } catch (e) { return false; }

    var tested = 0, ok = 0;
    for (var i = 0; i <= 24; i++) {
      var x = lo + (hi - lo) * i / 24;
      var scope = {}; scope[vname] = x;
      var a = safe(u.fn, scope), b = safe(r.fn, scope);
      if (!isFinite(b)) continue;              /* еталонът не е дефиниран тук */
      tested++;
      if (!isFinite(a)) continue;
      var d = Math.abs(a - b);
      var scale = Math.max(1, Math.abs(b));
      if (d / scale < Math.max(tol, 1e-9)) ok++;
    }
    return tested >= 5 && ok >= tested - 1 && ok / tested > 0.92;
  }
  function safe(f, s) { try { return f(s); } catch (e) { return NaN; } }

  /** Числена производна (централна разлика с богата точност) */
  function derivative(f, x, params, h) {
    h = h || 1e-5;
    var a = f(x + h, params), b = f(x - h, params);
    if (!isFinite(a) || !isFinite(b)) {
      a = f(x + h, params); b = f(x, params);
      return (a - b) / h;
    }
    return (a - b) / (2 * h);
  }

  /** Разбор на число, въведено от студент (позволява дроби като 3/4). */
  function parseNumber(src) {
    if (src == null) return NaN;
    var s = String(src).trim();
    if (!s) return NaN;
    try { return compile(s).fn({}); } catch (e) { return NaN; }
  }

  global.Expr = {
    compile: compile,
    evalAt: evalAt,
    toFunction: toFunction,
    equivalent: equivalent,
    derivative: derivative,
    parseNumber: parseNumber,
    normalize: normalize
  };
})(window);
