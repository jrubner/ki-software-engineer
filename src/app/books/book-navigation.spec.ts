import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatTooltipHarness } from '@angular/material/tooltip/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { Book } from './book';

const book: Book = {
  id: 'database-id',
  isbn: '978-route-isbn',
  title: 'A routed book',
  author: 'Author',
  publisher: '',
  numPages: 1,
  price: '',
  cover: '',
  abstract: '',
  userId: 1
};

describe('Book feature navigation', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('reading-list:v1');
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('reading-list:v1');
  });

  it('opens the create form directly before ISBN matching, and recreates it on return', async () => {
    const harness = await RouterTestingHarness.create('/books/new');
    expect(harness.routeNativeElement?.querySelector('#create-isbn')).not.toBeNull();
    http.expectNone('http://localhost:4730/books/new');
    await harness.navigateByUrl('/books/978-route-isbn');
    http.expectOne('http://localhost:4730/books/978-route-isbn').flush(book);
    await harness.navigateByUrl('/books/new');
    expect(harness.routeNativeElement?.querySelector('#create-isbn')).not.toBeNull();
  });

  it('adds from detail once and opens the lazy board with refreshed metadata', async () => {
    const harness = await RouterTestingHarness.create(`/books/${book.isbn}`);
    http.expectOne(`http://localhost:4730/books/${book.isbn}`).flush(book);
    harness.detectChanges();
    const add = Array.from(harness.routeNativeElement!.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Add to reading list')
    );
    expect(add, 'detail reading-list action').toBeDefined();
    add!.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('In reading list');
    await harness.navigateByUrl('/reading-list');
    http.expectOne(`http://localhost:4730/books/${book.isbn}`).flush({ ...book, title: 'Refreshed title' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Want to read');
    expect(harness.routeNativeElement?.textContent).toContain('Refreshed title');
    expect(harness.routeNativeElement?.querySelector('a[href="/books/978-route-isbn"]')).not.toBeNull();
    http.expectNone(request => request.method !== 'GET');
  });

  it('toggles membership from the same detail button and keeps removal after navigation', async () => {
    const harness = await RouterTestingHarness.create(`/books/${book.isbn}`);
    http.expectOne(`http://localhost:4730/books/${book.isbn}`).flush(book);
    harness.detectChanges();
    const button = harness.routeNativeElement!.querySelector<HTMLButtonElement>('.detail-action-primary')!;
    button.click();
    harness.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Remove from reading list');
    const loader = TestbedHarnessEnvironment.loader(harness.fixture);
    const tooltip = await loader.getHarness(MatTooltipHarness.with({ selector: '.detail-action-primary' }));
    await tooltip.show();
    expect(await tooltip.getTooltipText()).toBe('Remove this book from your reading list');
    await tooltip.hide();
    button.click();
    harness.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent).toContain('Add to reading list');
    expect(JSON.parse(localStorage.getItem('reading-list:v1')!).entries).toEqual([]);
    await harness.navigateByUrl('/reading-list');
    http.expectNone(`http://localhost:4730/books/${book.isbn}`);
    expect(harness.routeNativeElement?.querySelector('a[href="/books/978-route-isbn"]')).toBeNull();
    http.expectNone(request => request.method !== 'GET');
  });

  it('groups detail actions with named links, decorative icons and explanatory tooltips', async () => {
    const harness = await RouterTestingHarness.create(`/books/${book.isbn}`);
    http.expectOne(`http://localhost:4730/books/${book.isbn}`).flush(book);
    harness.detectChanges();

    const actions = harness.routeNativeElement!.querySelector('[role="group"][aria-label="Book actions"]')!;
    expect(actions.querySelector('a[href="/books/978-route-isbn/edit"]')?.textContent).toContain('Edit book');
    expect(actions.querySelector('a[href="/reading-list"]')?.textContent).toContain('Open reading list');
    expect(actions.querySelectorAll('svg[aria-hidden="true"]').length).toBe(3);

    const loader = TestbedHarnessEnvironment.loader(harness.fixture);
    const tooltips = await loader.getAllHarnesses(MatTooltipHarness);
    expect(tooltips.length).toBe(3);
    await tooltips[0].show();
    expect(await tooltips[0].getTooltipText()).toBe("Edit this book's details");
    await tooltips[0].hide();
    await tooltips[1].show();
    expect(await tooltips[1].getTooltipText()).toBe('Save this book to Want to read');
    await tooltips[1].hide();
    await tooltips[2].show();
    expect(await tooltips[2].getTooltipText()).toBe('Open your reading board');
    await tooltips[2].hide();
  });
});
