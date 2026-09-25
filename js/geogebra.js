/* ============================================================================
 * geogebra.js — вграждане на GeoGebra аплети при поискване
 * ----------------------------------------------------------------------------
 * Аплетите се зареждат само когато студентът натисне бутона (мързеливо
 * зареждане), за да не се бави страницата. Ако няма интернет, показваме
 * учтиво съобщение — вградената координатна система (plot.js) вече е
 * налична и работи офлайн, така че урокът не се блокира.
 * ========================================================================== */
(function (global) {
  'use strict';

  var DEPLOY = 'https://www.geogebra.org/apps/deployggb.js';
  var loading = null;
  var seq = 0;

  function loadScript() {
    if (global.GGBApplet) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = DEPLOY;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { loading = null; reject(new Error('GeoGebra не се зареди')); };
      document.head.appendChild(s);
      setTimeout(function () { if (!global.GGBApplet) { loading = null; reject(new Error('изтече времето')); } }, 15000);
    });
    return loading;
  }

  /**
   * spec = {
   *   appName: 'graphing' | 'classic' | 'geometry',
   *   commands: ['f(x)=x^2', 'SetColor(f,0,90,200)'],
   *   material: 'abcd1234',       // или готов материал по идентификатор
   *   height: 420, perspective: 'G', showToolBar: false
   * }
   */
  function mount(container, spec) {
    container.innerHTML = '<div class="ggb-loading">Зареждане на GeoGebra…</div>';
    return loadScript().then(function () {
      var id = 'ggb-' + (++seq);
      var holder = document.createElement('div');
      holder.id = id;
      container.innerHTML = '';
      container.appendChild(holder);

      var params = {
        appName: spec.appName || 'graphing',
        width: container.clientWidth || 600,
        /* на тесен екран алгебричният изглед отива под чертежа — по-висок аплет */
        height: Math.max(spec.height || 400, (container.clientWidth || 600) < 600 ? 620 : 0),
        showToolBar: !!spec.showToolBar,
        showAlgebraInput: !!spec.showAlgebraInput,
        showMenuBar: false,
        showResetIcon: true,
        enableRightClick: false,
        enableLabelDrags: false,
        enableShiftDragZoom: true,
        useBrowserForJS: false,
        borderColor: '#e3e7ee',
        scaleContainerClass: 'ggb-wrap',
        autoHeight: false,
        appletOnLoad: function (api) {
          try {
            if (spec.perspective) api.setPerspective(spec.perspective);
            (spec.commands || []).forEach(function (c) { api.evalCommand(c); });
            if (spec.coordSystem) {
              api.setCoordSystem.apply(api, spec.coordSystem);
            }
            /* ZoomIn / setCoordSystem разтягат осите до размера на аплета —
               връщаме еднакъв мащаб по Ox и Oy (1 : 1), както в plot.js */
            api.evalCommand('SetAxesRatio(1,1)');
          } catch (e) { /* аплетът е зареден, но команда не мина — не е фатално */ }
        }
      };
      if (spec.material) params.material_id = spec.material;

      var applet = new global.GGBApplet(params, true);
      applet.inject(id);
      return applet;
    }).catch(function () {
      container.innerHTML =
        '<div class="ggb-fallback">' +
        '<p><strong>GeoGebra не можа да се зареди.</strong> Изглежда няма връзка с интернет.</p>' +
        '<p>Интерактивната координатна система по-горе работи и без интернет — използвайте нея.</p>' +
        '</div>';
    });
  }

  /** Бутон, който зарежда аплета чак при натискане. */
  function lazyBlock(spec) {
    var wrap = document.createElement('div');
    wrap.className = 'ggb-block';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost ggb-btn';
    btn.innerHTML = '<span class="ggb-mark">GeoGebra</span> ' + (spec.buttonText || 'Отвори интерактивния аплет');
    var host = document.createElement('div');
    host.className = 'ggb-host';
    btn.addEventListener('click', function () {
      btn.remove();
      Store.log('geogebra_open', { app: spec.appName || 'graphing' });
      mount(host, spec);
    });
    wrap.appendChild(btn);
    wrap.appendChild(host);
    if (spec.caption) {
      var cap = document.createElement('p');
      cap.className = 'ggb-caption';
      cap.innerHTML = MathText.rich(spec.caption);
      wrap.appendChild(cap);
    }
    return wrap;
  }

  /** Външна връзка към готов материал в geogebra.org */
  function linkBlock(link) {
    var a = document.createElement('a');
    a.className = 'btn btn-ghost ggb-link';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = '<span class="ggb-mark">GeoGebra</span> ' + MathText.rich(link.text) +
      '<span class="ext" aria-hidden="true">↗</span>';
    a.addEventListener('click', function () { Store.log('geogebra_link', { url: link.url }); });
    return a;
  }

  global.GeoGebra = { mount: mount, lazyBlock: lazyBlock, linkBlock: linkBlock };
})(window);
