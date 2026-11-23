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
