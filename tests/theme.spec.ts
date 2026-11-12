import { expect, test } from '@playwright/test';

const appUrl = 'http://localhost:4200';

test.beforeEach(async ({ context }) => {
  await context.route('http://localhost:4730/books?**', route => route.fulfill({ json: [] }));
});

test('system default is used until the toggle stores an explicit choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(appUrl);
  const theme = page.getByRole('button', { name: 'Dark mode', exact: true });
  const root = page.locator('html');
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
  await expect(theme.locator('.theme-icon').last()).toHaveClass(/theme-icon-active/);
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(theme).toHaveAttribute('aria-pressed', 'false');
  await expect(theme.locator('.theme-icon').first()).toHaveClass(/theme-icon-active/);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Color theme' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bookmonkey-theme'))).toBeNull();
  await theme.focus();
  await page.keyboard.press('Space');
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('bookmonkey-theme'))).toBe('dark');
  await theme.focus();
  await page.keyboard.press('Enter');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(theme).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('bookmonkey-theme'))).toBe('light');
});

test('stored theme applies before Angular starts', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('bookmonkey-theme', 'dark'));
  await page.route('**/main.js', route => route.abort());
  await page.goto(appUrl);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('app-root')).toBeEmpty();
});

test('toggle animates its marker, adds only a hover shadow, and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto(appUrl);
  const theme = page.getByRole('button', { name: 'Dark mode', exact: true });
  await theme.hover();
  await expect(theme).toHaveCSS('border-top-width', '0px');
  await expect(theme).toHaveCSS('outline-style', 'none');
  await expect(theme).not.toHaveCSS('box-shadow', 'none');
  await expect(theme).toHaveCSS('transform', 'none');

  for (const pressed of ['true', 'false']) {
    const markerX = await theme.evaluate(
      element =>
        new Promise<number>(resolve => {
          const onTransition = (event: Event) => {
            const transition = event as TransitionEvent;
            if (transition.pseudoElement !== '::before' || transition.propertyName !== 'transform') return;
            element.removeEventListener('transitionrun', onTransition);
            const animation = element.getAnimations({ subtree: true }).find(animation => {
              const effect = animation.effect as KeyframeEffect & { pseudoElement?: string };
              return (
                effect.pseudoElement === '::before' &&
                animation instanceof CSSTransition &&
                animation.transitionProperty === 'transform'
              );
            })!;
            animation.pause();
            animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
            resolve(new DOMMatrix(getComputedStyle(element, '::before').transform).m41);
            animation.play();
          };
          element.addEventListener('transitionrun', onTransition);
          (element as HTMLButtonElement).click();
        })
    );
    expect(markerX).toBeGreaterThan(0);
    expect(markerX).toBeLessThan(40);
    await expect(theme).toHaveAttribute('aria-pressed', pressed);
    await expect
      .poll(() => theme.evaluate(element => new DOMMatrix(getComputedStyle(element, '::before').transform).m41))
      .toBe(pressed === 'true' ? 40 : 0);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await theme.evaluate(element => parseFloat(getComputedStyle(element, '::before').transitionDuration))
  ).toBeLessThanOrEqual(0.01);
  await expect(theme.locator('svg').first()).toHaveCSS('transition-property', 'none');
  await theme.click();
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`light and dark colors interpolate in both directions with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion });
    await page.goto(appUrl);
    const theme = page.getByRole('button', { name: 'Dark mode', exact: true });
    const surfaces = page.locator('body, header, footer');
    const colors = () =>
      surfaces.evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor));

    for (const target of ['rgb(2, 6, 23)', 'rgb(226, 232, 240)']) {
      const before = await colors();
      const middle = await theme.evaluate(
        button =>
          new Promise<string[]>(resolve => {
            const body = document.body;
            const onTransition = (event: Event) => {
              const transition = event as TransitionEvent;
              if (event.target !== body || transition.propertyName !== 'background-color') return;
              body.removeEventListener('transitionrun', onTransition);
              const surfaces = [body, document.querySelector('header')!, document.querySelector('footer')!];
              const animations = surfaces.flatMap(element =>
                element
                  .getAnimations()
                  .filter(
                    animation =>
                      animation instanceof CSSTransition && animation.transitionProperty === 'background-color'
                  )
              );
              for (const animation of animations) {
                animation.pause();
                animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
              }
              resolve(surfaces.map(element => getComputedStyle(element).backgroundColor));
              for (const animation of animations) animation.play();
            };
            body.addEventListener('transitionrun', onTransition);
            (button as HTMLButtonElement).click();
          })
      );
      await expect(page.locator('body')).toHaveCSS('background-color', target);
      const after = await colors();
      for (let index = 0; index < before.length; index++) {
        expect(middle[index]).not.toBe(before[index]);
        expect(middle[index]).not.toBe(after[index]);
      }
    }

    const durations = await page.locator('body').evaluate(element =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .map(value => parseFloat(value))
    );
    expect(durations.every(duration => duration === (reducedMotion === 'reduce' ? 0.18 : 0.24))).toBe(true);
  });
}

test('theme selection stays synchronized between tabs', async ({ page, context }) => {
  await page.goto(appUrl);
  const other = await context.newPage();
  await other.goto(appUrl);
  await page.emulateMedia({ colorScheme: 'light' });
  await other.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('blocked storage still allows switching themes without application errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Object.defineProperty(Storage.prototype, method, {
        value: () => {
          throw new DOMException('Storage unavailable', 'SecurityError');
        }
      });
    }
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(appUrl);
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});
