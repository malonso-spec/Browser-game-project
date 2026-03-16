// --- Game Configuration ---
const STATES = ['Euphoric', 'Drunk', 'Overwhelmed', 'Dazed'];

const STATE_CARD_MAP = {
  'Euphoric': 'A',
  'Drunk': 'A',
  'Overwhelmed': 'A',
  'Dazed': 'A'
};

const CARDS = [
  { id: 'A', name: 'Quick Strike', icon: '⚡', baseDmg: 20, state: 'Euphoric', hasBonus: true },
  { id: 'B', name: 'Power Hit', icon: '💪', baseDmg: 20, state: 'Drunk', hasBonus: true },
  { id: 'C', name: 'Critical Blow', icon: '💥', baseDmg: 20, state: 'Overwhelmed', hasBonus: true },
  { id: 'D', name: 'Devastation', icon: '🔥', baseDmg: 20, state: 'Dazed', hasBonus: true },
  { id: 'R', name: 'Recovery', icon: '💚', heal: 25, isHeal: true }
];

const CRIT_CHANCE = 0.33;
const ENEMY_DMG = 25;
const ENEMY_DMG_BLOCKED = 10;
const ENEMY_CRIT_DMG = 50;
const BONUS_PER_TURN = { 1: 10, 2: 20, 3: 30 };
