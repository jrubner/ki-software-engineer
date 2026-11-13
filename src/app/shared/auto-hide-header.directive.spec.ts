import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AutoHideHeaderDirective } from './auto-hide-header.directive';

@Component({
  imports: [AutoHideHeaderDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<header appAutoHideHeader><button type="button">Open menu</button></header>'
})
class HeaderHostComponent {}

describe('AutoHideHeaderDirective', () => {
  let fixture: ComponentFixture<HeaderHostComponent>;
  let routerEvents: Subject<unknown>;
  let scrollPosition: number;
  let originalScrollY: PropertyDescriptor | undefined;
  let originalScrollHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    routerEvents = new Subject<unknown>();
    scrollPosition = 0;
    originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    originalScrollHeight = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight');
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollPosition });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 3000 });
    TestBed.configureTestingModule({
      imports: [HeaderHostComponent],
      providers: [{ provide: Router, useValue: { events: routerEvents.asObservable() } }]
    });
    fixture = TestBed.createComponent(HeaderHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    routerEvents.complete();
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    else Reflect.deleteProperty(window, 'scrollY');
    if (originalScrollHeight) Object.defineProperty(document.documentElement, 'scrollHeight', originalScrollHeight);
    else Reflect.deleteProperty(document.documentElement, 'scrollHeight');
    vi.restoreAllMocks();
  });

  function header(): HTMLElement {
    return fixture.nativeElement.querySelector('header');
  }

  async function scrollTo(position: number): Promise<void> {
    scrollPosition = position;
    window.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
  }

  it('updates visibility from native scroll events without forcing change detection', async () => {
    await scrollTo(200);
    expect(header().classList).toContain('header-hidden');

    await scrollTo(170);
    expect(header().classList).not.toContain('header-hidden');
  });

  it('keeps the header open while focused and hides it after focus leaves', async () => {
    await scrollTo(200);
    const button = header().querySelector('button')!;
    button.focus();
    await fixture.whenStable();
    await scrollTo(240);
    expect(header().classList).not.toContain('header-hidden');

    button.blur();
    await Promise.resolve();
    await fixture.whenStable();
    expect(header().classList).toContain('header-hidden');
  });

  it('reveals on native pointer entry, hides on leave, and ignores touch hover', async () => {
    await scrollTo(200);
    header().dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(header().classList).not.toContain('header-hidden');

    header().dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(header().classList).toContain('header-hidden');

    header().dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    await fixture.whenStable();
    expect(header().classList).toContain('header-hidden');
  });

  it('reveals after a NavigationEnd event', async () => {
    await scrollTo(200);
    routerEvents.next(new NavigationEnd(1, '/books', '/reading-list'));
    await fixture.whenStable();
    expect(header().classList).not.toContain('header-hidden');
  });

  it('removes native listeners when the directive is destroyed', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    fixture.destroy();
    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
  });
});
