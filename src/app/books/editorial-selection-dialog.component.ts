import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { catchError, of, Subject, switchMap, timer } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { EditorialRecommendationsService } from './editorial-recommendations.service';
import { RecommendationCoverComponent } from './recommendation-cover.component';

@Component({
  selector: 'app-editorial-selection-dialog',
  imports: [FormField, RecommendationCoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editorial-selection-dialog.component.html',
  styleUrl: './editorial-selection-dialog.component.css'
})
export class EditorialSelectionDialogComponent {
  protected readonly dialog = inject(DialogRef<Book[]>);
  protected readonly selected = signal<Book[]>([...inject<Book[]>(DIALOG_DATA)]);
  protected readonly searchModel = signal({ term: '' });
  protected readonly searchForm = form(this.searchModel);
  protected readonly results = signal<Book[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly saveError = signal(false);
  protected readonly saving = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  private readonly api = inject(BookApiClient);
  private readonly recommendations = inject(EditorialRecommendationsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<{ page: number; delay: number }>();

  constructor() {
    this.requests
      .pipe(
        switchMap(request => {
          this.loading.set(true);
          this.error.set(false);
          this.results.set([]);
          this.page.set(request.page);
          return timer(request.delay).pipe(
            switchMap(() => this.api.getBooksPage(request.page, 8, this.searchModel().term.trim() || undefined)),
            catchError(() => of(null))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        this.loading.set(false);
        this.error.set(result === null);
        this.results.set(result?.books ?? []);
        this.total.set(result?.totalCount ?? 0);
      });
    this.search();
  }

  protected search(delay = 0): void {
    this.requests.next({ page: 1, delay });
  }

  protected changePage(page: number): void {
    this.requests.next({ page, delay: 0 });
  }

  protected has(isbn: string): boolean {
    return this.selected().some(book => book.isbn === isbn);
  }

  protected toggle(book: Book): void {
    if (this.saving()) return;
    if (this.has(book.isbn)) this.selected.update(books => books.filter(item => item.isbn !== book.isbn));
    else if (this.selected().length < 4) this.selected.update(books => [...books, book]);
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set(false);
    this.dialog.disableClose = true;
    this.recommendations
      .save(this.selected())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: books => this.dialog.close(books),
        error: () => {
          this.saving.set(false);
          this.saveError.set(true);
          this.dialog.disableClose = false;
        }
      });
  }
}
