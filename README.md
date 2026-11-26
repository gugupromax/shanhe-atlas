# 山河图集 · Shanhe Atlas

基于 [江山时序 / jiangshan-map](https://github.com/DeanChensj/jiangshan-map) 二次开发的 2D/3D 中国历史地图，结合真实地形探索朝代疆域、历史事件、人物行迹与城市沿革。本 Fork 用于个人非商业学习与交流，保留原项目作者声明、GPL-3.0 及第三方数据许可例外；用途说明不改变原许可证。

3D 扩展最初基于上游提交 `897b9ad` 开发，曾同步合入 [`1a73bee`](https://github.com/DeanChensj/jiangshan-map/commit/1a73bee6c94e1eae93ceee44dcc1ac60cebc429b)。本 Fork 加入了本地真实高程、3D 渲染、原版地图贴地形、平面与 3D 的状态同步、本地启动工具和 3D 战役沙盘；上游地图数据与原版业务脚本保留其来源与许可。

[打开山河图集](https://gugupromax.github.io/shanhe-atlas/) · 中国历史地图 · 平面与 3D 地形

## 全国地图与 3D 地形

- 顶部切换「平面 / 3D 地形」，保留年份、人物站点、城市沿革与视野中心、比例。
- 将原版实时 SVG 地图铺到真实现代高程上，沿用原图配色、文字、边界、水系和人物标记。默认起伏 20×，图层菜单可调为 1×—120×。
- 3D 左键拖动平移、右键或 Shift 拖动旋转、滚轮缩放；H 统一复位。「点人溯事」的人物年谱及城市沿革共用原版面板，「舆图寻址 · 古地名小试」使用平面模式。
- 全国及周边高程覆盖 40°E—165°E、10°S—70°N，网格约 9—10 千米；太行及八陉试验数据另附较细网格。高程不能随放大恢复更细实测细节。
- 现代地形不随年代变形。原图历史边界、水系、海岸与人物连线仍为示意，尚未考证或测绘具体古道路基。

嵌入地图可使用 `embed=1`，例如 `?embed=1&from=1072&to=1126` 将时间轴限定在 1072 至 1126 年。

地图功能预览可查看[地图总览](assets/hero_demo_zh.webp)、[唐代人物行迹](assets/preview_741_tang_trace.webp)、[明代应天府](assets/preview_1415_ming_yingtian.webp)、[苏轼行迹](assets/preview_journey_sushi.webp)和[古地名小试](assets/preview_quiz_challenge.webp)。

## 3D 战役沙盘

在电脑上打开首页，从右上角「专题 → 3D 战役沙盘」选择战役。两场都能播放、暂停、拖动进度条和按章节跳转。沙盘左上角的「返回首页」可回到全国地图。以下以当前仓库版本为准，在线站点以实际部署版本为准。

| 战役 | 史实回放 | 代入指挥 |
| :-- | :-- | :-- |
| [井陉之战](battles/jingxing.html) · 公元前 204 年 | 75 秒、八幕，从赵军据营、汉军伏骑和背水列阵，到轻骑换旗、赵军惊乱。另有「兵种方阵」和「取景范围」视图。 | 可指挥汉军背水先行军、韩信与张耳所部，以及伏候轻骑。 |
| [香积寺之战](battles/xiangjisi.html) · 757 年 | 65 秒、五幕，从唐军前阵受挫、李嗣业稳阵，到回纥截击燕军东侧伏骑和前后夹击。右侧可展开双方指挥与重点人物。 | 右上角点「代入指挥」，可接手唐军和回纥方阵。 |

### 代入指挥

- 左键选方阵，也可点击底部部队卡。右键地面下达移动命令，右键敌军指定攻击目标。「坚守」会取消移动或追击。开战前可先下令，点击「开始战斗」后结算交战。支持暂停与重开。
- 香积寺默认「史料阵容」以唐军盾阵、李嗣业所部和回纥轻骑作为可操作单位。燕军东侧伏骑在史料中称「精骑」，轻重和装备未详。盾阵、骑兵细类和各队人数均经过玩法简化。
- 香积寺开战前可切到「兵种试验（非史实）」，加入弓兵、重骑和可换位的拒马。弓兵可远射，轻骑可骑射并转入近战，重骑只进行近战。骑兵近战伤害受接敌速度影响，高速移动穿过敌阵也能造成冲击伤害。试验阵容的拒马会降低经过部队的速度，对骑兵影响更大。

### 士气与史料

- 香积寺指挥模式的士气从 100 开始，随本队损失和本方全军伤亡下降。普通部队在士气 **30 或以下**时动摇，持续 **3 秒**才会溃散，随后退出交战并后撤。
- 井陉回放与代入指挥使用同一套士气条件。汉军背水时，玩法示意把溃散阈值从 **30** 降至 **15**。赵军看到赵营换上汉旗、误以为赵王和诸将被擒时，提示持续士气冲击。在井陉指挥中，背水阈值只对处于水岸区的汉军生效。赵军离营后，汉军轻骑可前往赵壁换旗；赵军接近并察觉后，才承受持续的士气损失。
- 沙盘中的地形、阵位、行军线、旗帜和兵俑数量均为示意。士气、攻击、防御、血量及方阵人数用于玩法。井陉战事依据[《史记·淮阴侯列传》](https://zh.wikisource.org/wiki/史記/卷092)。香积寺的交战经过及人物分工参见[《资治通鉴》卷二二〇](https://zh.wikisource.org/zh-hans/資治通鑑_(胡三省音注)/卷220)和[《旧唐书·肃宗纪》](https://zh.wikisource.org/wiki/舊唐書/卷010)。

## 战役配置与验证

- [兵种与阵法](battles/battle-units.js)统一维护单兵参数、接战距离、阵列行列和有效接战人数。每支部队的玩法人数、初始坐标、阵法及 AI 出动时间写在各自的[井陉配置](battles/scenario-jingxing.js)和[香积寺配置](battles/scenario-xiangjisi.js)。
- 新增战役时，先定义敌方阵营、可活动边界、双方允许的兵种、开局部队与史料出处。将有争议的配置放入可选试验阵容，史料、推测和玩法分别说明。可按需配置水岸区、营垒目标及士气触发阵营。
- 页面加载兵种表、战役配置、士气模块和共用指挥模块。通过 `createBattleCommand(view, panel, scenario)` 接入，在页面的 `view.commandFrame` 中将部队位置、剩余兵力、远程弹道和营垒状态更新到沙盘。地图渲染与点选由页面适配，新增战役无需改动共用战斗规则。
- 运行 `node battles/verify-command.cjs` 检查两场配置、守营时禁止易帜、赵军察觉后士气冲击、试验阵容与第三场配置接入。

### 多战场联动样板

已加入 [《绍宋》长社之战试点](battles/changshe.html)，从本地首页「专题 → 小说战役试点」进入。赵玖夜行、鄢陵与岳飞议战、召集诸将及处置杜充、清潩水进援、韩世忠见旗出城和长社解围都作为可回看的事件。参见[情节核对与出处](battles/changshe-sources.md)。全国与局部视角使用现代 3D 高程，城址、部队和路线为示意。开始后自动推进至下一次需下令的节点。赵玖进援后，韩世忠见旗突围，随后会师解围。

打开本地 [多战场联动样板](battles/campaign-demo.html) 可测试同一场战役的多个视角。总览显示全部战场和部队，点击战场可拉近，点击右侧部队可跟随其行军。切换视角会保留战役时间、部队位置和事件记录。样板使用原创示意场景。

- [战役状态](battles/campaign-state.js)以一条时钟推进部队位置和事件。[样板配置](battles/campaign-demo-config.js)分别声明战场、部队、行军时间、事件前置条件及士气变化，并复用已有兵种和阵法表。
- 事件可等待战果和到达。样板由按钮录入东线胜果，待援军实际到城后才解围。接入真正的局部沙盘时，由局部战斗结果调用 `campaign.report(signal)`。各场通过同一时钟推进，视角只读取快照，局部兵力和士气随部队交接。当前井陉与香积寺仍按单场运行。
- 小说专题采用独立的「小说改编」标识。正式配置需附作品章节或授权文本的出处，分别注明原著情节、史实背景和玩法演绎。尧山可先作为章节核查候选。起点平台的[作品介绍](https://book.qidian.com/booklist/detail/643368/)和[尧山相关专栏](https://h5.if.qidian.com/h5/share/column?columnId=22971)只提供作品与候选线索，具体情节以可核对章节为准。

运行 `node battles/verify-campaign.cjs` 可检查时间推进、战果触发、增援到达、解围及士气变化。

## 中央红军长征专题

打开地图后，从顶部「专题」选择「中央红军长征」或「苏轼行迹」，也可以搜索「专题」「长征」或「苏轼行迹」。日常浏览近现代大事记时，选中「遵义会议」会打开该事件的地图点。旧链接 `?event=changzheng` 仍可直接打开长征专题。

- 40 个节点从 1934 年于都河出发阶段展开，主线止于 1935 年 10 月 19 日吴起镇落脚；10 月 21 日战斗单列为收尾事件。红二、红四方面军及红二十五军的独立路线尚待扩展。
- 全图总览显示全程虚线；点选节点或卡片底部的上一站／下一站，联动地点、年份与当前段。专题卡片显示月日，底部全局时间轴仍以年为刻度。
- 战役、会议、渡河与翻山分别标注。展开“史料与地形”可查看经过、结果、地形解读、日期口径、定位说明与原文出处。
- 资料优先采用正式年表、党史机构研究、军史研究和纪念馆资料，官媒报道作补证。官方承载页面的转载、机构研究与原始档案介绍有不同证据范围，不把它们混称原始作战档案。
- 虚线为经过地点的走向示意；坐标按古今地名人工概略定位，具体渡口、山口与道路仍需校准。各军团不一定同日同路，现代 DEM 也没有被改造成 1935 年的地表。

编辑源为 `data/longmarch/central.json`。修改后运行 `node scripts/build_longmarch.cjs`，再运行 `node scripts/verify_longmarch.cjs` 和 `node scripts/build_longmarch.cjs --check`。这会只更新长征档案、节点及其来源登记，不重写其他人物内容。

## 历史地图参考与政区细节

**历史地图参考**：从「项目与来源」打开[历代地图参考](historical-map-references.html)，也可在古代各时期的史志中打开对应图组。索引来自[国学导航目录](http://www.guoxue123.com/other/map/zgmap/)，覆盖八册的 17 个网页图组，含原站附图和表。图名可搜索，部分全图年代可跳至本项目时间轴。明前期全图采用[北京大学图幅记录](https://geodata.pku.edu.cn/index.php?a=show&c=content&id=414)的宣德八年（1433 年）。原始图件由来源站点提供，本地索引保存图名、链接及对照年份。现有交互疆域的数据来源见上文。

2026-11-18 从原站 HTTP 目录提取。维护时可运行 `python -X utf8 scripts/import_historical_map_refs.py`，复核输出后更新 `data/historical-map-references.json`。

**历代政区细节**。平面与 3D 共用三档显示，远景查看一级政区，中景看郡、州、府或同时代同级政区，近景可显示有来源的县级治所。在「图层 → 政区层级」选择「郡州府＋县治」可开启县治，默认显示郡州府。可直接查看[明代应天府](?year=1415&hover=%E5%BA%94%E5%A4%A9%E5%BA%9C)。搜索和点选使用同一条政区记录。快照中的示意区划名称锚点和可考治所分别标注，缺少的隶属信息保留为未知。

本地数据包以 [CHGIS V6 府级治所](https://doi.org/10.7910/DVN/WW1PD6) 和[县级治所](https://doi.org/10.7910/DVN/Q9VOF5)的起止年补充各历史时期，并接入[郑伊辰、武廷海发布的数据](https://doi.org/10.6084/m9.figshare.30518417.v2)中已核对的公元 2、742、1102 和 1820 年治所。前三组依据《中国历史地图集》数字化，1820 年为研究者校核的 CHGIS 年层。清末另有带原表隶属的[1911 年治所年层](https://doi.org/10.7910/DVN/HHVVHX)，民国时段另有[1931 年县治年层](https://doi.org/10.5281/zenodo.5721459)。[图集同名索引](https://doi.org/10.7910/DVN/3KAHBT)与国学导航的分期目录从资料卡打开。索引同名条目用于查图，点位年代则由各自的点数据确定。

本地数据放在 `data/tiles/period-admin-sources/`，运行 `python scripts/build_period_admin.py` 生成应用按需加载的 `data/tiles/period-admin.js`。未安装本地数据包时，地图仍可使用内置政区快照。时间序列点位空间覆盖各期有差异，图集与其他单年层按其原年份显示。县治是点位资料，已有州府边界为示意。CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.

**唐朝 741 年试版**：进入 [开元二十九年](?year=741)，拉近地图可从道级范围看到州府，再看到已核对的县治。平面与 3D 可单击区域、地名或两畿的紫色道界段，打开详情。州府面沿用项目的跨期示意层，补充的县治显示为约略点位。同城州府和附郭县共用一个治所标记。

名称与隶属依据[唐时期全图（二）](http://www.guoxue123.com/other/map/pic/10/03.jpg)、同期分幅及[《旧唐书》地理志](https://zh.wikisource.org/zh-hans/旧唐书/卷38)核对。县治坐标采用郑伊辰、武廷海公开研究数据的 742 年图幅配准点，经转为经纬度、取至 0.01°，逐项核对 741 年的称谓和隶属，仅用于近似定位。[县治点数据和 CC BY 4.0 许可](https://doi.org/10.6084/m9.figshare.30518417.v2)

两畿紫色虚线根据 741 年[京畿、关内分幅](http://www.guoxue123.com/other/map/pic/10/05.jpg)与[都畿、河南分幅](http://www.guoxue123.com/other/map/pic/10/27.jpg)的经纬网粗读至约 0.1°。京畿核心为京兆府和岐、邠、华、同四州，都畿核心为河南府和陕、郑、汝三州。京畿北西的图幅接缝和都畿怀州附近的异文仍待核，先显示可辨道界段。参见[《通典》卷一百七十二](https://zh.wikisource.org/zh-hans/通典/卷172)和[杨远《唐代的人口》第 412–413 页](https://www.cuhk.edu.hk/ics/journal/articles/v19p389.pdf)。

更新南北两组 741 年核对数据后，运行 `node scripts/build_tang_741.cjs` 汇编到离线图层，再运行 `node scripts/sync_version.js --write-only` 生成资源版本。

741 年 3D 的地名使用独立文字层，随地理位置移动，在斜俯和旋转时保持正向，按缩放显示道、州府和县治。生成本地瓦片后，默认简体图层按视野读取三档预生成地形贴图。支持 4096 像素贴图的大视窗会读取无损高清远景，中近景在设备支持时保留瓦片原始分辨率。少量瓦片可按原分辨率直接贴合地形，可见地形区块按需上传。3D 的关隘图层使用贴地的小城关，从地图缩放 2 倍起显示。关隘的出现、消失和历代称呼以当前年份的地图数据为准。模型随地图缩放，宽度和墙高按周围地形高差作示意估算。地形起伏倍数会带动城关地基随坡面升降，城关本身的尺寸保持固定。县治用固定屏幕大小的圆点显示。点击关隘可查看沿革。点选高亮由三维视图独立绘制，资料卡沿用现有原图、隶属和史料。其他年份、语言或自定义图层使用实时贴图，人物行迹和点地溯源也使用原流程。瓦片包含另有使用条款的图层，按需在本机生成。新检出的仓库使用实时底图。需要生成或更新 741 年本地瓦片时，启动本地地图服务，再运行 `node scripts/build_tang_741_tiles.cjs` 更新 `assets/tang-741-tiles/`。加 `--base-hd` 可在底图源数据未变时单独重建高清远景。瓦片清单记录构建输入、图片尺寸和校验值。提交前可运行 `node scripts/build_tang_741_tiles.cjs --check` 在本地校验，无需启动浏览器。

## 本地运行

使用已有 Python 3，在仓库根目录运行 `python -m http.server 8000 --bind 127.0.0.1`，浏览器打开 `http://127.0.0.1:8000/`。Windows 也可双击「启动地图.cmd」，结束后用「停止地图.cmd」停止本机服务。无需安装第三方 Python 包；浏览器需支持 WebGL。为可靠读取本地资源，推荐通过本机 HTTP 服务打开，不直接双击 HTML。

### 验证

CI 用合成数据测试历代治所生成器，并运行治所相关单测。完整数据集的验收在本机进行。将下载的第三方源数据放入 `data/tiles/period-admin-sources/`，用 Python 3 运行 `python scripts/build_period_admin.py` 生成数据包，再运行 `node scripts/verify_all.cjs`，省略 `--allow-unbuilt`。

启动本地地图后，运行 `node scripts/verify_terrain_browser.cjs` 做 3D 浏览器验收。脚本会读取启动器记录的地址。手动用 `python -m http.server 8000 --bind 127.0.0.1` 启动时，先将 `TERRAIN_TEST_URL` 设为 `http://127.0.0.1:8000/`。

## 数据来源与许可

新增高程来自 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)，数据下载日期、范围、网格及哈希见 `data/context_manifest.json`、`data/manifest.json`。署名：SRTM、GMTED2010 terrain data courtesy of the U.S. Geological Survey；Global ETOPO1 terrain data: NOAA；详见 [原始署名要求](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)。Three.js r160 使用 MIT，许可证保存在 `vendor/LICENSE-three.txt`。

| 图层 | 来源 | 授权 |
| :-- | :-- | :-- |
| 代码（页面、脚本、CLI、MCP 服务） | 本项目 | GPL-3.0 |
| 政权疆域轮廓（`polity`） | 以 [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps)（GPL-3.0）为起点，此后依据史籍手工重绘 | GPL-3.0 |
| 一级政区（`region`：刺史部 / 道 / 路 / 省等） | 依据史籍手工绘制；早期版本的原始来源未记录 | GPL-3.0 |
| **郡 / 州 / 府级边界**（`prefecture`，含战国与秦的郡） | 源自 **CHGIS V6** 与 **Robert M. Hartwell China Historical GIS**，简化至 0.01° 并经手工调整 | **不适用 GPL-3.0**。仅限学术、非商业用途，不得再分发，详见下文 |
| 古地名、重大事件、行迹路线、人物年谱、地名沿革 | 本项目依据史籍整理 | GPL-3.0 |
| 现代省界 | DataV GeoAtlas（阿里云） | 以 DataV GeoAtlas 条款为准 |
| 基础河湖与周边国家 | 公有领域数据；参考湖岸来自 [Natural Earth](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/) | 公有领域 |
| 东居延海现代参考岸线 | [ESA WorldCover 2021 v200](https://doi.org/10.5281/zenodo.7254221) 常年水面分类的概化轮廓，提取方法与署名见[图层来源](map-sources.html#water-credits) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| 地形晕渲 | 由 `scripts/build_terrain_tiles.py` 基于 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（公有领域的 **SRTM**、**GMTED2010**、**ETOPO1**）渲染；仓库只发布最细约 1 km/像素的晕渲图片 | GPL-3.0（图片） |
| 古琴录音 | Wikimedia Commons（《流水》《平沙落雁》《阳关三叠》《醉渔唱晚》《酒狂》） | 公有领域 |

**郡 / 州 / 府级边界（CHGIS）**：该图层不适用 GPL-3.0，仅用于本站非商业的科普展示。请勿从本仓库转载或再分发；如需郡州府边界，请从 CHGIS 官方渠道（Harvard Dataverse）按其条款获取。`scripts/export_geojson.js` 默认不导出该图层，加 `--with-prefectures` 参数才会导出。引用格式：*CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.* 数据来源细节见 [data/atlas/README.md](data/atlas/README.md)。

**近似边界**：地图中的历史疆域与政区边界为示意性近似，用于直观呈现各时期大致的管辖范围，并非测绘成果，请勿作为精确或权威的边界依据引用。

**转载与复用**：复用 GPL-3.0 图层时，请注明「江山时序 Jiangshan Atlas」并附 https://github.com/DeanChensj/jiangshan-map ，同时注明上文所列原始来源。含郡州府图层的截图同样受 CHGIS 条款约束。

## 上游项目与贡献

江山时序提供了历史疆域、政区、地名沿革、编年大事和人物行迹等地图基础。原版演示、完整操作说明和接入文档见[上游网站](https://deanchen.me/jiangshan-map/)和[上游仓库](https://github.com/DeanChensj/jiangshan-map)。

**权利人联系**：如果您是本仓库中某项内容的权利人，认为使用不当，请[提交 issue](https://github.com/DeanChensj/jiangshan-map/issues)，请在 issue 中注明对应文件或图层。

**参与贡献**：参见 [中文贡献指南 (`CONTRIBUTING_ZH.md`)](CONTRIBUTING_ZH.md)了解项目结构、史料校勘规范与自动化校验流程。

**数据纠错**：发现年份、地点或描述有误，请[提交纠错 issue](https://github.com/DeanChensj/jiangshan-map/issues/new?template=data-error.yml)，最好附上出处。

Copyright © 2026 DeanChensj。除上文注明的例外，采用 GPL-3.0（见 [LICENSE](LICENSE)）。
