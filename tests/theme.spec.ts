import { expect, test } from '@playwright/test';

const appUrl = 'http://localhost:4200';

test.beforeEach(async ({ context }) => {
  await context.route('http://localhost:4730/books?**', route => route.fulfill({ json: [] }));
});

test('system theme follows live changes, while explicit choices persist across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(appUrl);
  const theme = page.getByRole('combobox', { name: 'Color theme' });
  const root = page.locator('html');
  await expect(theme).toHaveValue('system');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await theme.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(theme).toHaveValue('dark');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(theme).toHaveValue('dark');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await theme.selectOption('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await theme.selectOption('system');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('bookmonkey-theme'))).toBeNull();
});

test('stored theme applies before Angular starts', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('bookmonkey-theme', 'dark'));
  await page.route('**/main.js', route => route.abort());
  await page.goto(appUrl);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('app-root')).toBeEmpty();
});

test('theme selection stays synchronized between tabs', async ({ page, context }) => {
  await page.goto(appUrl);
  const other = await context.newPage();
  await other.goto(appUrl);
  await page.getByRole('combobox', { name: 'Color theme' }).selectOption('dark');
  await expect(other.getByRole('combobox', { name: 'Color theme' })).toHaveValue('dark');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.getByRole('combobox', { name: 'Color theme' }).selectOption('system');
  await expect(page.getByRole('combobox', { name: 'Color theme' })).toHaveValue('system');
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
  await page.getByRole('combobox', { name: 'Color theme' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});
