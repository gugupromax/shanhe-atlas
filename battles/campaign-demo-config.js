/* Original schematic test fixture. No novel or historical source is claimed. */
window.atlasCampaignDemo={
  fronts:[
    {id:'west',name:'西线 · 河谷',x:22,y:52,status:'等待'},
    {id:'east',name:'东线 · 平原',x:66,y:36,status:'等待'},
    {id:'city',name:'北城',x:79,y:13,status:'被围'}
  ],
  groups:[
    {id:'screen',name:'西线牵制部',side:'friendly',type:'infantry',formation:'line',count:80,front:'west',x:16,y:58},
    {id:'opponent',name:'西线守军',side:'opposing',type:'infantry',formation:'block',count:80,front:'west',x:28,y:48},
    {id:'main',name:'东线主队',side:'friendly',type:'infantry',formation:'block',count:96,front:'east',x:53,y:43},
    {id:'reserve',name:'东线对手',side:'opposing',type:'infantry',formation:'line',count:75,front:'east',x:70,y:32},
    {id:'relief',name:'援军',side:'friendly',type:'light',formation:'column',count:36,front:'west',x:25,y:58},
    {id:'garrison',name:'北城守军',side:'friendly',type:'infantry',formation:'block',count:58,morale:70,front:'city',x:81,y:12}
  ],
  events:[
    {id:'fix',at:4,title:'西线接战',detail:'西线守军被牵制，援军获得向东行进的窗口。',effects:[
      {kind:'front',front:'west',value:'交战中'},{kind:'status',unit:'screen',value:'fighting'},{kind:'status',unit:'opponent',value:'fighting'}]},
    {id:'dispatch',at:8,after:['fix'],title:'援军离开西线',detail:'援军向东线行进，西线仍在交战。',effects:[
      {kind:'march',unit:'relief',front:'east',x:62,y:39,duration:12}]},
    {id:'engage',at:14,title:'东线接战',detail:'东线主队接战，战果等待局部战斗结算。',effects:[
      {kind:'front',front:'east',value:'交战中'},{kind:'status',unit:'main',value:'fighting'},{kind:'status',unit:'reserve',value:'fighting'}]},
    {id:'join',at:20,after:['dispatch','engage'],arrived:'relief',title:'援军抵达东线',detail:'东线出现援军，北城仍处于被围状态。',effects:[]},
    {id:'won',at:20,after:['join'],signal:'east:won',title:'东线取胜',detail:'东线战斗结果传到全局，援军获准北进。',effects:[
      {kind:'front',front:'east',value:'获胜'},{kind:'status',unit:'main',value:'holding'},{kind:'status',unit:'reserve',value:'withdrawing'},
      {kind:'march',unit:'relief',front:'city',x:77,y:15,duration:10}]},
    {id:'lift',at:20,after:['won'],arrived:'relief',title:'援军到城，北城解围',detail:'东线获胜与援军到达两个条件满足后，北城状态才改变。',effects:[
      {kind:'front',front:'city',value:'解围'},{kind:'status',unit:'garrison',value:'holding'},{kind:'morale',unit:'garrison',delta:15}]}
  ]
};
