import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Book } from '../books/book';
import { BookApiClient } from '../books/book-api-client.service';
import { ReadingListStore } from './reading-list.store';

describe('ReadingListStore', () => {
  const makeBook = (isbn: string, id = `id-${isbn}`, title = `Title ${isbn}`): Book => ({
    id,
    isbn,
    title,
    author: 'Author',
    publisher: 'Publisher',
    numPages: 100,
    price: '10',
    cover: '/cover.jpg',
    abstract: 'Description',
    userId: 1
  });

  let store: ReadingListStore;
  let api: MockedObject<Pick<BookApiClient, 'getBookByIsbn'>>;

  beforeEach(() => {
    localStorage.clear();
    api = {
      getBookByIsbn: vi.fn().mockName('BookApiClient.getBookByIsbn')
    };
    api.getBookByIsbn.mockImplementation(isbn => of(makeBook(isbn)));
    TestBed.configureTestingModule({
      providers: [ReadingListStore, { provide: BookApiClient, useValue: api }]
    });
    store = TestBed.inject(ReadingListStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('adds by ISBN once, starting in Want to read, regardless of the API id', () => {
    const book = makeBook('978-1', 'database-id');
    store.add(book);
    store.add({ ...book, title: 'Changed duplicate' });

    expect(store.has('978-1')).toBe(true);
    expect(store.entries()).toEqual([expect.objectContaining({ isbn: '978-1', status: 'want-to-read', order: 0 })]);
    expect(store.entries()[0].book.id).toBe('database-id');
  });

  it('keeps status and order unchanged when the same ISBN is added again', () => {
    store.add(makeBook('978-1'));
    store.add(makeBook('978-2'));
    store.move('978-1', 'read', 0);
    const before = store.entries();

    store.add(makeBook('978-1', 'new-id', 'New metadata'));

    expect(store.entries()).toEqual(before);
  });

  it('reorders within and moves between columns, persisting ISBN, status, order, and metadata', () => {
    store.add(makeBook('978-1'));
    store.add(makeBook('978-2'));
    store.move('978-2', 'want-to-read', 0);
    store.move('978-1', 'currently-reading', 0);

    expect(store.entries().map(entry => [entry.isbn, entry.status, entry.order])).toEqual([
      ['978-2', 'want-to-read', 0],
      ['978-1', 'currently-reading', 0]
    ]);
    const persisted = JSON.parse(localStorage.getItem('reading-list:v1')!);
    expect(persisted.entries).toEqual([
      expect.objectContaining({ isbn: '978-2', status: 'want-to-read', order: 0, book: expect.any(Object) }),
      expect.objectContaining({ isbn: '978-1', status: 'currently-reading', order: 0, book: expect.any(Object) })
    ]);
  });

  it('removes an ISBN, closes ordering gaps and persists removal across store recreation', () => {
    store.add(makeBook('978-1'));
    store.add(makeBook('978-2'));
    store.add(makeBook('978-3'));
    store.move('978-1', 'read', 0);
    store.remove('978-2');
    store.remove('missing-isbn');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ReadingListStore, { provide: BookApiClient, useValue: api }] });
    const restored = TestBed.inject(ReadingListStore);
    expect(restored.has('978-2')).toBe(false);
    expect(restored.entries().map(entry => [entry.isbn, entry.status, entry.order])).toEqual([
      ['978-3', 'want-to-read', 0],
      ['978-1', 'read', 0]
    ]);
    restored.add(makeBook('978-2'));
    expect(restored.entries().find(entry => entry.isbn === '978-2')?.order).toBe(1);
  });

  it('cancels refresh on removal so a re-added book cannot receive stale metadata', () => {
    const response = new Subject<Book>();
    const cancelled = vi.fn();
    api.getBookByIsbn.mockReturnValue(
      new Observable(subscriber => {
        const subscription = response.subscribe(subscriber);
        return () => {
          subscription.unsubscribe();
          cancelled();
        };
      })
    );
    store.add(makeBook('978-1'));
    store.refresh();
    store.remove('978-1');
    store.add(makeBook('978-1', 'new-id', 'Re-added title'));
    response.next(makeBook('978-1', 'old-id', 'Stale title'));
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(store.entries()[0].book.title).toBe('Re-added title');
  });

  it('restores valid entries from local storage', () => {
    localStorage.setItem(
      'reading-list:v1',
      JSON.stringify({
        version: 1,
        entries: [{ isbn: '978-1', status: 'read', order: 2, book: makeBook('978-1', 'api-id') }]
      })
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ReadingListStore, { provide: BookApiClient, useValue: api }] });

    const restored = TestBed.inject(ReadingListStore);

    expect(restored.entries()).toEqual([
      expect.objectContaining({
        isbn: '978-1',
        status: 'read',
        order: 2,
        book: expect.objectContaining({ id: 'api-id' })
      })
    ]);
  });

  it('refreshes by ISBN and updates book metadata while keeping current status and order', () => {
    store.add(makeBook('978-1', 'local-id', 'Old title'));
    store.move('978-1', 'currently-reading', 0);
    api.getBookByIsbn.mockReturnValue(of(makeBook('978-1', 'fresh-id', 'Fresh title')));

    store.refresh();

    expect(api.getBookByIsbn).toHaveBeenCalledWith('978-1');
    expect(store.entries()[0]).toEqual(
      expect.objectContaining({
        isbn: '978-1',
        status: 'currently-reading',
        order: 0,
        book: expect.objectContaining({ title: 'Fresh title' })
      })
    );
    store.move('978-1', 'read', 0);
    expect(JSON.parse(localStorage.getItem('reading-list:v1')!).entries[0].book.title).toBe('Fresh title');
  });

  it('retains saved metadata and ordering on refresh errors and allows retry', () => {
    store.add(makeBook('978-1', 'local-id', 'Saved title'));
    api.getBookByIsbn.mockReturnValue(throwError(() => ({ status: 404 })));
    store.refresh();

    expect(store.entries()[0]).toEqual(
      expect.objectContaining({
        isbn: '978-1',
        order: 0,
        book: expect.objectContaining({ title: 'Saved title' }),
        error: expect.anything()
      })
    );
    api.getBookByIsbn.mockReturnValue(of(makeBook('978-1', 'fresh-id', 'Recovered title')));
    store.retry('978-1');
    expect(store.entries()[0].book.title).toBe('Recovered title');
    expect(store.entries()[0].error).toBeFalsy();
  });

  it('does not let an in-flight refresh overwrite a move', () => {
    const response = new Subject<Book>();
    store.add(makeBook('978-1'));
    api.getBookByIsbn.mockReturnValue(response.asObservable());
    store.refresh();
    store.move('978-1', 'read', 0);
    response.next(makeBook('978-1', 'api-id', 'Fresh title'));

    expect(store.entries()[0]).toEqual(
      expect.objectContaining({
        isbn: '978-1',
        status: 'read',
        order: 0,
        book: expect.objectContaining({ title: 'Fresh title' })
      })
    );
  });

  it('cancels an older refresh for the same ISBN so stale metadata cannot win', () => {
    let firstUnsubscribed = false;
    const first = new Observable<Book>(() => () => (firstUnsubscribed = true));
    const second = new Subject<Book>();
    store.add(makeBook('978-1'));
    api.getBookByIsbn.mockReturnValueOnce(first).mockReturnValueOnce(second);
    store.refresh();
    store.refresh();
    second.next(makeBook('978-1', 'new-id', 'Latest title'));

    expect(firstUnsubscribed).toBe(true);
    expect(store.entries()[0].book.title).toBe('Latest title');
  });

  it('keeps an in-memory board usable when stored data is corrupt or storage is unavailable', () => {
    localStorage.setItem('reading-list:v1', '{invalid');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ReadingListStore, { provide: BookApiClient, useValue: api }] });
    const restored = TestBed.inject(ReadingListStore);
    expect(restored.storageNotice()).toBeTruthy();
    restored.add(makeBook('978-1'));
    expect(restored.has('978-1')).toBe(true);
  });

  it('ignores invalid stored entry shapes and continues with an in-memory board', () => {
    localStorage.setItem(
      'reading-list:v1',
      JSON.stringify({ version: 1, entries: [{ isbn: '978-1', status: 'unknown', order: -1 }] })
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ReadingListStore, { provide: BookApiClient, useValue: api }] });
    const restored = TestBed.inject(ReadingListStore);

    expect(restored.entries()).toEqual([]);
    expect(restored.storageNotice()).toBeTruthy();
    restored.add(makeBook('978-2'));
    expect(restored.has('978-2')).toBe(true);
  });

  it('continues in memory when local storage reads and writes throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ReadingListStore, { provide: BookApiClient, useValue: api }] });
    const memoryOnly = TestBed.inject(ReadingListStore);

    memoryOnly.add(makeBook('978-1'));

    expect(memoryOnly.has('978-1')).toBe(true);
    expect(memoryOnly.storageNotice()).toBeTruthy();
  });
});
