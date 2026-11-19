# data/atlas · Historical polygon sources

> **Approximate boundaries, not surveyed borders.** These polygons are schematic reconstructions for illustrating broad historical jurisdictions. They are not the product of scientific surveying and should not be cited as precise or authoritative borders.
>
> **近似边界，非测绘成果。** 本目录中的多边形为示意性复原，用于直观呈现历史上大致的管辖范围，并非科学测绘成果，请勿作为精确或权威的边界依据引用。

This directory is the editable source of `js/atlas_snapshots.js` and `js/atlas_boot.js`. Each `<dynasty>/<snapshot>.geojson` file is one map snapshot. `scripts/build_atlas.js` turns them into the bundles; see [CONTRIBUTING.md](../../CONTRIBUTING.md) for the editing workflow.

本目录是 `js/atlas_snapshots.js` 与 `js/atlas_boot.js` 的可编辑源数据，每个 `<朝代>/<快照>.geojson` 对应一个地图快照。编辑流程见 [CONTRIBUTING_ZH.md](../../CONTRIBUTING_ZH.md)。

## Provenance · 数据来源

The original import scripts are not in this repository, so provenance is reconstructed from the project's early documentation:

- **Prefecture-level boundaries** (`prefectures`: commanderies, prefectures and superior prefectures, i.e. 郡 / 州 / 府) are derived from **CHGIS V6** (Fairbank Center for Chinese Studies, Harvard University & Center for Historical Geographical Studies, Fudan University) and the **Robert M. Hartwell China Historical GIS** datasets.
- **Polity outlines** (`polities`) are derived from [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0).
- **First-level divisions** (`regions`: 刺史部 / 道 / 路 / 省, etc.) are drawn by hand from historical texts; the source of their early versions was not recorded. Most do not share boundaries with the prefecture layer.
- All geometry has since been simplified (0.01° precision) and hand-adjusted against historical texts, with Tan Qixiang's *The Historical Atlas of China* (谭其骧主编《中国历史地图集》) as the main reference for checking; no map images or data from that atlas are included in this repository. Boundaries are schematic approximations, not surveyed borders. The source of each individual feature is not recorded.

原始导入脚本不在仓库中，以上来源依据项目早期文档整理：郡 / 州 / 府级边界（`prefectures`）源自 CHGIS V6 与 Hartwell 数据；政权轮廓（`polities`）源自 historical-basemaps（GPL-3.0）；一级政区（`regions`）依据史籍手工绘制，早期版本来源未记录。所有几何此后均经过简化，并依据史籍、参照谭图核对后手工调整；本仓库不包含谭图的任何图像或数据。

## 校核记录

民国十二期的省级政区按各期快照显示。此前这些快照共用一套标注为清末 1911 年的府州界；原始 344 个要素引用存于 `roc/s_roc.geojson` 的 `referenceLayers` 中，保留年份和几何以供核对。1912 年各地改制进度不一，1913 年 1 月 8 日的组织令规定府、厅、州改县的处理方式。民国各期的府县辖界待逐期考证；1931 年的县治点由独立的有年款点层提供。[1913 年《画一现行各县地方行政官厅组织令》](https://zh.wikisource.org/wiki/畫一現行各縣地方行政官廳組織令) · [济南市情资料库《1913 年》](https://shandong-chorography.org/database/b1/section/1/article/65/)

西汉共享示意层原收录「砀郡」旧面，继承到西汉晚期会跨出梁国所在范围。已停止在西汉层引用这块面。西汉晚期梁国、梁郡使用据[复旦时空地名库睢阳条](https://tgaz.fudan.edu.cn/tgaz/placename/hvd_82072)和[《汉书》诸侯王表](https://zh.wikisource.org/zh-hans/漢書/卷014)切换的治所点。

东汉的两份郡级图层也已移除同一旧面，依赖它们的快照随之更新。详细点位包中的 `chgis:0:210768` 跨越多个更名时段，汉代展示使用以下校核结果。秦代快照仍有其本期的砀郡。

- 23–25 年显示刘永梁国，都睢阳（今河南商丘一带）。26–28 年睢阳数度易手，刘永、刘纡转战多地，这三年暂缺稳定治所点。[《后汉书》卷十二·刘永传](https://zh.wikisource.org/wiki/後漢書/卷12)
- 29–78 年作梁郡，79–219 年作梁国。《后汉书·郡国志》将下邑列于梁国诸县之首。自睢阳迁治的确年未详，按复旦时空地名库的考释，自 29 年起在今安徽砀山一带约标下邑。两阶段均无可据以绘制的辖界。[复旦时空地名库·睢阳县](https://tgaz.fudan.edu.cn/tgaz/placename/hvd_82072) · [《后汉书》郡国志二](https://zh.wikisource.org/zh-hans/後漢書/卷110#梁国) · [《江南通志》下邑故城](https://zh.wikisource.org/wiki/江南通志_(四庫全書本)/卷033)

政区资料卡的隶属栏采用记录自带的上级。点击示意边界时，资料卡另列点选位置落入的图层；郡界与手绘州界相交处可能随点选位置显示不同的图层名称。

## License · 许可

- Boundaries derived from **CHGIS V6** and the **Hartwell China Historical GIS** remain under their original terms: **academic, non-commercial use only; do not redistribute**. They are **not** licensed under GPL-3.0. Do not republish them from this repository; if you need prefecture boundaries, obtain them from the official CHGIS / Harvard Dataverse distribution. `scripts/export_geojson.js` leaves this layer out unless run with `--with-prefectures`.
- Cite CHGIS as: *CHGIS, Version: 6. © Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.*
- Everything else in this directory follows the repository license (GPL-3.0).
- **Attribution**: when reusing these boundaries, maps or screenshots, credit **江山时序 Jiangshan Atlas** (https://github.com/DeanChensj/jiangshan-map) and the upstream sources above.

源自 CHGIS V6 与 Hartwell China Historical GIS 的边界数据仍受其原始条款约束（仅限学术、非商业用途，不得再分发），不适用 GPL-3.0；请勿从本仓库转载，如需郡州府边界，请从 CHGIS / Harvard Dataverse 官方渠道获取。`scripts/export_geojson.js` 默认不导出该图层，加 `--with-prefectures` 参数才会导出。其余内容遵循仓库的 GPL-3.0 许可。转载或引用这些边界、地图或截图时，请注明「江山时序 Jiangshan Atlas」（https://github.com/DeanChensj/jiangshan-map）及上述原始数据来源。
