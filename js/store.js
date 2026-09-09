/* ============================================================================
 * store.js — напредък в localStorage + журнал на събитията
 * ----------------------------------------------------------------------------
 * Ключове (по спецификацията):
 *   user_diagnosticQuiz_<section>   резултат от входящия тест
 *   user_level_<subtopic>_<level>   завършено ниво по подтема
 *   user_progress_<section>         % завършеност (0–100)
 *   user_last_position              за „продължи оттам, докъдето стигна“
 *
 * Журналът на събитията (Store.log) е подготвен за бъдещо събиране на данни:
 * достатъчно е да се зададе Store.remote = 'https://.../events' и събитията
 * ще се изпращат и към сървър. Дотогава всичко остава само в браузъра.
 * ========================================================================== */
(function (global) {
  'use strict';

  var mem = {};
  var hasLS = (function () {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
    catch (e) { return false; }
  })();

  function raw(k) { return hasLS ? localStorage.getItem(k) : (mem[k] === undefined ? null : mem[k]); }
  function setRaw(k, v) { if (hasLS) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } } else mem[k] = v; }
  function delRaw(k) { if (hasLS) localStorage.removeItem(k); else delete mem[k]; }

  function get(k, def) {
    var v = raw(k);
    if (v === null) return def;
    try { return JSON.parse(v); } catch (e) { return def; }
  }
  function set(k, v) { setRaw(k, JSON.stringify(v)); }

  /* ------------------------------------------------- анонимен идентификатор */
  function studentId() {
    var id = get('user_id', null);
    if (!id) {
      id = 'st-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      set('user_id', id);
      set('user_created', new Date().toISOString());
    }
    return id;
  }

  /* --------------------------------------------------------- входящ тест */
  function getDiagnostic(sectionId) { return get('user_diagnosticQuiz_' + sectionId, null); }
  function setDiagnostic(sectionId, data) {
    set('user_diagnosticQuiz_' + sectionId, data);
    log('diagnostic_complete', { section: sectionId, score: data.score, recommended: data.recommended });
  }

  /* ------------------------------------------------------ стъпки и нива */
  function stepKey(sub, level) { return 'user_level_' + sub + '_' + level; }

  function getLevel(sub, level) {
    return get(stepKey(sub, level), { steps: {}, done: false, quiz: null });
  }
  function markStep(sub, level, step, value) {
    var st = getLevel(sub, level);
    st.steps[step] = value === undefined ? true : value;
    set(stepKey(sub, level), st);
  }
  function isStepDone(sub, level, step) {
    return !!getLevel(sub, level).steps[step];
  }
  function markLevelDone(sub, level, quizScore) {
    var st = getLevel(sub, level);
    st.done = true;
    st.quiz = quizScore === undefined ? st.quiz : quizScore;
    st.completedAt = new Date().toISOString();
    set(stepKey(sub, level), st);
    log('level_complete', { subtopic: sub, level: level, quiz: quizScore });
  }
  function isLevelDone(sub, level) { return !!getLevel(sub, level).done; }

  /* --------------------------------------------------------- проценти */
  function sectionProgress(section) {
    var total = 0, done = 0;
    section.subtopics.forEach(function (st) {
      st.levels.forEach(function (lv) {
        total += 1;
        if (isLevelDone(st.id, lv.level)) done += 1;
      });
    });
    var pct = total ? Math.round(done * 100 / total) : 0;
    set('user_progress_' + section.id, pct);
    return { pct: pct, done: done, total: total };
  }
  function levelProgress(section, level) {
    var total = 0, done = 0;
    section.subtopics.forEach(function (st) {
      if (!st.levels.some(function (l) { return l.level === level; })) return;
      total += 1;
      if (isLevelDone(st.id, level)) done += 1;
    });
    return { pct: total ? Math.round(done * 100 / total) : 0, done: done, total: total };
  }

  /* ---------------------------------------------------- последна позиция */
  function savePosition(hash) { set('user_last_position', { hash: hash, at: Date.now() }); }
  function lastPosition() { return get('user_last_position', null); }

  /* ------------------------------------------------------------ журнал */
  var MAX_EVENTS = 800;
  function log(type, payload) {
    var ev = {
      t: type,
      at: new Date().toISOString(),
      sid: studentId(),
      d: payload || {}
    };
    var list = get('user_events', []);
    list.push(ev);
    if (list.length > MAX_EVENTS) list = list.slice(-MAX_EVENTS);
    set('user_events', list);
    if (API.remote) {
      try {
        navigator.sendBeacon(API.remote, new Blob([JSON.stringify(ev)], { type: 'application/json' }));
      } catch (e) { /* офлайн — събитието остава локално */ }
    }
    return ev;
  }
  function events() { return get('user_events', []); }

  /* ----------------------------------------------------- износ / нулиране */
  function exportAll() {
    var out = { id: studentId(), created: get('user_created', null), exported: new Date().toISOString(), data: {} };
    var keys = [];
    if (hasLS) {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('user_') === 0) keys.push(k);
      }
    } else keys = Object.keys(mem);
    keys.forEach(function (k) { out.data[k] = get(k, null); });
    return out;
  }
  function downloadExport() {
    var blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'napredak-' + studentId() + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  function reset() {
    var keys = [];
    if (hasLS) {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('user_') === 0) keys.push(k);
      }
      keys.forEach(delRaw);
    } else mem = {};
  }

  var API = {
    remote: null,          /* ← адрес на бъдещ сървър за събиране на данни */
    available: hasLS,
    get: get, set: set,
    studentId: studentId,
    getDiagnostic: getDiagnostic, setDiagnostic: setDiagnostic,
    getLevel: getLevel, markStep: markStep, isStepDone: isStepDone,
    markLevelDone: markLevelDone, isLevelDone: isLevelDone,
    sectionProgress: sectionProgress, levelProgress: levelProgress,
    savePosition: savePosition, lastPosition: lastPosition,
    log: log, events: events,
    exportAll: exportAll, downloadExport: downloadExport, reset: reset
  };
  global.Store = API;

  /* запис при напускане на страницата */
  window.addEventListener('beforeunload', function () {
    if (location.hash) savePosition(location.hash);
  });
})(window);
