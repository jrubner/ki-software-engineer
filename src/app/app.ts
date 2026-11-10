import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ThemeService } from './shared/theme.service';
import { AutoHideHeaderDirective } from './shared/auto-hide-header.directive';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, AutoHideHeaderDirective],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'BookMonkey';
  protected readonly theme = inject(ThemeService);

  protected changeTheme(event: Event): void {
    const preference = (event.target as HTMLSelectElement).value;
    if (preference === 'system' || preference === 'light' || preference === 'dark') {
      this.theme.setPreference(preference);
    }
  }
}
