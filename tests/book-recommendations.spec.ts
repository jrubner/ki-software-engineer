import { expect, Page, test } from '@playwright/test';

const appUrl = 'http://localhost:4200';
const cover = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const fixtures = Array.from({ length: 12 }, (_, index) => ({
  id: `internal-${index}`,
  isbn: `isbn-${index}`,
  title: `Editorial Book ${index}`,
  author: `Author ${index}`,
  cover,
  publisher: 'Workshop',
  numPages: 100,
  price: '$10',
  abstract: 'Book description',
  userId: 1,
  editorialRecommendation: index > 0 && index <= 4,
  editorialRecommendationOrder: index - 1
}));

async function mockApi(page: Page, options: { empty?: boolean; failSave?: boolean; failLoad?: boolean } = {}) {
  const books = fixtures.map(book => ({
    ...book,
    editorialRecommendation: options.empty ? false : book.editorialRecommendation
  }));
  const writes: Array<{ isbn: string; fields: object }> = [];
  let failSave = options.failSave;
  let failLoad = options.failLoad;
  await page.route('http://localhost:4730/books**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const isbn = decodeURIComponent(url.pathname.split('/')[2] ?? '');
    if (request.method() === 'PATCH') {
      if (failSave) {
        failSave = false;
        return route.fulfill({ status: 500, json: {} });
      }
      const book = books.find(book => book.isbn === isbn)!;
      const fields = request.postDataJSON();
      writes.push({ isbn, fields });
      Object.assign(book, fields);
      return route.fulfill({ json: book });
    }
    if (isbn) return route.fulfill({ json: books.find(book => book.isbn === isbn) });
    if (url.searchParams.has('editorialRecommendation_like')) {
      if (failLoad) {
        failLoad = false;
        return route.fulfill({ status: 500, json: {} });
      }
      return route.fulfill({ json: books.filter(book => book.editorialRecommendation) });
    }
    const search = url.searchParams.get('q')?.toLowerCase() ?? '';
    const matches = books.filter(book => `${book.title} ${book.author}`.toLowerCase().includes(search));
    const pageNumber = Number(url.searchParams.get('_page') ?? 1);
    const size = Number(url.searchParams.get('_limit') ?? 8);
    return route.fulfill({
      json: matches.slice((pageNumber - 1) * size, pageNumber * size),
      headers: { 'X-Total-Count': String(matches.length), 'Access-Control-Expose-Headers': 'X-Total-Count' }
    });
  });
  return { writes, books };
}

test('renders four editorial cards, excludes the current ISBN, and supports keyboard navigation and reload', async ({
  page
}) => {
  await mockApi(page);
  await page.goto(`${appUrl}/books/isbn-0`);
  const section = page.getByRole('region', { name: 'Empfehlungen der Redaktion' });
  await expect(section.getByRole('link', { name: /^Editorial Book/ })).toHaveCount(4);
  await expect(section.getByText('Author 1', { exact: true })).toBeVisible();
  const link = section.getByRole('link', { name: 'Editorial Book 1', exact: true });
  await expect(link).toHaveAttribute('href', '/books/isbn-1');
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editorial Book 1');
  await expect(section.getByRole('link', { name: /^Editorial Book/ })).toHaveCount(3);
  await expect(section.getByRole('link', { name: 'Editorial Book 1', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(section.getByRole('link', { name: /^Editorial Book/ })).toHaveCount(3);
});

test('dialog searches, pages, limits selection, saves only editorial fields and persists across reload', async ({
  page
}) => {
  const { writes, books } = await mockApi(page, { empty: true });
  await page.goto(`${appUrl}/editorial-recommendations`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Empfehlungen der Redaktion');
  await page.getByRole('button', { name: 'Add books', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose recommendations' });
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await dialog.getByRole('button', { name: 'Next results' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Recommend Editorial Book 8', exact: true })).toBeVisible();
  await dialog.getByRole('searchbox').fill('Author 1');
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  await dialog.getByRole('checkbox', { name: 'Recommend Editorial Book 10', exact: true }).check();
  await dialog.getByRole('searchbox').fill('');
  await expect(dialog.getByRole('checkbox')).toHaveCount(8);
  for (const index of [1, 2, 3])
    await dialog.getByRole('checkbox', { name: `Recommend Editorial Book ${index}`, exact: true }).check();
  await expect(dialog.getByRole('checkbox', { name: 'Recommend Editorial Book 4', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Save recommendations' }).click();
  await expect(dialog).not.toBeVisible();
  const section = page.getByRole('region', { name: 'Empfehlungen der Redaktion' });
  await expect(section.getByRole('link', { name: /^Editorial Book/ })).toHaveCount(4);
  expect(writes).toHaveLength(4);
  expect(writes[0]).toEqual({
    isbn: 'isbn-10',
    fields: { editorialRecommendation: true, editorialRecommendationOrder: 0 }
  });
  expect(books[10].id).toBe('internal-10');
  await page.reload();
  await expect(section.getByRole('link', { name: /^Editorial Book/ }).first()).toHaveAccessibleName(
    'Editorial Book 10'
  );
});

test('Escape cancels without writes, restores focus, and empty selections can be saved', async ({ page }) => {
  const { writes } = await mockApi(page);
  await page.goto(`${appUrl}/editorial-recommendations`);
  const trigger = page.getByRole('button', { name: 'Add books', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Remove Editorial Book 1', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toHaveLength(0);
  await trigger.click();
  for (const index of [1, 2, 3, 4])
    await dialog.getByRole('button', { name: `Remove Editorial Book ${index}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Save recommendations' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('No books selected yet.')).toBeVisible();
  expect(writes).toHaveLength(4);
  expect(writes.every(write => Object.values(write.fields).includes(false))).toBe(true);
});

test('load and save errors allow retry without losing the draft', async ({ page }) => {
  await mockApi(page, { failSave: true, failLoad: true });
  await page.goto(`${appUrl}/editorial-recommendations`);
  await page.getByRole('button', { name: 'Retry recommendations' }).click();
  await page.getByRole('button', { name: 'Add books', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Remove Editorial Book 1', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save recommendations' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Unable to finish saving');
  await expect(dialog.getByRole('button', { name: 'Remove Editorial Book 1', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save recommendations' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('region', { name: 'Empfehlungen der Redaktion' }).getByRole('link')).toHaveCount(3);
});

test('mobile and dark theme keep recommendations and dialog within the viewport', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}/books/isbn-0`);
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Empfehlungen der Redaktion' }).getByRole('link', { name: /^Editorial Book/ })
  ).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Manage recommendations', exact: true }).click();
  await expect(page).toHaveURL(`${appUrl}/editorial-recommendations`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Empfehlungen der Redaktion');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Add books', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('searchbox')).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('overview has its own route, is linked in navigation and reloads independently of book details', async ({
  page
}) => {
  await mockApi(page);
  const detailRequests: string[] = [];
  page.on('request', request => {
    if (/localhost:4730\/books\//.test(request.url())) detailRequests.push(request.url());
  });
  await page.goto(appUrl);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Recommendations', exact: true })
    .click();
  await expect(page).toHaveURL(`${appUrl}/editorial-recommendations`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Empfehlungen der Redaktion');
  const section = page.getByRole('region', { name: 'Empfehlungen der Redaktion' });
  await expect(section.getByRole('link', { name: /^Editorial Book/ })).toHaveCount(4);
  await page.reload();
  await expect(section.getByRole('link', { name: /^Editorial Book/ })).toHaveCount(4);
  expect(detailRequests).toEqual([]);
  await section.getByRole('link', { name: 'Editorial Book 1', exact: true }).click();
  await expect(page).toHaveURL(`${appUrl}/books/isbn-1`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editorial Book 1');
});
