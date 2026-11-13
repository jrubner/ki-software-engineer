import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Book } from '../books/book';
import { BookApiClient } from '../books/book-api-client.service';
import { ReadingListEntry, ReadingStatus, READING_STATUSES } from './reading-list.types';

const STORAGE_KEY = 'reading-list:v1';

interface StoredBoard {
  version: 1;
  entries: Array<Pick<ReadingListEntry, 'isbn' | 'status' | 'order' | 'book'>>;
}

@Injectable({ providedIn: 'root' })
export class ReadingListStore {
  readonly entries = signal<ReadingListEntry[]>([]);
  readonly storageNotice = signal('');
  private readonly api = inject(BookApiClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshSubscriptions = new Map<string, Subscription>();

  constructor() {
    this.restore();
  }

  has(isbn: string): boolean {
    return this.entries().some(entry => entry.isbn === isbn);
  }

  add(book: Book): void {
    if (this.has(book.isbn)) return;
    this.entries.update(entries => [
      ...entries,
      { isbn: book.isbn, status: 'want-to-read', order: this.count('want-to-read'), book }
    ]);
    this.persist();
  }

  remove(isbn: string): void {
    if (!this.has(isbn)) return;
    this.refreshSubscriptions.get(isbn)?.unsubscribe();
    this.refreshSubscriptions.delete(isbn);
    this.entries.update(entries =>
      READING_STATUSES.flatMap(status =>
        entries
          .filter(entry => entry.isbn !== isbn && entry.status === status)
          .sort((left, right) => left.order - right.order)
          .map((entry, order) => ({ ...entry, order }))
      )
    );
    this.persist();
  }

  move(isbn: string, status: ReadingStatus, index: number): void {
    if (!READING_STATUSES.includes(status)) return;
    const current = this.entries();
    const entry = current.find(candidate => candidate.isbn === isbn);
    if (!entry) return;

    const byStatus = new Map<ReadingStatus, ReadingListEntry[]>(
      READING_STATUSES.map(candidateStatus => [
        candidateStatus,
        current
          .filter(candidate => candidate.status === candidateStatus)
          .sort((left, right) => left.order - right.order)
      ])
    );
    const source = byStatus.get(entry.status)!;
    const sourceIndex = source.findIndex(candidate => candidate.isbn === isbn);
    source.splice(sourceIndex, 1);
    const destination = byStatus.get(status)!;
    const nextIndex = Math.max(
      0,
      Math.min(Number.isFinite(index) ? Math.trunc(index) : destination.length, destination.length)
    );
    destination.splice(nextIndex, 0, { ...entry, status });
    const unchanged =
      entry.status === status &&
      current
        .filter(candidate => candidate.status === status)
        .sort((left, right) => left.order - right.order)
        .every((candidate, position) => destination[position]?.isbn === candidate.isbn);
    if (unchanged) return;

    this.entries.set(
      READING_STATUSES.flatMap(candidateStatus =>
        byStatus.get(candidateStatus)!.map((candidate, order) => ({ ...candidate, order }))
      )
    );
    this.persist();
  }

  refresh(): void {
    for (const entry of this.entries()) this.fetch(entry.isbn);
  }

  retry(isbn: string): void {
    if (this.has(isbn)) this.fetch(isbn);
  }

  private fetch(isbn: string): void {
    this.refreshSubscriptions.get(isbn)?.unsubscribe();
    const request = new Subscription();
    this.refreshSubscriptions.set(isbn, request);
    this.entries.update(entries =>
      entries.map(entry => (entry.isbn === isbn ? { ...entry, loading: true, error: undefined } : entry))
    );
    request.add(
      this.api
        .getBookByIsbn(isbn)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: book => {
            this.entries.update(entries =>
              entries.map(entry => (entry.isbn === isbn ? { ...entry, book, loading: false, error: undefined } : entry))
            );
            this.persist();
            this.clearRequest(isbn, request);
          },
          error: () => {
            this.entries.update(entries =>
              entries.map(entry =>
                entry.isbn === isbn ? { ...entry, loading: false, error: 'Could not refresh this book.' } : entry
              )
            );
            this.clearRequest(isbn, request);
          }
        })
    );
  }

  private clearRequest(isbn: string, request: Subscription): void {
    if (this.refreshSubscriptions.get(isbn) === request) this.refreshSubscriptions.delete(isbn);
  }

  private count(status: ReadingStatus): number {
    return this.entries().filter(entry => entry.status === status).length;
  }

  private restore(): void {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (!value) return;
      const parsed: unknown = JSON.parse(value);
      if (!this.isStoredBoard(parsed)) {
        this.storageNotice.set('Saved reading list data could not be restored.');
        return;
      }
      const seen = new Set<string>();
      const valid: ReadingListEntry[] = [];
      for (const item of parsed.entries) {
        if (!this.isStoredEntry(item) || seen.has(item.isbn)) {
          this.storageNotice.set('Some saved reading list data could not be restored.');
          continue;
        }
        seen.add(item.isbn);
        valid.push({ isbn: item.isbn, status: item.status, order: item.order, book: item.book });
      }
      this.entries.set(
        valid.sort(
          (left, right) =>
            READING_STATUSES.indexOf(left.status) - READING_STATUSES.indexOf(right.status) || left.order - right.order
        )
      );
    } catch {
      this.storageNotice.set('Saved reading list data could not be restored.');
    }
  }

  private persist(): void {
    try {
      const entries = this.entries().map(({ isbn, status, order, book }) => ({ isbn, status, order, book }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries } satisfies StoredBoard));
    } catch {
      this.storageNotice.set('Could not save the reading list. Changes are kept for this session.');
    }
  }

  private isStoredBoard(value: unknown): value is StoredBoard {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { version?: unknown; entries?: unknown };
    return candidate.version === 1 && Array.isArray(candidate.entries);
  }

  private isStoredEntry(value: unknown): value is StoredBoard['entries'][number] {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<ReadingListEntry>;
    return (
      typeof candidate.isbn === 'string' &&
      candidate.isbn.length > 0 &&
      READING_STATUSES.includes(candidate.status as ReadingStatus) &&
      Number.isInteger(candidate.order) &&
      candidate.order! >= 0 &&
      this.isBook(candidate.book) &&
      candidate.book.isbn === candidate.isbn
    );
  }

  private isBook(value: unknown): value is Book {
    if (typeof value !== 'object' || value === null) return false;
    const book = value as Partial<Book>;
    return (
      typeof book.id === 'string' &&
      typeof book.isbn === 'string' &&
      typeof book.title === 'string' &&
      typeof book.author === 'string' &&
      typeof book.publisher === 'string' &&
      Number.isFinite(book.numPages) &&
      typeof book.price === 'string' &&
      typeof book.cover === 'string' &&
      typeof book.abstract === 'string' &&
      Number.isFinite(book.userId) &&
      (book.subtitle === undefined || typeof book.subtitle === 'string') &&
      (book.publishedAt === undefined || typeof book.publishedAt === 'string') &&
      (book.coAuthors === undefined ||
        (Array.isArray(book.coAuthors) && book.coAuthors.every(author => typeof author === 'string')))
    );
  }
}
