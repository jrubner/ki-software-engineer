export type SpinSpeed = 'Normal' | 'Fast' | 'Turbo';

export const SPIN_SPEEDS: SpinSpeed[] = ['Normal', 'Fast', 'Turbo'];

export function spinDuration(speed: SpinSpeed, reel = 0): number {
  return { Normal: 2100, Fast: 1100, Turbo: 550 }[speed] + reel * { Normal: 180, Fast: 100, Turbo: 60 }[speed];
}

// Percentages keep the strip aligned when fullscreen or viewport changes resize its cells.
export function animateReel(element: HTMLElement, duration: number): Animation {
  const visibleRows = 3;
  const rows = element.children.length;
  const travel = ((rows - visibleRows) / rows) * 100;
  return element.animate(
    [
      { transform: `translateY(-${travel}%)`, offset: 0, easing: 'ease-in' },
      { transform: `translateY(-${travel * 0.9}%)`, offset: 0.16, easing: 'linear' },
      { transform: `translateY(-${travel * 0.22}%)`, offset: 0.7, easing: 'cubic-bezier(.12,.8,.25,1)' },
      { transform: 'translateY(0%)', offset: 1 }
    ],
    { duration, fill: 'both' }
  );
}
