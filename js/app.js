/* ============================================================================
 * app.js — рутиране, изобразяване на страниците и логика на въпросите
 * ========================================================================== */
(function () {
  'use strict';

  var SECTIONS = [window.SECTION_FUNCTIONS, window.SECTION_DERIVATIVES];
  var LEVEL_NAMES = { 1: 'Начинаещи', 2: 'Средно ниво', 3: 'Напреднали' };
  var STEP_LABELS = { worked: 'Разработен пример', explore: 'Разучи сам', practice: 'Практика', quiz: 'Самопроверка' };

  function getSection(sid) { return SECTIONS.filter(function (s) { return s.id === sid; })[0]; }
  function getSubtopic(section, subId) { return section.subtopics.filter(function (s) { return s.id === subId; })[0]; }
  function getLevel(subtopic, lvl) { return subtopic.levels.filter(function (l) { return l.level === Number(lvl); })[0]; }

  var activePlots = [];
  function mountPlot(container, spec) {
    var host = document.createElement('div');
    container.appendChild(host);
    var p = Plot.create(host, spec);
    activePlots.push(p);
    return p;
  }
  function clearPlots() {
    activePlots.forEach(function (p) { p.destroy(); });
    activePlots = [];
  }

  /* ------------------------------------------------------------- shell */
  var view = document.getElementById('view');
  var sidebarEl = document.getElementById('sidebar');
  var sidebarOverlay = document.getElementById('sidebar-overlay');

  function closeSidebar() {
    sidebarEl.classList.remove('is-open');
    sidebarOverlay.classList.remove('is-open');
  }
  document.getElementById('menu-btn').addEventListener('click', function () {
    sidebarEl.classList.toggle('is-open');
    sidebarOverlay.classList.toggle('is-open');
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  /* ------------------------------------------------------------- theme */
  var THEME_KEY = 'ui_theme';
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    var btn = document.getElementById('theme-btn');
    if (btn) btn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon;
  }
  var ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/></svg>'
  };
  (function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved || null);
  })();
  document.getElementById('theme-btn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var next;
    if (!cur) next = mq ? 'light' : 'dark';
    else next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  /* --------------------------------------------------------------- toast */
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2600);
  }

  /* --------------------------------------------------------------- misc */
  function pct(section) { return Store.sectionProgress(section).pct; }
  function progressBar(p, size) {
    return '<div class="progress-track"' + (size ? ' style="height:' + size + 'px"' : '') + '>' +
      '<div class="progress-fill" style="width:' + p + '%"></div></div>';
  }
  function svgChev() {
    return '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  }
  function checkIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  }

  /* =========================================================== sidebar */
  function renderSidebar(ctx) {
    var html = '';
    html += '<a class="side-link' + (ctx.route === 'home' ? ' is-active' : '') + '" href="#/" data-nav>' +
      '<span class="dot"></span>Начало</a>';

    html += '<div class="sidebar-section"><div class="sidebar-title">Раздели</div>';
    SECTIONS.forEach(function (sec) {
      var p = pct(sec);
      var active = ctx.sid === sec.id;
      html += '<a class="side-link' + (active && !ctx.subId ? ' is-active' : '') + (p === 100 ? ' is-done' : '') +
        '" href="#/section/' + sec.id + '" data-nav>' +
        '<span class="dot"></span>' + esc(sec.short) +
        '<span class="lvl-badge">' + p + '%</span></a>';
    });
    html += '</div>';

    if (ctx.section && ctx.lvl) {
      html += '<div class="sidebar-section">';
      html += '<a class="sidebar-back" href="#/section/' + ctx.section.id + '/level/' + ctx.lvl + '" data-nav>‹ Ниво ' + ctx.lvl + ': ' + esc(LEVEL_NAMES[ctx.lvl]) + '</a>';
      html += '<div class="sidebar-title">' + esc(ctx.section.short) + ' — подтеми</div>';
      ctx.section.subtopics.forEach(function (st) {
        var lv = getLevel(st, ctx.lvl);
        if (!lv) return;
        var done = Store.isLevelDone(st.id, ctx.lvl);
        var active = ctx.subId === st.id;
        html += '<button class="side-link' + (active ? ' is-active' : '') + (done ? ' is-done' : '') +
          '" data-nav data-href="#/section/' + ctx.section.id + '/level/' + ctx.lvl + '/' + st.id + '">' +
          '<span class="dot"></span>' + esc(st.title) + '</button>';
      });
      html += '</div>';
    }

    html += '<div class="sidebar-section"><a class="side-link" href="#/privacy" data-nav><span class="dot"></span>Данни и поверителност</a></div>';
    sidebarEl.innerHTML = html;
  }

  function esc(s) { return MathText.escape(s == null ? '' : s); }

  /* ============================================================= router */
  function parseHash() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    return h.split('/').filter(Boolean);
  }

  function navigate() {
    closeSidebar();
    clearPlots();
    var parts = parseHash();
    window.scrollTo(0, 0);
    try {
      route(parts);
    } catch (e) {
      console.error(e);
      view.innerHTML = '<div class="view"><div class="card"><h2>Възникна грешка</h2><p>' + esc(e.message) + '</p></div></div>';
    }
  }
  window.addEventListener('hashchange', navigate);

  function route(parts) {
    if (parts.length === 0) return renderHome();
    if (parts[0] === 'privacy') return renderPrivacy();

    if (parts[0] === 'section' && parts[1]) {
      var section = getSection(parts[1]);
      if (!section) return renderHome();
      if (parts[2] === 'diagnostic') return renderDiagnostic(section);
      if (parts[2] === 'level' && parts[3]) {
        var lvl = Number(parts[3]);
        if (parts[4]) return renderLesson(section, lvl, parts[4]);
        return renderLevelOverview(section, lvl);
      }
      return renderSectionHome(section);
    }
    renderHome();
  }

  document.body.addEventListener('click', function (e) {
    var t = e.target.closest('[data-nav]');
    if (!t) return;
    var href = t.getAttribute('data-href') || t.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    location.hash = href.replace(/^#/, '');
    if (location.hash === href) navigate();
  });

  /* =============================================================== home */
  function renderHome() {
    Store.log('page_view', { page: 'home' });
    var last = Store.lastPosition();
    var lastHtml = '';
    if (last && last.hash && last.hash !== '#/') {
      lastHtml = '<div class="btn-row" style="justify-content:center;margin-top:1.4em">' +
        '<a class="btn btn-ghost" href="' + last.hash + '" data-nav>Продължи оттам, докъдето стигна ↦</a></div>';
    }
    view.innerHTML =
      '<div class="view">' +
      '<div class="hero">' +
      '<span class="hero-eyebrow">Висша математика 1</span>' +
      '<h1>Функции и производни</h1>' +
      '<p>Интерактивна платформа за упражнения по теми 11 и 12 — с графики, които можете да изследвате, и стъпка по стъпка обяснения.</p>' +
      lastHtml +
      '</div>' +
      '<div class="section-grid">' +
      SECTIONS.map(sectionCardHtml).join('') +
      '</div>' +
      '<div class="home-note">Напредъкът се пази локално във вашия браузър (localStorage) — не се изисква регистрация. Подробности: <a href="#/privacy" data-nav>данни и поверителност</a>.</div>' +
      '</div>';
    renderSidebar({ route: 'home' });
  }

  function sectionCardHtml(sec) {
    var p = pct(sec);
    return '<a class="section-card" href="#/section/' + sec.id + '" data-nav>' +
      (p > 0 ? '<span class="progress-pill">' + p + '%</span>' : '') +
      '<span class="topic-tag">' + esc(sec.topic) + '</span>' +
      '<h2>' + esc(sec.title) + '</h2>' +
      '<p>' + esc(sec.lead) + '</p>' +
      '<span class="cta">Започни ' + svgChev() + '</span>' +
      '</a>';
  }

  /* ======================================================= section home */
  function renderSectionHome(section) {
    Store.log('page_view', { page: 'section', section: section.id });
    Store.savePosition('#/section/' + section.id);
    var diag = Store.getDiagnostic(section.id);
    var prog = Store.sectionProgress(section);

    var body = '<div class="card">';
    if (!diag) {
      body += '<div class="card-kicker">Входящ тест</div>' +
        '<h2>Преди да започнете</h2>' +
        '<p>' + esc(section.diagnostic.intro) + '</p>' +
        '<div class="btn-row">' +
        '<a class="btn btn-primary" href="#/section/' + section.id + '/diagnostic" data-nav>Направи входящия тест</a>' +
        '<button class="btn-text" id="skip-diag">Пропусни, ще избера ниво сам →</button>' +
        '</div></div>';
    } else {
      body += '<div class="card-kicker">Входящ тест — резултат</div>' +
        '<h2>Препоръчано ниво: ' + diag.recommended + ' · ' + esc(LEVEL_NAMES[diag.recommended]) + '</h2>' +
        '<p>Отговорихте вярно на ' + diag.score + ' от 3 въпроса. Можете да продължите с препоръчаното ниво или да изберете друго отдолу.</p>' +
        '<button class="subtle-btn" id="retake-diag">Направи теста отново</button>' +
        '</div>';
    }
    body += '<div class="level-grid">';
    [1, 2, 3].forEach(function (lvl) {
      var lp = Store.levelProgress(section, lvl);
      var rec = diag && diag.recommended === lvl;
      body += '<a class="level-card' + (lp.done === lp.total && lp.total ? ' is-done' : '') + '" href="#/section/' + section.id + '/level/' + lvl + '" data-nav>' +
        '<span class="lv-num">' + (lp.done === lp.total && lp.total ? checkIcon() : lvl) + '</span>' +
        '<span class="level-card-body"><h3>Ниво ' + lvl + ' · ' + esc(LEVEL_NAMES[lvl]) + '</h3>' +
        '<p>' + lp.done + ' от ' + lp.total + ' подтеми завършени</p></span>' +
        (rec ? '<span class="badge-rec">препоръчано</span>' : '') + svgChev() +
        '</a>';
    });
    body += '</div>';

    view.innerHTML =
      '<div class="view">' +
      '<div class="page-head">' +
      '<div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span><span>' + esc(section.short) + '</span></div>' +
      '<span class="topic-tag" style="color:var(--ink-faint);font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase">' + esc(section.topic) + '</span>' +
      '<h1>' + esc(section.title) + '</h1>' +
      '<p class="lead">' + esc(section.description) + '</p>' +
      '<div class="progress-row"><span>' + prog.pct + '% завършено</span>' + progressBar(prog.pct) + '</div>' +
      '</div>' + body +
      '</div>';
    renderSidebar({ route: 'section', sid: section.id, section: section });

    var skip = document.getElementById('skip-diag');
    if (skip) skip.addEventListener('click', function () { document.querySelector('.level-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    var retake = document.getElementById('retake-diag');
    if (retake) retake.addEventListener('click', function () { location.hash = '/section/' + section.id + '/diagnostic'; });
  }

  /* ========================================================= diagnostic */
  function renderDiagnostic(section) {
    Store.log('diagnostic_start', { section: section.id });
    var qs = section.diagnostic.questions;
    var idx = 0, correctCount = 0, answers = [];

    function renderQuestion() {
      var q = qs[idx];
      var progHtml = '<div class="diag-progress">' + qs.map(function (_, i) {
        return '<span class="' + (i < idx ? 'is-done' : i === idx ? 'is-active' : '') + '"></span>';
      }).join('') + '</div>';

      view.innerHTML =
        '<div class="view view-narrow">' +
        '<div class="page-head"><div class="crumb"><a href="#/section/' + section.id + '" data-nav>' + esc(section.short) + '</a><span>›</span><span>Входящ тест</span></div>' +
        '<h1>Въпрос ' + (idx + 1) + ' от ' + qs.length + '</h1></div>' +
        progHtml +
        '<div class="card" id="diag-card"></div>' +
        '</div>';
      renderSidebar({ route: 'diagnostic', sid: section.id, section: section });

      var card = document.getElementById('diag-card');
      var plotHost = document.createElement('div');
      card.appendChild(plotHost);
      var prompt = document.createElement('p');
      prompt.className = 'q-prompt';
      prompt.innerHTML = MathText.rich(q.q);
      card.appendChild(prompt);
      if (q.plot) mountPlot(plotHost, q.plot);

      var opts = document.createElement('div');
      opts.className = 'q-options';
      card.appendChild(opts);
      var fb = document.createElement('div');
      fb.className = 'q-feedback';
      fb.setAttribute('aria-live', 'polite');
      card.appendChild(fb);
      var nextBtn = document.createElement('div');
      nextBtn.className = 'btn-row';
      card.appendChild(nextBtn);

      var answered = false;
      q.options.forEach(function (optText, i) {
        var b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = '<span class="opt-mark"></span><span>' + MathText.rich(optText) + '</span>';
        b.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var correct = i === q.correct;
          if (correct) correctCount++;
          answers.push({ q: idx, correct: correct, choice: i });
          Array.prototype.forEach.call(opts.children, function (child, ci) {
            child.disabled = true;
            if (ci === q.correct) child.classList.add('is-correct');
            else if (ci === i) child.classList.add('is-wrong');
          });
          fb.className = 'q-feedback is-visible ' + (correct ? 'is-good' : 'is-bad');
          fb.innerHTML = '<div class="q-fb-title">' + (correct ? 'Вярно' : 'Не съвсем') + '</div>' +
            '<div>' + MathText.rich(q.why[i]) + '</div>';
          var nb = document.createElement('button');
          nb.className = 'btn btn-primary';
          nb.textContent = idx < qs.length - 1 ? 'Следващ въпрос' : 'Виж резултата';
          nb.addEventListener('click', function () {
            idx++;
            if (idx < qs.length) renderQuestion(); else finish();
          });
          nextBtn.appendChild(nb);
        });
        opts.appendChild(b);
      });
    }

    function finish() {
      var recommended = correctCount >= 3 ? 3 : correctCount === 2 ? 2 : 1;
      Store.setDiagnostic(section.id, { score: correctCount, recommended: recommended, answers: answers, at: new Date().toISOString() });
      view.innerHTML =
        '<div class="view view-narrow">' +
        '<div class="card diag-result">' +
        '<div class="score">' + correctCount + ' / ' + qs.length + '</div>' +
        '<p>верни отговора</p>' +
        '<div class="rec"><span class="rec-badge">Препоръчано: Ниво ' + recommended + ' · ' + esc(LEVEL_NAMES[recommended]) + '</span></div>' +
        '<div class="btn-row" style="justify-content:center">' +
        '<a class="btn btn-primary" href="#/section/' + section.id + '/level/' + recommended + '" data-nav>Продължи с препоръчаното ниво</a>' +
        '<a class="btn btn-ghost" href="#/section/' + section.id + '" data-nav>Избери друго ниво</a>' +
        '</div></div></div>';
      renderSidebar({ route: 'diagnostic', sid: section.id, section: section });
    }

    renderQuestion();
  }

  /* =================================================== level overview */
  function renderLevelOverview(section, lvl) {
    Store.log('page_view', { page: 'level', section: section.id, level: lvl });
    Store.savePosition('#/section/' + section.id + '/level/' + lvl);
    var lp = Store.levelProgress(section, lvl);
    var firstIncomplete = null;
    section.subtopics.forEach(function (st) {
      var lv = getLevel(st, lvl);
      if (lv && !firstIncomplete && !Store.isLevelDone(st.id, lvl)) firstIncomplete = st.id;
    });
    if (!firstIncomplete && section.subtopics.length) {
      var firstWithLevel = section.subtopics.filter(function (st) { return getLevel(st, lvl); })[0];
      firstIncomplete = firstWithLevel ? firstWithLevel.id : null;
    }

    var cards = section.subtopics.map(function (st) {
      var lv = getLevel(st, lvl);
      if (!lv) return '';
      var done = Store.isLevelDone(st.id, lvl);
      return '<a class="level-card' + (done ? ' is-done' : '') + '" href="#/section/' + section.id + '/level/' + lvl + '/' + st.id + '" data-nav>' +
        '<span class="lv-num">' + (done ? checkIcon() : '') + '</span>' +
        '<span class="level-card-body"><h3>' + esc(st.title) + '</h3><p>' + esc(st.lead) + '</p></span>' +
        svgChev() + '</a>';
    }).join('');

    view.innerHTML =
      '<div class="view">' +
      '<div class="page-head">' +
      '<div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span><a href="#/section/' + section.id + '" data-nav>' + esc(section.short) + '</a><span>›</span><span>Ниво ' + lvl + '</span></div>' +
      '<h1>Ниво ' + lvl + ' · ' + esc(LEVEL_NAMES[lvl]) + '</h1>' +
      '<p class="lead">' + esc(section.title) + ' — изберете подтема или продължете оттам, докъдето сте стигнали.</p>' +
      '<div class="progress-row"><span>' + lp.done + ' / ' + lp.total + '</span>' + progressBar(lp.total ? Math.round(lp.done * 100 / lp.total) : 0) + '</div>' +
      (firstIncomplete ? '<div class="btn-row"><a class="btn btn-primary" href="#/section/' + section.id + '/level/' + lvl + '/' + firstIncomplete + '" data-nav>' + (lp.done ? 'Продължи' : 'Започни') + '</a></div>' : '') +
      '</div>' +
      '<div class="level-grid">' + cards + '</div>' +
      '</div>';
    renderSidebar({ route: 'level', sid: section.id, section: section, lvl: lvl });
  }

  /* ============================================================= lesson */
  function renderLesson(section, lvl, subId) {
    var subtopic = getSubtopic(section, subId);
    if (!subtopic) return renderLevelOverview(section, lvl);
    var level = getLevel(subtopic, lvl);
    if (!level) return renderLevelOverview(section, lvl);

    Store.log('page_view', { page: 'lesson', section: section.id, level: lvl, subtopic: subId });
    Store.savePosition('#/section/' + section.id + '/level/' + lvl + '/' + subId);

    var idxInLevel = section.subtopics.filter(function (st) { return getLevel(st, lvl); }).map(function (st) { return st.id; });
    var pos = idxInLevel.indexOf(subId);

    view.innerHTML =
      '<div class="view">' +
      '<div class="page-head">' +
      '<div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span>' +
      '<a href="#/section/' + section.id + '" data-nav>' + esc(section.short) + '</a><span>›</span>' +
      '<a href="#/section/' + section.id + '/level/' + lvl + '" data-nav>Ниво ' + lvl + '</a><span>›</span>' +
      '<span>' + esc(subtopic.title) + '</span></div>' +
      '<h1>' + esc(subtopic.title) + '</h1>' +
      '<p class="lead">' + esc(level.goal) + '</p>' +
      '<div class="progress-row"><span>Подтема ' + (pos + 1) + ' от ' + idxInLevel.length + '</span></div>' +
      '</div>' +
      '<div id="lesson-cards"></div>' +
      '<div id="lesson-end"></div>' +
      '</div>';
    renderSidebar({ route: 'lesson', sid: section.id, section: section, lvl: lvl, subId: subId });

    var cards = document.getElementById('lesson-cards');
    var n = 0;

    if (level.worked) renderWorkedCard(cards, level.worked, ++n);
    if (level.explore) renderExploreCard(cards, level.explore, ++n);
    if (level.bridge) renderBridgeCard(cards, level.bridge, ++n);

    var quizScoreRef = { correct: 0, total: 0, allAnswered: false };
    if (level.practice && level.practice.length) {
      renderProblemSetCard(cards, 'Практика', level.practice, ++n, 'practice', null);
    }
    if (level.quiz && level.quiz.length) {
      renderProblemSetCard(cards, 'Самопроверка', level.quiz, ++n, 'quiz', function (state) {
        checkQuizFinish(state, section, lvl, subtopic, idxInLevel, pos);
      });
    }

    if (!level.quiz || !level.quiz.length) {
      renderStepNav(section, lvl, idxInLevel, pos);
    }
  }

  function checkQuizFinish(state, section, lvl, subtopic, idxInLevel, pos) {
    var container = document.getElementById('lesson-end');
    var allAnswered = state.every(function (s) { return s.answered; });
    if (!allAnswered) { container.innerHTML = ''; return; }
    var scorable = state.filter(function (s) { return s.scorable; });
    var correct = scorable.filter(function (s) { return s.correct; }).length;

    if (container.dataset.done === '1') return;
    container.dataset.done = '1';
    var already = Store.isLevelDone(subtopic.id, lvl);
    if (!already) Store.markLevelDone(subtopic.id, lvl, scorable.length ? correct / scorable.length : null);

    var pctScore = scorable.length ? Math.round(correct / scorable.length * 100) : null;
    var lp = Store.levelProgress(section, lvl);
    var levelFullyDone = lp.done === lp.total;

    var html = '<div class="card complete-banner">' +
      '<div class="mark">' + checkIcon() + '</div>' +
      '<h2>Подтемата е завършена' + (pctScore !== null ? ' · ' + pctScore + '% верни' : '') + '</h2>' +
      '<p>' + (levelFullyDone ? 'Поздравления — завършихте цяло Ниво ' + lvl + ' по „' + esc(section.short) + '“!' : 'Продължавайте със следващата подтема, когато сте готови.') + '</p>' +
      '<div class="btn-row" style="justify-content:center">';
    var nextId = idxInLevel[pos + 1];
    if (nextId) {
      html += '<a class="btn btn-primary" href="#/section/' + section.id + '/level/' + lvl + '/' + nextId + '" data-nav>Следваща подтема ' + svgChev() + '</a>';
    } else {
      html += '<a class="btn btn-primary" href="#/section/' + section.id + '" data-nav>Обратно към раздела</a>';
    }
    html += '<a class="btn btn-ghost" href="#/section/' + section.id + '/level/' + lvl + '" data-nav>Преглед на нивото</a>' +
      '</div></div>';
    container.innerHTML = html;
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Напредъкът е записан');
  }

  function renderStepNav(section, lvl, idxInLevel, pos) {
    var container = document.getElementById('lesson-end');
    var nextId = idxInLevel[pos + 1];
    var html = '<div class="step-nav">' +
      '<a class="btn btn-ghost" href="#/section/' + section.id + '/level/' + lvl + '" data-nav>‹ Преглед на нивото</a>';
    if (nextId) html += '<a class="btn btn-primary" href="#/section/' + section.id + '/level/' + lvl + '/' + nextId + '" data-nav>Следваща подтема ' + svgChev() + '</a>';
    html += '</div>';
    container.innerHTML = html;
  }

  /* ---------------------------------------------------------- worked */
  function renderWorkedCard(container, worked, n) {
    var card = document.createElement('div');
    card.className = 'card';
    container.appendChild(card);
    var stepsHtml = worked.steps.map(function (s) {
      var out = '<div class="step-item">';
      if (s.text) out += '<p>' + MathText.rich(s.text) + '</p>';
      out += '</div>';
      return out;
    }).join('');
    card.innerHTML =
      '<div class="card-kicker"><span class="n">' + n + '</span>' + STEP_LABELS.worked + '</div>' +
      '<h2>' + MathText.rich(worked.title) + '</h2>' +
      '<div class="step-list">' + stepsHtml + '</div>';
    /* математиката се вмъква отделно, за да не мине low-level escaping два пъти */
    var stepItems = card.querySelectorAll('.step-item');
    worked.steps.forEach(function (s, i) {
      if (s.math) {
        var d = document.createElement('div');
        d.innerHTML = MathText.block(s.math);
        stepItems[i].appendChild(d.firstChild);
      }
    });
    if (worked.figure) {
      var figWrap = document.createElement('div');
      card.appendChild(figWrap);
      mountPlot(figWrap, worked.figure);
    }
    if (worked.note) {
      var note = document.createElement('div');
      note.className = 'step-note';
      note.innerHTML = MathText.rich(worked.note);
      card.appendChild(note);
    }
    return card;
  }

  /* --------------------------------------------------------- explore */
  function renderExploreCard(container, explore, n) {
    var card = document.createElement('div');
    card.className = 'card';
    container.appendChild(card);
    var tasksHtml = explore.tasks ? '<ul style="margin:.6em 0 0;padding-left:1.3em">' +
      explore.tasks.map(function (t) { return '<li style="margin-bottom:.35em">' + MathText.rich(t) + '</li>'; }).join('') + '</ul>' : '';
    card.innerHTML =
      '<div class="card-kicker"><span class="n">' + n + '</span>' + STEP_LABELS.explore + '</div>' +
      '<p>' + MathText.rich(explore.prompt) + '</p>' + tasksHtml;
    var plotWrap = document.createElement('div');
    card.appendChild(plotWrap);
    if (explore.plot) mountPlot(plotWrap, explore.plot);

    if (explore.hint) {
      var hbtn = document.createElement('button');
      hbtn.className = 'q-hint-btn';
      hbtn.textContent = 'Покажи насока';
      var hbox = document.createElement('div');
      hbox.className = 'q-hint-box';
      hbox.style.display = 'none';
      hbtn.addEventListener('click', function () {
        var show = hbox.style.display === 'none';
        hbox.style.display = show ? 'block' : 'none';
        hbtn.textContent = show ? 'Скрий насоката' : 'Покажи насока';
      });
      hbox.innerHTML = MathText.rich(explore.hint);
      card.appendChild(hbtn);
      card.appendChild(hbox);
    }
    if (explore.geogebra) card.appendChild(GeoGebra.lazyBlock(explore.geogebra));
    if (explore.link) card.appendChild(GeoGebra.linkBlock(explore.link));
    return card;
  }

  function renderBridgeCard(container, bridge, n) {
    var card = document.createElement('div');
    card.className = 'card';
    container.appendChild(card);
    card.innerHTML =
      '<div class="card-kicker"><span class="n">' + n + '</span>Връзка f → f′</div>' +
      '<h2>' + MathText.rich(bridge.title) + '</h2>' +
      '<p>' + MathText.rich(bridge.text) + '</p>';
    var plotWrap = document.createElement('div');
    card.appendChild(plotWrap);
    if (bridge.plot) mountPlot(plotWrap, bridge.plot);
    return card;
  }

  /* ------------------------------------------------------ problem sets */
  function renderProblemSetCard(container, label, problems, n, mode, onChange) {
    var card = document.createElement('div');
    card.className = 'card';
    container.appendChild(card);
    card.innerHTML = '<div class="card-kicker"><span class="n">' + n + '</span>' + esc(label) + '</div>';
    var state = problems.map(function () { return { answered: false, correct: false, scorable: true }; });

    problems.forEach(function (q, i) {
      var st = state[i];
      st.scorable = q.type !== 'text';
      buildQuestion(card, q, mode, function (result) {
        st.answered = true;
        st.correct = !!result.correct;
        if (onChange) onChange(state);
      });
    });
    return card;
  }

  /* ---------------------------------------------------- question builder */
  function buildQuestion(container, q, mode, onAnswer) {
    var wrap = document.createElement('div');
    wrap.className = 'q-block';
    container.appendChild(wrap);

    if (q.plot) {
      var plotWrap = document.createElement('div');
      wrap.appendChild(plotWrap);
      mountPlot(plotWrap, q.plot);
    }
    var prompt = document.createElement('p');
    prompt.className = 'q-prompt';
    prompt.innerHTML = MathText.rich(q.q);
    wrap.appendChild(prompt);

    var body = document.createElement('div');
    wrap.appendChild(body);
    var fb = document.createElement('div');
    fb.className = 'q-feedback';
    fb.setAttribute('aria-live', 'polite');

    var hintEl = null;
    if (q.hint) {
      hintEl = document.createElement('button');
      hintEl.className = 'q-hint-btn';
      hintEl.textContent = 'Насока';
      var hbox = document.createElement('div');
      hbox.className = 'q-hint-box';
      hbox.style.display = 'none';
      hbox.innerHTML = MathText.rich(q.hint);
      hintEl.addEventListener('click', function () {
        var show = hbox.style.display === 'none';
        hbox.style.display = show ? 'block' : 'none';
        hintEl.textContent = show ? 'Скрий насоката' : 'Насока';
      });
      wrap.appendChild(hintEl);
      wrap.appendChild(hbox);
    }
    wrap.appendChild(fb);

    function showFeedback(correct, message) {
      fb.className = 'q-feedback is-visible ' + (correct ? 'is-good' : 'is-bad');
      var title = correct ? 'Вярно' : 'Не съвсем';
      fb.innerHTML = '<div class="q-fb-title">' + title + '</div><div>' + message + '</div>';
    }

    if (q.type === 'mc') {
      var opts = document.createElement('div');
      opts.className = 'q-options';
      var answered = false;
      q.options.forEach(function (optText, i) {
        var b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = '<span class="opt-mark"></span><span>' + MathText.rich(optText) + '</span>';
        b.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var correct = i === q.correct;
          Array.prototype.forEach.call(opts.children, function (child, ci) {
            child.disabled = true;
            if (ci === q.correct) child.classList.add('is-correct');
            else if (ci === i) child.classList.add('is-wrong');
          });
          var msg = MathText.rich(q.why ? q.why[i] : '') +
            (q.solution ? '<div class="q-solution">' + MathText.rich(q.solution) + '</div>' : '');
          showFeedback(correct, msg);
          onAnswer({ correct: correct });
        });
        opts.appendChild(b);
      });
      body.appendChild(opts);

    } else if (q.type === 'numeric' || q.type === 'expr') {
      var row = document.createElement('div');
      row.className = 'q-input-row';
      var input = document.createElement('input');
      input.className = 'q-input';
      input.type = 'text';
      input.inputMode = q.type === 'numeric' ? 'decimal' : 'text';
      input.placeholder = q.type === 'numeric' ? 'число…' : 'израз с x…';
      input.setAttribute('aria-label', 'Отговор');
      var btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm';
      btn.textContent = 'Провери';
      row.appendChild(input); row.appendChild(btn);
      body.appendChild(row);

      function check() {
        var val = input.value.trim();
        if (!val) return;
        var correct;
        if (q.type === 'numeric') {
          var num = Expr.parseNumber(val);
          var tol = q.tol !== undefined ? q.tol : 0.01;
          correct = isFinite(num) && Math.abs(num - q.answer) <= Math.max(tol, Math.abs(q.answer) * 0.005);
        } else {
          var candidates = [q.answer].concat(q.alt || []);
          correct = candidates.some(function (ans) {
            return Expr.equivalent(val, ans, { min: (q.range && q.range[0]), max: (q.range && q.range[1]) });
          });
        }
        input.classList.remove('is-correct', 'is-wrong');
        input.classList.add(correct ? 'is-correct' : 'is-wrong');
        input.disabled = true; btn.disabled = true;
        var msg = (q.solution ? MathText.rich(q.solution) : '');
        showFeedback(correct, msg || (correct ? 'Точно така.' : 'Виж решението по-долу.'));
        onAnswer({ correct: correct });
        var retry = document.createElement('button');
        retry.className = 'subtle-btn';
        retry.style.marginLeft = '.6em';
        retry.textContent = 'Опитай отново';
        retry.addEventListener('click', function () {
          input.disabled = false; btn.disabled = false;
          input.classList.remove('is-correct', 'is-wrong');
          input.value = ''; input.focus();
          fb.classList.remove('is-visible');
          retry.remove();
        });
        row.appendChild(retry);
      }
      btn.addEventListener('click', check);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });

    } else if (q.type === 'text') {
      var ta = document.createElement('textarea');
      ta.className = 'q-textarea';
      ta.placeholder = 'Напишете обяснението си тук…';
      ta.setAttribute('aria-label', 'Отговор');
      body.appendChild(ta);
      var tbtn = document.createElement('button');
      tbtn.className = 'btn btn-primary btn-sm';
      tbtn.style.marginTop = '.6em';
      tbtn.textContent = 'Провери';
      body.appendChild(tbtn);
      tbtn.addEventListener('click', function () {
        var text = ta.value.trim().toLowerCase();
        var groups = q.keywords || [];
        var need = q.need || groups.length;
        var matched = groups.filter(function (alts) {
          return alts.some(function (a) { return text.indexOf(a.toLowerCase()) >= 0; });
        }).length;
        var correct = text.length > 0 && matched >= need;
        ta.disabled = true; tbtn.disabled = true;
        var msg = (q.solution ? '<div>' + MathText.rich(q.solution) + '</div>' : '');
        fb.className = 'q-feedback is-visible ' + (correct ? 'is-good' : 'is-bad');
        fb.innerHTML = '<div class="q-fb-title">' + (correct ? 'Добре обяснено' : 'Ето и пълното обяснение') + '</div>' + msg;
        onAnswer({ correct: correct });
      });

    } else if (q.type === 'point') {
      var note = document.createElement('p');
      note.style.cssText = 'font-size:13px;color:var(--ink-faint);margin-top:-.4em';
      note.textContent = 'Щракнете (или докоснете) върху графиката.';
      body.appendChild(note);
      var confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-primary btn-sm';
      confirmBtn.textContent = 'Провери избора';
      confirmBtn.disabled = true;
      body.appendChild(confirmBtn);

      var plotInstance = activePlots[activePlots.length - 1];
      var origPick = q.plot.pick;
      q.plot.pick = function (x) { confirmBtn.disabled = false; confirmBtn.dataset.x = x; };

      confirmBtn.addEventListener('click', function () {
        var x = parseFloat(confirmBtn.dataset.x);
        var ok = false;
        var c = q.check || {};
        if (c.value !== undefined) ok = Math.abs(x - c.value) <= (c.tol === undefined ? 0.3 : c.tol);
        else if (c.min !== undefined || c.max !== undefined) {
          ok = (c.min === undefined || x >= c.min) && (c.max === undefined || x <= c.max);
        }
        confirmBtn.disabled = true;
        var msg = (q.solution ? MathText.rich(q.solution) : '');
        showFeedback(ok, msg);
        onAnswer({ correct: ok });
      });
    }

    return wrap;
  }

  /* ============================================================= privacy */
  function renderPrivacy() {
    Store.log('page_view', { page: 'privacy' });
    view.innerHTML =
      '<div class="view view-narrow privacy-view">' +
      '<div class="page-head"><div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span><span>Данни и поверителност</span></div>' +
      '<h1>Данни и поверителност</h1></div>' +
      '<div class="card">' +
      '<h2>Какво се пази</h2>' +
      '<p>Приложението не изисква регистрация. Напредъкът ви (резултати от входящите тестове, завършени нива, отговори на въпроси) се пази <strong>локално в браузъра ви</strong> чрез localStorage — не напуска устройството ви, освен ако преподавателят изрично не включи изпращане на статистика (в момента изключено).</p>' +
      '<ul>' +
      '<li>Анонимен идентификатор, генериран на това устройство</li>' +
      '<li>Резултати от входящите тестове и завършени нива</li>' +
      '<li>Журнал на действията (за подобряване на приложението)</li>' +
      '</ul>' +
      '<h2>Управление на вашите данни</h2>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost" id="export-btn">Изтегли моите данни (JSON)</button>' +
      '<button class="btn btn-ghost" id="reset-btn">Изтрий напредъка</button>' +
      '</div>' +
      '</div></div>';
    renderSidebar({ route: 'privacy' });
    document.getElementById('export-btn').addEventListener('click', function () { Store.downloadExport(); });
    document.getElementById('reset-btn').addEventListener('click', function () {
      if (confirm('Сигурни ли сте? Целият локален напредък ще бъде изтрит безвъзвратно.')) {
        Store.reset();
        toast('Напредъкът е изтрит');
        location.hash = '/';
      }
    });
  }

  /* ================================================================ init */
  navigate();
})();
