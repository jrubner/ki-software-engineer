import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { BookApiClient } from './book-api-client.service';
import { BookListComponent } from './book-list.component';
import { Book, BookPage } from './book';

describe('BookListComponent pagination', () => {
  let fixture: ComponentFixture<BookListComponent>;
  let api: jasmine.SpyObj<BookApiClient>;

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
    api = jasmine.createSpyObj<BookApiClient>('BookApiClient', ['getBooks', 'getBooksPage']);
    api.getBooks.and.returnValue(of([]));
    api.getBooksPage.and.callFake(() => new Subject<BookPage>());
    await TestBed.configureTestingModule({
      imports: [BookListComponent],
      providers: [provideRouter([]), { provide: BookApiClient, useValue: api }]
    }).compileComponents();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.detectChanges();
  });

  it('loads the first page with the effective page size and shows the page controls and total', () => {
    expect(api.getBooksPage).toHaveBeenCalledOnceWith(1, 10, undefined);
    const request = api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>;
    respond(request, [book('1')], 21);

    expect(fixture.nativeElement.textContent).toContain('Page 1 of 3');
    expect(fixture.nativeElement.textContent).toContain('21 books');
    expect(button('Previous').disabled).toBeTrue();
    expect(button('Next').disabled).toBeFalse();
  });

  it('navigates pages and disables navigation while loading and at the last page', () => {
    const first = api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>;
    respond(first, [book('first')], 20);
    button('Next').click();
    fixture.detectChanges();

    expect(api.getBooksPage).toHaveBeenCalledWith(2, 10, undefined);
    expect(button('Previous').disabled).toBeTrue();
    expect(button('Next').disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).not.toContain('Book first');

    const second = api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>;
    respond(second, [book('last')], 20);
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 2');
    expect(button('Previous').disabled).toBeFalse();
    expect(button('Next').disabled).toBeTrue();
    button('Previous').click();
    expect(api.getBooksPage).toHaveBeenCalledWith(1, 10, undefined);
  });

  it('uses the supplied page size for requests and page counts', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.componentRef.setInput('pageSize', 4);
    fixture.detectChanges();
    const request = api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>;

    expect(api.getBooksPage).toHaveBeenCalledWith(1, 4, undefined);
    respond(request, [book('1')], 9);
    expect(fixture.nativeElement.textContent).toContain('Page 1 of 3');
    button('Next').click();
    expect(api.getBooksPage).toHaveBeenCalledWith(2, 4, undefined);
  });

  it('debounces a changed search, resets to page one, and retains the applied query while paging', fakeAsync(() => {
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('1')], 30);
    button('Next').click();
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('11')], 30);
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'Angular';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    tick(299);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
    tick(1);
    expect(api.getBooksPage).toHaveBeenCalledWith(1, 10, 'Angular');
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('a')], 11);
    button('Next').click();
    expect(api.getBooksPage).toHaveBeenCalledWith(2, 10, 'Angular');
  }));

  it('clears the search immediately and cancels its pending debounce', fakeAsync(() => {
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('1')], 20);
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'pending';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    tick(100);
    button('Clear search').click();

    expect(api.getBooksPage).toHaveBeenCalledWith(1, 10, undefined);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
    tick(300);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
  }));

  it('cancels an obsolete request and keeps stale cards hidden while the replacement loads', fakeAsync(() => {
    let unsubscribed = false;
    const replacement = new Subject<BookPage>();
    api.getBooksPage.and.returnValues(
      new Observable<BookPage>(observer => {
        observer.next(page([book('1')], 20));
        return () => (unsubscribed = true);
      }),
      replacement
    );
    fixture.destroy();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Book 1');
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'new';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Book 1');
    expect(unsubscribed).toBeTrue();
  }));

  it('cancels an active request and pending search debounce when destroyed', fakeAsync(() => {
    let unsubscribed = false;
    api.getBooksPage.and.returnValue(new Observable<BookPage>(() => () => (unsubscribed = true)));
    fixture.destroy();
    fixture = TestBed.createComponent(BookListComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'pending';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.destroy();

    expect(unsubscribed).toBeTrue();
    tick(300);
    expect(api.getBooksPage).toHaveBeenCalledTimes(2);
  }));

  it('retries the same page and search after a request error', fakeAsync(() => {
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('1')], 30);
    const input = fixture.nativeElement.querySelector('#book-search') as HTMLInputElement;
    input.value = 'Angular';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    tick(300);
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('a')], 30);
    button('Next').click();
    const failed = api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>;
    failed.error(new Error('offline'));
    fixture.detectChanges();

    const callsBeforeRetry = api.getBooksPage.calls.count();
    button('Try again').click();
    expect(api.getBooksPage.calls.count()).toBe(callsBeforeRetry + 1);
    expect(api.getBooksPage.calls.mostRecent().args).toEqual([2, 10, 'Angular']);
  }));

  it('requests the last valid page when a response shrinks the total page count', () => {
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('1')], 40);
    button('Next').click();
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('11')], 40);
    button('Next').click();
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('21')], 40);
    button('Next').click();
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [], 12);

    expect(api.getBooksPage.calls.count()).toBe(5);
    expect(api.getBooksPage.calls.mostRecent().args).toEqual([2, 10, undefined]);
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [book('11'), book('12')], 12);
    expect(fixture.nativeElement.textContent).toContain('Page 2 of 2');
  });

  it('shows an empty state, zero count, and reachable add-book link for an empty collection', () => {
    respond(api.getBooksPage.calls.mostRecent().returnValue as Subject<BookPage>, [], 0);

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

  it('uses the supplied page size and renders an asynchronous empty response', fakeAsync(() => {
    fixture.componentRef.setInput('pageSize', 3);
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading books...');
    const request = http.expectOne(req => req.url === 'http://localhost:4730/books');
    expect(request.request.params.get('_page')).toBe('1');
    expect(request.request.params.get('_limit')).toBe('3');
    request.flush([], { headers: { 'X-Total-Count': '0' } });
    tick();
    fixture.detectChanges();
    expect(element.textContent).toContain('No books available');
    expect(element.textContent).not.toContain('Loading books...');
  }));

  it('debounces search for 300 ms and clears the query immediately', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('http://localhost:4730/books?_page=1&_limit=10').flush([], { headers: { 'X-Total-Count': '0' } });
    tick();
    fixture.detectChanges();

    const search = element.querySelector<HTMLInputElement>('#book-search')!;
    search.value = 'Angular';
    search.dispatchEvent(new Event('input'));
    tick(299);
    http.expectNone(req => req.params.has('q'));
    tick(1);
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading books...');
    const query = http.expectOne(req => req.params.get('q') === 'Angular');
    expect(query.request.params.get('_page')).toBe('1');
    query.flush([], { headers: { 'X-Total-Count': '0' } });
    fixture.detectChanges();
    expect(element.textContent).toContain('No books match your search');

    element.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!.click();
    const cleared = http.expectOne(req => !req.params.has('q'));
    expect(cleared.request.params.get('_page')).toBe('1');
    cleared.flush([], { headers: { 'X-Total-Count': '0' } });
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(search.value).toBe('');
    expect(element.textContent).toContain('No books available');
  }));
});
