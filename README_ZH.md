# 山河地图 · Shanhe Atlas

基于 [江山时序 / jiangshan-map](https://github.com/DeanChensj/jiangshan-map) 二次开发的 2D/3D 中国历史地图，结合真实地形探索朝代疆域、历史事件、人物行迹与城市沿革。本 Fork 用于个人非商业学习与交流，保留原项目作者声明、GPL-3.0 及第三方数据许可例外；用途说明不改变原许可证。

本次扩展基于上游提交 `897b9ad4e987fcface8728ffdfbe33e801a3dbae` 开发。新增内容为本地真实高程、3D 渲染、原版地图贴地形、双模式状态同步及本地启动工具；上游地图数据与原版业务脚本保留其来源与许可。

## 本 Fork 的 3D 扩展

- 顶部切换「平面 / 3D 地形」，保留年份、人物站点、城市沿革与视野中心、比例。
- 将原版实时 SVG 地图铺到真实现代高程上，沿用原图配色、文字、边界、水系和人物标记。默认起伏 20×，图层菜单可调为 1×—120×。
- 3D 左键拖动平移、右键或 Shift 拖动旋转、滚轮缩放；H 统一复位。人物年谱及城市沿革共用原版面板，小试仍使用平面模式。
- 全国及周边高程覆盖 40°E—165°E、10°S—70°N，网格约 9—10 千米；太行及八陉试验数据另附较细网格。高程不能随放大恢复更细实测细节。
- 现代地形不随年代变形。原图历史边界、水系、海岸与人物连线仍为示意，尚未考证或测绘具体古道路基。

使用已有 Python 3，在仓库根目录运行 `python -m http.server 8000`，浏览器打开 `http://127.0.0.1:8000/`。Windows 也可双击「启动地图.cmd」，结束后用「停止地图.cmd」停止本机服务。无需安装第三方 Python 包；浏览器需支持 WebGL。为可靠读取本地资源，推荐通过本机 HTTP 服务打开，不直接双击 HTML。

新增高程来自 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)，数据下载日期、范围、网格及哈希见 `data/context_manifest.json`、`data/manifest.json`。署名：SRTM、GMTED2010 terrain data courtesy of the U.S. Geological Survey；Global ETOPO1 terrain data: NOAA；详见 [原始署名要求](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)。Three.js r160 使用 MIT，许可证保存在 `vendor/LICENSE-three.txt`。

原有 CHGIS/Hartwell 及 DataV 图层仍保留上游的许可说明与例外，不因新增 3D 而统一改为 GPL 或声明为本 Fork 原创。下方保留上游 README，其在线演示仍指向原作者网站，不代表本 Fork 已部署 3D 网站。

### 中央红军长征专题

打开地图后，从顶部「专题」选择「中央红军长征」或「苏轼行迹」，也可以搜索「专题」「长征」或「苏轼行迹」。日常浏览近现代大事记时，选中「遵义会议」会打开该事件的地图点。旧链接 `?event=changzheng` 仍可直接打开长征专题。

- 40 个节点从 1934 年于都河出发阶段展开，主线止于 1935 年 10 月 19 日吴起镇落脚；10 月 21 日战斗单列为收尾事件。红二、红四方面军及红二十五军的独立路线尚待扩展。
- 全图总览显示全程虚线；点选节点或卡片底部的上一站／下一站，联动地点、年份与当前段。专题卡片显示月日，底部全局时间轴仍以年为刻度。
- 战役、会议、渡河与翻山分别标注。展开“史料与地形”可查看经过、结果、地形解读、日期口径、定位说明与原文出处。
- 资料优先采用正式年表、党史机构研究、军史研究和纪念馆资料，官媒报道作补证。官方承载页面的转载、机构研究与原始档案介绍有不同证据范围，不把它们混称原始作战档案。
- 虚线为经过地点的走向示意；坐标按古今地名人工概略定位，具体渡口、山口与道路仍需校准。各军团不一定同日同路，现代 DEM 也没有被改造成 1935 年的地表。

编辑源为 `data/longmarch/central.json`。修改后运行 `node scripts/build_longmarch.cjs`，再运行 `node scripts/verify_longmarch.cjs` 和 `node scripts/build_longmarch.cjs --check`。这会只更新长征档案、节点及其来源登记，不重写其他人物内容。

---

# 上游项目说明：江山时序 · Chronicles of the Realm

<p align="left">
  <a href="README.md">English</a> · <strong>简体中文</strong> · <a href="README_ZH_HANT.md">繁體中文</a> · <a href="README_JA.md">日本語</a>
</p>

**一幅可以拖动时间、点城读史、追随古人足迹的中国历史交互舆图（公元前 403 年三家分晋 — 今）**

[**立即在线把玩 → https://deanchen.me/jiangshan-map/**](https://deanchen.me/jiangshan-map/)

*作者自述：[从历史课本里的插图，到 GitHub 1k star：「江山时序」背后的故事](https://deanchen.me/history/atlas/2026/10/25/jiangshan-map-story.html)*

<p align="center">
  <a href="https://www.star-history.com/deanchensj/jiangshan-map">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=deanchensj/jiangshan-map&type=trending&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=deanchensj/jiangshan-map&type=trending" />
      <img alt="GitHub Trending 每日项目第 2 名" src="https://api.star-history.com/badge?repo=deanchensj/jiangshan-map&type=trending" height="56" />
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://deanchen.me/jiangshan-map/">
    <img src="assets/hero_demo_zh.webp" alt="江山时序 15 秒实机演示：秦扫六合、两千年疆域流转、长安十八朝沿革与苏东坡贬谪行迹" width="100%" />
  </a>
</p>

---

## 这幅地图好玩在哪里？

读史书、背古诗词时，你是否也常有这样的困惑：
- *「六朝古都建康、苏东坡被贬的黄州、韩愈勒马的秦岭蓝关、岳飞北伐的朱仙镇，放在今天的地图上到底在哪儿？」*
- *「长安在两千年里换过多少个名字？这片土地上先后发生过多少场改写国运的大事？」*
- *「《资治通鉴》开篇的三家分晋与战国七雄、秦王嬴政十年扫六合、汉武帝打通河西走廊、盛唐安西四镇与王玄策破中天竺、元代设宣政院辖西藏、晚清曾纪泽收复伊犁，再到近现代版图从『秋海棠』变为『雄鸡』，疆域是怎么一步步演变的？」*

**「江山时序」** 把从公元前 403 年（《资治通鉴》开篇 · 三家分晋）至今 **两千四百余年**、**18 个历史时期**的**多阶段疆域与州郡政区舆图**、**历代古城**、**天下名关**、**诗词名胜与古战场**、**编年大事**及**帝王年号纪年**装进了一张宣纸设色古舆图里。你不需要翻检厚重的历史地图册，只需拖动滑块、点点城池，就能在时空之间自由穿梭。

---

### 玩法一：拉动时间轴看天下分合、查在位帝王、比古今省界

- **同屏看多政权对峙**：从战国七雄（秦、楚、齐、燕、赵、魏、韩）与周、越、巴蜀、中山、义渠并立，到汉末三国群雄割据（袁绍、曹操、刘备、孙权、公孙氏辽东），再到南北朝、五代十国与宋、辽、西夏、大理、金、蒙古，都以高对比度宣纸设色同屏呈现。鼠标移到左下角图例的政权名字上，对应政权立刻高亮；点一下则打开该政权的档案（存续年代、都城变迁与简介），并把镜头聚焦到它的疆域。
- **多阶段疆域演进与「虚线残影」对比**：每一个重大开疆或失地节点——如前 316 年司马错灭巴蜀、前 300 年燕将秦开破东胡辟辽东五郡、43 年马援平交趾立铜柱、238 年司马懿平公孙渊收辽东、635 年李靖平吐谷浑、648 年置安西四镇与王玄策破中天竺、1288 年元设宣政院直辖西藏、1407 年明平安南设交趾布政司、1643 年大顺大西起兵、1673 年三藩之乱、1881 年曾纪泽签《中俄伊犁条约》收复伊犁、1898 年列强强租胶州湾/旅大/威海卫/九龙新界，乃至 1945 年抗战胜利台湾光复（“秋海棠”重光）与 1946 年外蒙古独立（版图由**“秋海棠”变为“雄鸡”**）——点击编年事件或阶段圆点，版图即刻切换并浮现上一阶段的朱砂虚线残影，盈亏得失一目了然。
- **当朝在位帝王与年号同步显示**：时间轴上方的气泡实时显示当年在位君主与年号纪年，如 `西汉武帝·天汉元年`、`唐太宗·贞观四年`、`清康熙三十九年`。
- **历代州府悬停即查 & 古今省界对照**：一级政区采用拓扑去重与宣纸衬底双重描边（Parchment Casing）；放大地图悬停任意州郡（如明代的「应天府」「顺天府」、三国的「荆州」）即可查看政区归属与今省对照。右上角 **「图层」** 菜单里的「现代省界」默认开启，把今天的省界叠在古舆图上，还可以再打开「现代省名」。
- **水系古泽与千年工程随年代流转**：拉动时间轴时，黄河历代改道、云梦泽与罗布泊（蒲昌海）等古湖消长，以及战国秦汉明长城、隋唐与京杭大运河、丝绸之路、郑和航线均随当朝版图同步演进；渤海湾、苏北、长江口与珠江三角洲的古海岸线也会随年代进退。
- **时间轴可缩放**：向内拖动时间轴两端的手柄可放大某一段历史（如秦、三国、五代这类短朝代），双击时间轴恢复全览。
- **语音讲解**：打开播放按钮旁的讲解开关，时间轴自动播放时会用浏览器内置语音朗读纪年、年号与当年大事，人物行迹的自动巡礼同样适用（需要浏览器支持语音合成）。

> [点击直达：大明永乐十三年（1415 年）· 两京十三布政使司与「应天府」府境探查 →](https://deanchen.me/jiangshan-map/?year=1415&zoom=1.75&center=115.8,33.2&hover=%E5%BA%94%E5%A4%A9%E5%BA%9C)

![明永乐十三年（1415 年）· 应天府政区悬停预览](assets/preview_1415_ming_yingtian.webp)

---

### 玩法二：点开任意一座城或名关，读它两千四百年的身世与风云

在地图上**直接点击任意古城、名关**（或者双击地图任意位置），就会展开一张 **「点地溯源」** 卡片：
- **名城风华题记与古今政区沿革**：卡片顶部呈现该城专属的**名城判词与千年历史小传**；下方沿革表从战国七雄与秦朝的郡、汉朝的刺史部、唐朝的道、宋朝的路，一路看到元明清的行省与府州，直至现代省市；哪几个朝代曾在此建都（`王朝都城` 徽章）与各朝代治所掌故一目了然。
- **看这里发生过什么大事**：每个朝代行下方直接内嵌当年发生在此地的**定点地标大事**（如咸阳的「商鞅变法」「秦王扫六合」、樊城的「关羽水淹七军」、长安的「玄武门之变」、临安的「风波亭岳飞蒙难」）。点一下右上角的 **「史事纪要」** 胶囊，还能一键筛出有大事发生的朝代；点击任意一条事件，时间轴和地图版图立即穿越回那一年！
- **探访天下名关与诗词名胜**：地图以专属汉阙城楼图标标出函谷关、潼关、剑门关、雁门关、玉门关、阳关、山海关等**天下雄关**（附山脉水系扼守形势详解），并收录赤壁、垓下、五丈原、兰亭、岳阳楼、滕王阁、蓝关、楼兰、蒲昌海（罗布泊）、热海（伊塞克湖）等**诗词名胜与古战场**，支持直接检索落针。

> [点击直达：盛唐开元二十九年（741 年）· 点开长安看千年风云 →](https://deanchen.me/jiangshan-map/?year=741&place=长安)

![盛唐 741 年 · 长安点地溯源与史事纪要](assets/preview_741_tang_trace.webp)

---

### 玩法三：点人溯事 —— 搜任意帝王将相与文豪名僧，重走万里青史路

点开左上角 **万能搜索框**（附单条可轮换人物示例与 `长安 / 赤壁 / 霍去病 / 李白 杜甫 高适` 快捷检索词，亦可直接输入 `曹操`、`司马迁`、`岳飞`、`郑和` 等任意历史人物），即可展开 **「点人溯事」** 生平纪事面板，在山河版图上以编号图钉标出其一生行迹：
- **秦始皇一统六国行迹（前 238 — 前 221 年）**：从咸阳亲政平乱、王翦攻赵邺城拉开序幕，到内史腾灭韩、王翦克邯郸灭赵、易水破燕拔蓟城、王贲水灌大梁灭魏、王翦六十万大军破楚、远征辽东灭燕平代，直至南下临淄齐王建出降、六国一统——每点下一处史事，地图上的韩、赵、魏、楚、燕、齐便随之一步步并入大秦版图！
- **张骞凿空西域行迹（前 138 — 前 126 年）**：从长安出发，被匈奴羁留十余载不改其志，持汉节一路走到大宛、康居、大月氏。
- **诸葛亮出山北伐行迹（207 — 234 年）**：从襄阳隆中三顾茅庐、柴桑联吴破曹、溯江入蜀、白帝托孤、五月渡泸南征，到进驻汉中上《出师表》、祁山北伐与五丈原秋风星落。
- **玄奘西行求法行迹（627 — 645 年）**：孤身出玉门关，涉莫贺延碛、越凌山雪隘、渡印度河，抵那烂陀寺求法、赴曲女城讲论，载誉归唐。
- **李白仗剑壮游行迹（701 — 762 年）**：自安西碎叶入蜀居青莲，二十四岁仗剑出三峡、漫游扬州散金三十万、酒隐安陆、仰天大笑入长安供奉翰林、洛阳逢杜甫、白帝城遇赦放舟，终老当涂青山。
- **苏轼宦海贬谪行迹（1056 — 1101 年）**：从出川赴京、密州超然台赏月，到乌台诗案后贬谪黄州写下《赤壁赋》，再到惠州、跨海远谪海南儋州。
- **王阳明心学立功行迹（1472 — 1529 年）**：从余姚瑞云楼降生、京师抗疏下诏狱，到贬谪贵州修文「龙场悟道」始倡知行合一、庐陵讲学、巡抚南赣破山贼、三十五日生擒宁王朱宸濠、绍兴天泉证道揭出「致良知」，直至总督两广归途舟次南安留下「此心光明，亦复何言」。
- **多人同看**：在搜索框里一次输入两三个人物（如 `李白 杜甫 高适`、`曹操 刘备 孙权`），几人的行迹合并到同一条时间轴上，同年同地的相逢以「同途」标出，点 `同途 N` 可只看交集站点。
- **点事溯局**：重大历史事件也能像人物一样逐站展开。目前收录楚汉之争（前 207 — 前 202 年）、安史之乱（755 — 763 年）与靖康之变（1125 — 1142 年），各以十个节点分三幕铺开，对阵双方用两种颜色区分，攻守路线一目了然。

每切换上一处 / 下一处史事（点击面板里的「上一站 / 下一站」或底部的 **`‹ / ›`**、键盘方向键，或按空格键自动演进），**底下的历史年份、在位君主与年号、王朝版图都会跟着古人的脚步同步流转**，单段朱砂飞白弧线精准高亮当前行程，并附有《史记》《出师表》《传习录》或唐宋千古名篇原句。

> [点击直达：展阅苏东坡宦海贬谪生平与行迹（1037 — 1101 年）→](https://deanchen.me/jiangshan-map/?person=sushi)

![点人溯事 · 苏轼生平与宦海行迹](assets/preview_journey_sushi.webp)

---

### 玩法四：彩蛋 · 舆图寻址挑战 —— 测测你在古代能当几品官？

觉得自己历史地理很熟？点开左上角 **搜索框** 引导栏右下角的 **「古地名小试 ›」**（或直接搜 `小试` / `寻址` 开启 **「舆图寻址 · 古地名小试」**）试试身手：
- **当朝掌故线索 + 舆图盲猜扎针**：地图隐去所有城池标注，十道题按梯度递进，题目形如「请在舆图上标定【西汉】时期的『武威』」，并附上**当朝掌故与史事线索**（不剧透现代城市名），凭你的山河水系直觉在舆图上落针预览、点击图钉旁的 **「`确认 ↵`」** 揭晓同心圆环距离得分！
- 十道题答完，系统会根据总分授予你 **「太史令 · 舆图大家」「职方郎中」「州郡从事」** 等传统官阶封号。

> [点击直达：西汉武帝元狩二年（前 121 年）· 开启「舆图寻址」挑战模式 →](https://deanchen.me/jiangshan-map/?year=-121&quiz=locate)

![西汉前 121 年 · 舆图寻址挑战模式预览](assets/preview_quiz_challenge.webp)

---

## 实用快捷键与任意门（Deep Links）

### 快捷键一览

| 操作 / 按键 | 作用 |
| :--- | :--- |
| **`/`** 或 **`Cmd/Ctrl + K`** | 唤醒左上角**万能搜索框**：支持搜**古今城池**（`咸阳`/`长安`/`洛邑`/`东京汴梁`）、**在位帝王**（`汉武帝`/`刘彻`/`李世民`/`朱元璋`）、**帝王年号**（`元狩二年`/`贞观`/`永乐`）、**诗词名胜与古战场**（`赤壁`/`五丈原`/`蓝关`/`兰亭`）、**天下名关**（`函谷关`/`剑门关`/`玉门关`）、**历史大事**（`长平之战`/`水淹七军`/`玄武门之变`）或**人物行迹** |
| **`←` / `→`** 或底部 **`‹ / ›`** | 键盘左右键与底部 **`‹ / ›`** 按钮直接跳往上 / 下一关键历史阶段、事件节点或行迹站点（按住 `Shift + ← / →` 进退 `10` 年） |
| **`Space`（空格键）** | 自动播放 / 暂停历史演进（行迹模式下自动巡礼） |
| **`Esc`** | 一键关闭弹窗卡片、清除搜索高亮或自定义多站路线 |
| **`单击古城` / `双击地图`** | 打开该地从战国到近现代的 18 时期「点地溯源 + 史事纪要」卡片 |
| **`悬停 / 点击图例色块`** | 悬停单独高亮该政权疆域；点击打开政权档案并缩放聚焦至该政权 |

### 一键直达链接（适合分享给朋友）

你可以直接在网址后面加上参数，把某个特定的历史瞬间分享给朋友：
- **看某一年或重大疆域变迁**：[`?year=-403`](https://deanchen.me/jiangshan-map/?year=-403)（《资治通鉴》开篇 · 三家分晋） / [`?year=-121`](https://deanchen.me/jiangshan-map/?year=-121)（西汉霍去病开河西） / [`?year=648`](https://deanchen.me/jiangshan-map/?year=648)（唐置安西四镇与王玄策破中天竺） / [`?year=1288`](https://deanchen.me/jiangshan-map/?year=1288)（元改宣政院直辖西藏） / [`?year=1881`](https://deanchen.me/jiangshan-map/?year=1881)（曾纪泽签约收复伊犁） / [`?year=1945`](https://deanchen.me/jiangshan-map/?year=1945)（抗战胜利台湾光复 · “秋海棠”重光）
- **看某场大战**：[`?year=-260&place=长平`](https://deanchen.me/jiangshan-map/?year=-260&place=长平)（长平之战） / [`?year=208&place=赤壁`](https://deanchen.me/jiangshan-map/?year=208&place=赤壁)（赤壁之战） / [`?year=383&place=淝水`](https://deanchen.me/jiangshan-map/?year=383&place=淝水)（东晋前秦 · 淝水之战）
- **查某座古城或名胜的千年故事**：[`?year=741&place=长安`](https://deanchen.me/jiangshan-map/?year=741&place=长安)（长安/西安） / [`?year=1415&place=应天府`](https://deanchen.me/jiangshan-map/?year=1415&place=应天府)（建康/应天/南京） / [`?year=819&place=蓝关`](https://deanchen.me/jiangshan-map/?year=819&place=蓝关)（韩愈「雪拥蓝关马不前」）
- **画一条自定义诗词/行军路线**：[`?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳`](https://deanchen.me/jiangshan-map/?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳)（杜甫《闻官军收河南河北》同年归乡路） / [`?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州`](https://deanchen.me/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州)（苏轼「黄州惠州儋州」跨年贬谪路）
- **展阅历史人物生平与行迹**：[`?person=qinshihuang`](https://deanchen.me/jiangshan-map/?person=qinshihuang)（秦始皇） / [`?person=zhangqian`](https://deanchen.me/jiangshan-map/?person=zhangqian)（张骞凿空西域） / [`?person=zhugeliang`](https://deanchen.me/jiangshan-map/?person=zhugeliang)（诸葛亮出山北伐） / [`?person=xuanzang`](https://deanchen.me/jiangshan-map/?person=xuanzang)（玄奘西行求法） / [`?person=libai`](https://deanchen.me/jiangshan-map/?person=libai)（李白仗剑壮游） / [`?person=sushi`](https://deanchen.me/jiangshan-map/?person=sushi)（苏轼宦海贬谪） / [`?person=wangyangming`](https://deanchen.me/jiangshan-map/?person=wangyangming)（王阳明心学立功）
- **多人同看与历史事件**：[`?person=libai,dufu`](https://deanchen.me/jiangshan-map/?person=libai,dufu)（李白与杜甫） / [`?person=caocao,liubei,sunquan`](https://deanchen.me/jiangshan-map/?person=caocao,liubei,sunquan)（曹操、刘备、孙权） / [`?event=qintongyi`](https://deanchen.me/jiangshan-map/?event=qintongyi)（秦灭六国） / [`?event=chuhan`](https://deanchen.me/jiangshan-map/?event=chuhan)（楚汉之争） / [`?event=anshi`](https://deanchen.me/jiangshan-map/?event=anshi)（安史之乱） / [`?event=jingkang`](https://deanchen.me/jiangshan-map/?event=jingkang)（靖康之变）
- **直接开一局挑战**：[`?year=-121&quiz=locate`](https://deanchen.me/jiangshan-map/?year=-121&quiz=locate)（舆图寻址挑战）
- **切换繁简与英文界面**：[`?lang=zh-tw`](https://deanchen.me/jiangshan-map/?lang=zh-tw)（繁体中文） / [`?lang=en`](https://deanchen.me/jiangshan-map/?lang=en)（英文版）

### 嵌入到你的网页

把地图的任意画面放进博客文章、Notion 页面或课程网站：

1. 打开江山时序，调到你想展示的画面（某一年、某个政权档案、某个地点卡片或某个人物的轨迹）。地址栏会实时反映当前画面。
2. 复制网址，在后面加上 `&embed=1`。
3. 放进 `<iframe>`：

```html
<iframe
  src="https://deanchen.me/jiangshan-map/?embed=1&year=1104&trace=101.778,36.617&from=1072&to=1126"
  width="100%" height="480" loading="lazy" style="border:0"
  title="江山时序 · 公元1104年 北宋"></iframe>
```

嵌入后的地图会隐藏网站的导航和侧栏，只保留地图、精简时间轴、左上角的标题牌、右上角的「在江山时序中打开 ↗」链接，以及「历史疆域为示意性近似」的说明。读者需要先点一下地图才能拖动和缩放，滚动文章时不会被地图卡住。

| 参数 | 作用 |
|---|---|
| `embed=1` | 开启嵌入模式（必填） |
| `year`、`polity`、`person`、`stop`、`trace`、`lang` | 和上面的分享链接相同 |
| `from=1072&to=1126` | 把时间轴限定在这个范围，时间轴会放大到只显示这一段 |
| `lock=1` | 把地图固定在 `year` 指定的年份，并隐藏时间轴 |
| `autoplay=1` | 自动逐站播放人物轨迹（配合 `person`），或自动播放时间轴 |

微信公众号、知乎、小红书不支持网页嵌入，在这些平台请直接分享链接。

---

## AI Agent、MCP & LLM 接入指南

「江山时序」原生支持作为大语言模型（LLM）、MCP 客户端与 AI Agent 的**历史地理可视化工具**。模型**无需猜测经纬度坐标**，只需从诗词或史料中提取 **`year`（年份）** 与 **`place`（古今地名）** 两个语义参数，地图即可自动完成地名解析、镜头聚焦、疆域政区渲染、轨迹连线与「点地溯源」卡片展开：

- **机器可读说明文档**：[`llms.txt`](llms.txt)
- **零依赖本地 MCP Server (`stdio`)**：[`scripts/mcp_server.js`](scripts/mcp_server.js) —— 可直接接入 Claude Desktop、Cursor、Windsurf 或 Gemini CLI 的 `mcpServers` 配置（0 第三方依赖，单次查询 `<5ms`）：
  ```json
  {
    "mcpServers": {
      "jiangshan-atlas": {
        "command": "node",
        "args": ["/absolute/path/to/shanhe-atlas/scripts/mcp_server.js"]
      }
    }
  }
  ```
  原生提供 3 个 MCP 工具：
  - `inspect_place({ year, place, lang? })`：查询任意年份与古今地名/多站路线的在位君主年号、所属政权、州郡政区、现代省市、两千四百年沿革判词与可点击深链 URL。
  - `inspect_person({ person, stop?, lang? })`：查询历史人物或历代帝王的生平纪事时空落点与深链 URL。
  - `search_atlas({ query, limit?, lang? })`：跨全朝代检索古城、地标、名关、历史人物、帝王年号与编年大事。
- **开箱即用 Agent Skill**：[`skills/jiangshan-atlas/SKILL.md`](skills/jiangshan-atlas/SKILL.md)（含零依赖 CLI 渲染脚本 [`skills/jiangshan-atlas/scripts/jiangshan.py`](skills/jiangshan-atlas/scripts/jiangshan.py)）
  ```bash
  # 一键安装至 Claude Code / Gemini / Jetski 全局技能目录：
  mkdir -p ~/.claude/skills ~/.gemini/config/skills && cp -r skills/jiangshan-atlas ~/.claude/skills/ && cp -r skills/jiangshan-atlas ~/.gemini/config/skills/
  ```

### 1. 零坐标双参数 URL 协议（0D 单点 / 1D 同年路线 / 4D 跨年路线）

| 模式 | URL 格式示例 | 自动渲染效果 |
| :--- | :--- | :--- |
| **单点寻址 (0D)** | [`?year=819&place=蓝关`](https://deanchen.me/jiangshan-map/?year=819&place=蓝关)<br>*(韩愈「雪拥蓝关马不前」)* | 自动跳转至唐宪宗元和十四年（819 年），精准落针秦岭蓝田关，展开两千四百年政区沿革卡片 |
| **同年多站路线 (1D)** | [`?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳`](https://deanchen.me/jiangshan-map/?year=763&place=剑外,巴峡,巫峡,襄阳,洛阳)<br>*(杜甫「即从巴峡穿巫峡，便下襄阳向洛阳」)* | 自动在 763 年唐代版图上绘制 `1` → `5` 朱砂弧线轨迹并自适应缩放视野，点击任意站点即可查看历代沿革 |
| **跨年多站路线 (4D)** | [`?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州`](https://deanchen.me/jiangshan-map/?year=1079,1080,1094,1097&place=湖州,黄州,惠州,儋州)<br>*(苏轼「问汝平生功业，黄州惠州儋州」)* | `year[i]` 与 `place[i]` 一一对应，地图路标自动标注 **`湖州 (1079)` → `黄州 (1080)` → `惠州 (1094)` → `儋州 (1097)`**，点击任意站点即可同步切换至该年份版图 |

### 2. CLI 一键出图（供 Agent 工具调用）

```bash
# 单点诗境落针截图
python3 skills/jiangshan-atlas/scripts/jiangshan.py --year 819 --place 蓝关 --out /tmp/languan_819.png

# 同年多站轨迹截图
python3 skills/jiangshan-atlas/scripts/jiangshan.py --year 763 --place 剑外,巴峡,巫峡,襄阳,洛阳 --out /tmp/dufu_763.png

# 跨年多站轨迹截图
python3 skills/jiangshan-atlas/scripts/jiangshan.py --year 1079,1080,1094,1097 --place 湖州,黄州,惠州,儋州 --out /tmp/sushi_exile.png
```

### 3. 浏览器端 JavaScript API（`window.atlasAPI`）与浏览器内建 WebMCP（`navigator.modelContext`）

在浏览器自动化环境（Playwright）或支持 WebMCP 协议的 AI 浏览器（`navigator.modelContext`）中，页面会自动注册 `jiangshan_locate`、`jiangshan_inspect`、`jiangshan_open_person` 三个工具，并挂载 `window.atlasAPI`：
- `window.atlasAPI.locate({ year, place, zoom? })`：驱动地图跳转并渲染单点落针或跨年轨迹，同时返回结构化历史地理信息。
- `window.atlasAPI.inspect({ year, place, person?, stop? })`：只读查询指定时空点、多站路线或人物纪事的所属政权、州郡政区、现代省市、各站里程与标准分享链接。
- `window.atlasAPI.resolvePlace(place, year?)`：解析历代城池、天下名关、诗词名胜与古战场古今地名。
- `window.atlasAPI.openPerson(person, stop?)` & `window.atlasAPI.search(query)`：在地图上展开人物生平纪事或执行全局检索。

---

## 本地运行

项目为纯静态网页，无需安装任何依赖或构建工具，克隆后用任意静态服务器打开即可：

```bash
git clone https://github.com/gugupromax/shanhe-atlas.git
cd shanhe-atlas
python3 -m http.server 8000
```

随后在浏览器打开 `http://localhost:8000`。

## 使用 Docker 运行

无需本地依赖，用 Docker Compose 一条命令构建并启动：

```bash
docker compose up -d --build
```

随后在浏览器打开 `http://localhost:8008`（端口映射为 `docker-compose.yml` 中的 `8008:80`）。

镜像基于 `nginx:alpine` 做静态托管：`Dockerfile` 把整个仓库复制到 `/usr/share/nginx/html`；`.dockerignore` 排除 `.git`、`.github`、`data/`、`docs/`、`scripts/`、`skills/`、`workers/`、Markdown 文件、`geojson/demo.html` 与 README 用的演示图片（`assets/hero_demo_*.webp`、`assets/preview_*.webp`），以减小构建上下文，页面运行不依赖这些内容。

要换端口：修改 `docker-compose.yml` 的 `ports`（如 `"9000:80"`），再执行 `docker compose up -d`。

拉取上游更新后重新构建：`docker compose up -d --build`。不用 Compose 时：`docker build -t shanhe-atlas:latest .`，再 `docker run -d -p 8008:80 --name shanhe-atlas shanhe-atlas:latest`。

说明：镜像在本地构建，未发布到任何镜像仓库。

---

## GeoJSON 导出（供 Leaflet / MapLibre / QGIS 使用）

程序内置的几何数据是拓扑去重的 VLQ 紧凑编码。如需在其他项目中使用矢量图层，可在本地生成标准 RFC 7946 GeoJSON（EPSG:4326，经度/纬度），输出到 `geojson/`，不纳入版本库。导出范围为公元前 403 年至 1948 年，不含此后年份及现代省界图层。郡 / 州 / 府图层源自 CHGIS，其条款禁止再分发，因此默认不导出；如需在本地做学术、非商业用途，可加 `--with-prefectures` 参数导出，导出结果请勿公开发布：

```bash
node scripts/export_geojson.js            # 或：node scripts/export_geojson.js <输出目录>
node scripts/export_geojson.js --with-prefectures   # 附带源自 CHGIS 的郡州府图层（仅限本地学术用途）
```

- `snapshots/<id>.geojson`：每个疆域阶段一个文件；每个要素带 `bbox`，属性含 `layer`（`polity` 政权 / `region` 一级政区；加 `--with-prefectures` 时另含 `prefecture` 州郡）、`title`、`title_en`、`category`、`tint`、`anchor`。
- `index.json`：各朝代阶段的起止年份 `from` / `to`（负数为公元前，无公元 0 年）及对应快照文件。
- `corridors.geojson`（长城、运河、道路、海路）、`settlements.geojson`、`milestones.geojson`、`neighbors.geojson`，以及 `modern/`（河流、湖泊、水系注记；`appear` / `vanish` 表示古河道与古湖泊显示的起止年份）。

按坐标查询时无需加载全部阶段：[`geojson/jiangshan-locate.js`](geojson/jiangshan-locate.js) 只加载 `index.json` 和覆盖该年份的那一个快照，再用包围盒预筛加点在多边形内判断。

```js
const atlas = JiangshanLocate.create(); // 或 create({ base: '<geojson/ 目录的 URL>' })
const hit = await atlas.locate(118.78, 32.06, 1415); // 经度, 纬度, 年份
hit.polity.properties.title;     // 明
hit.region.properties.title;     // 南直隶
hit.prefecture;                  // 默认为 null；加 --with-prefectures 导出时为 应天府
```

导出后启动本地服务（`python3 -m http.server 8000`），打开 `http://localhost:8000/geojson/demo.html` 即可查看 Leaflet 示例：拖动年份滑块、点击地图，或打开 `demo.html?year=1415&lon=118.78&lat=32.06` 自动加载、高亮并缩放到该处。历史疆域为示意性近似，并非测绘边界。数据采用 GPL-3.0 协议，郡 / 州 / 府级边界除外，详见[数据来源与授权](#数据来源与授权)。

---

## 数据来源与授权

代码和本项目自行整理的数据均采用 **GPL-3.0**。只有一层例外：源自 CHGIS 的郡 / 州 / 府级边界，仍受 CHGIS 原始条款约束。

| 图层 | 来源 | 授权 |
| :-- | :-- | :-- |
| 代码（页面、脚本、CLI、MCP 服务） | 本项目 | GPL-3.0 |
| 政权疆域轮廓（`polity`） | 以 [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps)（GPL-3.0）为起点，此后依据史籍手工重绘 | GPL-3.0 |
| 一级政区（`region`：刺史部 / 道 / 路 / 省等） | 依据史籍手工绘制；早期版本的原始来源未记录 | GPL-3.0 |
| **郡 / 州 / 府级边界**（`prefecture`，含战国与秦的郡） | 源自 **CHGIS V6** 与 **Robert M. Hartwell China Historical GIS**，简化至 0.01° 并经手工调整 | **不适用 GPL-3.0**。仅限学术、非商业用途，不得再分发，详见下文 |
| 古地名、重大事件、行迹路线、人物年谱、地名沿革 | 本项目依据史籍整理 | GPL-3.0 |
| 现代省界 | DataV GeoAtlas（阿里云） | 以 DataV GeoAtlas 条款为准 |
| 河流、湖泊、周边国家 | 公有领域数据 | 公有领域 |
| 地形晕渲 | 由 `scripts/build_terrain_tiles.py` 基于 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（公有领域的 **SRTM**、**GMTED2010**、**ETOPO1**）渲染；仓库只发布最细约 1 km/像素的晕渲图片 | GPL-3.0（图片） |
| 古琴录音 | Wikimedia Commons（《流水》《平沙落雁》《阳关三叠》《醉渔唱晚》《酒狂》） | 公有领域 |

**历史地图参考**：从「项目与来源」打开[历代地图参考](historical-map-references.html)，也可在古代各时期的史志中打开对应图组。索引来自[国学导航目录](http://www.guoxue123.com/other/map/zgmap/)，覆盖八册的 17 个网页图组，含原站附图和表。图名可搜索，部分全图年代可跳至本项目时间轴。明前期全图采用[北京大学图幅记录](https://geodata.pku.edu.cn/index.php?a=show&c=content&id=414)的宣德八年（1433 年）。原始图件由来源站点提供，本地索引保存图名、链接及对照年份。现有交互疆域的数据来源见上文。

2026-11-18 从原站 HTTP 目录提取。维护时可运行 `python -X utf8 scripts/import_historical_map_refs.py`，复核输出后更新 `data/historical-map-references.json`。

**历代政区细节**。平面与 3D 共用三档显示，远景查看一级政区，中景看郡、州、府或同时代同级政区，近景可显示有来源的县级治所。在「图层 → 政区层级」选择「郡州府＋县治」可开启县治，默认显示郡州府。搜索和点选使用同一条政区记录。快照中的示意区划名称锚点和可考治所分别标注，缺少的隶属信息保留为未知。

本地数据包以 [CHGIS V6 府级治所](https://doi.org/10.7910/DVN/WW1PD6) 和[县级治所](https://doi.org/10.7910/DVN/Q9VOF5)的起止年补充各历史时期，并接入[郑伊辰、武廷海发布的数据](https://doi.org/10.6084/m9.figshare.30518417.v2)中已核对的公元 2、742、1102 和 1820 年治所。前三组依据《中国历史地图集》数字化，1820 年为研究者校核的 CHGIS 年层。清末另有带原表隶属的[1911 年治所年层](https://doi.org/10.7910/DVN/HHVVHX)，民国时段另有[1931 年县治年层](https://doi.org/10.5281/zenodo.5721459)。[图集同名索引](https://doi.org/10.7910/DVN/3KAHBT)与国学导航的分期目录从资料卡打开。索引同名条目用于查图，点位年代则由各自的点数据确定。

本地数据放在 `data/tiles/period-admin-sources/`，运行 `python scripts/build_period_admin.py` 生成应用按需加载的 `data/tiles/period-admin.js`。未安装本地数据包时，地图仍可使用内置政区快照。时间序列点位空间覆盖各期有差异，图集与其他单年层按其原年份显示。县治是点位资料，已有州府边界为示意。CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.

**唐朝 741 年试版**：进入 [开元二十九年](?year=741)，拉近地图可从道级范围看到州府，再看到已核对的县治。平面与 3D 可单击区域、地名或两畿的紫色道界段，打开详情。州府面沿用项目的跨期示意层，补充的县治显示为约略点位。同城州府和附郭县共用一个治所标记。

名称与隶属依据[唐时期全图（二）](http://www.guoxue123.com/other/map/pic/10/03.jpg)、同期分幅及[《旧唐书》地理志](https://zh.wikisource.org/zh-hans/旧唐书/卷38)核对。县治坐标采用郑伊辰、武廷海公开研究数据的 742 年图幅配准点，经转为经纬度、取至 0.01°，逐项核对 741 年的称谓和隶属，仅用于近似定位。[县治点数据和 CC BY 4.0 许可](https://doi.org/10.6084/m9.figshare.30518417.v2)

两畿紫色虚线根据 741 年[京畿、关内分幅](http://www.guoxue123.com/other/map/pic/10/05.jpg)与[都畿、河南分幅](http://www.guoxue123.com/other/map/pic/10/27.jpg)的经纬网粗读至约 0.1°。京畿核心为京兆府和岐、邠、华、同四州，都畿核心为河南府和陕、郑、汝三州。京畿北西的图幅接缝和都畿怀州附近的异文仍待核，先显示可辨道界段。参见[《通典》卷一百七十二](https://zh.wikisource.org/zh-hans/通典/卷172)和[杨远《唐代的人口》第 412–413 页](https://www.cuhk.edu.hk/ics/journal/articles/v19p389.pdf)。

更新南北两组 741 年核对数据后，运行 `node scripts/build_tang_741.cjs` 汇编到离线图层，再运行 `node scripts/sync_version.js --write-only` 生成资源版本。

741 年 3D 的地名使用独立文字层，随地理位置移动，在斜俯和旋转时保持正向，按缩放显示道、州府和县治。生成本地瓦片后，默认简体图层按视野读取三档预生成地形贴图。支持 4096 像素贴图的大视窗会读取无损高清远景，中近景在设备支持时保留瓦片原始分辨率。少量瓦片可按原分辨率直接贴合地形，可见地形区块按需上传。3D 的关隘图层使用贴地的小城关，从地图缩放 2 倍起显示。关隘的出现、消失和历代称呼以当前年份的地图数据为准。模型随地图缩放，宽度和墙高按周围地形高差作示意估算。地形起伏倍数会带动城关地基随坡面升降，城关本身的尺寸保持固定。县治用固定屏幕大小的圆点显示。点击关隘可查看沿革。点选高亮由三维视图独立绘制，资料卡沿用现有原图、隶属和史料。其他年份、语言或自定义图层使用实时贴图，人物行迹和点地溯源也使用原流程。瓦片包含另有使用条款的图层，按需在本机生成。新检出的仓库使用实时底图。需要生成或更新 741 年本地瓦片时，启动本地地图服务，再运行 `node scripts/build_tang_741_tiles.cjs` 更新 `assets/tang-741-tiles/`。加 `--base-hd` 可在底图源数据未变时单独重建高清远景。瓦片清单记录构建输入、图片尺寸和校验值。提交前可运行 `node scripts/build_tang_741_tiles.cjs --check` 在本地校验，无需启动浏览器。

**郡 / 州 / 府级边界（CHGIS）**：该图层不适用 GPL-3.0，仅用于本站非商业的科普展示。请勿从本仓库转载或再分发；如需郡州府边界，请从 CHGIS 官方渠道（Harvard Dataverse）按其条款获取。`scripts/export_geojson.js` 默认不导出该图层，加 `--with-prefectures` 参数才会导出。引用格式：*CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.* 数据来源细节见 [data/atlas/README.md](data/atlas/README.md)。

**近似边界**：地图中的历史疆域与政区边界为示意性近似，用于直观呈现各时期大致的管辖范围，并非测绘成果，请勿作为精确或权威的边界依据引用。

**转载与复用**：复用 GPL-3.0 图层时，请注明「江山时序 Jiangshan Atlas」并附 https://github.com/DeanChensj/jiangshan-map ，同时注明上文所列原始来源。含郡州府图层的截图同样受 CHGIS 条款约束。

**权利人联系**：如果您是本仓库中某项内容的权利人，认为使用不当，请[提交 issue](https://github.com/DeanChensj/jiangshan-map/issues)，我们会及时回复，必要时删除。

**参与贡献**：参见 [中文贡献指南 (`CONTRIBUTING_ZH.md`)](CONTRIBUTING_ZH.md)（[English Contributing Guide](CONTRIBUTING.md)）了解项目结构、史料校勘规范与自动化校验流程。

**数据纠错**：发现年份、地点或描述有误，请[提交纠错 issue](https://github.com/DeanChensj/jiangshan-map/issues/new?template=data-error.yml)，最好附上出处。

Copyright © 2026 DeanChensj。除上文注明的例外，采用 GPL-3.0（见 [LICENSE](LICENSE)）。
