import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { BookApiClient } from './book-api-client.service';
import { BookListComponent } from './book-list.component';
import { Book, BookPage } from './book';

describe('BookListComponent pagination', () => {
  let fixture: ComponentFixture<BookListComponent>;
  let api: MockedObject<Pick<BookApiClient, 'getBooks' | 'getBooksPage'>>;

  const book = (id: string, isbn = `isbn-${id}`): Book => ({
    id,
    isbn,
    userId: 1,
    title: `Book ${id}`,
    author: 'Author',
    publisher: '',
    numPages: 1,
    price: '10',
    cover: '',
    abstract: '',
    coAuthors: []
  });

  function page(books: Book[], totalCount: number): BookPage {
    return { books, totalCount };
  }

  function respond(request: Subject<BookPage>, books: Book[], totalCount: number): void {
    request.next(page(books, totalCount));
    request.complete();
    fixture.detectChanges();
  }

  function lastRequest(): Subject<BookPage> {
    return api.getBooksPage.mock.results.at(-1)!.value as Subject<BookPage>;
  }

  function button(name: string): HTMLButtonElement {
    const element = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')
    ).find(
      (candidate: HTMLButtonElement) =>
        candidate.textContent?.trim() === name || candidate.getAttribute('aria-label') === name
    );
    if (!element) throw new Error(`Button ${name} was not found`);
    return element;
  }

  beforeEach(async () => {
    api = {
      getBooks: vi.fn().mockName('BookApiClient.getBooks'),
      getBooksPage: vi.fn().mockName('BookApiClient.getBooksPage')
    };
    api.getBooks.mockReturnValue(of([]));
    api.getBooksPage.mockImplementation(() => new Subject<BookPage>());
    await TestBed.configureTestingModule({
      imports: [BookListComponent],
      providers: [provideRouter([]), { provide: BookApiClient, useValue: api }]
    }).compileComponents();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('loads the first page with the effective page size and shows the page controls and total', () => {
    expect(api.getBooksPage).toHaveBeenCalledTimes(1);
    expect(api.getBooksPage).toHaveBeenCalledWith(1, 10, undefined);
    const request = lastRequest();
    respond(request, [book('1')], 21);

    expect(fixture.nativeElement.textContent).toContain('Page 1 of 3');
    expect(fixture.nativeElement.textContent).toContain('21 books');
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(false);
  });

  it('navigates pages and disables navigation while loading and at the last page', () => {
    const first = lastRequest();
    respond(first, [book('first')], 20);
    button('Next').click();
    fixture.detectChanges();

    expect(api.getBooksPage).toHaveBeenCalledWith(2, 10, undefined);
    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Book first');

    const second = lastRequest();
    respond(second, [book('last')], 20);
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 2');
    expect(button('Previous').disabled).toBe(false);
    expect(button('Next').disabled).toBe(true);
    button('Previous').click();
    expect(api.getBooksPage).toHaveBeenCalledWith(1, 10, undefined);
  });

  it('uses the supplied page size for requests and page counts', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.componentRef.setInput('pageSize', 4);
    fixture.detectChanges();
    const request = lastRequest();

    expect(api.getBooksPage).toHaveBeenCalledWith(1, 4, undefined);
    respond(request, [book('1')], 9);
    expect(fixture.nativeElement.textContent).toContain('Page 1 of 3');
    button('Next').click();
    expect(api.getBooksPage).toHaveBeenCalledWith(2, 4, undefined);
  });

  it('debounces a changed search, resets to page one, and retains the applied query while paging', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    respond(lastRequest(), [book('1')], 30);
    button('Next').click();
    respond(lastRequest(), [book('11')], 30);
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'Angular';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(299);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await fixture.whenStable();
    expect(api.getBooksPage).toHaveBeenCalledWith(1, 10, 'Angular');
    respond(lastRequest(), [book('a')], 11);
    button('Next').click();
    expect(api.getBooksPage).toHaveBeenCalledWith(2, 10, 'Angular');
  });

  it('clears the search immediately and cancels its pending debounce', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    respond(lastRequest(), [book('1')], 20);
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'pending';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(100);
    button('Clear search').click();

    expect(api.getBooksPage).toHaveBeenCalledWith(1, 10, undefined);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(300);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
  });

  it('cancels an obsolete request and keeps stale cards hidden while the replacement loads', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let unsubscribed = false;
    const replacement = new Subject<BookPage>();
    api.getBooksPage
      .mockReturnValueOnce(
        new Observable<BookPage>(observer => {
          observer.next(page([book('1')], 20));
          return () => (unsubscribed = true);
        })
      )
      .mockReturnValueOnce(replacement);
    fixture.destroy();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Book 1');
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'new';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Book 1');
    expect(unsubscribed).toBe(true);
  });

  it('cancels an active request and pending search debounce when destroyed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let unsubscribed = false;
    api.getBooksPage.mockReturnValue(new Observable<BookPage>(() => () => (unsubscribed = true)));
    fixture.destroy();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'pending';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.destroy();

    expect(unsubscribed).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
  });

  it('retries the same page and search after a request error', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    respond(lastRequest(), [book('1')], 30);
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'Angular';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    await fixture.whenStable();
    respond(lastRequest(), [book('a')], 30);
    button('Next').click();
    const failed = lastRequest();
    failed.error(new Error('offline'));
    fixture.detectChanges();

    const callsBeforeRetry = vi.mocked(api.getBooksPage).mock.calls.length;
    button('Try again').click();
    expect(vi.mocked(api.getBooksPage).mock.calls.length).toBe(callsBeforeRetry + 1);
    expect(vi.mocked(api.getBooksPage).mock.lastCall).toEqual([2, 10, 'Angular']);
  });

  it('requests the last valid page when a response shrinks the total page count', () => {
    respond(lastRequest(), [book('1')], 40);
    button('Next').click();
    respond(lastRequest(), [book('11')], 40);
    button('Next').click();
    respond(lastRequest(), [book('21')], 40);
    button('Next').click();
    respond(lastRequest(), [], 12);

    expect(vi.mocked(api.getBooksPage).mock.calls.length).toBe(5);
    expect(vi.mocked(api.getBooksPage).mock.lastCall).toEqual([2, 10, undefined]);
    respond(lastRequest(), [book('11'), book('12')], 12);
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 2');
  });

  it('shows an empty state, zero count, and reachable add-book link for an empty collection', () => {
    respond(lastRequest(), [], 0);

    expect(fixture.nativeElement.textContent).toContain('No books available');
    expect(fixture.nativeElement.textContent).toContain('0 books');
    const addLink = fixture.nativeElement.querySelector('a[href="/books/new"]') as HTMLAnchorElement;
    expect(addLink).not.toBeNull();
    expect(addLink.textContent).toContain('Add book');
  });
});

describe('BookListComponent HTTP behavior', () => {
  let fixture: ComponentFixture<BookListComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BookListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    fixture = TestBed.createComponent(BookListComponent);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement;
  });

  afterEach(() => http.verify());
  afterEach(() => vi.useRealTimers());

  it('uses the supplied page size and renders an asynchronous empty response', async () => {
    fixture.componentRef.setInput('pageSize', 3);
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading books...');
    const request = http.expectOne(req => req.url === 'http://localhost:4730/books');
    expect(request.request.params.get('_page')).toBe('1');
    expect(request.request.params.get('_limit')).toBe('3');
    request.flush([], { headers: { 'X-Total-Count': '0' } });
    await fixture.whenStable();
    expect(element.textContent).toContain('No books available');
    expect(element.textContent).not.toContain('Loading books...');
  });

  it('debounces search for 300 ms and clears the query immediately', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fixture.detectChanges();
    http.expectOne('http://localhost:4730/books?_page=1&_limit=10').flush([], { headers: { 'X-Total-Count': '0' } });
    await fixture.whenStable();

    const search = element.querySelector<HTMLInputElement>('#book-search')!;
    search.value = 'Angular';
    search.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(299);
    http.expectNone(req => req.params.has('q'));
    await vi.advanceTimersByTimeAsync(1);
    await fixture.whenStable();
    expect(element.textContent).toContain('Loading books...');
    const query = http.expectOne(req => req.params.get('q') === 'Angular');
    expect(query.request.params.get('_page')).toBe('1');
    query.flush([], { headers: { 'X-Total-Count': '0' } });
    await fixture.whenStable();
    expect(element.textContent).toContain('No books match your search');

    element.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!.click();
    const cleared = http.expectOne(req => !req.params.has('q'));
    expect(cleared.request.params.get('_page')).toBe('1');
    cleared.flush([], { headers: { 'X-Total-Count': '0' } });
    await fixture.whenStable();
    expect(search.value).toBe('');
    expect(element.textContent).toContain('No books available');
  });
});
