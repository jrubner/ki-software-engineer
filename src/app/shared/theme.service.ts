import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly media = this.window?.matchMedia('(prefers-color-scheme: dark)');
  private readonly currentPreference = signal<ThemePreference>('system');
  readonly preference = this.currentPreference.asReadonly();
  private readonly currentDark = signal(false);
  readonly isDark = this.currentDark.asReadonly();

  constructor() {
    this.update(this.readPreference());

    const onSystemChange = () => this.apply();
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === 'bookmonkey-theme' || event.key === null) this.update(this.readPreference());
    };
    this.media?.addEventListener('change', onSystemChange);
    this.window?.addEventListener('storage', onStorageChange);
    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', onSystemChange);
      this.window?.removeEventListener('storage', onStorageChange);
    });
  }

  setPreference(preference: ThemePreference): void {
    this.update(preference);
    try {
      if (preference === 'system') this.window?.localStorage.removeItem('bookmonkey-theme');
      else this.window?.localStorage.setItem('bookmonkey-theme', preference);
    } catch {
      // Theme switching still works for this page when storage is blocked.
    }
  }

  toggle(): void {
    this.setPreference(this.isDark() ? 'light' : 'dark');
  }

  private readPreference(): ThemePreference {
    try {
      const stored = this.window?.localStorage.getItem('bookmonkey-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private update(preference: ThemePreference): void {
    this.currentPreference.set(preference);
    this.document.documentElement.dataset['themePreference'] = preference;
    this.apply();
  }

  private apply(): void {
    const preference = this.currentPreference();
    const dark = preference === 'dark' || (preference === 'system' && this.media?.matches);
    this.currentDark.set(Boolean(dark));
    this.document.documentElement.dataset['theme'] = this.isDark() ? 'dark' : 'light';
  }
}
