import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { of, Subject } from 'rxjs';
import { BookApiClient } from '../books/book-api-client.service';
import { Book } from '../books/book';
import { provideRouter } from '@angular/router';
import { ReadingListBoardComponent } from './reading-list-board.component';
import { ReadingListStore } from './reading-list.store';
import { ReadingListEntry } from './reading-list.types';

describe('ReadingListBoardComponent', () => {
  let fixture: ComponentFixture<ReadingListBoardComponent>;
  let api: MockedObject<Pick<BookApiClient, 'getBookByIsbn'>>;
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
    api = {
      getBookByIsbn: vi.fn().mockName('BookApiClient.getBookByIsbn')
    };
    api.getBookByIsbn.mockImplementation(isbn => of(book(isbn)));
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
    expect(api.getBookByIsbn).toHaveBeenCalledTimes(1);
    expect(api.getBookByIsbn).toHaveBeenCalledWith('978-1');
  });

  it('makes the entire card draggable without status controls or a separate handle', () => {
    const drag = fixture.debugElement.query(By.directive(CdkDrag));
    expect(drag.nativeElement.tagName).toBe('ARTICLE');
    expect(drag.injector.get(CdkDrag).data.isbn).toBe('978-1');
    expect(fixture.debugElement.queryAll(By.directive(CdkDragHandle))).toEqual([]);
    expect(drag.nativeElement.querySelector('select, button')).toBeNull();
  });

  it('moves and reorders cards through CDK drop handling', async () => {
    store.add(book('978-2'));
    await fixture.whenStable();
    const entry = store.entries().find(candidate => candidate.isbn === '978-2') as ReadingListEntry;
    const component = fixture.componentInstance as unknown as {
      drop: (
        event: {
          item: {
            data: ReadingListEntry;
          };
          currentIndex: number;
        },
        status: 'want-to-read'
      ) => void;
    };
    component.drop({ item: { data: entry }, currentIndex: 0 }, 'want-to-read');
    await fixture.whenStable();

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
    expect(link.draggable).toBe(false);
    expect(card.querySelector('.cover-letter')?.textContent).toBe('T');
  });

  it('moves a card to another column and persists the rendered column state', async () => {
    const entry = store.entries()[0];
    const component = fixture.componentInstance as unknown as {
      drop: (
        event: {
          item: {
            data: ReadingListEntry;
          };
          currentIndex: number;
        },
        status: 'read'
      ) => void;
    };
    component.drop({ item: { data: entry }, currentIndex: 0 }, 'read');
    await fixture.whenStable();
    const readColumn = fixture.nativeElement.querySelector('[data-status="read"]') as HTMLElement;
    const sourceColumn = fixture.nativeElement.querySelector('[data-status="want-to-read"]') as HTMLElement;
    expect(readColumn.querySelector('article')?.textContent).toContain('Title 978-1');
    expect(sourceColumn.querySelector('article')).toBeNull();
    expect(readColumn.querySelector('.column-count')?.getAttribute('aria-label')).toBe('1 books');
    expect(sourceColumn.querySelector('.column-count')?.getAttribute('aria-label')).toBe('0 books');
    expect(JSON.parse(localStorage.getItem('reading-list:v1')!).entries[0].status).toBe('read');
  });

  it('replaces a broken cover with the book initial', async () => {
    store.add({ ...book('978-2'), cover: '/missing-cover.jpg' });
    await fixture.whenStable();
    const cover = fixture.nativeElement.querySelector('.book-cover img') as HTMLImageElement;
    expect(cover.draggable).toBe(false);
    cover.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.book-cover img')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.cover-letter').length).toBe(2);
  });

  it('renders and persists metadata delivered by a later HTTP callback', async () => {
    const response = new Subject<Book>();
    api.getBookByIsbn.mockReturnValue(response);
    store.retry('978-1');
    await fixture.whenStable();

    response.next({ ...book('978-1', 'refreshed-id'), title: 'Fresh title' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.card-title')?.textContent).toBe('Fresh title');
    expect(JSON.parse(localStorage.getItem('reading-list:v1')!).entries[0].book).toEqual(
      expect.objectContaining({ id: 'refreshed-id', title: 'Fresh title' })
    );
  });

  it('removes a card while its refresh is pending and ignores the late HTTP response', async () => {
    const response = new Subject<Book>();
    api.getBookByIsbn.mockReturnValue(response);
    store.retry('978-1');
    store.remove('978-1');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('article')).toBeNull();
    response.next({ ...book('978-1', 'stale-id'), title: 'Stale title' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('article')).toBeNull();
    expect(JSON.parse(localStorage.getItem('reading-list:v1')!).entries).toEqual([]);
  });

  it('shows the storage fallback while keeping newly added books visible', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    try {
      store.add(book('978-2'));
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
        'Changes are kept for this session'
      );
      expect(fixture.nativeElement.querySelectorAll('article').length).toBe(2);
    } finally {
      setItem.mockRestore();
    }
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
