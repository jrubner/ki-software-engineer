import { expect, Page, Route, test } from '@playwright/test';

const appUrl = 'http://localhost:4200';
const apiUrl = 'http://localhost:4730/books';
const books = Array.from({ length: 21 }, (_, index) => ({
  id: `technical-id-${index + 1}`,
  isbn: `978000000${String(index + 1).padStart(4, '0')}`,
  title: `Collection Book ${index + 1}`,
  author: 'Alex Reader',
  subtitle: '',
  publisher: 'Workshop Press',
  numPages: 120,
  price: '12.00',
  cover: '',
  abstract: '',
  userId: 1,
  coAuthors: []
}));

async function respond(route: Route, result = books.slice(0, 10), totalCount = books.length) {
  await route.fulfill({
    json: result,
    headers: { 'X-Total-Count': String(totalCount), 'Access-Control-Expose-Headers': 'X-Total-Count' }
  });
}

async function mockCollection(page: Page, handler: (route: Route, url: URL) => Promise<void>) {
  await page.route(
    url => url.origin === 'http://localhost:4730',
    async route => {
      const url = new URL(route.request().url());
      expect(url.pathname).toBe('/books');
      expect(route.request().method()).toBe('GET');
      expect(url.searchParams.get('_limit')).toBe('10');
      await handler(route, url);
    }
  );
}

function cards(page: Page) {
  return page.getByRole('main').getByRole('link', { name: /^Collection Book / });
}

test.describe('Book collection', () => {
  test('given multiple books, opening the collection renders the first page and ISBN links', async ({ page }) => {
    await mockCollection(page, async (route, url) => {
      expect(url.searchParams.get('_page')).toBe('1');
      expect(url.searchParams.has('q')).toBe(false);
      await respond(route);
    });
    await page.goto(appUrl);

    await expect(cards(page)).toHaveCount(10);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(books.slice(0, 10).map(book => book.title));
    await expect(cards(page).first()).toHaveAttribute('href', `/books/${books[0].isbn}`);
    const pagination = page.getByRole('navigation', { name: 'Book collection pages' });
    await expect(pagination).toContainText('21 books');
    await expect(pagination).toContainText('Page 1 of 3');
    await expect(pagination.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
    await expect(pagination.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  });

  test('given a pending next page, paging hides stale cards and locks navigation until the response', async ({
    page
  }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    await mockCollection(page, async (route, url) => {
      if (url.searchParams.get('_page') === '2') {
        await gate;
        await respond(route, [books[10]], 11);
      } else await respond(route, books.slice(0, 10), 11);
    });
    await page.goto(appUrl);
    await expect(cards(page)).toHaveCount(10);
    const next = page.getByRole('button', { name: 'Next', exact: true });
    const previous = page.getByRole('button', { name: 'Previous', exact: true });
    try {
      await next.click();
      await expect(page.getByRole('status')).toHaveText('Loading books...');
      await expect(cards(page)).toHaveCount(0);
      await expect(next).toBeDisabled();
      await expect(previous).toBeDisabled();
    } finally {
      release();
    }
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toHaveAccessibleName(books[10].title);
    await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
    await expect(next).toBeDisabled();
    await previous.click();
    await expect(cards(page)).toHaveCount(10);
    await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  });

  test('given page two, typing a search debounces, resets the page and retains the query while paging', async ({
    page
  }) => {
    await page.clock.install();
    const requests: URLSearchParams[] = [];
    await mockCollection(page, async (route, url) => {
      requests.push(url.searchParams);
      const secondPage = url.searchParams.get('_page') === '2';
      const searching = url.searchParams.get('q') === 'Collection';
      await respond(route, secondPage ? [books[10]] : books.slice(0, 10), searching ? 11 : 21);
    });
    await page.goto(appUrl);
    await expect(cards(page)).toHaveCount(10);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const search = page.getByRole('textbox', { name: 'Search the collection' });
    await search.fill('Col');
    await page.clock.runFor(200);
    await search.fill('Collection');
    await page.clock.runFor(299);
    expect(requests).toHaveLength(2);
    await page.clock.runFor(1);
    await page.clock.resume();
    await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(10);
    expect(requests.at(-1)?.get('q')).toBe('Collection');
    expect(requests.at(-1)?.get('_page')).toBe('1');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toHaveAccessibleName(books[10].title);
    expect(requests.at(-1)?.get('q')).toBe('Collection');
    expect(requests.at(-1)?.get('_page')).toBe('2');
  });

  for (const clearWith of ['empty input', 'clear button'] as const) {
    test(`given filtered results, clearing with ${clearWith} restores the unfiltered first page`, async ({ page }) => {
      const requests: URLSearchParams[] = [];
      await mockCollection(page, async (route, url) => {
        requests.push(url.searchParams);
        if (url.searchParams.has('q')) await respond(route, [books[20]], 1);
        else await respond(route);
      });
      await page.goto(appUrl);
      await expect(cards(page)).toHaveCount(10);
      const search = page.getByRole('textbox', { name: 'Search the collection' });
      await search.fill(books[20].title);
      await expect(cards(page)).toHaveCount(1);
      await expect(cards(page)).toHaveAccessibleName(books[20].title);
      if (clearWith === 'empty input') await search.fill('');
      else await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await expect(search).toHaveValue('');
      await expect(cards(page)).toHaveCount(10);
      await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
      expect(requests.at(-1)?.has('q')).toBe(false);
      expect(requests.at(-1)?.get('_page')).toBe('1');
    });
  }

  test('given an empty collection, opening it shows the empty state and an add-book link', async ({ page }) => {
    await mockCollection(page, route => respond(route, [], 0));
    await page.goto(appUrl);
    await expect(page.getByRole('status')).toContainText('No books available');
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: 'Add book', exact: true })).toHaveAttribute(
      'href',
      '/books/new'
    );
    await expect(page.getByRole('navigation', { name: 'Book collection pages' })).toContainText('0 books');
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  });

  test('given no matching books, searching shows a distinct empty state and clearing recovers', async ({ page }) => {
    await mockCollection(page, async (route, url) => {
      if (url.searchParams.has('q')) await respond(route, [], 0);
      else await respond(route);
    });
    await page.goto(appUrl);
    await expect(cards(page)).toHaveCount(10);
    await page.getByRole('textbox', { name: 'Search the collection' }).fill('No matching title');
    await expect(page.getByRole('status')).toContainText('No books match your search');
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear Search', exact: true }).click();
    await expect(cards(page)).toHaveCount(10);
    await expect(page.getByRole('textbox', { name: 'Search the collection' })).toHaveValue('');
  });

  for (const failure of ['500', 'network', 'missing total count'] as const) {
    test(`given a ${failure} failure on a filtered page, retry retains page and search and renders results`, async ({
      page
    }) => {
      let failed = false;
      const attempts: string[] = [];
      await mockCollection(page, async (route, url) => {
        if (url.searchParams.has('q') && url.searchParams.get('_page') === '2') {
          attempts.push(url.search);
          if (!failed) {
            failed = true;
            if (failure === 'network') await route.abort('failed');
            else if (failure === '500') await route.fulfill({ status: 500, json: {} });
            else await route.fulfill({ json: [books[10]] });
            return;
          }
          await respond(route, [books[10]], 11);
        } else await respond(route, books.slice(0, 10), 11);
      });
      await page.goto(appUrl);
      await expect(cards(page)).toHaveCount(10);
      const filtered = page.waitForResponse(response => new URL(response.url()).searchParams.get('q') === 'Collection');
      await page.getByRole('textbox', { name: 'Search the collection' }).fill('Collection');
      await filtered;
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Could not load books');
      await expect(cards(page)).toHaveCount(0);
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await expect(cards(page)).toHaveCount(1);
      await expect(cards(page)).toHaveAccessibleName(books[10].title);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
      expect(attempts).toHaveLength(2);
      expect(attempts[1]).toBe(attempts[0]);
    });
  }
});
