import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BookCreateComponent } from './book-create.component';
import { Book } from './book';

const apiUrl = 'http://localhost:4730/books';
const createdBook: Book = {
  id: 'server-id',
  isbn: '9780000000001',
  userId: 1,
  title: 'New title',
  author: 'New author',
  publisher: 'Publisher',
  numPages: 240,
  price: '€12,50',
  cover: '',
  abstract: '',
  coAuthors: ['First Writer', 'Second Writer']
};

describe('BookCreateComponent', () => {
  let fixture: ComponentFixture<BookCreateComponent>;
  let http: HttpTestingController;
  let navigate: jasmine.Spy;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BookCreateComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BookCreateComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function enter(id: string, value: string): void {
    const field = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#create-${id}`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  function enterValidBook(): void {
    enter('isbn', '9780000000001');
    enter('title', 'New title');
    enter('author', 'New author');
    enter('pages', '240');
  }

  function submit(): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function expectMissingIsbn(): void {
    http.expectOne(`${apiUrl}/${createdBook.isbn}`).flush({}, { status: 404, statusText: 'Not Found' });
  }

  it('renders editable ISBN and bibliographic fields with optional metadata empty', () => {
    for (const id of [
      'isbn',
      'title',
      'subtitle',
      'author',
      'publisher',
      'pages',
      'price',
      'cover',
      'description',
      'date',
      'coauthors'
    ]) {
      expect(element.querySelector(`#create-${id}`))
        .withContext(id)
        .not.toBeNull();
    }
    expect(element.querySelector<HTMLTextAreaElement>('#create-coauthors')!.getAttribute('rows')).toBe('3');
    expect(element.textContent).toContain('One name per line.');
  });

  it('validates trimmed ISBN, title, author, and positive whole pages without requests', () => {
    enter('isbn', '   ');
    enter('title', '   ');
    enter('author', '   ');
    enter('pages', '1.5');
    submit();
    expect(element.textContent).toContain('Enter an ISBN.');
    expect(element.textContent).toContain('Enter a title.');
    expect(element.textContent).toContain('Enter an author.');
    expect(element.textContent).toContain('Enter a positive whole number of pages.');
    http.expectNone(() => true);
  });

  for (const pages of ['', '0', '-1', '1.5']) {
    it(`rejects page count ${JSON.stringify(pages)} without checking or creating`, () => {
      enterValidBook();
      enter('pages', pages);
      submit();
      expect(element.querySelector('#pages-error')!.textContent).toContain('Enter a positive whole number of pages.');
      http.expectNone(() => true);
    });
  }

  it('checks ISBN availability, posts one complete new book, locks actions, and navigates by returned ISBN', () => {
    enterValidBook();
    enter('isbn', '  9780000000001  ');
    enter('price', '€12,50');
    enter('date', '');
    enter('coauthors', ' First Writer \n\n Second Writer ');
    submit();
    submit();
    http.expectOne(`${apiUrl}/9780000000001`).flush({}, { status: 404, statusText: 'Not Found' });
    const request = http.expectOne(apiUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      isbn: '9780000000001',
      title: 'New title',
      subtitle: '',
      author: 'New author',
      publisher: '',
      numPages: 240,
      price: '€12,50',
      cover: '',
      abstract: '',
      userId: 1,
      coAuthors: ['First Writer', 'Second Writer']
    });
    expect(element.querySelector<HTMLInputElement>('#create-title')!.disabled).toBeTrue();
    expect(element.querySelector<HTMLButtonElement>('button[type="button"]')!.disabled).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
    request.flush({ ...createdBook, isbn: '9780000000002' });
    expect(navigate).toHaveBeenCalledOnceWith(['/books', '9780000000002']);
  });

  it('shows a duplicate ISBN error without posting when the ISBN already exists', () => {
    enterValidBook();
    submit();
    http.expectOne(`${apiUrl}/${createdBook.isbn}`).flush(createdBook);
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')!.textContent).toContain('ISBN');
    expect(element.querySelector<HTMLInputElement>('#create-isbn')!.getAttribute('aria-invalid')).toBe('true');
    http.expectNone(request => request.method === 'POST');
    expect(navigate).not.toHaveBeenCalled();
  });

  for (const status of [500, 0]) {
    it(`does not post after ISBN lookup status ${status} and keeps entered values`, () => {
      enterValidBook();
      submit();
      const request = http.expectOne(`${apiUrl}/${createdBook.isbn}`);
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({}, { status, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(element.querySelector<HTMLInputElement>('#create-title')!.value).toBe('New title');
      expect(element.querySelector('[role="alert"]')).not.toBeNull();
      http.expectNone(request => request.method === 'POST');
    });
  }

  it('allows retry after an ISBN lookup error without losing field values', () => {
    enterValidBook();
    submit();
    http.expectOne(`${apiUrl}/${createdBook.isbn}`).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('#create-title')!.value).toBe('New title');
    submit();
    http.expectOne(`${apiUrl}/${createdBook.isbn}`).flush({}, { status: 404, statusText: 'Not Found' });
    const post = http.expectOne(apiUrl);
    expect(post.request.body.title).toBe('New title');
    post.flush(createdBook);
    expect(navigate).toHaveBeenCalledOnceWith(['/books', createdBook.isbn]);
  });

  it('retains values and allows retry after POST failure', () => {
    enterValidBook();
    submit();
    expectMissingIsbn();
    const firstPost = http.expectOne(apiUrl);
    firstPost.flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(element.querySelector<HTMLInputElement>('#create-title')!.value).toBe('New title');
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    submit();
    expectMissingIsbn();
    const retry = http.expectOne(apiUrl);
    expect(retry.request.body.title).toBe('New title');
    retry.flush(createdBook);
    expect(navigate).toHaveBeenCalledOnceWith(['/books', createdBook.isbn]);
  });

  it('cancels to the collection without checking or creating a book', () => {
    enterValidBook();
    element.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    expect(navigate).toHaveBeenCalledOnceWith(['/']);
    http.expectNone(() => true);
  });
});
