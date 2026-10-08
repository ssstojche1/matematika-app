/* ============================================================================
 * test.js — секция „Тест“ (оценяващ тест с един опит) и режим за преподавателя
 * ----------------------------------------------------------------------------
 * Маршрути (закачат се от app.js чрез TestSection.route):
 *   #/test       входен екран → задачи → резултат
 *   #/teacher    само при адрес с ?teacher=1 — проверка на лист и нулиране
 *
 * Данните идват от data/test.js (window.TEST_DATA), логиката по хешовете —
 * от js/test-core.js, а видимостта и версията — от js/config.js.
 *
 * Състоянието се пази в localStorage под ключ test_v<версия>_state — НЕ с
 * префикс user_, за да не го изтрие бутонът „Изтрий напредъка“ (един опит).
 * ========================================================================== */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var DATA = window.TEST_DATA || null;
  var Core = window.TestCore;
  var VL = Core.VARIANT_LABEL;
  var LETTERS = ['а', 'б', 'в', 'г'];

  function esc(s) { return MathText.escape(s == null ? '' : s); }

  /* ------------------------------------------------------------ състояние */
  function stateKey() { return 'test_v' + (CFG.testVersion || 1) + '_state'; }
  function load() { return Store.get(stateKey(), null); }
  function save(st) { Store.set(stateKey(), st); }
  function clearDevice() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('test_') === 0) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* без localStorage — няма какво да се чисти */ }
  }

  function visible() { return CFG.testVisible === true && !!DATA; }
  function isTeacher() { return /[?&]teacher=1(&|$)/.test(location.search); }

  function durationMs() {
    return DATA && DATA.durationMinutes ? DATA.durationMinutes * 60000 : null;
  }

  /* -------------------------------------------- почистване между страници */
  var timerId = null;
  var plots = [];
  function cleanup() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    plots.forEach(function (p) { p.destroy(); });
    plots = [];
  }

  function shadeUnder(sh) {
    var f = Expr.toFunction(sh.expr);
    return function (o) {
      var ctx = o.ctx, P = o.P, b = P.box, N = 160;
      ctx.save();
      ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
      ctx.beginPath();
      ctx.moveTo(P.X(sh.from), P.Y(0));
      for (var i = 0; i <= N; i++) {
        var x = sh.from + (sh.to - sh.from) * i / N;
        ctx.lineTo(P.X(x), P.Y(f(x, {})));
      }
      ctx.lineTo(P.X(sh.to), P.Y(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(37,99,235,.22)';
      ctx.fill();
      ctx.restore();
    };
  }

  function makePlot(container, spec, alt) {
    var s = Object.assign({}, spec, { alt: alt });
    if (spec.shadeUnder) s.custom = shadeUnder(spec.shadeUnder);
    delete s.shadeUnder;
    var host = document.createElement('div');
    container.appendChild(host);
    plots.push(Plot.create(host, s));
  }

  /* ------------------------------------------------------------- малки */
  function fmtTime(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    var mm = (h ? String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
    return h ? h + ':' + mm : mm;
  }
  function isAnswered(v) { return v != null && String(v).trim() !== ''; }
  function unansweredCount(st) {
    return DATA.variants[st.variant].questions.filter(function (q) { return !isAnswered(st.answers[q.id]); }).length;
  }
  function fullName(st) { return (st.first + ' ' + st.last).trim(); }

  /* ================================================================ карта */
  function cardHtml() {
    if (!visible()) return '';
    var st = load();
    var n = DATA.variants.A.questions.length;
    var status = st && st.result ? '<span class="progress-pill">предаден</span>' :
      st ? '<span class="progress-pill test-pill-live">в процес</span>' : '';
    return '<a class="section-card test-card" href="#/test" data-nav>' + status +
      '<span class="topic-tag">Тест</span>' +
      '<h2>' + esc(DATA.title) + '</h2>' +
      '<p>' + n + ' задачи · ' + DATA.totalPoints + ' точки' +
      (DATA.durationMinutes ? ' · ' + DATA.durationMinutes + ' минути' : '') + ' · един опит.</p>' +
      '<span class="cta">' + (st && st.result ? 'Виж резултата' : st ? 'Продължи теста' : 'Към теста') +
      ' <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>' +
      '</a>';
  }

  /* ================================================================ рутер */
  function route(parts, view, h) {
    cleanup();
    if (parts.length === 0 && isTeacher()) { location.replace('#/teacher'); return true; }
    if (parts[0] === 'teacher' && isTeacher()) { renderTeacher(view, h); return true; }
    if (parts[0] === 'test') {
      if (!visible()) { location.replace('#/'); return true; }
      renderTest(view, h);
      return true;
    }
    return false;
  }

  function head(sub) {
    return '<div class="page-head">' +
      '<div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span><span>Тест</span></div>' +
      '<h1>' + esc(DATA.title) + '</h1>' + (sub || '') + '</div>';
  }

  function renderTest(view, h) {
    var st = load();
    h.renderSidebar({ route: 'test' });
    if (st && st.result) return renderResult(view, st);
    if (st) {
      var d = durationMs();
      if (d && Date.now() >= st.startedAt + d) { submit(st, true); return renderResult(view, st); }
      return renderQuestions(view, h, st);
    }
    renderStart(view, h);
  }

  /* ========================================================= входен екран */
  function renderStart(view, h) {
    var n = DATA.variants.A.questions.length;
    view.innerHTML =
      '<div class="view view-narrow">' + head() +
      '<div class="card">' +
      '<div class="tag-row">' +
      '<span class="tag">' + n + ' задачи</span>' +
      '<span class="tag">' + DATA.totalPoints + ' точки</span>' +
      '<span class="tag">' + (DATA.durationMinutes ? DATA.durationMinutes + ' минути' : 'без ограничение на времето') + '</span>' +
      '<span class="tag">един опит</span>' +
      '</div>' +
      '<p class="test-rules"><strong>Решавай върху лист. Преди предаване запиши решенията си. Имаш само един опит.</strong></p>' +
      '<p class="test-muted">Вариантът (А или Б) се определя автоматично от последната цифра на факултетния номер. ' +
      (DATA.durationMinutes ? 'Времето тръгва веднага след „Започни“ и тестът се предава автоматично, когато изтече. ' : '') +
      'Отговорите се пазят на това устройство, докато не предадеш теста.</p>' +
      '<form id="test-start" class="test-form" novalidate>' +
      field('t-first', 'Име', 'text', 'given-name') +
      field('t-last', 'Фамилия', 'text', 'family-name') +
      field('t-fn', 'Факултетен номер', 'text', 'off', 'numeric') +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">Започни</button></div>' +
      '</form>' +
      '</div></div>';

    var form = document.getElementById('test-start');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = val('t-first'), last = val('t-last'), fn = val('t-fn');
      var ok = true;
      ok = check('t-first', first.length >= 2, 'Въведи име.') && ok;
      ok = check('t-last', last.length >= 2, 'Въведи фамилия.') && ok;
      ok = check('t-fn', /^\d{3,12}$/.test(fn), 'Факултетният номер трябва да съдържа само цифри (3–12).') && ok;
      if (!ok) { form.querySelector('[aria-invalid="true"]').focus(); return; }
      var st = {
        version: CFG.testVersion || 1,
        first: first, last: last, fn: fn,
        variant: Core.variantFor(fn),
        startedAt: Date.now(),
        current: 0,
        answers: {}
      };
      save(st);
      renderQuestions(view, h, st);
    });
  }

  function field(id, label, type, autocomplete, inputmode) {
    return '<div class="test-field">' +
      '<label for="' + id + '">' + esc(label) + '</label>' +
      '<input class="q-input test-input" id="' + id + '" type="' + type + '" autocomplete="' + autocomplete + '"' +
      (inputmode ? ' inputmode="' + inputmode + '" pattern="[0-9]*"' : '') +
      ' aria-describedby="' + id + '-err" required>' +
      '<div class="test-err" id="' + id + '-err"></div></div>';
  }
  function val(id) { return document.getElementById(id).value.trim(); }
  function check(id, cond, msg) {
    var el = document.getElementById(id);
    el.setAttribute('aria-invalid', cond ? 'false' : 'true');
    document.getElementById(id + '-err').textContent = cond ? '' : msg;
    return cond;
  }

  /* ============================================================== задачи */
  function renderQuestions(view, h, st) {
    var qs = DATA.variants[st.variant].questions;
    var dur = durationMs();

    view.innerHTML =
      '<div class="view view-narrow test-view">' +
      head('<p class="lead">' + esc(fullName(st)) + ' · ф. н. ' + esc(st.fn) + ' · <strong>Вариант ' + VL[st.variant] + '</strong></p>') +
      '<div class="test-bar">' +
      (dur ? '<div class="test-timer" id="test-timer" role="timer" aria-label="Оставащо време"></div>' : '') +
      '<div class="test-count" id="test-count"></div>' +
      '<button class="btn btn-primary btn-sm" id="test-submit" type="button">Предай теста</button>' +
      '</div>' +
      '<nav class="test-nav" id="test-nav" aria-label="Задачи"></nav>' +
      '<div class="card test-q" id="test-q"></div>' +
      '<div class="step-nav">' +
      '<button class="btn btn-ghost" id="test-prev" type="button">‹ Предишна</button>' +
      '<button class="btn btn-ghost" id="test-next" type="button">Следваща ›</button>' +
      '</div>' +
      '<div class="vis-hidden" id="test-live" aria-live="assertive"></div>' +
      '</div>' +
      dialogHtml();

    var navEl = document.getElementById('test-nav');
    var qEl = document.getElementById('test-q');
    var countEl = document.getElementById('test-count');

    function renderNav() {
      navEl.innerHTML = qs.map(function (q, i) {
        var done = isAnswered(st.answers[q.id]);
        return '<button type="button" class="test-nav-btn' + (done ? ' is-answered' : '') + (i === st.current ? ' is-current' : '') + '"' +
          ' data-i="' + i + '"' + (i === st.current ? ' aria-current="step"' : '') +
          ' aria-label="Задача ' + (i + 1) + ', ' + (done ? 'отговорена' : 'неотговорена') + '">' + (i + 1) + '</button>';
      }).join('');
      var left = unansweredCount(st);
      countEl.textContent = 'Отговорени: ' + (qs.length - left) + ' от ' + qs.length;
    }

    function setAnswer(qid, value) {
      if (st.result) return;
      st.answers[qid] = value;
      save(st);
      renderNav();
    }

    function show(i, focus) {
      st.current = Math.max(0, Math.min(qs.length - 1, i));
      save(st);
      plots.forEach(function (p) { p.destroy(); });
      plots = [];
      renderNav();
      renderQuestion(qEl, qs[st.current], st, setAnswer);
      document.getElementById('test-prev').disabled = st.current === 0;
      document.getElementById('test-next').disabled = st.current === qs.length - 1;
      if (focus) document.getElementById('test-q-title').focus();
    }

    navEl.addEventListener('click', function (e) {
      var b = e.target.closest('.test-nav-btn');
      if (b) show(Number(b.getAttribute('data-i')), true);
    });
    document.getElementById('test-prev').addEventListener('click', function () { show(st.current - 1, true); });
    document.getElementById('test-next').addEventListener('click', function () { show(st.current + 1, true); });

    /* ------------------------------------------------- предаване */
    var dlg = document.getElementById('test-dialog');
    function finish(auto) {
      if (dlg.open) dlg.close();
      cleanup();
      submit(st, auto);
      renderResult(view, st);
      window.scrollTo(0, 0);
    }
    document.getElementById('test-submit').addEventListener('click', function () {
      var left = unansweredCount(st);
      document.getElementById('test-dialog-left').textContent = left ?
        'Неотговорени задачи: ' + left + ' от ' + qs.length + '.' : 'Отговорил си на всички задачи.';
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else if (confirm('Сигурен ли си? Няма втори опит.\n' + document.getElementById('test-dialog-left').textContent)) finish(false);
    });
    document.getElementById('test-dialog-ok').addEventListener('click', function () { finish(false); });
    document.getElementById('test-dialog-cancel').addEventListener('click', function () { dlg.close(); });

    /* ------------------------------------------------- таймер */
    if (dur) {
      var timerEl = document.getElementById('test-timer');
      var live = document.getElementById('test-live');
      var warned = {};
      var tick = function () {
        var left = st.startedAt + dur - Date.now();
        timerEl.textContent = 'Остава ' + fmtTime(left);
        timerEl.classList.toggle('is-low', left <= 5 * 60000);
        [5, 1].forEach(function (m) {
          if (left <= m * 60000 && left > (m * 60000 - 2000) && !warned[m]) {
            warned[m] = true;
            live.textContent = m === 1 ? 'Остава 1 минута.' : 'Остават ' + m + ' минути.';
          }
        });
        if (left <= 0) finish(true);
      };
      tick();
      timerId = setInterval(tick, 1000);
    }

    show(st.current || 0, false);
  }

  function dialogHtml() {
    return '<dialog class="test-dialog" id="test-dialog" aria-labelledby="test-dialog-title">' +
      '<h2 id="test-dialog-title">Сигурен ли си? Няма втори опит.</h2>' +
      '<p id="test-dialog-left"></p>' +
      '<p class="test-muted">След предаване отговорите не могат да се променят.</p>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" id="test-dialog-ok" type="button">Да, предай</button>' +
      '<button class="btn btn-ghost" id="test-dialog-cancel" type="button">Назад към теста</button>' +
      '</div></dialog>';
  }

  function renderQuestion(el, q, st, setAnswer) {
    var total = DATA.variants[st.variant].questions.length;
    el.innerHTML =
      '<div class="card-kicker"><span class="n">' + q.n + '</span>Задача ' + q.n + ' от ' + total + ' · ' + q.points + ' т.</div>' +
      '<h2 id="test-q-title" tabindex="-1">' + esc(q.title) + '</h2>' +
      '<p class="q-prompt">' + MathText.rich(q.prompt) + '</p>';

    if (q.given) makePlot(el, q.given, 'Графика на дадената функция f');
    if (q.figure) makePlot(el, q.figure, 'Чертеж: засенчена фигура между параболата и оста Ox');

    var cur = st.answers[q.id];

    if (q.type === 'numeric' || q.type === 'numeric-figure') {
      var wrap = document.createElement('div');
      wrap.className = 'test-answer';
      wrap.innerHTML =
        '<label class="test-label" for="test-ans">Отговор (число)</label>' +
        '<div class="q-input-row">' +
        '<input class="q-input" id="test-ans" type="text" inputmode="text" autocomplete="off" spellcheck="false" aria-describedby="test-ans-hint">' +
        '<button type="button" class="expr-key" data-ins="π" aria-label="Вмъкни π">π</button>' +
        '<button type="button" class="expr-key" data-ins="/" aria-label="Вмъкни дробна черта">/</button>' +
        '</div>' +
        '<p class="test-hint" id="test-ans-hint">Само числото. Пример: 2,5 или 32/3 или π. Дробите се закръглят до 2 знака след десетичната запетая.</p>';
      el.appendChild(wrap);
      var input = wrap.querySelector('input');
      input.value = cur || '';
      input.addEventListener('input', function () { setAnswer(q.id, input.value); });
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-ins]'), function (b) {
        b.addEventListener('click', function () {
          var s = input.selectionStart != null ? input.selectionStart : input.value.length;
          var e2 = input.selectionEnd != null ? input.selectionEnd : input.value.length;
          var ins = b.getAttribute('data-ins');
          input.value = input.value.slice(0, s) + ins + input.value.slice(e2);
          input.focus();
          input.setSelectionRange(s + ins.length, s + ins.length);
          setAnswer(q.id, input.value);
        });
      });
      return;
    }

    /* избираеми: mcq (формули) и mcq-graph (чертежи) */
    var order = Core.optionOrder(st.fn, q.id, q.options.map(function (o) { return o.id; }));
    var byId = {};
    q.options.forEach(function (o) { byId[o.id] = o; });

    var fs = document.createElement('fieldset');
    fs.className = 'test-options' + (q.type === 'mcq-graph' ? ' is-graphs' : '');
    fs.innerHTML = '<legend class="vis-hidden">Изберете един отговор</legend>';
    el.appendChild(fs);

    order.forEach(function (id, pos) {
      var o = byId[id];
      var lab = document.createElement('label');
      lab.className = 'test-opt' + (cur === id ? ' is-selected' : '');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'test-' + q.id;
      radio.value = id;
      radio.checked = cur === id;
      radio.className = 'test-radio';
      lab.appendChild(radio);
      var letter = document.createElement('span');
      letter.className = 'test-letter';
      letter.textContent = LETTERS[pos] + ')';
      lab.appendChild(letter);
      if (o.text) {
        var t = document.createElement('span');
        t.innerHTML = MathText.rich(o.text);
        lab.appendChild(t);
      } else {
        radio.setAttribute('aria-label', 'Графика ' + LETTERS[pos]);
        var pw = document.createElement('span');
        pw.className = 'test-opt-plot';
        lab.appendChild(pw);
        makePlot(pw, o.plot, 'Графика ' + LETTERS[pos]);
      }
      radio.addEventListener('change', function () {
        Array.prototype.forEach.call(fs.querySelectorAll('.test-opt'), function (l) { l.classList.remove('is-selected'); });
        lab.classList.add('is-selected');
        setAnswer(q.id, id);
      });
      fs.appendChild(lab);
    });
  }

  /* ============================================================ оценяване */
  function submit(st, auto) {
    if (st.result) return st.result;
    var points = Core.score(DATA, st.variant, st.answers);
    st.result = {
      points: points,
      grade: Core.gradeFor(points, DATA.scale),
      code: Core.verifyCode(st.fn, st.variant, points, DATA.salt),
      submittedAt: new Date().toISOString(),
      auto: !!auto
    };
    save(st);
    return st.result;
  }

  /* ============================================================= резултат */
  function renderResult(view, st) {
    var r = st.result;
    var when = new Date(r.submittedAt);
    view.innerHTML =
      '<div class="view view-narrow">' + head() +
      '<div class="card test-result">' +
      '<div class="card-kicker">Тестът е предаден' + (r.auto ? ' автоматично (времето изтече)' : '') + '</div>' +
      '<div class="test-grade" aria-label="Оценка ' + r.grade + '">' + r.grade + '</div>' +
      '<div class="test-points">' + r.points + ' / ' + DATA.totalPoints + ' точки</div>' +
      '<dl class="test-sheet">' +
      '<dt>Име</dt><dd>' + esc(fullName(st)) + '</dd>' +
      '<dt>Факултетен номер</dt><dd>' + esc(st.fn) + '</dd>' +
      '<dt>Вариант</dt><dd>' + VL[st.variant] + '</dd>' +
      '<dt>Оценка</dt><dd>' + r.grade + '</dd>' +
      '<dt>Точки</dt><dd>' + r.points + '</dd>' +
      '<dt>Код за проверка</dt><dd class="test-code">' + esc(r.code) + '</dd>' +
      '</dl>' +
      '<div class="step-note test-instr"><strong>Запиши на листа си: име, факултетен номер, вариант, оценка и кода.</strong></div>' +
      '<p class="test-muted test-when">Предаден на ' + when.toLocaleString('bg-BG') + '</p>' +
      '<div class="btn-row test-noprint" style="justify-content:center">' +
      '<button class="btn btn-ghost" type="button" id="test-print">Разпечатай / запази като PDF</button>' +
      '<a class="btn btn-ghost" href="#/" data-nav>Към началото</a>' +
      '</div>' +
      '</div></div>';
    document.getElementById('test-print').addEventListener('click', function () { window.print(); });
  }

  /* ======================================================== преподавател */
  function renderTeacher(view, h) {
    h.renderSidebar({ route: 'teacher' });
    var st = load();
    var stateText = !st ? 'няма започнат тест' :
      st.result ? 'предаден — ' + esc(fullName(st)) + ', ф. н. ' + esc(st.fn) + ', вариант ' + VL[st.variant] +
        ', ' + st.result.points + ' т., оценка ' + st.result.grade + ', код ' + esc(st.result.code) :
      'в процес — ' + esc(fullName(st)) + ', ф. н. ' + esc(st.fn);

    view.innerHTML =
      '<div class="view view-narrow">' +
      '<div class="page-head"><div class="crumb"><span>Режим на преподавателя</span></div>' +
      '<h1>Тест — преподавател</h1>' +
      '<p class="lead">Тази страница не е свързана от менюто. Отваря се само с <code>?teacher=1</code> в адреса.</p></div>' +

      (DATA ? '' : '<div class="card"><p><strong>Липсва data/test.js.</strong> Генерирай го с tools/build-test.js.</p></div>') +

      '<div class="card">' +
      '<h2>Провери лист</h2>' +
      '<form id="t-verify" class="test-form" novalidate>' +
      '<div class="test-field"><label for="tv-fn">Факултетен номер</label><input class="q-input test-input" id="tv-fn" inputmode="numeric" autocomplete="off"></div>' +
      '<div class="test-field"><label for="tv-var">Вариант</label><select class="q-input test-input" id="tv-var"><option value="A">А</option><option value="B">Б</option></select></div>' +
      '<div class="test-field"><label for="tv-pts">Точки</label><input class="q-input test-input" id="tv-pts" inputmode="numeric" autocomplete="off"></div>' +
      '<div class="test-field"><label for="tv-code">Код за проверка</label><input class="q-input test-input test-code" id="tv-code" autocomplete="off" spellcheck="false"></div>' +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">Провери</button></div>' +
      '</form>' +
      '<div id="tv-out" aria-live="polite"></div>' +
      '</div>' +

      '<div class="card">' +
      '<h2>Това устройство</h2>' +
      '<p>Тест видим: <strong>' + (visible() ? 'да' : 'не') + '</strong> · версия: <strong>' + esc(CFG.testVersion || 1) + '</strong>' +
      (DATA ? ' · време: <strong>' + (DATA.durationMinutes ? DATA.durationMinutes + ' мин.' : 'без лимит') + '</strong>' : '') + '</p>' +
      '<p>Състояние: ' + stateText + '</p>' +
      '<div class="btn-row"><button class="btn btn-ghost" type="button" id="t-reset">Нулирай теста на това устройство</button></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="step-note"><strong>Важно:</strong> проверката на кода не е защита срещу технически уверен студент. ' +
      'Приложението работи офлайн и цялата логика (включително солта и хешовете на отговорите) е в браузъра, ' +
      'така че човек с познания може да я разчете. Кодът хваща грешки при преписване и наивни поправки на оценката; ' +
      'основната проверка остават решенията на листа.</div>' +
      '</div>' +
      '</div>';

    document.getElementById('tv-fn').addEventListener('input', function () {
      var v = Core.variantFor(this.value);
      if (v) document.getElementById('tv-var').value = v;
    });
    document.getElementById('t-verify').addEventListener('submit', function (e) {
      e.preventDefault();
      var out = document.getElementById('tv-out');
      if (!DATA) return;
      var fn = val('tv-fn'), variant = document.getElementById('tv-var').value;
      var pts = val('tv-pts'), code = val('tv-code').toUpperCase().replace(/\s+/g, '');
      if (!/^\d+$/.test(fn) || !/^\d+$/.test(pts) || !code) {
        out.innerHTML = '<div class="q-feedback is-visible is-bad">Попълни номер, точки (цяло число) и код.</div>';
        return;
      }
      var ok = Core.verifyCode(fn, variant, Number(pts), DATA.salt) === code;
      var expected = Core.variantFor(fn);
      var notes = [];
      if (expected !== variant) notes.push('За този номер вариантът трябва да е ' + VL[expected] + '.');
      if (ok) notes.push('Оценка по скалата за ' + Number(pts) + ' т.: ' + Core.gradeFor(Number(pts), DATA.scale) + '.');
      out.innerHTML = '<div class="q-feedback is-visible ' + (ok ? 'is-good' : 'is-bad') + '">' +
        '<div class="q-fb-title">' + (ok ? 'Валиден' : 'Невалиден') + '</div>' +
        (notes.length ? '<div>' + notes.map(esc).join(' ') + '</div>' : '') + '</div>';
    });
    document.getElementById('t-reset').addEventListener('click', function () {
      if (!confirm('Да се изтрие ли записаното състояние на теста на това устройство? Следващият студент ще може да започне отначало.')) return;
      clearDevice();
      h.toast('Тестът е нулиран на това устройство');
      renderTeacher(view, h);
    });
  }

  window.TestSection = {
    route: route,
    cardHtml: cardHtml,
    visible: visible
  };
})();
