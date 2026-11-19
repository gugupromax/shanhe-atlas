(function () {
  'use strict';

  const maps = {
    capital: ['京畿道、关内道分幅', 'http://www.guoxue123.com/other/map/pic/10/05.jpg'],
    east: ['都畿道、河南道分幅', 'http://www.guoxue123.com/other/map/pic/10/27.jpg'],
    central: ['山南东道、山南西道分幅', 'http://www.guoxue123.com/other/map/pic/10/09.jpg'],
    south: ['江南东道分幅', 'http://www.guoxue123.com/other/map/pic/10/11.jpg'],
  };
  const history = ['《旧唐书》卷三十八 · 地理一', 'https://zh.wikisource.org/zh-hans/旧唐书/卷38'];
  const southernHistory = ['《旧唐书》卷四十 · 地理三', 'https://zh.wikisource.org/zh-hans/旧唐书/卷40#润州'];
  const shannanHistory = ['《旧唐书》卷三十九 · 山南西道', 'https://zh.wikisource.org/zh-hans/旧唐书/卷39#山南西道'];
  const openSeats = ['郑伊辰、武廷海 · 县治点（CC BY 4.0）', 'https://doi.org/10.6084/m9.figshare.30518417.v2'];
  const gazetteer = (id) => ['复旦历史地名记录', `https://tgaz.fudan.edu.cn/tgaz/placename/hvd_${id}`];
  const additions = [];
  // 澶州 was abolished before 741. The contemporary Tunqiu was under Weizhou.
  const replacedNames = new Set(['澶州']);

  function addPlace(ancient, parent, coord, id, map, options = {}) {
    const { level = 'county', replace, ...display } = options;
    if (replace) replacedNames.add(replace);
    additions.push({
      ancient, coord, parent, level, tier: 2,
      precision: '治所位置为近似定位，供查阅地名和隶属。',
      sources: [map, history, gazetteer(id)],
      ...display,
    });
  }

  // Two seats on the 741 map. Keep the familiar city names on the overview.
  addPlace('长安', '京畿道 · 长安', [108.95, 34.27], 111220, maps.capital, {
    level: 'prefecture', replace: '长安', tier: 1, isCapital: true,
    displayName: '长安 · 京畿道', detailTitle: '京兆府', align: 'l', modern: '西安',
    sources: [maps.capital, history, openSeats],
  });
  addPlace('东都洛阳', '都畿道 · 东都洛阳', [112.49, 34.67], 115332, maps.east, {
    level: 'prefecture', replace: '东都洛阳', tier: 1, displayName: '洛阳 · 都畿道', detailTitle: '河南府', modern: '洛阳',
    sources: [maps.east, history, openSeats],
  });
  for (const [name, lng, lat, id] of [
    ['岐州', 107.39, 34.52, 111041],
    ['邠州', 108.08, 35.04, 111038],
    ['华州', 109.76, 34.52, 111043],
    ['同州', 109.94, 34.80, 111039],
  ]) {
    addPlace(name, '京畿道', [lng, lat], id, maps.capital, { level: 'prefecture' });
  }

  addPlace('梁州', '山南西道', [107.03, 33.08], 111042, maps.central,
    { level: 'prefecture', replace: '兴元', modern: '汉中', sources: [maps.central, shannanHistory, openSeats] });
  addPlace('括州', '江南东道', [119.93, 28.45], 111091, maps.south,
    { level: 'prefecture', replace: '处州', modern: '丽水', sources: [maps.south, southernHistory, openSeats] });

  const counties = [
    ['京兆府', maps.capital, [
      ['蓝田县', 109.32, 34.17],
      ['鄠县', 108.61, 34.12],
      ['泾阳县', 108.84, 34.53],
      ['醴泉县', 108.43, 34.55],
      ['奉天县', 108.24, 34.53],
      ['盩厔县', 108.21, 34.17],
      ['富平县', 109.20, 34.80],
      ['新丰县', 109.27, 34.42],
      ['咸阳县', 108.77, 34.39],
      ['渭南县', 109.50, 34.50],
      ['栎阳县', 109.21, 34.57],
      ['三原县', 109.04, 34.71],
    ]],
    ['岐州', maps.capital, [
      ['郿县', 107.75, 34.27],
      ['陈仓县', 107.13, 34.39],
      ['岐山县', 107.62, 34.45],
      ['麟游县', 107.80, 34.69],
    ]],
    ['华州', maps.capital, [
      ['华阴县', 110.08, 34.56],
      ['下邽县', 109.50, 34.73],
    ]],
    ['同州', maps.capital, [
      ['韩城县', 110.45, 35.48],
      ['郃阳县', 110.15, 35.24],
      ['白水县', 109.61, 35.18],
      ['澄城县', 109.94, 35.19],
      ['朝邑县', 110.13, 34.79],
    ]],
    ['河南府', maps.east, [
      ['偃师县', 112.80, 34.71],
      ['巩县', 113.04, 34.78],
      ['新安县', 112.15, 34.73],
      ['渑池县', 111.77, 34.77],
      ['伊阙县', 112.38, 34.39],
      ['寿安县', 112.18, 34.50],
      ['王屋县', 112.27, 35.11],
      ['陆浑县', 112.16, 34.22],
      ['福昌县', 111.86, 34.48],
      ['长水县', 111.44, 34.37],
    ]],
    ['润州', maps.south, [
      ['金坛县', 119.56, 31.75],
      ['延陵县', 119.47, 31.89],
      ['句容县', 119.15, 31.96],
      ['曲阿县', 119.55, 31.99],
    ], southernHistory],
  ];
  for (const [parent, map, places, record = history] of counties) {
    for (const [name, lng, lat] of places) {
      const sources = [map, record, openSeats];
      if (name === '郃阳县') sources.push(gazetteer(70308));
      addPlace(name, parent, [lng, lat], null, map, { sources });
    }
  }

  // The existing point labels the site by the later prefecture name.
  addPlace('江宁县', '润州', [118.78, 32.04], null, maps.south, {
    replace: '升州', modern: '南京',
    sources: [maps.south, southernHistory, openSeats],
  });

  // GENERATED-741-GROUPS-START
  const extraGroups = [
    {"circuit":"关内道","map":["京畿道、关内道分幅","http://www.guoxue123.com/other/map/pic/10/05.jpg"],"history":["《旧唐书》卷三十八 · 泾州","https://zh.wikisource.org/zh-hans/舊唐書/卷38#泾州"],"prefectures":[{"name":"泾州","seat":"安定县","coord":[107.35,35.37],"replace":"泾州","counties":[["鹑觚县",107.61,35.09],["良原县",107.18,35.16],["阴盘县",106.88,35.52],["临泾县",107.19,35.7]]}]},
    {"circuit":"关内道","map":["京畿道、关内道分幅","http://www.guoxue123.com/other/map/pic/10/05.jpg"],"history":["《旧唐书》卷三十八 · 庆州","https://zh.wikisource.org/zh-hans/舊唐書/卷38#庆州"],"prefectures":[{"name":"庆州","seat":"安化县","coord":[107.9,36.01],"replace":"庆州","counties":[["乐蟠县",108.03,35.81],["蟠交县",108.12,36.02],["同川县",107.54,36.06],["白马县",107.93,36.14],["马岭县",107.65,36.24],["方渠县",107.31,36.59],["华池县",108.44,36.23]]}]},
    {"circuit":"关内道","map":["京畿道、关内道分幅","http://www.guoxue123.com/other/map/pic/10/05.jpg"],"history":["《旧唐书》卷三十八 · 原州","https://zh.wikisource.org/zh-hans/舊唐書/卷38#原州"],"prefectures":[{"name":"原州","seat":"平高县","coord":[106.29,36.01],"counties":[["平凉县",106.67,35.53],["百泉县",106.58,35.81],["萧关县",106.09,36.75]]}]},
    {"circuit":"关内道","map":["京畿道、关内道分幅","http://www.guoxue123.com/other/map/pic/10/05.jpg"],"history":["《旧唐书》卷三十八 · 灵州","https://zh.wikisource.org/zh-hans/舊唐書/卷38#灵州"],"prefectures":[{"name":"灵州","seat":"回乐县","coord":[106.3,38.04],"replace":"灵州","counties":[["温池县",106.63,37.46],["鸣沙县",105.98,37.78],["安静县",106.3,38.3],["怀远县",106.29,38.46],["灵武县",106.12,38.21]]}]},
    {"circuit":"河北道","map":["河北道南部分幅","http://www.guoxue123.com/other/map/pic/10/07.jpg"],"history":["《旧唐书》卷三十九 · 幽州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#幽州"],"prefectures":[{"name":"幽州","seat":"蓟县","coord":[116.32,39.88],"replace":"幽州","counties":[["归义县",115.98,39.08],["范阳县",115.97,39.48],["雍奴县",116.93,39.51],["潞县",116.73,39.91],["昌平县",116.18,40.19],["安次县",116.59,39.51],["良乡县",116.06,39.64]]}]},
    {"circuit":"河北道","map":["河北道南部分幅","http://www.guoxue123.com/other/map/pic/10/07.jpg"],"history":["《旧唐书》卷三十九 · 相州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#相州"],"prefectures":[{"name":"相州","seat":"安阳县","coord":[114.36,36.1],"counties":[["临河县",114.73,35.77],["汤阴县",114.34,35.91],["内黄县",114.79,35.96],["林虑县",113.81,36.06],["尧城县",114.56,36.1],["临漳县",114.55,36.24],["洹水县",114.82,36.25],["邺县",114.4,36.28],["滏阳县",114.37,36.35],["成安县",114.68,36.45]]}]},
    {"circuit":"河北道","map":["河北道南部分幅","http://www.guoxue123.com/other/map/pic/10/07.jpg"],"history":["《旧唐书》卷三十九 · 定州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#定州"],"prefectures":[{"name":"定州","seat":"安喜县","coord":[114.99,38.51],"counties":[["无极县",114.96,38.17],["深泽县",115.2,38.18],["唐昌县",115.01,38.32],["新乐县",114.78,38.4],["义丰县",115.32,38.41],["恒阳县",114.68,38.62],["望都县",115.14,38.71],["唐县",114.83,38.71],["北平县",115.14,38.82]]}]},
    {"circuit":"河北道","map":["河北道南部分幅","http://www.guoxue123.com/other/map/pic/10/07.jpg"],"history":["《旧唐书》卷三十九 · 魏州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#魏州"],"prefectures":[{"name":"魏州","seat":"贵乡县、元城县","coord":[115.17,36.33],"replace":"魏州","counties":[["顿丘县",115,35.89],["临黄县",115.5,35.81],["朝城县",115.57,36.06],["昌乐县",115.21,36.08],["莘县",115.68,36.24],["冠氏县",115.43,36.48],["馆陶县",115.3,36.55]]}]},
    {"circuit":"山南东道","map":["山南东道、山南西道分幅","http://www.guoxue123.com/other/map/pic/10/09.jpg"],"history":["《旧唐书》卷三十九 · 襄州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#襄州"],"prefectures":[{"name":"襄州","seat":"襄阳县","coord":[112.13,32.01],"replace":"襄州","counties":[["乐乡县",112.27,31.33],["南漳县",111.83,31.78],["率道县",112.18,31.81],["义清县",112,31.84],["谷城县",111.62,32.29]]}]},
    {"circuit":"山南东道","map":["山南东道、山南西道分幅","http://www.guoxue123.com/other/map/pic/10/09.jpg"],"history":["《旧唐书》卷三十九 · 荆州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#荆州"],"prefectures":[{"name":"荆州","seat":"江陵县","coord":[112.19,30.35],"replace":"江陵","counties":[["石首县",112.39,29.72],["公安县",112.17,30.09],["松滋县",111.71,30.34],["枝江县",111.72,30.39],["当阳县",111.78,30.82],["长林县",112.03,31.1]]}]},
    {"circuit":"山南西道","map":["山南东道、山南西道分幅","http://www.guoxue123.com/other/map/pic/10/09.jpg"],"history":["《旧唐书》卷三十九 · 利州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#利州"],"prefectures":[{"name":"利州","seat":"绵谷县","coord":[105.85,32.45],"replace":"利州","counties":[["葭萌县",105.72,32.05],["嘉川县",106.22,32.21],["三泉县",105.96,32.73],["益昌县",105.69,32.35],["景谷县",105.54,32.67]]}]},
    {"circuit":"山南西道","map":["山南东道、山南西道分幅","http://www.guoxue123.com/other/map/pic/10/09.jpg"],"history":["《旧唐书》卷三十九 · 梁州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#梁州"],"prefectures":[{"name":"梁州","seat":"南郑县","coord":null,"counties":[["金牛县",106.25,33.05],["城固县",107.33,33.15],["褒城县",106.96,33.17],["西县",106.62,33.16]]}]},
    {"circuit":"山南西道","map":["山南东道、山南西道分幅","http://www.guoxue123.com/other/map/pic/10/09.jpg"],"history":["《旧唐书》卷四十一 · 阆州","https://zh.wikisource.org/zh-hans/舊唐書/卷41#阆州"],"prefectures":[{"name":"阆州","seat":"阆中县","coord":[105.97,31.6],"counties":[["新政县",106.3,31.29],["新井县",105.9,31.33],["南部县",106.06,31.35],["晋安县",105.9,31.4],["西水县",105.6,31.57],["苍溪县",105.95,31.75],["奉国县",106.27,31.82],["岐坪县",106.13,31.87]]}]},
    {"circuit":"山南西道","map":["山南东道、山南西道分幅","http://www.guoxue123.com/other/map/pic/10/09.jpg"],"history":["《旧唐书》卷四十一 · 果州","https://zh.wikisource.org/zh-hans/舊唐書/卷41#果州"],"prefectures":[{"name":"果州","seat":"南充县","coord":[106.08,30.81],"replace":"果州","counties":[["流溪县",105.91,30.62],["岳池县",106.28,30.69],["西充县",105.89,30.99],["相如县",106.37,31.04]]}]},
    {"circuit":"淮南道","map":["淮南道分幅","http://www.guoxue123.com/other/map/pic/10/10.jpg"],"history":["《旧唐书》卷四十 · 扬州","https://zh.wikisource.org/zh-hans/舊唐書/卷40#扬州"],"prefectures":[{"name":"扬州","seat":"江都县、江阳县","coord":[119.42,32.4],"replace":"扬州","counties":[["扬子县",119.39,32.34],["六合县",118.83,32.36],["高邮县",119.44,32.78],["海陵县",119.9,32.5]]}]},
    {"circuit":"淮南道","map":["淮南道分幅","http://www.guoxue123.com/other/map/pic/10/10.jpg"],"history":["《旧唐书》卷四十 · 庐州","https://zh.wikisource.org/zh-hans/舊唐書/卷40#庐州"],"prefectures":[{"name":"庐州","seat":"合肥县","coord":[117.29,31.88],"counties":[["庐江县",117.29,31.25],["舒城县",116.95,31.46],["巢县",117.86,31.61],["慎县",117.53,31.99]]}]},
    {"circuit":"淮南道","map":["淮南道分幅","http://www.guoxue123.com/other/map/pic/10/10.jpg"],"history":["《旧唐书》卷四十 · 寿州","https://zh.wikisource.org/zh-hans/舊唐書/卷40#寿州"],"prefectures":[{"name":"寿州","seat":"寿春县","coord":[116.77,32.57],"counties":[["盛唐县",116.5,31.74],["霍丘县",116.28,32.33],["安丰县",116.66,32.35]]}]},
    {"circuit":"淮南道","map":["淮南道分幅","http://www.guoxue123.com/other/map/pic/10/10.jpg"],"history":["《旧唐书》卷四十 · 楚州","https://zh.wikisource.org/zh-hans/舊唐書/卷40#楚州"],"prefectures":[{"name":"楚州","seat":"山阳县","coord":[119.14,33.51],"replace":"楚州","counties":[["盱眙县",118.5,33],["安宜县",119.31,33.25],["淮阴县",118.92,33.51],["盐城县",120.12,33.38]]}]},
    {"circuit":"陇右道","map":["陇右道东部分幅","http://www.guoxue123.com/other/map/pic/10/14.jpg"],"history":["《旧唐书》卷四十 · 秦州","https://zh.wikisource.org/zh-hans/舊唐書/卷40#秦州"],"prefectures":[{"name":"秦州","seat":"成纪县","coord":[105.56,34.95],"counties":[["上邽县",105.71,34.6],["伏羌县",105.33,34.74],["清水县",106.11,34.78],["陇城县",105.99,35]]}]},
    {"circuit":"陇右道","map":["陇右道东部分幅","http://www.guoxue123.com/other/map/pic/10/14.jpg"],"history":["《旧唐书》卷四十 · 鄯州","https://zh.wikisource.org/zh-hans/舊唐書/卷40#鄯州"],"prefectures":[{"name":"鄯州","seat":"湟水县","coord":[102.4,36.51],"replace":"鄯州","counties":[["龙支县",102.86,36.14],["鄯城县",101.76,36.61]]}]},
    {"circuit":"陇右道","map":["陇右道东部分幅","http://www.guoxue123.com/other/map/pic/10/14.jpg"],"history":["《旧唐书》卷四十 · 凉州","https://zh.wikisource.org/zh-hans/舊唐書/卷40#凉州"],"prefectures":[{"name":"凉州","seat":"姑臧县","coord":[102.64,37.93],"replace":"凉州","counties":[["昌松县",102.73,37.62],["嘉麟县",102.38,38.06],["番禾县",101.96,38.26]]}]},
    {"circuit":"河东道","map":["河东道分幅","http://www.guoxue123.com/other/map/pic/10/26.jpg"],"history":["《旧唐书》卷三十九 · 河中府","https://zh.wikisource.org/zh-hans/舊唐書/卷39#河中府"],"prefectures":[{"name":"蒲州","seat":"河东县","coord":[110.32,34.85],"replace":"蒲州","counties":[["永乐县",110.52,34.62],["虞乡县",110.62,34.87],["解县",110.85,34.92],["安邑县",111.05,35.05],["桑泉县",110.54,35.1],["猗氏县",110.77,35.15],["宝鼎县",110.48,35.32]]}]},
    {"circuit":"河东道","map":["河东道分幅","http://www.guoxue123.com/other/map/pic/10/26.jpg"],"history":["《旧唐书》卷三十九 · 绛州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#绛州"],"prefectures":[{"name":"绛州","seat":"正平县","coord":[111.21,35.62],"counties":[["垣县",111.87,35.11],["闻喜县",111.29,35.45],["绛县",111.56,35.49],["龙门县",110.69,35.59],["稷山县",110.97,35.62],["曲沃县",111.46,35.64],["翼城县",111.69,35.72],["太平县",111.27,35.81]]}]},
    {"circuit":"河东道","map":["河东道分幅","http://www.guoxue123.com/other/map/pic/10/26.jpg"],"history":["《旧唐书》卷三十九 · 潞州","https://zh.wikisource.org/zh-hans/舊唐書/卷39#潞州"],"prefectures":[{"name":"潞州","seat":"上党县","coord":[113.08,36.17],"counties":[["壶关县",113.19,36.11],["长子县",112.86,36.12],["屯留县",112.87,36.31],["潞城县",113.22,36.33],["黎城县",113.34,36.52],["襄垣县",113.03,36.53],["涉县",113.66,36.55],["铜鞮县",112.61,36.59]]}]},
    {"circuit":"河南道","map":["都畿道、河南道分幅","http://www.guoxue123.com/other/map/pic/10/27.jpg"],"history":["《旧唐书》卷三十八 · 汴州","https://zh.wikisource.org/zh-hans/舊唐書/卷38#汴州"],"prefectures":[{"name":"汴州","seat":"浚仪县、开封县","coord":[114.35,34.81],"replace":"汴州","counties":[["尉氏县",114.18,34.42],["雍丘县",114.77,34.55],["陈留县",114.51,34.66],["封丘县",114.41,35.04]]}]},
    {"circuit":"河南道","map":["都畿道、河南道分幅","http://www.guoxue123.com/other/map/pic/10/27.jpg"],"history":["《旧唐书》卷三十八 · 宋州","https://zh.wikisource.org/zh-hans/舊唐書/卷38#宋州"],"prefectures":[{"name":"宋州","seat":"宋城县","coord":[115.63,34.36],"counties":[["柘城县",115.3,34.11],["下邑县",116.14,34.24],["谷熟县",115.78,34.27],["宁陵县",115.35,34.44],["襄邑县",115.07,34.44],["虞城县",115.89,34.51],["单父县",116.09,34.8]]}]},
    {"circuit":"河南道","map":["都畿道、河南道分幅","http://www.guoxue123.com/other/map/pic/10/27.jpg"],"history":["《旧唐书》卷三十八 · 兖州","https://zh.wikisource.org/zh-hans/舊唐書/卷38#兖州"],"prefectures":[{"name":"兖州","seat":"瑕丘县","coord":[116.81,35.55],"counties":[["方舆县",116.53,35.01],["金乡县",116.32,35.07],["邹县",116.97,35.4],["任城县",116.58,35.41],["曲阜县",117.01,35.6],["泗水县",117.26,35.66],["龚丘县",116.79,35.76],["莱芜县",117.84,36.32]]}]},
    {"circuit":"剑南道","map":["《中国历史地图集》剑南道北部（741年）","http://www.guoxue123.com/other/map/pic/10/16.jpg"],"history":["《旧唐书》卷四十一 · 成都府","https://zh.wikisource.org/zh-hans/旧唐书/卷41#成都府"],"prefectures":[{"name":"益州","seat":"成都县、蜀县","coord":[104.07,30.67],"replace":"益州","counties":[["东阳县",104.28,30.55],["广都县",103.97,30.56],["双流县",103.94,30.59],["犀浦县",103.96,30.76],["郫县",103.89,30.8],["新都县",104.15,30.82]]}]},
    {"circuit":"剑南道","map":["《中国历史地图集》剑南道北部（741年）","http://www.guoxue123.com/other/map/pic/10/16.jpg"],"history":["《旧唐书》卷四十一 · 汉州","https://zh.wikisource.org/zh-hans/旧唐书/卷41#汉州"],"prefectures":[{"name":"汉州","seat":"雒县","coord":[104.28,30.97],"counties":[["金堂县",104.38,30.86],["什邡县",104.17,31.13],["德阳县",104.38,31.13],["绵竹县",104.2,31.34]]}]},
    {"circuit":"剑南道","map":["《中国历史地图集》剑南道北部（741年）","http://www.guoxue123.com/other/map/pic/10/16.jpg"],"history":["《旧唐书》卷四十一 · 眉州","https://zh.wikisource.org/zh-hans/旧唐书/卷41#眉州"],"prefectures":[{"name":"眉州","seat":"通义县","coord":[103.82,30.06],"replace":"眉州","counties":[["青神县",103.84,29.85],["洪雅县",103.2,29.93],["丹棱县",103.51,30.02],["彭山县",103.87,30.2]]}]},
    {"circuit":"剑南道","map":["《中国历史地图集》剑南道北部（741年）","http://www.guoxue123.com/other/map/pic/10/16.jpg"],"history":["《旧唐书》卷四十一 · 嘉州","https://zh.wikisource.org/zh-hans/旧唐书/卷41#嘉州"],"prefectures":[{"name":"嘉州","seat":"龙游县","coord":[103.75,29.57],"replace":"嘉州","counties":[["犍为县",104,29.15],["玉津县",103.82,29.48],["罗目县",103.49,29.55],["绥山县",103.62,29.57],["平羌县",103.72,29.64],["夹江县",103.56,29.76],["峨眉县",103.51,29.61]]}]},
    {"circuit":"江南东道","map":["《中国历史地图集》江南东道（741年）","http://www.guoxue123.com/other/map/pic/10/11.jpg"],"history":["《旧唐书》卷四十 · 苏州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#苏州"],"prefectures":[{"name":"苏州","seat":"吴县、长洲县","coord":[120.61,31.31],"replace":"苏州","counties":[["海盐县",120.93,30.51],["嘉兴县",120.76,30.73],["昆山县",121.15,31.09],["常熟县",120.74,31.65]]}]},
    {"circuit":"江南东道","map":["《中国历史地图集》江南东道（741年）","http://www.guoxue123.com/other/map/pic/10/11.jpg"],"history":["《旧唐书》卷四十 · 杭州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#杭州"],"prefectures":[{"name":"杭州","seat":"钱塘县","coord":[120.15,30.25],"replace":"杭州","counties":[["唐山县",119.22,30.18],["新城县",119.73,29.99],["富阳县",119.94,30.07],["于潜县",119.41,30.19],["余杭县",119.92,30.25],["临安县",119.71,30.33],["盐官县",120.54,30.41]]}]},
    {"circuit":"江南东道","map":["《中国历史地图集》江南东道（741年）","http://www.guoxue123.com/other/map/pic/10/11.jpg"],"history":["《旧唐书》卷四十 · 越州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#越州"],"prefectures":[{"name":"越州","seat":"山阴县、会稽县","coord":[120.57,30.01],"replace":"越州","counties":[["剡县",120.8,29.6],["诸暨县",120.21,29.71],["余姚县",121.16,30.04],["永兴县",120.27,30.15]]}]},
    {"circuit":"江南东道","map":["《中国历史地图集》江南东道（741年）","http://www.guoxue123.com/other/map/pic/10/11.jpg"],"history":["《旧唐书》卷四十 · 处州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#处州"],"prefectures":[{"name":"括州","seat":"括苍县","coord":[119.93,28.45],"replace":"处州","counties":[["青田县",120.29,28.16],["松阳县",119.42,28.54],["遂昌县",119.25,28.6],["缙云县",120.06,28.65]]}]},
    {"circuit":"江南东道","map":["《中国历史地图集》江南东道（741年）","http://www.guoxue123.com/other/map/pic/10/11.jpg"],"history":["《旧唐书》卷四十 · 建州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#建州"],"prefectures":[{"name":"建州","seat":"建安县","coord":[118.32,27.07],"replace":"建州","counties":[["沙县",117.83,26.41],["将乐县",117.44,26.75],["建阳县",118.09,27.34],["邵武县",117.47,27.33],["唐兴县",118.53,27.91]]}]},
    {"circuit":"江南西道","map":["《中国历史地图集》江南西道（741年）","http://www.guoxue123.com/other/map/pic/10/12.jpg"],"history":["《旧唐书》卷四十 · 洪州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#洪州"],"prefectures":[{"name":"洪州","seat":"豫章县","coord":[115.91,28.68],"replace":"洪州","counties":[["丰城县",115.79,28.2],["高安县",115.38,28.42],["新吴县",115.39,28.71],["建昌县",115.77,29.09],["豫宁县",114.94,29.25]]}]},
    {"circuit":"江南西道","map":["《中国历史地图集》江南西道（741年）","http://www.guoxue123.com/other/map/pic/10/12.jpg"],"history":["《旧唐书》卷四十 · 吉州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#吉州"],"prefectures":[{"name":"吉州","seat":"庐陵县","coord":[114.96,27.13],"replace":"吉州","counties":[["太和县",114.86,26.82],["永新县",114.22,26.97],["安福县",114.62,27.39],["新淦县",115.42,27.77]]}]},
    {"circuit":"江南西道","map":["《中国历史地图集》江南西道（741年）","http://www.guoxue123.com/other/map/pic/10/12.jpg"],"history":["《旧唐书》卷四十 · 袁州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#袁州"],"prefectures":[{"name":"袁州","seat":"宜春县","coord":[114.41,27.79],"replace":"袁州","counties":[["萍乡县",113.81,27.68],["新喻县",114.93,27.82]]}]},
    {"circuit":"江南西道","map":["《中国历史地图集》江南西道（741年）","http://www.guoxue123.com/other/map/pic/10/12.jpg"],"history":["《旧唐书》卷四十 · 虔州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#虔州"],"prefectures":[{"name":"虔州","seat":"赣县","coord":[114.94,25.85],"replace":"虔州","counties":[["南安县",114.94,25.39],["大庾县",114.41,25.41],["南康县",114.74,25.66],["雩都县",115.4,25.98],["虔化县",115.95,26.44]]}]},
    {"circuit":"黔中道","map":["《中国历史地图集》黔中道（741年）","http://www.guoxue123.com/other/map/pic/10/13.jpg"],"history":["《旧唐书》卷四十 · 黔州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#黔州"],"prefectures":[{"name":"黔州","seat":"彭水县","coord":[108.19,29.28],"replace":"黔州","counties":[["信宁县",107.86,29.23],["盈川县",107.98,29.11],["洪杜县",108.36,28.93],["石城县",108.85,29.48]]}]},
    {"circuit":"黔中道","map":["《中国历史地图集》黔中道（741年）","http://www.guoxue123.com/other/map/pic/10/13.jpg"],"history":["《旧唐书》卷四十 · 播州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#播州"],"prefectures":[{"name":"播州","seat":"遵义县","coord":[106.9,27.7],"replace":"播州","counties":[["芙蓉县",107.01,27.88]]}]},
    {"circuit":"黔中道","map":["《中国历史地图集》黔中道（741年）","http://www.guoxue123.com/other/map/pic/10/13.jpg"],"history":["《旧唐书》卷四十 · 夷州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#夷州"],"prefectures":[{"name":"夷州","seat":"绥阳县","coord":[107.76,27.96],"counties":[["义泉县",107.49,27.77],["都上县",107.99,27.95]]}]},
    {"circuit":"黔中道","map":["《中国历史地图集》黔中道（741年）","http://www.guoxue123.com/other/map/pic/10/13.jpg"],"history":["《旧唐书》卷四十 · 思州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#思州"],"prefectures":[{"name":"思州","seat":"务川县","coord":[108.51,28.57],"counties":[["思王县",108.35,28],["思邛县",108.43,28.02]]}]},
    {"circuit":"黔中道","map":["《中国历史地图集》黔中道（741年）","http://www.guoxue123.com/other/map/pic/10/13.jpg"],"history":["《旧唐书》卷四十 · 辰州","https://zh.wikisource.org/zh-hans/旧唐书/卷40#辰州"],"prefectures":[{"name":"辰州","seat":"沅陵县","coord":[110.39,28.48],"counties":[["溆浦县",110.58,27.92],["辰溪县",110.18,28.03],["麻阳县",109.98,27.88],["卢溪县",110.04,28.23]]}]},
    {"circuit":"岭南道","map":["《中国历史地图集》岭南道东部（741年）","http://www.guoxue123.com/other/map/pic/10/18.jpg"],"history":["《旧唐书》卷四十一 · 广州","https://zh.wikisource.org/zh-hans/旧唐书/卷41#广州"],"prefectures":[{"name":"广州","seat":"南海县","coord":[113.25,23.13],"replace":"广州","counties":[["宝安县",113.93,22.55],["番禺县",113.27,23.07],["四会县",112.7,23.36],["增城县",113.96,23.42],["化蒙县",112.42,23.61],["清远县",113.03,23.7],["怀集县",112.19,23.93],["浈阳县",113.39,24.18]]}]},
    {"circuit":"岭南道","map":["《中国历史地图集》岭南道东部（741年）","http://www.guoxue123.com/other/map/pic/10/18.jpg"],"history":["《旧唐书》卷四十一 · 韶州","https://zh.wikisource.org/zh-hans/旧唐书/卷41#韶州"],"prefectures":[{"name":"韶州","seat":"曲江县","coord":[113.54,24.79],"replace":"韶州","counties":[["翁源县",114.03,24.5],["始兴县",114.08,24.96],["乐昌县",113.37,25.15]]}]},
    {"circuit":"岭南道","map":["《中国历史地图集》岭南道东部（741年）","http://www.guoxue123.com/other/map/pic/10/18.jpg"],"history":["《新唐书》卷四十三上 · 潮州","https://zh.wikisource.org/zh-hans/新唐書/卷043上#潮州"],"prefectures":[{"name":"潮州","seat":"海阳县","coord":[116.61,23.69],"replace":"潮州","counties":[["潮阳县",116.46,23.3],["程乡县",116.1,24.32]]}]},
    {"circuit":"岭南道","map":["《中国历史地图集》桂州、容州附近（741年）","http://www.guoxue123.com/other/map/pic/10/21.jpg"],"history":["《旧唐书》卷四十一 · 桂州","https://zh.wikisource.org/zh-hans/旧唐书/卷41#桂州"],"prefectures":[{"name":"桂州","seat":"始安（分幅标法，史籍也作临桂）","coord":[110.27,25.29],"replace":"桂州","counties":[["建陵县",110.19,24.46],["阳朔县",110.55,25],["灵川县",110.38,25.47],["临源县",110.66,25.59],["永福县",109.97,25]]}]},
    {"circuit":"岭南道","map":["《中国历史地图集》桂州、容州附近（741年）","http://www.guoxue123.com/other/map/pic/10/21.jpg"],"history":["《旧唐书》卷四十一 · 柳州","https://zh.wikisource.org/zh-hans/旧唐书/卷41#柳州"],"prefectures":[{"name":"柳州","seat":"马平县","coord":[109.41,24.34],"replace":"柳州","counties":[["龙城县",109.25,24.56],["洛容县",109.5,24.5]]}]},
  ];
  // GENERATED-741-GROUPS-END

  for (const group of extraGroups) {
    const sources = [...new Map([group.map, group.history, openSeats].filter(Boolean)
      .map((entry) => [entry[1], entry])).values()];
    for (const prefecture of group.prefectures) {
      const existing = additions.find((place) => place.level === 'prefecture' &&
        (place.detailTitle || place.ancient) === prefecture.name && place.parent.includes(group.circuit));
      if (existing) {
        existing.seat = prefecture.seat;
        existing.sources = sources;
      } else if (prefecture.coord) {
        addPlace(prefecture.name, group.circuit, prefecture.coord, null, group.map, {
          level: 'prefecture', replace: prefecture.replace || prefecture.name, seat: prefecture.seat, sources,
        });
      }
      for (const [name, lng, lat] of prefecture.counties) {
        const exists = additions.some((place) => place.level === 'county' &&
          place.parent === prefecture.name && place.ancient === name);
        if (!exists) addPlace(name, prefecture.name, [lng, lat], null, group.map, { sources });
      }
    }
  }

  // Rough graticule readings of continuous portions of the 741 map lines.
  // The lines are intentionally open. See the attribution in README.md.
  const membershipStudy = ['杨远《唐代的人口》412–413 页', 'https://www.cuhk.edu.hk/ics/journal/articles/v19p389.pdf#page=24'];
  const circuitGuides = [
    {
      title: '京畿道',
      members: ['京兆府、岐州、邠州、华州、同州'],
      segments: [[[108.6, 33.4], [109.1, 33.7], [109.7, 34.0], [110.2, 34.4]]],
      precision: '据 741 年分幅经纬网近读，标出蓝田以南、商州以北的可辨南界。北、西界跨图幅接缝，仍待核实。',
      precisionEn: 'Approximate readings of the visible southern border from the 741 map. Northern and western sections require more evidence.',
      sources: [maps.capital, history, membershipStudy],
    },
    {
      title: '都畿道',
      members: ['可核核心辖区：河南府、陕州、郑州、汝州'],
      segments: [
        [[111.2, 34.5], [111.1, 34.3], [111.2, 34.1], [111.3, 34.0]],
        [[113.6, 34.3], [113.8, 34.4], [114.0, 34.5], [114.1, 34.7]],
      ],
      precision: '据 741 年洛阳附近插图近读，标出玉城附近西界及新郑至中牟附近东界。怀州归属有异文，其附近界段暂留空白。',
      precisionEn: 'Approximate readings of the western and eastern segments from the 741 inset. The sources disagree about Huaizhou.',
      sources: [maps.east, ['《通典》卷一百七十二 · 州郡序目', 'https://zh.wikisource.org/zh-hans/通典/卷172'], membershipStudy],
    },
  ];
  window.TANG_741_ATLAS = { places: additions, replacedNames, circuitGuides };
})();
