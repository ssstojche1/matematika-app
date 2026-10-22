/* ============================================================================
 * app.js — рутиране, изобразяване на страниците и логика на въпросите
 * ========================================================================== */
(function () {
  'use strict';

  /* Скрито съдържание ("hidden": true на подтема, ниво или задача) остава в
     данните, но не се показва и не влиза в процентите — така може да се
     върне само с премахване на флага. */
  function visibleOnly(section) {
    var keep = function (x) { return x && !x.hidden; };
    return Object.assign({}, section, {
      subtopics: section.subtopics.filter(keep).map(function (st) {
        return Object.assign({}, st, {
          levels: st.levels.filter(keep).map(function (lv) {
            return Object.assign({}, lv, {
              practice: lv.practice && lv.practice.filter(keep),
              quiz: lv.quiz && lv.quiz.filter(keep)
            });
          })
        });
      }).filter(function (st) { return st.levels.length; })
    });
  }
  var SECTIONS = [window.SECTION_FUNCTIONS, window.SECTION_DERIVATIVES, window.SECTION_INTEGRALS].filter(Boolean).map(visibleOnly);
  var LEVEL_NAMES = { 1: 'Начинаещи', 2: 'Средно ниво', 3: 'Напреднали' };
  var STEP_LABELS = { worked: 'Разработен пример', explore: 'Разучи сам', practice: 'Практика', quiz: 'Самопроверка' };

  function getSection(sid) { return SECTIONS.filter(function (s) { return s.id === sid; })[0]; }
  function getSubtopic(section, subId) { return section.subtopics.filter(function (s) { return s.id === subId; })[0]; }
  function getLevel(subtopic, lvl) { return subtopic.levels.filter(function (l) { return l.level === Number(lvl); })[0]; }
  /* заглавие и описание на подтемата за конкретно ниво (ако нивото ги задава) */
  function subTitle(st, lvl) { var lv = lvl && getLevel(st, lvl); return (lv && lv.title) || st.title; }
  function subLead(st, lvl) { var lv = lvl && getLevel(st, lvl); return (lv && lv.lead) || st.lead; }

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
    syncColorScheme();
  }
  /* мета color-scheme следва действащата тема: при светла е „only light“, за да
     не я затъмнява браузърът сам (виж css/styles.css) */
  var darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function syncColorScheme() {
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) return;
    var t = document.documentElement.getAttribute('data-theme');
    var dark = t ? t === 'dark' : !!(darkMQ && darkMQ.matches);
    meta.setAttribute('content', dark ? 'dark' : 'only light');
  }
  if (darkMQ) {
    if (darkMQ.addEventListener) darkMQ.addEventListener('change', syncColorScheme);
    else if (darkMQ.addListener) darkMQ.addListener(syncColorScheme);
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
      html += '<a class="sidebar-back" href="#/section/' + ctx.section.id + '" data-nav>‹ Нива — ' + esc(ctx.section.short) + '</a>';
      html += '<div class="sidebar-title">' + esc(ctx.section.short) + ' — подтеми</div>';
      ctx.section.subtopics.forEach(function (st) {
        var lv = getLevel(st, ctx.lvl);
        if (!lv) return;
        var done = Store.isLevelDone(st.id, ctx.lvl);
        var active = ctx.subId === st.id;
        html += '<button class="side-link' + (active ? ' is-active' : '') + (done ? ' is-done' : '') +
          '" data-nav data-href="#/section/' + ctx.section.id + '/level/' + ctx.lvl + '/' + st.id + '">' +
          '<span class="dot"></span>' + esc(subTitle(st, ctx.lvl)) + '</button>';
      });
      html += '</div>';
    }

    html += '<div class="sidebar-section"><a class="side-link" href="#/privacy" data-nav><span class="dot"></span>Данни и поверителност</a></div>';
    sidebarEl.innerHTML = html;
  }

  function esc(s) { return MathText.escape(s == null ? '' : s); }

  /* Ред на показване на вариантите при избор от няколко отговора: разбъркан
     при всяко показване, за да не е верният винаги на едно и също място.
     Обобщаващите варианти („нито едно“, „не може да се определи“…) остават
     последни. Връща индексите от q.options — оценяването и q.why[i] ползват
     оригиналния индекс. */
  var CATCH_ALL = /^(в\s+)?нито\s+ед|^никъде|^нищо|^не може|^функцията никъде/i;
  function optionOrder(q) {
    var free = [], last = [];
    q.options.forEach(function (o, i) {
      (CATCH_ALL.test(String(o).replace(/`/g, '')) ? last : free).push(i);
    });
    for (var i = free.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = free[i]; free[i] = free[j]; free[j] = t;
    }
    return free.concat(last);
  }

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
    /* секция „Тест“ и режимът на преподавателя — виж js/test.js */
    if (window.TestSection && TestSection.route(parts, view, { renderSidebar: renderSidebar, toast: toast })) return;
    if (parts.length === 0) return renderHome();
    if (parts[0] === 'privacy') return renderPrivacy();
    if (parts[0] === 'formulas') return renderFormulas();
    if (parts[0] === 'review') return renderReview();
    if (parts[0] === 'quick') return renderQuick();

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
      '<h1>Функции, производни и интеграли</h1>' +
      '<p>Интерактивна платформа за упражнения по функции, производни и интеграли — с графики, които можете да изследвате, и стъпка по стъпка обяснения.</p>' +
      lastHtml +
      '</div>' +
      '<div class="section-grid">' +
      SECTIONS.map(function (sec) {
        return '<div class="section-col">' + sectionCardHtml(sec) + homeLevelsHtml(sec) + '</div>';
      }).join('') +
      (window.TestSection ? TestSection.cardHtml() : '') +
      '</div>' +
      homeToolsHtml() +
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

  /* нивата на раздела с процент завършеност (под картата на темата) */
  function homeLevelsHtml(sec) {
    return '<nav class="home-levels" aria-label="Нива — ' + esc(sec.short) + '">' +
      [1, 2, 3].filter(function (lvl) { return Store.levelProgress(sec, lvl).total; }).map(function (lvl) {
        var lp = Store.levelProgress(sec, lvl);
        var p = lp.total ? Math.round(lp.done * 100 / lp.total) : 0;
        return '<a class="home-level' + (p === 100 ? ' is-done' : '') + '" href="#/section/' + sec.id + '/level/' + lvl + '" data-nav>' +
          '<span class="home-level-name">Ниво ' + lvl + ' · ' + esc(LEVEL_NAMES[lvl]) + '</span>' +
          '<span class="home-level-pct">' + p + '%</span>' + progressBar(p, 5) + '</a>';
      }).join('') + '</nav>';
  }

  function homeToolsHtml() {
    var n = Mistakes.resolve().length;
    return '<div class="home-tools">' +
      '<a class="btn btn-ghost" href="#/quick" data-nav>Бърза задача</a>' +
      '<a class="btn btn-ghost" href="#/formulas" data-nav>Формули</a>' +
      (n ? '<a class="btn btn-ghost" href="#/review" data-nav>Повтори грешните <span class="count-pill">' + n + '</span></a>' : '') +
      '</div>';
  }

  /* ========================================================== формули */
  var FORMULAS = {
    table: [
      ["c' = 0", 'константа'],
      ["(x^n)' = n x^(n-1)", 'степен'],
      ["(sqrt(x))' = 1/(2 sqrt(x))", '`x > 0`'],
      ["(sin x)' = cos x", ''],
      ["(cos x)' = -sin x", ''],
      ["(tg x)' = 1/(cos x)^2", ''],
      ["(e^x)' = e^x", ''],
      ["(a^x)' = a^x ln a", '`a > 0`'],
      ["(ln x)' = 1/x", '`x > 0`']
    ],
    rules: [
      ["(c u)' = c u'", 'постоянен множител'],
      ["(u +- v)' = u' +- v'", 'сбор и разлика'],
      ["(u v)' = u' v + u v'", 'произведение'],
      ["(u/v)' = (u' v - u v')/v^2", 'частно, `v != 0`'],
      ["(f(u))' = f'(u) * u'", 'верижно правило, `u = g(x)`']
    ],
    apps: [
      ["y = f(x_0) + f'(x_0)(x - x_0)", 'допирателна в `x_0`'],
      ["f'(x) > 0", '`f` расте'],
      ["f'(x) < 0", '`f` намалява'],
      ["f'(x_0) = 0, quad f''(x_0) < 0", 'локален максимум в `x_0`'],
      ["f'(x_0) = 0, quad f''(x_0) > 0", 'локален минимум в `x_0`']
    ]
  };

  var INTEGRAL_FORMULAS = {
    table: [
      ["F' = f  =>  int f(x) dx = F(x) + C", 'примитивна и неопределен интеграл'],
      ["int x^n dx = x^(n+1)/(n+1) + C", '`n != -1`'],
      ["int 1/x dx = ln abs(x) + C", '`x != 0`'],
      ["int e^x dx = e^x + C", ''],
      ["int a^x dx = a^x/(ln a) + C", '`a > 0, a != 1`'],
      ["int sin x dx = -cos x + C", ''],
      ["int cos x dx = sin x + C", ''],
      ["int 1/((cos x)^2) dx = tg x + C", ''],
      ["int 1/(x^2 + a^2) dx = 1/a arctg(x/a) + C", '`a > 0`'],
      ["int (c f + g) dx = c int f dx + int g dx", 'постоянен множител и сбор']
    ],
    methods: [
      ["d(a x + b) = a dx, quad int f(a x + b) dx = 1/a F(a x + b) + C", 'константа под диференциала'],
      ["g'(x) dx = d(g(x)), quad int f(g(x)) d(g(x)) = F(g(x)) + C", 'внасяне под знака на диференциала'],
      ["int (g'(x))/(g(x)) dx = ln abs(g(x)) + C", ''],
      ["int u dv = u v - int v du", 'по части'],
      ["1/((x - a)(x - b)) = A/(x - a) + B/(x - b)", 'елементарни дроби, `a != b`']
    ],
    definite: [
      ["int_a^b f(x) dx = F(b) - F(a)", 'формула на Нютон–Лайбниц'],
      ["int_a^b f(g(x)) d(g(x)) = [F(g(x))]_a^b", 'граници по x остават същите'],
      ["int_a^b u dv = [u v]_a^b - int_a^b v du", 'по части'],
      ["(int_a^x f(t) dt)' = f(x)", 'основна теорема'],
      ["int_(-a)^a f(x) dx = 0", '`f` нечетна'],
      ["int_(-a)^a f(x) dx = 2 int_0^a f(x) dx", '`f` четна']
    ],
    apps: [
      ["S = int_a^b abs(f(x)) dx", 'лице между графиката и `Ox`'],
      ["S = int_a^b (f(x) - g(x)) dx", 'лице между две криви, `f >= g`'],
      ["V = pi int_a^b (f(x))^2 dx", 'обем при въртене около `Ox`'],
      ["bar(f) = 1/(b - a) int_a^b f(x) dx", 'средна стойност'],
      ["int_1^oo 1/x^p dx", 'сходящ при `p > 1`, разходящ при `p <= 1`']
    ]
  };

  function formulaTable(caption, rows) {
    return '<div class="formula-scroll"><table class="formula-table"><caption>' + esc(caption) + '</caption><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + MathText.inline(r[0]) + '</td><td>' + MathText.rich(r[1]) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  var LIMIT_FORMULAS = {
    table: [
      ["lim(x->0) (sin x)/x = 1", 'първа забележителна граница'],
      ["lim(x->0) (e^x - 1)/x = 1", ''],
      ["lim(x->0) (ln(1 + x))/x = 1", ''],
      ["lim(x->oo) (1 + 1/x)^x = e", 'число `e`'],
      ["lim(x->oo) 1/x^p = 0", '`p > 0`'],
      ["lim(x->a) f(x) = L  <=>  lim(x->a^-) f(x) = lim(x->a^+) f(x) = L", 'едностранни граници'],
      ["lim(x->a) f(x) = f(a)", 'непрекъснатост в `a`']
    ],
    rational: [
      ["lim(x->oo) (a_n x^n + ... + a_0)/(b_m x^m + ... + b_0) = 0", '`n < m`'],
      ["lim(x->oo) (a_n x^n + ... + a_0)/(b_m x^m + ... + b_0) = a_n/b_m", '`n = m` (хоризонтална асимптота)'],
      ["x^2 - a^2 = (x - a)(x + a)", 'разлагане при неопределеност `0/0`']
    ]
  };

  function formulaSheet(num, title, cards) {
    return '<section class="formula-sheet"><h2 class="sheet-title">Лист ' + num + ' · ' + esc(title) + '</h2>' +
      cards.map(function (c) { return '<div class="card">' + formulaTable(c[0], c[1]) + '</div>'; }).join('') + '</section>';
  }

  /* една страница „Формули“; в печатен вид (PDF) — лист 1: граници и производни, лист 2: интеграли */
  function renderFormulas() {
    Store.log('page_view', { page: 'formulas' });
    view.innerHTML =
      '<div class="view view-narrow formulas-view">' +
      '<div class="page-head"><div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span><span>Формули</span></div>' +
      '<h1>Формули</h1>' +
      '<p class="lead">Граници, производни и интеграли.</p>' +
      '</div>' +
      '<section class="card ref-sheet"><h2 class="sheet-title">Справочник ВМ1</h2>' +
      '<p class="ref-lead">Производни и интеграли, изследване на функция, определен интеграл — на един лист.</p>' +
      '<div class="btn-row"><a class="btn btn-primary btn-sm" href="files/vm1-spravochnik.pdf" download="ВМ1_Справочник.pdf">Свали като PDF</a></div>' +
      '<a href="files/vm1-spravochnik.pdf" target="_blank" rel="noopener"><img class="ref-img" src="files/vm1-spravochnik.png?v=2" alt="Справочник ВМ1 с формули: производни и интеграли, изследване на функция, определен интеграл" loading="lazy"></a></section>' +
      formulaSheet(1, 'Граници и производни', [
        ['Граници', LIMIT_FORMULAS.table],
        ['Граници на рационални функции', LIMIT_FORMULAS.rational],
        ['Таблица на производните', FORMULAS.table],
        ['Правила за диференциране', FORMULAS.rules],
        ['Приложения на производната', FORMULAS.apps]
      ]) +
      formulaSheet(2, 'Интеграли', [
        ['Таблични интеграли', INTEGRAL_FORMULAS.table],
        ['Методи за интегриране', INTEGRAL_FORMULAS.methods],
        ['Определен интеграл', INTEGRAL_FORMULAS.definite],
        ['Приложения на интеграла', INTEGRAL_FORMULAS.apps]
      ]) +
      '</div>';
    renderSidebar({ route: 'formulas' });
  }

  /* ================================================= повтори грешните */
  function renderReview() {
    Store.log('page_view', { page: 'review' });
    var items = Mistakes.resolve().slice(0, 5);
    view.innerHTML =
      '<div class="view view-narrow">' +
      '<div class="page-head"><div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span><span>Повтори грешните</span></div>' +
      '<h1>Повтори грешните</h1>' +
      '<p class="lead">' + (items.length ?
        'Задачи от Самопроверка, които сте сгрешили (до 5 наведнъж). Верният отговор отмята задачата.' :
        'Няма сгрешени задачи за повторение. Браво!') + '</p></div>' +
      '<div id="review-list"></div>' +
      '<div class="btn-row"><a class="btn btn-ghost" href="#/" data-nav>Към началото</a>' +
      (items.length ? '<button class="btn btn-ghost" type="button" id="review-again">Нова серия</button>' : '') + '</div>' +
      '</div>';
    renderSidebar({ route: 'review' });
    var listEl = document.getElementById('review-list');
    items.forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<div class="card-kicker">' + esc(it.section.short) + ' · Ниво ' + it.m.lvl + ' · ' + esc(subTitle(it.subtopic, it.m.lvl)) + '</div>';
      listEl.appendChild(card);
      buildQuestion(card, it.q, 'review', function (result) {
        Mistakes.record({ sid: it.m.sid, lvl: it.m.lvl, sub: it.m.sub }, it.q, !!result.correct);
        if (result.correct) toast('Задачата е отметната');
      });
    });
    var again = document.getElementById('review-again');
    if (again) again.addEventListener('click', navigate);
  }

  /* ==================================================== бърза задача
     Случайна задача (Практика или Самопроверка) от подтеми, които
     студентът вече е отварял; ако няма такива — от Ниво 1. */
  function renderQuick() {
    Store.log('page_view', { page: 'quick' });
    var opened = {};
    Store.events().forEach(function (ev) {
      if (ev.t === 'page_view' && ev.d && ev.d.page === 'lesson') opened[ev.d.section + '|' + ev.d.level + '|' + ev.d.subtopic] = true;
    });
    var pool = [], fallback = [];
    SECTIONS.forEach(function (sec) {
      sec.subtopics.forEach(function (st) {
        st.levels.forEach(function (lv) {
          var key = sec.id + '|' + lv.level + '|' + st.id;
          (lv.practice || []).concat(lv.quiz || []).forEach(function (q) {
            if (q.type === 'text') return;
            var item = { q: q, section: sec, subtopic: st, lvl: lv.level };
            if (opened[key] || Store.isLevelDone(st.id, lv.level)) pool.push(item);
            if (lv.level === 1) fallback.push(item);
          });
        });
      });
    });
    var from = pool.length ? pool : fallback;
    var it = from[Math.floor(Math.random() * from.length)];
    view.innerHTML =
      '<div class="view view-narrow">' +
      '<div class="page-head"><div class="crumb"><a href="#/" data-nav>Начало</a><span>›</span><span>Бърза задача</span></div>' +
      '<h1>Бърза задача</h1>' +
      '<p class="lead">' + (pool.length ? 'Случайна задача от подтемите, които вече сте отваряли.' : 'Още не сте отваряли подтеми — ето задача от Ниво 1.') + '</p></div>' +
      '<div class="card" id="quick-card"><div class="card-kicker">' + esc(it.section.short) + ' · Ниво ' + it.lvl + ' · ' +
      '<a href="#/section/' + it.section.id + '/level/' + it.lvl + '/' + it.subtopic.id + '" data-nav>' + esc(subTitle(it.subtopic, it.lvl)) + '</a></div></div>' +
      '<div class="btn-row"><button class="btn btn-primary" type="button" id="quick-next">Друга задача</button>' +
      '<a class="btn btn-ghost" href="#/" data-nav>Към началото</a></div>' +
      '</div>';
    renderSidebar({ route: 'quick' });
    buildQuestion(document.getElementById('quick-card'), it.q, 'quick', function () {});
    document.getElementById('quick-next').addEventListener('click', function () { clearPlots(); window.scrollTo(0, 0); renderQuick(); });
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
    [1, 2, 3].filter(function (lvl) { return Store.levelProgress(section, lvl).total; }).forEach(function (lvl) {
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
      var order = optionOrder(q);
      order.forEach(function (i) {
        var b = document.createElement('button');
        b.className = 'opt-btn';
        b.innerHTML = '<span class="opt-mark"></span><span>' + MathText.rich(q.options[i]) + '</span>';
        b.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var correct = i === q.correct;
          if (correct) correctCount++;
          answers.push({ q: idx, correct: correct, choice: i });
          Array.prototype.forEach.call(opts.children, function (child, pos) {
            child.disabled = true;
            if (order[pos] === q.correct) child.classList.add('is-correct');
            else if (order[pos] === i) child.classList.add('is-wrong');
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
      while (recommended > 1 && !Store.levelProgress(section, recommended).total) recommended--;
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
        '<span class="level-card-body"><h3>' + esc(subTitle(st, lvl)) + '</h3><p>' + MathText.rich(subLead(st, lvl)) + '</p></span>' +
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
      '<span>' + esc(subTitle(subtopic, lvl)) + '</span></div>' +
      '<h1>' + esc(subTitle(subtopic, lvl)) + '</h1>' +
      '<p class="lead">' + MathText.rich(level.goal) + '</p>' +
      '<div class="progress-row"><span>Подтема ' + (pos + 1) + ' от ' + idxInLevel.length + '</span>' +
      '<a class="formula-link" href="#/formulas" data-nav>Формули</a></div>' +
      '</div>' +
      '<div id="lesson-cards"></div>' +
      '<div id="lesson-end"></div>' +
      '</div>';
    renderSidebar({ route: 'lesson', sid: section.id, section: section, lvl: lvl, subId: subId });

    var cards = document.getElementById('lesson-cards');
    var n = 0;

    /* worked е обект или масив от няколко примера (напр. слято ниво) */
    [].concat(level.worked || []).forEach(function (w) { renderWorkedCard(cards, w, ++n); });
    if (level.explore) renderExploreCard(cards, level.explore, ++n);
    if (level.bridge) renderBridgeCard(cards, level.bridge, ++n);

    var quizScoreRef = { correct: 0, total: 0, allAnswered: false };
    if (level.practice && level.practice.length) {
      renderProblemSetCard(cards, 'Практика', level.practice, ++n, 'practice', null);
    }
    if (level.quiz && level.quiz.length) {
      renderProblemSetCard(cards, 'Самопроверка', level.quiz, ++n, 'quiz', function (state) {
        checkQuizFinish(state, section, lvl, subtopic, idxInLevel, pos);
      }, { sid: section.id, lvl: lvl, sub: subId });
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
    /* „Маркерна дъска“ под статичния пример — помощ, не условие за напредъка */
    var boards = (worked.boards || []).filter(function (b) { return b && !b.hidden; });
    if (boards.length && window.Board) {
      var sec = document.createElement('section');
      sec.className = 'board-section';
      sec.innerHTML = '<h3>На дъската</h3><p class="board-lead">' +
        (boards.length > 1 ? 'Изберете пример. ' : '') +
        'Решението се изписва ред по ред. С „Следващ ред“ първо помислете каква е следващата стъпка, после я вижте.</p>';
      card.appendChild(sec);
      activePlots.push(Board.group(sec, boards));
    }
    return card;
  }

  /* бутон „Покажи решението на дъската“ след опит в Практика (не в Самопроверка) */
  function boardToggle(wrap, q, mode) {
    if (!q.board || q.board.hidden || mode === 'quiz' || !window.Board) return;
    if (wrap.querySelector('.board-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm board-toggle';
    btn.textContent = 'Покажи решението на дъската';
    btn.setAttribute('aria-expanded', 'false');
    var host = document.createElement('div');
    host.className = 'board-practice';
    var inst = null;
    btn.addEventListener('click', function () {
      if (inst) {
        inst.destroy();
        activePlots = activePlots.filter(function (p) { return p !== inst; });
        inst = null;
        host.innerHTML = '';
        btn.textContent = 'Покажи решението на дъската';
        btn.setAttribute('aria-expanded', 'false');
        return;
      }
      inst = Board.create(host, q.board, { autoplay: true });
      activePlots.push(inst);
      btn.textContent = 'Скрий дъската';
      btn.setAttribute('aria-expanded', 'true');
    });
    wrap.appendChild(btn);
    wrap.appendChild(host);
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
    if (explore.choices) card.appendChild(choiceBar(explore.choices, plotWrap));
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

  /* Избор на функция от списък (explore.choices: [{ label, plot }]):
     бутоните сменят чертежа под тях. Управляват се и със стрелките. */
  function choiceBar(choices, plotWrap) {
    var bar = document.createElement('div');
    bar.className = 'choice-bar';
    bar.setAttribute('role', 'radiogroup');
    bar.setAttribute('aria-label', 'Изберете функция');
    var current = null;
    function select(i, focus) {
      if (current) {
        current.destroy();
        activePlots = activePlots.filter(function (p) { return p !== current; });
      }
      plotWrap.innerHTML = '';
      current = mountPlot(plotWrap, choices[i].plot);
      Array.prototype.forEach.call(bar.children, function (b, j) {
        b.setAttribute('aria-checked', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
        b.classList.toggle('is-active', j === i);
      });
      if (focus) bar.children[i].focus();
    }
    choices.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice-btn';
      b.setAttribute('role', 'radio');
      b.innerHTML = MathText.rich(c.label);
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        select((i + d + choices.length) % choices.length, true);
      });
      bar.appendChild(b);
    });
    setTimeout(function () { select(0); }, 0);
    return bar;
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
  function renderProblemSetCard(container, label, problems, n, mode, onChange, ctx) {
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
        if (mode === 'quiz' && ctx && st.scorable) Mistakes.record(ctx, q, st.correct);
        if (onChange) onChange(state);
      });
    });
    return card;
  }

  /* ------------------------------------------------- „Повтори грешните“
     Сгрешените въпроси от Самопроверка се пазят в localStorage (user_mistakes)
     с ключ раздел|ниво|подтема|текст на въпроса — текстът, а не поредният
     номер, за да не се объркат при добавяне или скриване на задачи. */
  var Mistakes = {
    KEY: 'user_mistakes',
    key: function (ctx, q) { return ctx.sid + '|' + ctx.lvl + '|' + ctx.sub + '|' + q.q; },
    list: function () { return Store.get(this.KEY, []); },
    record: function (ctx, q, correct) {
      var k = this.key(ctx, q);
      var list = this.list().filter(function (m) { return m.k !== k; });
      if (!correct) list.push({ k: k, sid: ctx.sid, lvl: ctx.lvl, sub: ctx.sub, q: q.q, at: Date.now() });
      Store.set(this.KEY, list);
    },
    /* връща само записи, чийто въпрос още съществува и е видим */
    resolve: function () {
      return this.list().map(function (m) {
        var sec = getSection(m.sid), st = sec && getSubtopic(sec, m.sub), lv = st && getLevel(st, m.lvl);
        var q = lv && (lv.quiz || []).filter(function (x) { return x.q === m.q; })[0];
        return q ? { m: m, q: q, section: sec, subtopic: st } : null;
      }).filter(Boolean);
    }
  };

  /* ------------------------------------------------- математическа клавиатура */
  var EXPR_KEYS = [
    { label: 'x²', insert: '^2' },
    { label: '^', insert: '^' },
    { label: '√', insert: 'sqrt()', back: 1 },
    { label: '·', insert: '*' },
    { label: '/', insert: '/' },
    { label: '(', insert: '(' },
    { label: ')', insert: ')' },
    { label: 'sin', insert: 'sin()', back: 1 },
    { label: 'cos', insert: 'cos()', back: 1 },
    { label: 'eˣ', insert: 'exp()', back: 1 },
    { label: 'ln', insert: 'ln()', back: 1 },
    { label: 'π', insert: 'pi' },
    { label: '⌫', backspace: true }
  ];

  function insertAtCursor(input, text, back) {
    var start = input.selectionStart != null ? input.selectionStart : input.value.length;
    var end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    var pos = start + text.length - (back || 0);
    input.focus();
    input.setSelectionRange(pos, pos);
  }

  function backspaceAtCursor(input) {
    var start = input.selectionStart != null ? input.selectionStart : input.value.length;
    var end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
    if (start === end && start > 0) start -= 1;
    input.value = input.value.slice(0, start) + input.value.slice(end);
    input.focus();
    input.setSelectionRange(start, start);
  }

  /** Малка помощна клавиатура за въпроси, чийто отговор е израз, не просто число. */
  function buildExprKeyboard(input) {
    var bar = document.createElement('div');
    bar.className = 'expr-keyboard';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Помощна математическа клавиатура');
    EXPR_KEYS.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'expr-key' + (k.backspace ? ' expr-key-del' : '');
      b.textContent = k.label;
      b.setAttribute('aria-label', k.backspace ? 'Изтрий последния символ' : 'Вмъкни ' + k.label);
      b.addEventListener('click', function () {
        if (input.disabled) return;
        if (k.backspace) backspaceAtCursor(input);
        else insertAtCursor(input, k.insert, k.back || 0);
      });
      bar.appendChild(b);
    });
    return bar;
  }

  /* ---------------------------------------------------- question builder */
  function buildQuestion(container, q, mode, onAnswer) {
    var wrap = document.createElement('div');
    wrap.className = 'q-block';
    container.appendChild(wrap);
    if (q.board) {
      var reportAnswer = onAnswer;
      onAnswer = function (result) { reportAnswer(result); boardToggle(wrap, q, mode); };
    }

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
      opts.className = 'q-options' + (q.optionPlots ? ' is-graphs' : '');
      var answered = false;
      var order = optionOrder(q);
      order.forEach(function (i, pos) {
        var b = document.createElement('button');
        b.className = 'opt-btn';
        if (q.optionPlots) {
          /* опции-чертежи: буквата е по позицията, за да не издава реда в данните */
          var letter = 'абвг'[pos];
          b.setAttribute('aria-label', 'Графика ' + letter);
          b.innerHTML = '<span class="opt-mark"></span><span class="opt-letter">' + letter + ')</span>';
          var pw = document.createElement('span');
          pw.className = 'opt-plot';
          b.appendChild(pw);
          mountPlot(pw, Object.assign({ alt: 'Графика ' + letter }, q.optionPlots[i]));
        } else {
          b.innerHTML = '<span class="opt-mark"></span><span>' + MathText.rich(q.options[i]) + '</span>';
        }
        b.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          var correct = i === q.correct;
          Array.prototype.forEach.call(opts.children, function (child, pos) {
            child.disabled = true;
            if (order[pos] === q.correct) child.classList.add('is-correct');
            else if (order[pos] === i) child.classList.add('is-wrong');
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
      if (q.type === 'expr') body.appendChild(buildExprKeyboard(input));

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
