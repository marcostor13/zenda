import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { ComercioApiService, ServicioPayload } from './comercio-api.service';

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

function csvA(v?: string[]): string {
  return (v ?? []).join(', ');
}
function aCsv(v: string): string[] {
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

@Component({
  selector: 'app-comercio-listado-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsIconComponent, RsImageUploadComponent],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <a routerLink="/comercio/listados" class="back-link">
          <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
          Volver a listados
        </a>
        <h1>{{ esEdicion() ? 'Editar listado' : 'Nuevo listado' }}</h1>
        <p>{{ esEdicion() ? 'Actualiza los datos de tu servicio.' : 'Completa todos los datos de tu servicio: cuanta más información, más confianza generas.' }}</p>
      </div>

      @if (cargando()) {
        <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">Cargando…</div>
      } @else {
      <div class="form-card rs-card">
        <form [formGroup]="form" (ngSubmit)="submit()">

          <!-- ═══ DATOS BÁSICOS ═══ -->
          <h2 class="section-title">Datos básicos</h2>

          <div class="rs-field">
            <label class="rs-lbl" for="vertical">Categoría *</label>
            <select id="vertical" class="rs-inp" formControlName="vertical"
                    [class.rs-inp--error]="hasError('vertical')">
              <option value="">— Selecciona una categoría —</option>
              @for (v of verticales; track v.valor) {
                <option [value]="v.valor">{{ v.label }}</option>
              }
            </select>
            @if (esEdicion()) {
              <span class="rs-field-hint">La categoría no se puede cambiar después de crear el listado.</span>
            }
            @if (hasError('vertical')) {
              <span class="rs-field-err">Selecciona una categoría.</span>
            }
          </div>

          <div class="rs-field">
            <label class="rs-lbl" for="titulo">Nombre del servicio *</label>
            <input id="titulo" class="rs-inp" formControlName="titulo"
                   [placeholder]="placeholderTitulo()"
                   [class.rs-inp--error]="hasError('titulo')">
            @if (hasError('titulo')) {
              <span class="rs-field-err">El nombre es obligatorio.</span>
            }
          </div>

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
              <label class="rs-lbl" for="precioBase">Precio orientativo (€) *</label>
              <input id="precioBase" class="rs-inp" type="number" formControlName="precioBase"
                     placeholder="0.00" min="0" step="0.01"
                     [class.rs-inp--error]="hasError('precioBase')">
              <span class="rs-field-hint">Es el precio "desde" que se muestra en las tarjetas de búsqueda.</span>
              @if (hasError('precioBase')) {
                <span class="rs-field-err">Ingresa un precio válido mayor a 0.</span>
              }
            </div>
          </div>

          <div class="rs-field">
            <label class="rs-lbl">Imágenes del servicio</label>
            <rs-image-upload [multiple]="true" [maxFiles]="8" formControlName="imagenes"></rs-image-upload>
            <span class="rs-field-hint">Sube hasta 8 imágenes · JPEG, PNG, WebP · Max 5 MB cada una.</span>
          </div>

          <!-- ═══ SECCIÓN POR VERTICAL ═══ -->
          @switch (form.controls.vertical.value) {

            @case ('alojamiento') {
              <div formGroupName="alojamiento" class="vertical-section">
                <h2 class="section-title">Espacios y detalles del alojamiento</h2>

                <div formArrayName="espacios" class="rows">
                  @for (esp of espacios.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid">
                        <div class="rs-field">
                          <label class="rs-lbl">Tipo *</label>
                          <select class="rs-inp" formControlName="tipo">
                            <option value="estandar">Estándar</option>
                            <option value="suite">Suite</option>
                            <option value="compartido">Compartido</option>
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Tamaño máx. de perro *</label>
                          <select class="rs-inp" formControlName="tamanoMaxPerro">
                            <option value="pequeno">Pequeño</option>
                            <option value="mediano">Mediano</option>
                            <option value="grande">Grande</option>
                            <option value="gigante">Gigante</option>
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Precio/noche (€) *</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioNoche">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Cantidad disponible *</label>
                          <input class="rs-inp" type="number" min="1" formControlName="cantidad">
                        </div>
                      </div>
                      <div class="rs-field">
                        <label class="rs-lbl">Descripción del espacio</label>
                        <input class="rs-inp" formControlName="descripcion" placeholder="Ej. Suite individual con jardín privado">
                      </div>
                      <div class="rs-field">
                        <label class="rs-lbl">Amenities de este espacio (separados por comas)</label>
                        <input class="rs-inp" formControlName="amenities" placeholder="cámara, aire acondicionado, cama ortopédica">
                      </div>
                      <div class="checkbox-row">
                        <label class="rs-checkbox"><input type="checkbox" formControlName="disponible"> Disponible</label>
                        <label class="rs-checkbox"><input type="checkbox" formControlName="cancelacionGratis"> Cancelación gratis</label>
                        <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarEspacio(i)">
                          <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                        </button>
                      </div>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarEspacio()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir tipo de espacio
                </button>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Check-in</label>
                    <input class="rs-inp" type="time" formControlName="checkIn">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Check-out</label>
                    <input class="rs-inp" type="time" formControlName="checkOut">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Amenities generales (separados por comas)</label>
                  <input class="rs-inp" formControlName="amenities" placeholder="patio, piscina canina, veterinario de guardia">
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Barrio</label>
                    <input class="rs-inp" formControlName="barrio">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Dirección</label>
                    <input class="rs-inp" formControlName="direccion">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Política de cancelación</label>
                  <select class="rs-inp" formControlName="politicaCancelacion">
                    <option value="">— Sin especificar —</option>
                    <option value="flexible">Flexible</option>
                    <option value="moderada">Moderada</option>
                    <option value="estricta">Estricta</option>
                  </select>
                </div>

                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requisitoVacunas"> Exige cartilla de vacunas</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="paseosIncluidos"> Paseos incluidos</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="camaras24h"> Cámaras 24h</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="cancelacionGratis"> Cancelación gratuita</label>
                </div>
              </div>
            }

            @case ('transporte') {
              <div formGroupName="transporte" class="vertical-section">
                <h2 class="section-title">Detalles del transporte</h2>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Tipo de vehículo</label>
                    <select class="rs-inp" formControlName="tipoVehiculo">
                      <option value="van_acondicionada">Van acondicionada</option>
                      <option value="coche">Coche</option>
                      <option value="furgon_climatizado">Furgón climatizado</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Capacidad (perros)</label>
                    <input class="rs-inp" type="number" min="1" formControlName="capacidadPerros">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Zona de cobertura (separadas por comas)</label>
                  <input class="rs-inp" formControlName="zonaCobertura" placeholder="Madrid centro, Alcobendas, Getafe">
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Tarifa base (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaBase">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Tarifa por km (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaKm">
                  </div>
                </div>

                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="jaulasIncluidas"> Jaulas incluidas</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="acompananteHumano"> Acompañante humano opcional</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="soloPerros"> Sólo perros</label>
                </div>
              </div>
            }

            @case ('veterinaria') {
              <div formGroupName="veterinaria" class="vertical-section">
                <h2 class="section-title">Servicios clínicos</h2>

                <div class="rs-field">
                  <label class="rs-lbl">Especialidades (separadas por comas)</label>
                  <input class="rs-inp" formControlName="especialidades" placeholder="cirugía, dermatología, cardiología">
                </div>

                <div formArrayName="serviciosClinicos" class="rows">
                  @for (s of serviciosClinicos.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--3">
                        <div class="rs-field">
                          <label class="rs-lbl">Servicio *</label>
                          <input class="rs-inp" formControlName="nombre" placeholder="Ej. Consulta general">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Precio (€) *</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Duración (min)</label>
                          <input class="rs-inp" type="number" min="0" formControlName="duracionMin">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioClinico(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioClinico()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir servicio clínico
                </button>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Precio de consulta (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioConsulta">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Duración de la cita (min)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="duracionCitaMin">
                  </div>
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Citas por día</label>
                    <input class="rs-inp" type="number" min="0" formControlName="citasPorDia">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Horario de atención</label>
                    <input class="rs-inp" formControlName="horario" placeholder="Lun–Sáb 9:00–20:00">
                  </div>
                </div>

                <label class="rs-checkbox"><input type="checkbox" formControlName="atiendeUrgencias"> Atiende urgencias</label>
              </div>
            }

            @case ('peluqueria') {
              <div formGroupName="peluqueria" class="vertical-section">
                <h2 class="section-title">Servicios de grooming</h2>

                <div formArrayName="serviciosGrooming" class="rows">
                  @for (s of serviciosGrooming.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--4">
                        <div class="rs-field">
                          <label class="rs-lbl">Servicio *</label>
                          <input class="rs-inp" formControlName="nombre" placeholder="Ej. Baño y corte">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Precio (€) *</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Duración (min)</label>
                          <input class="rs-inp" type="number" min="0" formControlName="duracionMin">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Tamaño de perro</label>
                          <select class="rs-inp" formControlName="tamanoPerro">
                            <option value="">Todos</option>
                            <option value="pequeno">Pequeño</option>
                            <option value="mediano">Mediano</option>
                            <option value="grande">Grande</option>
                            <option value="gigante">Gigante</option>
                          </select>
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioGrooming(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioGrooming()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir servicio de grooming
                </button>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Duración por turno (min)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="duracionSlotMin">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Capacidad simultánea</label>
                    <input class="rs-inp" type="number" min="0" formControlName="capacidadSimultanea">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Horario de atención</label>
                  <input class="rs-inp" formControlName="horario" placeholder="Lun–Sáb 9:00–19:00">
                </div>

                <label class="rs-checkbox"><input type="checkbox" formControlName="aDomicilio"> Servicio a domicilio</label>
              </div>
            }

            @case ('adiestramiento') {
              <div formGroupName="adiestramiento" class="vertical-section">
                <h2 class="section-title">Detalles del adiestramiento</h2>

                <div class="rs-field">
                  <label class="rs-lbl">Tipos de adiestramiento (separados por comas)</label>
                  <input class="rs-inp" formControlName="tiposAdiestramiento" placeholder="obediencia básica, socialización, modificación de conducta">
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Modalidad</label>
                  <select class="rs-inp" formControlName="modalidad">
                    <option value="sesion">Sesión individual</option>
                    <option value="programa">Programa</option>
                  </select>
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Precio por sesión (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioSesion">
                  </div>
                  @if (adiestramientoGroup.get('modalidad')?.value === 'programa') {
                    <div class="rs-field">
                      <label class="rs-lbl">Precio del programa (€)</label>
                      <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioPrograma">
                    </div>
                  }
                </div>

                @if (adiestramientoGroup.get('modalidad')?.value === 'programa') {
                  <div class="rs-field">
                    <label class="rs-lbl">Sesiones por programa</label>
                    <input class="rs-inp" type="number" min="0" formControlName="sesionesPorPrograma">
                  </div>
                }

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Edad mínima (meses)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="edadMinimaMeses">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Capacidad por sesión</label>
                    <input class="rs-inp" type="number" min="0" formControlName="capacidadPorSesion">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Horario de atención</label>
                  <input class="rs-inp" formControlName="horario" placeholder="Lun–Vie 16:00–20:00">
                </div>

                <label class="rs-checkbox"><input type="checkbox" formControlName="aDomicilio"> Servicio a domicilio</label>
              </div>
            }
          }

          @if (!esEdicion()) {
            <div class="rs-alert rs-alert--info">
              El listado se creará en estado <strong>Borrador</strong>. Revísalo y publícalo desde la sección de listados cuando esté listo.
            </div>
          }

          @if (errorMsg()) {
            <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
          }
          @if (exitoMsg()) {
            <div class="rs-alert rs-alert--success">{{ exitoMsg() }}</div>
          }

          <div class="form-actions">
            <a routerLink="/comercio/listados" class="rs-btn rs-btn--ghost">Cancelar</a>
            <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
              @if (guardando()) { Guardando… } @else {
                <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
                {{ esEdicion() ? 'Guardar cambios' : 'Crear listado' }}
              }
            </button>
          </div>

        </form>
      </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .page-wrap { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-6); width: 100%; }

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

    .section-title {
      font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100);
      padding-top: var(--sp-3); margin-top: var(--sp-2); border-top: 1px solid var(--b-1);
      &:first-child { padding-top: 0; margin-top: 0; border-top: none; }
    }

    .vertical-section { display: flex; flex-direction: column; gap: var(--sp-5); }

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

    .rows { display: flex; flex-direction: column; gap: var(--sp-4); }
    .row-card {
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-4); background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg);
    }
    .row-card__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-3); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }
    .row-card__grid--3 { grid-template-columns: repeat(3, 1fr); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .row-card__grid--4 { grid-template-columns: repeat(4, 1fr); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }

    .checkbox-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-4); }
    .rs-checkbox { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); cursor: pointer; }
    .rs-checkbox input { accent-color: var(--c-accent); width: 16px; height: 16px; }

    .form-actions {
      display: flex; justify-content: flex-end; gap: var(--sp-3);
      padding-top: var(--sp-4); border-top: 1px solid var(--b-1); flex-wrap: wrap;
    }
  `],
})
export class ComercioListadoFormComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exitoMsg = signal('');

  readonly verticales = VERTICALES;
  readonly servicioId = signal<string | null>(null);
  readonly esEdicion = computed(() => this.servicioId() !== null);

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

    alojamiento: this.fb.group({
      espacios: this.fb.array<FormGroup>([]),
      amenities: [''],
      checkIn: [''],
      checkOut: [''],
      politicaCancelacion: [''],
      requisitoVacunas: [true],
      paseosIncluidos: [false],
      camaras24h: [false],
      cancelacionGratis: [true],
      barrio: [''],
      direccion: [''],
    }),

    transporte: this.fb.group({
      tipoVehiculo: ['van_acondicionada'],
      capacidadPerros: [4],
      zonaCobertura: [''],
      tarifaBase: [0, [Validators.required, Validators.min(0)]],
      tarifaKm: [0, [Validators.required, Validators.min(0)]],
      jaulasIncluidas: [true],
      acompananteHumano: [false],
      soloPerros: [true],
    }),

    veterinaria: this.fb.group({
      especialidades: [''],
      serviciosClinicos: this.fb.array<FormGroup>([]),
      duracionCitaMin: [30],
      citasPorDia: [16],
      atiendeUrgencias: [false],
      horario: [''],
      precioConsulta: [0, [Validators.required, Validators.min(0)]],
    }),

    peluqueria: this.fb.group({
      serviciosGrooming: this.fb.array<FormGroup>([]),
      duracionSlotMin: [60],
      capacidadSimultanea: [2],
      aDomicilio: [false],
      horario: [''],
    }),

    adiestramiento: this.fb.group({
      tiposAdiestramiento: [''],
      modalidad: ['sesion'],
      precioSesion: [0, [Validators.required, Validators.min(0)]],
      precioPrograma: [0],
      sesionesPorPrograma: [0],
      edadMinimaMeses: [3],
      aDomicilio: [false],
      capacidadPorSesion: [6],
      horario: [''],
    }),
  });

  get alojamientoGroup(): FormGroup { return this.form.controls.alojamiento; }
  get transporteGroup(): FormGroup { return this.form.controls.transporte; }
  get veterinariaGroup(): FormGroup { return this.form.controls.veterinaria; }
  get peluqueriaGroup(): FormGroup { return this.form.controls.peluqueria; }
  get adiestramientoGroup(): FormGroup { return this.form.controls.adiestramiento; }

  get espacios(): FormArray { return this.alojamientoGroup.get('espacios') as FormArray; }
  get serviciosClinicos(): FormArray { return this.veterinariaGroup.get('serviciosClinicos') as FormArray; }
  get serviciosGrooming(): FormArray { return this.peluqueriaGroup.get('serviciosGrooming') as FormArray; }

  private nuevoEspacio(e?: Record<string, unknown>) {
    return this.fb.group({
      tipo: [(e?.['tipo'] as string) ?? 'estandar'],
      tamanoMaxPerro: [(e?.['tamanoMaxPerro'] as string) ?? 'mediano'],
      descripcion: [(e?.['descripcion'] as string) ?? ''],
      precioNoche: [(e?.['precioNoche'] as number) ?? 0],
      cantidad: [(e?.['cantidad'] as number) ?? 1],
      amenities: [csvA(e?.['amenities'] as string[] | undefined)],
      disponible: [(e?.['disponible'] as boolean) ?? true],
      cancelacionGratis: [(e?.['cancelacionGratis'] as boolean) ?? true],
    });
  }

  agregarEspacio(): void { this.espacios.push(this.nuevoEspacio()); }
  quitarEspacio(i: number): void { this.espacios.removeAt(i); }

  private nuevoServicioClinico(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
      duracionMin: [(e?.['duracionMin'] as number) ?? 30],
    });
  }

  agregarServicioClinico(): void { this.serviciosClinicos.push(this.nuevoServicioClinico()); }
  quitarServicioClinico(i: number): void { this.serviciosClinicos.removeAt(i); }

  private nuevoServicioGrooming(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
      duracionMin: [(e?.['duracionMin'] as number) ?? 45],
      tamanoPerro: [(e?.['tamanoPerro'] as string) ?? ''],
    });
  }

  agregarServicioGrooming(): void { this.serviciosGrooming.push(this.nuevoServicioGrooming()); }
  quitarServicioGrooming(i: number): void { this.serviciosGrooming.removeAt(i); }

  hasError(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.servicioId.set(id);
    this.cargando.set(true);
    try {
      const s = await firstValueFrom(this.comercioApi.obtenerServicioGestion(id));
      this.form.patchValue({
        vertical: s.vertical,
        titulo: s.titulo,
        descripcion: s.descripcion,
        ciudad: s.ciudad,
        precioBase: s.precioBase,
        imagenes: s.imagenes,
      });
      this.form.controls.vertical.disable();
      this.precargarVertical(s.vertical, s.extra);
    } catch {
      this.errorMsg.set('No se pudo cargar el listado.');
    } finally {
      this.cargando.set(false);
    }
  }

  private precargarVertical(vertical: string, d?: Record<string, unknown>): void {
    if (!d) return;

    if (vertical === VerticalKey.ALOJAMIENTO) {
      this.alojamientoGroup.patchValue({
        amenities: csvA(d['amenities'] as string[] | undefined),
        checkIn: d['checkIn'] ?? '',
        checkOut: d['checkOut'] ?? '',
        politicaCancelacion: d['politicaCancelacion'] ?? '',
        requisitoVacunas: d['requisitoVacunas'] ?? true,
        paseosIncluidos: d['paseosIncluidos'] ?? false,
        camaras24h: d['camaras24h'] ?? false,
        cancelacionGratis: d['cancelacionGratis'] ?? true,
        barrio: d['barrio'] ?? '',
        direccion: d['direccion'] ?? '',
      });
      const lista = (d['espacios'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.espacios.push(this.nuevoEspacio(e)));
    } else if (vertical === VerticalKey.TRANSPORTE) {
      this.transporteGroup.patchValue({
        ...d,
        zonaCobertura: csvA(d['zonaCobertura'] as string[] | undefined),
      });
    } else if (vertical === VerticalKey.VETERINARIA) {
      this.veterinariaGroup.patchValue({
        ...d,
        especialidades: csvA(d['especialidades'] as string[] | undefined),
      });
      const lista = (d['serviciosClinicos'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.serviciosClinicos.push(this.nuevoServicioClinico(e)));
    } else if (vertical === VerticalKey.PELUQUERIA) {
      this.peluqueriaGroup.patchValue({ ...d });
      const lista = (d['serviciosGrooming'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.serviciosGrooming.push(this.nuevoServicioGrooming(e)));
    } else if (vertical === VerticalKey.ADIESTRAMIENTO) {
      this.adiestramientoGroup.patchValue({
        ...d,
        tiposAdiestramiento: csvA(d['tiposAdiestramiento'] as string[] | undefined),
      });
    }
  }

  private construirDetalleVertical(vertical: string): Record<string, unknown> | null {
    if (vertical === VerticalKey.ALOJAMIENTO) {
      const g = this.alojamientoGroup.getRawValue();
      return {
        espacios: this.espacios.controls.map(c => {
          const v = c.getRawValue();
          return { ...v, amenities: aCsv(v.amenities) };
        }),
        amenities: aCsv(g.amenities),
        checkIn: g.checkIn || undefined,
        checkOut: g.checkOut || undefined,
        politicaCancelacion: g.politicaCancelacion || undefined,
        requisitoVacunas: g.requisitoVacunas,
        paseosIncluidos: g.paseosIncluidos,
        camaras24h: g.camaras24h,
        cancelacionGratis: g.cancelacionGratis,
        barrio: g.barrio || undefined,
        direccion: g.direccion || undefined,
      };
    }
    if (vertical === VerticalKey.TRANSPORTE) {
      const g = this.transporteGroup.getRawValue();
      return { ...g, zonaCobertura: aCsv(g.zonaCobertura) };
    }
    if (vertical === VerticalKey.VETERINARIA) {
      const g = this.veterinariaGroup.getRawValue();
      return {
        ...g,
        especialidades: aCsv(g.especialidades),
        serviciosClinicos: this.serviciosClinicos.controls.map(c => c.getRawValue()),
      };
    }
    if (vertical === VerticalKey.PELUQUERIA) {
      const g = this.peluqueriaGroup.getRawValue();
      return {
        ...g,
        serviciosGrooming: this.serviciosGrooming.controls.map(c => c.getRawValue()),
      };
    }
    if (vertical === VerticalKey.ADIESTRAMIENTO) {
      const g = this.adiestramientoGroup.getRawValue();
      return {
        ...g,
        tiposAdiestramiento: aCsv(g.tiposAdiestramiento),
        precioPrograma: g.modalidad === 'programa' && g.precioPrograma > 0 ? g.precioPrograma : undefined,
        sesionesPorPrograma: g.modalidad === 'programa' && g.sesionesPorPrograma > 0 ? g.sesionesPorPrograma : undefined,
      };
    }
    return null;
  }

  private validarVertical(vertical: string): string | null {
    if (vertical === VerticalKey.ALOJAMIENTO && this.espacios.length === 0) {
      return 'Añade al menos un tipo de espacio para tu alojamiento.';
    }
    if (vertical === VerticalKey.VETERINARIA && this.serviciosClinicos.length === 0) {
      return 'Añade al menos un servicio clínico.';
    }
    if (vertical === VerticalKey.PELUQUERIA && this.serviciosGrooming.length === 0) {
      return 'Añade al menos un servicio de grooming.';
    }
    return null;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const vertical = this.form.controls.vertical.value;
    const errorVertical = this.validarVertical(vertical);
    if (errorVertical) { this.errorMsg.set(errorVertical); return; }

    this.guardando.set(true);
    this.errorMsg.set('');
    this.exitoMsg.set('');

    const { titulo, descripcion, ciudad, precioBase, imagenes } = this.form.getRawValue();
    const detalle = this.construirDetalleVertical(vertical);
    const payload: ServicioPayload = {
      ...(this.esEdicion() ? {} : { vertical }),
      titulo, descripcion, ciudad, precioBase, imagenes,
      ...(detalle ? { extra: detalle } : {}),
    };

    try {
      const id = this.servicioId();
      if (id) {
        await firstValueFrom(this.comercioApi.actualizarServicio(id, payload));
        this.exitoMsg.set('¡Cambios guardados!');
      } else {
        await firstValueFrom(this.comercioApi.crearServicio(payload));
        this.exitoMsg.set('¡Listado creado en borrador! Redirigiendo…');
      }
      setTimeout(() => void this.router.navigate(['/comercio/listados']), 1200);
    } catch {
      this.errorMsg.set('Error al guardar el listado. Verifica los datos e intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
