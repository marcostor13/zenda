import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';

interface Vertical {
  key: VerticalKey;
  label: string;
  emoji: string;
  descripcion: string;
}

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [ReactiveFormsModule, RsNavbarComponent],
  template: `
    <div class="rs-buscador-hero">
      <rs-navbar />

      <div class="rs-buscador-hero__content">

        <div class="rs-buscador-hero__eyebrow">
          ✦ Marketplace multi-vertical · Perú
        </div>

        <h1 class="rs-buscador-hero__heading">
          Reserva todo lo que<br><span>necesitas</span>
        </h1>

        <p class="rs-buscador-hero__subheading">
          Hoteles, vuelos, taxis, transporte y guarderías en un solo lugar.
          Encuentra el mejor precio y reserva en segundos.
        </p>

        <!-- Selector de vertical -->
        <div class="rs-vertical-tabs" style="margin-bottom:var(--s-6)">
          @for (v of verticales; track v.key) {
            <button
              class="rs-vertical-tab"
              [class.activo]="verticalSeleccionado() === v.key"
              (click)="seleccionarVertical(v.key)">
              {{ v.emoji }} {{ v.label }}
            </button>
          }
        </div>

        <!-- Search box -->
        <div class="rs-search-box">
          <form [formGroup]="formulario" (ngSubmit)="onBuscar()">
            <div class="rs-search-box__row">
              <div class="rs-form-group">
                <label class="rs-label">Ciudad o zona</label>
                <input
                  formControlName="ciudad"
                  class="rs-input"
                  placeholder="Lima, Cusco, Arequipa…" />
              </div>

              <div class="rs-form-group">
                <label class="rs-label">Desde</label>
                <input
                  formControlName="fechaInicio"
                  type="date"
                  class="rs-input" />
              </div>

              <div class="rs-form-group">
                <label class="rs-label">Hasta</label>
                <input
                  formControlName="fechaFin"
                  type="date"
                  class="rs-input" />
              </div>

              <button
                type="submit"
                class="rs-btn rs-btn--primary rs-btn--lg"
                style="align-self:flex-end">
                Buscar
              </button>
            </div>
          </form>
        </div>

        <!-- Stats row -->
        <div style="display:flex;gap:var(--s-8);margin-top:var(--s-12)">
          @for (stat of stats; track stat.label) {
            <div style="text-align:center">
              <div style="font-size:var(--text-2xl);font-weight:var(--fw-extrabold);color:var(--text-primary)">
                {{ stat.valor }}
              </div>
              <div style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--s-1)">
                {{ stat.label }}
              </div>
            </div>
          }
        </div>

      </div>
    </div>
  `,
})
export class BuscadorComponent {
  private readonly fb = inject(FormBuilder);

  readonly verticalSeleccionado = signal<VerticalKey>(VerticalKey.HOTELES);

  readonly verticales: Vertical[] = [
    { key: VerticalKey.HOTELES,    label: 'Hoteles',     emoji: '🏨', descripcion: 'Alojamiento por noches' },
    { key: VerticalKey.VUELOS,     label: 'Vuelos',      emoji: '✈️', descripcion: 'Vuelos nacionales e internacionales' },
    { key: VerticalKey.TAXIS,      label: 'Taxis',       emoji: '🚕', descripcion: 'Traslados on-demand' },
    { key: VerticalKey.TRANSPORTE, label: 'Transporte',  emoji: '🚛', descripcion: 'Carga y mudanzas' },
    { key: VerticalKey.GUARDERIA,  label: 'Guarderías',  emoji: '👶', descripcion: 'Cuidado infantil' },
  ];

  readonly stats = [
    { valor: '+2,400',  label: 'Proveedores' },
    { valor: '+48,000', label: 'Reservas' },
    { valor: '4.8★',    label: 'Calificación' },
    { valor: '5',       label: 'Verticales' },
  ];

  readonly formulario = this.fb.group({
    ciudad: [''],
    fechaInicio: [''],
    fechaFin: [''],
  });

  seleccionarVertical(vertical: VerticalKey): void {
    this.verticalSeleccionado.set(vertical);
  }

  onBuscar(): void {
    // TODO: routing a resultados por vertical con los parámetros del formulario
  }
}
