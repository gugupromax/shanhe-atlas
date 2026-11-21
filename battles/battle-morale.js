/* Prototype morale rules shared by the battle sandbox and the Jingxing explanation. */
(function () {
  'use strict';
  function threshold(noRetreat=false) {
    return noRetreat ? 15 : 30;
  }
  function evaluate({armyLoss,ownLoss,noRetreat=false,shockSeconds=0}) {
    const shock=Math.min(45,Math.max(0,shockSeconds||0)*8);
    const morale=Math.max(0,100-55*armyLoss-55*ownLoss-shock);
    return {morale,routed:morale<=threshold(noRetreat)};
  }
  // Enable modifiers per scenario, faction and battle event.
  const scenarios={
    jingxing: {
      han: context=>({noRetreat:context.backToWater===true}),
      zhao: context=>({shockSeconds:context.believesCommanderCaptured?context.secondsSinceReveal:0})
    }
  };
  function conditions(battle,side,context={}){
    return scenarios[battle]?.[side]?.(context)??{};
  }
  window.atlasBattleMorale={conditions,threshold,evaluate};
})();
