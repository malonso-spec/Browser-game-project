// --- Game Configuration ---
const CARDS = [
  { id: 'A1', name: 'Stunning Dance', type: 'attack', baseDmg: 25 },
  { id: 'A2', name: 'Stunning Dance', type: 'attack', baseDmg: 25 },
  { id: 'CRIT', name: 'Rock Invocation', type: 'crit' },
  { id: 'R', name: 'Bubble Gum', type: 'heal', heal: 25 },
  { id: 'F', name: 'Food', type: 'food' }
];

const CRIT_CYCLE_DMG = [30, 40, 50]; // damage per position in 3-turn cycle (T1/T2/T3, T4/T5/T6, ...)
const ENEMY_DMG = 25;
const ENEMY_DMG_BLOCKED = 10;
const ENEMY_CRIT_DMG = 50;
const ENEMY_CRIT_CHANCE_EARLY = 0.33;  // Heavy chance T1-T3
const ENEMY_CRIT_CHANCE_LATE = 0.40;   // Heavy chance T4+
const DRUNK_CHANCES = [0.33, 0.66, 1.0]; // by consecutive enemy hit count
