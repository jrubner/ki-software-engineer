import { expect, Page, test } from '@playwright/test';

const appUrl = 'http://localhost:4200';
const apiUrl = 'http://localhost:4730/books';
const book = {
  id: 'different-technical-id',
  isbn: '9780000000001',
  userId: 42,
  title: 'Original title',
  subtitle: 'Original subtitle',
  author: 'Alex Reader',
  publisher: 'Workshop Press',
  numPages: 240,
  price: '$19.95',
  cover: '',
  abstract: 'Original description',
  publishedAt: '2024-01-15',
  coAuthors: ['Sam Writer', 'Robin Editor']
};

async function setup(page: Page) {
  let current = { ...book };
  const writes: (typeof book)[] = [];
  await page.route(`${apiUrl}/**`, async route => {
    if (route.request().method() === 'PUT') {
      current = route.request().postDataJSON();
      writes.push(current);
    }
    await route.fulfill({ json: current });
  });
  return writes;
}

test('AC1: opens the prefilled editor by keyboard, directly and after reload without list data', async ({ page }) => {
  await setup(page);
  let lists = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/books') lists++;
  });
  await page.goto(`${appUrl}/books/${book.isbn}`);
  const edit = page.getByRole('link', { name: 'Edit book', exact: true });
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${appUrl}/books/${book.isbn}/edit`);
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    for (const [label, value] of Object.entries({
      Title: book.title,
      Subtitle: book.subtitle,
      Author: book.author,
      Publisher: book.publisher,
      Pages: String(book.numPages),
      Price: book.price,
      'Cover URL': book.cover,
      Description: book.abstract,
      'Publication date': book.publishedAt,
      'Co-authors': book.coAuthors.join('\n')
    })) {
      await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
    }
  }
  await expect(page.getByLabel('ISBN', { exact: true })).toHaveCount(0);
  expect(lists).toBe(0);
});

test('AC2: saves all bibliographic fields once, preserves identity and locks actions until completion', async ({
  page
}) => {
  const writes = await setup(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  await page.route(`${apiUrl}/${book.isbn}`, async route => {
    if (route.request().method() !== 'PUT') return route.fallback();
    await gate;
    await route.fallback();
  });
  await page.goto(`${appUrl}/books/${book.isbn}/edit`);
  const values = {
    Title: 'Updated title',
    Subtitle: 'Updated subtitle',
    Author: 'New Author',
    Publisher: 'New Press',
    Pages: '123',
    Price: 'free text',
    'Cover URL': 'https://example.test/cover.png',
    Description: '<script>escaped text</script>',
    'Publication date': '2025-02-03',
    'Co-authors': ' First Writer \n\n Second Writer '
  };
  for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(value);
  const started = page.waitForRequest(request => request.method() === 'PUT');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await started;
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Saving/ })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Back to book collection' })).toHaveCount(0);
  await page.keyboard.press('Enter');
  release();
  await expect(page).toHaveURL(`${appUrl}/books/${book.isbn}`);
  await expect(page.getByRole('heading', { name: 'Updated title', exact: true })).toBeVisible();
  await expect(page.getByText(values.Description, { exact: true })).toBeVisible();
  expect(writes).toEqual([
    {
      ...book,
      title: values.Title,
      subtitle: values.Subtitle,
      author: values.Author,
      publisher: values.Publisher,
      numPages: 123,
      price: values.Price,
      cover: values['Cover URL'],
      abstract: values.Description,
      publishedAt: values['Publication date'],
      coAuthors: ['First Writer', 'Second Writer']
    }
  ]);
});

test('AC2: optional metadata can be removed', async ({ page }) => {
  const writes = await setup(page);
  await page.goto(`${appUrl}/books/${book.isbn}/edit`);
  for (const label of [
    'Subtitle',
    'Publisher',
    'Price',
    'Cover URL',
    'Description',
    'Publication date',
    'Co-authors'
  ]) {
    await page.getByLabel(label, { exact: true }).fill('');
  }
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(`${appUrl}/books/${book.isbn}`);
  const { publishedAt, ...withoutDate } = book;
  expect(writes).toEqual([
    { ...withoutDate, subtitle: '', publisher: '', price: '', cover: '', abstract: '', coAuthors: [] }
  ]);
});

for (const value of ['', '   ']) {
  test(`AC3: rejects blank title and author (${JSON.stringify(value)})`, async ({ page }) => {
    const writes = await setup(page);
    await page.goto(`${appUrl}/books/${book.isbn}/edit`);
    await page.getByLabel('Title', { exact: true }).fill(value);
    await page.getByLabel('Author', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Enter a title.', { exact: true })).toBeVisible();
    await expect(page.getByText('Enter an author.', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
  });
}

for (const value of ['', '0', '-1', '1.5']) {
  test(`AC3: rejects invalid pages (${JSON.stringify(value)})`, async ({ page }) => {
    const writes = await setup(page);
    await page.goto(`${appUrl}/books/${book.isbn}/edit`);
    await page.getByLabel('Pages', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Enter a positive whole number of pages.', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
  });
}

test('AC4: cancel discards changes without a write', async ({ page }) => {
  const writes = await setup(page);
  await page.goto(`${appUrl}/books/${book.isbn}/edit`);
  await page.getByLabel('Title', { exact: true }).fill('Discard me');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
});

for (const failure of [404, 500, 'network'] as const) {
  test(`AC5: load failure ${failure} retains collection link and recovers on parameter change`, async ({ page }) => {
    await setup(page);
    await page.route(`${apiUrl}/missing`, route =>
      failure === 'network' ? route.abort() : route.fulfill({ status: failure, json: {} })
    );
    await page.goto(`${appUrl}/books/missing/edit`);
    await expect(
      page.getByRole('heading', { name: failure === 404 ? 'Book not found' : 'Unable to load book' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to book collection' })).toHaveAttribute('href', '/');
    await page.evaluate(isbn => {
      history.pushState(null, '', `/books/${isbn}/edit`);
      dispatchEvent(new PopStateEvent('popstate'));
    }, book.isbn);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(book.title);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('AC5: failed save retains inputs and permits a retry', async ({ page }) => {
  const writes = await setup(page);
  let fail = true;
  await page.route(`${apiUrl}/${book.isbn}`, async route => {
    if (route.request().method() === 'PUT' && fail) {
      fail = false;
      await route.fulfill({ status: 500, json: {} });
    } else await route.fallback();
  });
  await page.goto(`${appUrl}/books/${book.isbn}/edit`);
  await page.getByLabel('Title', { exact: true }).fill('Retry title');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to save changes');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Retry title');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Retry title', exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
});

test('route changes cancel stale loads, clear edits and reset save errors', async ({ page }) => {
  await setup(page);
  await page.goto(`${appUrl}/books/${book.isbn}/edit`);
  await page.getByLabel('Title', { exact: true }).fill('Discard me');
  await page.route(`${apiUrl}/${book.isbn}`, route => route.fulfill({ status: 500, json: {} }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  await page.route(`${apiUrl}/slow`, async route => {
    await gate;
    await route.fulfill({ json: { ...book, title: 'Stale title' } }).catch(() => {});
  });
  const navigate = (isbn: string) =>
    page.evaluate(value => {
      history.pushState(null, '', `/books/${value}/edit`);
      dispatchEvent(new PopStateEvent('popstate'));
    }, isbn);
  await navigate('slow');
  await expect(page.getByRole('status')).toHaveText('Loading book...');
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const cancelled = page.waitForEvent('requestfailed', request => request.url() === `${apiUrl}/slow`);
  await navigate('second');
  await cancelled;
  release();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(book.title);
});

test('keyboard editing works in both themes and on mobile without overflow', async ({ page }) => {
  await setup(page);
  await page.goto(`${appUrl}/books/${book.isbn}/edit`);
  await page.getByLabel('Title', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Subtitle', { exact: true })).toBeFocused();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => (document.documentElement.dataset['theme'] = value), theme);
    for (const width of [1920, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
