/* Default roles follow the narrative; specific simulation stats, equipment and layouts are illustrative. */
window.atlasBattleScenario = {
  id:'xiangjisi',
  opponent:'yan',
  sideLabels:{tang:'唐军',uyghur:'回纥援军',yan:'燕军'},
  bounds:{minX:-34,maxX:49,minZ:-45,maxZ:42},
  victory:'燕军退场 · 唐军守住阵线',
  defeat:'唐军退场 · 阵线失守',
  units:[
    {type:'shield',side:'tang',name:'唐军盾阵',x:-19,z:12,count:68,formation:'block'},
    {type:'blade',side:'tang',name:'李嗣业所部',x:-8,z:21,count:60,formation:'block'},
    {type:'cavalry',side:'uyghur',name:'回纥骑兵',x:14,z:20,count:48,formation:'mounted'},
    {type:'archer',side:'tang',name:'唐军弓队',x:-24,z:23,count:52,formation:'loose',experimental:true},
    {type:'heavy',side:'tang',name:'唐军重骑',x:23,z:28,count:44,formation:'mounted',experimental:true},
    {type:'infantry',side:'yan',name:'燕军前锋',x:-17,z:-9,count:64,formation:'block',aiAfter:0},
    {type:'infantry',side:'yan',name:'燕军正面',x:-4,z:-15,count:64,formation:'block',aiAfter:0},
    {type:'elite',side:'yan',name:'燕军东侧精骑',x:32,z:-2,count:48,formation:'mounted',aiAfter:10}
  ],
  allowed:{tang:['shield','blade'],uyghur:['cavalry'],yan:['infantry','elite']},
  experimental:{allowed:{tang:['archer','heavy']},barriers:[{x:21,z:12},{x:4,z:10},{x:-18,z:5}]},
  unsupported:'燕军不配置轻重骑兵或弓队。唐军弓兵、披甲重骑、拒马仅在试验阵容开放，参战装备与数量未详。',
  evidence:[
    ['史载','李嗣业为前军、郭子仪为中军、王思礼为后军。李嗣业率前军持长刀推进；燕军东侧有精骑，仆固怀恩率回纥兵截击。'],
    ['推测','燕军精骑的轻重、装备和具体人数未详；燕军正面用通用步阵代示。'],
    ['玩法','唐军盾阵、回纥骑射参数、方阵形状及各队人数为试玩设定。「兵种试验」另加未证实部署的弓兵、重骑和拒马。']
  ],
  sources:[['《资治通鉴》卷二二〇','https://zh.wikisource.org/zh-hans/資治通鑑_(胡三省音注)/卷220'],['《旧唐书·肃宗纪》','https://zh.wikisource.org/wiki/舊唐書/卷010']]
};
