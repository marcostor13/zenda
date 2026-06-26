import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';

interface Vertical {
  key: VerticalKey;
  label: string;
  icon: string;
  descripcion: string;
}

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [ReactiveFormsModule, RsNavbarComponent, RsIconComponent],
  template: `
    <div style="min-height:100vh;background:var(--g-hero)">
      <rs-navbar />

      <div class="rs-wrap" style="padding-block:var(--sp-24) var(--sp-16);text-align:center">

        <p class="rs-label-caps" style="display:inline-flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-5)">
          <rs-icon name="globe" [size]="14" [stroke]="2"></rs-icon>
          Marketplace multi-vertical · Europa
        </p>

        <h1 style="font-size:var(--f-hero);font-weight:var(--w-9);letter-spacing:-.04em;line-height:1.05;color:var(--t-100);margin-bottom:var(--sp-4)">
          Reserva todo lo que<br><span class="rs-gradient-text">necesitas</span>
        </h1>

        <p style="font-size:var(--f-lg);color:var(--t-300);max-width:56ch;margin-inline:auto;line-height:1.7;margin-bottom:var(--sp-8)">
          Hoteles, vuelos, taxis, transporte y guarderías en toda Europa.
          Encuentra el mejor precio y reserva en segundos.
        </p>

        <!-- Selector de vertical -->
        <div class="rs-vtabs" style="justify-content:center;margin-bottom:var(--sp-6)">
          @for (v of verticales; track v.key) {
            <button
              class="rs-vtab"
              [class.active]="verticalSeleccionado() === v.key"
              (click)="seleccionarVertical(v.key)">
              <rs-icon [name]="v.icon" [size]="16" [stroke]="2"></rs-icon>
              {{ v.label }}
            </button>
          }
        </div>

        <!-- Search box -->
        <div class="rs-search" style="max-width:860px;margin-inline:auto;background:rgba(15,30,56,.75);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-color:rgba(255,255,255,.12)">
          <form [formGroup]="formulario" (ngSubmit)="onBuscar()">
            <div class="rs-search__row">
              <div class="rs-field">
                <label class="rs-lbl">Ciudad o zona</label>
                <input formControlName="ciudad" class="rs-inp" placeholder="París, Barcelona, Roma…" />
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Desde</label>
                <input formControlName="fechaInicio" type="date" class="rs-inp" />
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Hasta</label>
                <input formControlName="fechaFin" type="date" class="rs-inp" />
              </div>

              <button type="submit" class="rs-btn rs-btn--primary rs-btn--lg" style="align-self:flex-end;display:inline-flex;align-items:center;gap:var(--sp-2)">
                <rs-icon name="search" [size]="18" [stroke]="2"></rs-icon>
                Buscar
              </button>
            </div>
          </form>
        </div>

        <!-- Stats row -->
        <div style="display:flex;gap:var(--sp-8);margin-top:var(--sp-12);justify-content:center;flex-wrap:wrap">
          @for (stat of stats; track stat.label) {
            <div style="text-align:center">
              <div style="font-size:var(--f-2xl);font-weight:var(--w-9);color:var(--t-100)">
                {{ stat.valor }}
              </div>
              <div style="font-size:var(--f-sm);color:var(--t-400);margin-top:var(--sp-1)">
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
    { key: VerticalKey.HOTELES,    label: 'Hoteles',     icon: 'hotel', descripcion: 'Alojamiento por noches' },
    { key: VerticalKey.VUELOS,     label: 'Vuelos',      icon: 'plane', descripcion: 'Vuelos nacionales e internacionales' },
    { key: VerticalKey.TAXIS,      label: 'Taxis',       icon: 'car',   descripcion: 'Traslados on-demand' },
    { key: VerticalKey.TRANSPORTE, label: 'Transporte',  icon: 'truck', descripcion: 'Carga y mudanzas' },
    { key: VerticalKey.GUARDERIA,  label: 'Guarderías',  icon: 'users', descripcion: 'Cuidado infantil' },
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
