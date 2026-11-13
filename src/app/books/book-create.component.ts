import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookApiClient } from './book-api-client.service';
import { NewBook } from './book';

function nonBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { blank: true };
}

function positiveInteger(control: AbstractControl<number | null>): ValidationErrors | null {
  return control.value !== null && Number.isInteger(control.value) && control.value > 0 ? null : { pages: true };
}

@Component({
  selector: 'app-book-create',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-create.component.html',
  styleUrl: './book-create.component.css'
})
export class BookCreateComponent {
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly duplicateIsbn = signal(false);
  protected readonly lookupError = signal(false);
  protected readonly form = new FormGroup({
    isbn: new FormControl('', { nonNullable: true, validators: nonBlank }),
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
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected save(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const values = this.form.getRawValue();
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
    this.form.disable();

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

  private create(book: NewBook): void {
    this.api
      .createBook(book)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: created => void this.router.navigate(['/books', created.isbn]),
        error: () => {
          this.saving.set(false);
          this.form.enable();
          this.saveError.set(true);
        }
      });
  }

  private handleDuplicateIsbn(): void {
    this.saving.set(false);
    this.form.enable();
    this.duplicateIsbn.set(true);
  }

  private handleLookupError(): void {
    this.saving.set(false);
    this.form.enable();
    this.lookupError.set(true);
  }

  protected cancel(): void {
    if (!this.saving()) void this.router.navigate(['/']);
  }
}
