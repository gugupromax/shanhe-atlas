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
  function isCurrentMapPick(message, sceneKey, year) {
    return Boolean(sceneKey && message.sceneKey === sceneKey && message.year === year &&
      validCoord(message.coord));
  }
  function renderedSettlementLocations(group, getStyle) {
    return Array.from(group.querySelectorAll('.settlement-node:not(.is-pass)'))
      .filter(node => getStyle(node).display !== 'none')
      .map(({ dataset }) => ({
        name: dataset.ancient,
        coord: [dataset.lng?.trim() ? Number(dataset.lng) : NaN,
          dataset.lat?.trim() ? Number(dataset.lat) : NaN],
        kind: 'city',
      }))
      .filter(city => city.name && validCoord(city.coord));
  }
  function tangTileTier(app, layers, protocol) {
    if (app.year !== 741 || app.locale !== 'zh' || protocol === 'file:' ||
        app.activePerson || app.activeCustomRoute || app.activeTrace || app.activePolity ||
        layers.modernProvinceNames ||
        !['polities','settlements','prefectures','corridors','hydro','modernProvinces','milestones']
          .every(name => layers[name] === true)) return null;
    const classes = app.svg.classList;
    if (classes.contains('is-tang741-counties')) return 'near';
    return classes.contains('is-tang741-overview') || !classes.contains('is-zoomed-cities') ? 'far' : 'mid';
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
  const helpers = { validCoord, readView, cameraForView, shortcutInit, isCurrentMapPick,
    renderedSettlementLocations, tangTileTier, CHANNEL };
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (!root || !root.document) return;
  root.JiangshanFusionGeometry = helpers;

  function install() {
    const app = root.atlasApp;
    const doc = root.document;
    const viewport = doc.getElementById('viewport-frame');
    if (!app || !viewport || !app.svg || root.atlasFusion) return;
    let active = false;
    let ready = false, surfaceBitmaps = false, baseDrawAck = false, detailTextureLimit = 3072;
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
    const tilesPackaged = doc.getElementById('atlas-app-script')?.dataset?.tangTiles !== 'absent';
    let surfaceTimer, surfaceRequest = 0, surfaceKey = '', surfaceBaseKey = '', surfaceBasePendingId = -1;
    let surfaceGeneration = 0, surfaceRenderJob = null, queuedSurface = null;
    let detailAcknowledged = false;
    let startupTimer, presented = false;
    let pendingChildCamera = null;
    let lastTileTier = null, tilesFailed = false;
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
      '<label class="fusion-height" title="地形高程的垂直放大倍数">地形起伏 <input id="fusion-height" type="range" min="1" max="120" step="1" value="20"><output id="fusion-height-value">20×</output></label>' +
      '<p class="fusion-help">原版地图铺在真实地形上。点击地名或双击地图查看沿革；拖动平移，右键或 Shift 拖动旋转。小试使用平面地图。</p>';
    doc.getElementById('layers-popover').appendChild(section);
    const status = doc.createElement('div');
    status.id = 'fusion-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    viewport.appendChild(status);
    let statusTimer;
    function announce(text, keepVisible = false) {
      status.textContent = text;
      status.classList.add('is-visible');
      clearTimeout(statusTimer);
      if (!keepVisible) statusTimer = setTimeout(() => status.classList.remove('is-visible'), 4500);
    }
    function armTerrainStartup(stage) {
      clearTimeout(startupTimer);
      const terrainStage = stage === 'terrain';
      const applying = stage === 'apply';
      const sceneKey = lastSceneKey, renderId = surfaceBasePendingId;
      if (!presented) announce(terrainStage ? '正在载入三维地形…' :
        applying ? '正在显示当前年份的三维地图…' : '正在同步当前年份的地图…', true);
      startupTimer = setTimeout(() => {
        if (!active || (applying ? lastSceneKey !== sceneKey || surfaceBasePendingId !== renderId : presented)) return;
        failTerrain(terrainStage ? '三维地形初始化超时，已返回平面地图。' :
          applying ? '当前年份的三维首图未能显示，已返回平面地图。' : '当前年份的三维地图加载超时，已返回平面地图。');
      }, terrainStage ? 60000 : 45000);
    }
    function presentTerrain(show) {
      presented = show;
      viewport.classList.toggle('fusion-is-3d', show);
      frame.setAttribute('aria-hidden', String(!show));
      frame.tabIndex = show ? 0 : -1;
      if (show) {
        root.performance?.clearMarks?.('atlas-3d:interactive');
        root.performance?.mark?.('atlas-3d:interactive');
        clearTimeout(startupTimer);
        status.classList.remove('is-visible');
      }
    }
    function failTerrain(message) {
      // Losing the WebGL context can also happen while the user is viewing the flat map.
      // Discard the broken frame now so the next 3D request creates a working context.
      ready = false;
      surfaceBaseKey = '';
      surfaceBasePendingId = -1;
      surfaceRenderJob = null;
      frame.removeAttribute('src');
      if (active) setMode(false, message);
    }
    function post(message) {
      if (message.type === 'surface') {
        frame.dataset.surfaceRenderMs = String(Math.round(message.renderMs || 0));
        frame.dataset.surfaceQuality = message.quality;
      }
      if (message.bitmap) {
        try {
          frame.contentWindow.postMessage({ channel: CHANNEL, ...message }, '*', [message.bitmap]);
        } catch (error) {
          message.bitmap.close();
          throw error;
        }
      } else if (frame.contentWindow) frame.contentWindow.postMessage({ channel: CHANNEL, ...message }, '*');
    }
    function detailBounds(cameraView, padding = 1.2) {
      const rect = app.svg.getBoundingClientRect();
      const p = app.projector.toScreen(...cameraView.center);
      const halfW = cameraView.widthKm / KM_PER_DEGREE * app.projector.scale * padding;
      const halfH = halfW * rect.height / Math.max(1, rect.width);
      const nw = app.projector.toGeo(p[0] - halfW, p[1] - halfH);
      const se = app.projector.toGeo(p[0] + halfW, p[1] + halfH);
      const bounds = [Math.max(surfaceBounds[0], nw[0]), Math.max(surfaceBounds[1], se[1]),
        Math.min(surfaceBounds[2], se[0]), Math.min(surfaceBounds[3], nw[1])];
      return bounds[0] < bounds[2] && bounds[1] < bounds[3] ? bounds : null;
    }
    function suspendSurface() {
      clearTimeout(surfaceTimer);
      surfaceRequest++;
      surfaceGeneration++;
      // An in-flight base may be dropped when the child goes inactive. Retry it on return.
      surfaceBasePendingId = -1;
      if (!detailAcknowledged) surfaceKey = '';
      queuedSurface = null;
    }
    function requestSurface(sceneKey, cameraView) {
      if (pendingChildCamera || lastTileTier) return;
      const key = JSON.stringify([sceneKey, cameraView]);
      if (key === surfaceKey) return;
      surfaceKey = key;
      detailAcknowledged = false;
      const request = ++surfaceRequest;
      const generation = surfaceGeneration;
      clearTimeout(surfaceTimer);
      const run = async () => {
        if (!active || request !== surfaceRequest) return;
        if (surfaceRenderJob !== null) { queuedSurface = run; return; }
        surfaceRenderJob = request;
        const currentScene = () => active && !pendingChildCamera &&
          generation === surfaceGeneration && sceneKey === lastSceneKey;
        try {
          if (!mapSurface) throw new Error('Missing original map surface');
          if (surfaceBaseKey !== sceneKey && surfaceBasePendingId < 0) {
            const started = root.performance.now();
            const size = Math.min(1024, detailTextureLimit);
            const base = await mapSurface.render({ bounds: surfaceBounds, width: size, height: size,
              bitmap: surfaceBitmaps, screenPasses: true, screenAdmin: true, screenLabels: app.year === 741 });
            if (!currentScene()) { base.bitmap?.close(); return; }
            surfaceBasePendingId = request * 2;
            post({ type: 'surface', quality: 'base', sceneKey, renderId: request * 2, renderMs: root.performance.now() - started, ...base });
            if (baseDrawAck) armTerrainStartup('apply');
          }
          // Give the embedded view a frame to upload and draw the base before the costly detail capture.
          if (baseDrawAck && surfaceBasePendingId >= 0) return;
          if (!currentScene() || request !== surfaceRequest) return;
          const bounds = detailBounds(cameraView);
          if (!bounds) return;
          const started = root.performance.now();
          const detail = await mapSurface.render({ bounds, width: detailTextureLimit, height: detailTextureLimit,
            bitmap: surfaceBitmaps, screenPasses: true, screenAdmin: true, screenLabels: app.year === 741 });
          if (!currentScene() || request !== surfaceRequest) { detail.bitmap?.close(); return; }
          post({ type: 'surface', quality: 'detail', sceneKey, renderId: request * 2 + 1, renderMs: root.performance.now() - started, ...detail });
        } catch (error) {
          if (currentScene() && request === surfaceRequest) {
            if (surfaceBitmaps && error.name === 'DataCloneError') {
              surfaceBitmaps = false;
              surfaceKey = ''; surfaceBasePendingId = -1;
              requestSurface(sceneKey, cameraView);
              return;
            }
            console.error('Original map surface:', error);
            if (!presented) {
              failTerrain('三维贴图生成失败，已保留平面地图。可以再次点击 3D 地形重试。');
            } else {
              post({ type: 'surface-error', sceneKey });
              announce('原版地图暂未铺到地形，可切回平面继续查看。');
            }
          }
        } finally {
          if (surfaceRenderJob === request) {
            surfaceRenderJob = null;
            const queued = queuedSurface;
            queuedSurface = null;
            if (queued) await queued();
          }
        }
      };
      surfaceTimer = setTimeout(run, 160);
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
      // Reuse the displayed seats so 3D picks share the map's historical names and coordinates.
      const city = renderedSettlementLocations(app.grpSettlements, node => root.getComputedStyle(node));
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
      return stops.concat(milestones, city);
    }
    function sync(reason = 'controller', force = false) {
      if (!ready || applyingChild) return;
      const cameraView = readView(app, app.svg.getBoundingClientRect());
      const layerState = layers();
      if (app.year !== 741) tilesFailed = false;
      const tileTier = tilesPackaged && !tilesFailed ? tangTileTier(app, layerState, root.location.protocol) : null;
      const passLayerActive = layerState.corridors && !app.challenge;
      const revealPasses = passLayerActive && app.camera?.w <= 500;
      const area = app.activeMapArea;
      const screenHighlight = tileTier || area?.highlight?.point || (app.year === 741 && area?.highlight?.segments);
      const person = app.activePerson;
      const selection = { personKey: person && (person.profiles || [person.profile]).filter(Boolean).map(p => p.key).join(','),
        personTitle: person && person.profile && (person.profile.zh || person.profile.titleZh),
        stopIndex: person ? app.activePersonEventIdx : app.customRouteStopIdx,
        traceCoord: app.activeTrace };
      const adminDetail = [
        id(app.grpSettlements?.firstElementChild),
        app.svg.classList.contains('is-admin-overview'),
        app.svg.classList.contains('is-admin-counties'),
        app.svg.classList.contains('is-zoomed-cities'),
        app.svg.classList.contains('is-mobile-zoomed-detail'),
      ];
      // Scene identity excludes raw camera coordinates, activation and transport sequence.
      // The child can retain its textures and labels while applying a view-only update.
      const sceneKey = JSON.stringify([app.year, layerState, selection, app.locale,
        id(app.lastRenderedSnap), id(person), id(app.activeCustomRoute), screenHighlight ? '' : id(area), adminDetail, tileTier, revealPasses, app.activeHydroMask,
        app.activeSettlementMask, app.activeCorridorMask, app.svg.classList.contains('is-awaiting-snapshot')]);
      const signature = JSON.stringify([active, cameraView, sceneKey, screenHighlight ? id(area) : '']);
      if (!force && signature === lastSignature) {
        if (active && !surfaceKey) requestSurface(sceneKey, cameraView);
        return;
      }
      lastSignature = signature;
      const fullScene = active && (force || sceneKey !== lastSceneKey);
      if (sceneKey !== lastSceneKey) {
        if (active && !presented && lastSceneKey && baseDrawAck) armTerrainStartup('map');
        surfaceGeneration++; surfaceBaseKey = ''; surfaceBasePendingId = -1;
        surfaceKey = ''; detailAcknowledged = false;
      }
      lastSceneKey = sceneKey;
      lastTileTier = tileTier;
      post({ type: 'state', active, reason, seq: ++sequence, sceneKey, year: Math.round(app.year),
        ...cameraView, locations: fullScene ? locations() : [], selection,
        adminLabels: fullScene
          ? root.JiangshanMapSurface.adminScreenLabels(app, node => root.getComputedStyle(node)) : [],
        passLabels: fullScene && passLayerActive
          ? root.JiangshanMapSurface.passScreenLabels(app, node => root.getComputedStyle(node), revealPasses) : [],
        tileTier, tileBounds: tileTier ? detailBounds(cameraView, .72) : null,
        areaHighlight: screenHighlight ? area?.highlight : null,
        areaHighlightId: screenHighlight ? id(area) : 0,
        layers: layerState });
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
    function applyChildCamera(camera) {
      applyingChild = true;
      try {
        app._cancelCameraAnimation();
        app.camera = camera;
        app._applyCamera(true);
      } finally { applyingChild = false; }
    }
    function setMode(next, explanation) {
      if (next && app.challenge) {
        announce('小试需要在平面地图答题，结束后可切换 3D。');
        return;
      }
      const starting = Boolean(next) && !active;
      if (starting) {
        tilesFailed = false;
        root.performance?.clearMarks?.('atlas-3d:open');
        root.performance?.mark?.('atlas-3d:open');
      }
      active = Boolean(next);
      if (!active) {
        const camera = pendingChildCamera;
        pendingChildCamera = null;
        if (camera) applyChildCamera(camera);
        suspendSurface();
        clearTimeout(startupTimer);
        clearTimeout(statusTimer);
        status.classList.remove('is-visible');
        presentTerrain(false);
      }
      // Keep the flat map responsive until the user actually requests WebGL.
      if (starting && !frame.getAttribute('src')) {
        const version = doc.getElementById('atlas-app-script')?.dataset?.vTerrain;
        frame.src = 'terrain.html?embedded=1' + (version ? '&v=' + encodeURIComponent(version) : '');
      }
      doc.getElementById('fusion-flat').setAttribute('aria-pressed', String(!active));
      doc.getElementById('fusion-3d').setAttribute('aria-pressed', String(active));
      if (explanation) announce(explanation);
      sync('activate', true);
      if (starting) {
        if (ready && surfaceBaseKey && surfaceBaseKey === lastSceneKey) presentTerrain(true);
        else armTerrainStartup(ready ? 'map' : 'terrain');
      }
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
      'openMapAreaAt', 'closeMapArea', 'openMapSettlementAt',
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
      if (event.target.id?.startsWith('chk-')) schedule();
    });
    root.addEventListener('message', event => {
      const message = event.data;
      if (event.source !== frame.contentWindow || !message || message.channel !== CHANNEL) return;
      // file:// has an opaque origin; source identity is the security boundary there.
      if (root.location.protocol !== 'file:' && event.origin !== root.location.origin) return;
      if (message.type === 'ready') {
        ready = true;
        surfaceBitmaps = message.surfaceBitmaps === true && typeof root.createImageBitmap === 'function';
        baseDrawAck = message.baseDrawAck === true;
        detailTextureLimit = Number.isSafeInteger(message.maxTextureSize) && message.maxTextureSize > 0
          ? Math.min(3072, message.maxTextureSize) : 3072;
        if (active && !presented) armTerrainStartup('map');
        tilesFailed = false;
        surfaceBaseKey = ''; surfaceBasePendingId = -1; surfaceKey = ''; surfaceRequest++; surfaceGeneration++;
        configure();
        sync('activate', true);
      } else if (message.type === 'surface-applied' && message.quality === 'base' && message.sceneKey === lastSceneKey && message.renderId === surfaceBasePendingId) {
        surfaceBaseKey = message.sceneKey;
        if (active && !presented) presentTerrain(true);
        if (active && baseDrawAck) armTerrainStartup('apply');
      } else if (message.type === 'surface-drawn' && active && baseDrawAck && message.sceneKey === lastSceneKey &&
                 surfaceBaseKey === lastSceneKey && message.renderId === surfaceBasePendingId) {
        clearTimeout(startupTimer);
        surfaceBasePendingId = -1;
        surfaceKey = '';
        requestSurface(lastSceneKey, readView(app, app.svg.getBoundingClientRect()));
      } else if (message.type === 'surface-applied' && message.quality === 'detail' && active &&
                 message.sceneKey === lastSceneKey && message.renderId === surfaceRequest * 2 + 1) {
        detailAcknowledged = true;
      } else if (message.type === 'tiles-ready' && active && lastTileTier && message.sceneKey === lastSceneKey) {
        surfaceBaseKey = message.sceneKey;
        if (!presented) presentTerrain(true);
      } else if (message.type === 'tiles-error' && active && lastTileTier && message.sceneKey === lastSceneKey) {
        tilesFailed = true;
        sync('controller', true);
      } else if (message.type === 'terrain-error') {
        failTerrain('三维地形加载失败，已保留平面地图。可以再次点击 3D 地形重试。');
      } else if (message.type === 'applied' && message.seq === sequence && message.supported === false && active && !presented) {
        setMode(false, '当前位置超出三维高程范围，已保留平面地图。');
      } else if (message.type === 'shortcut' && active) {
        const init = shortcutInit(message);
        // The atlas owns its keyboard handler on window. A bubbling document event
        // follows that same path without pretending a parent input received this key.
        if (init) doc.dispatchEvent(new root.KeyboardEvent('keydown', init));
      } else if (message.type === 'reset-view' && active) {
        pendingChildCamera = null;
        app.resetCamera();
      } else if (message.type === 'view-preview' && active) {
        const camera = cameraForView(app, app.svg.getBoundingClientRect(), message.center, message.widthKm);
        if (!camera) return;
        if (!pendingChildCamera) {
          clearTimeout(surfaceTimer);
          surfaceRequest++;
          surfaceKey = '';
          queuedSurface = null;
        }
        pendingChildCamera = camera;
      } else if (message.type === 'view' && active) {
        const camera = cameraForView(app, app.svg.getBoundingClientRect(), message.center, message.widthKm);
        if (!camera) return;
        pendingChildCamera = null;
        applyChildCamera(camera);
        sync('child-view');
      } else if (message.type === 'area-pick' && active && isCurrentMapPick(message, lastSceneKey, app.year)) {
        app.openMapAreaAt?.(...message.coord);
      } else if (message.type === 'place-pick' && active && isCurrentMapPick(message, lastSceneKey, app.year) &&
        typeof message.label === 'string' && message.label.length <= 200) {
        const areaKey = typeof message.areaKey === 'string' && message.areaKey.length <= 240
          ? message.areaKey : undefined;
        if (typeof app.openMapSettlementAt === 'function') app.openMapSettlementAt(...message.coord, message.label, areaKey);
        else app.openGenealogyAt(...message.coord);
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
      surfaceKey = '';
      detailAcknowledged = false;
      if (active) { schedule(); requestSurface(lastSceneKey, readView(app, app.svg.getBoundingClientRect())); }
    }, true);
    root.addEventListener('resize', () => schedule());
    root.atlasFusion = { setMode, sync, get active() { return active; }, get ready() { return ready; } };
  }
  // Deferred scripts run at readyState=interactive before app.js's earlier
  // DOMContentLoaded listener creates the controller. Wait for that listener.
  if (!root.atlasApp && root.ATLAS_SCRIPTS_READY) root.addEventListener('atlas-controller-ready', install, {once:true});
  else if (!root.atlasApp && root.document.readyState !== 'complete') root.addEventListener('DOMContentLoaded', install);
  else install();
})(typeof window !== 'undefined' ? window : null);
