// --- Game Configuration ---
const STATES = ['Eufórico', 'Ebrio', 'Agobiado', 'Empanado'];

const STATE_CARD_MAP = {
  'Eufórico': 'A',
  'Ebrio': 'B',
  'Agobiado': 'C',
  'Empanado': 'D'
};

const CARDS = [
  { id: 'A', name: 'Golpe Rápido', icon: '⚡', baseDmg: 25, state: 'Eufórico', hasBonus: true },
  { id: 'B', name: 'Ataque Fuerte', icon: '💪', baseDmg: 25, state: 'Ebrio', hasBonus: true },
  { id: 'C', name: 'Golpe Crítico', icon: '💥', baseDmg: 20, state: 'Agobiado', hasBonus: true },
  { id: 'D', name: 'Devastación', icon: '🔥', baseDmg: 20, state: 'Empanado', hasBonus: true },
  { id: 'R', name: 'Recuperación', icon: '💚', heal: 25, isHeal: true }
];

const CRIT_CHANCE = 0.33;
const ENEMY_DMG = 25;
const ENEMY_DMG_BLOCKED = 10;
const ENEMY_CRIT_DMG = 50;
const BONUS_PER_TURN = { 1: 10, 2: 20, 3: 30 };
