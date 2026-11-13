import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';
import { ReadingListStore } from './reading-list.store';
import { ReadingListEntry, ReadingStatus, READING_STATUSES } from './reading-list.types';

@Component({
  selector: 'app-reading-list-board',
  imports: [DragDropModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reading-list-board.component.html',
  styleUrl: './reading-list-board.component.css'
})
export class ReadingListBoardComponent implements OnInit {
  protected readonly store = inject(ReadingListStore);
  protected readonly statuses: ReadingStatus[] = [...READING_STATUSES];
  protected readonly failedCovers = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    this.store.refresh();
  }

  protected entriesFor(status: ReadingStatus): ReadingListEntry[] {
    return this.store
      .entries()
      .filter(entry => entry.status === status)
      .sort((left, right) => left.order - right.order);
  }

  protected label(status: ReadingStatus): string {
    return status === 'want-to-read' ? 'Want to read' : status === 'currently-reading' ? 'Currently reading' : 'Read';
  }

  protected hideCover(isbn: string): void {
    this.failedCovers.update(covers => new Set([...covers, isbn]));
  }

  protected drop(event: CdkDragDrop<ReadingListEntry[]>, status: ReadingStatus): void {
    const entry = event.item.data as ReadingListEntry;
    this.store.move(entry.isbn, status, event.currentIndex);
  }
}
