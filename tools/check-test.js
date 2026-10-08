#!/usr/bin/env node
/* ============================================================================
 * check-test.js — автоматични проверки на теста
 * Пускане (от папката app/):   node tools/check-test.js
 * Без Node: отвори tools/check-test.html в браузъра.
 * ========================================================================== */
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var core = require('../js/test-core.js');
var buildLib = require('./build-lib.js');
var checkLib = require('./check-lib.js');

var root = path.join(__dirname, '..');
var src = JSON.parse(fs.readFileSync(path.join(root, 'data', 'test.source.json'), 'utf8'));
var text = fs.readFileSync(path.join(root, 'data', 'test.json'), 'utf8');
var data = JSON.parse(text);

var results = checkLib.runChecks(src, data, text, core, buildLib);

/* вграденият SHA-256 съвпада с този на Node */
var samples = ['', 'abc', 'тест|A|t1|0.32', new Array(200).join('x')];
results.unshift({
  name: 'SHA-256 съвпада с crypto на Node',
  ok: samples.every(function (s) { return core.sha256(s) === crypto.createHash('sha256').update(s, 'utf8').digest('hex'); })
});

/* data/test.js и data/test.json съдържат едно и също */
var js = fs.readFileSync(path.join(root, 'data', 'test.js'), 'utf8');
var sandbox = {};
new Function('window', js)(sandbox);
results.push({ name: 'data/test.js = data/test.json', ok: JSON.stringify(sandbox.TEST_DATA) === JSON.stringify(data) });

var failed = 0;
results.forEach(function (r) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'МИНАВА  ' : 'ПАДА    ') + r.name + (r.details ? '\n         ' + r.details : ''));
});
console.log('\n' + (results.length - failed) + ' от ' + results.length + ' проверки минават.');
process.exit(failed ? 1 : 0);
