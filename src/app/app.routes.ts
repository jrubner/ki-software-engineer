import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./books/book-list.component').then(module => module.BookListComponent) },
  {
    path: 'books/new',
    loadComponent: () => import('./books/book-create.component').then(module => module.BookCreateComponent)
  },
  {
    path: 'reading-list',
    loadComponent: () =>
      import('./reading-list/reading-list-board.component').then(module => module.ReadingListBoardComponent)
  },
  {
    path: 'books/:isbn/edit',
    loadComponent: () => import('./books/book-edit.component').then(module => module.BookEditComponent)
  },
  {
    path: 'books/:isbn',
    loadComponent: () => import('./books/book-detail.component').then(module => module.BookDetailComponent)
  },
  {
    path: 'gamba',
    loadComponent: () => import('./gamba/gamba.component').then(module => module.GambaComponent),
    title: 'Book of CK | BookMonkey'
  },
  { path: '**', redirectTo: '' }
];
