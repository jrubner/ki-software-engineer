import {
  afterNextRender,
  Component,
  ElementRef,
  HostListener,
  inject,
  Injector,
  OnDestroy,
  signal,
  viewChild,
  viewChildren
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { evaluateSpin, Grid, REELS, spinReels, SymbolId, SYMBOLS } from './slot-engine';
import { FreeSpinBonusComponent } from './free-spin-bonus.component';
import { animateReel, SPIN_SPEEDS, SpinSpeed, spinDuration } from './reel-motion';

@Component({
  selector: 'app-gamba',
  imports: [DecimalPipe, RouterLink, FreeSpinBonusComponent],
  templateUrl: './gamba.component.html',
  styleUrls: ['./gamba.component.css', './gamba-effects.css', './gamba-playback.css', './gamba-anticipation.css']
})
export class GambaComponent implements OnDestroy {
  readonly symbols = SYMBOLS;
  readonly bets = [10, 20, 50, 100];
  readonly speed = signal<SpinSpeed>('Normal');
  readonly autoCounts = [10, 25, 50, 100, 250, 500];
  readonly autoCount = signal(10);
  readonly autoRemaining = signal(0);
  readonly autoPlaying = signal(false);
  readonly autoMessage = signal('Choose how many paid spins to play. Bonus spins are extra.');
  readonly credits = signal(1000);
  readonly bet = signal(10);
  readonly freeSpins = signal(0);
  readonly bonusTotal = signal(0);
  readonly lastWin = signal(0);
  readonly spinning = signal(false);
  readonly expandingNow = signal(false);
  readonly anticipating = signal(false);
  readonly focusReel = signal(-1);
  readonly celebratingScatters = signal(false);
  readonly fullscreen = signal(false);
  readonly fullscreenError = signal('');
  readonly stopped = signal(5);
  readonly expanding = signal<SymbolId | undefined>(undefined);
  readonly expandedReels = signal<number[]>([]);
  readonly winningCells = signal<string[]>([]);
  readonly winningLines = signal<number[]>([]);
  readonly message = signal('The next chapter is yours.');
  readonly rulesOpen = signal(false);
  readonly bonus = signal<{ symbol: SymbolId; retrigger: boolean } | null>(null);
  readonly grid = signal<Grid>([
    ['ace', 'scarab', 'king'],
    ['ankh', 'book', 'queen'],
    ['pharaoh', 'ivoris', 'ace'],
    ['king', 'book', 'jack'],
    ['scarab', 'ankh', 'queen']
  ]);
  readonly reelStrips = signal<Grid>([]);
  private readonly tracks = viewChildren<ElementRef<HTMLElement>>('reelTrack');
  private readonly expansionTracks = viewChildren<ElementRef<HTMLElement>>('expansion');
  private readonly game = viewChild.required<ElementRef<HTMLElement>>('game');
  private readonly injector = inject(Injector);
  private readonly animations = new Set<Animation>();
  private scatterAnimations: Animation[] = [];
  private autoTimer?: ReturnType<typeof setTimeout>;

  changeSpeed() {
    this.speed.set(SPIN_SPEEDS[(SPIN_SPEEDS.indexOf(this.speed()) + 1) % SPIN_SPEEDS.length]);
  }

  selectAutoCount(event: Event) {
    const count = Number((event.target as HTMLSelectElement).value);
    if (!this.autoPlaying() && this.autoCounts.includes(count)) this.autoCount.set(count);
  }

  startAuto() {
    if (
      this.autoPlaying() ||
      this.spinning() ||
      this.bonus() ||
      (this.freeSpins() === 0 && this.credits() < this.bet())
    )
      return;
    this.autoRemaining.set(this.autoCount());
    this.autoPlaying.set(true);
    this.autoMessage.set('Autospin running. Bonus selection pauses for your confirmation.');
    this.spin(true);
  }

  stopAuto(message = 'Autospin stopped. The current spin will finish.') {
    clearTimeout(this.autoTimer);
    this.autoPlaying.set(false);
    this.autoMessage.set(message);
  }

  continueBonus() {
    this.bonus.set(null);
    this.queueAuto();
  }

  private queueAuto() {
    clearTimeout(this.autoTimer);
    if (!this.autoPlaying() || this.bonus()) return;
    if (this.freeSpins() === 0 && this.autoRemaining() === 0) {
      this.stopAuto('Autospin complete.');
      return;
    }
    if (this.freeSpins() === 0 && this.credits() < this.bet()) {
      this.stopAuto('Autospin stopped: not enough credits.');
      return;
    }
    this.autoTimer = setTimeout(() => this.spin(true), { Normal: 450, Fast: 250, Turbo: 120 }[this.speed()]);
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.fullscreen.set(document.fullscreenElement === this.game().nativeElement);
  }

  async toggleFullscreen() {
    this.fullscreenError.set('');
    try {
      if (this.fullscreen()) await document.exitFullscreen();
      else await this.game().nativeElement.requestFullscreen();
    } catch {
      this.fullscreenError.set('Fullscreen is unavailable. Please allow fullscreen in your browser.');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onSpace(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest('input, textarea, select, [contenteditable="true"], a, button, [role="button"]') &&
      !target.closest('.spin-button')
    )
      return;
    event.preventDefault();
    if (!event.repeat) this.spin();
  }

  symbol(id: SymbolId) {
    return SYMBOLS.find(symbol => symbol.id === id)!;
  }

  changeBet() {
    if (this.spinning() || this.freeSpins() > 0 || this.autoPlaying()) return;
    this.bet.set(this.bets[(this.bets.indexOf(this.bet()) + 1) % this.bets.length]);
  }

  spin(automatic = false) {
    if (this.autoPlaying() && !automatic) return;
    if (this.bonus() || this.spinning() || (this.freeSpins() === 0 && this.credits() < this.bet())) return;
    const free = this.freeSpins() > 0;
    if (free) this.freeSpins.update(count => count - 1);
    else {
      if (automatic) this.autoRemaining.update(count => count - 1);
      this.credits.update(credits => credits - this.bet());
      this.expanding.set(undefined);
      this.bonusTotal.set(0);
    }
    this.spinning.set(true);
    this.anticipating.set(false);
    this.focusReel.set(-1);
    this.celebratingScatters.set(false);
    this.stopped.set(0);
    this.lastWin.set(0);
    this.winningCells.set([]);
    this.winningLines.set([]);
    this.expandedReels.set([]);
    this.message.set(free ? 'A free chapter unfolds…' : 'Turning the pages…');
    const next = spinReels();
    this.reelStrips.set(next.map((result, reel) => [...result, ...REELS[reel], ...REELS[reel], ...this.grid()[reel]]));
    afterNextRender(
      () => {
        const speed = this.speed();
        const reelAnimations: Animation[] = [];
        this.tracks().forEach((track, reel) => {
          const element = track.nativeElement;
          const animation = animateReel(element, spinDuration(speed, reel));
          reelAnimations.push(animation);
          this.animations.add(animation);
          animation.finished
            .then(() => {
              this.animations.delete(animation);
              this.grid.update(grid => grid.map((column, index) => (index === reel ? next[reel] : column)));
              this.stopped.set(reel + 1);
              const scatters = next
                .slice(0, reel + 1)
                .flat()
                .filter(symbol => symbol === 'ivoris').length;
              if (scatters >= 2 && reel < 4 && !this.anticipating()) {
                this.startAnticipation(reel, reelAnimations, next, speed);
              }
              if (this.anticipating()) this.focusReel.set(reel < 4 ? reel + 1 : -1);
              if (scatters >= 3) this.celebrateScatters(next, free, reel === 4);
              else if (reel === 4) this.finish(next, free);
            })
            .catch(() => {
              /* Navigation cancels unfinished reel animations. */
            });
        });
      },
      { injector: this.injector }
    );
  }

  reset() {
    if (this.spinning() || this.freeSpins() > 0 || this.autoPlaying()) return;
    this.credits.set(1000);
    this.lastWin.set(0);
    this.bonusTotal.set(0);
    this.expanding.set(undefined);
    this.celebratingScatters.set(false);
    this.expandedReels.set([]);
    this.winningCells.set([]);
    this.winningLines.set([]);
    this.message.set('A fresh adventure. 1,000 credits are ready.');
  }

  ngOnDestroy() {
    clearTimeout(this.autoTimer);
    this.animations.forEach(animation => animation.cancel());
  }

  private startAnticipation(reel: number, reels: Animation[], next: Grid, speed: SpinSpeed) {
    this.anticipating.set(true);
    this.message.set('Two Ivoris icons! Watch the remaining reels…');
    const pending = reels.slice(reel + 1).map(animation => {
      const element = (animation.effect as KeyframeEffect).target as HTMLElement;
      const rowHeight = element.firstElementChild!.getBoundingClientRect().height;
      const offset = -new DOMMatrix(getComputedStyle(element).transform).m42 / rowHeight;
      animation.pause();
      return { animation, element, offset };
    });
    // Prepending a full turn preserves the visible position while allowing a real, slower roll.
    this.reelStrips.update(strips =>
      strips.map((strip, index) => (index > reel ? [...next[index], ...REELS[index], ...strip] : strip))
    );
    afterNextRender(
      () => {
        pending.forEach(({ animation, element, offset }, index) => {
          const addedRows = 3 + REELS[reel + index + 1].length;
          const travel = ((offset + addedRows) / element.children.length) * 100;
          const effect = animation.effect as KeyframeEffect;
          effect.setKeyframes([
            { transform: `translateY(-${travel}%)`, offset: 0, easing: 'linear' },
            { transform: `translateY(-${travel * 0.15}%)`, offset: 0.65, easing: 'cubic-bezier(.2,.7,.3,1)' },
            { transform: 'translateY(0%)', offset: 1 }
          ]);
          effect.updateTiming({ duration: (index + 1) * { Normal: 1500, Fast: 1200, Turbo: 950 }[speed] });
          animation.currentTime = 0;
          animation.play();
        });
      },
      { injector: this.injector }
    );
  }

  private celebrateScatters(grid: Grid, free: boolean, lastReel: boolean) {
    this.celebratingScatters.set(true);
    this.message.set('Free spins unlocked!');
    this.scatterAnimations.forEach(animation => {
      animation.cancel();
      this.animations.delete(animation);
    });
    afterNextRender(
      () => {
        const icons = this.game().nativeElement.querySelectorAll<HTMLElement>(
          '.reel:not(.reel-spinning) .symbol-cell[data-symbol="ivoris"] .scatter-icon'
        );
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.scatterAnimations = Array.from(icons, icon => {
          const animation = icon.animate(
            reduced
              ? [{ opacity: 0.6 }, { opacity: 1 }]
              : [
                  { transform: 'perspective(500px) rotateY(0deg) scale(1)' },
                  { transform: 'perspective(500px) rotateY(360deg) scale(1.18)', offset: 0.5 },
                  { transform: 'perspective(500px) rotateY(0deg) scale(1)' }
                ],
            { duration: reduced ? 250 : 1100, easing: 'ease-in-out' }
          );
          this.animations.add(animation);
          return animation;
        });
        const celebration = this.scatterAnimations;
        Promise.all(celebration.map(animation => animation.finished))
          .then(() => {
            celebration.forEach(animation => this.animations.delete(animation));
            if (lastReel) {
              this.anticipating.set(false);
              this.finish(grid, free);
            }
          })
          .catch(() => {
            /* The next landed icon restarts the celebration; navigation cancels it. */
          });
      },
      { injector: this.injector }
    );
  }

  private finish(grid: Grid, free: boolean) {
    const result = evaluateSpin(grid, this.bet(), free ? this.expanding() : undefined);
    this.expandedReels.set(result.expandedReels);
    if (result.expandedReels.length) {
      this.expandingNow.set(true);
      this.message.set(`${this.symbol(this.expanding()!).label} expands across ${result.expandedReels.length} reels!`);
      afterNextRender(
        () => {
          const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
          const animations = this.expansionTracks().map((track, index) => {
            const reel = result.expandedReels[index];
            const row = grid[reel].indexOf(this.expanding()!);
            const animation = track.nativeElement.animate(
              reduced
                ? [{ opacity: 0 }, { opacity: 1 }]
                : [
                    { clipPath: `inset(${(row * 100) / 3}% 0 ${((2 - row) * 100) / 3}% 0)`, filter: 'brightness(1.8)' },
                    { clipPath: 'inset(0% 0 0% 0)', filter: 'brightness(1)' }
                  ],
              {
                duration: reduced ? 120 : 800,
                delay: reduced ? 0 : 250 + index * 220,
                easing: 'ease-in-out',
                fill: 'both'
              }
            );
            this.animations.add(animation);
            return animation;
          });
          Promise.all(animations.map(animation => animation.finished))
            .then(() => {
              animations.forEach(animation => {
                animation.cancel();
                this.animations.delete(animation);
              });
              this.expandingNow.set(false);
              this.settle(grid, free, result);
            })
            .catch(() => {
              /* Navigation cancels the bonus sequence. */
            });
        },
        { injector: this.injector }
      );
    } else this.settle(grid, free, result);
  }

  private settle(grid: Grid, free: boolean, result: ReturnType<typeof evaluateSpin>) {
    this.credits.update(credits => Math.round((credits + result.total) * 100) / 100);
    this.lastWin.set(result.total);
    this.winningLines.set(result.lineWins.map(win => win.line));
    this.winningCells.set([
      ...result.lineWins.flatMap(win => win.cells),
      ...grid.flatMap((reel, x) =>
        reel.flatMap((symbol, y) => (result.freeSpins && symbol === 'ivoris' ? [`${x}-${y}`] : []))
      )
    ]);
    if (free) this.bonusTotal.update(total => Math.round((total + result.total) * 100) / 100);
    if (result.freeSpins) {
      if (!free) {
        const options = SYMBOLS.filter(symbol => symbol.id !== 'ivoris');
        this.expanding.set(options[Math.floor(Math.random() * options.length)].id);
      }
      this.freeSpins.update(count => count + result.freeSpins);
      this.bonus.set({ symbol: this.expanding()!, retrigger: free });
      this.message.set(
        `${result.freeSpins} free spins ${free ? 'added' : 'unlocked'}! Your expanding symbol: ${this.symbol(this.expanding()!).label}.`
      );
    } else if (free && this.freeSpins() === 0) {
      this.message.set(`Free spins complete. ${this.bonusTotal()} credits won in the bonus!`);
    } else {
      this.message.set(
        result.total > 0 ? `${result.total} credits won. A chapter worth keeping.` : 'A new chapter awaits. Spin again.'
      );
    }
    this.spinning.set(false);
    this.queueAuto();
  }
}
