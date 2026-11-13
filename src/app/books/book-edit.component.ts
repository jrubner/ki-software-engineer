import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';

type EditState = { status: 'loading' | 'not-found' | 'error'; book?: never } | { status: 'success'; book: Book };

function nonBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { blank: true };
}

function positiveInteger(control: AbstractControl<number | null>): ValidationErrors | null {
  return control.value !== null && Number.isInteger(control.value) && control.value > 0 ? null : { pages: true };
}

@Component({
  selector: 'app-book-edit',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-edit.component.html',
  styleUrl: './book-edit.component.css'
})
export class BookEditComponent {
  protected readonly state = signal<EditState>({ status: 'loading' });
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: nonBlank }),
    subtitle: new FormControl('', { nonNullable: true }),
    author: new FormControl('', { nonNullable: true, validators: nonBlank }),
    publisher: new FormControl('', { nonNullable: true }),
    numPages: new FormControl<number | null>(null, positiveInteger),
    price: new FormControl('', { nonNullable: true }),
    cover: new FormControl('', { nonNullable: true }),
    abstract: new FormControl('', { nonNullable: true }),
    publishedAt: new FormControl('', { nonNullable: true }),
    coAuthors: new FormControl('', { nonNullable: true })
  });
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
          this.form.enable();
          this.form.reset();
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
        if (state.book) this.fillForm(state.book);
        this.state.set(state);
      });
  }

  private fillForm(book: Book): void {
    this.form.reset({
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
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
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
    this.form.disable();
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
          this.form.enable();
          this.saveError.set(true);
        }
      });
  }

  protected cancel(): void {
    const book = this.state().book;
    if (!this.saving() && book) void this.router.navigate(['/books', book.isbn]);
  }
}
