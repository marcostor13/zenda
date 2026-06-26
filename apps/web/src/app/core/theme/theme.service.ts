import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'zenda-theme';
  readonly darkMode = signal(false);

  constructor() {
    const saved = localStorage.getItem(this.storageKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    this.darkMode.set(isDark);
    this.applyClass(isDark);
  }

  toggle(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    this.applyClass(next);
    localStorage.setItem(this.storageKey, next ? 'dark' : 'light');
  }

  private applyClass(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }
}
