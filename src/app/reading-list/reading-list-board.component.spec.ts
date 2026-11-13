import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { of } from 'rxjs';
import { BookApiClient } from '../books/book-api-client.service';
import { Book } from '../books/book';
import { provideRouter } from '@angular/router';
import { ReadingListBoardComponent } from './reading-list-board.component';
import { ReadingListStore } from './reading-list.store';
import { ReadingListEntry } from './reading-list.types';

describe('ReadingListBoardComponent', () => {
  let fixture: ComponentFixture<ReadingListBoardComponent>;
  let api: jasmine.SpyObj<BookApiClient>;
  let store: ReadingListStore;

  const book = (isbn: string, id = `api-${isbn}`): Book => ({
    id,
    isbn,
    title: `Title ${isbn}`,
    author: 'Author',
    publisher: 'Publisher',
    numPages: 10,
    price: '10',
    cover: '',
    abstract: '',
    userId: 1
  });

  beforeEach(async () => {
    localStorage.clear();
    api = jasmine.createSpyObj<BookApiClient>('BookApiClient', ['getBookByIsbn']);
    api.getBookByIsbn.and.callFake(isbn => of(book(isbn)));
    await TestBed.configureTestingModule({
      imports: [ReadingListBoardComponent],
      providers: [provideRouter([]), { provide: BookApiClient, useValue: api }]
    }).compileComponents();
    store = TestBed.inject(ReadingListStore);
    store.add(book('978-1', 'catalog-id'));
    fixture = TestBed.createComponent(ReadingListBoardComponent);
    fixture.detectChanges();
  });

  it('shows the three status columns and refreshes entries by ISBN when opened', () => {
    expect(fixture.nativeElement.textContent).toContain('Want to read');
    expect(fixture.nativeElement.textContent).toContain('Currently reading');
    expect(fixture.nativeElement.textContent).toContain('Read');
    expect(api.getBookByIsbn).toHaveBeenCalledOnceWith('978-1');
  });

  it('makes the entire card draggable without status controls or a separate handle', () => {
    const drag = fixture.debugElement.query(By.directive(CdkDrag));
    expect(drag.nativeElement.tagName).toBe('ARTICLE');
    expect(drag.injector.get(CdkDrag).data.isbn).toBe('978-1');
    expect(fixture.debugElement.queryAll(By.directive(CdkDragHandle))).toEqual([]);
    expect(drag.nativeElement.querySelector('select, button')).toBeNull();
  });

  it('moves and reorders cards through CDK drop handling', () => {
    store.add(book('978-2'));
    fixture.detectChanges();
    const entry = store.entries().find(candidate => candidate.isbn === '978-2') as ReadingListEntry;
    const component = fixture.componentInstance as unknown as {
      drop: (event: { item: { data: ReadingListEntry }; currentIndex: number }, status: 'want-to-read') => void;
    };
    component.drop({ item: { data: entry }, currentIndex: 0 }, 'want-to-read');

    expect(
      store
        .entries()
        .filter(candidate => candidate.status === 'want-to-read')
        .map(candidate => candidate.isbn)
    ).toEqual(['978-2', '978-1']);
  });

  it('keeps a normal details link without native image or link dragging', () => {
    const card = fixture.nativeElement.querySelector('article') as HTMLElement;
    const link = card.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/books/978-1');
    expect(link.querySelector('button, select')).toBeNull();
    expect(link.draggable).toBeFalse();
    expect(card.querySelector('.cover-letter')?.textContent).toBe('T');
  });

  it('moves a card to another column through its drop target', () => {
    const entry = store.entries()[0];
    const component = fixture.componentInstance as unknown as {
      drop: (event: { item: { data: ReadingListEntry }; currentIndex: number }, status: 'read') => void;
    };
    component.drop({ item: { data: entry }, currentIndex: 0 }, 'read');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#read article')?.textContent).toContain('Title 978-1');
    expect(fixture.nativeElement.querySelector('#want-to-read article')).toBeNull();
    expect(JSON.parse(localStorage.getItem('reading-list:v1')!).entries[0].status).toBe('read');
  });

  it('replaces a broken cover with the book initial', () => {
    store.add({ ...book('978-2'), cover: '/missing-cover.jpg' });
    fixture.detectChanges();
    const cover = fixture.nativeElement.querySelector('.book-cover img') as HTMLImageElement;
    expect(cover.draggable).toBeFalse();
    cover.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.book-cover img')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.cover-letter').length).toBe(2);
  });

  it('hides only the target empty state while a drag placeholder is present and restores it on exit', () => {
    const target = fixture.nativeElement.querySelector('#currently-reading') as HTMLElement;
    const emptyState = target.querySelector('.empty-column') as HTMLElement;
    const otherEmptyState = fixture.nativeElement.querySelector('#read .empty-column') as HTMLElement;
    expect(getComputedStyle(emptyState).display).not.toBe('none');

    const placeholder = fixture.nativeElement.querySelector('article').cloneNode(true) as HTMLElement;
    placeholder.classList.add('cdk-drag-placeholder');
    target.prepend(placeholder);

    expect(getComputedStyle(emptyState).display).toBe('none');
    expect(getComputedStyle(otherEmptyState).display).not.toBe('none');
    expect(getComputedStyle(placeholder).display).not.toBe('none');
    expect(getComputedStyle(placeholder).opacity).toBe('0.2');

    placeholder.remove();
    expect(getComputedStyle(emptyState).display).not.toBe('none');
  });
});
