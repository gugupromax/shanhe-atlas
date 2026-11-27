/* Numerical values are gameplay tuning, not historical equipment or casualty estimates. */
window.atlasBattleUnits = {
  infantry: {name:'步阵（装备未详）', attack:4.5, defense:37, hp:17, interval:2, speed:3.3, range:5.4, frontage:24},
  shield: {name:'持盾步兵', attack:4, defense:55, hp:18, interval:2, speed:3.1, range:5.4, frontage:24},
  blade: {name:'长刀步兵', attack:7, defense:25, hp:15, interval:2.2, speed:3.7, range:5.4, frontage:24},
  light: {name:'轻骑（武器未详）', attack:5, defense:20, hp:14, interval:1.8, speed:6.9, range:6.1, frontage:22, mounted:true},
  cavalry: {name:'轻骑兵', attack:5, defense:20, hp:14, interval:1.8, speed:6.9, range:6.1, frontage:22, mounted:true, shotRange:17, shotAttack:3},
  elite: {name:'精骑（轻重未详）', attack:6, defense:28, hp:15, interval:2.1, speed:6.2, range:6.1, frontage:22, mounted:true},
  heavy: {name:'重骑兵', attack:7, defense:45, hp:18, interval:2.5, speed:5.6, range:6.1, frontage:20, mounted:true},
  archer: {name:'弓兵', attack:2, defense:15, hp:12, interval:2.4, speed:3.3, range:5.1, frontage:24, shotRange:23, shotAttack:5}
};
window.atlasBattleFormations = {
  line: {name:'横阵', columns:6, rows:2, frontage:1.15},
  block: {name:'方阵', columns:5, rows:3, frontage:1},
  column: {name:'纵队', columns:3, rows:4, frontage:.7},
  mounted: {name:'骑队', columns:4, rows:3, frontage:1},
  loose: {name:'疏列', columns:5, rows:2, frontage:.9}
};

// The local sand table and the national atlas draw the same Changshe miniatures.
// Each part lists its role, primitive, material and transform in the original model units.
window.ChangsheFigures = (() => {
  function soldier(mounted) {
    const lift = mounted ? .18 : 0;
    const parts = mounted ? [
      ['horse','box','wood',0,.12,0,.19,.18,.26],
      ['horse-head','head','wood',0,.23,.13,.64,.95,.70],
      ['body','box','dark',-.06,.055,-.02,.055,.12,.15],
      ['body','box','dark',.06,.055,-.02,.055,.12,.15],
    ] : [['body','box','dark',0,.095,0,.12,.18,.11]];
    parts.push(
      ['body','box','cloth',0,.22+lift,0,.17,.16,.13],
      ['head','head','dark',0,.34+lift,0,.62,.74,.62],
      ['body','box','wood',.10,.26+lift,0,.026,.39,.026],
    );
    return parts;
  }
  const foot = soldier(false), rider = soldier(true);
  return {
    parts(mounted) { return mounted ? rider : foot; },
    standard: [
      ['body','box','wood',-1.05,.38,0,.045,.77,.045],
      ['body','box','cloth',-.84,.64,0,.39,.29,.035],
    ],
    slots(formation) {
      const {rows,columns} = window.atlasBattleFormations[formation], slots = [];
      for (let row=0; row<rows; row++) for (let col=0; col<columns; col++) {
        slots.push([(col-(columns-1)/2)*.29,(row-(rows-1)/2)*.28]);
      }
      return slots;
    },
    siegeSectors: Array.from({length:12},(_,i)=>({start:i*Math.PI/6+.055,span:.40})),
  };
})();
