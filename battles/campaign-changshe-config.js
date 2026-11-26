/* Literary adaptation, volume II chapters 62–71. Distances, elapsed times and all stats are playtest estimates. */
window.atlasCampaignDemo={
  terrain:true,
  chapters:[
    ['briefing','长社等援','卷二第 60–62 章'],
    ['courier','密报与夜行','卷二第 62–63 章'],
    ['meeting','鄢陵换帅','卷二第 64–65 章'],
    ['march-yue','长葛分兵','卷二第 66–67 章'],
    ['contact','渡河解围','卷二第 68–70 章'],
    ['reserve-exit','战后去向','卷二第 71 章']
  ],
  openingBrief:['长社被围，援军从哪里来？','韩世忠守长社，兀术又在围南阳。能驰援的是东京留守司的兵，但宗泽病重，谁能把各路兵调到一起？'],
  storyRoutes:[
    {after:'briefing',until:'courier',via:['tokyo','yanling'],label:'东京留守司诸军赴鄢陵'},
    {after:'courier',until:'departure',via:['yanling','xiping','hills','nanyang'],label:'杜岩回南阳 · 西平 → 中阳山'},
    {after:'reserve-exit',via:['changshe','changge','zhongmou'],label:'韩世忠、王彦 · 联马皋北追'},
    {after:'reserve-exit',via:['changshe','yanling','tokyo'],label:'赵玖 · 拟经鄢陵返东京'}
  ],
  strengthFor(group,log){
    const done=id=>log.some(event=>event.id===id);
    if(group.id==='emperor')return done('reserve-exit')?'拟经鄢陵返东京':done('yue-turn')?'随援军行进，人数未拆分':done('meeting')?'抵鄢陵不足200骑':done('detour')?'西平再减员，余数未详':done('xiping')?'中阳山余约400骑':'出发约800骑';
    if(group.id==='decoy')return done('xiping')?'约1万出城，约4000返回':'佯动约1万人';
    if(group.id==='yue')return done('yue-turn')?'先遣约2万人':'属鄢陵宋军';
    if(group.id==='yanling-total')return '宋军合计8万余（含岳飞、王彦）';
    if(group.id==='jin')return done('relief')?'退兵人数待核':done('lure')?'分兵后推算约1.5万':'长社战前集结约2.5万（含鹘拔鲁）';
    if(group.id==='reserve')return done('riverbank')?'鹘拔鲁已战死，余部待核':done('lure')?'约1万骑（从长社分出）':'属长社金军';
    if(group.id==='balisu')return done('departure')?'侧击约1万骑':'约1万骑（待机包抄）';
    if(group.id==='han')return done('relief')?'长社已解围，人数待核':'被围宋军，人数待核';
    if(group.id==='wuzhu')return '围南阳，兵力待核';
    return '人数待核';
  },
  strengthScale(group,log){
    const done=id=>log.some(event=>event.id===id);
    if(group.id==='emperor')return done('yue-turn')?null:done('meeting')?200:done('detour')?null:done('xiping')?400:800;
    if(group.id==='decoy')return done('xiping')?4000:10000;
    if(group.id==='yue')return done('yue-turn')?20000:null;
    if(group.id==='yanling-total')return 80000;
    if(group.id==='jin')return done('relief')?null:done('lure')?15000:25000;
    if(group.id==='reserve')return done('lure')&&!done('riverbank')?10000:null;
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
    briefing:['救兵到了鄢陵，长社却仍在等','宗泽病重。岳飞能带本部出战，却难号令留守司诸军。朝廷派杜充统领，王彦率八字军来会，鄢陵遂集结八万余人。'],
    stalled:['杜充把按兵不动归咎于诸将不和','岳飞、王彦等屡请出兵，都被杜充压下。南阳收到的却是各军几近火并的奏报，朝廷一时无法查实。'],
    courier:['杜岩带回密报与回程','岳飞、王彦在军务上共同请战，杜充却与挞懒私约不战。杜岩从鄢陵经西平、中阳山绕回南阳，赵玖决定循这条路反向赴鄢陵，亲自调兵。'],
    departure:["赵玖夜出被围的南阳", "杨沂中等约万人向南佯动，拔离速约万骑侧击。刘晏率约800骑护赵玖从东面绕行，途中须避开金军骑兵。"],
    xiping:["中阳山，八百骑留下半数", "半数军士下马步行去比阳，余下约四百人一人双马，赶往西平。南阳佯动的约万人只回城四千，东寨也失了。"],
    detour:["过西平，再择马北行", "赵玖再次留下部分军士，绕开郾城。杜岩走过这条路，途中仍可能撞见零散金骑。"],
    meeting:["鄢陵城外 · 赵玖与岳飞议战", "韩世忠还在长社城里。金军已经分兵，岳飞请趁各路尚未回援时集中出击。"],
    yamen:["张宪护衙，岳飞去召集诸将", "郦琼奉旨。等各部将领到齐，再当面对质杜充。"],
    conference:["斧决杜充", "赵玖当众让岳飞负责调度，随后处置杜充。接下来，诸军按岳飞号令出兵。"],
    'march-yue':['马皋走长葛，岳飞先向临颍','李逵诈降，把北路宋军的消息送入金营。挞懒眼前有两路动静，还不知道赵玖已到鄢陵。'],
    lure:['挞懒调约万骑离开长社','挞懒判断马皋要向北接应，派鹘拔鲁去长葛设伏，自己留兵围城。长社金军由约两万五千减至约一万五千。'],
    'yue-turn':['岳飞折向长社','金骑已被引往长葛，岳飞折向长社。沿途举起烟号，王彦在前，赵玖率援军从鄢陵出发。'],
    'xu-routed':['岳字旗仍立，八字军正在抢渡','徐庆阵散，岳飞仍守西岸桥头。王彦继续从上游过河，赵玖的援军仍在赶路。冲散徐庆阵的金骑回收队形，长葛方向的金军援兵也正折返。'],
    'xu-break':['徐庆阵溃，岳飞本阵未倒','金骑冲散徐庆部，徐庆阵亡。岳字旗仍在河边，王彦趁金骑未收拢，从上游抢渡。'],
    contact:["挞懒留桥，等岳飞半渡", "挞懒想趁宋军未全部过河就击破先头。金骑扑向西岸的徐庆阵时，岳飞本阵背桥而立，王彦还未抢渡。"],
    'wang-arrival':['上游抢渡，城头仍在等','徐庆阵溃，岳字旗却仍立在桥头。王彦看准金骑尚未收拢，从上游渡河；韩世忠在城头判断还有后援，继续等候。'],
    'march-emperor':['两路援军正在赶来','赵玖已走过鄢陵到渡口的大半路程，正率援军抵近浮桥。蒲察鹘拔鲁正在从长葛折返，还没到河边。'],
    'reserve-approach':['两路援军正在赶来','蒲察鹘拔鲁绕向河东，赵玖也在赶往清潩水浮桥。'],
    'emperor-approach':['岳飞守住桥头，赵玖已到浮桥外','徐庆阵虽破，岳飞还守住西岸。王彦从上游分走金骑的压力，赵玖这一路才有机会过桥。'],
    'cross-emperor':['龙纛上桥','赵玖从清潩水东岸过桥，朝岳飞本阵去。蒲察鹘拔鲁仍在东北方向赶路。'],
    'west-bank':['龙纛过桥，向岳飞本阵靠拢','赵玖已上西岸。长社守军仍在城里等援军信号。'],
    banner:["赵玖到达岳飞阵中", "赵玖进入岳飞本阵，龙纛显露。韩世忠见旗出城，赵玖命郦琼传令拆桥。"],
    breakout:['韩世忠见岳飞阵中龙纛，下令出城','解元出东门，王善出南门。韩世忠与成闵率背嵬军从城墙豁口直奔龙纛。赵玖已进入岳飞本阵，同时命郦琼传令拆桥。'],
    'bridge-down':['清潩水浮桥已拆，韩军仍在突围','赵玖过河后命郦琼传令拆桥。韩军仍向岳飞本阵会合，鹘拔鲁的大队已无法从这座桥回援。'],
    joint:['韩、岳向龙纛靠拢','韩世忠见到赵玖，请他以龙纛为号，韩旗与岳旗护在两侧。'],
    'standards-advance':['韩、岳并旗，龙纛转向挞懒将台','三面旗一同向西北推进，乱战中的诸军认旗跟进。'],
    relief:["长社解围", "三旗并进后，宋军拔取金营。洪涯带挞懒从浊潩水方向脱身，长社解围，金军渡河部从河边退走。"],
    'reserve-blocked':['蒲察鹘拔鲁赶到河东','金营已失，浮桥已拆，宋军也已沿河布防。他在对岸看不到过河接应的机会。'],
    'reserve-withdraw':['金军援部沿河北上寻找挞懒','鹘拔鲁在河东得知西岸有金军溃兵，加上浮桥已断，便领兵向北寻找逃离将台的挞懒。'],
    riverbank:['挞懒脱身，鹘拔鲁没能回来','洪涯带挞懒逃到浊潩水。鹘拔鲁在河滩接应挞懒过河，自己被李逵和赶来的牛皋杀死。'],
    'reserve-exit':['岳飞守长社，韩、王北追','南援粮道紧张。岳飞留镇五河、牵制兀术，韩世忠和王彦联马皋北攻中牟。赵玖拟经鄢陵赴东京。地图显示战后军令。'],
  },
  scenes:{
    conference:{
      title:'斧决杜充',
      text:'张宪守住县衙，林景默说服掌城防的郦琼奉旨。诸将到齐后，岳飞指出金军分兵、河冰渐融，可趁回援未到集中出战。赵玖当众让岳飞调度诸军，随后处决杜充。入夜，胡寅追问这番处置的代价。援军能动了，朝廷对擅杀大员的争议刚开始。',
      image:'changshe-conference.local.png'
    }
  },
  autoStartSignal:'briefing',
  cameraCues:{
    briefing:{kind:'situation',center:[113.99,34.13],distance:128},
    courier:{kind:'all'},
    'march-yue':{kind:'situation'},lure:{kind:'situation'},'yue-turn':{kind:'situation'},
    'cross-emperor':{kind:'front',id:'ford'},'reserve-blocked':{kind:'front',id:'ford'},
    'reserve-withdraw':{kind:'unit',id:'reserve'},riverbank:{kind:'front',id:'north-bank'},joint:{kind:'front',id:'jin-camp'},
    'reserve-exit':{kind:'situation',center:[113.99,34.17],distance:133}
  },
  motionCues:{'march-yue':'ma',lure:'reserve','yue-turn':'yue',contact:'river-jin','xu-break':'wang','march-emperor':'emperor','reserve-approach':'emperor','cross-emperor':'emperor',relief:'reserve','reserve-withdraw':'reserve',joint:'emperor','standards-advance':'emperor'},
  finishAt:'reserve-exit',
  pauseAt:['courier','meeting','yamen','conference','wang-arrival'],
  fronts:[
    {id:'tokyo',geo:[114.28,34.60],name:'东京方向',x:87,y:3,status:'东京留守司',landmarkOnly:true,captionOnly:true},
    {id:'zhongmou',geo:[113.94,34.60],name:'中牟方向',x:61,y:3,status:'战后北追方向',landmarkOnly:true,captionOnly:true,reveal:'reserve-exit'},
    {id:'nanyang',geo:[112.53, 32.99],name:'南阳',x:13,y:57,status:'金军压境'},
    {id:'hills',geo:[113.02, 33.09],name:'中阳山',x:30,y:53,status:'绕行'},
    {id:'xiping',geo:[114.02, 33.39],name:'西平',x:46,y:43,status:'绕行'},
    {id:'yanling',geo:[114.18, 34.1],name:'鄢陵',x:77,y:21,status:'杜充据守'},
    {id:'changge',geo:[113.78,34.24],name:'长葛',x:44,y:2,status:'金军据守'},
    {id:'linying',geo:[113.99,33.84],name:'临颍方向',x:62,y:38,status:'宋军佯向',landmarkOnly:true},
    {id:'jin-camp',geo:[113.825,34.085],name:'挞懒将台',x:45,y:11,status:'金军将台',landmarkOnly:true},
    {id:'east-road',geo:[114.055,34.17],name:'河东北路',x:70,y:5,status:'金军折返方向',landmarkOnly:true,hiddenView:true},
    {id:'north-bank',geo:[113.84,34.26],name:'河滩',x:56,y:5,status:'潩水上游',landmarkOnly:true,captionOnly:true,reveal:'riverbank'},
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
    {label:'看鄢陵援军为何不动',signal:'briefing',focus:{kind:'situation'},consumed:'briefing'},
    {label:'南阳佯动 · 赵玖绕行',signal:'depart',focus:{kind:'all'},after:['courier'],consumed:'departure'},
    {label:'进鄢陵县衙',signal:'yamen',focus:{kind:'front',id:'yanling'},after:['meeting'],consumed:'yamen'},
    {label:'召集诸将 · 堂上问责',signal:'conference',focus:{kind:'front',id:'yanling'},after:['yamen'],consumed:'conference'},
    {label:'按岳飞部署出兵',signal:'yue',focus:{kind:'situation'},after:['conference'],consumed:'march-yue'},
    {label:'赵玖率援军抵近浮桥',signal:'emperor',focus:{kind:'front',id:'ford'},after:['wang-arrival'],consumed:'march-emperor'},
  ],
  events:[
    {id:'briefing',at:0,signal:'briefing',title:'东京诸军集结鄢陵',detail:'宗泽病重，朝廷让杜充统领东京留守司援军。岳飞、王彦等军会合，鄢陵集结八万余人。',source:'卷二第 60–61 章',effects:[
      {kind:'front',front:'yanling',value:'援军集结，待命'}]},
    {id:'stalled',at:0,after:['briefing'],delay:8,title:'杜充奏称诸将不和',detail:'诸将已经共同请战，杜充拒绝出兵，却在奏报中声称各部互相攻讦。',source:'卷二第 61–62 章',effects:[
      {kind:'front',front:'yanling',value:'杜充按兵不动'}]},
    {id:'courier',at:0,after:['stalled'],delay:7,title:'杜岩绕回南阳，揭发私约',detail:'杜岩从鄢陵绕经西平、中阳山回到南阳，告诉赵玖杜充与挞懒私约不战。赵玖据这条回程决定亲赴鄢陵。',people:'杜充、杜岩、赵玖',source:'卷二第 62 章《召见》',effects:[
      {kind:'front',front:'nanyang',value:'杜岩密报抵达'},{kind:'front',front:'yanling',value:'杜充私约不战'}]},
    {id:'departure',at:0,after:['courier'],signal:'depart',title:'南阳佯动，赵玖绕行',detail:'赵玖沿杜岩走过的方向反向绕行，由杨沂中等在南方牵制金军。',people:'杜岩、赵玖、杨沂中、刘晏',source:'卷二第 62–63 章《召见》《问答》',effects:[
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
    {id:'riverbank',at:0,after:['reserve-withdraw'],arrived:'reserve',title:'浊潩水河滩',detail:'鹘拔鲁北上接应挞懒。挞懒渡河脱身，李逵与赶来的牛皋在河滩杀死鹘拔鲁。',people:'完颜挞懒、洪涯、蒲察鹘拔鲁、李逵、牛皋',source:'卷二第 70 章《河滩》',effects:[
      {kind:'status',unit:'reserve',value:'withdrawing'},{kind:'front',front:'north-bank',value:'挞懒脱身，鹘拔鲁战死'}]},
    {id:'reserve-exit',at:0,after:['riverbank'],delay:8,title:'长社战后布置',detail:'粮草不足，直接南援风险太大。赵玖命岳飞留镇五河、解围诸城并迟滞兀术，韩世忠为主、王彦为辅，联马皋北攻中牟、追击挞懒，自己拟经鄢陵赴东京。',source:'卷二第 71 章《或言南北》',effects:[
      {kind:'front',front:'yanling',value:'赵玖拟经此返东京'},{kind:'front',front:'changge',value:'北追联络点'}]}
  ]
};
