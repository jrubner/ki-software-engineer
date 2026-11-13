import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BookEditComponent } from './book-edit.component';
import { Book } from './book';

const apiUrl = 'http://localhost:4730/books';
const book: Book = {
  id: 'technical-id',
  isbn: '9780000000001',
  userId: 42,
  title: 'Original title',
  author: 'Original author',
  subtitle: 'Subtitle',
  publisher: 'Publisher',
  numPages: 240,
  price: '$10',
  cover: '',
  abstract: 'Description',
  publishedAt: '2024-01-15',
  coAuthors: ['First Writer', 'Second Writer']
};

describe('BookEditComponent', () => {
  let fixture: ComponentFixture<BookEditComponent>;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: jasmine.Spy;
  let element: HTMLElement;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ isbn: book.isbn }));
    TestBed.configureTestingModule({
      imports: [BookEditComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } }
      ]
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BookEditComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function load(): void {
    http.expectOne(`${apiUrl}/${book.isbn}`).flush(book);
    fixture.detectChanges();
  }

  function enter(id: string, value: string): void {
    const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#edit-${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('loads independently by ISBN and prefills bibliographic values', () => {
    expect(element.textContent).toContain('Loading book...');
    load();
    expect(element.querySelector<HTMLInputElement>('#edit-title')!.value).toBe(book.title);
    expect(element.querySelector<HTMLTextAreaElement>('#edit-coauthors')!.value).toBe('First Writer\nSecond Writer');
    expect(element.textContent).toContain(book.isbn);
    http.expectNone(`${apiUrl}?_limit=10`);
  });

  it('sends one complete update, locks input and cancel, and navigates only after success', () => {
    load();
    enter('title', 'Updated title');
    enter('coauthors', ' First \n\n Second ');
    submit();
    submit();
    const request = http.expectOne(`${apiUrl}/${book.isbn}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ ...book, title: 'Updated title', coAuthors: ['First', 'Second'] });
    expect(element.querySelector<HTMLInputElement>('#edit-title')!.disabled).toBeTrue();
    expect(element.querySelector<HTMLButtonElement>('button[type="button"]')!.disabled).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
    request.flush({ ...book, title: 'Updated title' });
    expect(navigate).toHaveBeenCalledOnceWith(['/books', book.isbn]);
  });

  it('deletes optional metadata, omitting a cleared date for the API PUT replacement', () => {
    load();
    for (const id of ['subtitle', 'publisher', 'price', 'cover', 'description', 'date', 'coauthors']) enter(id, '');
    submit();
    const request = http.expectOne(`${apiUrl}/${book.isbn}`);
    const { publishedAt, ...withoutDate } = book;
    expect(request.request.body).toEqual({
      ...withoutDate,
      subtitle: '',
      publisher: '',
      price: '',
      cover: '',
      abstract: '',
      coAuthors: []
    });
    request.flush(request.request.body);
  });

  for (const pages of ['', '0', '-1', '1.5']) {
    it(`rejects invalid pages ${JSON.stringify(pages)} and whitespace-only required text without writing`, () => {
      load();
      enter('title', '   ');
      enter('author', '');
      enter('pages', pages);
      submit();
      expect(element.textContent).toContain('Enter a title.');
      expect(element.textContent).toContain('Enter an author.');
      expect(element.textContent).toContain('Enter a positive whole number of pages.');
      http.expectNone(request => request.method === 'PUT');
    });
  }

  it('cancels without writing', () => {
    load();
    enter('title', 'Discard me');
    element.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    expect(navigate).toHaveBeenCalledOnceWith(['/books', book.isbn]);
    http.expectNone(request => request.method === 'PUT');
  });

  it('retains values after a save failure and allows retry', () => {
    load();
    enter('title', 'Retry title');
    submit();
    http.expectOne(`${apiUrl}/${book.isbn}`).flush('', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')!.textContent).toContain('Unable to save changes');
    expect(element.querySelector<HTMLInputElement>('#edit-title')!.value).toBe('Retry title');
    expect(element.querySelector<HTMLInputElement>('#edit-title')!.disabled).toBeFalse();
    submit();
    const request = http.expectOne(`${apiUrl}/${book.isbn}`);
    expect(request.request.body.title).toBe('Retry title');
    request.flush(request.request.body);
    expect(navigate).toHaveBeenCalledOnceWith(['/books', book.isbn]);
  });

  for (const status of [404, 500, 0]) {
    it(`handles load status ${status}, retains a collection link and recovers on parameter changes`, () => {
      const request = http.expectOne(`${apiUrl}/${book.isbn}`);
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({}, { status, statusText: 'Failure' });
      fixture.detectChanges();
      expect(element.textContent).toContain(status === 404 ? 'Book not found' : 'Unable to load book');
      expect(element.querySelector('a')!.getAttribute('href')).toBe('/');
      params.next(convertToParamMap({ isbn: 'second' }));
      http.expectOne(`${apiUrl}/second`).flush({ ...book, isbn: 'second' });
      fixture.detectChanges();
      expect(element.querySelector<HTMLInputElement>('#edit-title')!.value).toBe(book.title);
    });
  }

  it('cancels replaced reads and clears stale form and error state', () => {
    load();
    enter('title', 'Discard me');
    submit();
    http.expectOne(`${apiUrl}/${book.isbn}`).flush({}, { status: 500, statusText: 'Failure' });
    params.next(convertToParamMap({ isbn: 'slow' }));
    fixture.detectChanges();
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    const slow = http.expectOne(`${apiUrl}/slow`);
    params.next(convertToParamMap({ isbn: 'second' }));
    expect(slow.cancelled).toBeTrue();
    http.expectOne(`${apiUrl}/second`).flush({ ...book, isbn: 'second', title: 'Second title' });
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('#edit-title')!.value).toBe('Second title');
  });
});
