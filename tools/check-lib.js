/* ============================================================================
 * check-lib.js — автоматични проверки на теста (Блок 6)
 * Ползва се от tools/check-test.js (Node) и tools/check-test.html (браузър).
 * runChecks(source, data, publishedText, core, buildLib) → [{ name, ok, details }]
 * ========================================================================== */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CheckLib = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function runChecks(src, data, publishedText, core, buildLib) {
    var results = [];
    function add(name, ok, details) { results.push({ name: name, ok: !!ok, details: details || '' }); }
    var salt = data.salt;
    var byId = {};
    src.tasks.forEach(function (t) { byId[t.id] = t; });

    function correctAnswers(v) {
      var ans = {};
      data.variants[v].questions.forEach(function (q) {
        var t = byId[q.id][v];
        if (q.type === 'numeric' || q.type === 'numeric-figure') ans[q.id] = t.answers[0];
        else ans[q.id] = core.sha256(salt + '|opt|' + v + '|' + q.id + '|' + t.correct).slice(0, 6);
      });
      return ans;
    }
    function q(v, id) { return data.variants[v].questions.filter(function (x) { return x.id === id; })[0]; }
    function only(v, id, value) { var a = {}; a[id] = value; return core.score(data, v, a); }

    /* 0. публикуваните данни съответстват на изходния файл */
    var rebuilt = buildLib.buildTestData(src, core);
    var same = JSON.stringify(rebuilt.variants) === JSON.stringify(data.variants) && rebuilt.salt === data.salt &&
      rebuilt.durationMinutes === data.durationMinutes && JSON.stringify(rebuilt.scale) === JSON.stringify(data.scale);
    add('0. data/test.json е генериран от текущия test.source.json', same,
      same ? '' : 'Пусни отново tools/build-test.js — данните са остарели.');

    /* 1. верни отговори → 100/100, оценка 6 */
    ['A', 'B'].forEach(function (v) {
      var pts = core.score(data, v, correctAnswers(v));
      var g = core.gradeFor(pts, data.scale);
      add('1. Вариант ' + core.VARIANT_LABEL[v] + ': верни отговори → 100/100, оценка 6', pts === 100 && g === 6, pts + ' т., оценка ' + g);
    });
    var orderA = data.variants.A.questions.map(function (x) { return Number(x.id.slice(1)); }).join(',');
    var orderB = data.variants.B.questions.map(function (x) { return Number(x.id.slice(1)); }).join(',');
    add('1б. Ред на задачите (А: 1–10, Б: 6,1,9,3,10,2,7,4,8,5)',
      orderA === '1,2,3,4,5,6,7,8,9,10' && orderB === '6,1,9,3,10,2,7,4,8,5', 'А: ' + orderA + ' · Б: ' + orderB);

    /* 2. нормализация */
    var p1 = q('A', 't1').points;
    var forms = ['0,32', '0.32', '8/25', ' 0.32 '];
    var norms = forms.map(core.normalizeNumeric);
    add('2а. „0,32“, „0.32“, „8/25“, „ 0.32 “ → едно и също и се приемат за 1А',
      norms.every(function (n) { return n === '0.32'; }) && forms.every(function (f) { return only('A', 't1', f) === p1; }),
      forms.map(function (f, i) { return JSON.stringify(f) + '→' + norms[i]; }).join(', '));
    var p8 = q('A', 't8').points;
    add('2б. „32/3“ и „10,67“ се приемат за 8А', only('A', 't8', '32/3') === p8 && only('A', 't8', '10,67') === p8);
    var p7 = q('B', 't7').points;
    add('2в. „π“ и „3.14“ се приемат за 7Б', only('B', 't7', 'π') === p7 && only('B', 't7', '3.14') === p7 && only('B', 't7', 'pi') === p7);

    /* 3. празни и грешни отговори → 0 */
    var wrongOk = ['A', 'B'].every(function (v) {
      var wrong = {};
      data.variants[v].questions.forEach(function (x) {
        if (x.options) {
          var good = correctAnswers(v)[x.id];
          wrong[x.id] = x.options.filter(function (o) { return o.id !== good; })[0].id;
        } else wrong[x.id] = '12345';
      });
      return core.score(data, v, {}) === 0 && core.score(data, v, wrong) === 0 &&
        core.score(data, v, { t1: '', t2: '   ', t4: 'abc', t9: 'x' }) === 0;
    });
    add('3. Празни и грешни отговори → 0 точки (и двата варианта)', wrongOk);

    /* 4. граници на скалата */
    var bounds = [[49, 2], [50, 3], [64, 3], [65, 4], [79, 4], [80, 5], [91, 5], [92, 6]];
    var bad = bounds.filter(function (b) { return core.gradeFor(b[0], data.scale) !== b[1]; });
    add('4. Граници на скалата 49/50/64/65/79/80/91/92', !bad.length,
      bounds.map(function (b) { return b[0] + '→' + core.gradeFor(b[0], data.scale); }).join(', '));

    /* 5. вариант по последната цифра */
    var vs = [];
    for (var d = 0; d <= 9; d++) vs.push(d + ':' + core.VARIANT_LABEL[core.variantFor('21031' + d)]);
    var vOk = vs.every(function (s) { var dd = Number(s[0]); return s.slice(2) === (dd % 2 === 0 ? 'А' : 'Б'); });
    add('5. Вариант за номера, завършващи на 0–9', vOk, vs.join(' '));

    /* 6. детерминирано разбъркване, верният не е винаги на едно място */
    var detOk = true, spreadOk = true, spread = [];
    ['A', 'B'].forEach(function (v) {
      var good = correctAnswers(v);
      data.variants[v].questions.forEach(function (x) {
        if (!x.options) return;
        var ids = x.options.map(function (o) { return o.id; });
        var seen = {};
        for (var i = 0; i < 200; i++) {
          var fn = String(2100000 + i * 37);
          var o1 = core.optionOrder(fn, x.id, ids), o2 = core.optionOrder(fn, x.id, ids);
          if (o1.join() !== o2.join()) detOk = false;
          seen[o1.indexOf(good[x.id])] = (seen[o1.indexOf(good[x.id])] || 0) + 1;
        }
        if (Object.keys(seen).length < 4) spreadOk = false;
        spread.push(x.id + core.VARIANT_LABEL[v] + ' ' + [0, 1, 2, 3].map(function (p) { return seen[p] || 0; }).join('/'));
      });
    });
    add('6а. Един и същ номер → един и същ ред на опциите', detOk);
    add('6б. Верният отговор е на различни позиции (200 номера)', spreadOk, spread.join(' · '));

    /* 7. публикуваният файл не съдържа отговорите в чист вид */
    var leaks = [];
    ['"correct"', '"answers"', '"answer"', '"_i"'].forEach(function (k) { if (publishedText.indexOf(k) >= 0) leaks.push('ключ ' + k); });
    src.tasks.forEach(function (t) {
      ['A', 'B'].forEach(function (v) {
        (t[v].answers || []).forEach(function (a) {
          [a, core.normalizeNumeric(a)].forEach(function (s) {
            if (new RegExp('"' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"').test(publishedText)) leaks.push(t.id + v + ' „' + s + '“');
          });
        });
      });
    });
    add('7. В публикувания test.json няма отговори в чист вид', !leaks.length,
      leaks.length ? 'Намерено: ' + leaks.join(', ') :
        'няма ключове correct/answers; числовите отговори ги няма като стойности; опциите са подредени по псевдослучайно id без отбелязан верен');

    return results;
  }

  return { runChecks: runChecks };
});
