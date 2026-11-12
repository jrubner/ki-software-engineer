import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookItemComponent } from './book-item.component';

@Component({
  selector: 'app-book-list',
  imports: [FormsModule, BookItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-list.component.html'
})
export class BookListComponent implements OnInit {
  readonly pageSize = input(10);
  protected readonly books = signal<Book[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchTerm = signal('');
  private readonly bookApiClient = inject(BookApiClient);
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.loadBooks();
  }

  private loadBooks(search?: string): void {
    this.loading.set(true);
    this.bookApiClient.getBooks(this.pageSize(), search).subscribe({
      next: books => {
        this.books.set(books);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        console.error('Error fetching books:', error);
        this.loading.set(false);
      }
    });
  }

  protected onSearchChange(): void {
    // Debounce search to avoid too many API calls while typing
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadBooks(this.searchTerm());
    }, 300);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.loadBooks();
  }
}
