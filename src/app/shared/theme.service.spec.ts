import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

class TestMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media = '(prefers-color-scheme: dark)';
  matches = false;
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;

  addListener(listener: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null): void {
    if (listener) this.addEventListener('change', listener as EventListener);
  }

  removeListener(listener: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null): void {
    if (listener) this.removeEventListener('change', listener as EventListener);
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '{{ theme.isDark() ? "dark" : "light" }}'
})
class ThemeHostComponent {
  protected readonly theme = inject(ThemeService);
}

describe('ThemeService', () => {
  let fixture: ComponentFixture<ThemeHostComponent>;
  let media: TestMediaQueryList;

  beforeEach(() => {
    localStorage.removeItem('bookmonkey-theme');
    media = new TestMediaQueryList();
    vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    TestBed.configureTestingModule({ imports: [ThemeHostComponent] });
    fixture = TestBed.createComponent(ThemeHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
    localStorage.removeItem('bookmonkey-theme');
    vi.restoreAllMocks();
  });

  it('updates the rendered theme from a native media-query event without forced detection', async () => {
    expect(fixture.nativeElement.textContent).toBe('light');
    media.change(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('keeps an explicit preference when the system changes and applies cross-tab storage events', async () => {
    media.change(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('dark');

    const theme = TestBed.inject(ThemeService);
    theme.setPreference('light');
    media.change(false);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('light');

    localStorage.setItem('bookmonkey-theme', 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'bookmonkey-theme' }));
    await fixture.whenStable();
    expect(theme.preference()).toBe('dark');
    expect(fixture.nativeElement.textContent).toBe('dark');
  });

  it('continues switching in memory when local storage writes are blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('dark');
    expect(theme.preference()).toBe('dark');
    expect(theme.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('removes media-query and storage listeners when the service injector is destroyed', () => {
    const removeMediaListener = vi.spyOn(media, 'removeEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    fixture.destroy();
    TestBed.resetTestingModule();
    expect(removeMediaListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});
