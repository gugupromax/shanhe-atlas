/* Rasterize the live original atlas, without rebuilding its cartography.
 * Local assets only. The owner of the 3D view supplies Mercator texture UVs.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JiangshanMapSurface = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const MAX_SIZE = 4096;
  const TRANSIENT = ['is-hovered', 'is-panning', 'is-camera-moving', 'is-scrubbing', 'is-crosshair'];

  function projectedBounds(projector, bounds) {
    if (!projector || typeof projector.toScreen !== 'function') throw new Error('原地图投影尚未就绪');
    if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) {
      throw new Error('纹理范围需要四个有限数字 [西, 南, 东, 北]');
    }
    const [w, s, e, n] = bounds;
    if (!(w < e && s < n && w >= -180 && e <= 180 && s > -85.051129 && n < 85.051129)) {
      throw new Error('纹理范围超出墨卡托有效范围，或范围顺序错误');
    }
    const points = [[w, n], [e, n], [w, s], [e, s]].map(p => projector.toScreen(p[0], p[1]));
    if (!points.every(p => p && p.length === 2 && p.every(Number.isFinite))) throw new Error('原地图投影结果无效');
    const x = Math.min(...points.map(p => p[0]));
    const y = Math.min(...points.map(p => p[1]));
    const width = Math.max(...points.map(p => p[0])) - x;
    const height = Math.max(...points.map(p => p[1])) - y;
    if (!(width > 0 && height > 0)) throw new Error('原地图投影范围为空');
    return { x, y, width, height };
  }

  // Width/height are optional upper bounds. Preserve projected aspect, including
  // when the north/south Mercator span is larger than the longitude span.
  function textureSize(projected, width, height) {
    if (!projected || !(projected.width > 0 && projected.height > 0) ||
        !Number.isFinite(projected.width / projected.height)) throw new Error('纹理投影尺寸无效');
    for (const v of [width, height]) {
      if (v !== undefined && (!Number.isFinite(v) || v < 1)) throw new Error('纹理尺寸必须是正数');
    }
    const maxW = Math.min(MAX_SIZE, width === undefined ? MAX_SIZE : width);
    const maxH = Math.min(MAX_SIZE, height === undefined ? MAX_SIZE : height);
    const scale = Math.min(maxW / projected.width, maxH / projected.height);
    return { width: Math.max(1, Math.round(projected.width * scale)),
      height: Math.max(1, Math.round(projected.height * scale)) };
  }

  // Reading a file through the local launcher is allowed; internet origins and
  // redirects are deliberately rejected before fetch, even if called same-origin.
  function localAssetUrl(value, base) {
    const url = new URL(value, base);
    if (url.protocol === 'data:') {
      if (!/^data:image\/(?:png|webp|jpe?g|gif|svg\+xml|avif|bmp|x-icon)[;,]/i.test(url.href)) {
        throw new Error('纹理仅允许内嵌图片资源');
      }
      return url.href;
    }
    const origin = new URL(base);
    const loopback = ['localhost', '127.0.0.1', '[::1]'];
    const isLocalHttp = ['http:', 'https:'].includes(url.protocol) && loopback.includes(url.hostname) &&
      url.origin === origin.origin;
    const isLocalFile = url.protocol === 'file:' && origin.protocol === 'file:' && !url.hostname;
    if ((!isLocalHttp && !isLocalFile) || url.username || url.password) {
      throw new Error('原地图纹理拒绝非本机资源: ' + url.origin);
    }
    return url.href;
  }

  function create(options) {
    const app = options && options.app;
    const svg = options && options.svg;
    if (!app || !svg || !svg.ownerDocument) throw new Error('原地图 SVG 尚未就绪');
    const doc = svg.ownerDocument;
    const win = doc.defaultView;
    const assets = new Map();

    function readAsset(value, base) {
      const url = localAssetUrl(value, base || doc.baseURI);
      if (url.startsWith('data:')) return Promise.resolve(url);
      if (!assets.has(url)) {
        const promise = (async function () {
          const controller = new win.AbortController();
          const timer = win.setTimeout(() => controller.abort(), 20000);
          try {
            const response = await win.fetch(url, { credentials: 'same-origin', mode: 'same-origin',
              redirect: 'error', cache: 'force-cache', signal: controller.signal });
            if (!response.ok) throw new Error('图片读取失败: HTTP ' + response.status);
            const blob = await response.blob();
            if (!/^image\//i.test(blob.type)) throw new Error('本地纹理资源不是图片');
            return await new Promise((resolve, reject) => {
              const reader = new win.FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error('本地图片内嵌失败'));
              reader.readAsDataURL(blob);
            });
          } finally { win.clearTimeout(timer); }
        })();
        assets.set(url, promise);
        promise.catch(() => assets.delete(url));
      }
      return assets.get(url);
    }

    async function inlineCssUrls(css, base) {
      const matches = Array.from(css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi));
      const replacements = await Promise.all(matches.map(async m => {
        const value = m[1] || m[2] || m[3] || '';
        if (!value || value[0] === '#') return m[0];
        return 'url("' + await readAsset(value, base) + '")';
      }));
      let i = 0;
      return css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi, () => replacements[i++]);
    }

    async function stylesheetText() {
      const chunks = [];
      async function visit(rules, base) {
        for (const rule of Array.from(rules)) {
          // Do not reintroduce web-font or import requests into an SVG image.
          if (rule.type === 5 || rule.type === 7) continue;
          if (rule.type === 3) {
            localAssetUrl(rule.href, base);
            if (rule.styleSheet) await visit(rule.styleSheet.cssRules, rule.href);
          } else if (rule.type === 4) {
            // Evaluate against the map's current device, not the 4096px image.
            if (win.matchMedia(rule.conditionText).matches) await visit(rule.cssRules, base);
          } else if (rule.type === 12) {
            if (win.CSS.supports(rule.conditionText)) await visit(rule.cssRules, base);
          } else if (rule.selectorText) {
            // CSSStyleRule now exposes cssRules, including an empty list for
            // ordinary rules. Handle declarations before generic grouping, or
            // every fill/opacity/font declaration disappears in modern Chrome.
            // No hover/focus feedback should be baked into the terrain.
            const selectors = rule.selectorText.split(',')
              .filter(s => !/:(?:hover|active|focus(?:-visible|-within)?)(?![\w-])/.test(s))
              // The exported document is an SVG, so there is no HTML ancestor.
              // Keep locale-dependent map typography scoped to its own root.
              .map(s => s.replace(/\bhtml(?=\s*\[lang(?:\s*[~|^$*]?=|\s*\]))/gi, '#atlas-svg'));
            if (selectors.length) {
              const declarations = await inlineCssUrls(rule.style.cssText, base);
              const before = chunks.length;
              if (rule.cssRules && rule.cssRules.length) await visit(rule.cssRules, base);
              const inner = chunks.splice(before).join('\n');
              chunks.push(selectors.join(',') + '{' + declarations + inner + '}');
            }
          } else if (rule.cssRules) {
            // Keep non-style grouping semantics (e.g. @layer / @container),
            // while media/supports above are resolved against the live map.
            const before = chunks.length;
            await visit(rule.cssRules, base);
            const inner = chunks.splice(before).join('\n');
            chunks.push(rule.cssText.slice(0, rule.cssText.indexOf('{') + 1) + inner + '}');
          } else if (rule.style) {
            // CSSNestedDeclarations holds declarations appearing after a nested
            // rule. Keep their original order inside the enclosing style block.
            chunks.push(await inlineCssUrls(rule.style.cssText, base));
          }
        }
      }
      for (const sheet of Array.from(doc.styleSheets)) {
        if (sheet.disabled) continue;
        if (sheet.media && sheet.media.mediaText && !win.matchMedia(sheet.media.mediaText).matches) continue;
        if (sheet.href) localAssetUrl(sheet.href, doc.baseURI);
        await visit(sheet.cssRules, sheet.href || doc.baseURI);
      }
      return chunks.join('\n');
    }

    function freezeStrokes(source, target) {
      // Convert non-scaling screen strokes back to map units before rasterizing.
      // The texture then scales together with the map, preserving line/label ratio
      // at the current camera. Local label transforms must be included as well.
      const originals = [source, ...source.querySelectorAll('*')];
      const copies = [target, ...target.querySelectorAll('*')];
      for (let i = 0; i < originals.length; i++) {
        const node = originals[i], copy = copies[i];
        const style = win.getComputedStyle(node);
        if (style.vectorEffect !== 'non-scaling-stroke') continue;
        const matrix = typeof node.getScreenCTM === 'function' && node.getScreenCTM();
        const scale = matrix && Math.hypot(matrix.a, matrix.b);
        if (!(scale > 0 && Number.isFinite(scale))) {
          // Hidden SVG groups have no screen matrix in some browsers. Their
          // original non-scaling stroke is harmless while they stay hidden.
          if (style.display === 'none' || (node.closest && node.closest('.is-hidden'))) continue;
          throw new Error('原地图描边比例尚未就绪');
        }
        copy.style.setProperty('vector-effect', 'none', 'important');
        const width = parseFloat(style.strokeWidth);
        if (Number.isFinite(width)) copy.style.setProperty('stroke-width', String(width / scale), 'important');
        if (style.strokeDasharray && style.strokeDasharray !== 'none') {
          const dash = style.strokeDasharray.split(/[\s,]+/).map(v => parseFloat(v) / scale);
          if (dash.every(Number.isFinite)) copy.style.setProperty('stroke-dasharray', dash.join(' '), 'important');
        }
        const offset = parseFloat(style.strokeDashoffset);
        if (Number.isFinite(offset)) copy.style.setProperty('stroke-dashoffset', String(offset / scale), 'important');
      }
    }

    async function render(request) {
      const bounds = request && request.bounds;
      const projected = projectedBounds(app.projector, bounds);
      const size = textureSize(projected, request.width, request.height);
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
      // Capture state before asynchronous image reads; later control changes are
      // handled by the caller's generation token rather than mixed into this SVG.
      const clone = svg.cloneNode(true);
      freezeStrokes(svg, clone);
      // These three layers are faded by #viewport-frame.has-active-person /
      // .has-active-journey selectors outside the SVG. Freeze only properties
      // actually controlled there; inherited visibility is hidden in 3D mode.
      for (const id of ['grp-settlements', 'grp-corridors', 'grp-milestones']) {
        const source = svg.querySelector('#' + id);
        const target = clone.querySelector('#' + id);
        if (!source || !target) continue;
        const style = win.getComputedStyle(source);
        target.style.setProperty('opacity', style.opacity, 'important');
        target.style.setProperty('display', style.display, 'important');
      }
      clone.setAttribute('xmlns', NS);
      clone.setAttribute('xmlns:xlink', XLINK);
      const lang = doc.documentElement.getAttribute('lang') || svg.getAttribute('lang');
      if (lang) clone.setAttribute('lang', lang);
      clone.setAttribute('width', size.width);
      clone.setAttribute('height', size.height);
      clone.setAttribute('viewBox', [projected.x, projected.y, projected.width, projected.height].join(' '));
      clone.setAttribute('preserveAspectRatio', 'none');
      clone.style.setProperty('width', size.width + 'px', 'important');
      clone.style.setProperty('height', size.height + 'px', 'important');
      clone.style.setProperty('visibility', 'visible', 'important');
      clone.style.setProperty('overflow', 'hidden', 'important');
      clone.style.setProperty('transform', 'none', 'important');
      const rootStyle = win.getComputedStyle(svg);
      const documentStyle = win.getComputedStyle(doc.documentElement);
      for (const style of [documentStyle, rootStyle]) {
        for (let i = 0; i < style.length; i++) {
          const name = style[i];
          if (name.startsWith('--')) clone.style.setProperty(name, style.getPropertyValue(name));
        }
      }
      clone.style.setProperty('font-family', rootStyle.fontFamily);
      const water = rootStyle.getPropertyValue('--water-fill').trim() || '#d6e0de';
      for (const node of [clone, ...clone.querySelectorAll('*')]) {
        for (const cls of TRANSIENT) node.classList.remove(cls);
        for (const attr of Array.from(node.attributes || [])) {
          if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
        }
      }
      clone.querySelectorAll('script, foreignObject, animate, animateTransform, animateMotion, set').forEach(n => n.remove());
      const rig = clone.querySelector('#camera-rig');
      if (rig) { rig.removeAttribute('transform'); rig.style.setProperty('transform', 'none', 'important'); }
      const background = doc.createElementNS(NS, 'rect');
      for (const [name, value] of Object.entries({ x: projected.x, y: projected.y,
        width: projected.width, height: projected.height, fill: water })) background.setAttribute(name, value);
      background.setAttribute('data-map-surface-background', 'true');
      clone.insertBefore(background, clone.firstChild);
      const styleNode = doc.createElementNS(NS, 'style');
      styleNode.textContent = await stylesheetText() + '\n' +
        '*{animation:none!important;transition:none!important;pointer-events:none!important}' +
        '#atlas-svg{display:block!important;max-width:none!important;max-height:none!important}' +
        '.cap-breath-ring,.ev-ring,.jn-pulse{opacity:0!important}';
      clone.insertBefore(styleNode, clone.firstChild);
      await Promise.all(Array.from(clone.querySelectorAll('image')).map(async image => {
        const href = image.getAttribute('href') || image.getAttributeNS(XLINK, 'href');
        // data-href is intentionally not loaded: a deferred/hidden source image
        // must not appear in the 3D texture before the original atlas shows it.
        if (!href) return;
        const data = await readAsset(href, doc.baseURI);
        image.setAttribute('href', data);
        image.removeAttributeNS(XLINK, 'href');
        image.removeAttribute('data-href');
      }));
      const xml = new win.XMLSerializer().serializeToString(clone);
      const objectUrl = win.URL.createObjectURL(new win.Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new win.Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('原地图 SVG 纹理解析失败'));
          img.src = objectUrl;
        });
        const canvas = doc.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('浏览器无法创建地图纹理画布');
        context.fillStyle = water;
        context.fillRect(0, 0, size.width, size.height);
        context.drawImage(image, 0, 0, size.width, size.height);
        const url = canvas.toDataURL('image/png');
        if (!url.startsWith('data:image/png;base64,')) throw new Error('原地图纹理导出为空');
        return { url, bounds: bounds.slice(), width: size.width, height: size.height,
          attribution: '江山时序原版地图 SVG；保留原图许可与数据使用约定' };
      } finally { win.URL.revokeObjectURL(objectUrl); }
    }

    return { render };
  }

  return { create, projectedBounds, textureSize, localAssetUrl };
});
