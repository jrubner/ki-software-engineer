import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import { Book, BookPage } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookItemComponent } from './book-item.component';

interface PageRequest {
  page: number;
  search?: string;
}

@Component({
  selector: 'app-book-list',
  imports: [FormsModule, RouterLink, BookItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-list.component.html'
})
export class BookListComponent implements OnInit {
  readonly pageSize = input(10);
  protected readonly books = signal<Book[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchTerm = signal('');
  protected readonly page = signal(1);
  protected readonly totalCount = signal(0);
  protected readonly error = signal(false);
  private readonly bookApiClient = inject(BookApiClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageRequests = new Subject<PageRequest>();
  private appliedSearch: string | undefined;
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.pageRequests
      .pipe(
        switchMap(request => {
          this.page.set(request.page);
          this.loading.set(true);
          this.error.set(false);
          this.books.set([]);
          return this.bookApiClient.getBooksPage(request.page, this.pageSize(), request.search).pipe(
            map(pageResult => ({ request, pageResult })),
            catchError((requestError: unknown) => {
              console.error('Error fetching books:', requestError);
              return of({ request, pageResult: null as BookPage | null });
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ request, pageResult }) => {
        this.loading.set(false);
        if (pageResult === null) {
          this.error.set(true);
          return;
        }

        this.totalCount.set(pageResult.totalCount);
        const lastPage = Math.max(1, Math.ceil(pageResult.totalCount / this.pageSize()));
        if (request.page > lastPage) {
          this.pageRequests.next({ page: lastPage, search: request.search });
          return;
        }

        this.books.set(pageResult.books);
      });

    this.pageRequests.next({ page: 1 });
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimeout));
  }

  protected get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.pageSize()));
  }

  protected goToPage(page: number): void {
    if (this.loading() || page < 1 || page > this.totalPages) return;
    this.pageRequests.next({ page, search: this.appliedSearch });
  }

  protected retry(): void {
    this.pageRequests.next({ page: this.page(), search: this.appliedSearch });
  }

  protected onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.appliedSearch = this.searchTerm() || undefined;
      this.pageRequests.next({ page: 1, search: this.appliedSearch });
    }, 300);
  }

  protected clearSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTerm.set('');
    this.appliedSearch = undefined;
    this.pageRequests.next({ page: 1 });
  }
}
