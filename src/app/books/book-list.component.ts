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
  templateUrl: './book-list.component.html'
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
