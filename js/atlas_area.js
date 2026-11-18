(function () {
  'use strict';

  let projector;
  const tangYear = 741;
  const sourceMap = 'http://www.guoxue123.com/other/map/pic/10/03.jpg';
  const tangAreaKey = (place) => [place.level, place.parent, place.ancient].join('/');

  function tangAtlas(year) {
    return year === tangYear ? window.TANG_741_ATLAS : null;
  }

  class AtlasAreaMixin {
    _loadTang741Places() {
      this._renderTang741CircuitGuides();
      if (this.year !== tangYear || tangAtlas(this.year)) return;
      if (this._tang741Promise) return this._tang741Promise;
      this._tang741Promise = this._loadScriptOnce(
        this._lazyAssetUrl('js/tang_741.js', 'vTang741')
      ).then(() => {
        if (tangAtlas(this.year)) {
          this._renderTang741CircuitGuides();
          this._renderSettlements(this.dynasties[this.dynastyIdx]);
        }
      }).finally(() => { this._tang741Promise = null; });
      return this._tang741Promise;
    }

    _tangGuidePath(segments) {
      return segments.map((segment) => segment.map(([lng, lat], i) => {
        const xy = this.projector.toScreen(lng, lat);
        return (i ? 'L' : 'M') + xy.map((v) => v.toFixed(1)).join(' ');
      }).join('')).join('');
    }

    _renderTang741CircuitGuides() {
      const layer = this._id('grp-tang741-circuit-guides');
      const guides = tangAtlas(this.year)?.circuitGuides;
      if (!layer || guides === this._renderedTang741Guides) return;
      this._renderedTang741Guides = guides;
      layer.replaceChildren();
      for (const item of guides || []) {
        this._svgNode('path', { d: this._tangGuidePath(item.segments), class: 'tang741-circuit-guide' }, layer);
      }
    }

    _tang741GuideAt(lng, lat) {
      const guides = tangAtlas(this.year)?.circuitGuides;
      if (!guides?.length) return null;
      const [x, y] = this.projector.toScreen(lng, lat);
      const { width, height } = this.svg.getBoundingClientRect();
      const unitsPerPixel = Math.max(this.camera.w / Math.max(width, 1), this.camera.h / Math.max(height, 1));
      const radius = Math.min(this.projector.scale * .15, unitsPerPixel * 9);
      let best = radius * radius;
      let selected = null;
      for (const item of guides) {
        for (const segment of item.segments) {
          const vertices = segment.map(([lon, phi]) => this.projector.toScreen(lon, phi));
          for (let i = 1; i < vertices.length; i++) {
            const [ax, ay] = vertices[i - 1];
            const [bx, by] = vertices[i];
            const dx = bx - ax;
            const dy = by - ay;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
            const distance = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
            if (distance < best) {
              best = distance;
              selected = item;
            }
          }
        }
      }
      return selected;
    }

    _tang741VisiblePlaces(settlements) {
      const atlas = tangAtlas(this.year);
      if (!atlas) return settlements;
      return settlements.filter((place) => !atlas.replacedNames.has(place.ancient)).concat(atlas.places);
    }

    _tang741SearchIndex(baseIndex) {
      const atlas = tangAtlas(this.year);
      if (!atlas) return baseIndex;
      if (this._tang741BaseIndex === baseIndex) return this._tang741Index;
      const d = this.dynasties[this.dynastyIdx];
      const entries = atlas.places.map((place) => {
        const titleZh = place.detailTitle || place.ancient;
        const titleEn = this._enDict(titleZh) || titleZh;
        const aliases = [...new Set([
          place.ancient, this._enDict(place.ancient), ...(place.aliases || []),
        ].filter(Boolean).map((name) => name.toLowerCase()))];
        const modernEn = place.modern ? this._enModernCity(place.modern) : '';
        return {
          kind: place.level === 'county' ? 'city' : 'prefecture',
          tangArea: tangAreaKey(place), dynasty: d, year: tangYear, coord: place.coord,
          titleZh, titleEn, aliases, modernZh: place.modern || '', modernEn,
          subZh: `741 年 · ${place.parent}`,
          subEn: `741 CE · ${this._enDict(place.parent) || place.parent}`,
          keywords: [titleZh, titleEn, ...aliases, place.modern, modernEn].join(' ').toLowerCase(),
        };
      });
      for (const guide of atlas.circuitGuides) {
        const titleEn = this._enDict(guide.title) || guide.title;
        entries.push({
          kind: 'region', tangArea: 'boundary/' + guide.title, dynasty: d, year: tangYear,
          titleZh: guide.title, titleEn, subZh: '741 年 · 已核对道界段', subEn: '741 CE · verified boundary segments',
          keywords: `${guide.title} ${titleEn}`.toLowerCase(),
        });
      }
      this._tang741BaseIndex = baseIndex;
      this._tang741Index = baseIndex.concat(entries);
      return this._tang741Index;
    }

    _selectTang741Area(key) {
      const atlas = tangAtlas(this.year);
      if (!atlas) return;
      const guide = atlas.circuitGuides.find((item) => key === 'boundary/' + item.title);
      const place = atlas.places.find((item) => key === tangAreaKey(item));
      if (!guide && !place) return;

      if (guide) {
        this._id('chk-prefectures').checked = true;
        this.grpPrefectures.classList.remove('is-hidden');
        this.grpRegionLabels.classList.remove('is-hidden');
        this._materializeDeferredPrefectures();
      } else {
        this._id('chk-settlements').checked = true;
        this.grpSettlements.classList.remove('is-hidden');
      }
      if (this.challenge) this.stopChallenge(true);
      const mobile = window.innerWidth <= 900;
      const zoom = place?.level === 'county' ? (mobile ? 8 : 6) : 3.8;
      const coord = place?.coord || guide.segments[0][Math.floor(guide.segments[0].length / 2)];
      const [x, y] = this.projector.toScreen(...coord);
      const w = 1000 / zoom;
      const h = w * this._getViewportAspect();
      this._animateCameraTo({ x: x - w * (mobile ? 0.5 : 0.41), y: y - h * (mobile ? 0.31 : 0.5), w, h });
      if (guide) return this._showMapArea('boundary', guide.title, guide.members, guide);
      return this._showTang741Place(place);
    }

    _syncTang741Detail(zoom) {
      const mode = this.year !== 741 ? '' : zoom < 2.15 ? 'overview' : zoom < 5.4 ? 'prefectures' : 'counties';
      this.svg.classList.toggle('is-tang741-overview', mode === 'overview');
      this.svg.classList.toggle('is-tang741-counties', mode === 'counties');
      if (mode) {
        for (const label of this.grpSettlements.querySelectorAll('[data-overview-label]')) {
          const name = mode === 'overview' ? label.dataset.overviewLabel : label.dataset.detailLabel;
          const display = this._mapText(this.trTerm(name));
          if (label.textContent !== display) label.textContent = display;
        }
      }
      return mode;
    }

    _reserveTangCountyDots(nodes, occupied, scale) {
      const radius = 3.2 * scale;
      for (const node of nodes) {
        if (!node.classList.contains('is-county')) continue;
        const x = Number(node.dataset.x);
        const y = Number(node.dataset.y);
        occupied.push({ x1: x - radius, y1: y - radius, x2: x + radius, y2: y + radius });
      }
    }

    _raiseTangCountyPoints(group) {
      if (this.year !== 741) return;
      // A capital caption may overlap a nearby county seat on a small screen.
      // Keep the fine-zoom point selectable above it; label layout still culls collisions.
      for (const node of group.querySelectorAll('.settlement-node.is-county')) group.appendChild(node);
    }

    openMapSettlementAt(lng, lat, label) {
      const atlas = tangAtlas(this.year);
      const place = atlas && atlas.places.find((item) =>
        item.ancient === label && Math.abs(item.coord[0] - lng) < 0.0001 &&
        Math.abs(item.coord[1] - lat) < 0.0001
      );
      if (place) return this._showTang741Place(place);
      this.openGenealogyAt(lng, lat);
    }

    _showTang741Place(place) {
      const parents = [place.parent];
      if (place.seat) parents.push(this.locale === 'en' ? `Seat: ${place.seat}` : `治所：${place.seat}`);
      return this._showMapArea(place.level, place.detailTitle || place.ancient, parents, place);
    }

    openMapAreaAt(lng, lat) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || this.activePerson ||
          this.activeCustomRoute || this.challenge || this.embed?.lock) return false;

      const snapshot = this.lastRenderedSnap;
      if (!snapshot || this.svg.classList.contains('is-awaiting-snapshot')) return false;
      const hit = (item) => projector.pointInShape(lng, lat, item.shape);
      const visible = (group) => group && !group.classList.contains('is-hidden');
      const guide = visible(this.grpPrefectures) && this._tang741GuideAt(lng, lat);
      if (guide) return this._showMapArea('boundary', guide.title, guide.members, guide);
      const polities = (snapshot.polities || []).filter((item) => item.role !== 'neighbor');
      const polity = [...polities].reverse().find(hit);
      if (polity && visible(this.grpPrefectures)) {
        const region = (snapshot.regions || []).find(hit);
        const fine = !this.svg.classList.contains('is-tang741-overview') &&
          (!this._isMobileViewport() || this.svg.classList.contains('is-mobile-zoomed-detail') || this.year === 741);
        const prefecture = fine && (snapshot.prefectures || []).find(hit);
        if (prefecture) {
          return this._showMapArea('prefecture', prefecture.title,
            [region?.title, polity.title], prefecture);
        }
        if (region) return this._showMapArea('circuit', region.title, [polity.title], region);
      }
      if (polity && visible(this.grpPolities)) {
        return this._showMapArea('polity', polity.title, [], polity);
      }
      if (this.dynasties[this.dynastyIdx]?.key === 'prc' && visible(this.grpProvinces)) {
        const province = (this.provinces || []).find((item) =>
          !String(item.code).includes('_JD') &&
          item.rings.some((rings) => projector.pointInPolygonRings(lng, lat, rings))
        );
        if (province) return this._showMapArea('modern', province.title, [],
          { shape: { type: 'MultiPolygon', coordinates: province.rings } });
      }
      this.closeMapArea();
      return false;
    }

    _showMapArea(type, title, parents, item) {
      const card = this._id('map-area-card');
      if (!card) return false;
      this.stopAutoplay();
      this.closeGenealogyCard();
      this.closeMilestoneBalloon();
      this.closeMapArea();
      this.activeMapArea = {
        type, title,
        highlight: item.shape ? { shape: item.shape } : item.segments ? { segments: item.segments } : null,
      };
      const isEn = this.locale === 'en';
      const types = {
        circuit: ['道及大区', 'Circuit or region'],
        prefecture: ['州府政区', 'Prefecture'],
        county: ['县治', 'County seat'],
        polity: ['政权疆域', 'Polity'],
        modern: ['现代政区', 'Modern province'],
        boundary: ['已核对道界段', 'Verified boundary segment'],
      };
      const format = (value) => this.locale === 'en' ? this.trTerm(value) : this._zh(value);
      this._id('map-area-title').textContent = format(title);
      this._id('map-area-kicker').textContent = [this.formatYear(this.year), format(types[type][isEn ? 1 : 0])].join(' · ');
      const hierarchy = this._id('map-area-hierarchy');
      hierarchy.textContent = [...new Set(parents.filter((name) => name && name !== title))].map(format).join(' · ');
      hierarchy.hidden = !hierarchy.textContent;
      const boundaryNote = this.year === 741 && type === 'prefecture'
        ? ['州府边界沿用本项目跨期示意层，可结合 741 年原图查阅。', 'Approximate prefecture boundary from the existing multi-period layer.']
        : ['本项目政区范围为示意。', 'Approximate boundary in the current map.'];
      this._id('map-area-note').textContent = item.precision
        ? (isEn ? item.precisionEn || 'Approximate position of the administrative seat.' : format(item.precision))
        : format(boundaryNote[isEn ? 1 : 0]);
      const sources = this._id('map-area-sources');
      const links = item.sources || (this.year === 741 ? [['741 年唐时期全图', sourceMap]] : []);
      sources.replaceChildren(...links.map(([label, href]) => {
        const link = document.createElement('a');
        link.textContent = format(label);
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener';
        return link;
      }));
      const layer = this._id('grp-map-area');
      if (item.shape) {
        this._svgNode('path', { d: this.projector.shapeToSvgPath(item.shape), class: 'map-area-outline' }, layer);
      } else if (item.segments) {
        this._svgNode('path', { d: this._tangGuidePath(item.segments), class: 'map-area-outline is-boundary-guide' }, layer);
      }
      card.hidden = false;
      this.viewportFrame.classList.add('has-map-area');
      return true;
    }

    closeMapArea() {
      if (!this.activeMapArea) return false;
      this.activeMapArea = null;
      this._id('grp-map-area').replaceChildren();
      this._id('map-area-card').hidden = true;
      this.viewportFrame.classList.remove('has-map-area');
      return true;
    }
  }

  function install(Ctrl) {
    projector = Ctrl._projectorClass;
    Ctrl._extendPrototype(AtlasAreaMixin);
  }

  if (typeof window === 'undefined') return;
  const controller = window.HistoricalAtlasController;
  if (controller) install(controller);
  else (window.__ATLAS_MIXINS = window.__ATLAS_MIXINS || []).push(install);
})();
