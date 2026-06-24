import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { VerticalKey } from 'shared';

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="buscador-container">
      <h1>¿Qué buscas?</h1>

      <div class="verticales">
        @for (vertical of verticales; track vertical.key) {
          <button
            [class.activo]="verticalSeleccionado() === vertical.key"
            (click)="seleccionarVertical(vertical.key)">
            {{ vertical.label }}
          </button>
        }
      </div>

      <form [formGroup]="formulario" (ngSubmit)="onBuscar()">
        <input formControlName="ciudad" placeholder="Ciudad o zona" />
        <input formControlName="fechaInicio" type="date" />
        <input formControlName="fechaFin" type="date" />
        <button type="submit">Buscar</button>
      </form>
    </div>
  `,
})
export class BuscadorComponent {
  private readonly fb = inject(FormBuilder);

  readonly verticalSeleccionado = signal<VerticalKey>(VerticalKey.HOTELES);

  readonly verticales = [
    { key: VerticalKey.HOTELES, label: 'Hoteles' },
    { key: VerticalKey.VUELOS, label: 'Vuelos' },
    { key: VerticalKey.TAXIS, label: 'Taxis' },
    { key: VerticalKey.TRANSPORTE, label: 'Transporte' },
    { key: VerticalKey.GUARDERIA, label: 'Guarderías' },
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
    // TODO: implementar búsqueda y routing a resultados por vertical
  }
}
