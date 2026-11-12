import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, Observable, of, startWith, switchMap } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';

type BookDetailState = { status: 'loading' | 'not-found' | 'error'; book?: never } | { status: 'success'; book: Book };

@Component({
  selector: 'app-book-detail',
  imports: [AsyncPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-detail.component.html'
})
export class BookDetailComponent {
  protected readonly state$: Observable<BookDetailState>;
  protected readonly coverFailed = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly bookApiClient = inject(BookApiClient);

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
