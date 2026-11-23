/* Literary adaptation, volume II chapters 62–71. Distances, elapsed times and all stats are playtest estimates. */
window.atlasCampaignDemo={
  terrain:true,
  strengthFor(group,log){
    const done=id=>log.some(event=>event.id===id);
    if(group.id==='emperor')return done('march-emperor')?'随援军行进，人数未拆分':done('meeting')?'抵鄢陵不足200骑（途中掉队）':'出发约800骑';
    if(group.id==='decoy')return done('xiping')?'约1万出城，约4000返回':'佯动约1万人';
    if(group.id==='yue')return done('yue-turn')?'先遣约2万人':'属鄢陵宋军';
    if(group.id==='yanling-total')return '宋军合计8万余（含岳飞、王彦）';
    if(group.id==='jin')return done('lure')?'分兵后推算约1.5万':'长社战前集结约2.5万（含鹘拔鲁）';
    if(group.id==='reserve')return done('lure')?'约1万骑（从长社分出）':'属长社金军';
    if(group.id==='balisu')return done('departure')?'侧击约1万骑':'约1万骑（待机包抄）';
    if(group.id==='han')return done('relief')?'长社已解围，人数待核':'被围宋军，人数待核';
    if(group.id==='wuzhu')return '围南阳，兵力待核';
    return '人数待核';
  },
  strengthScale(group,log){
    const done=id=>log.some(event=>event.id===id);
    if(group.id==='emperor')return done('march-emperor')?null:done('meeting')?200:800;
    if(group.id==='decoy')return done('xiping')?4000:10000;
    if(group.id==='yue')return done('yue-turn')?20000:null;
    if(group.id==='yanling-total')return 80000;
    if(group.id==='jin')return done('lure')?15000:25000;
    if(group.id==='reserve')return done('lure')?10000:null;
    if(group.id==='balisu')return 10000;
    return null;
  },
  situation:{
    center:[113.79,33.99],
    distance:120,
    siege:'changshe',
    westRiver:[[113.83,34.21],[113.78,34.16],[113.74,34.07],[113.75,33.99],[113.81,33.92],[113.91,33.89]],
    crossings:[[113.90,34.121],[113.90,34.116],[113.90,34.111],[113.88,34.079],[113.88,34.074],[113.89,34.067]],
    // Directions from the reader-provided adaptation map. Locations and paths are schematic.
    dispersal:[
      {label:'金军北路', points:[[113.81,34.08],[113.86,34.20],[113.86,34.33]]},
      {label:'向颍昌一带', points:[[113.76,34.06],[113.65,34.08],[113.48,34.12]]},
      {label:'向襄城', points:[[113.77,33.99],[113.64,33.91],[113.43,33.85]]},
      {label:'经临颍向郾城', points:[[113.83,33.95],[113.88,33.77],[114.01,33.60]]}
    ]
  },
  mapCues:{
    departure:["赵玖夜出被围的南阳", "杨沂中等约万人向南佯动，拔离速约万骑侧击。刘晏率约800骑护赵玖从东面绕行，途中须避开金军骑兵。"],
    xiping:["赤心队越过中阳山", "赵玖继续向西平。杨沂中等在南面佯动，遭金军打击。"],
    detour:["绕开郾城战场，转赴鄢陵", "南阳佯动部队遭金军打击。赵玖经西平转向杜充据守的鄢陵。"],
    meeting:["鄢陵城外 · 赵玖与岳飞议战", "韩世忠还在长社城里。金军已经分兵，岳飞请趁各路尚未回援时集中出击。"],
    yamen:["张宪护衙，岳飞去召集诸将", "郦琼奉旨。等各部将领到齐，再当面对质杜充。"],
    conference:["斧决杜充", "赵玖当众让岳飞负责调度，随后处置杜充。接下来，诸军按岳飞号令出兵。"],
    'march-yue':['马皋向长葛亮旗','李逵已把消息送入金营。马皋等沿洧水北上，岳飞部同时向临颍方向走。'],
    lure:['蒲察鹘拔鲁离开长社','挞懒派金军援部赶去长葛设伏，城下留兵继续围住韩世忠。'],
    'yue-turn':['岳飞折向长社','金骑已被引往长葛，岳飞折向长社。沿途举起烟号，王彦在前，赵玖率援军从鄢陵出发。'],
    'xu-routed':['岳字旗仍立，八字军正在抢渡','徐庆阵散，岳飞仍守西岸桥头。王彦继续从上游过河，赵玖的援军仍在赶路。冲散徐庆阵的金骑回收队形，长葛方向的金军援兵也正折返。'],
    'xu-break':['徐庆阵溃，岳飞本阵未倒','金骑冲散徐庆部，徐庆阵亡。岳字旗仍在河边，王彦趁金骑未收拢，从上游抢渡。'],
    contact:["岳飞部在清潩水接战", "徐庆阵与岳飞本阵背桥列阵。金骑已从河洲内扑来，王彦还没渡河，韩世忠仍在城头观望。"],
    'wang-arrival':['王彦从上游抢渡','金军冲破了徐庆一阵，但岳飞本阵仍在。王彦趁金军骑兵阵势未收，从上游开出第二处战场。'],
    'march-emperor':['两路援军正在赶来','赵玖已走过鄢陵到渡口的大半路程，正率援军抵近浮桥。蒲察鹘拔鲁正在从长葛折返，还没到河边。'],
    'reserve-approach':['两路援军正在赶来','蒲察鹘拔鲁绕向河东，赵玖也在赶往清潩水浮桥。'],
    'cross-emperor':['龙纛上桥','赵玖从清潩水东岸过桥，朝岳飞本阵去。蒲察鹘拔鲁仍在东北方向赶路。'],
    banner:["赵玖到达岳飞阵中", "赵玖进入岳飞本阵，龙纛显露。韩世忠见旗出城，赵玖命郦琼传令拆桥。"],
    breakout:['韩世忠见岳飞阵中龙纛，下令出城','解元出东门，王善出南门。韩世忠与成闵率背嵬军从城墙豁口直奔龙纛。赵玖已进入岳飞本阵，同时命郦琼传令拆桥。'],
    joint:['韩、岳向龙纛靠拢','韩世忠见到赵玖，请他以龙纛为号，韩旗与岳旗护在两侧。'],
    'standards-advance':['韩、岳并旗，龙纛转向挞懒将台','三面旗一同向西北推进，乱战中的诸军认旗跟进。'],
    relief:["长社解围", "三旗并进后，宋军拔取金营。洪涯带挞懒从浊潩水方向脱身，长社解围，金军渡河部从河边退走。"],
    'reserve-blocked':['蒲察鹘拔鲁赶到河东','金营已失，浮桥已拆，宋军也已沿河布防。他在对岸看不到过河接应的机会。'],
    'reserve-withdraw':['金军援部沿河北撤','蒲察鹘拔鲁从长葛折返，错过城下交战，在河滩接应挞懒后沿河北撤。'],
    'reserve-exit':['解围后，宋军分兵','岳飞留镇五河，韩世忠与王彦北追。赵玖经鄢陵前往东京。'],
  },
  scenes:{
    conference:{
      title:'斧决杜充',
      text:'鄢陵县衙。诸将到齐，赵玖当众追问杜充为何闭城不战。杜岩先前已揭发父亲与挞懒私约不战。诸将到齐，岳飞说出了胜机：金军分兵，河冰渐融，骑兵难以迅速回援。赵玖当众让岳飞下令出战，随后处决杜充。',
      image:'changshe-conference.local.png'
    }
  },
  autoStartSignal:'depart',
  cameraCues:{'march-yue':{kind:'situation'},'lure':{kind:'situation'},'yue-turn':{kind:'situation'},'cross-emperor':{kind:'front',id:'ford'},'reserve-blocked':{kind:'front',id:'ford'},'reserve-withdraw':{kind:'unit',id:'reserve'},joint:{kind:'front',id:'jin-camp'}},
  motionCues:{'march-yue':'ma',lure:'reserve','yue-turn':'yue',contact:'river-jin','xu-break':'wang','march-emperor':'emperor','reserve-approach':'emperor','cross-emperor':'emperor',relief:'reserve','reserve-withdraw':'reserve',joint:'emperor','standards-advance':'emperor'},
  finishAt:'reserve-exit',
  pauseAt:['meeting','yamen','conference','wang-arrival'],
  fronts:[
    {id:'nanyang',geo:[112.53, 32.99],name:'南阳',x:13,y:57,status:'金军压境'},
    {id:'hills',geo:[113.02, 33.09],name:'中阳山',x:30,y:53,status:'绕行'},
    {id:'xiping',geo:[114.02, 33.39],name:'西平',x:46,y:43,status:'绕行'},
    {id:'yanling',geo:[114.18, 34.1],name:'鄢陵',x:77,y:21,status:'杜充据守'},
    {id:'changge',geo:[113.78,34.24],name:'长葛',x:44,y:2,status:'金军据守'},
    {id:'linying',geo:[113.99,33.84],name:'临颍方向',x:62,y:38,status:'宋军佯向',landmarkOnly:true},
    {id:'jin-camp',geo:[113.825,34.085],name:'挞懒将台',x:45,y:11,status:'金军将台',landmarkOnly:true},
    {id:'east-road',geo:[114.055,34.17],name:'河东北路',x:70,y:5,status:'金军折返方向',landmarkOnly:true,hiddenView:true},
    {id:'north-bank',geo:[113.88,34.28],name:'潩水上游',x:56,y:0,status:'上游',landmarkOnly:true,hiddenView:true},
    {id:'ford',geo:[113.94, 34.02],name:'清潩水渡口',x:57,y:20,status:'未接战'},
    {id:'changshe',geo:[113.82, 34.02],name:'长社',x:44,y:18,status:'韩世忠受围'}
  ],
  groups:[
    {id:'emperor',name:'赵玖 · 刘晏赤心队',side:'friendly',type:'light',formation:'column',count:52,front:'nanyang',x:17,y:56,labelY:2.0},
    {id:'decoy',name:'杨沂中等 · 南阳佯动',side:'friendly',type:'infantry',formation:'line',count:65,front:'nanyang',x:12,y:61},
    {id:'wuzhu',name:'金兀术部',side:'opposing',type:'elite',formation:'mounted',count:1,front:'nanyang',x:11,y:53},
    {id:'balisu',name:'拔离速骑兵',side:'opposing',type:'elite',formation:'mounted',count:1,front:'nanyang',x:15,y:54,displayUntil:'xiping'},
    {id:'yanling-total',name:'鄢陵援军',side:'friendly',type:'infantry',formation:'block',count:1,front:'yanling',x:77,y:21,displayUntil:'march-yue'},
    {id:'yue',name:'岳飞部',side:'friendly',type:'infantry',formation:'block',count:132,front:'yanling',x:74,y:27,labelY:3.8},
    {id:'ma',name:'马皋等 · 北路佯动',side:'friendly',type:'infantry',formation:'column',count:64,front:'yanling',x:75,y:10,reveal:'march-yue'},
    {id:'xu',name:'徐庆阵',side:'friendly',type:'infantry',formation:'block',count:48,front:'ford',x:51.6,y:21,reveal:'contact'},
    {id:'wang',name:'王彦 · 八字军',side:'friendly',type:'infantry',formation:'column',count:90,front:'yanling',x:76,y:14},
    {id:'han',name:'韩世忠部',side:'friendly',type:'infantry',formation:'block',count:86,morale:51,front:'changshe',x:44,y:18,labelY:-1.5},
    {id:'jin',name:'完颜挞懒部',side:'opposing',type:'elite',formation:'mounted',count:141,front:'changshe',x:49,y:14},
    {id:'river-jin',name:'金军渡河部',side:'opposing',type:'elite',formation:'mounted',count:78,reveal:'contact',front:'ford',x:48,y:23},
    {id:'reserve',name:'蒲察鹘拔鲁部',side:'opposing',type:'elite',formation:'mounted',count:84,reveal:'lure',front:'ford',x:65,y:14}
  ],
  controls:[
    {label:'南阳佯动 · 赵玖绕行',signal:'depart',focus:{kind:'all'},consumed:'departure'},
    {label:'进鄢陵县衙',signal:'yamen',focus:{kind:'front',id:'yanling'},after:['meeting'],consumed:'yamen'},
    {label:'召集诸将 · 堂上问责',signal:'conference',focus:{kind:'front',id:'yanling'},after:['yamen'],consumed:'conference'},
    {label:'按岳飞部署出兵',signal:'yue',focus:{kind:'situation'},after:['conference'],consumed:'march-yue'},
    {label:'赵玖率援军抵近浮桥',signal:'emperor',focus:{kind:'front',id:'ford'},after:['wang-arrival'],consumed:'march-emperor'},
  ],
  events:[
    {id:'departure',at:0,signal:'depart',title:'南阳佯动，赵玖绕行',detail:'杜充以诸将不和为由上报，杜岩却连夜到南阳揭发父亲与挞懒私约不战。赵玖沿杜岩指出的绕行方向东行，由杨沂中等在南方牵制金军。',people:'杜岩、赵玖、杨沂中、刘晏',source:'卷二第 62–63 章《召见》《问答》',effects:[
      {kind:'front',front:'nanyang',value:'佯动接战'},{kind:'status',unit:'decoy',value:'fighting'},
      {kind:'march',unit:'balisu',front:'nanyang',x:15,y:61,duration:4},
      {kind:'march',unit:'emperor',front:'hills',duration:5}]},
    {id:'xiping',at:0,after:['departure'],arrived:'emperor',title:'经中阳山向西平',detail:'路线按章中地名作示意，绕开郾城一线的具体路段从略。',effects:[
      {kind:'march',unit:'emperor',front:'xiping',duration:5},{kind:'status',unit:'decoy',value:'withdrawing'}]},
    {id:'detour',at:0,after:['xiping'],arrived:'emperor',title:'绕郾城向鄢陵',detail:'南阳佯动付出代价。赵玖一行继续北行，视角可跟随赤心队。',effects:[
      {kind:'front',front:'nanyang',value:'佯动部队退回'},{kind:'march',unit:'emperor',front:'yanling',x:77,y:20,duration:8}]},
    {id:'meeting',at:0,after:['detour'],arrived:'emperor',title:'鄢陵 · 赵玖先与岳飞议战',detail:'赵玖抵鄢陵后与岳飞会合，询问此战能否取胜。岳飞主张趁金军分散、尚不知赵玖已到之际集中兵力出战，赵玖支持由他部署。',
      people:'赵玖、岳飞',source:'卷二第 63–64 章《问答》《堂论》',effects:[
      {kind:'front',front:'yanling',value:'赵玖与岳飞议战'}]},
    {id:'yamen',at:0,after:['meeting'],signal:'yamen',title:'鄢陵 · 入城与召集诸将',detail:'岳飞与赵玖同到县衙前，张宪率踏白军留下护卫。岳飞出城召集各部将领；林学士先稳住掌城防的郦琼，赵玖进衙召杜充。',
      people:'赵玖、岳飞、张宪、郦琼',source:'卷二第 64 章《堂论》',effects:[
      {kind:'front',front:'yanling',value:'诸将赴县衙'}]},
    {id:'conference',at:0,after:['yamen'],signal:'conference',title:'鄢陵堂论 · 处置杜充',detail:'杜充辩称局势不可为。岳飞召齐诸将后，赵玖问岳飞能否取胜，当众明确由岳飞调度，并亲手处决杜充。',
      people:'赵玖、杜充、岳飞、王彦与各部将领',source:'卷二第 64–65 章《堂论》《夜色》',effects:[
      {kind:'front',front:'yanling',value:'岳飞受命调度'},{kind:'morale',unit:'yue',delta:5}]},
    {id:'march-yue',at:0,after:['conference'],signal:'yue',title:'马皋北上，岳飞先向临颍',detail:'李逵诈降递出消息，马皋等沿洧水北上，岳飞先向临颍方向调动。',people:'李逵、马皋、岳飞、完颜挞懒',source:'卷二第 66 章《决策》',effects:[
      {kind:'march',unit:'ma',front:'changge',x:47,y:4,duration:8},
      {kind:'march',unit:'yue',front:'linying',x:64,y:34,duration:7}]},
    {id:'lure',at:0,after:['march-yue'],delay:2,title:'挞懒派蒲察鹘拔鲁去长葛',detail:'挞懒得到北路宋军动向，令蒲察鹘拔鲁赶往长葛设伏。挞懒仍守长社。',source:'卷二第 66 章《决策》',effects:[
      {kind:'march',unit:'reserve',front:'changge',x:45,y:3,duration:9},
      {kind:'front',front:'changge',value:'金军赴长葛设伏'}]},
    {id:'yue-turn',at:0,after:['lure'],arrived:'yue',title:'岳飞转兵长社',detail:'金骑已被引往长葛，岳飞折向长社。沿途举起烟号，王彦为先锋，赵玖率援军从鄢陵出发。',source:'卷二第 67 章《进军》',effects:[
      {kind:'march',unit:'emperor',front:'ford',x:61,y:17,duration:16},
      {kind:'march',unit:'yue',front:'ford',x:51.2,y:17,duration:6},
      {kind:'march',unit:'wang',front:'ford',x:54.8,y:10,duration:6}]},
    {id:'contact',at:0,after:['yue-turn'],arrived:'yue',title:'清潩水 · 金骑扑向徐庆阵',detail:'岳飞先渡的部队在西岸背桥列阵。金军骑兵选中徐庆所部，试图在宋军渡河未毕时打穿一阵。',source:'卷二第 68 章《来回》',effects:[
      {kind:'front',front:'ford',value:'交战中'},
      {kind:'status',unit:'yue',value:'fighting'},{kind:'status',unit:'xu',value:'fighting'},
      {kind:'march',unit:'river-jin',front:'ford',x:51.4,y:21.1,duration:4,motion:'charge'}]},
    {id:'xu-break',at:0,after:['contact'],arrived:'river-jin',title:'徐庆阵溃，王彦抢渡',detail:'徐庆阵被破，岳飞本阵守住。王彦趁金骑阵型尚未收拢，从上游抢渡。',people:'徐庆、王彦、岳飞',source:'卷二第 68 章《来回》',effects:[
      {kind:'march',unit:'river-jin',front:'ford',x:49.5,y:21.8,duration:6,motion:'disordered'},
      {kind:'march',unit:'xu',front:'ford',x:54.5,y:21.7,duration:3,motion:'rout'},
      {kind:'march',unit:'wang',front:'ford',x:50.5,y:10,duration:6},
      {kind:'march',unit:'reserve',front:'east-road',duration:8}]},
    {id:'xu-routed',at:0,after:['xu-break'],arrived:'xu',title:'徐庆阵脱散',detail:'徐庆阵已溃；岳飞本阵仍守在清潩水西岸。',effects:[
      {kind:'status',unit:'xu',value:'routed'}]},
    {id:'emperor-approach',at:0,after:['xu-routed'],arrived:'emperor',title:'赵玖率援军抵达渡口外围',detail:'赵玖已从鄢陵走到渡口外围。王彦在上游抢渡，岳飞仍守住西岸。',effects:[]},
    {id:'wang-arrival',at:0,after:['emperor-approach'],arrived:'wang',title:'八字军在上游站稳',detail:'王彦在上游打开第二处战场。岳飞仍守下游，蒲察鹘拔鲁正赶回河东。',people:'王彦、岳飞、完颜挞懒',source:'卷二第 68 章《来回》',effects:[
      {kind:'status',unit:'wang',value:'fighting'},{kind:'front',front:'ford',value:'两路宋军接战'}]},
    {id:'march-emperor',at:0,after:['wang-arrival'],signal:'emperor',title:'赵玖率援军抵近浮桥',detail:'卷二第 67–68 章。赵玖所率援军赶赴接战处，小说写到渡河拆桥。',effects:[
      {kind:'march',unit:'emperor',front:'ford',x:53,y:14.1,duration:4}]},
    {id:'reserve-approach',at:0,after:['xu-break'],arrived:'reserve',title:'蒲察鹘拔鲁由东北赶回',detail:'金军援部继续赶往河东。场上的行军距离与速度为示意。',source:'卷二第 70 章《河滩》',effects:[
      {kind:'march',unit:'reserve',front:'ford',x:56.6,y:9,duration:22}]},
    {id:'cross-emperor',at:0,after:['march-emperor'],arrived:'emperor',title:'赵玖经浮桥渡河',detail:'龙纛随赵玖过桥，向清潩水西岸的岳飞本阵靠拢。',source:'卷二第 68 章《来回》',effects:[
      {kind:'march',unit:'emperor',front:'ford',x:51,y:14.1,duration:3}]},
    {id:'west-bank',at:0,after:['cross-emperor'],arrived:'emperor',title:'龙纛抵达浮桥西端',detail:'赵玖已渡过清潩水，继续向岳飞本阵靠拢。',effects:[
      {kind:'march',unit:'emperor',front:'ford',x:51.2,y:17,duration:3}]},
    {id:'banner',at:0,people:'赵玖、岳飞、郦琼、蒲察鹘拔鲁',source:'卷二第 68–69 章《来回》《并旗》',after:['west-bank'],arrived:'emperor',title:'赵玖抵达，旗帜显露',detail:'卷二第 68–69 章。赵玖进入岳飞阵中；以渡河拆桥与旗帜对应联动变化。',effects:[
      {kind:'morale',unit:'yue',delta:12},
      {kind:'morale',unit:'han',delta:24},{kind:'front',front:'ford',value:'赵玖已过河，郦琼奉命拆桥'}]},
    {id:'breakout',at:0,people:'韩世忠、赵玖、完颜挞懒',source:'卷二第 69 章《并旗》',after:['banner'],title:'韩世忠见旗突围',detail:'卷二第 69 章。韩世忠向赵玖所在阵地突击并会合。',effects:[
      {kind:'march',unit:'han',front:'ford',x:50,y:18,duration:8}]},
    {id:'bridge-down',at:0,after:['banner'],delay:2,title:'宋军突围时，浮桥拆断',detail:'韩世忠仍在奔向龙纛。蒲察鹘拔鲁从长葛回援，浮桥这条路已经断了。',effects:[{kind:'front',front:'ford',value:'宋军过河，浮桥已拆'}]},
    {id:'joint',at:0,after:['breakout','bridge-down'],arrived:'han',title:'韩、岳并旗',detail:'韩世忠与赵玖、岳飞会合，建议赵玖让龙纛朝挞懒将台推进，韩、岳两旗在旁。场上各部看见三旗同进，遂向同一方向集中。',people:'赵玖、韩世忠、岳飞、完颜挞懒',source:'卷二第 69 章《并旗》',effects:[
      {kind:'march',unit:'emperor',front:'ford',x:50.4,y:17.2,duration:2,motion:'standard'},
      {kind:'march',unit:'han',front:'ford',x:49.1,y:18.1,duration:2,motion:'standard'},
      {kind:'march',unit:'yue',front:'ford',x:51.7,y:16.3,duration:2,motion:'standard'}]},
    {id:'standards-advance',at:0,after:['joint'],arrived:'emperor',title:'三旗向挞懒将台推进',detail:'龙纛居中，韩、岳两旗分列两侧。诸军见旗前进，朝将台方向合力压上。',source:'卷二第 69 章《并旗》',effects:[
      {kind:'march',unit:'emperor',front:'jin-camp',x:46.4,y:12.0,duration:7,motion:'standard'},
      {kind:'march',unit:'han',front:'jin-camp',x:45.1,y:12.9,duration:7,motion:'standard'},
      {kind:'march',unit:'yue',front:'jin-camp',x:47.7,y:11.1,duration:7,motion:'standard'}]},
    {id:'relief',at:0,people:'韩世忠、岳飞、赵玖、完颜挞懒',source:'卷二第 70 章《河滩》',after:['standards-advance'],arrived:'emperor',title:'长社解围',detail:'卷二第 70 章。韩世忠突围成功，金军留守部败退，长社解围。',effects:[
      {kind:'status',unit:'han',value:'holding'},{kind:'status',unit:'yue',value:'holding'},{kind:'status',unit:'wang',value:'holding'},
      {kind:'status',unit:'jin',value:'withdrawing'},{kind:'march',unit:'river-jin',front:'jin-camp',x:41.5,y:18,duration:6,motion:'withdraw'},
      {kind:'front',front:'changshe',value:'解围'},{kind:'front',front:'ford',value:'宋军沿河布防'}]},
    {id:'reserve-blocked',at:0,after:['relief'],delay:2,arrived:'reserve',title:'金军援部迟至河东',detail:'金营已失，蒲察鹘拔鲁到河东时，看见宋军沿河布防，无法渡河来援。',people:'蒲察鹘拔鲁、岳飞、王彦',source:'卷二第 70 章《河滩》',effects:[
      {kind:'status',unit:'reserve',value:'isolated'}]},
    {id:'reserve-withdraw',at:0,after:['reserve-blocked'],delay:2,title:'蒲察鹘拔鲁沿河北撤',detail:'获知潩水西岸有金军溃兵后，蒲察鹘拔鲁领兵沿河向北。',source:'卷二第 70 章《河滩》',effects:[
      {kind:'march',unit:'reserve',front:'north-bank',duration:5,motion:'withdraw'}]},
    {id:'reserve-exit',at:0,after:['reserve-withdraw'],arrived:'reserve',title:'金军援部撤离',detail:'金军援部离开长社战区。',effects:[
      {kind:'status',unit:'reserve',value:'withdrawing'}]}
  ]
};
