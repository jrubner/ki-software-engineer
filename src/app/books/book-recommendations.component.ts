import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Book } from './book';
import { EditorialRecommendationsService } from './editorial-recommendations.service';
import { EditorialSelectionDialogComponent } from './editorial-selection-dialog.component';
import { RecommendationCoverComponent } from './recommendation-cover.component';

@Component({
  selector: 'app-book-recommendations',
  imports: [RouterLink, DialogModule, RecommendationCoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="recommendations-heading" class="recommendations">
      <header>
        <div>
          @if (isOverview()) {
            <h1 id="recommendations-heading">Empfehlungen der Redaktion</h1>
          } @else {
            <h2 id="recommendations-heading">Empfehlungen der Redaktion</h2>
          }
        </div>
        @if (isOverview()) {
          <button type="button" class="button-primary" [disabled]="loading() || error()" (click)="edit()">
            Add books
          </button>
        } @else {
          <a routerLink="/editorial-recommendations" class="text-link">Manage recommendations</a>
        }
      </header>
      @if (loading()) {
        <p role="status" class="text-muted">Loading recommendations...</p>
      } @else if (error()) {
        <div class="status-panel" role="alert">
          <p>Unable to load recommendations.</p>
          <button type="button" class="text-link mt-3" (click)="load()">Retry recommendations</button>
        </div>
      } @else {
        @if (visibleBooks().length) {
          <div class="recommendation-grid">
            @for (book of visibleBooks(); track book.isbn) {
              <a [routerLink]="['/books', book.isbn]" [attr.aria-label]="book.title" class="recommendation-card">
                <app-recommendation-cover [cover]="book.cover" />
                <p class="recommendation-author">{{ book.author }}</p>
                <h3>{{ book.title }}</h3>
              </a>
            }
          </div>
        } @else {
          <div class="empty-selection">
            <p>{{ isOverview() ? 'No books selected yet.' : 'No other books selected yet.' }}</p>
            <p class="text-muted mt-2">Choose up to four books to share the editorial selection.</p>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .recommendations {
      margin-top: 3.5rem;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      margin-bottom: 1.75rem;
    }
    h1,
    h2 {
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    header button {
      flex-shrink: 0;
      min-height: 2.75rem;
    }
    .recommendation-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1.5rem;
    }
    .recommendation-card {
      display: block;
      min-width: 0;
      border-radius: 1rem;
      overflow-wrap: anywhere;
    }
    .recommendation-author {
      margin: 1rem 0 0.35rem;
      color: var(--color-muted);
      font-size: 0.875rem;
    }
    h3 {
      font-size: 1.125rem;
      font-weight: 700;
      line-height: 1.4;
    }
    a:hover h3 {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }
    .empty-selection {
      padding: 2rem;
      border: 1px dashed var(--color-line);
      border-radius: 1rem;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    @media (max-width: 760px) {
      .recommendation-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.25rem;
      }
    }
    @media (max-width: 480px) {
      header {
        align-items: start;
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  `
})
export class BookRecommendationsComponent {
  readonly currentIsbn = input.required<string>();
  readonly isOverview = input(false);
  protected readonly books = signal<Book[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly visibleBooks = computed(() =>
    this.books()
      .filter(book => book.isbn !== this.currentIsbn())
      .slice(0, 4)
  );
  private readonly api = inject(EditorialRecommendationsService);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.books.set(result);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        }
      });
  }

  protected edit(): void {
    this.dialog
      .open<Book[]>(EditorialSelectionDialogComponent, {
        data: this.books(),
        width: '52rem',
        maxWidth: 'calc(100vw - 2rem)',
        ariaLabelledBy: 'editorial-dialog-title',
        autoFocus: '#editorial-search'
      })
      .closed.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }
}
