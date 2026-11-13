import { Book } from '../books/book';

export const READING_STATUSES = ['want-to-read', 'currently-reading', 'read'] as const;

export type ReadingStatus = (typeof READING_STATUSES)[number];

export interface ReadingListEntry {
  isbn: string;
  status: ReadingStatus;
  order: number;
  book: Book;
  error?: string;
  loading?: boolean;
}
