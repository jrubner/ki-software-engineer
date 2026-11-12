import { expect as baseExpect, Page, test } from '@playwright/test';
import { evaluateSpin, REELS, SYMBOLS } from '../src/app/gamba/slot-engine';

const expect = baseExpect.configure({ timeout: 10000 });

async function observeRolling(track: ReturnType<Page['locator']>) {
  return track.evaluate(async element => {
    const start = performance.now();
    const positions: number[] = [];
    while (performance.now() - start < 350) {
      await new Promise(requestAnimationFrame);
      positions.push(new DOMMatrix(getComputedStyle(element).transform).m42);
    }
    return { first: positions[0], last: positions.at(-1)!, steps: new Set(positions).size };
  });
}

async function forceStops(page: Page, stops: number[]) {
  await page.evaluate(
    values => {
      let index = 0;
      Math.random = () => values[index++ % values.length];
    },
    stops.map(stop => stop / 24)
  );
}

async function amount(page: Page, id: string) {
  return Number((await page.getByTestId(id).innerText()).replace(/,/g, ''));
}

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:4200/gamba');
  await expect(page.getByRole('heading', { name: 'Book of CK', exact: true })).toBeVisible();
});

test('spins five reels, charges once, and settles an evaluated result', async ({ page }) => {
  await forceStops(page, [0, 0, 0, 0, 0]);
  expect(await page.getByRole('img', { name: /^Reel \d, row \d:/ }).count()).toBe(15);
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  await page.getByRole('button', { name: /SPINNING/ }).dispatchEvent('click');
  expect(await amount(page, 'credits')).toBe(990);
  await expect(page.getByRole('button', { name: 'Change total bet' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
  expect(await amount(page, 'credits')).toBe(990 + (await amount(page, 'last-win')));
  await page.getByRole('button', { name: 'Reset credits' }).click();
  await expect(page.getByTestId('credits')).toHaveText('1,000');
});

test('Ivoris scatters trigger, retrigger, and complete free spins without charging credits', async ({ page }) => {
  test.setTimeout(120000);
  const scatterStops = REELS.map(reel => reel.indexOf('ivoris'));
  await forceStops(page, scatterStops);
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  await expect(page.getByRole('heading', { name: '10 free spins remaining' })).toBeVisible();
  const award = page.getByRole('dialog', { name: '10 free spins!', exact: true });
  await expect(award).toBeVisible();
  const centered = await award.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return {
      x: Math.abs(bounds.x + bounds.width / 2 - innerWidth / 2),
      y: Math.abs(bounds.y + bounds.height / 2 - innerHeight / 2)
    };
  });
  expect(centered.x).toBeLessThan(2);
  expect(centered.y).toBeLessThan(2);
  await award.getByRole('button', { name: /SPIN FOR SYMBOL/ }).click();
  await expect(award.getByRole('button', { name: 'Stop selection' })).toBeVisible();
  await expect(award.locator('.selection-track')).toBeVisible();
  const selectionMoves = await observeRolling(award.locator('.selection-track'));
  expect(selectionMoves.last).toBeGreaterThan(selectionMoves.first);
  expect(selectionMoves.steps).toBeGreaterThan(3);
  await expect(award.getByRole('img', { name: /^Selected expanding symbol:/ })).toBeVisible();
  const selected = await award.getByRole('status').innerText();
  await award.getByRole('button', { name: 'Start free spins' }).press('Space');
  await expect(award).not.toBeVisible();
  await expect(page.locator('.bonus-symbol')).toContainText(selected.split(' · ')[0]);
  await expect(page.getByRole('button', { name: 'Change total bet' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reset credits' })).toBeDisabled();
  const before = await amount(page, 'credits');
  await forceStops(page, scatterStops);
  await page.getByRole('button', { name: 'FREE SPIN', exact: true }).click();
  await expect(page.getByRole('heading', { name: '19 free spins remaining' })).toBeVisible();
  const retrigger = page.getByRole('dialog', { name: '10 more free spins!' });
  await expect(retrigger.getByRole('status')).toHaveText(selected);
  await retrigger.getByRole('button', { name: 'Continue free spins' }).click();
  expect(await amount(page, 'credits')).toBe(before + (await amount(page, 'last-win')));
  await forceStops(page, [0, 0, 0, 0, 0]);
  const selectedId = SYMBOLS.find(symbol => selected.startsWith(symbol.label))!.id;
  for (let index = 0; index < 19; index++) {
    if (index === 0) {
      await forceStops(
        page,
        REELS.map((reel, index) => (index % 2 === 0 ? reel.indexOf(selectedId) : 0))
      );
    } else await forceStops(page, [0, 0, 0, 0, 0]);
    const credits = await amount(page, 'credits');
    await page.getByRole('button', { name: 'FREE SPIN', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Slot machine: five reels, three rows' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
    if (index === 0) {
      const matchingReels = REELS.filter(
        (reel, index) => index % 2 === 0 || reel.slice(0, 3).includes(selectedId)
      ).length;
      await expect(page.locator('.expanding-overlay')).toHaveCount(matchingReels);
      await expect(page.locator('.slot-cabinet')).toHaveClass(/expanding-now/);
      await expect(page.getByRole('button', { name: 'SPINNING', exact: true })).toBeDisabled();
      expect(
        await page
          .locator('.expanding-overlay')
          .first()
          .evaluate(element => element.getAnimations().length)
      ).toBeGreaterThan(0);
      expect(await amount(page, 'last-win')).toBe(0);
    }
    await expect(page.getByRole('group', { name: 'Slot machine: five reels, three rows' })).toHaveAttribute(
      'aria-busy',
      'false'
    );
    expect(await amount(page, 'credits')).toBeCloseTo(credits + (await amount(page, 'last-win')), 2);
  }
  await expect(page.getByRole('status')).toContainText('Free spins complete');
  await expect(page.getByRole('button', { name: 'Change total bet' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
});

test('Space spins once, reels move through real symbols, and held keys do not spin again', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await forceStops(page, [0, 0, 0, 0, 0]);
  await page.locator('h1').click();
  await page.keyboard.down('Space');
  await expect(page.locator('.moving-strip')).toHaveCount(5);
  expect(await amount(page, 'credits')).toBe(990);
  const motion = await observeRolling(page.locator('.moving-strip').last());
  expect(motion.first).toBeLessThan(motion.last);
  expect(motion.last).toBeLessThan(0);
  expect(motion.steps).toBeGreaterThan(3);
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
  const credits = await amount(page, 'credits');
  await page.evaluate(() =>
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, bubbles: true }))
  );
  await page.keyboard.up('Space');
  expect(await amount(page, 'credits')).toBe(credits);
  expect(
    await page.locator('.symbol-cell').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-symbol')))
  ).toEqual(REELS.flatMap(reel => reel.slice(0, 3)));
  await page.getByRole('button', { name: 'Change total bet' }).press('Space');
  await expect(page.getByRole('button', { name: 'Change total bet' })).toContainText('20');
  expect(await amount(page, 'credits')).toBe(credits);
});

test('bonus selection can be stopped and stays centered on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await forceStops(
    page,
    REELS.map(reel => reel.indexOf('ivoris'))
  );
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  const award = page.getByRole('dialog');
  await award.getByRole('button', { name: /SPIN FOR SYMBOL/ }).click();
  const motion = await observeRolling(award.locator('.selection-track'));
  expect(motion.last).toBeGreaterThan(motion.first);
  expect(motion.steps).toBeGreaterThan(3);
  await award.getByRole('button', { name: 'Stop selection' }).click();
  await expect(award.getByRole('img', { name: /^Selected expanding symbol:/ })).toBeVisible();
  expect(await award.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const bounds = await award.boundingBox();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - 195)).toBeLessThan(2);
  await award.getByRole('button', { name: 'Start free spins' }).click();
  await expect(award).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '10 free spins remaining' })).toBeVisible();
});

test('fullscreen contains the game and bonus dialog and restores its state on exit', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: 'Fullscreen', exact: false }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('gamba-page'))).toBe(true);
  await expect(page.getByRole('button', { name: /Exit fullscreen/ })).toHaveAttribute('aria-pressed', 'true');
  await forceStops(
    page,
    REELS.map(reel => reel.indexOf('ivoris'))
  );
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  const award = page.getByRole('dialog');
  await expect(award).toBeVisible();
  expect(await award.evaluate(element => document.fullscreenElement!.contains(element))).toBe(true);
  await award.getByRole('button', { name: /SPIN FOR SYMBOL/ }).click();
  await award.getByRole('button', { name: 'Stop selection' }).click();
  await award.getByRole('button', { name: 'Start free spins' }).click();
  await page.getByRole('button', { name: /Exit fullscreen/ }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole('button', { name: /Fullscreen/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: '10 free spins remaining' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fullscreen denial shows an actionable error and leaves the game playable', async ({ page }) => {
  await page.evaluate(() => {
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Denied'));
  });
  await page.getByRole('button', { name: /Fullscreen/ }).click();
  await expect(page.getByRole('alert')).toContainText('Fullscreen is unavailable');
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
});

test('rules, local icon, keyboard controls and mobile layout work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('region', { name: 'Game rules' })).toBeVisible();
  expect(
    await page.getByAltText('Ivoris').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Change total bet' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Change total bet' })).toContainText('20');
  await page.getByRole('link', { name: 'Back to the library' }).click();
  await expect(page).toHaveURL('http://localhost:4200/');
});

test('two landed scatters focus only the remaining reels and slow their stops in sequence', async ({ page }) => {
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await forceStops(
    page,
    REELS.map((reel, index) => (index < 2 ? reel.indexOf('ivoris') : 0))
  );
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  await expect(page.locator('.reel-focused')).toHaveCount(0);
  await expect(page.locator('.reel').nth(2)).toHaveClass(/reel-focused/);
  await expect(page.locator('.reel-pending')).toHaveCount(3);
  await expect(page.locator('.reel-spinning')).toHaveCount(3);
  expect(
    await page.locator('.reel-focused').evaluate(element => getComputedStyle(element, '::after').boxShadow !== 'none')
  ).toBe(true);
  const rolling = await observeRolling(page.locator('.reel-focused .moving-strip'));
  expect(rolling.last).toBeGreaterThan(rolling.first);
  expect(rolling.steps).toBeGreaterThan(3);
  await expect(page.getByRole('button', { name: 'Change total bet' })).toBeDisabled();
  // Sample faster than the transient focus window of each remaining reel.
  await expect
    .poll(() => page.locator('.reel').nth(3).getAttribute('class'), { intervals: [50] })
    .toMatch(/reel-focused/);
  await expect(page.locator('.reel-spinning')).toHaveCount(2);
  await expect
    .poll(() => page.locator('.reel').nth(4).getAttribute('class'), { intervals: [50] })
    .toMatch(/reel-focused/);
  await expect(page.locator('.reel-spinning')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
  await expect(page.locator('.reel-focused')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.slot-cabinet')).not.toHaveClass(/scatters-celebrating/);
  await forceStops(page, [0, 0, 0, 0, 0]);
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
  await expect(page.locator('.slot-cabinet')).not.toHaveClass(/anticipating/);
});

test('two scatters on the last reels never focus a finished spin', async ({ page }) => {
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await forceStops(
    page,
    REELS.map((reel, index) => (index >= 3 ? reel.indexOf('ivoris') : 0))
  );
  await page.locator('.slot-cabinet').evaluate(element => {
    element.setAttribute('data-had-focus', 'false');
    new MutationObserver(records => {
      if (
        records.some(record => (record.oldValue ?? '').split(' ').includes('anticipating')) ||
        element.classList.contains('anticipating')
      ) {
        element.setAttribute('data-had-focus', 'true');
      }
    }).observe(element, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
  await expect(page.locator('.symbol-cell[data-symbol="ivoris"]')).toHaveCount(2);
  await expect(page.locator('.slot-cabinet')).toHaveAttribute('data-had-focus', 'false');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the third scatter celebrates immediately and all landed scatters rotate before the dialog', async ({ page }) => {
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await forceStops(
    page,
    REELS.map(reel => reel.indexOf('ivoris'))
  );
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  const landed = page.locator('.reel:not(.reel-spinning) .symbol-cell[data-symbol="ivoris"] .scatter-icon');
  await expect(landed).toHaveCount(3);
  await expect(page.locator('.slot-cabinet')).toHaveClass(/scatters-celebrating/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const animation = await landed.first().evaluate(element => ({
    frames: (element.getAnimations()[0].effect as KeyframeEffect).getKeyframes().map(frame => frame.transform),
    glow: getComputedStyle(element).filter,
    background: getComputedStyle(element.parentElement!).backgroundImage
  }));
  expect(animation.frames.join(' ')).toContain('rotateY(360deg)');
  expect(animation.frames[0]).toContain('rotateY(0deg)');
  expect(animation.frames.at(-1)).toContain('rotateY(0deg)');
  expect(animation.glow).toContain('drop-shadow');
  expect(animation.background).toContain('radial-gradient');
  await expect(landed).toHaveCount(5);
  await expect(page.locator('.reel-spinning')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'SPINNING', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const motion = await landed.evaluateAll(async elements => {
    const sample = () => elements.map(element => getComputedStyle(element).transform);
    const first = sample();
    const start = performance.now();
    while (performance.now() - start < 180) await new Promise(requestAnimationFrame);
    return {
      first,
      second: sample(),
      active: elements.every(element => element.getAnimations().some(a => a.playState === 'running'))
    };
  });
  expect(motion.active).toBe(true);
  expect(motion.first).not.toEqual(motion.second);
  await expect(page.getByRole('dialog', { name: '10 free spins!', exact: true })).toBeVisible();
});

test('exactly three scatters with the third on the final reel delay the bonus until celebration ends', async ({
  page
}) => {
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await forceStops(
    page,
    REELS.map((reel, index) => ([0, 1, 4].includes(index) ? reel.indexOf('ivoris') : 0))
  );
  await page.getByRole('button', { name: 'Start autospin' }).click();
  await expect(page.locator('.scatters-celebrating')).toHaveCount(1);
  await expect(page.locator('.reel:not(.reel-spinning) .symbol-cell[data-symbol="ivoris"]')).toHaveCount(3);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.playback-controls .auto-button')).toContainText('9 left');
  await expect(page.getByRole('button', { name: 'Reset credits' })).toBeDisabled();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.playback-controls .auto-button')).toContainText('9 left');
  await page.getByRole('dialog').getByRole('button', { name: 'Stop autospin', exact: true }).click();
});

test('leaving during anticipation cancels the pending spin without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await forceStops(
    page,
    REELS.map((reel, index) => (index < 2 ? reel.indexOf('ivoris') : 0))
  );
  await page.getByRole('button', { name: 'SPIN', exact: true }).click();
  await expect(page.locator('.reel-focused')).toHaveCount(1);
  await page.getByRole('link', { name: 'Back to the library' }).click();
  await expect(page).toHaveURL('http://localhost:4200/');
  await page.goto('http://localhost:4200/gamba');
  await expect(page.getByTestId('credits')).toHaveText('1,000');
  await expect(page.locator('.reel-focused')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('speed cycles through three timings and reels roll with reduced motion enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await forceStops(page, [0, 0, 0, 0, 0]);
  const speed = page.getByRole('button', { name: 'Spin speed' });
  for (const [name, duration] of [
    ['Normal', 2100],
    ['Fast', 1100],
    ['Turbo', 550]
  ] as const) {
    await expect(speed).toHaveText(`Speed: ${name}`);
    await page.getByRole('button', { name: 'SPIN', exact: true }).click();
    expect(
      await page
        .locator('.moving-strip')
        .first()
        .evaluate(element => element.getAnimations()[0].effect!.getTiming().duration)
    ).toBe(duration);
    const motion = await observeRolling(page.locator('.moving-strip').last());
    expect(motion.last).toBeGreaterThan(motion.first);
    expect(motion.steps).toBeGreaterThan(3);
    await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
    await speed.click();
  }
  await expect(speed).toHaveText('Speed: Normal');
});

test('autospin offers every count, runs exactly ten paid spins and locks manual controls', async ({ page }) => {
  test.setTimeout(30000);
  await forceStops(page, [0, 0, 0, 0, 0]);
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await expect(page.getByRole('button', { name: 'Spin speed' })).toContainText('Turbo');
  const counts = page.getByRole('combobox', { name: 'Autospin count' });
  expect(await counts.locator('option').evaluateAll(options => options.map(option => option.value))).toEqual([
    '10',
    '25',
    '50',
    '100',
    '250',
    '500'
  ]);
  await page.getByRole('button', { name: 'Start autospin' }).click();
  await expect(counts).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Change total bet' })).toBeDisabled();
  await page.locator('h1').click();
  await page.keyboard.press('Space');
  await expect(page.locator('.auto-message')).toHaveText('Autospin complete.', { timeout: 20000 });
  const payout = evaluateSpin(
    REELS.map(reel => reel.slice(0, 3)),
    10
  ).total;
  expect(await amount(page, 'credits')).toBe(1000 - 100 + 10 * payout);
  await expect(counts).toBeEnabled();
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
});

test('autospin can be stopped during a spin without starting another', async ({ page }) => {
  await forceStops(page, [0, 0, 0, 0, 0]);
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await page.getByRole('combobox', { name: 'Autospin count' }).selectOption('500');
  await page.getByRole('button', { name: 'Start autospin' }).click();
  await page.getByRole('button', { name: /Stop autospin/ }).click();
  await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    const start = performance.now();
    while (performance.now() - start < 1100) await new Promise(requestAnimationFrame);
  });
  const payout = evaluateSpin(
    REELS.map(reel => reel.slice(0, 3)),
    10
  ).total;
  expect(await amount(page, 'credits')).toBe(990 + payout);
  await expect(page.locator('.auto-message')).toContainText('Autospin stopped.');
});

test('autospin pauses for bonus selection and allows stopping inside the dialog', async ({ page }) => {
  await forceStops(
    page,
    REELS.map(reel => reel.indexOf('ivoris'))
  );
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await page.getByRole('button', { name: 'Start autospin' }).click();
  const award = page.getByRole('dialog');
  await expect(award).toBeVisible();
  await expect(page.locator('.playback-controls .auto-button')).toContainText('9 left');
  await award.getByRole('button', { name: /SPIN FOR SYMBOL/ }).click();
  await award.getByRole('button', { name: 'Stop selection' }).click();
  await expect(page.getByRole('heading', { name: '10 free spins remaining' })).toBeVisible();
  await award.getByRole('button', { name: 'Stop autospin', exact: true }).click();
  await award.getByRole('button', { name: 'Start free spins' }).click();
  await expect(page.getByRole('button', { name: 'FREE SPIN', exact: true })).toBeEnabled();
  await expect(page.locator('.auto-message')).toContainText('Autospin stopped.');
});

test('autospin resumes after selection and adds bonus spins beyond its paid count', async ({ page }) => {
  test.setTimeout(45000);
  await page.evaluate(
    stops => {
      let index = 0;
      Math.random = () => stops[index++] ?? 0;
    },
    [...Array(45).fill(0), ...REELS.map(reel => reel.indexOf('ivoris') / 24)]
  );
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await page.getByRole('button', { name: 'Start autospin' }).click();
  const award = page.getByRole('dialog');
  await expect(award).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.playback-controls .auto-button')).toContainText('0 left');
  await award.getByRole('button', { name: /SPIN FOR SYMBOL/ }).click();
  await award.getByRole('button', { name: 'Stop selection' }).click();
  await expect(page.getByRole('heading', { name: '10 free spins remaining' })).toBeVisible();
  await award.getByRole('button', { name: 'Start free spins' }).click();
  await expect(page.locator('.auto-message')).toHaveText('Autospin complete.', { timeout: 20000 });
  await expect(page.getByRole('status')).toContainText('Free spins complete');
  const ordinary = evaluateSpin(
    REELS.map(reel => reel.slice(0, 3)),
    10
  ).total;
  const scatter = evaluateSpin(
    REELS.map(reel => {
      const start = reel.indexOf('ivoris');
      return [reel[start], reel[(start + 1) % 24], reel[(start + 2) % 24]];
    }),
    10
  ).total;
  expect(await amount(page, 'credits')).toBe(900 + 19 * ordinary + scatter);
});

test('autospin stops when the next bet cannot be paid', async ({ page }) => {
  test.setTimeout(25000);
  // Find a deterministic non-winning grid without a bonus trigger.
  let stops = [0, 0, 0, 0, 0];
  for (let offset = 0; offset < 24; offset++) {
    const candidate = REELS.map((_, reel) => (offset + reel * 3) % 24);
    const grid = REELS.map((strip, reel) => [0, 1, 2].map(row => strip[(candidate[reel] + row) % 24]));
    if (evaluateSpin(grid, 100).total === 0) {
      stops = candidate;
      break;
    }
  }
  await forceStops(page, stops);
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Change total bet' }).click();
  await page.getByRole('button', { name: 'Spin speed' }).click({ clickCount: 2 });
  await page.getByRole('combobox', { name: 'Autospin count' }).selectOption('25');
  await page.getByRole('button', { name: 'Start autospin' }).click();
  await expect(page.locator('.auto-message')).toHaveText('Autospin stopped: not enough credits.', { timeout: 20000 });
  expect(await amount(page, 'credits')).toBe(0);
  await expect(page.getByRole('button', { name: 'Start autospin' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reset credits' })).toBeEnabled();
});

for (const size of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 844, height: 390 }
]) {
  test(`fullscreen scales the actual game at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.getByRole('button', { name: /Fullscreen/ }).click();
    await expect(page.locator('.gamba-page')).toHaveClass(/is-fullscreen/);
    const geometry = await page.locator('.slot-cabinet').evaluate(element => {
      const cabinet = element.getBoundingClientRect();
      const reel = element.querySelector('.reel')!.getBoundingClientRect();
      const cell = element.querySelector('.symbol-cell')!.getBoundingClientRect();
      const controls = element.querySelector('.playback-controls')!.getBoundingClientRect();
      return {
        width: cabinet.width / innerWidth,
        height: cabinet.height / innerHeight,
        reelHeight: reel.height / innerHeight,
        rowRatio: (cell.height * 3) / reel.height,
        bottom: controls.bottom,
        viewport: innerHeight
      };
    });
    expect(geometry.width).toBeGreaterThan(0.9);
    expect(geometry.height).toBeGreaterThan(0.8);
    expect(geometry.reelHeight).toBeGreaterThan(0.3);
    expect(geometry.rowRatio).toBeCloseTo(1, 1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport);
    await forceStops(page, [0, 0, 0, 0, 0]);
    await page.getByRole('button', { name: 'SPIN', exact: true }).click();
    await expect(page.locator('.moving-strip')).toHaveCount(5);
    const rowRatio = await page
      .locator('.reel')
      .first()
      .evaluate(
        element =>
          (element.querySelector('.strip-symbol')!.getBoundingClientRect().height * 3) /
          element.getBoundingClientRect().height
      );
    expect(rowRatio).toBeCloseTo(1, 1);
    await expect(page.getByRole('button', { name: 'SPIN', exact: true })).toBeEnabled();
    await forceStops(
      page,
      REELS.map(reel => reel.indexOf('ivoris'))
    );
    await page.getByRole('button', { name: 'SPIN', exact: true }).click();
    const award = page.getByRole('dialog');
    await award.getByRole('button', { name: /SPIN FOR SYMBOL/ }).click();
    await award.getByRole('button', { name: 'Stop selection' }).click();
    await award.getByRole('button', { name: 'Start free spins' }).click();
    await expect(page.locator('.bonus-dashboard')).toBeVisible();
    const bonusLayout = await page.locator('.slot-cabinet').evaluate(element => ({
      bottom: element.querySelector('.playback-controls')!.getBoundingClientRect().bottom,
      reelHeight: element.querySelector('.reel')!.getBoundingClientRect().height,
      viewport: innerHeight
    }));
    expect(bonusLayout.bottom).toBeLessThanOrEqual(bonusLayout.viewport);
    expect(bonusLayout.reelHeight).toBeGreaterThan(60);
    await page.getByRole('button', { name: /Exit fullscreen/ }).click();
  });
}
