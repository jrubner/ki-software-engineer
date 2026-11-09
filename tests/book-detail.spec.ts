import { expect, Page, test } from '@playwright/test';

const appUrl = 'http://localhost:4200';
const apiUrl = 'http://localhost:4730/books';
const book = {
  id: 'technical-id',
  isbn: '9780000000001',
  title: 'A Book About Angular',
  subtitle: 'Practical examples',
  author: 'Alex Reader',
  publisher: 'Workshop Press',
  numPages: 240,
  price: '$19.95',
  cover: '',
  abstract: 'A description with <script>literal text</script>.',
  userId: 42,
  publishedAt: '2024-01-15',
  coAuthors: ['Sam Writer', 'Robin Editor']
};
const secondBook = { ...book, id: 'other-id', isbn: '9780000000002', title: 'Another Angular Book' };

async function mockBooks(page: Page) {
  await page.route(
    url => url.origin === 'http://localhost:4730' && /^\/books(?:\/|$)/.test(url.pathname),
    async route => {
      const url = new URL(route.request().url());
      const result = url.pathname === '/books' ? [book] : url.pathname.endsWith(secondBook.isbn) ? secondBook : book;
      await route.fulfill({ json: result });
    }
  );
}

async function navigateToBook(page: Page, isbn: string) {
  // Exercise an in-document history navigation so Angular reuses the detail component.
  await page.evaluate(path => {
    history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, `/books/${isbn}`);
}

test('list links use ISBN, support keyboard navigation, and return to the collection', async ({ page }) => {
  await mockBooks(page);
  await page.goto(appUrl);
  const link = page.getByRole('link', { name: book.title, exact: true });
  await expect(link).toHaveAttribute('href', `/books/${book.isbn}`);
  await page.getByRole('textbox').focus();
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  const request = page.waitForRequest(`${apiUrl}/${book.isbn}`);
  await page.keyboard.press('Enter');
  await request;
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await expect(page.getByText(book.price, { exact: true })).toBeVisible();
  await expect(page.getByText(book.abstract, { exact: true })).toBeVisible();
  await expect(page.getByText('Sam Writer, Robin Editor', { exact: true })).toBeVisible();
  await expect(page.getByText(book.publishedAt, { exact: true })).toBeVisible();
  const back = page.getByRole('link', { name: 'Back to book collection' });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${appUrl}/`);
  await expect(link).toBeVisible();
  // The cover area, away from the title text, is part of the same accessible link.
  await link.click({ position: { x: 10, y: 10 } });
  await expect(page).toHaveURL(`${appUrl}/books/${book.isbn}`);
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
});

test('direct URL and reload work without loading the list', async ({ page }) => {
  let listRequests = 0;
  await mockBooks(page);
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/books') listRequests++;
  });
  await page.goto(`${appUrl}/books/${book.isbn}`);
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  expect(listRequests).toBe(0);
  await page.getByRole('link', { name: 'Back to book collection' }).click();
  await expect(page.getByRole('heading', { name: 'Book Collection', exact: true })).toBeVisible();
});

test('shows loading until the detail response arrives', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  await page.route(`${apiUrl}/${book.isbn}`, async route => {
    await gate;
    await route.fulfill({ json: book });
  });
  await page.goto(`${appUrl}/books/${book.isbn}`);
  await expect(page.getByRole('status')).toHaveText('Loading book...');
  await expect(page.getByRole('link', { name: 'Back to book collection' })).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
});

for (const failure of ['404', '500', 'network'] as const) {
  test(`handles ${failure} and recovers on a route parameter change`, async ({ page }) => {
    await mockBooks(page);
    await page.route(`${apiUrl}/missing`, async route => {
      if (failure === 'network') await route.abort('failed');
      else await route.fulfill({ status: Number(failure), json: {} });
    });
    await page.goto(`${appUrl}/books/missing`);
    await expect(
      page.getByRole('heading', { name: failure === '404' ? 'Book not found' : 'Unable to load book' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to book collection' })).toHaveAttribute('href', '/');
    await navigateToBook(page, book.isbn);
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Book not found|Unable to load book/ })).toHaveCount(0);
  });
}

test('omits optional data and falls back when a cover cannot load', async ({ page }) => {
  await page.route(`${apiUrl}/${book.isbn}`, route =>
    route.fulfill({
      json: {
        ...book,
        subtitle: undefined,
        publishedAt: undefined,
        coAuthors: undefined,
        cover: `${appUrl}/broken-cover.png`
      }
    })
  );
  await page.route('**/broken-cover.png', route => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${appUrl}/books/${book.isbn}`);
  await expect(page.getByText('No cover available', { exact: true })).toBeVisible();
  await expect(page.locator('dt', { hasText: /Published|Co-authors/ })).toHaveCount(0);
  await expect(page.getByText(book.subtitle, { exact: true })).toHaveCount(0);
  await expect(page.locator('article')).not.toContainText(/undefined|null/);
});

test('parameter changes discard stale requests and reset cover state', async ({ page }) => {
  await mockBooks(page);
  const cover = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  await page.route(`${apiUrl}/${secondBook.isbn}`, route => route.fulfill({ json: { ...secondBook, cover } }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  const started = page.waitForRequest(`${apiUrl}/slow`);
  await page.route(`${apiUrl}/slow`, async route => {
    await gate;
    try {
      await route.fulfill({ json: { ...book, title: 'Stale response' } });
    } catch {
      /* The client may have cancelled the request. */
    }
  });
  await page.goto(`${appUrl}/books/${book.isbn}`);
  await expect(page.getByText('No cover available', { exact: true })).toBeVisible();
  await navigateToBook(page, 'slow');
  await started;
  await expect(page.getByRole('status')).toHaveText('Loading book...');
  await expect(page.locator('article')).toHaveCount(0);
  const cancelled = page.waitForEvent('requestfailed', request => request.url() === `${apiUrl}/slow`);
  await navigateToBook(page, secondBook.isbn);
  await cancelled;
  await expect(page.getByRole('heading', { name: secondBook.title, exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('img', { name: secondBook.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stale response' })).toHaveCount(0);
});

test('search and wildcard routing still work and mobile detail has no horizontal overflow', async ({ page }) => {
  await mockBooks(page);
  await page.goto(`${appUrl}/unknown-path`);
  await expect(page).toHaveURL(`${appUrl}/`);
  const search = page.waitForRequest(request => request.url().includes('q=Angular'));
  await page.getByRole('textbox').fill('Angular');
  await search;
  await page.getByRole('link', { name: book.title, exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
