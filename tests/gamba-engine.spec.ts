import { expect, test } from '@playwright/test';
import { evaluateSpin, Grid, REELS, spinReels, SymbolId } from '../src/app/gamba/slot-engine';

const filled = (symbol: SymbolId): Grid => Array.from({ length: 5 }, () => [symbol, symbol, symbol]);

test('reels produce three consecutive symbols with wraparound', () => {
  const grid = spinReels(() => 23 / 24);
  expect(grid).toHaveLength(5);
  grid.forEach((reel, index) => expect(reel).toEqual([REELS[index][23], REELS[index][0], REELS[index][1]]));
  REELS.forEach(reel => expect(reel.filter(symbol => symbol === 'ivoris')).toHaveLength(1));
});

test('ten lines pay the line bet and Ivoris substitutes without duplicating line wins', () => {
  const aces = filled('ace');
  expect(evaluateSpin(aces, 10).total).toBe(500);
  aces[1] = ['ivoris', 'ivoris', 'ivoris'];
  expect(evaluateSpin(aces, 10).lineWins.reduce((sum, win) => sum + win.amount, 0)).toBe(500);
  aces[1] = ['book', 'book', 'book'];
  expect(evaluateSpin(aces, 10).lineWins).toEqual([]);
  aces[1] = ['ace', 'ace', 'ace'];
  expect(evaluateSpin(aces, 10).total).toBe(500);
  const books = evaluateSpin(filled('book'), 10);
  expect(books.total).toBe(5000);
  expect(books.lineWins).toHaveLength(10);
});

test('line matches must begin at the leftmost reel', () => {
  const grid = filled('ace');
  grid[0] = ['jack', 'jack', 'jack'];
  expect(evaluateSpin(grid, 10).lineWins).toEqual([]);
});

test('three to five scatters pay anywhere and award ten spins; two award none', () => {
  for (const count of [2, 3, 4, 5]) {
    const grid = filled('jack');
    for (let reel = 0; reel < count; reel++) grid[reel][reel % 3] = 'ivoris';
    const result = evaluateSpin(grid, 20);
    expect(result.scatterCount).toBe(count);
    expect(result.freeSpins).toBe(count >= 3 ? 10 : 0);
    expect(result.scatterWin).toBe(({ 2: 0, 3: 40, 4: 200, 5: 1000 } as Record<number, number>)[count]);
    expect(result.total).toBe(result.scatterWin + result.lineWins.reduce((sum, win) => sum + win.amount, 0));
  }
});

test('bonus expansion pays across nonadjacent reels on all ten lines', () => {
  const grid: Grid = [
    ['ace', 'jack', 'king'],
    ['queen', 'king', 'jack'],
    ['ace', 'king', 'queen'],
    ['jack', 'queen', 'king'],
    ['ace', 'queen', 'jack']
  ];
  const normal = evaluateSpin(grid, 10);
  const bonus = evaluateSpin(grid, 10, 'ace');
  expect(normal.expandedReels).toEqual([]);
  expect(bonus.expandedReels).toEqual([0, 2, 4]);
  expect(bonus.lineWins).toHaveLength(10);
  expect(bonus.lineWins.every(win => win.amount >= 5)).toBe(true);
  expect(bonus.total).toBeGreaterThan(normal.total);
  grid[4][0] = 'queen';
  expect(evaluateSpin(grid, 10, 'ace').expandedReels).toEqual([]);
});
