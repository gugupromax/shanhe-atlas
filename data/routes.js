/* Geographic corridor diagrams, not surveyed historical road geometry. */
window.TAIHANG_ROUTES = {
  schemaVersion:1,
  researchedOn:'2026-11-17',
  geometryKind:'schematic-waypoint-links',
  coordinateMethod:'节点按现代地名人工概略定位；节点间为直线示意，未经古道测绘验证。',
  sources:{
    museum:{title:'清华大学艺术博物馆《艺术与考古》2022年第1期：太行八陉图及表一',url:'https://www.artmuseum.tsinghua.edu.cn/xsyj/gk/202203/W020221013788916283164.pdf',supports:'宏观联系方向与两侧地区；不提供本版折线的实测坐标。'},
    survey:{title:'河北省文物局：寻踪太行古陉的历史脉动',url:'https://wenwu.hebei.gov.cn/system/2025/05/26/030344164.shtml',supports:'古陉存在多条干道、辅道、岔道；井陉古驿道有南北两道。'},
    jingxing:{title:'古迹寻踪：中国农业大学离退休工作处',url:'https://ljs.cau.edu.cn/art/2018/10/14/art_17617_591504.html',supports:'井陉古驿道东接土门关，西连固关；天长历史沿革。'},
    taihang:{title:'晋城市人民政府：晋城，太行陉探寻茶道遗迹',url:'https://www.jcgov.gov.cn/mljc/lswh/whys/whhd/202010/t20201023_1249383.shtml',supports:'沁阳方向古道、羊肠坂、碗子城与天井关；道路存在不同时期的多条线位。'},
    baixing:{title:'晋城市产业发展促进会：马圪当乡实地调研',url:'https://www.jccch.cn/xinwendongtai/122.html',supports:'横水、白陉古道、十里河峡谷、双底一带的实地调查；不提供轨迹。'},
    fukou:{title:'《太行古道——滏口陉》之前言，澎湃号公开文章',url:'https://m.thepaper.cn/baijiahao_30559138',supports:'临水—磁山—阳邑—涉县—东阳关—黎城—潞城—长治的走向；指出年代差异与常见误绘。'},
    feihu:{title:'中国人民大学清史研究所：实地考察飞狐道',url:'https://iqh.ruc.edu.cn/old/zglsdlyj/lsdl_sdkc/6958a6cc49d041a2ac5549cf57e74161.htm',supports:'涞源—黑石岭—四十里峪—北口—蔚县的实地叙述。'},
    puyin:{title:'中国农业大学：太行之歌（三）',url:'https://ljs.cau.edu.cn/art/2020/1/6/art_17617_658308.html',supports:'介绍易县—紫荆关—涞源的常见说法，同时明确蒲阴陉的对应存在争议。'},
    jundu:{title:'北京日报：南口、居庸关、八达岭一线',url:'https://xinwen.bjd.com.cn/content/s689dbb4be4b02424b0bec7f5.html',supports:'关沟由南向北的南口、居庸关、上关、八达岭、岔道城节点。'}
  },
  routes:[
    {key:'zhiguan',name:'轵关陉',status:'schematic',sourceIds:['museum'],period:'宏观通道联系，未限定朝代',note:'展示济源与晋南侯马方向的宏观联系；中间代表点仅帮助辨认区域，不表示已复原王屋山、中条山间的具体路基。',nodes:[['济源',112.60,35.07],['轵关陉代表区',112.38,35.16],['侯马方向',111.37,35.62]]},
    {key:'taihang',name:'太行陉',status:'schematic',sourceIds:['taihang','museum'],period:'历代通道示意，线位未按朝代细分',note:'沁阳通向晋城，碗子城与天井关是重要观察节点。不同年代的古道、近现代道路不能合并为一条精确轨迹。',nodes:[['沁阳',112.94,35.09],['羊肠坂一带',112.89,35.25],['碗子城一带',112.87,35.32],['天井关一带',112.85,35.39],['晋城',112.85,35.49]]},
    {key:'baixing',name:'白陉',status:'schematic',sourceIds:['museum','baixing'],period:'区域联系示意，含现存古道所在地区',note:'展示辉县向陵川方向的通道联系，横水、双底为现存古道附近的观察节点；村落间连线不是古道实测线。',nodes:[['辉县',113.81,35.46],['横水一带',113.53,35.60],['双底一带',113.49,35.67],['陵川',113.28,35.78]]},
    {key:'fukou',name:'滏口陉',status:'schematic',sourceIds:['fukou','survey'],period:'区域走向示意；支路随时期变化',note:'按临水、磁山、阳邑、涉县至东阳关、黎城、潞城、长治的节点展示联系。报道所述各时期支线尚未分别复原。',nodes:[['临水／峰峰',114.21,36.42],['磁山',114.12,36.57],['阳邑',113.91,36.70],['涉县',113.67,36.57],['东阳关一带',113.49,36.54],['黎城',113.39,36.50],['潞城',113.23,36.33],['长治',113.11,36.19]]},
    {key:'jingxing',name:'井陉',status:'schematic',sourceIds:['museum','jingxing','survey'],period:'选取土门关—固关方向；不表示各时期唯一通道',note:'展示正定方向经土门关、井陉、天长、固关到平定及太原方向的联系。井陉实际存在南北等多条道路，本版只选取其中一个方向作示意。',nodes:[['正定方向',114.57,38.15],['土门关一带',114.30,38.05],['井陉县城',114.14,38.03],['天长',114.02,37.97],['固关一带',113.87,37.95],['平定',113.63,37.80],['太原方向',112.55,37.87]]},
    {key:'feihu',name:'飞狐陉',status:'schematic',sourceIds:['feihu'],period:'实地考察叙述的涞源—蔚县方向',note:'由涞源向北，经过黑石岭和四十里峪一带至蔚县。节点按地区概略定位，尚未按谷地实测描线。',nodes:[['涞源',114.69,39.36],['黑石岭一带',114.73,39.57],['北口一带',114.65,39.70],['蔚县',114.59,39.84]]},
    {key:'puyin',name:'蒲阴陉',status:'disputed',sourceIds:['puyin'],period:'采用常见对应说法，存在学术争议',note:'此处采用“易县—紫荆关—涞源”的常见说法；另有对应蒲阴城、五阮关等通道的解释。橙色虚线表示该对应并非定论。',nodes:[['易县',115.50,39.35],['紫荆关一带',115.17,39.43],['涞源',114.69,39.36]]},
    {key:'jundu',name:'军都陉',status:'schematic',sourceIds:['jundu'],period:'关沟方向，展示明代关城序列',note:'按南口—居庸关—上关—八达岭—岔道城的先后关系展示。节点间连线不表示长城线、古道实测轨迹或特定战役进军线。',nodes:[['南口',116.14,40.24],['居庸关',116.07,40.29],['上关一带',116.04,40.32],['八达岭',116.02,40.36],['岔道城一带',115.99,40.38]]}
  ]
};
