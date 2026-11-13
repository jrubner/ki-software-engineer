import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, disabled, form, min, required, schema, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';

type EditState = { status: 'loading' | 'not-found' | 'error'; book?: never } | { status: 'success'; book: Book };

interface EditModel {
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  numPages: number | null;
  price: string;
  cover: string;
  abstract: string;
  publishedAt: string;
  coAuthors: string;
}

@Component({
  selector: 'app-book-edit',
  imports: [FormField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-edit.component.html',
  styleUrl: './book-edit.component.css'
})
export class BookEditComponent {
  protected readonly state = signal<EditState>({ status: 'loading' });
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly model = signal<EditModel>(this.emptyModel());
  protected readonly form = form(
    this.model,
    schema(path => {
      disabled(path, () => this.saving());
      required(path.title);
      required(path.author);
      required(path.numPages);
      min(path.numPages, 1);
      validate(path.title, ({ value }) => (value().trim() ? null : { kind: 'required', message: 'Enter a title.' }));
      validate(path.author, ({ value }) => (value().trim() ? null : { kind: 'required', message: 'Enter an author.' }));
      validate(path.numPages, ({ value }) =>
        value() !== null && Number.isInteger(value()) && value()! > 0
          ? null
          : { kind: 'pages', message: 'Enter a positive whole number of pages.' }
      );
    })
  );
  private readonly api = inject(BookApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.route.paramMap
      .pipe(
        map(params => params.get('isbn') ?? ''),
        distinctUntilChanged(),
        switchMap(isbn => {
          this.saving.set(false);
          this.saveError.set(false);
          this.form().reset(this.emptyModel());
          return this.api.getBookByIsbn(isbn).pipe(
            map((book): EditState => ({ status: 'success', book })),
            catchError((error: unknown) =>
              of<EditState>({
                status: error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error'
              })
            ),
            startWith<EditState>({ status: 'loading' })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(state => {
        if (state.book) this.fillModel(state.book);
        this.state.set(state);
      });
  }

  private emptyModel(): EditModel {
    return {
      title: '',
      subtitle: '',
      author: '',
      publisher: '',
      numPages: null,
      price: '',
      cover: '',
      abstract: '',
      publishedAt: '',
      coAuthors: ''
    };
  }

  private fillModel(book: Book): void {
    this.form().reset({
      title: book.title,
      subtitle: book.subtitle ?? '',
      author: book.author,
      publisher: book.publisher ?? '',
      numPages: book.numPages ?? null,
      price: book.price ?? '',
      cover: book.cover ?? '',
      abstract: book.abstract ?? '',
      publishedAt: book.publishedAt ?? '',
      coAuthors: book.coAuthors?.join('\n') ?? ''
    });
  }

  protected save(): void {
    const state = this.state();
    if (this.saving() || !state.book) return;
    this.form.title().markAsTouched();
    this.form.author().markAsTouched();
    this.form.numPages().markAsTouched();
    if (this.form().invalid()) return;
    const values = this.model();
    const book: Book = {
      ...state.book,
      ...values,
      numPages: values.numPages!,
      coAuthors: values.coAuthors
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(Boolean)
    };
    if (!book.publishedAt) delete book.publishedAt;
    this.saving.set(true);
    this.saveError.set(false);
    this.api
      .updateBook(book)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.state() === state) void this.router.navigate(['/books', state.book.isbn]);
        },
        error: () => {
          if (this.state() !== state) return;
          this.saving.set(false);
          this.saveError.set(true);
        }
      });
  }

  protected cancel(): void {
    const book = this.state().book;
    if (!this.saving() && book) void this.router.navigate(['/books', book.isbn]);
  }
}
