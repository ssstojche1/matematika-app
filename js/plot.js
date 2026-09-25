/* ============================================================================
 * plot.js — лека интерактивна координатна система (Oxy)
 * ----------------------------------------------------------------------------
 * Рисува върху <canvas>: оси със стрелки и надписи, мрежа, графики на функции,
 * точки (плътни и „дупки“), асимптоти, допирателни и секущи, защриховки.
 * Поддържа плъзгачи за параметри, влачене на точка по кривата, две свързани
 * панела (f отгоре, f' отдолу) и режим „посочи точка“ за визуални въпроси.
 * Работи офлайн, без външни библиотеки, и е съобразен с тъч устройства.
 * ========================================================================== */
(function (global) {
  'use strict';

  var C = {
    axis: '#2f3640', grid: '#e8ebf0', gridMinor: '#f2f4f8',
    curve: '#2563eb', curve2: '#d946a0', accent: '#e8590c',
    point: '#e8590c', tangent: '#e8590c', secant: '#7c3aed',
    text: '#4a5568', shade: 'rgba(37,99,235,.12)'
  };
  var PALETTE = {
    blue: '#2563eb', pink: '#d946a0', orange: '#e8590c', purple: '#7c3aed',
    green: '#0d9488', gray: '#94a3b8', red: '#dc2626'
  };
  function col(c) { return PALETTE[c] || c || C.curve; }

  function niceStep(range, target) {
    var raw = range / target;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return step * mag;
  }
  function fmt(v, step) {
    if (Math.abs(v) < 1e-9) return '0';
    var dec = step < 0.1 ? 2 : step < 1 ? 1 : 0;
    var s = v.toFixed(dec);
    return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace('.', ',');
  }

  /* ------------------------------------------------------------- Panel */

  function Panel(spec, plot) {
    this.spec = spec;
    this.plot = plot;
    this.xmin = spec.xmin !== undefined ? spec.xmin : -5;
    this.xmax = spec.xmax !== undefined ? spec.xmax : 5;
    this.ymin = spec.ymin !== undefined ? spec.ymin : -4;
    this.ymax = spec.ymax !== undefined ? spec.ymax : 4;
    /* заявеният прозорец; видимият (xmin…ymax) се разширява в layout(),
       за да е единицата по Ox равна на единицата по Oy */
    this.req = { xmin: this.xmin, xmax: this.xmax, ymin: this.ymin, ymax: this.ymax };
    this.curves = (spec.curves || []).map(function (c) {
      var o = Object.assign({}, c);
      if (c.expr) { try { o.f = Expr.toFunction(c.expr); } catch (e) { o.f = function () { return NaN; }; } }
      return o;
    });
  }
  Panel.prototype.X = function (x) {
    return this.box.x + (x - this.xmin) / (this.xmax - this.xmin) * this.box.w;
  };
  Panel.prototype.Y = function (y) {
    return this.box.y + this.box.h - (y - this.ymin) / (this.ymax - this.ymin) * this.box.h;
  };
  Panel.prototype.invX = function (px) {
    return this.xmin + (px - this.box.x) / this.box.w * (this.xmax - this.xmin);
  };
  Panel.prototype.invY = function (py) {
    return this.ymin + (this.box.y + this.box.h - py) / this.box.h * (this.ymax - this.ymin);
  };

  /* -------------------------------------------------------------- Plot */

  function Plot(container, spec) {
    this.spec = spec || {};
    this.el = container;
    this.params = {};
    (this.spec.params || []).forEach(function (p) { this.params[p.name] = p.value; }, this);
    if (this.spec.state) Object.assign(this.params, this.spec.state);

    this.panels = (this.spec.panels || [this.spec]).map(function (s) {
      return new Panel(Object.assign({}, this.spec, s), this);
    }, this);

    this.build();
    this.attach();
    this.draw();
  }

  Plot.prototype.build = function () {
    var self = this;
    this.el.classList.add('plot');
    this.el.innerHTML = '';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'plot-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', this.spec.alt || 'Координатна система Oxy с графика на функция');
    this.el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    /* легенда */
    var legendItems = [];
    this.panels.forEach(function (p) {
      p.curves.forEach(function (c) { if (c.label) legendItems.push(c); });
    });
    if (legendItems.length) {
      var lg = document.createElement('div');
      lg.className = 'plot-legend';
      legendItems.forEach(function (c) {
        var it = document.createElement('span');
        it.className = 'plot-legend-item';
        it.innerHTML = '<i style="background:' + col(c.color) + '"></i>' + MathText.rich(c.label);
        lg.appendChild(it);
      });
      this.el.appendChild(lg);
      this.legend = lg;
    }

    /* плъзгачи */
    if ((this.spec.params || []).length) {
      var wrap = document.createElement('div');
      wrap.className = 'plot-controls';
      this.spec.params.forEach(function (p) {
        var rowEl = document.createElement('label');
        rowEl.className = 'plot-slider';
        var lab = document.createElement('span');
        lab.className = 'plot-slider-label';
        lab.innerHTML = MathText.rich(p.label || '`' + p.name + '`');
        var input = document.createElement('input');
        input.type = 'range';
        input.min = p.min; input.max = p.max;
        input.step = p.step || 0.1; input.value = p.value;
        input.setAttribute('aria-label', 'Параметър ' + p.name);
        var out = document.createElement('output');
        out.textContent = fmt(p.value, p.step || 0.1);
        input.addEventListener('input', function () {
          self.params[p.name] = parseFloat(input.value);
          out.textContent = fmt(self.params[p.name], p.step || 0.1);
          self.draw();
          if (self.spec.onChange) self.spec.onChange(self.params, self);
        });
        rowEl.appendChild(lab); rowEl.appendChild(input); rowEl.appendChild(out);
        wrap.appendChild(rowEl);
      });
      this.el.appendChild(wrap);
      this.controls = wrap;
    }

    /* информационен ред (наклон, стойности) */
    this.readout = document.createElement('div');
    this.readout.className = 'plot-readout';
    this.readout.setAttribute('aria-live', 'polite');
    this.el.appendChild(this.readout);

    /* бутон за анимация секуща → допирателна */
    if (this.spec.secant && this.spec.secant.animate) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost plot-anim';
      btn.textContent = 'Пусни анимацията: секуща → допирателна';
      btn.addEventListener('click', function () { self.animateSecant(btn); });
      this.el.appendChild(btn);
      this.animBtn = btn;
    }

    /* бутони за анимиране на параметър (напр. приближаване към асимптота):
       animate: { param, from, to, duration, log, text } или масив от такива */
    var anims = this.spec.animate ? [].concat(this.spec.animate) : [];
    if (anims.length) {
      var row = document.createElement('div');
      row.className = 'plot-anim-row';
      anims.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-ghost plot-anim';
        b.textContent = '▶ ' + a.text;
        b.addEventListener('click', function () { self.animateParam(a, b); });
        row.appendChild(b);
      });
      this.el.appendChild(row);
    }
  };

  Plot.prototype.attach = function () {
    var self = this;
    var ro = new ResizeObserver(function () { self.draw(); });
    ro.observe(this.el);
    this._ro = ro;

    /* Изгражда се преди картата да е закачена към документа (clientWidth = 0
       в момента на построяване), затова презастрахова се с едно предаване
       на кадър, след като оформлението вече е готово. */
    requestAnimationFrame(function () { self.draw(); });

    var dragging = false;
    function pos(e) {
      var r = self.canvas.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function pick(e) {
      var p = pos(e);
      var panel = self.panels[0];
      var x = panel.invX(p.x);
      x = Math.max(panel.xmin, Math.min(panel.xmax, x));
      if (self.spec.tangent && self.spec.tangent.draggable) {
        self.params.__tx = x; self.draw();
      }
      if (self.spec.secant && self.spec.secant.draggable) {
        self.params.__tx = x; self.draw();
      }
      if (self.spec.pick) {
        self.params.__pick = x;
        self.draw();
        self.spec.pick(x, panel.invY(p.y), self);
      }
    }
    var interactive = (this.spec.tangent && this.spec.tangent.draggable) ||
      (this.spec.secant && this.spec.secant.draggable) || this.spec.pick;
    if (interactive) {
      this.canvas.classList.add('is-interactive');
      this.canvas.addEventListener('pointerdown', function (e) {
        dragging = true; self.canvas.setPointerCapture(e.pointerId); pick(e); e.preventDefault();
      });
      this.canvas.addEventListener('pointermove', function (e) { if (dragging) pick(e); });
      this.canvas.addEventListener('pointerup', function () { dragging = false; });
      this.canvas.addEventListener('pointercancel', function () { dragging = false; });
      this.canvas.tabIndex = 0;
      this.canvas.addEventListener('keydown', function (e) {
        var panel = self.panels[0];
        var step = (panel.xmax - panel.xmin) / 40;
        if (e.key === 'ArrowLeft') { self.params.__tx = (self.params.__tx || 1) - step; }
        else if (e.key === 'ArrowRight') { self.params.__tx = (self.params.__tx || 1) + step; }
        else return;
        e.preventDefault(); self.draw();
      });
    }
  };

  Plot.prototype.destroy = function () { if (this._ro) this._ro.disconnect(); };

  /* Мащабът е еднакъв по двете оси (1 : 1), както в учебника: единица по Ox
     и единица по Oy са равни отсечки. Заявеният прозорец винаги се вижда
     изцяло. Височината на чертежа расте до разумна граница; ако графиката
     е „висока и тясна“, чертожното поле се стеснява и центрира, а излишното
     място се запълва чрез разширяване на обхвата по едната ос. */
  Plot.prototype.layout = function () {
    var cssW = this.el.clientWidth || 600;
    var n = this.panels.length;
    var pad = { l: 34, r: 16, t: 12, b: 26 }, gap = 14;
    var w = cssW - pad.l - pad.r;
    var baseH = this.spec.panelHeight || (n > 1 ? 190 : (this.spec.height || 280));
    var minH = baseH - pad.t - pad.b;
    var maxH = Math.max(minH, n > 1 ? 300 : 480);
    var minW = Math.min(w, Math.max(300, w * 0.55));

    /* обща единица (px), за да съвпадат x-овете на всички панели */
    var u = Infinity, xr = 0;
    this.panels.forEach(function (P) {
      xr = Math.max(xr, P.req.xmax - P.req.xmin);
      u = Math.min(u, w / (P.req.xmax - P.req.xmin), maxH / (P.req.ymax - P.req.ymin));
    });
    var bw = Math.min(w, Math.max(minW, xr * u));
    var bx = pad.l + (w - bw) / 2;
    var step = niceStep(56 / u, 1);

    var top = 0;
    this.panels.forEach(function (P) {
      var r = P.req;
      var cx = (r.xmin + r.xmax) / 2, halfX = bw / u / 2;
      P.xmin = cx - halfX; P.xmax = cx + halfX;
      var h = Math.min(maxH, Math.max(minH, (r.ymax - r.ymin) * u));
      var cy = (r.ymin + r.ymax) / 2, halfY = h / u / 2;
      P.ymin = cy - halfY; P.ymax = cy + halfY;
      P.step = step;
      P.box = { x: bx, y: top + pad.t, w: bw, h: h };
      top += h + pad.t + pad.b + gap;
    });
    var cssH = top - gap;

    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = cssW; this.H = cssH;
  };

  Plot.prototype.draw = function () {
    if (!this.el.clientWidth) return;
    this.layout();
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this.readoutLines = [];
    for (var i = 0; i < this.panels.length; i++) this.drawPanel(this.panels[i], i);
    this.readout.innerHTML = this.readoutLines.join('<span class="sep">•</span>');
    this.readout.style.display = this.readoutLines.length ? '' : 'none';
  };

  Plot.prototype.drawPanel = function (P, index) {
    var ctx = this.ctx, b = P.box, s = P.spec;

    /* фон */
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x - 30, b.y - 8, b.w + 44, b.h + 24);

    /* мрежа */
    /* една и съща стъпка по двете оси — квадратна мрежа */
    var sx = P.step, sy = P.step;
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    for (var x = Math.ceil(P.xmin / sx) * sx; x <= P.xmax + 1e-9; x += sx) {
      var px = Math.round(P.X(x)) + .5;
      ctx.moveTo(px, b.y); ctx.lineTo(px, b.y + b.h);
    }
    for (var y = Math.ceil(P.ymin / sy) * sy; y <= P.ymax + 1e-9; y += sy) {
      var py = Math.round(P.Y(y)) + .5;
      ctx.moveTo(b.x, py); ctx.lineTo(b.x + b.w, py);
    }
    ctx.stroke();

    /* защриховки */
    (s.shade || []).forEach(function (sh) { this.drawShade(P, sh); }, this);

    /* асимптоти / вертикални линии */
    (s.vlines || []).forEach(function (v) {
      var xv = typeof v.x === 'string' ? Expr.evalAt(v.x, this.params) : v.x;
      ctx.save();
      ctx.strokeStyle = col(v.color || 'gray');
      ctx.setLineDash(v.dash === false ? [] : [5, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(P.X(xv), b.y); ctx.lineTo(P.X(xv), b.y + b.h);
      ctx.stroke();
      ctx.restore();
      if (v.label) this.tag(P.X(xv) + 5, b.y + 12, v.label, col(v.color || 'gray'));
    }, this);
    (s.hlines || []).forEach(function (h) {
      var yv = typeof h.y === 'string' ? Expr.evalAt(h.y, this.params) : h.y;
      ctx.save();
      ctx.strokeStyle = col(h.color || 'gray');
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(b.x, P.Y(yv)); ctx.lineTo(b.x + b.w, P.Y(yv));
      ctx.stroke(); ctx.restore();
      if (h.label) this.tag(b.x + b.w - 6, P.Y(yv) - 6, h.label, col(h.color || 'gray'), 'right');
    }, this);

    /* оси */
    this.drawAxes(P, sx, sy, index);

    /* криви */
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    P.curves.forEach(function (c) { this.drawCurve(P, c); }, this);

    /* допирателна / секуща */
    if (s.tangent) this.drawTangent(P, s.tangent);
    if (s.secant) this.drawSecant(P, s.secant);
    if (s.derivativeOf !== undefined) this.drawDerivLink(P, s);
    ctx.restore();

    /* точки */
    (s.points || []).forEach(function (pt) { this.drawPoint(P, pt); }, this);

    /* избрана от студента точка */
    if (this.params.__pick !== undefined && index === 0 && s.pickMarker !== false) {
      var xp = this.params.__pick;
      ctx.save();
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(P.X(xp), b.y); ctx.lineTo(P.X(xp), b.y + b.h); ctx.stroke();
      ctx.restore();
    }

    if (s.custom) s.custom({ ctx: ctx, P: P, params: this.params, plot: this, col: col });

    ctx.restore();
  };

  Plot.prototype.drawAxes = function (P, sx, sy, index) {
    var ctx = this.ctx, b = P.box, s = P.spec;
    var y0 = Math.max(b.y, Math.min(b.y + b.h, P.Y(0)));
    var x0 = Math.max(b.x, Math.min(b.x + b.w, P.X(0)));

    ctx.save();
    ctx.strokeStyle = C.axis; ctx.fillStyle = C.axis; ctx.lineWidth = 1.4;
    /* Ox */
    ctx.beginPath();
    ctx.moveTo(b.x, Math.round(y0) + .5); ctx.lineTo(b.x + b.w, Math.round(y0) + .5);
    ctx.stroke();
    arrow(ctx, b.x + b.w, y0, 0);
    /* Oy */
    ctx.beginPath();
    ctx.moveTo(Math.round(x0) + .5, b.y + b.h); ctx.lineTo(Math.round(x0) + .5, b.y);
    ctx.stroke();
    arrow(ctx, x0, b.y, -Math.PI / 2);

    /* деления и числа */
    ctx.font = '11px ui-sans-serif, "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var x = Math.ceil(P.xmin / sx) * sx; x <= P.xmax + 1e-9; x += sx) {
      if (Math.abs(x) < 1e-9) continue;
      var px = P.X(x);
      ctx.strokeStyle = C.axis;
      ctx.beginPath(); ctx.moveTo(px, y0 - 3); ctx.lineTo(px, y0 + 3); ctx.stroke();
      ctx.fillText(fmt(x, sx), px, y0 + 5);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var y = Math.ceil(P.ymin / sy) * sy; y <= P.ymax + 1e-9; y += sy) {
      if (Math.abs(y) < 1e-9) continue;
      var py = P.Y(y);
      ctx.strokeStyle = C.axis;
      ctx.beginPath(); ctx.moveTo(x0 - 3, py); ctx.lineTo(x0 + 3, py); ctx.stroke();
      ctx.fillText(fmt(y, sy), x0 - 6, py);
    }

    /* надписи на осите: O, x, y — както в учебника */
    ctx.font = 'italic 13px "Cambria Math", "STIX Two Math", Georgia, serif';
    ctx.fillStyle = C.axis;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s.xlabel || 'x', b.x + b.w - 2, y0 - 12);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(s.ylabel || 'y', x0 + 7, b.y - 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('O', x0 - 5, y0 + 3);
    ctx.restore();
  };

  function arrow(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-7, -3.2); ctx.lineTo(-7, 3.2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  Plot.prototype.drawCurve = function (P, c) {
    var ctx = this.ctx, b = P.box;
    var f = c.f;
    if (!f) return;
    var isDeriv = !!c.derivative;
    var base = f;
    if (isDeriv) {
      base = function (x, p) { return Expr.derivative(f, x, p); };
    }
    ctx.save();
    ctx.strokeStyle = col(c.color);
    ctx.lineWidth = c.width || 2.2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (c.dash) ctx.setLineDash(c.dash === true ? [6, 4] : c.dash);

    var N = Math.max(200, Math.round(b.w * 2));
    var started = false, prevY = null;
    var dom = c.domain;
    ctx.beginPath();
    for (var i = 0; i <= N; i++) {
      var x = P.xmin + (P.xmax - P.xmin) * i / N;
      if (dom && (x < dom[0] || x > dom[1])) { started = false; prevY = null; continue; }
      var y = base(x, this.params);
      if (!isFinite(y)) { started = false; prevY = null; continue; }
      /* прекъсване при скок (вертикална асимптота) */
      if (prevY !== null && Math.abs(y - prevY) > (P.ymax - P.ymin) * 1.4) {
        started = false;
      }
      var py = P.Y(y);
      var clamped = Math.max(b.y - 40, Math.min(b.y + b.h + 40, py));
      if (!started) { ctx.moveTo(P.X(x), clamped); started = true; }
      else ctx.lineTo(P.X(x), clamped);
      prevY = y;
    }
    ctx.stroke();
    ctx.restore();
  };

  Plot.prototype.drawShade = function (P, sh) {
    var ctx = this.ctx, b = P.box;
    ctx.save();
    ctx.fillStyle = sh.color ? hexA(col(sh.color), sh.alpha || .14) : C.shade;
    if (sh.rect) {
      var r = sh.rect.map(function (v) { return typeof v === 'string' ? Expr.evalAt(v, this.params) : v; }, this);
      ctx.fillRect(P.X(r[0]), P.Y(r[3]), P.X(r[1]) - P.X(r[0]), P.Y(r[2]) - P.Y(r[3]));
    } else if (sh.band) {
      var a = typeof sh.band[0] === 'string' ? Expr.evalAt(sh.band[0], this.params) : sh.band[0];
      var c2 = typeof sh.band[1] === 'string' ? Expr.evalAt(sh.band[1], this.params) : sh.band[1];
      ctx.fillRect(P.X(a), b.y, P.X(c2) - P.X(a), b.h);
    }
    ctx.restore();
  };
  function hexA(hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + [n >> 16 & 255, n >> 8 & 255, n & 255].join(',') + ',' + a + ')';
  }

  Plot.prototype.drawPoint = function (P, pt) {
    var ctx = this.ctx;
    var px = typeof pt.x === 'string' ? Expr.evalAt(pt.x, this.params) : pt.x;
    var py;
    if (pt.y !== undefined) py = typeof pt.y === 'string' ? Expr.evalAt(pt.y, this.params) : pt.y;
    else if (pt.on !== undefined) {
      var c = P.curves[pt.on];
      py = c && c.f ? c.f(px, this.params) : 0;
    }
    if (!isFinite(px) || !isFinite(py)) return;
    var X = P.X(px), Y = P.Y(py);
    if (pt.readout) {
      var off = Y < P.box.y ? ' ↑ +∞' : Y > P.box.y + P.box.h ? ' ↓ −∞' : '';
      this.readoutLines.push('<span style="color:' + col(pt.color || 'orange') + '">' + pt.readout + '</span> ' +
        '<b>f(' + fmtNum(px) + ') = ' + fmtNum(py) + '</b>' + off);
    }
    if (X < P.box.x - 6 || X > P.box.x + P.box.w + 6) return;
    /* точка, избягала извън чертежа (към ±∞): стрелка на ръба вместо точка */
    if (Y < P.box.y - 6 || Y > P.box.y + P.box.h + 6) {
      var up = Y < P.box.y, ey = up ? P.box.y + 2 : P.box.y + P.box.h - 2;
      ctx.save();
      ctx.fillStyle = col(pt.color || 'orange');
      arrow(ctx, X, ey, up ? -Math.PI / 2 : Math.PI / 2);
      ctx.restore();
      if (pt.label) this.tag(X + 8, ey + (up ? 10 : -10), pt.label + (up ? ' → +∞' : ' → −∞'), col(pt.color || 'orange'));
      return;
    }
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col(pt.color || 'orange');
    if (pt.open) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(X, Y, 4.5, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = col(pt.color || 'orange');
      ctx.beginPath(); ctx.arc(X, Y, 4.2, 0, 7); ctx.fill();
    }
    if (pt.guides) {
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = col(pt.color || 'orange');
      ctx.beginPath();
      ctx.moveTo(P.X(px), P.Y(0)); ctx.lineTo(X, Y);
      ctx.moveTo(P.X(0), Y); ctx.lineTo(X, Y);
      ctx.stroke();
    }
    ctx.restore();
    if (pt.label) this.tag(X + 8, Y - 8, pt.label, col(pt.color || 'orange'));
  };

  Plot.prototype.tag = function (x, y, text, color, align) {
    var ctx = this.ctx;
    ctx.save();
    ctx.font = '600 11.5px ui-sans-serif, "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width;
    var bx = align === 'right' ? x - w - 4 : x - 3;
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.fillRect(bx, y - 7.5, w + 6, 15);
    ctx.fillStyle = color || C.text;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  Plot.prototype.tangentX = function (t) {
    if (this.params.__tx !== undefined) return this.params.__tx;
    return typeof t.x === 'string' ? Expr.evalAt(t.x, this.params) : (t.x === undefined ? 1 : t.x);
  };

  Plot.prototype.drawTangent = function (P, t) {
    var c = P.curves[t.curve || 0];
    if (!c || !c.f) return;
    var x0 = this.tangentX(t);
    x0 = Math.max(P.xmin, Math.min(P.xmax, x0));
    var y0 = c.f(x0, this.params);
    if (!isFinite(y0)) return;
    var m = Expr.derivative(c.f, x0, this.params);
    var ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = C.tangent; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(P.X(P.xmin), P.Y(y0 + m * (P.xmin - x0)));
    ctx.lineTo(P.X(P.xmax), P.Y(y0 + m * (P.xmax - x0)));
    ctx.stroke();
    ctx.restore();
    this.drawPoint(P, { x: x0, y: y0, color: 'orange', guides: t.guides !== false });
    if (t.showSlope !== false) {
      this.readoutLines.push('<b>x₀ = ' + fmt(x0, .01) + '</b>');
      this.readoutLines.push('наклон на допирателната <b>f′(x₀) = ' + fmt(m, .01) + '</b>');
    }
  };

  Plot.prototype.drawSecant = function (P, sc) {
    var c = P.curves[sc.curve || 0];
    if (!c || !c.f) return;
    var x0 = sc.x0 === undefined ? 1 : sc.x0;
    var h = this.params[sc.hParam || 'h'];
    if (h === undefined) h = 1;
    var x1 = x0 + h;
    var y0 = c.f(x0, this.params), y1 = c.f(x1, this.params);
    if (!isFinite(y0) || !isFinite(y1)) return;
    var m = (y1 - y0) / (x1 - x0);
    var ctx = this.ctx;
    /* допирателната като ориентир */
    var mt = Expr.derivative(c.f, x0, this.params);
    ctx.save();
    ctx.strokeStyle = hexA(C.tangent, .35); ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(P.X(P.xmin), P.Y(y0 + mt * (P.xmin - x0)));
    ctx.lineTo(P.X(P.xmax), P.Y(y0 + mt * (P.xmax - x0)));
    ctx.stroke();
    ctx.restore();
    /* секущата */
    ctx.save();
    ctx.strokeStyle = C.secant; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(P.X(P.xmin), P.Y(y0 + m * (P.xmin - x0)));
    ctx.lineTo(P.X(P.xmax), P.Y(y0 + m * (P.xmax - x0)));
    ctx.stroke();
    /* триъгълник Δx, Δy */
    ctx.strokeStyle = hexA(C.secant, .55); ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(P.X(x0), P.Y(y0)); ctx.lineTo(P.X(x1), P.Y(y0)); ctx.lineTo(P.X(x1), P.Y(y1));
    ctx.stroke();
    ctx.restore();
    this.tag((P.X(x0) + P.X(x1)) / 2, P.Y(y0) + 12, 'Δx = ' + fmt(h, .01), C.secant);
    this.tag(P.X(x1) + 6, (P.Y(y0) + P.Y(y1)) / 2, 'Δy = ' + fmt(y1 - y0, .01), C.secant);
    this.drawPoint(P, { x: x0, y: y0, color: 'orange' });
    this.drawPoint(P, { x: x1, y: y1, color: 'purple' });
    this.readoutLines.push('наклон на секущата <b>Δy/Δx = ' + fmt(m, .001) + '</b>');
    this.readoutLines.push('точен наклон <b>f′(' + fmt(x0, .01) + ') = ' + fmt(mt, .001) + '</b>');
  };

  /* вертикална връзка между f и f' в двупанелен изглед */
  Plot.prototype.drawDerivLink = function (P, s) {
    var top = this.panels[0];
    var x0 = this.params.__tx;
    if (x0 === undefined) x0 = s.linkX === undefined ? 1 : s.linkX;
    var c = top.curves[0];
    if (!c || !c.f) return;
    var m = Expr.derivative(c.f, x0, this.params);
    var ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = hexA(C.accent, .5); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(P.X(x0), P.box.y); ctx.lineTo(P.X(x0), P.box.y + P.box.h); ctx.stroke();
    ctx.restore();
    this.drawPoint(P, { x: x0, y: m, color: 'orange', guides: true });
  };

  Plot.prototype.animateSecant = function (btn) {
    var self = this;
    var sc = this.spec.secant;
    var p = sc.hParam || 'h';
    var start = sc.animFrom === undefined ? 2.5 : sc.animFrom;
    var end = sc.animTo === undefined ? 0.05 : sc.animTo;
    var t0 = performance.now(), dur = 4200;
    if (btn) { btn.disabled = true; btn.textContent = 'Анимацията върви…'; }
    var slider = this.controls && this.controls.querySelector('input[aria-label="Параметър ' + p + '"]');
    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      self.params[p] = start + (end - start) * e;
      if (slider) {
        slider.value = self.params[p];
        var out = slider.parentNode.querySelector('output');
        if (out) out.textContent = fmt(self.params[p], .01);
      }
      self.draw();
      if (k < 1) requestAnimationFrame(step);
      else if (btn) { btn.disabled = false; btn.textContent = 'Пусни анимацията отново'; }
    }
    requestAnimationFrame(step);
  };

  /* Плавна анимация на параметър от `from` до `to`. При log: true стойността
     се мени геометрично (4 → 2 → 1 → 0,5 …) — така приближаването към
     асимптота изглежда равномерно, вместо да „прескочи“ накрая. */
  Plot.prototype.animateParam = function (a, btn) {
    var self = this;
    var from = a.from, to = a.to, dur = a.duration || 6000;
    var t0 = performance.now();
    var slider = this.controls && this.controls.querySelector('input[aria-label="Параметър ' + a.param + '"]');
    var ps = (this.spec.params || []).filter(function (p) { return p.name === a.param; })[0];
    var buttons = this.el.querySelectorAll('.plot-anim');
    Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
    if (btn) btn.textContent = 'Анимацията върви…';
    function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      self.params[a.param] = a.log ? from * Math.pow(to / from, e) : from + (to - from) * e;
      if (slider) {
        slider.value = self.params[a.param];
        var out = slider.parentNode.querySelector('output');
        if (out) out.textContent = fmt(self.params[a.param], ps && ps.step || .01);
      }
      self.draw();
      if (k < 1) requestAnimationFrame(step);
      else {
        Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
        if (btn) btn.textContent = '↻ ' + a.text;
      }
    }
    requestAnimationFrame(step);
  };

  /* число за информационния ред: 2–3 значещи цифри, десетична запетая */
  function fmtNum(v) {
    var a = Math.abs(v);
    var s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(a >= 1 ? 2 : 3);
    return s.replace('.', ',').replace('-', '−');
  }

  /* ------------------------------------------------------------- фабрика */

  function create(container, spec) { return new Plot(container, spec); }

  global.Plot = { create: create, colors: PALETTE };
})(window);
