import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookRecommendationsComponent } from './book-recommendations.component';

@Component({
  selector: 'app-editorial-recommendations-page',
  imports: [RouterLink, BookRecommendationsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-shell">
      <a routerLink="/" class="text-link">Back to book collection</a>
      <app-book-recommendations currentIsbn="" [isOverview]="true" />
    </div>
  `
})
export class EditorialRecommendationsPageComponent {}
