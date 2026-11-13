import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Book, BookPage, NewBook } from './book';

@Injectable({ providedIn: 'root' })
export class BookApiClient {
  private readonly apiUrl = 'http://localhost:4730/books';

  private readonly http = inject(HttpClient);

  getBookByIsbn(isbn: string): Observable<Book> {
    return this.http.get<Book>(`${this.apiUrl}/${encodeURIComponent(isbn)}`);
  }

  updateBook(book: Book): Observable<Book> {
    return this.http.put<Book>(`${this.apiUrl}/${encodeURIComponent(book.isbn)}`, book);
  }

  createBook(book: NewBook): Observable<Book> {
    return this.http.post<Book>(this.apiUrl, book);
  }

  getBooksPage(page: number, pageSize = 10, searchTerm?: string): Observable<BookPage> {
    let params = new HttpParams().set('_page', page).set('_limit', pageSize);
    if (searchTerm) params = params.set('q', searchTerm);
    return this.http.get<Book[]>(this.apiUrl, { params, observe: 'response' }).pipe(
      map(response => {
        const header = response.headers.get('X-Total-Count');
        const totalCount = Number(header);
        if (header === null || !/^\d+$/.test(header.trim()) || !Number.isSafeInteger(totalCount)) {
          throw new Error('The books response must include a valid X-Total-Count header.');
        }
        return { books: response.body ?? [], totalCount };
      })
    );
  }

  getBooks(pageSize = 10, searchTerm?: string): Observable<Book[]> {
    let params = new HttpParams().set('_limit', pageSize.toString());

    if (searchTerm) {
      // Search in title and author fields
      params = params.set('q', searchTerm);
    }

    return this.http.get<Book[]>(this.apiUrl, { params });
  }
}
