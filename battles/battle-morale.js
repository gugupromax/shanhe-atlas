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
  function conditions(scenario,side,context={}){
    return {
      noRetreat:scenario.morale?.backToWaterSide===side&&context.backToWater===true,
      shockSeconds:scenario.morale?.captureShockSide===side&&context.believesCommanderCaptured?context.secondsSinceReveal:0
    };
  }
  window.atlasBattleMorale={conditions,threshold,evaluate};
})();
