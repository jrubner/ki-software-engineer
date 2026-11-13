import { evaluateSpin, Grid, REELS, spinReels, SymbolId } from './slot-engine';

const filled = (symbol: SymbolId): Grid => Array.from({ length: 5 }, () => [symbol, symbol, symbol]);

describe('slot engine', () => {
  it('produces three consecutive symbols with wraparound and one scatter per reel strip', () => {
    const grid = spinReels(() => 23 / 24);

    expect(grid).toHaveLength(5);
    grid.forEach((reel, index) => expect(reel).toEqual([REELS[index][23], REELS[index][0], REELS[index][1]]));
    REELS.forEach(reel => expect(reel.filter(symbol => symbol === 'ivoris')).toHaveLength(1));
  });

  it('pays ten lines and substitutes Ivoris without duplicating line wins', () => {
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

  it('requires matches to begin at the leftmost reel', () => {
    const grid = filled('ace');
    grid[0] = ['jack', 'jack', 'jack'];
    expect(evaluateSpin(grid, 10).lineWins).toEqual([]);
  });

  it('pays three to five scatters anywhere and awards ten free spins', () => {
    for (const count of [2, 3, 4, 5]) {
      const grid = filled('jack');
      for (let reel = 0; reel < count; reel++) grid[reel][reel % 3] = 'ivoris';
      const result = evaluateSpin(grid, 20);
      const scatterPayouts: Record<number, number> = { 2: 0, 3: 40, 4: 200, 5: 1000 };

      expect(result.scatterCount).toBe(count);
      expect(result.freeSpins).toBe(count >= 3 ? 10 : 0);
      expect(result.scatterWin).toBe(scatterPayouts[count]);
      expect(result.total).toBe(result.scatterWin + result.lineWins.reduce((sum, win) => sum + win.amount, 0));
    }
  });

  it('expands a selected symbol on nonadjacent reels across every line', () => {
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
});
