import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  output,
  signal,
  viewChild
} from '@angular/core';
import { SymbolId, SYMBOLS } from './slot-engine';
import { animateReel, SpinSpeed, spinDuration } from './reel-motion';

@Component({
  selector: 'app-free-spin-bonus',
  templateUrl: './free-spin-bonus.component.html',
  styleUrl: './free-spin-bonus.component.css'
})
export class FreeSpinBonusComponent implements OnDestroy {
  readonly selected = input.required<SymbolId>();
  readonly retrigger = input(false);
  readonly speed = input<SpinSpeed>('Normal');
  readonly autoplay = input(false);
  readonly stopAutoplay = output<void>();
  readonly completed = output<void>();
  readonly phase = signal<'intro' | 'waiting' | 'selecting' | 'ready'>('intro');
  readonly choices = SYMBOLS.filter(symbol => symbol.id !== 'ivoris');
  readonly preview: SymbolId[] = ['book', 'pharaoh', 'scarab'];
  readonly finalSymbols = computed(() => {
    const index = this.choices.findIndex(symbol => symbol.id === this.selected());
    return [this.choices[(index + 7) % 8].id, this.selected(), this.choices[(index + 1) % 8].id];
  });
  readonly strip = signal<SymbolId[]>([]);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly track = viewChild<ElementRef<HTMLElement>>('selectionTrack');
  private readonly injector = inject(Injector);
  private timer?: ReturnType<typeof setTimeout>;
  private animation?: Animation;

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.timer = setTimeout(() => this.phase.set(this.retrigger() ? 'ready' : 'waiting'), 1000);
    });
  }

  symbol(id: SymbolId) {
    return SYMBOLS.find(symbol => symbol.id === id)!;
  }

  close() {
    if (this.phase() === 'ready') this.completed.emit();
    else if (this.phase() === 'intro' || this.phase() === 'waiting') {
      clearTimeout(this.timer);
      if (this.retrigger()) this.phase.set('ready');
      else this.selectSymbol();
    } else {
      clearTimeout(this.timer);
      this.animation?.cancel();
      this.phase.set('ready');
    }
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
    this.animation?.cancel();
    this.dialog().nativeElement.close();
  }

  private selectSymbol() {
    if (this.retrigger()) {
      this.phase.set('ready');
      return;
    }
    this.strip.set([
      ...this.finalSymbols(),
      ...Array.from({ length: 6 }, () => this.choices.map(symbol => symbol.id)).flat(),
      ...this.choices.slice(0, 3).map(symbol => symbol.id)
    ]);
    this.phase.set('selecting');
    afterNextRender(
      () => {
        const track = this.track()!.nativeElement;
        this.animation = animateReel(track, spinDuration(this.speed()) + 800);
        this.animation.finished
          .then(() => this.phase.set('ready'))
          .catch(() => {
            /* Closing the dialog cancels selection. */
          });
      },
      { injector: this.injector }
    );
  }
}
