/* ============================================================================
 * test-core.js — чиста логика на секция „Тест“ (без DOM)
 * ----------------------------------------------------------------------------
 * Ползва се на три места с ЕДИН И СЪЩ код, за да не се разминават хешовете:
 *   1) в браузъра (js/test.js) — оценяване и код за проверка;
 *   2) tools/build-test.js — генериране на data/test.json от изходния файл;
 *   3) tools/check-test.js — автоматичните проверки.
 *
 *   sha256(str)                         SHA-256 (hex) върху UTF-8, без библиотеки
 *   normalizeNumeric("32/3")            → "10.67" (или null, ако не е число)
 *   answerHash(salt, variant, qid, v)   солен хеш на нормализиран отговор
 *   variantFor("2101234")               → 'A' (четна последна цифра) / 'B'
 *   optionOrder(fn, qid, ids)           детерминирано разбъркване на опциите
 *   gradeFor(points, scale)             оценка 2–6 по скалата от конфига
 *   verifyCode(fn, variant, pts, salt)  8 знака (0–9, A–F) за проверка на листа
 *   score(data, variant, answers)       точки (без информация по задачи)
 * ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TestCore = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* ------------------------------------------------------------ SHA-256 */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8(str) {
    var out = [];
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
        c = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00);
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }

  function sha256(str) {
    var bytes = utf8(str);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    bytes.push(hi >>> 24 & 255, hi >>> 16 & 255, hi >>> 8 & 255, hi & 255,
      lo >>> 24 & 255, lo >>> 16 & 255, lo >>> 8 & 255, lo & 255);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      for (var t = 0; t < 16; t++) {
        W[t] = (bytes[off + t * 4] << 24 | bytes[off + t * 4 + 1] << 16 | bytes[off + t * 4 + 2] << 8 | bytes[off + t * 4 + 3]) | 0;
      }
      for (t = 16; t < 64; t++) {
        var w15 = W[t - 15], w2 = W[t - 2];
        var s0 = (w15 >>> 7 | w15 << 25) ^ (w15 >>> 18 | w15 << 14) ^ (w15 >>> 3);
        var s1 = (w2 >>> 17 | w2 << 15) ^ (w2 >>> 19 | w2 << 13) ^ (w2 >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + W[t]) | 0;
        var S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  /* ------------------------------------------------- числови отговори */
  /* Разрешени: цифри, десетична запетая/точка, + − · /, скоби, π / pi.
     Всичко друго (букви, променливи) → null, т.е. отговорът не е число. */
  function parseArith(s) {
    var i = 0;
    function peek() { return s[i]; }
    function expr() {
      var v = term();
      while (peek() === '+' || peek() === '-') {
        var o = s[i++], r = term();
        v = o === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      var v = unary();
      for (;;) {
        if (peek() === '*' || peek() === '/') {
          var o = s[i++], r = unary();
          v = o === '*' ? v * r : v / r;
        } else if (peek() === '(' || peek() === 'π') {
          v *= unary();               /* неявно умножение: 2π, 3(1/2) */
        } else break;
      }
      return v;
    }
    function unary() {
      if (peek() === '-') { i++; return -unary(); }
      if (peek() === '+') { i++; return unary(); }
      return primary();
    }
    function primary() {
      if (peek() === '(') {
        i++;
        var v = expr();
        if (s[i++] !== ')') throw new Error('скоба');
        return v;
      }
      if (peek() === 'π') { i++; return Math.PI; }
      var m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) throw new Error('число');
      i += m[0].length;
      var v = parseFloat(m[0]);
      if (peek() === 'π' || peek() === '(') v *= unary();
      return v;
    }
    var out = expr();
    if (i !== s.length) throw new Error('излишни символи');
    return out;
  }

  function round2(x) {
    var r = Math.round(x * 100 + (x >= 0 ? 1e-7 : -1e-7)) / 100;
    if (r === 0) r = 0;              /* без „-0.00“ */
    return r.toFixed(2);
  }

  function normalizeNumeric(input) {
    if (input == null) return null;
    var s = String(input).trim().toLowerCase();
    /* мерна единица в края („200 m²“, „200 кв. м“) не пречи */
    s = s.replace(/\s*(m\^?2|m²|м²|кв\.?\s*м\.?|кв\.?\s*ед\.?)$/, '');
    s = s.replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace(/[−–—]/g, '-')
      .replace(/[·×∙]/g, '*')
      .replace(/[÷:]/g, '/')
      .replace(/pi|пи/g, 'π');
    if (!s || !/^[0-9.+\-*/()π]+$/.test(s)) return null;
    var v;
    try { v = parseArith(s); } catch (e) { return null; }
    if (typeof v !== 'number' || !isFinite(v)) return null;
    return round2(v);
  }

  /* ------------------------------------------------------------ хешове */
  function answerHash(salt, variant, qid, normalized) {
    return sha256(salt + '|' + variant + '|' + qid + '|' + normalized);
  }

  function variantFor(fn) {
    var d = String(fn).replace(/\D/g, '').slice(-1);
    if (d === '') return null;
    return Number(d) % 2 === 0 ? 'A' : 'B';
  }

  /* детерминиран генератор, засят от хеш (mulberry32) */
  function seededRandom(seedStr) {
    var a = parseInt(sha256(seedStr).slice(0, 8), 16) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Ред на опциите за даден студент и задача: един и същ при всяко
     отваряне (същият номер → същият ред), различен между студентите. */
  function optionOrder(fn, qid, ids) {
    var rnd = seededRandom('order|' + fn + '|' + qid);
    var out = ids.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function gradeFor(points, scale) {
    var sorted = scale.slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < sorted.length; i++) if (points >= sorted[i].min) return sorted[i].grade;
    return sorted.length ? sorted[sorted.length - 1].grade : 2;
  }

  function verifyCode(fn, variant, points, salt) {
    return sha256(String(fn) + '|' + variant + '|' + Number(points) + '|' + salt).slice(0, 8).toUpperCase();
  }

  /* Приема отговор за една задача → true/false. За избираемите задачи
     отговорът е id на опцията; за числовите — текстът от полето. */
  function isCorrect(data, variant, q, answer) {
    if (answer == null || answer === '') return false;
    var norm = (q.type === 'numeric' || q.type === 'numeric-figure') ? normalizeNumeric(answer) : String(answer);
    if (norm === null) return false;
    var h = answerHash(data.salt, variant, q.id, norm);
    return q.hashes.indexOf(h) >= 0;
  }

  function score(data, variant, answers) {
    var pts = 0;
    data.variants[variant].questions.forEach(function (q) {
      if (isCorrect(data, variant, q, answers && answers[q.id])) pts += q.points;
    });
    return pts;
  }

  return {
    sha256: sha256,
    normalizeNumeric: normalizeNumeric,
    answerHash: answerHash,
    variantFor: variantFor,
    optionOrder: optionOrder,
    gradeFor: gradeFor,
    verifyCode: verifyCode,
    score: score,
    VARIANT_LABEL: { A: 'А', B: 'Б' }
  };
});
