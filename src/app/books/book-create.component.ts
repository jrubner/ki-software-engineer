import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { disabled, FormField, form, min, required, schema, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { BookApiClient } from './book-api-client.service';
import { NewBook } from './book';

interface BookCreateFormModel {
  isbn: string;
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

const emptyBook: BookCreateFormModel = {
  isbn: '',
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

@Component({
  selector: 'app-book-create',
  imports: [FormField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-create.component.html',
  styleUrl: './book-create.component.css'
})
export class BookCreateComponent {
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly duplicateIsbn = signal(false);
  protected readonly lookupError = signal(false);
  private readonly model = signal<BookCreateFormModel>({ ...emptyBook });
  protected readonly form = form(
    this.model,
    schema<BookCreateFormModel>(path => {
      required(path.isbn);
      required(path.title);
      required(path.author);
      required(path.numPages);
      min(path.numPages, 1);
      validate(path.isbn, context => (context.value().trim() ? null : { kind: 'required', message: 'Enter an ISBN.' }));
      validate(path.title, context =>
        context.value().trim() ? null : { kind: 'required', message: 'Enter a title.' }
      );
      validate(path.author, context =>
        context.value().trim() ? null : { kind: 'required', message: 'Enter an author.' }
      );
      validate(path.numPages, context => {
        const pages = context.value();
        return pages !== null && Number.isInteger(pages) && pages > 0
          ? null
          : { kind: 'pages', message: 'Enter a positive whole number of pages.' };
      });
      disabled(path, () => this.saving());
    })
  );
  private readonly api = inject(BookApiClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.save();
  }

  protected save(): void {
    if (this.saving()) return;
    this.form.isbn().markAsTouched();
    this.form.title().markAsTouched();
    this.form.author().markAsTouched();
    this.form.numPages().markAsTouched();
    if (this.form().invalid()) return;

    const values = this.model();
    const isbn = values.isbn.trim();
    const book: NewBook = {
      isbn,
      title: values.title.trim(),
      subtitle: values.subtitle,
      author: values.author.trim(),
      publisher: values.publisher,
      numPages: values.numPages!,
      price: values.price,
      cover: values.cover,
      abstract: values.abstract,
      userId: 1,
      coAuthors: values.coAuthors
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(Boolean)
    };
    if (values.publishedAt) book.publishedAt = values.publishedAt;

    this.saving.set(true);
    this.saveError.set(false);
    this.duplicateIsbn.set(false);
    this.lookupError.set(false);

    this.api
      .getBookByIsbn(isbn)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.handleDuplicateIsbn(),
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) this.create(book);
          else this.handleLookupError();
        }
      });
  }

  protected onIsbnInput(): void {
    this.duplicateIsbn.set(false);
  }

  private create(book: NewBook): void {
    this.api
      .createBook(book)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: created => void this.router.navigate(['/books', created.isbn]),
        error: () => {
          this.saving.set(false);
          this.saveError.set(true);
        }
      });
  }

  private handleDuplicateIsbn(): void {
    this.saving.set(false);
    this.duplicateIsbn.set(true);
  }

  private handleLookupError(): void {
    this.saving.set(false);
    this.lookupError.set(true);
  }

  protected cancel(): void {
    if (!this.saving()) void this.router.navigate(['/']);
  }
}
