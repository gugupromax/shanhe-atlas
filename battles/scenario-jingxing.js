/* Each roster count, starting coordinate and formation shape is a playtest choice. */
window.atlasBattleScenario = {
  id:'jingxing',
  opponent:'zhao',
  sideLabels:{han:'汉军',zhao:'赵军'},
  bounds:{minX:-19,maxX:47,minZ:-26,maxZ:33},
  victory:'赵军退场 · 汉军守住阵线',
  defeat:'汉军退场 · 阵线失守',
  units:[
    {type:'infantry',side:'han',name:'汉军背水先行军',x:-13,z:3,count:112,formation:'line'},
    {type:'infantry',side:'han',name:'韩信、张耳所部',x:-8,z:17,count:78,formation:'block'},
    {type:'light',side:'han',name:'汉军伏候轻骑',x:2,z:-17,count:34,formation:'column'},
    {type:'infantry',side:'zhao',name:'赵军出壁部',x:26,z:1,count:94,formation:'block',aiAfter:0},
    {type:'infantry',side:'zhao',name:'赵军追击部',x:36,z:3,count:90,formation:'block',aiAfter:3},
    {type:'infantry',side:'zhao',name:'赵军后队',x:29,z:-7,count:96,formation:'block',aiAfter:8}
  ],
  allowed:{han:['infantry','light'],zhao:['infantry']},
  unsupported:'弓弩队、披甲重骑、战车、拒马无此战部署依据，井陉当前阵容不提供。赵军兵种比例未详，统一用步阵代示。',
  evidence:[
    ['史载','汉军遣万人背水列阵，另选轻骑二千；赵军号称二十万。赵军追出后，汉轻骑入赵壁易帜，赵军见旗误以为赵王和诸将被擒。'],
    ['推测','水边步阵与赵军步阵用来表达叙事中的阵列，史书未给出兵种比例、装备或方阵尺寸。'],
    ['玩法','表中的人数、阵宽、营门与占领判定均为试玩设定。把轻骑送到空出的赵壁可换旗；赵军接近后才触发士气冲击。背水加成只在标示水岸带有效。']
  ],
  sources:[['《史记·淮阴侯列传》','https://zh.wikisource.org/wiki/史記/卷092'],['《汉书·韩信传》','https://zh.wikisource.org/wiki/漢書/卷034']],
  morale:{backToWaterSide:'han',captureShockSide:'zhao'},
  waterline:{side:'han',maxX:-10,minZ:-7,maxZ:12},
  objective:{name:'赵壁',x:29,z:-6,radius:4.5,guardRadius:9,noticeRadius:30,captureType:'light',
    instructions:'等赵军离营，选中汉军伏候轻骑并右键赵壁换旗',
    captured:'汉军已换旗，赵军尚未发现',revealed:'赵军看到汉旗，误判赵王被擒'}
};
