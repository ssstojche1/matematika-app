/* ============================================================================
 * build-lib.js — превръща data/test.source.json (с отговорите в чист вид)
 * в публикуемите данни на теста, в които отговорите са само солени хешове.
 * Ползва се от tools/build-test.js (Node) и от tools/build-test.html (браузър).
 * ========================================================================== */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BuildLib = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var TYPES = { 'numeric': 1, 'numeric-figure': 1, 'mcq': 1, 'mcq-graph': 1 };

  function fail(msg) { throw new Error(msg); }

  function buildTestData(src, core) {
    if (!src.salt || String(src.salt).length < 12) fail('Липсва сол (salt) или е твърде къса.');
    if (!Array.isArray(src.scale) || !src.scale.length) fail('Липсва скала (scale).');
    var salt = String(src.salt);
    var byIndex = {};
    src.tasks.forEach(function (t, i) {
      if (!TYPES[t.type]) fail('Непознат тип „' + t.type + '“ в ' + t.id);
      byIndex[i + 1] = t;
    });

    var total = src.tasks.reduce(function (s, t) { return s + t.points; }, 0);
    var out = {
      _note: 'Генериран файл — не редактирай ръчно. Изход: data/test.source.json → tools/build-test.js',
      generated: new Date().toISOString(),
      title: src.title,
      durationMinutes: src.durationMinutes === undefined ? null : src.durationMinutes,
      salt: salt,
      scale: src.scale,
      totalPoints: total,
      variants: {}
    };

    ['A', 'B'].forEach(function (v) {
      var order = src.order[v];
      if (!order || order.length !== src.tasks.length) fail('Редът за вариант ' + v + ' не съдържа всички задачи.');
      out.variants[v] = {
        questions: order.map(function (idx, pos) {
          var t = byIndex[idx];
          if (!t) fail('Няма задача с номер ' + idx + ' (вариант ' + v + ').');
          var d = t[v];
          if (!d) fail('Задача ' + t.id + ' няма данни за вариант ' + v + '.');
          var q = { id: t.id, n: pos + 1, title: t.title, type: t.type, points: t.points, prompt: d.prompt };

          if (t.type === 'numeric' || t.type === 'numeric-figure') {
            if (!d.answers || !d.answers.length) fail(t.id + v + ': липсва отговор.');
            var seen = {};
            q.hashes = [];
            d.answers.forEach(function (a) {
              var norm = core.normalizeNumeric(a);
              if (norm === null) fail(t.id + v + ': отговорът „' + a + '“ не е число.');
              if (seen[norm]) return;
              seen[norm] = 1;
              q.hashes.push(core.answerHash(salt, v, t.id, norm));
            });
            if (t.type === 'numeric-figure') {
              if (!d.figure) fail(t.id + v + ': липсва чертеж (figure).');
              q.figure = d.figure;
            }
          } else {
            if (!d.options || d.options.length !== 4) fail(t.id + v + ': нужни са точно 4 опции.');
            if (typeof d.correct !== 'number' || !d.options[d.correct]) fail(t.id + v + ': липсва верен отговор (correct).');
            /* id-тата на опциите са псевдослучайни и опциите се подреждат по
               тях, така че позицията в изходния файл не издава верния */
            var opts = d.options.map(function (o, i) {
              var id = core.sha256(salt + '|opt|' + v + '|' + t.id + '|' + i).slice(0, 6);
              if (t.type === 'mcq') return { id: id, text: o, _i: i };
              var plot = Object.assign({}, d.window, { height: 170, curves: [{ expr: o, color: 'pink' }] });
              return { id: id, plot: plot, _i: i };
            });
            q.hashes = [core.answerHash(salt, v, t.id, opts[d.correct].id)];
            opts.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
            q.options = opts.map(function (o) { delete o._i; return o; });
            if (t.type === 'mcq-graph') {
              if (!d.given) fail(t.id + v + ': липсва графиката на f (given).');
              q.given = d.given;
            }
          }
          return q;
        })
      };
    });
    return out;
  }

  function toJson(data) { return JSON.stringify(data, null, 2) + '\n'; }
  function toScript(data) {
    return '/* Генериран файл (tools/build-test.js) — не редактирай ръчно.\n' +
      ' * Същото съдържание като data/test.json; зарежда се като <script>, за да\n' +
      ' * работи и при отваряне на index.html директно от диска (file://). */\n' +
      'window.TEST_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
  }

  return { buildTestData: buildTestData, toJson: toJson, toScript: toScript };
});
