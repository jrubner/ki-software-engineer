import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./books/book-list.component').then(module => module.BookListComponent) },
  {
    path: 'books/:isbn',
    loadComponent: () => import('./books/book-detail.component').then(module => module.BookDetailComponent)
  },
  { path: '**', redirectTo: '' }
];
