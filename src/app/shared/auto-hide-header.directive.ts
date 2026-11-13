import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Directive({
  selector: '[appAutoHideHeader]',
  host: {
    '[class.header-hidden]': 'hidden()',
    '(pointerenter)': 'onPointerEnter($event)',
    '(pointerleave)': 'onPointerLeave()',
    '(focusin)': 'reveal()',
    '(focusout)': 'onFocusOut($event)'
  }
})
export class AutoHideHeaderDirective implements OnInit {
  protected readonly hidden = signal(false);
  protected pointerInside = false;
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private lastScroll = 0;
  private travel = 0;
  private hoverRevealed = false;

  ngOnInit(): void {
    const window = this.document.defaultView;
    if (!window) return;
    this.lastScroll = window.scrollY;

    const onScroll = () => {
      const position = Math.max(
        0,
        Math.min(window.scrollY, this.document.documentElement.scrollHeight - window.innerHeight)
      );
      const delta = position - this.lastScroll;
      this.lastScroll = position;
      if (position <= 160 || this.pointerInside || this.element.nativeElement.contains(this.document.activeElement)) {
        this.reveal();
        return;
      }
      // Accumulate travel in one direction so tiny scroll changes do not flicker the header.
      this.travel = Math.sign(delta) === Math.sign(this.travel) ? this.travel + delta : delta;
      if (Math.abs(this.travel) >= 28) {
        this.hidden.set(this.travel > 0);
        this.travel = 0;
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (event.clientY <= 12) {
        this.hoverRevealed = true;
        this.reveal();
      } else if (this.hoverRevealed && !this.pointerInside && event.clientY > this.element.nativeElement.offsetHeight) {
        // Also dismiss when the pointer leaves before the reveal animation reaches it.
        this.onPointerLeave();
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
    });
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.lastScroll = window.scrollY;
        this.reveal();
      });
  }

  protected onPointerEnter(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      this.pointerInside = true;
      this.reveal();
    }
  }

  protected onPointerLeave(): void {
    this.pointerInside = false;
    this.hoverRevealed = false;
    this.hideIfInactive();
  }

  protected onFocusOut(event: FocusEvent): void {
    if (!this.element.nativeElement.contains(event.relatedTarget as Node | null)) {
      queueMicrotask(() => this.hideIfInactive());
    }
  }

  private hideIfInactive(): void {
    if (this.pointerInside || (this.document.defaultView?.scrollY ?? 0) <= 160) return;
    if (this.element.nativeElement.contains(this.document.activeElement)) return;
    this.travel = 0;
    this.hidden.set(true);
  }

  protected reveal(): void {
    this.travel = 0;
    this.hidden.set(false);
  }
}
