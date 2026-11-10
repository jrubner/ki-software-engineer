import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, Observable, of, startWith, switchMap } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';

type BookDetailState = { status: 'loading' | 'not-found' | 'error'; book?: never } | { status: 'success'; book: Book };

@Component({
  selector: 'app-book-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './book-detail.component.html'
})
export class BookDetailComponent {
  readonly state$: Observable<BookDetailState>;
  coverFailed = false;

  constructor(route: ActivatedRoute, bookApiClient: BookApiClient) {
    this.state$ = route.paramMap.pipe(
      map(params => params.get('isbn') ?? ''),
      distinctUntilChanged(),
      switchMap(isbn => {
        this.coverFailed = false;
        return bookApiClient.getBookByIsbn(isbn).pipe(
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
