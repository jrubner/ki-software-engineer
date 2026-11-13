import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTooltip } from '@angular/material/tooltip';
import { catchError, distinctUntilChanged, map, Observable, of, startWith, switchMap } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { ReadingListStore } from '../reading-list/reading-list.store';

type BookDetailState = { status: 'loading' | 'not-found' | 'error'; book?: never } | { status: 'success'; book: Book };

@Component({
  selector: 'app-book-detail',
  imports: [AsyncPipe, RouterLink, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-detail.component.html',
  styleUrl: './book-detail.component.css'
})
export class BookDetailComponent {
  protected readonly state$: Observable<BookDetailState>;
  protected readonly coverFailed = signal(false);
  protected readonly readingList = inject(ReadingListStore);
  private readonly route = inject(ActivatedRoute);
  private readonly bookApiClient = inject(BookApiClient);

  protected toggleReadingList(book: Book): void {
    if (this.readingList.has(book.isbn)) {
      this.readingList.remove(book.isbn);
    } else {
      this.readingList.add(book);
    }
  }

  constructor() {
    this.state$ = this.route.paramMap.pipe(
      map(params => params.get('isbn') ?? ''),
      distinctUntilChanged(),
      switchMap(isbn => {
        this.coverFailed.set(false);
        return this.bookApiClient.getBookByIsbn(isbn).pipe(
          map((book): BookDetailState => ({ status: 'success', book })),
          catchError((error: unknown) =>
            of<BookDetailState>({
              status: error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error'
            })
          ),
          startWith<BookDetailState>({ status: 'loading' })
        );
      })
    );
  }
}
