import { Component, signal, inject, WritableSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators, FormGroup, AbstractControl } from '@angular/forms';
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

interface EspacioForm {
  id: string;
  tipo: string;
  tamanoMaxPerro: string;
  precioNoche: number;
  cantidad: number;
  disponible: boolean;
  cancelacionGratis: boolean;
  amenities: string[];
  imagenes: string[];
}

interface ServicioClinicoForm {
  nombre: string;
  precio: number;
  duracionMin: number;
}

interface ServicioGroomingForm {
  nombre: string;
  precio: number;
  duracionMin: number;
  tamanoPerro: string;
}

const TIPOS_ESPACIO: ReadonlyArray<{ valor: string; label: string }> = [
  { valor: 'suite', label: 'Suite' },
  { valor: 'estandar', label: 'Estándar' },
  { valor: 'compartido', label: 'Compartido' },
];

const TAMANOS_PERRO: ReadonlyArray<{ valor: string; label: string }> = [
  { valor: 'pequeno', label: 'Pequeño' },
  { valor: 'mediano', label: 'Mediano' },
  { valor: 'grande', label: 'Grande' },
  { valor: 'gigante', label: 'Gigante' },
];

const TIPOS_VEHICULO: ReadonlyArray<{ valor: string; label: string }> = [
  { valor: 'van_acondicionada', label: 'Van acondicionada' },
  { valor: 'coche', label: 'Coche' },
  { valor: 'furgon_climatizado', label: 'Furgón climatizado' },
];

const MODALIDADES_ADIESTRAMIENTO: ReadonlyArray<{ valor: string; label: string }> = [
  { valor: 'sesion', label: 'Por sesión' },
  { valor: 'programa', label: 'Programa completo' },
];

/** Vocabulario canónico (misma terminología usada en los datos de demo europeos). */
const AMENITIES_ALOJAMIENTO: readonly string[] = [
  'piscina canina', 'cámaras 24/7', 'veterinario de guardia', 'paseos diarios',
  'patio privado', 'climatización', 'zona de juegos', 'jardín exterior',
  'socialización supervisada', 'cuidados personalizados', 'recogida a domicilio',
];

const ESPECIALIDADES_VETERINARIA: readonly string[] = [
  'medicina general', 'vacunación', 'odontología', 'radiografía', 'urgencias',
  'cirugía', 'dermatología', 'traumatología',
];

const TIPOS_ADIESTRAMIENTO_OPCIONES: readonly string[] = [
  'obediencia básica', 'modificación de conducta', 'socialización', 'cachorros',
  'guardia y protección',
];

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

          <!-- ALOJAMIENTO -->
          @if (form.controls.vertical.value === 'alojamiento') {
            <div class="vertical-block">
              <h3 class="vertical-block__title">Detalles de alojamiento canino</h3>
              <p class="vertical-block__hint">Configura los espacios reservables, horarios y política de tu residencia.</p>

              <div [formGroup]="alojamientoForm">
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

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Barrio / zona</label>
                    <input class="rs-inp" formControlName="barrio" placeholder="Ej. Salamanca">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Dirección</label>
                    <input class="rs-inp" formControlName="direccion" placeholder="Calle, número">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Política de cancelación</label>
                  <textarea class="rs-inp rs-textarea" rows="2" formControlName="politicaCancelacion"
                            placeholder="Ej. Cancelación gratuita hasta 24h antes"></textarea>
                </div>

                <div class="toggles-row">
                  <label class="toggle-check"><input type="checkbox" formControlName="requisitoVacunas"> Exige cartilla de vacunas</label>
                  <label class="toggle-check"><input type="checkbox" formControlName="paseosIncluidos"> Paseos incluidos</label>
                  <label class="toggle-check"><input type="checkbox" formControlName="camaras24h"> Cámaras 24h</label>
                  <label class="toggle-check"><input type="checkbox" formControlName="cancelacionGratis"> Cancelación gratuita</label>
                </div>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Amenities</label>
                <div class="chips-wrap">
                  @for (a of amenitiesDisponibles; track a) {
                    <button type="button" class="chip" [class.chip--active]="amenitiesSel().includes(a)"
                            (click)="toggleChip(amenitiesSel, a)">{{ a }}</button>
                  }
                </div>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Espacios reservables *</label>
                @for (e of espacios(); track $index) {
                  <div class="array-row">
                    <select class="rs-inp" [value]="e.tipo"
                            (change)="actualizarItem(espacios, $index, 'tipo', $any($event.target).value)">
                      @for (t of tiposEspacio; track t.valor) { <option [value]="t.valor">{{ t.label }}</option> }
                    </select>
                    <select class="rs-inp" [value]="e.tamanoMaxPerro"
                            (change)="actualizarItem(espacios, $index, 'tamanoMaxPerro', $any($event.target).value)">
                      @for (t of tamanosPerro; track t.valor) { <option [value]="t.valor">{{ t.label }}</option> }
                    </select>
                    <input class="rs-inp" type="number" min="1" [value]="e.cantidad" placeholder="Cantidad"
                           (input)="actualizarItem(espacios, $index, 'cantidad', +$any($event.target).value)">
                    <input class="rs-inp" type="number" min="0" step="0.01" [value]="e.precioNoche" placeholder="Precio/noche (€)"
                           (input)="actualizarItem(espacios, $index, 'precioNoche', +$any($event.target).value)">
                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarItem(espacios, $index)">✕</button>
                  </div>
                }
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarItem(espacios, nuevoEspacio())">
                  + Añadir espacio
                </button>
                @if (mostrarErrores() && espacios().length === 0) {
                  <span class="rs-field-err">Añade al menos un espacio reservable.</span>
                }
              </div>
            </div>
          }

          <!-- TRANSPORTE -->
          @if (form.controls.vertical.value === 'transporte') {
            <div class="vertical-block">
              <h3 class="vertical-block__title">Detalles de transporte de animales</h3>
              <p class="vertical-block__hint">Define tarifas, vehículo y zona de cobertura de tus traslados.</p>

              <div [formGroup]="transporteForm">
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Tipo de vehículo</label>
                    <select class="rs-inp" formControlName="tipoVehiculo">
                      @for (t of tiposVehiculo; track t.valor) { <option [value]="t.valor">{{ t.label }}</option> }
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Capacidad (perros)</label>
                    <input class="rs-inp" type="number" min="1" formControlName="capacidadPerros">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Zona de cobertura</label>
                  <input class="rs-inp" formControlName="zonaCoberturaTexto"
                         placeholder="Ej. Madrid, Alcobendas, Pozuelo (separadas por coma)">
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Tarifa base (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaBase"
                           [class.rs-inp--error]="hasErrorGrupo(transporteForm, 'tarifaBase')">
                    @if (hasErrorGrupo(transporteForm, 'tarifaBase')) {
                      <span class="rs-field-err">Ingresa una tarifa base válida.</span>
                    }
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Tarifa por km (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaKm"
                           [class.rs-inp--error]="hasErrorGrupo(transporteForm, 'tarifaKm')">
                    @if (hasErrorGrupo(transporteForm, 'tarifaKm')) {
                      <span class="rs-field-err">Ingresa una tarifa por km válida.</span>
                    }
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Unidades disponibles</label>
                  <input class="rs-inp" type="number" min="0" formControlName="unidadesDisponibles">
                </div>

                <div class="toggles-row">
                  <label class="toggle-check"><input type="checkbox" formControlName="jaulasIncluidas"> Jaulas incluidas</label>
                  <label class="toggle-check"><input type="checkbox" formControlName="acompananteHumano"> Acompañante humano</label>
                  <label class="toggle-check"><input type="checkbox" formControlName="soloPerros"> Solo perros</label>
                </div>
              </div>
            </div>
          }

          <!-- VETERINARIA -->
          @if (form.controls.vertical.value === 'veterinaria') {
            <div class="vertical-block">
              <h3 class="vertical-block__title">Detalles de veterinaria</h3>
              <p class="vertical-block__hint">Configura especialidades, duración de citas y servicios clínicos.</p>

              <div [formGroup]="veterinariaForm">
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Precio de consulta (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioConsulta"
                           [class.rs-inp--error]="hasErrorGrupo(veterinariaForm, 'precioConsulta')">
                    @if (hasErrorGrupo(veterinariaForm, 'precioConsulta')) {
                      <span class="rs-field-err">Ingresa un precio de consulta válido.</span>
                    }
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Duración de cita (min)</label>
                    <input class="rs-inp" type="number" min="5" formControlName="duracionCitaMin">
                  </div>
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Citas por día</label>
                    <input class="rs-inp" type="number" min="1" formControlName="citasPorDia">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Citas disponibles ahora</label>
                    <input class="rs-inp" type="number" min="0" formControlName="citasDisponibles">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Horario de atención</label>
                  <input class="rs-inp" formControlName="horario" placeholder="Ej. Lun-Vie 9:00-20:00">
                </div>

                <label class="toggle-check"><input type="checkbox" formControlName="atiendeUrgencias"> Atiende urgencias</label>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Especialidades</label>
                <div class="chips-wrap">
                  @for (e of especialidadesDisponibles; track e) {
                    <button type="button" class="chip" [class.chip--active]="especialidadesSel().includes(e)"
                            (click)="toggleChip(especialidadesSel, e)">{{ e }}</button>
                  }
                </div>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Servicios clínicos</label>
                @for (s of serviciosClinicos(); track $index) {
                  <div class="array-row">
                    <input class="rs-inp" [value]="s.nombre" placeholder="Nombre (ej. Vacunación)"
                           (input)="actualizarItem(serviciosClinicos, $index, 'nombre', $any($event.target).value)">
                    <input class="rs-inp" type="number" min="0" step="0.01" [value]="s.precio" placeholder="Precio (€)"
                           (input)="actualizarItem(serviciosClinicos, $index, 'precio', +$any($event.target).value)">
                    <input class="rs-inp" type="number" min="0" [value]="s.duracionMin" placeholder="Duración (min)"
                           (input)="actualizarItem(serviciosClinicos, $index, 'duracionMin', +$any($event.target).value)">
                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarItem(serviciosClinicos, $index)">✕</button>
                  </div>
                }
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                        (click)="agregarItem(serviciosClinicos, nuevoServicioClinico())">
                  + Añadir servicio clínico
                </button>
              </div>
            </div>
          }

          <!-- PELUQUERÍA -->
          @if (form.controls.vertical.value === 'peluqueria') {
            <div class="vertical-block">
              <h3 class="vertical-block__title">Detalles de peluquería canina</h3>
              <p class="vertical-block__hint">Configura tus servicios de grooming, duración de slots y horario.</p>

              <div [formGroup]="peluqueriaForm">
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Duración de slot (min)</label>
                    <input class="rs-inp" type="number" min="5" formControlName="duracionSlotMin">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Capacidad simultánea</label>
                    <input class="rs-inp" type="number" min="1" formControlName="capacidadSimultanea">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Cupos disponibles ahora</label>
                  <input class="rs-inp" type="number" min="0" formControlName="cuposDisponibles">
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Horario de atención</label>
                  <input class="rs-inp" formControlName="horario" placeholder="Ej. Lun-Sáb 9:00-19:00">
                </div>

                <label class="toggle-check"><input type="checkbox" formControlName="aDomicilio"> Servicio a domicilio</label>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Servicios de grooming *</label>
                @for (s of serviciosGrooming(); track $index) {
                  <div class="array-row">
                    <input class="rs-inp" [value]="s.nombre" placeholder="Nombre (ej. Baño y corte)"
                           (input)="actualizarItem(serviciosGrooming, $index, 'nombre', $any($event.target).value)">
                    <input class="rs-inp" type="number" min="0" step="0.01" [value]="s.precio" placeholder="Precio (€)"
                           (input)="actualizarItem(serviciosGrooming, $index, 'precio', +$any($event.target).value)">
                    <input class="rs-inp" type="number" min="0" [value]="s.duracionMin" placeholder="Duración (min)"
                           (input)="actualizarItem(serviciosGrooming, $index, 'duracionMin', +$any($event.target).value)">
                    <select class="rs-inp" [value]="s.tamanoPerro"
                            (change)="actualizarItem(serviciosGrooming, $index, 'tamanoPerro', $any($event.target).value)">
                      @for (t of tamanosPerro; track t.valor) { <option [value]="t.valor">{{ t.label }}</option> }
                    </select>
                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarItem(serviciosGrooming, $index)">✕</button>
                  </div>
                }
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                        (click)="agregarItem(serviciosGrooming, nuevoServicioGrooming())">
                  + Añadir servicio de grooming
                </button>
                @if (mostrarErrores() && serviciosGrooming().length === 0) {
                  <span class="rs-field-err">Añade al menos un servicio de grooming.</span>
                }
              </div>
            </div>
          }

          <!-- ADIESTRAMIENTO -->
          @if (form.controls.vertical.value === 'adiestramiento') {
            <div class="vertical-block">
              <h3 class="vertical-block__title">Detalles de adiestramiento canino</h3>
              <p class="vertical-block__hint">Configura modalidad, precios y cupos de tus sesiones o programas.</p>

              <div [formGroup]="adiestramientoForm">
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Modalidad</label>
                    <select class="rs-inp" formControlName="modalidad">
                      @for (m of modalidadesAdiestramiento; track m.valor) { <option [value]="m.valor">{{ m.label }}</option> }
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Precio por sesión (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioSesion"
                           [class.rs-inp--error]="hasErrorGrupo(adiestramientoForm, 'precioSesion')">
                    @if (hasErrorGrupo(adiestramientoForm, 'precioSesion')) {
                      <span class="rs-field-err">Ingresa un precio por sesión válido.</span>
                    }
                  </div>
                </div>

                @if (adiestramientoForm.controls.modalidad.value === 'programa') {
                  <div class="form-row-2">
                    <div class="rs-field">
                      <label class="rs-lbl">Precio del programa (€)</label>
                      <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioPrograma">
                    </div>
                    <div class="rs-field">
                      <label class="rs-lbl">Sesiones por programa</label>
                      <input class="rs-inp" type="number" min="1" formControlName="sesionesPorPrograma">
                    </div>
                  </div>
                }

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Edad mínima (meses)</label>
                    <input class="rs-inp" type="number" min="1" formControlName="edadMinimaMeses">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Capacidad por sesión</label>
                    <input class="rs-inp" type="number" min="1" formControlName="capacidadPorSesion">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Cupos disponibles ahora</label>
                  <input class="rs-inp" type="number" min="0" formControlName="cuposDisponibles">
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Horario</label>
                  <input class="rs-inp" formControlName="horario" placeholder="Ej. Lun-Vie 16:00-20:00">
                </div>

                <label class="toggle-check"><input type="checkbox" formControlName="aDomicilio"> Servicio a domicilio</label>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Tipos de adiestramiento</label>
                <div class="chips-wrap">
                  @for (t of tiposAdiestramientoDisponibles; track t) {
                    <button type="button" class="chip" [class.chip--active]="tiposAdiestramientoSel().includes(t)"
                            (click)="toggleChip(tiposAdiestramientoSel, t)">{{ t }}</button>
                  }
                </div>
              </div>
            </div>
          }

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

    .vertical-block {
      display: flex; flex-direction: column; gap: var(--sp-4);
      padding: var(--sp-5); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-surface);
    }
    .vertical-block__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    .vertical-block__hint { font-size: var(--f-xs); color: var(--t-400); margin-top: calc(-1 * var(--sp-2)); }

    .array-row {
      display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-2);
      .rs-inp { flex: 1 1 110px; min-width: 90px; }
    }

    .chips-wrap { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .chip {
      padding: var(--sp-2) var(--sp-3); border-radius: var(--r-full); border: 1px solid var(--b-2);
      background: var(--c-raised); color: var(--t-300); font-size: var(--f-xs); cursor: pointer;
      transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); }
    }
    .chip--active { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }

    .toggles-row { display: flex; flex-wrap: wrap; gap: var(--sp-4); }
    .toggle-check { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-300); cursor: pointer; }
  `],
})
export class ComercioListadoNuevoComponent {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exitoMsg = signal('');
  readonly mostrarErrores = signal(false);

  readonly verticales = VERTICALES;
  readonly tiposEspacio = TIPOS_ESPACIO;
  readonly tamanosPerro = TAMANOS_PERRO;
  readonly tiposVehiculo = TIPOS_VEHICULO;
  readonly modalidadesAdiestramiento = MODALIDADES_ADIESTRAMIENTO;
  readonly amenitiesDisponibles = AMENITIES_ALOJAMIENTO;
  readonly especialidadesDisponibles = ESPECIALIDADES_VETERINARIA;
  readonly tiposAdiestramientoDisponibles = TIPOS_ADIESTRAMIENTO_OPCIONES;

  readonly espacios = signal<EspacioForm[]>([]);
  readonly serviciosClinicos = signal<ServicioClinicoForm[]>([]);
  readonly serviciosGrooming = signal<ServicioGroomingForm[]>([]);
  readonly amenitiesSel = signal<string[]>([]);
  readonly especialidadesSel = signal<string[]>([]);
  readonly tiposAdiestramientoSel = signal<string[]>([]);

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

  readonly alojamientoForm = this.fb.group({
    checkIn: [''],
    checkOut: [''],
    politicaCancelacion: [''],
    requisitoVacunas: [true],
    paseosIncluidos: [false],
    camaras24h: [false],
    cancelacionGratis: [true],
    barrio: [''],
    direccion: [''],
  });

  readonly transporteForm = this.fb.group({
    tipoVehiculo: ['van_acondicionada', Validators.required],
    capacidadPerros: [4, [Validators.required, Validators.min(1)]],
    zonaCoberturaTexto: [''],
    tarifaBase: [0, [Validators.required, Validators.min(0.01)]],
    tarifaKm: [0, [Validators.required, Validators.min(0.01)]],
    jaulasIncluidas: [true],
    acompananteHumano: [false],
    soloPerros: [true],
    unidadesDisponibles: [1, [Validators.required, Validators.min(0)]],
  });

  readonly veterinariaForm = this.fb.group({
    duracionCitaMin: [30, [Validators.required, Validators.min(5)]],
    citasPorDia: [16, [Validators.required, Validators.min(1)]],
    citasDisponibles: [0, [Validators.required, Validators.min(0)]],
    atiendeUrgencias: [false],
    horario: [''],
    precioConsulta: [0, [Validators.required, Validators.min(0.01)]],
  });

  readonly peluqueriaForm = this.fb.group({
    duracionSlotMin: [60, [Validators.required, Validators.min(5)]],
    capacidadSimultanea: [2, [Validators.required, Validators.min(1)]],
    cuposDisponibles: [0, [Validators.required, Validators.min(0)]],
    aDomicilio: [false],
    horario: [''],
  });

  readonly adiestramientoForm = this.fb.group({
    modalidad: ['sesion', Validators.required],
    precioSesion: [0, [Validators.required, Validators.min(0.01)]],
    precioPrograma: [0],
    sesionesPorPrograma: [0],
    edadMinimaMeses: [3, [Validators.required, Validators.min(1)]],
    aDomicilio: [false],
    capacidadPorSesion: [6, [Validators.required, Validators.min(1)]],
    cuposDisponibles: [0, [Validators.required, Validators.min(0)]],
    horario: [''],
  });

  hasError(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  hasErrorGrupo<T extends Record<string, AbstractControl>>(grupo: FormGroup<T>, campo: Extract<keyof T, string>): boolean {
    const control = grupo.get(campo);
    return !!(control && control.invalid && (control.touched || this.mostrarErrores()));
  }

  toggleChip(seleccion: WritableSignal<string[]>, valor: string): void {
    const actual = seleccion();
    seleccion.set(actual.includes(valor) ? actual.filter(v => v !== valor) : [...actual, valor]);
  }

  agregarItem<T>(lista: WritableSignal<T[]>, item: T): void {
    lista.update(arr => [...arr, item]);
  }

  quitarItem<T>(lista: WritableSignal<T[]>, index: number): void {
    lista.update(arr => arr.filter((_, i) => i !== index));
  }

  actualizarItem<T, K extends keyof T>(lista: WritableSignal<T[]>, index: number, campo: K, valor: T[K]): void {
    lista.update(arr => arr.map((el, i) => (i === index ? { ...el, [campo]: valor } : el)));
  }

  nuevoEspacio(): EspacioForm {
    return {
      id: `esp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'estandar', tamanoMaxPerro: 'mediano', precioNoche: 0, cantidad: 1,
      disponible: true, cancelacionGratis: this.alojamientoForm.controls.cancelacionGratis.value,
      amenities: [], imagenes: [],
    };
  }

  nuevoServicioClinico(): ServicioClinicoForm {
    return { nombre: '', precio: 0, duracionMin: 30 };
  }

  nuevoServicioGrooming(): ServicioGroomingForm {
    return { nombre: '', precio: 0, duracionMin: 60, tamanoPerro: 'mediano' };
  }

  async submit(): Promise<void> {
    const vertical = this.form.controls.vertical.value;

    if (this.form.invalid || !this.verticalValido(vertical)) {
      this.form.markAllAsTouched();
      this.marcarSubformComoTocado(vertical);
      this.mostrarErrores.set(true);
      return;
    }

    this.guardando.set(true);
    this.errorMsg.set('');
    this.exitoMsg.set('');

    const { titulo, descripcion, ciudad, precioBase, imagenes } = this.form.getRawValue();

    try {
      await firstValueFrom(this.comercioApi.crearServicio({
        vertical, titulo, descripcion, ciudad, precioBase, imagenes,
        extra: this.construirExtra(vertical),
      }));
      this.exitoMsg.set('¡Listado creado en borrador! Redirigiendo…');
      setTimeout(() => void this.router.navigate(['/comercio/listados']), 1200);
    } catch {
      this.errorMsg.set('Error al crear el listado. Verifica los datos e intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  private marcarSubformComoTocado(vertical: string): void {
    const formularios: Record<string, FormGroup> = {
      alojamiento: this.alojamientoForm,
      transporte: this.transporteForm,
      veterinaria: this.veterinariaForm,
      peluqueria: this.peluqueriaForm,
      adiestramiento: this.adiestramientoForm,
    };
    formularios[vertical]?.markAllAsTouched();
  }

  private verticalValido(vertical: string): boolean {
    switch (vertical) {
      case 'alojamiento':
        return this.alojamientoForm.valid && this.espacios().length > 0
          && this.espacios().every(e => e.precioNoche > 0 && e.cantidad > 0);
      case 'transporte':
        return this.transporteForm.valid;
      case 'veterinaria':
        return this.veterinariaForm.valid;
      case 'peluqueria':
        return this.peluqueriaForm.valid && this.serviciosGrooming().length > 0
          && this.serviciosGrooming().every(s => s.nombre.trim().length > 0 && s.precio > 0);
      case 'adiestramiento':
        return this.adiestramientoForm.valid;
      default:
        return false;
    }
  }

  private construirExtra(vertical: string): Record<string, unknown> {
    switch (vertical) {
      case 'alojamiento': {
        const v = this.alojamientoForm.getRawValue();
        return {
          espacios: this.espacios(),
          amenities: this.amenitiesSel(),
          checkIn: v.checkIn || undefined,
          checkOut: v.checkOut || undefined,
          politicaCancelacion: v.politicaCancelacion || undefined,
          requisitoVacunas: v.requisitoVacunas,
          paseosIncluidos: v.paseosIncluidos,
          camaras24h: v.camaras24h,
          cancelacionGratis: v.cancelacionGratis,
          barrio: v.barrio || undefined,
          direccion: v.direccion || undefined,
        };
      }
      case 'transporte': {
        const v = this.transporteForm.getRawValue();
        return {
          tipoVehiculo: v.tipoVehiculo,
          capacidadPerros: v.capacidadPerros,
          zonaCobertura: v.zonaCoberturaTexto.split(',').map(z => z.trim()).filter(Boolean),
          tarifaBase: v.tarifaBase,
          tarifaKm: v.tarifaKm,
          jaulasIncluidas: v.jaulasIncluidas,
          acompananteHumano: v.acompananteHumano,
          soloPerros: v.soloPerros,
          unidadesDisponibles: v.unidadesDisponibles,
        };
      }
      case 'veterinaria': {
        const v = this.veterinariaForm.getRawValue();
        return {
          especialidades: this.especialidadesSel(),
          serviciosClinicos: this.serviciosClinicos(),
          duracionCitaMin: v.duracionCitaMin,
          citasPorDia: v.citasPorDia,
          citasDisponibles: v.citasDisponibles,
          atiendeUrgencias: v.atiendeUrgencias,
          horario: v.horario || undefined,
          precioConsulta: v.precioConsulta,
        };
      }
      case 'peluqueria': {
        const v = this.peluqueriaForm.getRawValue();
        return {
          serviciosGrooming: this.serviciosGrooming(),
          duracionSlotMin: v.duracionSlotMin,
          capacidadSimultanea: v.capacidadSimultanea,
          cuposDisponibles: v.cuposDisponibles,
          aDomicilio: v.aDomicilio,
          horario: v.horario || undefined,
        };
      }
      case 'adiestramiento': {
        const v = this.adiestramientoForm.getRawValue();
        const esPrograma = v.modalidad === 'programa';
        return {
          tiposAdiestramiento: this.tiposAdiestramientoSel(),
          modalidad: v.modalidad,
          precioSesion: v.precioSesion,
          precioPrograma: esPrograma ? v.precioPrograma : undefined,
          sesionesPorPrograma: esPrograma ? v.sesionesPorPrograma : undefined,
          edadMinimaMeses: v.edadMinimaMeses,
          aDomicilio: v.aDomicilio,
          capacidadPorSesion: v.capacidadPorSesion,
          cuposDisponibles: v.cuposDisponibles,
          horario: v.horario || undefined,
        };
      }
      default:
        return {};
    }
  }
}
