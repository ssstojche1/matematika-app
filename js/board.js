/* ============================================================================
 * board.js — „Маркерна дъска“: решение, изписвано ред по ред
 * ----------------------------------------------------------------------------
 * Данни (виж js/content-boards.js):
 *   { title?, link?: { href, label }, steps: [{ line, formula?, note?, boxed? }] }
 *     line     синьо — стъпката на решението
 *     formula  зелено — използваното правило, в колона вдясно (под реда на тесен екран)
 *     note     червено — кратко обяснение; изписва се първо, над стъпката
 *     boxed    ограден ред (крайният отговор)
 * Запис във формулите: a / b → дроб с дробна черта (числител горе, знаменател
 * долу), x^2 → x², x^(n-1) групира показателя (без вложени
 * степени), sqrt( → √(, <= >= != → ≤ ≥ ≠.
 *
 * Дъската е помощ, не условие: не пише нищо в localStorage и не влияе на
 * напредъка. Пълният текст на решението е в DOM от самото начало (скрит
 * визуално списък за екранни четци); анимираното копие е aria-hidden.
 * При prefers-reduced-motion всички редове се показват наведнъж.
 *
 *   Board.create(host, board, { autoplay })  → { el, destroy }
 *   Board.group(host, boards)                → { el, destroy }  (няколко дъски с избор)
 * ========================================================================== */
(function (global) {
  'use strict';

  var GAP = 500;          // пауза между редовете, ms
  var SPEEDS = [['0.6', 'Бавно'], ['1', 'Нормално'], ['1.8', 'Бързо']];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var SUP = /\^(\([^)]*\)|[A-Za-z0-9.+\-]+)/g;
  function symbols(s) {
    return s.replace(/sqrt\(/g, '√(').replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠');
  }
  /* видимият запис: степените стават горен индекс */
  function pretty(s) {
    return esc(symbols(s)).replace(SUP, function (m, p) {
      if (p.charAt(0) === '(') p = p.slice(1, -1);
      return '<span class="board-sup">' + p + '</span>';
    });
  }

  /* Дробите се изписват с дробна черта: числителят горе, знаменателят долу.
     Операнд на „/“ е най-дългото парче без интервал извън скоби около
     наклонената черта: (x^2 + 1) / (x - 3), (x - 2)(x + 2) / (x - 2),
     sqrt(x - 2) / (x - 5), 1/x, 5/x^2. Външните скоби на операнд, който е
     само една скоба, изчезват (както при истинска дробна черта). */
  function stripParens(t) {
    if (t.charAt(0) !== '(' || t.charAt(t.length - 1) !== ')') return t;
    for (var i = 0, d = 0; i < t.length; i++) {
      if (t[i] === '(') d++;
      else if (t[i] === ')' && --d === 0 && i < t.length - 1) return t;
    }
    return t.slice(1, -1);
  }
  function topSlash(s) {
    for (var i = 0, d = 0; i < s.length; i++) {
      if (s[i] === '(') d++;
      else if (s[i] === ')') d--;
      else if (s[i] === '/' && d === 0) return i;
    }
    return -1;
  }
  function withFractions(s) {
    if (s.indexOf('/') < 0) return pretty(s);
    var k = topSlash(s);
    if (k < 0) {
      /* наклонената черта е вътре в скоби, напр. (u / v)' — дробта остава в скобите */
      var out = '', buf = '', d = 0, start = -1;
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (c === '(' && d++ === 0) start = i;
        if (d === 0) buf += c;
        if (c === ')' && --d === 0) {
          var inner = s.slice(start + 1, i);
          if (inner.indexOf('/') >= 0 && s[start - 1] !== '^') {
            out += pretty(buf) + '(' + withFractions(inner) + ')';
            buf = '';
          } else buf += s.slice(start, i + 1);
        }
      }
      return out + pretty(buf);
    }
    var a = k - 1, b = k + 1, d1 = 0;
    while (a >= 0 && s[a] === ' ') a--;
    var numEnd = a + 1;
    for (; a >= 0; a--) {
      if (s[a] === ')') d1++;
      else if (s[a] === '(') { if (d1 === 0) break; d1--; }
      else if (s[a] === ' ' && d1 === 0) break;
    }
    var numStart = a + 1;
    while (b < s.length && s[b] === ' ') b++;
    var denStart = b;
    for (d1 = 0; b < s.length; b++) {
      if (s[b] === '(') d1++;
      else if (s[b] === ')') { if (d1 === 0) break; d1--; }
      else if (s[b] === ' ' && d1 === 0) break;
    }
    var num = s.slice(numStart, numEnd), den = s.slice(denStart, b);
    if (!num || !den) return pretty(s);
    return withFractions(s.slice(0, numStart)) +
      '<span class="board-frac"><span class="board-num">' + withFractions(stripParens(num)) + '</span>' +
      '<span class="board-den">' + withFractions(stripParens(den)) + '</span></span>' +
      withFractions(s.slice(b));
  }
  /* записът за екранни четци: степента се казва с думи, ' е знак прим */
  function spoken(s) {
    return symbols(s).replace(SUP, function (m, p) { return ' на степен ' + p + ' '; })
      .replace(/\s*\/\s*/g, ' върху ').replace(/'/g, '′').replace(/√\(/g, 'корен от (').replace(/\s+([,;)])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  }

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(label, cls) {
    var b = el('button', 'btn btn-sm ' + cls);
    b.type = 'button';
    b.textContent = label;
    return b;
  }

  /* ----------------------------------------------------------- една дъска */
  function create(host, board, opts) {
    opts = opts || {};
    var wrap = el('div', 'board-wrap');
    host.appendChild(wrap);
    if (board.title) wrap.appendChild(el('h3', 'board-title', esc(board.title)));

    /* пълното решение за екранни четци */
    var sr = el('ol', 'sr-only');
    sr.setAttribute('aria-label', 'Решение' + (board.title ? ': ' + board.title : ''));
    function sentence(s) { return /[.?!]$/.test(s) ? s : s + '.'; }
    board.steps.forEach(function (s) {
      var t = s.note ? 'Бележка: ' + sentence(spoken(s.note)) + ' ' : '';
      t += sentence((s.boxed ? 'Отговор: ' : '') + spoken(s.line));
      if (s.formula) t += ' Формула: ' + sentence(spoken(s.formula));
      sr.appendChild(el('li', '', esc(t)));
    });
    wrap.appendChild(sr);

    var surface = el('div', 'board');
    surface.setAttribute('aria-hidden', 'true');
    wrap.appendChild(surface);

    wrap.appendChild(el('div', 'board-legend',
      '<span class="k-work"><i></i>Синьо: стъпките на решението</span>' +
      '<span class="k-note"><i></i>Червено: обяснение</span>' +
      '<span class="k-formula"><i></i>Зелено: използваната формула</span>'));
    wrap.lastChild.setAttribute('aria-hidden', 'true');

    var tray = el('div', 'board-tray');
    var playBtn = button('Пусни', 'btn-primary board-play');
    var backBtn = button('Назад', 'btn-ghost');
    var nextBtn = button('Следващ ред', 'btn-ghost');
    var restartBtn = button('Отначало', 'btn-ghost');
    var speedLbl = el('label', 'board-speed', 'Скорост ');
    var speedSel = el('select', '', SPEEDS.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === '1' ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join(''));
    speedLbl.appendChild(speedSel);
    var progressEl = el('span', 'board-progress');
    [playBtn, backBtn, nextBtn, restartBtn, el('span', 'board-spacer'), speedLbl, progressEl].forEach(function (c) { tray.appendChild(c); });
    wrap.appendChild(tray);

    /* при „Следващ ред“ / „Назад“ четецът казва показания ред */
    var live = el('div', 'sr-only');
    live.setAttribute('aria-live', 'polite');
    wrap.appendChild(live);

    if (board.link) {
      var lk = el('p', 'board-link', '<a href="' + esc(board.link.href) + '" data-nav>' + esc(board.link.label) + ' →</a>');
      wrap.appendChild(lk);
    }

    /* ---- редове: първо бележката (над стъпката), после стъпката, после формулата ѝ */
    var rows = [];
    function makeRow(text, kind, parent) {
      var r = el('div', 'board-row ' + kind);
      var clip = el('div', 'board-clip');
      var txt = el('span', 'board-txt', kind === 'note' ? pretty(text) : withFractions(text));
      clip.appendChild(txt);
      var pen = el('span', 'board-pen');
      r.appendChild(clip);
      r.appendChild(pen);
      parent.appendChild(r);
      rows.push({ el: r, clip: clip, txt: txt, pen: pen, w: 0, dur: 500, len: text.length, kind: kind,
        say: (kind === 'formula' ? 'Формула: ' : kind === 'note' ? 'Бележка: ' : kind === 'boxed' ? 'Отговор: ' : '') + spoken(text) });
    }
    board.steps.forEach(function (s) {
      if (s.note) makeRow(s.note, 'note', surface);
      var step = el('div', 'board-step');
      surface.appendChild(step);
      makeRow(s.line, s.boxed ? 'boxed' : 'eq', step);
      if (s.formula) makeRow(s.formula, 'formula', step);
    });

    var reduced = reducedMotion();
    var cur = reduced ? rows.length : 0;   // индекс на реда, който се пише
    var prog = -200;                        // изписани ms от текущия ред; отрицателно = пауза
    var playing = false, last = 0, raf = 0;

    function measure() {
      rows.forEach(function (r) {
        r.w = r.txt.offsetWidth;
        r.el.style.width = r.w + 'px';
        var per = r.kind === 'note' ? 38 : r.kind === 'formula' ? 48 : 70;
        r.dur = Math.max(500, r.len * per);
      });
      rows.forEach(function (r, i) {
        var f = i < cur ? 1 : i === cur ? Math.max(0, Math.min(1, prog / r.dur)) : 0;
        paint(r, f, i === cur && playing);
      });
    }
    function paint(r, f, penOn) {
      var w = r.w * f;
      r.clip.style.width = f >= 1 ? 'auto' : w + 'px';
      r.pen.style.left = (r.clip.offsetLeft + w) + 'px';
      r.pen.style.opacity = penOn && f > 0 && f < 1 ? 1 : 0;
    }

    function tick(t) {
      if (!playing) return;
      var sp = parseFloat(speedSel.value) || 1;
      var dt = Math.min(64, t - last) * sp;
      last = t;
      prog += dt;
      var r = rows[cur];
      if (r) {
        var f = Math.max(0, Math.min(1, prog / r.dur));
        var eased = f < 1 ? f * (0.92 + 0.08 * Math.sin(f * 18)) : 1; // леко „треперене“ на ръката
        paint(r, Math.max(0, Math.min(1, eased)), true);
        if (f >= 1) {
          paint(r, 1, false);
          cur++;
          prog = -GAP;
          if (cur >= rows.length) { stop(); return; }
          updateUI();
        }
      }
      raf = requestAnimationFrame(tick);
    }

    function play() {
      if (cur >= rows.length) restart();
      if (reduced) {           // без анимация: всичко наведнъж
        rows.forEach(function (r) { paint(r, 1, false); });
        cur = rows.length;
        updateUI();
        return;
      }
      playing = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      updateUI();
    }
    function stop() {
      playing = false;
      cancelAnimationFrame(raf);
      rows.forEach(function (r) { r.pen.style.opacity = 0; });
      updateUI();
    }
    function restart() {
      var was = playing;
      stop();
      rows.forEach(function (r) { paint(r, 0, false); });
      cur = 0; prog = -200;
      updateUI();
      if (was) play();
    }
    function next() {
      stop();
      if (cur < rows.length) {
        paint(rows[cur], 1, false);
        live.textContent = rows[cur].say;
        cur++;
        prog = -GAP;
      }
      updateUI();
    }
    function back() {
      stop();
      if (cur > 0) {
        if (cur < rows.length) paint(rows[cur], 0, false);
        cur--;
        paint(rows[cur], 0, false);
        prog = -200;
        live.textContent = cur ? 'Последен показан ред: ' + rows[cur - 1].say : 'Дъската е празна.';
      }
      updateUI();
    }
    function updateUI() {
      playBtn.textContent = playing ? 'Пауза' : (cur >= rows.length && rows.length ? 'Отново' : 'Пусни');
      backBtn.disabled = cur <= 0;
      nextBtn.disabled = cur >= rows.length;
      progressEl.textContent = Math.min(cur, rows.length) + ' от ' + rows.length + ' реда';
    }

    playBtn.addEventListener('click', function () { if (playing) stop(); else play(); });
    nextBtn.addEventListener('click', next);
    backBtn.addEventListener('click', back);
    restartBtn.addEventListener('click', restart);

    /* ширините се мерят отново при зареден шрифт, при оразмеряване и когато
       дъската стане видима (напр. в скрит до момента блок) */
    var ro = null, rt = 0;
    function remeasure() { clearTimeout(rt); rt = setTimeout(measure, 80); }
    if (global.ResizeObserver) { ro = new ResizeObserver(remeasure); ro.observe(surface); }
    global.addEventListener('resize', remeasure);
    if (document.fonts && document.fonts.load) {
      document.fonts.load('500 32px Caveat', 'абв').then(measure, function () {});
      document.fonts.ready.then(measure);
    }

    measure();
    updateUI();
    if (opts.autoplay && !reduced) play();

    return {
      el: wrap,
      destroy: function () {
        stop();
        clearTimeout(rt);
        if (ro) ro.disconnect();
        global.removeEventListener('resize', remeasure);
      }
    };
  }

  /* -------------------------------------------- няколко дъски с превключване */
  function group(host, boards, opts) {
    var wrap = el('div', 'board-group');
    host.appendChild(wrap);
    var slot = el('div');
    var current = null;
    if (boards.length > 1) {
      var bar = el('div', 'choice-bar');
      bar.setAttribute('role', 'radiogroup');
      bar.setAttribute('aria-label', 'Изберете пример');
      boards.forEach(function (b, i) {
        var c = el('button', 'choice-btn', esc(b.title || 'Пример ' + (i + 1)));
        c.type = 'button';
        c.setAttribute('role', 'radio');
        c.addEventListener('click', function () { select(i); });
        c.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          select((i + d + boards.length) % boards.length, true);
        });
        bar.appendChild(c);
      });
      wrap.appendChild(bar);
    }
    wrap.appendChild(slot);
    function select(i, focus) {
      if (current) current.destroy();
      slot.innerHTML = '';
      current = create(slot, boards.length > 1 ? Object.assign({}, boards[i], { title: null }) : boards[i], opts);
      if (bar) Array.prototype.forEach.call(bar.children, function (b, j) {
        b.setAttribute('aria-checked', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
        b.classList.toggle('is-active', j === i);
        if (focus && j === i) b.focus();
      });
    }
    select(0);
    return { el: wrap, destroy: function () { if (current) current.destroy(); } };
  }

  global.Board = { create: create, group: group, pretty: pretty, spoken: spoken };
})(window);
