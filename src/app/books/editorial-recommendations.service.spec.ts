import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Book } from './book';
import { EditorialRecommendationsService } from './editorial-recommendations.service';

describe('EditorialRecommendationsService', () => {
  let service: EditorialRecommendationsService;
  let http: HttpTestingController;
  const book = { id: 'internal', isbn: 'isbn/1', title: 'Original', editorialRecommendation: true } as Book;
  const loadUrl = 'http://localhost:4730/books?editorialRecommendation_like=%5Etrue$';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EditorialRecommendationsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('filters unselected records and returns the saved editorial order', () => {
    let result: Book[] = [];
    service.load().subscribe(books => (result = books));
    http.expectOne(loadUrl).flush([
      { ...book, editorialRecommendationOrder: 2 },
      { ...book, isbn: 'unselected', editorialRecommendation: false },
      { ...book, isbn: 'first', editorialRecommendationOrder: 0 },
      { ...book, isbn: 'missing', editorialRecommendation: undefined }
    ]);
    expect(result.map(item => item.isbn)).toEqual(['first', 'isbn/1']);
  });

  it('removes old selections before adding new ones and patches only editorial fields using ISBN', () => {
    let result: Book[] = [];
    service.save([{ ...book, isbn: 'new' }]).subscribe(books => (result = books));
    http.expectOne(loadUrl).flush([book]);
    const remove = http.expectOne('http://localhost:4730/books/isbn%2F1');
    expect(remove.request.method).toBe('PATCH');
    expect(remove.request.body).toEqual({ editorialRecommendation: false, editorialRecommendationOrder: 0 });
    http.expectNone('http://localhost:4730/books/new');
    remove.flush(book);
    const add = http.expectOne('http://localhost:4730/books/new');
    expect(add.request.body).toEqual({ editorialRecommendation: true, editorialRecommendationOrder: 0 });
    add.flush({ ...book, isbn: 'new' });
    http.expectOne(loadUrl).flush([{ ...book, isbn: 'new' }]);
    expect(result[0].isbn).toBe('new');
  });

  it('reports partial failure and reloads current server selections before retrying', () => {
    let failed = false;
    service.save([]).subscribe({ error: () => (failed = true) });
    http.expectOne(loadUrl).flush([book, { ...book, isbn: 'second' }]);
    http.expectOne('http://localhost:4730/books/isbn%2F1').flush(book);
    http.expectOne('http://localhost:4730/books/second').flush({}, { status: 500, statusText: 'Server error' });
    expect(failed).toBe(true);
    service.save([]).subscribe();
    http.expectOne(loadUrl).flush([{ ...book, isbn: 'second' }]);
    http.expectNone('http://localhost:4730/books/isbn%2F1');
    http.expectOne('http://localhost:4730/books/second').flush(book);
    http.expectOne(loadUrl).flush([]);
  });
});
