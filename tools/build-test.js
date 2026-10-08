#!/usr/bin/env node
/* ============================================================================
 * build-test.js — генерира data/test.json и data/test.js от data/test.source.json
 * ----------------------------------------------------------------------------
 * Пускане (от папката app/):   node tools/build-test.js
 * Без Node: отвори tools/build-test.html в браузъра — прави същото.
 * ========================================================================== */
'use strict';
var fs = require('fs');
var path = require('path');
var core = require('../js/test-core.js');
var lib = require('./build-lib.js');

var root = path.join(__dirname, '..');
var srcPath = path.join(root, 'data', 'test.source.json');
if (!fs.existsSync(srcPath)) {
  console.error('Няма ' + srcPath + ' — изходният файл с отговорите е само локален.');
  process.exit(1);
}
var src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
var data = lib.buildTestData(src, core);

fs.writeFileSync(path.join(root, 'data', 'test.json'), lib.toJson(data), 'utf8');
fs.writeFileSync(path.join(root, 'data', 'test.js'), lib.toScript(data), 'utf8');

console.log('Готово: data/test.json и data/test.js');
['A', 'B'].forEach(function (v) {
  var qs = data.variants[v].questions;
  console.log('  Вариант ' + core.VARIANT_LABEL[v] + ': ' + qs.length + ' задачи, ' +
    qs.reduce(function (s, q) { return s + q.points; }, 0) + ' точки, ред ' + qs.map(function (q) { return q.id; }).join(','));
});
console.log('Не забравяй да вдигнеш ?v=… в index.html, за да стигне новата версия до браузърите.');
