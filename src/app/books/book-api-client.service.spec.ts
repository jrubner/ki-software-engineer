import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BookApiClient } from './book-api-client.service';

describe('BookApiClient', () => {
  let client: BookApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(BookApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

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
