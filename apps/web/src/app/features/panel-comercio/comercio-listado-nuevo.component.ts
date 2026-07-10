import { Component, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { ComercioApiService } from './comercio-api.service';

const VERTICALES: ReadonlyArray<{ valor: string; label: string }> = Object.values(VerticalKey)
  .map(valor => ({ valor, label: VERTICAL_LABELS[valor] }));

/** Placeholder del nombre según la categoría elegida. */
const PLACEHOLDER_TITULO: Record<string, string> = {
  [VerticalKey.ALOJAMIENTO]:    'Ej. Residencia Canina Villa Perruna',
  [VerticalKey.TRANSPORTE]:     'Ej. DogVan Traslados Madrid',
  [VerticalKey.VETERINARIA]:    'Ej. Clínica Veterinaria San Bernardo',
  [VerticalKey.PELUQUERIA]:     'Ej. Peluquería Canina Real Grooming',
  [VerticalKey.ADIESTRAMIENTO]: 'Ej. Escuela Canina Rey Adiestradores',
};

@Component({
  selector: 'app-comercio-listado-nuevo',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsIconComponent, RsImageUploadComponent],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <a routerLink="/comercio/listados" class="back-link">
          <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
          Volver a listados
        </a>
        <h1>Nuevo listado</h1>
        <p>Crea un nuevo servicio en borrador. Podrás publicarlo cuando esté listo.</p>
      </div>

      <div class="form-card rs-card">
        <form [formGroup]="form" (ngSubmit)="submit()">

          <!-- CATEGORÍA -->
          <div class="rs-field">
            <label class="rs-lbl" for="vertical">Categoría *</label>
            <select id="vertical" class="rs-inp" formControlName="vertical"
                    [class.rs-inp--error]="hasError('vertical')">
              <option value="">— Selecciona una categoría —</option>
              @for (v of verticales; track v.valor) {
                <option [value]="v.valor">{{ v.label }}</option>
              }
            </select>
            @if (hasError('vertical')) {
              <span class="rs-field-err">Selecciona una categoría.</span>
            }
          </div>

          <!-- TÍTULO -->
          <div class="rs-field">
            <label class="rs-lbl" for="titulo">Nombre del servicio *</label>
            <input id="titulo" class="rs-inp" formControlName="titulo"
                   [placeholder]="placeholderTitulo()"
                   [class.rs-inp--error]="hasError('titulo')">
            @if (hasError('titulo')) {
              <span class="rs-field-err">El nombre es obligatorio.</span>
            }
          </div>

          <!-- DESCRIPCIÓN -->
          <div class="rs-field">
            <label class="rs-lbl" for="descripcion">Descripción *</label>
            <textarea id="descripcion" class="rs-inp rs-textarea" formControlName="descripcion"
                      rows="4"
                      placeholder="Describe tu servicio: características, lo que incluye, qué lo hace especial…"
                      [class.rs-inp--error]="hasError('descripcion')"></textarea>
            @if (hasError('descripcion')) {
              <span class="rs-field-err">La descripción es obligatoria.</span>
            }
          </div>

          <!-- DOS COLUMNAS: ciudad + precio -->
          <div class="form-row-2">
            <div class="rs-field">
              <label class="rs-lbl" for="ciudad">Ciudad *</label>
              <input id="ciudad" class="rs-inp" formControlName="ciudad"
                     placeholder="Ej. Madrid"
                     [class.rs-inp--error]="hasError('ciudad')">
              @if (hasError('ciudad')) {
                <span class="rs-field-err">La ciudad es obligatoria.</span>
              }
            </div>

            <div class="rs-field">
              <label class="rs-lbl" for="precioBase">Precio base (€) *</label>
              <input id="precioBase" class="rs-inp" type="number" formControlName="precioBase"
                     placeholder="0.00" min="0" step="0.01"
                     [class.rs-inp--error]="hasError('precioBase')">
              @if (hasError('precioBase')) {
                <span class="rs-field-err">Ingresa un precio válido mayor a 0.</span>
              }
            </div>
          </div>

          <!-- IMÁGENES -->
          <div class="rs-field">
            <label class="rs-lbl">Imágenes del servicio</label>
            <rs-image-upload
              [multiple]="true"
              [maxFiles]="6"
              formControlName="imagenes">
            </rs-image-upload>
            <span class="rs-field-hint">Sube hasta 6 imágenes · JPEG, PNG, WebP · Max 5 MB cada una.</span>
          </div>

          <!-- INFO ESTADO -->
          <div class="rs-alert rs-alert--info">
            El listado se creará en estado <strong>Borrador</strong>. Revísalo y publícalo desde la sección de listados cuando esté listo.
          </div>

          @if (errorMsg()) {
            <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
          }
          @if (exitoMsg()) {
            <div class="rs-alert rs-alert--success">{{ exitoMsg() }}</div>
          }

          <!-- ACCIONES -->
          <div class="form-actions">
            <a routerLink="/comercio/listados" class="rs-btn rs-btn--ghost">Cancelar</a>
            <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
              @if (guardando()) { Guardando… } @else {
                <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
                Crear listado
              }
            </button>
          </div>

        </form>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .page-wrap {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      width: 100%;
    }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400); text-decoration: none;
      margin-bottom: var(--sp-2); transition: color var(--d-2);
      &:hover { color: var(--c-accent); }
    }

    .page-header {
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); }
    }

    .form-card { padding: var(--sp-8); }
    form { display: flex; flex-direction: column; gap: var(--sp-5); }

    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rs-lbl { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-300); }
    .rs-inp {
      width: 100%; padding: var(--sp-3) var(--sp-4);
      background: var(--c-raised); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      color: var(--t-100); font-size: var(--f-base); transition: border-color var(--d-2), box-shadow var(--d-2);
      &:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
      &::placeholder { color: var(--t-500, #97A4B6); }
    }
    .rs-inp--error { border-color: #EF4444; }
    .rs-inp--error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,.15); }
    .rs-textarea { resize: vertical; min-height: 100px; font-family: inherit; }
    .rs-field-err { font-size: var(--f-xs); color: #B91C1C; }
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); }

    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); @media (max-width: 540px) { grid-template-columns: 1fr; } }

    .form-actions {
      display: flex; justify-content: flex-end; gap: var(--sp-3);
      padding-top: var(--sp-4); border-top: 1px solid var(--b-1); flex-wrap: wrap;
    }
  `],
})
export class ComercioListadoNuevoComponent {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exitoMsg = signal('');

  readonly verticales = VERTICALES;

  placeholderTitulo(): string {
    const vertical = this.form.controls.vertical.value;
    return PLACEHOLDER_TITULO[vertical] ?? 'Ej. Residencia Canina Villa Perruna';
  }

  readonly form = this.fb.group({
    vertical:    ['', Validators.required],
    titulo:      ['', [Validators.required, Validators.minLength(3)]],
    descripcion: ['', [Validators.required, Validators.minLength(10)]],
    ciudad:      ['', Validators.required],
    precioBase:  [0, [Validators.required, Validators.min(1)]],
    imagenes:    [[] as string[]],
  });

  hasError(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.guardando.set(true);
    this.errorMsg.set('');
    this.exitoMsg.set('');

    const { vertical, titulo, descripcion, ciudad, precioBase, imagenes } = this.form.getRawValue();

    try {
      await firstValueFrom(this.comercioApi.crearServicio({ vertical, titulo, descripcion, ciudad, precioBase, imagenes }));
      this.exitoMsg.set('¡Listado creado en borrador! Redirigiendo…');
      setTimeout(() => void this.router.navigate(['/comercio/listados']), 1200);
    } catch {
      this.errorMsg.set('Error al crear el listado. Verifica los datos e intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
