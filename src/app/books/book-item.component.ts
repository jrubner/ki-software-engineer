import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Book } from './book';

@Component({
  selector: 'app-book-item',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <a
      [routerLink]="['/books', book.isbn]"
      [attr.aria-label]="book.title"
      class="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors duration-200 hover:border-accent/50"
    >
      <div class="relative aspect-[4/5] overflow-hidden border-b border-line bg-surface-soft p-6">
        <img
          *ngIf="book.cover"
          [src]="book.cover"
          [alt]="book.title"
          class="w-full h-full object-contain drop-shadow-md"
        />
        <div *ngIf="!book.cover" class="w-full h-full flex items-center justify-center">
          <span class="text-muted text-sm font-medium">No cover available</span>
        </div>
      </div>
      <div class="p-5 flex flex-col flex-grow">
        <h2 class="text-lg font-semibold leading-snug tracking-tight text-ink mb-2">
          <span class="group-hover:text-accent group-hover:underline underline-offset-4">{{ book.title }}</span>
        </h2>
        <p *ngIf="book.subtitle" class="text-sm leading-relaxed text-muted mb-5 line-clamp-2">{{ book.subtitle }}</p>
        <div class="mt-auto border-t border-line pt-4">
          <p class="text-sm font-medium text-accent">{{ book.author }}</p>
          <p *ngIf="book.isbn" class="text-xs tracking-wide text-muted mt-2">ISBN: {{ book.isbn }}</p>
        </div>
      </div>
    </a>
  `
})
export class BookItemComponent {
  @Input() book!: Book;

  // No longer needed as we have a single author field
}
