import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookItemComponent } from './book-item.component';

@Component({
  selector: 'app-book-list',
  standalone: true,
  imports: [CommonModule, FormsModule, BookItemComponent],
  template: `
    <div class="page-shell">
      <div class="mb-8 sm:mb-10">
        <p class="eyebrow mb-3">The reading room</p>
        <h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-ink">Book Collection</h1>
        <p class="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Find your next perspective. Explore the collection, follow your curiosity, and take a closer look.
        </p>
      </div>

      <div class="mb-8 sm:mb-10">
        <label for="book-search" class="mb-2 block text-sm font-medium text-ink">Search the collection</label>
        <div
          class="flex items-center gap-3 rounded-2xl border border-line bg-surface-raised px-4 py-1 shadow-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"
        >
          <svg
            aria-hidden="true"
            class="h-5 w-5 shrink-0 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path stroke-linecap="round" d="m16 16 4 4" />
          </svg>
          <input
            id="book-search"
            type="text"
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange()"
            placeholder="Search for books..."
            class="min-w-0 w-full appearance-none border-none bg-transparent py-4 text-base text-ink placeholder:text-muted focus:outline-none"
          />
          <button *ngIf="searchTerm" (click)="clearSearch()" aria-label="Clear search" class="icon-button">
            <svg aria-hidden="true" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <div *ngIf="loading" role="status" class="status-panel">
        <div class="flex flex-col items-center">
          <div
            aria-hidden="true"
            class="h-10 w-10 rounded-full border-2 border-line border-t-accent animate-spin"
          ></div>
          <p class="mt-4 text-muted">Loading books...</p>
        </div>
      </div>

      <div *ngIf="!loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <app-book-item *ngFor="let book of books; trackBy: trackById" [book]="book"></app-book-item>

        <div *ngIf="books.length === 0" role="status" class="col-span-full status-panel">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            class="h-12 w-12 text-accent mb-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p class="text-xl font-semibold text-ink mb-2">
            {{ searchTerm ? 'No books match your search' : 'No books available' }}
          </p>
          <p class="text-muted">
            {{ searchTerm ? 'Try different search terms or clear the search' : 'Check back later' }}
          </p>
          <button *ngIf="searchTerm" (click)="clearSearch()" class="button-primary mt-6">Clear Search</button>
        </div>
      </div>
    </div>
  `
})
export class BookListComponent implements OnInit {
  @Input() pageSize: number = 10;
  books: Book[] = [];
  loading: boolean = true;
  searchTerm: string = '';
  searchTimeout: any;

  constructor(private bookApiClient: BookApiClient) {}

  ngOnInit(): void {
    this.loadBooks();
  }

  private loadBooks(search?: string): void {
    this.loading = true;
    this.bookApiClient.getBooks(this.pageSize, search).subscribe({
      next: books => {
        this.books = books;
        this.loading = false;
      },
      error: error => {
        console.error('Error fetching books:', error);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    // Debounce search to avoid too many API calls while typing
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadBooks(this.searchTerm);
    }, 300);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.loadBooks();
  }

  trackById(index: number, book: Book): string {
    return book.id;
  }
}
