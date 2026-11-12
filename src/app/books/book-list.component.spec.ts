import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BookListComponent } from './book-list.component';

describe('BookListComponent', () => {
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
    expect(request.request.params.get('_limit')).toBe('3');
    request.flush([]);
    tick();
    fixture.detectChanges();
    expect(element.textContent).toContain('No books available');
    expect(element.textContent).not.toContain('Loading books...');
  }));

  it('debounces search for 300 ms and clears the query immediately', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne('http://localhost:4730/books?_limit=10').flush([]);
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
    http.expectOne('http://localhost:4730/books?_limit=10&q=Angular').flush([]);
    fixture.detectChanges();
    expect(element.textContent).toContain('No books match your search');

    element.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!.click();
    http.expectOne('http://localhost:4730/books?_limit=10').flush([]);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(search.value).toBe('');
    expect(element.textContent).toContain('No books available');
  }));
});
