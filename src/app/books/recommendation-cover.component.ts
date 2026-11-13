import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-recommendation-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cover() && failedCover() !== cover()) {
      <img [src]="cover()" alt="" loading="lazy" (error)="failedCover.set(cover())" />
    } @else {
      <span>No cover available</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 4 / 5;
      padding: 1rem;
      border: 1px solid var(--color-line);
      border-radius: 1rem;
      background: var(--color-surface-soft);
      color: var(--color-muted);
      text-align: center;
      font-size: 0.875rem;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      min-height: 0;
    }
  `
})
export class RecommendationCoverComponent {
  readonly cover = input.required<string>();
  protected readonly failedCover = signal<string | null>(null);
}
