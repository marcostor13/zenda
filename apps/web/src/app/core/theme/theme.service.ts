import { Injectable, signal } from '@angular/core';
import { almacenLocal, esNavegador } from '../plataforma/almacen';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'zenda-theme';
  readonly darkMode = signal(false);

  constructor() {
    /*
     * En el render de servidor no hay preferencia de tema que consultar ni
     * `<html>` que marcar: se queda en claro, que es el tema de la marca, y el
     * navegador corrige al hidratar si el visitante tiene otra cosa guardada.
     */
    if (!esNavegador()) return;

    const saved = almacenLocal().getItem(this.storageKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    this.darkMode.set(isDark);
    this.applyClass(isDark);
  }

  toggle(): void {
    const next = !this.darkMode();
    this.darkMode.set(next);
    this.applyClass(next);
    almacenLocal().setItem(this.storageKey, next ? 'dark' : 'light');
  }

  private applyClass(dark: boolean): void {
    if (!esNavegador()) return;
    document.documentElement.classList.toggle('dark', dark);
  }
}
