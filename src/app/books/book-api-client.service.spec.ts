import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BookApiClient } from './book-api-client.service';
import { Book } from './book';

describe('BookApiClient', () => {
  let client: BookApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(BookApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a book without a client-generated id and returns the server identity', () => {
    const draft = {
      isbn: 'new-isbn',
      title: 'New title',
      author: 'Author',
      userId: 1,
      publisher: '',
      numPages: 12,
      price: 'free text',
      cover: '',
      abstract: ''
    };
    let result: Book | undefined;
    client.createBook(draft).subscribe(value => (result = value));
    const request = http.expectOne('http://localhost:4730/books');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(draft);
    expect(request.request.body.id).toBeUndefined();
    request.flush({ ...draft, id: 'server-id', isbn: 'returned-isbn' });
    expect(result?.isbn).toBe('returned-isbn');
  });

  it('requests a page with its size and query and reads the response total', () => {
    let count: number | undefined;
    client.getBooksPage(2, 3, 'Angular & RxJS').subscribe(page => (count = page.totalCount));
    const request = http.expectOne(req => req.url === 'http://localhost:4730/books');
    expect(request.request.params.get('_page')).toBe('2');
    expect(request.request.params.get('_limit')).toBe('3');
    expect(request.request.params.get('q')).toBe('Angular & RxJS');
    request.flush([], { headers: { 'X-Total-Count': '7' } });
    expect(count).toBe(7);
  });

  for (const total of [null, '', 'invalid', '-1', '1.5', 'Infinity', '9007199254740992']) {
    it(`rejects an unusable total count ${JSON.stringify(total)}`, () => {
      let failed = false;
      client.getBooksPage(1).subscribe({ error: () => (failed = true) });
      const request = http.expectOne(req => req.url === 'http://localhost:4730/books');
      expect(request.request.params.has('q')).toBeFalse();
      request.flush([], { headers: total === null ? {} : { 'X-Total-Count': total } });
      expect(failed).toBeTrue();
    });
  }

  it('accepts an empty page with a zero total', () => {
    let count: number | undefined;
    client.getBooksPage(1).subscribe(page => (count = page.totalCount));
    http.expectOne(req => req.url === 'http://localhost:4730/books').flush([], { headers: { 'X-Total-Count': '0' } });
    expect(count).toBe(0);
  });

  it('updates by encoded ISBN with the complete book and unchanged identity', () => {
    const book: Book = {
      id: 'different-id',
      isbn: '978/12 ?#',
      userId: 42,
      title: 'Updated title',
      author: 'Author',
      publisher: '',
      numPages: 1,
      price: 'free text',
      cover: '',
      abstract: '',
      coAuthors: []
    };
    let result: Book | undefined;
    client.updateBook(book).subscribe(value => (result = value));
    const request = http.expectOne('http://localhost:4730/books/978%2F12%20%3F%23');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(book);
    request.flush(book);
    expect(result).toEqual(book);
  });

  it('preserves update failures for retry handling', () => {
    const book = { isbn: 'missing' } as Book;
    let status: number | undefined;
    client.updateBook(book).subscribe({ error: error => (status = error.status) });
    http.expectOne('http://localhost:4730/books/missing').flush('', { status: 500, statusText: 'Server Error' });
    expect(status).toBe(500);
  });

  it('encodes an ISBN as one path segment', () => {
    client.getBookByIsbn('978/12 ?#').subscribe();
    const request = http.expectOne('http://localhost:4730/books/978%2F12%20%3F%23');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('passes the page size and search query without corrupting special characters', () => {
    client.getBooks(3, 'Angular & RxJS').subscribe();
    const request = http.expectOne(req => req.url === 'http://localhost:4730/books');
    expect(request.request.params.get('_limit')).toBe('3');
    expect(request.request.params.get('q')).toBe('Angular & RxJS');
    request.flush([]);
  });

  it('omits the query when listing books without a search', () => {
    client.getBooks().subscribe();
    const request = http.expectOne(req => req.url === 'http://localhost:4730/books');
    expect(request.request.params.get('_limit')).toBe('10');
    expect(request.request.params.has('q')).toBeFalse();
    request.flush([]);
  });

  it('preserves HTTP status so callers can distinguish missing books from server failures', () => {
    let status: number | undefined;
    client.getBookByIsbn('missing').subscribe({ error: error => (status = error.status) });
    http.expectOne('http://localhost:4730/books/missing').flush('', { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
  });
});
