/* Local fusion adapter. Original atlas UI and controller remain authoritative.
 * Map data stays inside the local parent/terrain iframe pair. No network calls.
 */
(function (root) {
  'use strict';
  const CHANNEL = 'jiangshan-fusion';
  const KM_PER_DEGREE = Math.PI * 6378.137 / 180;
  const finite = Number.isFinite;
  function validCoord(value) {
    return Array.isArray(value) && value.length === 2 && value.every(finite) &&
      Math.abs(value[0]) <= 180 && Math.abs(value[1]) < 85.1;
  }
  function readView(app, rect) {
    const c = app.camera;
    const ratio = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : c.w / c.h;
    return {
      center: app.projector.toGeo(c.x + c.w / 2, c.y + c.h / 2),
      // SVG uses xMidYMid meet, so a wide viewport also exposes the side margins.
      // This is projected Mercator distance, matching the terrain plane (no cos(lat)).
      widthKm: Math.max(c.w, c.h * ratio) / app.projector.scale * KM_PER_DEGREE,
    };
  }
  function cameraForView(app, rect, center, widthKm) {
    if (!validCoord(center) || !finite(widthKm) || widthKm < 1 || widthKm > 50000) return null;
    const c = app.camera;
    const ratio = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : c.w / c.h;
    const visibleW = widthKm / KM_PER_DEGREE * app.projector.scale;
    const w = visibleW / Math.max(1, c.h / c.w * ratio);
    const h = w * c.h / c.w;
    const p = app.projector.toScreen(center[0], center[1]);
    return { x: p[0] - w / 2, y: p[1] - h / 2, w, h, zoom: 1000 / w };
  }
  function shortcutInit(message) {
    const codes = { Escape: 'Escape', '/': 'Slash', k: 'KeyK',
      ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ' ': 'Space' };
    if (!message || !Object.prototype.hasOwnProperty.call(codes, message.key)) return null;
    for (const modifier of ['shiftKey', 'ctrlKey', 'metaKey']) {
      if (message[modifier] !== undefined && typeof message[modifier] !== 'boolean') return null;
    }
    if (message.key === 'k' && message.ctrlKey !== true && message.metaKey !== true) return null;
    return { key: message.key, code: codes[message.key], bubbles: true, cancelable: true,
      shiftKey: message.shiftKey === true, ctrlKey: message.ctrlKey === true, metaKey: message.metaKey === true };
  }
  const helpers = { validCoord, readView, cameraForView, shortcutInit, CHANNEL };
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (!root || !root.document) return;
  root.JiangshanFusionGeometry = helpers;

  function install() {
    const app = root.atlasApp;
    const doc = root.document;
    const viewport = doc.getElementById('viewport-frame');
    if (!app || !viewport || !app.svg || root.atlasFusion) return;
    let active = false;
    let ready = false;
    let applyingChild = false;
    let queued = false;
    let sequence = 0;
    let lastSignature = '';
    let lastSceneKey = '';
    let pendingReason = 'controller';
    let view = 'relief';
    let exaggeration = 20;
    const surfaceBounds = [40, -10, 165, 70];
    const mapSurface = root.JiangshanMapSurface?.create({ app, svg: app.svg });
    let surfaceTimer, surfaceRequest = 0, surfaceKey = '', surfaceBaseKey = '', surfaceBasePendingId = -1;
    const ids = new WeakMap();
    let nextId = 0;
    const id = value => {
      if (!value || typeof value !== 'object') return '';
      if (!ids.has(value)) ids.set(value, ++nextId);
      return ids.get(value);
    };

    const frame = doc.createElement('iframe');
    frame.id = 'fusion-terrain';
    frame.title = '三维地形历史地图';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // Source is fixed, never obtained from an incoming message or user text.
    frame.src = 'terrain.html?embedded=1&v=atlas-20261117-2';
    viewport.insertBefore(frame, viewport.firstChild);

    const strip = doc.querySelector('#nav-bar .control-strip');
    const modes = doc.createElement('div');
    modes.className = 'fusion-mode-switch';
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', '地图显示模式');
    modes.innerHTML = '<button type="button" id="fusion-flat" aria-pressed="true">平面</button>' +
      '<button type="button" id="fusion-3d" aria-pressed="false">3D 地形</button>';
    strip.insertBefore(modes, strip.firstChild);

    const section = doc.createElement('section');
    section.className = 'layers-pop-section fusion-settings';
    section.innerHTML = '<div class="layers-pop-heading">3D 地形视角</div>' +
      '<div class="fusion-view-options" role="group" aria-label="三维视角">' +
      '<button type="button" data-view="map" aria-pressed="false">地图</button>' +
      '<button type="button" data-view="relief" aria-pressed="true">斜俯</button>' +
      '<button type="button" data-view="top" aria-pressed="false">正上</button>' +
      '<button type="button" data-view="east" aria-pressed="false">东望</button></div>' +
      '<label class="fusion-height">地形起伏 <input id="fusion-height" type="range" min="1" max="120" step="1" value="20"><output id="fusion-height-value">20×</output></label>' +
      '<p class="fusion-help">原版地图铺在真实地形上。点击地名或双击地图查看沿革；拖动平移，右键或 Shift 拖动旋转。小试使用平面地图。</p>';
    doc.getElementById('layers-popover').appendChild(section);
    const status = doc.createElement('div');
    status.id = 'fusion-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    viewport.appendChild(status);
    let statusTimer;
    function announce(text) {
      status.textContent = text;
      status.classList.add('is-visible');
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => status.classList.remove('is-visible'), 4500);
    }
    function post(message) {
      if (message.type === 'surface') {
        frame.dataset.surfaceRenderMs = String(Math.round(message.renderMs || 0));
        frame.dataset.surfaceQuality = message.quality;
      }
      if (frame.contentWindow) frame.contentWindow.postMessage({ channel: CHANNEL, ...message }, '*');
    }
    function requestSurface(sceneKey, cameraView) {
      const key = JSON.stringify([sceneKey, cameraView]);
      if (key === surfaceKey) return;
      surfaceKey = key;
      const request = ++surfaceRequest;
      clearTimeout(surfaceTimer);
      surfaceTimer = setTimeout(async () => {
        if (!active || request !== surfaceRequest) return;
        try {
          if (!mapSurface) throw new Error('Missing original map surface');
          if (surfaceBaseKey !== sceneKey) {
            const started = root.performance.now();
            const base = await mapSurface.render({ bounds: surfaceBounds, width: 2048, height: 2048 });
            if (!active || request !== surfaceRequest || sceneKey !== lastSceneKey) return;
            surfaceBasePendingId = request * 2;
            post({ type: 'surface', quality: 'base', sceneKey, renderId: request * 2, renderMs: root.performance.now() - started, ...base });
          }
          const rect = app.svg.getBoundingClientRect();
          const p = app.projector.toScreen(...cameraView.center);
          const halfW = cameraView.widthKm / KM_PER_DEGREE * app.projector.scale * 1.2;
          const halfH = halfW * rect.height / Math.max(1, rect.width);
          const nw = app.projector.toGeo(p[0] - halfW, p[1] - halfH);
          const se = app.projector.toGeo(p[0] + halfW, p[1] + halfH);
          const bounds = [Math.max(surfaceBounds[0], nw[0]), Math.max(surfaceBounds[1], se[1]),
            Math.min(surfaceBounds[2], se[0]), Math.min(surfaceBounds[3], nw[1])];
          if (bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) return;
          const started = root.performance.now();
          const detail = await mapSurface.render({ bounds, width: 3072, height: 3072 });
          if (!active || request !== surfaceRequest || sceneKey !== lastSceneKey) return;
          post({ type: 'surface', quality: 'detail', sceneKey, renderId: request * 2 + 1, renderMs: root.performance.now() - started, ...detail });
        } catch (error) {
          if (active && request === surfaceRequest) {
            console.error('Original map surface:', error);
            post({ type: 'surface-error', sceneKey });
            announce('原版地图暂未铺到地形，可切回平面继续查看。');
          }
        }
      }, 160);
    }
    const checked = name => {
      const el = doc.getElementById('chk-' + name);
      return Boolean(el && el.checked);
    };
    function layers() {
      return { polities: checked('polities'), settlements: checked('settlements'),
        prefectures: checked('prefectures'), corridors: checked('corridors'),
        hydro: checked('terrain'), modernProvinces: checked('provinces'), modernProvinceNames: checked('prov-names'), milestones: checked('milestones') };
    }
    function locations() {
      const dynasty = app.dynasties[app.dynastyIdx] || {};
      const city = (dynasty.settlements || [])
        .filter(s => validCoord(s.coord) && (s.appear === undefined || app.year >= s.appear) &&
          (s.vanish === undefined || app.year < s.vanish))
        .map(s => ({ name: app._settlementAncient(s, app.year), coord: s.coord, kind: 'city' }));
      const events = app.activePerson ? app.activePerson.events || [] : app.activeCustomRoute || [];
      const stops = events.map((s, index) => ({ name: s.siteZh || s.query || s.name || '',
        coord: s.coord || [s.lng, s.lat], kind: 'journey', year: s.year, index,
        trackIdx: s.personIdx || s.trackIdx || 0, tint: s.personColor }))
        .filter(s => validCoord(s.coord));
      if (validCoord(app.activeTrace)) stops.push({ name: '沿革地点', coord: app.activeTrace, kind: 'selected' });
      const milestones = checked('milestones') ? (dynasty.milestones || []).flatMap((m, index) =>
        app._getMilestoneAnchors(dynasty, m).filter(a => validCoord(a.coord)).map(a => ({
          name: app.milestoneHeadline(dynasty, m), coord: a.coord, year: m.year,
          kind: 'event', index,
        }))) : [];
      return city.concat(stops, milestones);
    }
    function snapshot() {
      const snap = app.svg.classList.contains('is-awaiting-snapshot') ? {} : app.lastRenderedSnap || {};
      const copy = items => (items || []).filter(s => s.shape).map(s => ({ title: s.title,
        tint: s.tint, category: s.role || s.category, anchor: s.anchor, shape: s.shape }));
      return { polities: copy(snap.polities), regions: copy(snap.regions), prefectures: copy(snap.prefectures) };
    }
    function overlays() {
      const hydro = app.hydroData || {};
      const visible = s => typeof app._isHydroVisible !== 'function' || app._isHydroVisible(s, app.year);
      return {
        rivers: (hydro.rivers || []).filter(visible).map(s => ({ lines: s.lines, name: s.nameZh || s.name })),
        lakes: (hydro.lakes || []).filter(visible).map(s => ({ rings: s.rings, name: s.nameZh || s.name })),
        corridors: (app.corridors || []).filter(s => !s.span || (app.year >= s.span[0] && app.year <= s.span[1]))
          .map(s => ({ segments: s.segments, title: app.corridorTitle(s) })),
        provinces: (app.provinces || []).filter(s => s.rings).map(s => ({ title: s.name,
          shape: { type: 'MultiPolygon', coordinates: s.rings } })),
      };
    }
    function sync(reason = 'controller', force = false) {
      if (!ready || applyingChild) return;
      const cameraView = readView(app, app.svg.getBoundingClientRect());
      const layerState = layers();
      const person = app.activePerson;
      const selection = { personKey: person && (person.profiles || [person.profile]).filter(Boolean).map(p => p.key).join(','),
        personTitle: person && person.profile && (person.profile.zh || person.profile.titleZh),
        stopIndex: person ? app.activePersonEventIdx : app.customRouteStopIdx,
        traceCoord: app.activeTrace };
      // Scene identity intentionally excludes the camera, activation and transport sequence.
      // The child can retain its textures and labels while applying a view-only update.
      const sceneKey = JSON.stringify([app.year, layerState, selection, app.locale,
        id(app.lastRenderedSnap), id(person), id(app.activeCustomRoute), app.activeHydroMask,
        app.activeSettlementMask, app.activeCorridorMask, app.svg.classList.contains('is-awaiting-snapshot')]);
      const signature = JSON.stringify([active, cameraView, sceneKey]);
      if (!force && signature === lastSignature) return;
      lastSignature = signature;
      const fullScene = active && (force || reason !== 'child-view' || sceneKey !== lastSceneKey);
      if (sceneKey !== lastSceneKey) { surfaceBaseKey = ''; surfaceBasePendingId = -1; }
      lastSceneKey = sceneKey;
      post({ type: 'state', active, reason, seq: ++sequence, sceneKey, year: Math.round(app.year),
        ...cameraView, locations: fullScene ? locations() : [], selection,
        snapshot: fullScene ? snapshot() : { polities: [] }, layers: layerState, overlays: fullScene ? overlays() : {} });
      if (active) requestSurface(sceneKey, cameraView);
    }
    function schedule(reason = 'controller') {
      if (applyingChild) return;
      pendingReason = reason;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        // A native atlas flight can update its camera every frame. Transmit its settled destination.
        if (!app.flyRaf) sync(pendingReason);
      });
    }
    function configure() {
      section.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
      post({ type: 'config', view, exaggeration });
    }
    function setMode(next, explanation) {
      if (next && app.challenge) {
        announce('小试需要在平面地图答题，结束后可切换 3D。');
        return;
      }
      active = Boolean(next);
      if (!active) { clearTimeout(surfaceTimer); surfaceRequest++; surfaceKey = ''; }
      viewport.classList.toggle('fusion-is-3d', active);
      frame.setAttribute('aria-hidden', String(!active));
      frame.tabIndex = active ? 0 : -1;
      doc.getElementById('fusion-flat').setAttribute('aria-pressed', String(!active));
      doc.getElementById('fusion-3d').setAttribute('aria-pressed', String(active));
      if (active && !ready) announce('正在载入本地三维地形…');
      if (explanation) announce(explanation);
      sync('activate', true);
      if (active) configure();
    }
    doc.getElementById('fusion-flat').addEventListener('click', () => setMode(false));
    doc.getElementById('fusion-3d').addEventListener('click', () => setMode(true));
    section.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      view = button.dataset.view;
      setMode(true);
      configure();
    }));
    doc.getElementById('fusion-height').addEventListener('input', event => {
      exaggeration = Number(event.target.value);
      doc.getElementById('fusion-height-value').value = exaggeration + '×';
      configure();
    });
    // Observe controller operations, including async snapshot rendering, without editing upstream JS.
    ['jumpToYear', '_applyCamera', '_renderPolitiesAndPrefectures', '_renderSettlements',
      '_buildTerrainRivers', '_renderCorridors', 'openGenealogyAt', 'closeGenealogyCard',
      'openPersonChronicle', 'selectPersonEvent', '_renderPersonChronicleCard', '_clearActivePerson',
      '_clearActiveTrace', 'selectCustomRouteStop', 'clearCustomRoute', '_drawCustomRouteOverlay', 'applyLocale']
      .forEach(name => {
        const original = app[name];
        if (typeof original !== 'function') return;
        app[name] = function (...args) {
          const result = original.apply(this, args);
          schedule();
          return result;
        };
      });
    const openChallenge = app._openChallenge;
    app._openChallenge = function (...args) {
      if (active) setMode(false, '已切换平面地图，继续原版小试。');
      return openChallenge.apply(this, args);
    };
    // The lazy quiz installs startChallenge on the controller prototype. Guard the
    // instance after loading too, including a switch back to 3D while loading.
    let guardedQuizStart;
    function guardQuizStart() {
      const start = app.startChallenge;
      if (typeof start !== 'function' || start === guardedQuizStart) return;
      guardedQuizStart = function (...args) {
        if (active) setMode(false, '已切换平面地图，继续原版小试。');
        return start.apply(this, args);
      };
      app.startChallenge = guardedQuizStart;
    }
    const ensureQuiz = app._ensureQuiz;
    if (typeof ensureQuiz === 'function') app._ensureQuiz = function (...args) {
      return ensureQuiz.apply(this, args).then(ok => {
        if (ok) guardQuizStart();
        return ok;
      });
    };
    guardQuizStart();
    doc.addEventListener('change', event => {
      if (event.target.id && event.target.id.startsWith('chk-')) schedule();
    });
    root.addEventListener('message', event => {
      const message = event.data;
      if (event.source !== frame.contentWindow || !message || message.channel !== CHANNEL) return;
      // file:// has an opaque origin; source identity is the security boundary there.
      if (root.location.protocol !== 'file:' && event.origin !== root.location.origin) return;
      if (message.type === 'ready') {
        ready = true;
        surfaceBaseKey = ''; surfaceBasePendingId = -1; surfaceKey = ''; surfaceRequest++;
        configure();
        sync('activate', true);
      } else if (message.type === 'surface-applied' && message.quality === 'base' && message.sceneKey === lastSceneKey && message.renderId === surfaceBasePendingId) {
        surfaceBaseKey = message.sceneKey;
      } else if (message.type === 'applied' && Number.isInteger(message.seq) && message.seq === sequence) {
        status.classList.remove('is-visible');
      } else if (message.type === 'shortcut' && active) {
        const init = shortcutInit(message);
        // The atlas owns its keyboard handler on window. A bubbling document event
        // follows that same path without pretending a parent input received this key.
        if (init) doc.dispatchEvent(new root.KeyboardEvent('keydown', init));
      } else if (message.type === 'reset-view' && active) {
        app.resetCamera();
      } else if (message.type === 'view' && active) {
        const camera = cameraForView(app, app.svg.getBoundingClientRect(), message.center, message.widthKm);
        if (!camera) return;
        applyingChild = true;
        try {
          app._cancelCameraAnimation();
          app.camera = camera;
          app._applyCamera(true);
        } finally { applyingChild = false; }
        sync('child-view');
      } else if (message.type === 'trace' && active && validCoord(message.coord)) {
        app.openGenealogyAt(message.coord[0], message.coord[1]);
      } else if (message.type === 'event' && active && Number.isInteger(message.year) &&
        message.year >= app.minYear && message.year <= app.maxYear && validCoord(message.coord)) {
        let closest;
        let distance = Infinity;
        app.dynasties.forEach(d => (d.milestones || []).forEach(m => {
          if (m.year !== message.year) return;
          app._getMilestoneAnchors(d, m).forEach(a => {
            if (!validCoord(a.coord)) return;
            const km = app.projector.greatCircleKm(a.coord, message.coord);
            if (km < distance) { distance = km; closest = { dynasty: d, milestone: m }; }
          });
        }));
        if (closest && distance < 5) {
          app.stopAutoplay();
          app.jumpToYear(app._clampYearToDynasty(closest.dynasty, message.year));
          app.openMilestoneBalloon(closest.dynasty, closest.milestone);
          app._frameMilestoneAnchors(closest.dynasty, closest.milestone, { isMapChange: false });
        }
      } else if (message.type === 'request-flat' && active) {
        setMode(false, message.reason === 'surface' ? '已保留定位并切回平面地图，可继续浏览原图。' : '此位置超出当前三维高程覆盖，已保留定位并切换平面地图。');
      } else if (message.type === 'journey-step' && active && Number.isInteger(message.index)) {
        const events = app.activePerson ? app.activePerson.events : app.activeCustomRoute;
        if (!events || message.index < 0 || message.index >= events.length) return;
        if (app.activePerson) app.selectPersonEvent(message.index, true);
        else app.selectCustomRouteStop(message.index, true);
      }
    });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => schedule()).observe(viewport);
    app.svg.addEventListener('load', () => {
      if (active) { surfaceKey = ''; schedule(); requestSurface(lastSceneKey, readView(app, app.svg.getBoundingClientRect())); }
    }, true);
    root.addEventListener('resize', () => schedule());
    root.atlasFusion = { setMode, sync, get active() { return active; }, get ready() { return ready; } };
  }
  // Deferred scripts run at readyState=interactive before app.js's earlier
  // DOMContentLoaded listener creates the controller. Wait for that listener.
  if (!root.atlasApp && root.document.readyState !== 'complete') root.addEventListener('DOMContentLoaded', install);
  else install();
})(typeof window !== 'undefined' ? window : null);
