import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { concatMap, from, map, Observable, switchMap, toArray } from 'rxjs';
import { Book } from './book';

@Injectable({ providedIn: 'root' })
export class EditorialRecommendationsService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://localhost:4730/books';

  load(): Observable<Book[]> {
    const params = new HttpParams().set('editorialRecommendation_like', '^true$');
    return this.http
      .get<Book[]>(this.url, { params })
      .pipe(
        map(books =>
          books
            .filter(book => book.editorialRecommendation === true)
            .sort((left, right) => (left.editorialRecommendationOrder ?? 0) - (right.editorialRecommendationOrder ?? 0))
        )
      );
  }

  save(books: Book[]): Observable<Book[]> {
    return this.load().pipe(
      switchMap(current => {
        const removed = current.filter(book => !books.some(selected => selected.isbn === book.isbn));
        const changes = [
          ...removed.map(book => ({
            isbn: book.isbn,
            editorialRecommendation: false,
            editorialRecommendationOrder: 0
          })),
          ...books.map((book, order) => ({
            isbn: book.isbn,
            editorialRecommendation: true,
            editorialRecommendationOrder: order
          }))
        ];
        return from(changes).pipe(
          concatMap(({ isbn, ...fields }) => this.http.patch<Book>(`${this.url}/${encodeURIComponent(isbn)}`, fields)),
          toArray()
        );
      }),
      switchMap(() => this.load())
    );
  }
}
