import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FreeSpinBonusComponent } from './free-spin-bonus.component';
import { GambaComponent } from './gamba.component';

interface ControlledAnimation {
  animation: Animation;
  finish: () => void;
  cancel: ReturnType<typeof vi.fn>;
}

function controlledAnimation(target: HTMLElement): ControlledAnimation {
  let finish!: () => void;
  let reject!: (reason?: unknown) => void;
  const finished = new Promise<void>((resolve, rejectPromise) => {
    finish = resolve;
    reject = rejectPromise;
  });
  const cancel = vi.fn(() => reject(new DOMException('Animation canceled', 'AbortError')));
  const animation = { finished, effect: { target }, cancel } as unknown as Animation;

  return { animation, finish, cancel };
}

describe('GambaComponent zoneless animation updates', () => {
  let fixture: ComponentFixture<GambaComponent>;
  let animations: ControlledAnimation[];

  beforeEach(async () => {
    animations = [];
    await TestBed.configureTestingModule({
      imports: [GambaComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    fixture = TestBed.createComponent(GambaComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the settled state when native animation promises resolve', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement) {
      const controlled = controlledAnimation(this);
      animations.push(controlled);
      return controlled.animation;
    });

    fixture.componentInstance.spin();
    await fixture.whenStable();

    expect(animations).toHaveLength(5);
    expect(fixture.componentInstance.credits()).toBe(990);
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();

    animations.forEach(animation => animation.finish());
    await Promise.all(animations.map(animation => animation.animation.finished));
    await fixture.whenStable();

    expect(fixture.componentInstance.spinning()).toBe(false);
    expect(fixture.componentInstance.stopped()).toBe(5);
    expect(fixture.nativeElement.querySelector('[aria-busy="false"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.spin-button')!.textContent).toContain('SPIN');
  });

  it('cancels active native animations when destroyed', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement) {
      const controlled = controlledAnimation(this);
      animations.push(controlled);
      return controlled.animation;
    });

    fixture.componentInstance.spin();
    await fixture.whenStable();
    expect(animations).toHaveLength(5);

    fixture.destroy();

    expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
  });

  it('updates fullscreen state from the native document event and removes the listener on destroy', async () => {
    const game = fixture.nativeElement.querySelector('.gamba-page') as HTMLElement;
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    const listener = vi.spyOn(fixture.componentInstance, 'onFullscreenChange');
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: game });

    try {
      document.dispatchEvent(new Event('fullscreenchange'));
      await fixture.whenStable();
      expect(fixture.componentInstance.fullscreen()).toBe(true);
      expect(game.classList.contains('is-fullscreen')).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      fixture.destroy();
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      if (originalDescriptor) Object.defineProperty(document, 'fullscreenElement', originalDescriptor);
      else Reflect.deleteProperty(document, 'fullscreenElement');
    }
  });

  it('cancels the queued autospin timer when destroyed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement) {
      const controlled = controlledAnimation(this);
      animations.push(controlled);
      return controlled.animation;
    });

    fixture.componentInstance.startAuto();
    await fixture.whenStable();
    expect(animations).toHaveLength(5);
    animations.forEach(animation => animation.finish());
    await fixture.whenStable();
    expect(fixture.componentInstance.autoPlaying()).toBe(true);

    fixture.destroy();
    await vi.advanceTimersByTimeAsync(500);

    expect(animate).toHaveBeenCalledTimes(5);
  });
});

describe('FreeSpinBonusComponent zoneless timer updates', () => {
  let fixture: ComponentFixture<FreeSpinBonusComponent>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await TestBed.configureTestingModule({ imports: [FreeSpinBonusComponent] }).compileComponents();
    fixture = TestBed.createComponent(FreeSpinBonusComponent);
    fixture.componentRef.setInput('selected', 'book');
    fixture.componentRef.setInput('retrigger', true);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('updates the bonus dialog after its timer without zone-based change detection', async () => {
    await fixture.whenStable();
    expect(fixture.componentInstance.phase()).toBe('intro');

    await vi.advanceTimersByTimeAsync(1000);
    await fixture.whenStable();

    expect(fixture.componentInstance.phase()).toBe('ready');
    expect(fixture.nativeElement.textContent).toContain('Continue free spins');
  });

  it('cancels its pending timer when the dialog is destroyed', async () => {
    await fixture.whenStable();
    fixture.destroy();

    await vi.advanceTimersByTimeAsync(1000);

    expect(fixture.componentInstance.phase()).toBe('intro');
  });
});
