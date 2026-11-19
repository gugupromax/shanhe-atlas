(function () {
  'use strict';

  let projector;
  const tangYear = 741;
  const sourceMap = 'http://www.guoxue123.com/other/map/pic/10/03.jpg';
  const tangAreaKey = (place) => [place.level, place.parent, place.ancient].join('/');

  // The gazetteer records three different names/intervals at the same seat.
  // The inherited polygon and the older CHGIS row both collapse that history.
  const suiyangSource = 'https://tgaz.fudan.edu.cn/tgaz/placename/hvd_82072';
  const westernLiang = [
    {ancient:'梁国', from:-126, through:2},
    {ancient:'梁郡', from:3, through:4},
    {ancient:'梁国', from:5, through:8},
  ].map(place => ({
    ...place, id:'reviewed:suiyang:' + place.from, level:'prefecture', coord:[115.60745,34.38505],
    seat:'睢阳', modern:'河南商丘',
    precision:'西汉末期梁地的治所位于睢阳一带（今河南商丘），坐标为近似定位，辖境范围待考。',
    precisionEn:'Approximate seat near Suiyang (modern Shangqiu). The boundary is still under review.',
    sources:[
      ['复旦时空地名库 · 睢阳县建置沿革', suiyangSource],
      ['班固《汉书》卷十四 · 诸侯王表', 'https://zh.wikisource.org/zh-hans/漢書/卷014'],
      ['班固《汉书》地理志 · 梁国', 'https://ctext.org/dictionary.pl?chapter=698621&if=en&remap=gb&sid=10650&trid=1112938'],
    ],
  }));

  const earlyLiang = {
    id:'reviewed:liang:23', ancient:'梁国', level:'prefecture', from:23, through:25,
    coord:[115.61,34.39], seat:'睢阳', modern:'河南商丘',
    precision:'据《后汉书·刘永传》，更始时刘永封梁王，都睢阳。点位约示今河南商丘一带。',
    precisionEn:'Liu Yong ruled from Suiyang under the Gengshi regime. Approximate site near modern Shangqiu.',
    sources:[['《后汉书》卷十二 · 刘永传','https://zh.wikisource.org/wiki/後漢書/卷12'],
      ['复旦时空地名库 · 睢阳县建置沿革',suiyangSource]],
  };
  const easternLiang = [
    {ancient:'梁郡', from:29, through:78},
    {ancient:'梁国', from:79, through:219},
  ].map(place => ({
    ...place, id:'reviewed:xiayi:' + place.from, level:'prefecture',
    coord:[116.34,34.43], seat:'下邑（约）', modern:'安徽砀山',
    precision:'《后汉书·郡国志》列下邑为梁国首县。自睢阳迁治的确年待考，按复旦时空地名库的考释，将建武五年起的治所约标于今安徽砀山一带。辖界待考。',
    precisionEn:'The Book of the Later Han lists Xiayi first among the counties of Liang. The move from Suiyang is undated. Following the Fudan gazetteer reconstruction, the seat is placed near modern Dangshan from 29 CE. The boundary is uncertain.',
    sources:[['《后汉书》郡国志二 · 梁国','https://zh.wikisource.org/zh-hans/後漢書/卷110#梁国'],
      ['复旦时空地名库 · 睢阳县建置沿革',suiyangSource],
      ['《江南通志》卷三十三 · 下邑故城','https://zh.wikisource.org/wiki/江南通志_(四庫全書本)/卷033']],
  }));

  function reviewedLiang(dynasty, year) {
    if (!['xihan', 'donghan'].includes(dynasty?.key)) return;
    if (year >= earlyLiang.from && year <= earlyLiang.through) return earlyLiang;
    if (dynasty.key === 'donghan') return easternLiang.find(item => item.from <= year && year <= item.through);
    const place = westernLiang.find(item => item.from <= year && year <= item.through);
    if (place) return {...place, parent:year >= -106 ? '豫州（刺史部）' : '西汉'};
  }

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

    _loadPeriodAdminPlaces(userRequest = false) {
      if (this.year === tangYear || window.ATLAS_PERIOD_ADMIN || typeof document === 'undefined') return;
      if (this._periodAdminLoad) return this._periodAdminLoad;
      if (this._periodAdminRetryAfter > Date.now() ||
          (!userRequest && this._periodAdminFailedYear === this.year)) return;

      const source = 'data/tiles/period-admin.js';
      this._periodAdminLoad = (async () => {
        await this._loadScriptOnce(source);
        if (!window.ATLAS_PERIOD_ADMIN && this.year !== tangYear) {
          // A transient failure gets one retry, shared by map rendering and search.
          await new Promise(resolve => setTimeout(resolve, 800));
          if (this.year === tangYear) return;
          await this._loadScriptOnce(source);
        }
        if (window.ATLAS_PERIOD_ADMIN) {
          if (this.year !== tangYear) this._renderSettlements(this.dynasties[this.dynastyIdx]);
        } else if (this.year !== tangYear) {
          // On public installations the optional file can be absent permanently.
          this._periodAdminFailedYear = this.year;
          this._periodAdminRetryAfter = Date.now() + 30000;
        }
      })().finally(() => { this._periodAdminLoad = null; });
      return this._periodAdminLoad;
    }

    _snapshotForAdmin(dynasty) {
      const key = this._resolveSnapKey(dynasty, this.year);
      return this.snapshots?.[key] || (!this.snapshots ? this.lastRenderedSnap : null);
    }

    _boundAdminLabelLayout(nodes, applyScale) {
      const {x, y, w, h} = this.camera;
      if (![x, y, w, h].every(Number.isFinite) || !nodes.some((node) => node.dataset?.areaKey)) {
        this._adminLayoutBounds = null;
        return nodes;
      }
      // Keep all points positioned for panning, but only run label collision
      // calculations in an expanded current view.
      const bounds = [x - w * .4, y - h * .4, x + w * 1.4, y + h * 1.4];
      this._adminLayoutBounds = bounds;
      return nodes.filter((node) => {
        if (!node.dataset?.areaKey) return true;
        const {x: px, y: py} = node.dataset;
        if (px >= bounds[0] && py >= bounds[1] && px <= bounds[2] && py <= bounds[3]) return true;
        applyScale(node, px, py);
        node.classList.add('is-label-crowded');
        return false;
      });
    }

    _adminLayoutOutdated() {
      if (!this._adminLayoutBounds) return false;
      const {x, y, w, h} = this.camera;
      const [left, top, right, bottom] = this._adminLayoutBounds;
      return x < left || y < top || x + w > right || y + h > bottom;
    }

    _adminSettlementRevision(dynasty) {
      if (this.year === tangYear) return '';
      const snapshot = this._snapshotForAdmin(dynasty);
      return [snapshot ? this._resolveSnapKey(dynasty, this.year) : '',
        window.ATLAS_PERIOD_ADMIN ? this.year : reviewedLiang(dynasty, this.year)?.id || ''].join(':');
    }

    _periodAdminAreas(dynasty = this.dynasties?.[this.dynastyIdx]) {
      if (this.year === tangYear || !dynasty) return [];
      const snapshot = this._snapshotForAdmin(dynasty);
      const provider = window.ATLAS_PERIOD_ADMIN;
      const previous = this._periodAdminCatalog;
      if (previous?.year === this.year && previous.snapshot === snapshot && previous.provider === provider) {
        return previous.places;
      }
      const validCoord = (coord) => Array.isArray(coord) && coord.length === 2 &&
        coord.every(Number.isFinite) && Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) < 85;
      const places = [];
      const seen = new Set();
      const correction = reviewedLiang(dynasty, this.year);
      const original = provider?.placesForYear(this.year) || [];
      const dated = ['xihan', 'donghan'].includes(dynasty.key)
        ? original.filter(item => item?.id !== 'chgis:0:210768') : original;
      const records = correction ? [correction, ...dated] : dated;
      for (const record of records) {
        if (!record?.id || !record.ancient || !['county', 'prefecture'].includes(record.level) ||
            !validCoord(record.coord) || (record.from != null && record.from > this.year) ||
            (record.through != null && record.through < this.year)) continue;
        const areaKey = record.level + '/' + record.id;
        if (seen.has(areaKey)) continue;
        seen.add(areaKey);
        const sources = (record.sources || []).filter((link) => Array.isArray(link) &&
          typeof link[0] === 'string' && /^https?:\/\//i.test(link[1]));
        const shape = record !== correction && record.level === 'prefecture' && (snapshot?.prefectures || []).find((item) =>
          item.title === record.ancient && item.shape && projector.pointInShape(...record.coord, item.shape))?.shape;
        const reportsMissingParent = /未附行政隶属|未列上级政区/.test(record.precision || '');
        const precision = [record.precision, record.parent || reportsMissingParent ? '' : '本条记录未标注上级政区。'].filter(Boolean).join('');
        const precisionEn = [record.precisionEn || 'Approximate position from the historical dataset.',
          record.parent ? '' : ' The parent division is not specified in this record.'].join('');
        places.push({ ...record, tier: 2, areaKey, sources, precision, precisionEn, ...(shape ? {shape} : {}) });
      }

      // A snapshot's own label anchors identify areas, never historical seats.
      const byName = new Map();
      for (const place of places) {
        if (place.level !== 'prefecture') continue;
        if (!byName.has(place.ancient)) byName.set(place.ancient, []);
        byName.get(place.ancient).push(place.coord);
      }
      if (snapshot) {
        if (!this._snapshotAdminAnchors) this._snapshotAdminAnchors = new WeakMap();
        let anchors = this._snapshotAdminAnchors.get(snapshot);
        if (!anchors) {
          anchors = (snapshot.prefectures || []).flatMap((item, index) => {
            if (!item.title || !item.shape || !validCoord(item.anchor) ||
                !projector.pointInShape(...item.anchor, item.shape)) return [];
            return [{
              areaKey: 'prefecture/snapshot-' + index,
              ancient: item.title, tier: 2, level: 'prefecture', coord: item.anchor, shape: item.shape,
              schematic: true, precision: '此处是现有示意边界的名称标注位置。该图层未逐条标注隶属。',
              precisionEn: 'Label anchor of the approximate prefecture boundary. The layer does not record its parent division.',
              sources: [['项目图层来源', 'map-sources.html']],
            }];
          });
          this._snapshotAdminAnchors.set(snapshot, anchors);
        }
        places.push(...anchors.filter((item) => !byName.get(item.ancient)?.some((coord) =>
          projector.pointInShape(...coord, item.shape))));
      }
      this._periodAdminCatalog = {year: this.year, snapshot, provider, places};
      return places;
    }

    _adminVisiblePlaces(settlements, dynasty) {
      if (this.year === tangYear) return this._tang741VisiblePlaces(settlements);
      const additions = this._periodAdminAreas(dynasty);
      if (!additions.length) return settlements;
      const settlementsByName = new Map();
      for (const item of settlements) {
        if ((item.appear != null && item.appear > this.year) ||
            (item.vanish != null && this.year >= item.vanish)) continue;
        const name = this._settlementAncient(item, this.year);
        if (!settlementsByName.has(name)) settlementsByName.set(name, []);
        settlementsByName.get(name).push(item);
      }

      // The two sources often locate the same town a few kilometres apart.
      // Merge only one-to-one, same-year matches. Ambiguous seats stay individually selectable.
      const seatBySettlement = new Map();
      for (const seat of additions) {
        if (seat.schematic || !settlementsByName.has(seat.ancient)) continue;
        const nearby = settlementsByName.get(seat.ancient).filter(town =>
          this.projector.greatCircleKm(town.coord, seat.coord) <= 5);
        for (const town of nearby) {
          seatBySettlement.set(town, nearby.length === 1 && !seatBySettlement.has(town) ? seat : null);
        }
      }
      const mergedSeats = new Set();
      const markers = settlements.map(town => {
        const seat = seatBySettlement.get(town);
        if (!seat) return town;
        mergedSeats.add(seat);
        // Keep the town's original zoom/layer class, capital dates, and label priority.
        return {...town, coord:seat.coord, areaKey:seat.areaKey, parent:seat.parent,
          modern:town.modern || seat.modern};
      });
      return markers.concat(additions.filter(seat => !mergedSeats.has(seat) &&
        (!seat.schematic || !settlementsByName.get(seat.ancient)?.some(town =>
          projector.pointInShape(...town.coord, seat.shape)))));
    }

    _adminSearchIndex(baseIndex) {
      if (this.year === tangYear) return this._tang741SearchIndex(baseIndex);
      const places = this._periodAdminAreas();
      if (!places.length) return baseIndex;
      const previous = this._periodAdminIndex;
      if (previous?.base === baseIndex && previous.places === places && previous.locale === this.locale) {
        return previous.index;
      }
      const dynasty = this.dynasties[this.dynastyIdx];
      const entries = places.map((place) => {
        const titleZh = place.ancient;
        const titleEn = this._enDict(titleZh) || titleZh;
        const modernZh = place.modern || '';
        const modernEn = modernZh ? this._enModernCity(modernZh) : '';
        const subZh = [this.formatYear(this.year), place.parent || modernZh].filter(Boolean).join(' · ');
        return {
          kind: place.level === 'county' ? 'city' : 'prefecture', adminArea: place.areaKey,
          adminLevel: place.level, dynasty, year: this.year, coord: place.coord,
          titleZh, titleEn, modernZh, modernEn, subZh,
          subEn: [this.year, this._enDict(place.parent || '') || modernEn].filter(Boolean).join(' · '),
          keywords: [titleZh, titleEn, place.parent, modernZh, modernEn].join(' ').toLowerCase(),
        };
      });
      const currentTitles = new Set(entries.map((item) => item.kind + '/' + item.titleZh));
      const index = baseIndex.filter((item) => item.dynasty !== dynasty ||
        !currentTitles.has(item.kind + '/' + item.titleZh)).concat(entries);
      this._periodAdminIndex = {base: baseIndex, places, locale: this.locale, index};
      return index;
    }

    _selectPeriodAdminArea(key) {
      const place = this._periodAdminAreas().find((item) => item.areaKey === key);
      if (!place) return false;
      const toggle = this._id('chk-settlements');
      if (toggle) toggle.checked = true;
      this.grpSettlements.classList.remove('is-hidden');
      if (place.level === 'prefecture') this._enableAdminBoundaries();
      this._focusAdminPlace(place.coord, place.level === 'county');
      return this._showAdminPlace(place);
    }

    _enableAdminBoundaries() {
      const toggle = this._id('chk-prefectures');
      if (toggle) toggle.checked = true;
      this.grpPrefectures.classList.remove('is-hidden');
      this.grpRegionLabels.classList.remove('is-hidden');
      this._materializeDeferredPrefectures();
    }

    _focusAdminPlace(coord, county) {
      if (this.challenge) this.stopChallenge(true);
      const mobile = window.innerWidth <= 900;
      const zoom = county ? (mobile ? 8 : 6) : 3.8;
      const [x, y] = this.projector.toScreen(...coord);
      const w = Math.min(this.camera?.w || Infinity, 1000 / zoom);
      const h = w * this._getViewportAspect();
      this._animateCameraTo({ x: x - w * (mobile ? 0.5 : 0.41), y: y - h * (mobile ? 0.31 : 0.5), w, h });
    }

    _openIndexedAdminArea(item) {
      const year = this.year;
      const dynasty = this.dynasties[this.dynastyIdx];
      const key = this._resolveSnapKey(dynasty, year);
      this._withSnapshot(key, (snapshot) => {
        if (this.year !== year || !snapshot) return;
        const list = item.kind === 'region' ? snapshot.regions : snapshot.prefectures;
        const matches = (list || []).filter((area) => area.shape && area.title === item.titleZh);
        const area = matches.find((entry) => entry.anchor &&
          entry.anchor.every((value, index) => value === item.coord[index])) ||
          matches.find((entry) => projector.pointInShape(...item.coord, entry.shape));
        if (area) this._showMapArea(item.kind === 'region' ? 'circuit' : 'prefecture',
          area.title, area.parents || [area.parent], area);
      });
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
      return this._showAdminPlace(place);
    }

    _syncTang741Detail(zoom) {
      const zoomMode = zoom < 2.15 ? 'overview' : zoom < 5.4 ? 'prefectures' : 'counties';
      const mode = zoomMode === 'counties' && this._adminLevel === 'prefectures'
        ? 'prefectures' : zoomMode;
      this.svg.classList.toggle('is-admin-overview', mode === 'overview');
      this.svg.classList.toggle('is-admin-counties', mode === 'counties');
      this.svg.classList.toggle('is-tang741-overview', this.year === tangYear && mode === 'overview');
      this.svg.classList.toggle('is-tang741-counties', this.year === tangYear && zoomMode === 'counties');
      if (this.year === tangYear) {
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
      // A capital caption may overlap a nearby county seat on a small screen.
      // Keep the fine-zoom point selectable above it; label layout still culls collisions.
      for (const node of group.querySelectorAll('.settlement-node.is-county')) group.appendChild(node);
    }

    openMapSettlementAt(lng, lat, label, areaKey) {
      const atlas = tangAtlas(this.year);
      const places = atlas?.places || this._periodAdminAreas();
      const place = places.find((item) =>
        (areaKey ? item.areaKey === areaKey : item.ancient === label) &&
        Math.abs(item.coord[0] - lng) < 0.0001 && Math.abs(item.coord[1] - lat) < 0.0001) ||
        (!areaKey && places.find((item) => item.schematic && item.ancient === label &&
          projector.pointInShape(lng, lat, item.shape)));
      if (place) return this._showAdminPlace(place);
      this.openGenealogyAt(lng, lat);
    }

    _showAdminPlace(place) {
      const parents = [...(place.parents || [place.parent])];
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
        const fine = !this.svg.classList.contains('is-admin-overview') &&
          (!this._isMobileViewport() || this.svg.classList.contains('is-mobile-zoomed-detail') || this.year === 741);
        const prefecture = fine && (snapshot.prefectures || []).find(hit);
        if (prefecture) {
          return this._showMapArea('prefecture', prefecture.title,
            prefecture.parents || [prefecture.parent], prefecture, [polity.title, region?.title]);
        }
        if (region) return this._showMapArea('circuit', region.title, region.parents || [region.parent], region, [polity.title]);
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

    _showMapArea(type, title, parents, item, clickedLayers = []) {
      const card = this._id('map-area-card');
      if (!card) return false;
      this.stopAutoplay();
      this.closeGenealogyCard();
      this.closeMilestoneBalloon();
      this.closeMapArea();
      const point = type === 'county' && Array.isArray(item.coord) && item.coord.length === 2 &&
        item.coord.every(Number.isFinite) ? item.coord : null;
      this.activeMapArea = {
        type, title,
        highlight: item.shape ? { shape: item.shape } : item.segments ? { segments: item.segments } : point ? { point } : null,
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
      const note = item.precision
        ? (isEn ? item.precisionEn || 'Approximate position of the administrative seat.' : format(item.precision))
        : format(boundaryNote[isEn ? 1 : 0]);
      const location = [...new Set(clickedLayers.filter(name => name && name !== title))].map(format).join(' · ');
      this._id('map-area-note').textContent = location
        ? [note, format(isEn ? 'Map layers at the selected point' : '点选位置所在图层'), location].join(' · ')
        : note;
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
      } else if (point) {
        const [x, y] = this.projector.toScreen(...point);
        const marker = this._svgNode('g', { id: 'map-area-focus', 'aria-hidden': 'true' }, layer);
        // Round line caps keep the selection readable at every SVG zoom level.
        for (const [color, width] of [['#fff9e8', 13], ['#963d2a', 9]]) {
          this._svgNode('path', { d: `M${x} ${y}h0`, stroke: color, 'stroke-width': width,
            'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }, marker);
        }
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
