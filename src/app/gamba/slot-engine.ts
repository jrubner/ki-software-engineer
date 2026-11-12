export const SYMBOLS = [
  { id: 'book', label: 'Book', glyph: '📕', payouts: [20, 100, 500] },
  { id: 'pharaoh', label: 'Pharaoh', glyph: '♚', payouts: [15, 60, 200] },
  { id: 'scarab', label: 'Scarab', glyph: '◆', payouts: [10, 40, 150] },
  { id: 'ankh', label: 'Ankh', glyph: '☥', payouts: [8, 30, 100] },
  { id: 'ace', label: 'Ace', glyph: 'A', payouts: [5, 15, 50] },
  { id: 'king', label: 'King', glyph: 'K', payouts: [5, 15, 50] },
  { id: 'queen', label: 'Queen', glyph: 'Q', payouts: [4, 10, 40] },
  { id: 'jack', label: 'Jack', glyph: 'J', payouts: [4, 10, 40] },
  { id: 'ivoris', label: 'Ivoris wild / scatter', glyph: '', payouts: [0, 0, 0] }
] as const;

export type SymbolId = (typeof SYMBOLS)[number]['id'];
export type Grid = SymbolId[][];

export const PAYLINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0]
];

// Each reel uses the same distribution but a different order. One scatter per strip.
const STRIP: SymbolId[] = [
  'ace',
  'king',
  'scarab',
  'queen',
  'ankh',
  'jack',
  'book',
  'ace',
  'pharaoh',
  'king',
  'queen',
  'ivoris',
  'jack',
  'ankh',
  'ace',
  'scarab',
  'king',
  'queen',
  'pharaoh',
  'jack',
  'ace',
  'king',
  'queen',
  'jack'
];
export const REELS = Array.from({ length: 5 }, (_, reel) =>
  Array.from({ length: STRIP.length }, (_, index) => STRIP[(index * 5 + reel * 7) % STRIP.length])
);

export function spinReels(random: () => number = Math.random): Grid {
  return REELS.map(strip => {
    const stop = Math.floor(random() * strip.length);
    return Array.from({ length: 3 }, (_, row) => strip[(stop + row) % strip.length]);
  });
}

export interface LineWin {
  line: number;
  amount: number;
  cells: string[];
}

export function evaluateSpin(grid: Grid, bet: number, expanding?: SymbolId) {
  const scatterCount = grid.flat().filter(symbol => symbol === 'ivoris').length;
  const scatterWin = scatterCount >= 3 ? bet * [2, 10, 50][Math.min(scatterCount, 5) - 3] : 0;
  const expandedReels = expanding ? grid.flatMap((reel, index) => (reel.includes(expanding) ? [index] : [])) : [];
  const expansionActive = expandedReels.length >= 3;
  const lineWins: LineWin[] = [];

  PAYLINES.forEach((line, index) => {
    const values = line.map((row, reel) => grid[reel][row]);
    let best: LineWin = { line: index + 1, amount: 0, cells: [] };
    for (const symbol of SYMBOLS.filter(item => item.id !== 'ivoris')) {
      let count = 0;
      for (const value of values) {
        if (value !== symbol.id && value !== 'ivoris') break;
        count++;
      }
      const amount = count >= 3 ? (bet / PAYLINES.length) * symbol.payouts[count - 3] : 0;
      if (amount > best.amount) {
        best = { line: index + 1, amount, cells: line.slice(0, count).map((row, reel) => `${reel}-${row}`) };
      }
    }
    if (expansionActive && expanding) {
      const symbol = SYMBOLS.find(item => item.id === expanding)!;
      const amount = (bet / PAYLINES.length) * symbol.payouts[expandedReels.length - 3];
      if (amount > best.amount) {
        best = {
          line: index + 1,
          amount,
          cells: expandedReels.map(reel => `${reel}-${line[reel]}`)
        };
      }
    }
    if (best.amount > 0) lineWins.push(best);
  });

  return {
    total: Math.round((lineWins.reduce((sum, win) => sum + win.amount, 0) + scatterWin) * 100) / 100,
    scatterCount,
    freeSpins: scatterCount >= 3 ? 10 : 0,
    scatterWin,
    lineWins,
    expandedReels: expansionActive ? expandedReels : []
  };
}
