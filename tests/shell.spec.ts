import { expect, Page, test } from '@playwright/test';

const appUrl = 'http://localhost:4200';
const book = {
  id: 'technical-id',
  isbn: '9780000000001',
  title: 'A Book About Scrolling',
  author: 'Alex Reader',
  publisher: 'Workshop Press',
  numPages: 240,
  price: '$19.95',
  cover: '',
  abstract: 'A useful description.',
  userId: 42
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route(
    url => url.origin === 'http://localhost:4730' && url.pathname.startsWith('/books'),
    route =>
      route.fulfill({
        json:
          new URL(route.request().url()).pathname === '/books'
            ? Array.from({ length: 24 }, (_, index) => ({
                ...book,
                id: String(index),
                isbn: String(index),
                title: `${book.title} ${index}`
              }))
            : book
      })
  );
  await page.goto(appUrl);
  await expect(page.getByRole('heading', { name: 'Book Collection', exact: true })).toBeVisible();
  await page.mouse.move(500, 400);
});

async function scrollTo(page: Page, position: number) {
  await page.evaluate(y => window.scrollTo(0, y), position);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(position);
}

async function expectHeaderOnscreen(page: Page) {
  await expect
    .poll(() => page.getByRole('banner').evaluate(element => Math.round(element.getBoundingClientRect().top)))
    .toBe(0);
}

async function expectHeaderHidden(page: Page) {
  await expect
    .poll(() =>
      page.getByRole('banner').evaluate(element => {
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().bottom <= 1 || Number(style.opacity) === 0;
      })
    )
    .toBe(true);
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`header interpolates hide and reveal with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    for (const reveal of [false, true]) {
      const sample = await page.getByRole('banner').evaluate(
        (element, { reveal, reducedMotion }) =>
          new Promise<{ opacity: number; top: number; height: number }>(resolve => {
            element.addEventListener(
              'transitionrun',
              () => {
                const animation = element.getAnimations()[0];
                animation.pause();
                animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
                const bounds = element.getBoundingClientRect();
                const sample = {
                  opacity: Number(getComputedStyle(element).opacity),
                  top: bounds.top,
                  height: bounds.height
                };
                animation.play();
                resolve(sample);
              },
              { once: true }
            );
            if (reveal) {
              window.dispatchEvent(new PointerEvent('pointermove', { clientX: 600, clientY: 4, pointerType: 'mouse' }));
            } else {
              window.scrollTo(0, 500);
            }
          }),
        { reveal, reducedMotion }
      );
      if (reducedMotion === 'reduce') {
        expect(sample.top).toBe(0);
        expect(sample.opacity).toBeGreaterThan(0);
        expect(sample.opacity).toBeLessThan(1);
      } else {
        expect(sample.top).toBeLessThan(0);
        expect(sample.top).toBeGreaterThan(-sample.height);
        expect(sample.opacity).toBe(1);
      }
      if (reveal) await expectHeaderOnscreen(page);
      else await expectHeaderHidden(page);
      await expect(page.getByRole('banner')).toHaveCSS(
        'opacity',
        reveal || reducedMotion === 'no-preference' ? '1' : '0'
      );
    }
  });
}

test('header initially overlaps content, hides downward, and returns upward or at the top edge', async ({ page }) => {
  const mainTop = await page.getByRole('main').evaluate(element => element.getBoundingClientRect().top + scrollY);
  await scrollTo(page, 100);
  await expectHeaderOnscreen(page);
  const headerBottom = await page.getByRole('banner').evaluate(element => element.getBoundingClientRect().bottom);
  expect(await page.getByRole('main').evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(
    headerBottom
  );
  await scrollTo(page, 500);
  await expectHeaderHidden(page);
  await scrollTo(page, 450);
  await expectHeaderOnscreen(page);
  await scrollTo(page, 600);
  await expectHeaderHidden(page);
  await page.mouse.move(600, 4);
  await expectHeaderOnscreen(page);
  await page.mouse.move(600, 35);
  await scrollTo(page, 700);
  await expectHeaderOnscreen(page);
  expect(await page.getByRole('main').evaluate(element => element.getBoundingClientRect().top + scrollY)).toBe(mainTop);
});

test('hover reveal closes on pointer exit without scrolling and stays available near the page top', async ({
  page
}) => {
  await scrollTo(page, 500);
  await expectHeaderHidden(page);
  await page.mouse.move(600, 4);
  await expectHeaderOnscreen(page);
  await page.mouse.move(600, 35);
  await page.mouse.move(600, 300);
  await expectHeaderHidden(page);
  expect(await page.evaluate(() => scrollY)).toBe(500);
  await page.mouse.move(600, 4);
  await page.mouse.move(600, 300);
  await expectHeaderHidden(page);
  await scrollTo(page, 100);
  await page.mouse.move(600, 35);
  await page.mouse.move(600, 300);
  await expectHeaderOnscreen(page);
});

test('keyboard focus keeps a hovered header open until focus leaves it', async ({ page }) => {
  await scrollTo(page, 500);
  await expectHeaderHidden(page);
  await page.mouse.move(600, 4);
  await expectHeaderOnscreen(page);
  await page
    .getByRole('combobox', { name: 'Color theme' })
    .evaluate(element => (element as HTMLElement).focus({ preventScroll: true }));
  await page.mouse.move(600, 300);
  await expectHeaderOnscreen(page);
  await page.getByRole('textbox').evaluate(element => (element as HTMLElement).focus({ preventScroll: true }));
  await expectHeaderHidden(page);
});

test('keyboard focus reveals the hidden header and route changes keep navigation available', async ({ page }) => {
  await scrollTo(page, 500);
  await expectHeaderHidden(page);
  await page.getByRole('textbox').evaluate(element => (element as HTMLInputElement).focus({ preventScroll: true }));
  await expectHeaderHidden(page);
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('combobox', { name: 'Color theme' })).toBeFocused();
  await expectHeaderOnscreen(page);
  await page.getByRole('link', { name: 'BookMonkey home' }).click();
  await expectHeaderOnscreen(page);
  await page.getByRole('link', { name: `${book.title} 0`, exact: true }).click();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await expectHeaderOnscreen(page);
});

test('mobile scroll and reduced motion preserve access without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await scrollTo(page, 500);
  await expectHeaderHidden(page);
  await scrollTo(page, 450);
  await expectHeaderOnscreen(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(
    await page.getByRole('banner').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))
  ).toBeLessThanOrEqual(0.12);
});

test('footer follows long content and sits at the viewport bottom on short pages', async ({ page }) => {
  const footer = page.getByRole('contentinfo');
  expect(await footer.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThan(720);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(footer).toBeInViewport();
  await page.goto(`${appUrl}/books/9780000000001`);
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect
    .poll(() => footer.evaluate(element => Math.round(element.getBoundingClientRect().bottom) - innerHeight))
    .toBe(0);
});
