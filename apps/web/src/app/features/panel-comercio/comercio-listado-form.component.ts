import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormsModule, NonNullableFormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
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
  [VerticalKey.HOTELES]: 'Ej. Gran Hotel Pet Friendly Madrid',
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
  imports: [RouterLink, ReactiveFormsModule, FormsModule, RsIconComponent, RsImageUploadComponent],
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

          <!-- ═══ APTITUD (compatibilidad servicio↔perro) ═══ -->
          <h2 class="section-title">¿Para qué perros es apto este servicio?</h2>
          <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
            Déjalo todo sin marcar si vale para cualquier perro. Si marcas algo, Doogking solo mostrará este servicio
            a clientes cuyo perro encaje.
          </p>
          <div class="rs-field">
            <label class="rs-lbl">Tamaños admitidos</label>
            <div class="checks-grid">
              @for (t of tamanosPerro; track t.valor) {
                <label class="filter-check">
                  <input type="checkbox" [checked]="tieneTamano(t.valor)" (change)="toggleTamano(t.valor)" />
                  {{ t.label }}
                </label>
              }
            </div>
          </div>
          <div class="rs-field">
            <label class="rs-lbl">Tipo de pelo admitido</label>
            <div class="checks-grid">
              @for (t of tiposPelo; track t) {
                <label class="filter-check">
                  <input type="checkbox" [checked]="tienePelo(t)" (change)="togglePelo(t)" />
                  {{ t }}
                </label>
              }
            </div>
          </div>
          <div class="rs-field">
            <label class="rs-lbl" for="temperamentosNoAdmitidos">Temperamentos que no admites (separados por comas)</label>
            <input id="temperamentosNoAdmitidos" class="rs-inp" [(ngModel)]="temperamentosNoAdmitidosCsv"
                   [ngModelOptions]="{standalone: true}" placeholder="Ej. agresivo, muy nervioso" />
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
                            <option value="estandar">Individual / estándar</option>
                            <option value="compartido">Compartido</option>
                            <option value="premium">Zona premium</option>
                            <option value="climatizada">Habitación climatizada</option>
                            <option value="suite">Suite familiar (varios perros)</option>
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Tamaño máx. de perro (opcional)</label>
                          <select class="rs-inp" formControlName="tamanoMaxPerro">
                            <option value="">Sin restricción de tamaño</option>
                            <option value="mini">Mini</option>
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

                <h2 class="section-title">Requisitos sanitarios adicionales (opcionales)</h2>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requisitoMicrochip"> Microchip obligatorio</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereDesparasitacionInterna"> Desparasitación interna</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereDesparasitacionExterna"> Desparasitación externa</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereVacunaTosPerreras"> Vacuna tos de las perreras</label>
                </div>

                <h2 class="section-title">Compatibilidad social que admites</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
                  Déjalo todo sin marcar si admites cualquier perfil social.
                </p>
                <div class="checks-grid">
                  @for (c of compatibilidadesSociales; track c.valor) {
                    <label class="filter-check">
                      <input type="checkbox" [checked]="tieneCompatibilidad(c.valor)" (change)="toggleCompatibilidad(c.valor)" />
                      {{ c.label }}
                    </label>
                  }
                </div>

                <h2 class="section-title">Servicios adicionales</h2>
                <div formArrayName="serviciosAdicionales" class="rows">
                  @for (s of serviciosAdicionalesAlojamiento.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">Nombre</label>
                          <input class="rs-inp" formControlName="nombre" placeholder="Ej. Paseo individual diario">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Precio (€)</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdicionalAlojamiento(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdicionalAlojamiento()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir servicio adicional
                </button>
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
                      <label class="rs-checkbox">
                        <input type="checkbox" formControlName="esPrecioCerrado"> Precio cerrado (no orientativo)
                      </label>
                      <span class="rs-field-hint">
                        Marca esto para vacunas, microchip, certificados, revisiones postoperatorias… Déjalo sin marcar
                        para consultas, dermatología, urgencias u otros servicios donde el precio final puede variar.
                      </span>
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

                <div class="rs-field">
                  <label class="rs-lbl">Especies atendidas (separadas por comas)</label>
                  <input class="rs-inp" formControlName="especiesAtendidas" placeholder="perro, gato, conejo, hurón, ave">
                  <span class="rs-field-hint">No es un vertical solo de perros: indica todas las especies que atiendes.</span>
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
                          <label class="rs-lbl">Tamaño de perro (por defecto)</label>
                          <select class="rs-inp" formControlName="tamanoPerro">
                            <option value="">Todos</option>
                            <option value="pequeno">Pequeño</option>
                            <option value="mediano">Mediano</option>
                            <option value="grande">Grande</option>
                            <option value="gigante">Gigante</option>
                          </select>
                        </div>
                      </div>

                      <div class="rs-field">
                        <label class="rs-lbl">Tipo de pelo compatible (vacío = cualquiera)</label>
                        <div class="checks-grid">
                          @for (t of tiposPelo; track t) {
                            <label class="filter-check">
                              <input type="checkbox" [checked]="tienePeloCompatible(i, t)" (change)="togglePeloCompatible(i, t)" />
                              {{ t }}
                            </label>
                          }
                        </div>
                      </div>

                      <div class="rs-field">
                        <label class="rs-lbl">Precio y duración por tamaño (opcional, sustituye al precio por defecto)</label>
                        <div formArrayName="preciosPorTamano" class="rows">
                          @for (t of preciosPorTamano(i).controls; track $index; let ti = $index) {
                            <div [formGroupName]="ti" class="row-card row-card--sm">
                              <div class="row-card__grid row-card__grid--3">
                                <div class="rs-field">
                                  <label class="rs-lbl">Tamaño</label>
                                  <select class="rs-inp" formControlName="tamano">
                                    @for (tp of tamanosPerro; track tp.valor) {
                                      <option [value]="tp.valor">{{ tp.label }}</option>
                                    }
                                  </select>
                                </div>
                                <div class="rs-field">
                                  <label class="rs-lbl">Precio (€)</label>
                                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                                </div>
                                <div class="rs-field">
                                  <label class="rs-lbl">Duración (min)</label>
                                  <input class="rs-inp" type="number" min="0" formControlName="duracionMin">
                                </div>
                              </div>
                              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarPrecioPorTamano(i, ti)">
                                <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                              </button>
                            </div>
                          }
                        </div>
                        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarPrecioPorTamano(i)">
                          <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir tier de tamaño
                        </button>
                      </div>

                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioGrooming(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar servicio
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

                <h2 class="section-title">Perros con temperamento difícil</h2>
                <div class="rs-field">
                  <label class="rs-lbl">Política ante perros nerviosos/agresivos</label>
                  <select class="rs-inp" formControlName="politicaTemperamentoDificil">
                    <option value="aceptar">Aceptar igual</option>
                    <option value="suplemento">Aceptar con suplemento</option>
                    <option value="valoracion_previa">Requiere valoración previa</option>
                    <option value="rechazar">Rechazar</option>
                  </select>
                  <span class="rs-field-hint">El importe del suplemento se define en tu catálogo de suplementos, no aquí.</span>
                </div>
                <label class="rs-checkbox">
                  <input type="checkbox" formControlName="bozalObligatorioSiAgresivo"> Bozal obligatorio si el perro es agresivo con la manipulación
                </label>

                <h2 class="section-title">Servicios adicionales</h2>
                <div formArrayName="serviciosAdicionales" class="rows">
                  @for (s of serviciosAdicionalesPeluqueria.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">Nombre</label>
                          <input class="rs-inp" formControlName="nombre" placeholder="Ej. Corte de uñas">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Precio (€)</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdicionalPeluqueria(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdicionalPeluqueria()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir servicio adicional
                </button>

                <h2 class="section-title">Requisitos</h2>
                <div class="rs-field">
                  <label class="rs-lbl">Razas específicas atendidas (opcional, separadas por comas)</label>
                  <input class="rs-inp" formControlName="razasEspecificas" placeholder="Ej. Caniche, Yorkshire, Bichón">
                </div>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereVacunasAlDia"> Exige vacunas al día</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereMicrochip"> Exige microchip</label>
                </div>
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

                <h2 class="section-title">Valoración inicial</h2>
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Modalidad</label>
                    <select class="rs-inp" formControlName="valoracionInicialModalidad">
                      <option value="presencial">Presencial</option>
                      <option value="online">Online (videollamada)</option>
                      <option value="domicilio">A domicilio</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Precio (€, 0 = no se ofrece)</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="valoracionInicialPrecio">
                  </div>
                </div>

                <h2 class="section-title">Catálogo de servicios y técnicas</h2>
                <div formArrayName="serviciosAdiestramiento" class="rows">
                  @for (s of serviciosAdiestramiento.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--4">
                        <div class="rs-field">
                          <label class="rs-lbl">Nombre *</label>
                          <input class="rs-inp" formControlName="nombre" placeholder="Ej. Curso de cachorros">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Tipo</label>
                          <select class="rs-inp" formControlName="tipo">
                            <option value="valoracion">Valoración</option>
                            <option value="individual">Sesión individual</option>
                            <option value="grupal">Sesión grupal</option>
                            <option value="curso">Curso completo</option>
                            <option value="especial">Servicio especial</option>
                          </select>
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
                      <div class="row-card__grid row-card__grid--4">
                        <div class="rs-field">
                          <label class="rs-lbl">Máx. perros</label>
                          <input class="rs-inp" type="number" min="1" formControlName="maxPerros">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Edad mín. (meses)</label>
                          <input class="rs-inp" type="number" min="0" formControlName="edadMinimaMeses">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Edad máx. (meses, 0 = sin límite)</label>
                          <input class="rs-inp" type="number" min="0" formControlName="edadMaximaMeses">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Lugar</label>
                          <select class="rs-inp" formControlName="lugar">
                            <option value="centro">En el centro</option>
                            <option value="domicilio">A domicilio</option>
                            <option value="online">Online</option>
                          </select>
                        </div>
                      </div>
                      <div class="rs-field">
                        <label class="rs-lbl">Material necesario (opcional)</label>
                        <input class="rs-inp" formControlName="materialNecesario" placeholder="Ej. correa larga, arnés antitirón">
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdiestramiento(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdiestramiento()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir servicio o técnica
                </button>
              </div>
            }

            @case ('hoteles') {
              <div formGroupName="hoteles" class="vertical-section">
                <h2 class="section-title">Política de mascotas</h2>
                <label class="rs-checkbox"><input type="checkbox" formControlName="admiteMascotas"> Admite mascotas</label>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Máximo de mascotas por reserva (0 = sin límite)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="maxMascotasPorReserva">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Peso máximo por mascota, kg (0 = sin límite)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="pesoMaximoMascotaKg">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Razas restringidas</label>
                  <select class="rs-inp" formControlName="razasRestringidas">
                    <option value="ninguna">Ninguna restricción</option>
                    <option value="ppp">Razas potencialmente peligrosas (PPP)</option>
                    <option value="razas_gigantes">Razas gigantes</option>
                    <option value="especificas">Razas específicas</option>
                  </select>
                </div>
                @if (hotelesGroup.get('razasRestringidas')?.value === 'especificas') {
                  <div class="rs-field">
                    <label class="rs-lbl">Razas restringidas (separadas por comas)</label>
                    <input class="rs-inp" formControlName="razasEspecificasRestringidas" placeholder="Pitbull, Dogo argentino">
                  </div>
                }

                <div class="rs-field">
                  <label class="rs-lbl">Especies permitidas (separadas por comas)</label>
                  <input class="rs-inp" formControlName="especiesPermitidas" placeholder="perro, gato, conejo, hurón">
                </div>

                <h2 class="section-title">Suplemento por tamaño de mascota (€/noche)</h2>
                <div formArrayName="suplementoPorTamanoMascota" class="rows">
                  @for (t of suplementoPorTamanoMascota.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">Tamaño</label>
                          <select class="rs-inp" formControlName="tamano">
                            @for (tp of tamanosPerro; track tp.valor) {
                              <option [value]="tp.valor">{{ tp.label }}</option>
                            }
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Suplemento (€/noche)</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioPorNoche">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarSuplementoPorTamanoMascota(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarSuplementoPorTamanoMascota()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir tier de tamaño
                </button>

                <div class="rs-field">
                  <label class="rs-lbl">Suplemento por mascota adicional (€/noche)</label>
                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="suplementoSegundaMascotaPorNoche">
                </div>

                <h2 class="section-title">Servicios petfriendly</h2>
                <div class="rs-field">
                  <label class="rs-lbl">Servicios disponibles (separados por comas)</label>
                  <input class="rs-inp" formControlName="serviciosPetfriendly"
                         placeholder="Camas para perros, comederos/bebederos, kit de bienvenida, zona de paseo, parque canino cercano, guardería, paseo, peluquería, veterinario cercano, menú para mascotas">
                </div>

                <h2 class="section-title">Normas del alojamiento</h2>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="puedeQuedarseSoloEnHabitacion"> Puede quedarse solo en la habitación</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="accesoZonasComunes"> Acceso a zonas comunes</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="debeIrConCorrea"> Debe ir con correa</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="debeLlevarBozalSiCorresponde"> Debe llevar bozal si corresponde</label>
                </div>

                <h2 class="section-title">Info general</h2>
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
                    <label class="rs-lbl">Fianza (€, 0 = sin fianza)</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="fianza">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Habitaciones pet-friendly disponibles *</label>
                    <input class="rs-inp" type="number" min="0" formControlName="unidadesDisponibles">
                  </div>
                </div>
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

    .checks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--sp-2); }
    .filter-check { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-size: var(--f-sm); color: var(--t-200); }

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
    .row-card--sm { padding: var(--sp-3); background: var(--c-surface); }
    .row-card__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-3); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }
    .row-card__grid--2 { grid-template-columns: repeat(2, 1fr); @media (max-width: 640px) { grid-template-columns: 1fr; } }
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

  // Aptitud (compatibilidad servicio↔perro) — comunes a cualquier vertical.
  readonly tamanosPerro: ReadonlyArray<{ valor: string; label: string }> = [
    { valor: 'mini', label: 'Mini (0-5 kg)' },
    { valor: 'pequeno', label: 'Pequeño (5-10 kg)' },
    { valor: 'mediano', label: 'Mediano (10-25 kg)' },
    { valor: 'grande', label: 'Grande (25-40 kg)' },
    { valor: 'gigante', label: 'Gigante (+40 kg)' },
  ];
  readonly tiposPelo = ['corto', 'medio', 'largo', 'rizado', 'duro', 'doble_capa'];
  private readonly tamanosSeleccionados = signal<string[]>([]);
  private readonly pelosSeleccionados = signal<string[]>([]);
  temperamentosNoAdmitidosCsv = '';

  tieneTamano(v: string): boolean { return this.tamanosSeleccionados().includes(v); }
  toggleTamano(v: string): void {
    this.tamanosSeleccionados.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  tienePelo(v: string): boolean { return this.pelosSeleccionados().includes(v); }
  togglePelo(v: string): void {
    this.pelosSeleccionados.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

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
      requisitoMicrochip: [false],
      requiereDesparasitacionInterna: [false],
      requiereDesparasitacionExterna: [false],
      requiereVacunaTosPerreras: [false],
      serviciosAdicionales: this.fb.array<FormGroup>([]),
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
      especiesAtendidas: ['perro'],
    }),

    peluqueria: this.fb.group({
      serviciosGrooming: this.fb.array<FormGroup>([]),
      duracionSlotMin: [60],
      capacidadSimultanea: [2],
      aDomicilio: [false],
      horario: [''],
      politicaTemperamentoDificil: ['aceptar'],
      bozalObligatorioSiAgresivo: [true],
      serviciosAdicionales: this.fb.array<FormGroup>([]),
      razasEspecificas: [''],
      requiereVacunasAlDia: [true],
      requiereMicrochip: [true],
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
      serviciosAdiestramiento: this.fb.array<FormGroup>([]),
      valoracionInicialModalidad: ['presencial'],
      valoracionInicialPrecio: [0],
    }),

    hoteles: this.fb.group({
      admiteMascotas: [true],
      maxMascotasPorReserva: [0],
      pesoMaximoMascotaKg: [0],
      razasRestringidas: ['ninguna'],
      razasEspecificasRestringidas: [''],
      especiesPermitidas: [''],
      suplementoPorTamanoMascota: this.fb.array<FormGroup>([]),
      suplementoSegundaMascotaPorNoche: [0],
      serviciosPetfriendly: [''],
      puedeQuedarseSoloEnHabitacion: [true],
      accesoZonasComunes: [true],
      debeIrConCorrea: [true],
      debeLlevarBozalSiCorresponde: [true],
      checkIn: [''],
      checkOut: [''],
      fianza: [0],
      unidadesDisponibles: [1, [Validators.required, Validators.min(0)]],
    }),
  });

  get alojamientoGroup(): FormGroup { return this.form.controls.alojamiento; }
  get transporteGroup(): FormGroup { return this.form.controls.transporte; }
  get veterinariaGroup(): FormGroup { return this.form.controls.veterinaria; }
  get peluqueriaGroup(): FormGroup { return this.form.controls.peluqueria; }
  get adiestramientoGroup(): FormGroup { return this.form.controls.adiestramiento; }
  get hotelesGroup(): FormGroup { return this.form.controls.hoteles; }
  get serviciosAdiestramiento(): FormArray { return this.adiestramientoGroup.get('serviciosAdiestramiento') as FormArray; }

  get espacios(): FormArray { return this.alojamientoGroup.get('espacios') as FormArray; }
  get serviciosAdicionalesAlojamiento(): FormArray { return this.alojamientoGroup.get('serviciosAdicionales') as FormArray; }
  get serviciosClinicos(): FormArray { return this.veterinariaGroup.get('serviciosClinicos') as FormArray; }
  get serviciosGrooming(): FormArray { return this.peluqueriaGroup.get('serviciosGrooming') as FormArray; }
  get serviciosAdicionalesPeluqueria(): FormArray { return this.peluqueriaGroup.get('serviciosAdicionales') as FormArray; }
  get suplementoPorTamanoMascota(): FormArray { return this.hotelesGroup.get('suplementoPorTamanoMascota') as FormArray; }

  private nuevoEspacio(e?: Record<string, unknown>) {
    return this.fb.group({
      tipo: [(e?.['tipo'] as string) ?? 'estandar'],
      tamanoMaxPerro: [(e?.['tamanoMaxPerro'] as string) ?? ''],
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

  private nuevoServicioAdicionalAlojamiento(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
    });
  }

  agregarServicioAdicionalAlojamiento(): void {
    this.serviciosAdicionalesAlojamiento.push(this.nuevoServicioAdicionalAlojamiento());
  }
  quitarServicioAdicionalAlojamiento(i: number): void { this.serviciosAdicionalesAlojamiento.removeAt(i); }

  private nuevoServicioAdiestramiento(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      tipo: [(e?.['tipo'] as string) ?? 'individual'],
      precio: [(e?.['precio'] as number) ?? 0],
      duracionMin: [(e?.['duracionMin'] as number) ?? 60],
      maxPerros: [(e?.['maxPerros'] as number) ?? 1],
      edadMinimaMeses: [(e?.['edadMinimaMeses'] as number) ?? 0],
      edadMaximaMeses: [(e?.['edadMaximaMeses'] as number) ?? 0],
      lugar: [(e?.['lugar'] as string) ?? 'centro'],
      materialNecesario: [(e?.['materialNecesario'] as string) ?? ''],
    });
  }

  agregarServicioAdiestramiento(): void { this.serviciosAdiestramiento.push(this.nuevoServicioAdiestramiento()); }
  quitarServicioAdiestramiento(i: number): void { this.serviciosAdiestramiento.removeAt(i); }

  private nuevoSuplementoPorTamanoMascota(t?: Record<string, unknown>) {
    return this.fb.group({
      tamano: [(t?.['tamano'] as string) ?? 'mediano'],
      precioPorNoche: [(t?.['precioPorNoche'] as number) ?? 0],
    });
  }

  agregarSuplementoPorTamanoMascota(): void {
    this.suplementoPorTamanoMascota.push(this.nuevoSuplementoPorTamanoMascota());
  }
  quitarSuplementoPorTamanoMascota(i: number): void { this.suplementoPorTamanoMascota.removeAt(i); }

  // Compatibilidad social admitida (residencia) — mismo patrón que aptitud tamaños/pelo.
  readonly compatibilidadesSociales: ReadonlyArray<{ valor: string; label: string }> = [
    { valor: 'cualquiera', label: 'Compatible con otros perros' },
    { valor: 'solo_pequenos', label: 'Solo con perros pequeños' },
    { valor: 'solo_machos', label: 'Solo con machos' },
    { valor: 'solo_hembras', label: 'Solo con hembras' },
    { valor: 'individual', label: 'Necesita alojamiento individual' },
  ];
  private readonly compatibilidadesSeleccionadas = signal<string[]>([]);
  tieneCompatibilidad(v: string): boolean { return this.compatibilidadesSeleccionadas().includes(v); }
  toggleCompatibilidad(v: string): void {
    this.compatibilidadesSeleccionadas.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  private nuevoServicioClinico(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
      duracionMin: [(e?.['duracionMin'] as number) ?? 30],
      esPrecioCerrado: [(e?.['esPrecioCerrado'] as boolean) ?? false],
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
      tipoPeloCompatible: [csvA(e?.['tipoPeloCompatible'] as string[] | undefined)],
      preciosPorTamano: this.fb.array<FormGroup>(
        ((e?.['preciosPorTamano'] as Record<string, unknown>[] | undefined) ?? [])
          .map(t => this.nuevoPrecioPorTamano(t)),
      ),
    });
  }

  agregarServicioGrooming(): void { this.serviciosGrooming.push(this.nuevoServicioGrooming()); }
  quitarServicioGrooming(i: number): void { this.serviciosGrooming.removeAt(i); }

  private nuevoPrecioPorTamano(t?: Record<string, unknown>) {
    return this.fb.group({
      tamano: [(t?.['tamano'] as string) ?? 'mediano'],
      precio: [(t?.['precio'] as number) ?? 0],
      duracionMin: [(t?.['duracionMin'] as number) ?? 45],
    });
  }

  preciosPorTamano(rowIndex: number): FormArray {
    return this.serviciosGrooming.at(rowIndex).get('preciosPorTamano') as FormArray;
  }

  agregarPrecioPorTamano(rowIndex: number): void { this.preciosPorTamano(rowIndex).push(this.nuevoPrecioPorTamano()); }
  quitarPrecioPorTamano(rowIndex: number, i: number): void { this.preciosPorTamano(rowIndex).removeAt(i); }

  pelosCompatibles(rowIndex: number): string[] {
    return aCsv(this.serviciosGrooming.at(rowIndex).get('tipoPeloCompatible')?.value ?? '');
  }
  tienePeloCompatible(rowIndex: number, v: string): boolean {
    return this.pelosCompatibles(rowIndex).includes(v);
  }
  togglePeloCompatible(rowIndex: number, v: string): void {
    const actuales = this.pelosCompatibles(rowIndex);
    const nuevos = actuales.includes(v) ? actuales.filter(x => x !== v) : [...actuales, v];
    this.serviciosGrooming.at(rowIndex).get('tipoPeloCompatible')?.setValue(csvA(nuevos));
  }

  private nuevoServicioAdicionalPeluqueria(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
    });
  }

  agregarServicioAdicionalPeluqueria(): void {
    this.serviciosAdicionalesPeluqueria.push(this.nuevoServicioAdicionalPeluqueria());
  }
  quitarServicioAdicionalPeluqueria(i: number): void { this.serviciosAdicionalesPeluqueria.removeAt(i); }

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
      if (s.aptitud) {
        this.tamanosSeleccionados.set(s.aptitud.tamanosAdmitidos ?? []);
        this.pelosSeleccionados.set(s.aptitud.tipoPeloAdmitido ?? []);
        this.temperamentosNoAdmitidosCsv = csvA(s.aptitud.temperamentosNoAdmitidos);
      }
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
        requisitoMicrochip: d['requisitoMicrochip'] ?? false,
        requiereDesparasitacionInterna: d['requiereDesparasitacionInterna'] ?? false,
        requiereDesparasitacionExterna: d['requiereDesparasitacionExterna'] ?? false,
        requiereVacunaTosPerreras: d['requiereVacunaTosPerreras'] ?? false,
      });
      const lista = (d['espacios'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.espacios.push(this.nuevoEspacio(e)));
      this.compatibilidadesSeleccionadas.set((d['compatibilidadSocialAdmitida'] as string[] | undefined) ?? []);
      const adicionales = (d['serviciosAdicionales'] as Record<string, unknown>[] | undefined) ?? [];
      adicionales.forEach(e => this.serviciosAdicionalesAlojamiento.push(this.nuevoServicioAdicionalAlojamiento(e)));
    } else if (vertical === VerticalKey.TRANSPORTE) {
      this.transporteGroup.patchValue({
        ...d,
        zonaCobertura: csvA(d['zonaCobertura'] as string[] | undefined),
      });
    } else if (vertical === VerticalKey.VETERINARIA) {
      this.veterinariaGroup.patchValue({
        ...d,
        especialidades: csvA(d['especialidades'] as string[] | undefined),
        especiesAtendidas: csvA(d['especiesAtendidas'] as string[] | undefined),
      });
      const lista = (d['serviciosClinicos'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.serviciosClinicos.push(this.nuevoServicioClinico(e)));
    } else if (vertical === VerticalKey.PELUQUERIA) {
      this.peluqueriaGroup.patchValue({
        ...d,
        razasEspecificas: csvA(d['razasEspecificas'] as string[] | undefined),
      });
      const lista = (d['serviciosGrooming'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.serviciosGrooming.push(this.nuevoServicioGrooming(e)));
      const adicionales = (d['serviciosAdicionales'] as Record<string, unknown>[] | undefined) ?? [];
      adicionales.forEach(e => this.serviciosAdicionalesPeluqueria.push(this.nuevoServicioAdicionalPeluqueria(e)));
    } else if (vertical === VerticalKey.ADIESTRAMIENTO) {
      const valoracionInicial = d['valoracionInicial'] as Record<string, unknown> | undefined;
      this.adiestramientoGroup.patchValue({
        ...d,
        tiposAdiestramiento: csvA(d['tiposAdiestramiento'] as string[] | undefined),
        valoracionInicialModalidad: valoracionInicial?.['modalidad'] ?? 'presencial',
        valoracionInicialPrecio: valoracionInicial?.['precio'] ?? 0,
      });
      const servicios = (d['serviciosAdiestramiento'] as Record<string, unknown>[] | undefined) ?? [];
      servicios.forEach(e => this.serviciosAdiestramiento.push(this.nuevoServicioAdiestramiento(e)));
    } else if (vertical === VerticalKey.HOTELES) {
      this.hotelesGroup.patchValue({
        ...d,
        especiesPermitidas: csvA(d['especiesPermitidas'] as string[] | undefined),
        serviciosPetfriendly: csvA(d['serviciosPetfriendly'] as string[] | undefined),
        razasEspecificasRestringidas: csvA(d['razasEspecificasRestringidas'] as string[] | undefined),
      });
      const lista = (d['suplementoPorTamanoMascota'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(t => this.suplementoPorTamanoMascota.push(this.nuevoSuplementoPorTamanoMascota(t)));
    }
  }

  private construirDetalleVertical(vertical: string): Record<string, unknown> | null {
    if (vertical === VerticalKey.ALOJAMIENTO) {
      const g = this.alojamientoGroup.getRawValue();
      return {
        espacios: this.espacios.controls.map(c => {
          const v = c.getRawValue();
          return { ...v, amenities: aCsv(v.amenities), tamanoMaxPerro: v.tamanoMaxPerro || undefined };
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
        requisitoMicrochip: g.requisitoMicrochip,
        requiereDesparasitacionInterna: g.requiereDesparasitacionInterna,
        requiereDesparasitacionExterna: g.requiereDesparasitacionExterna,
        requiereVacunaTosPerreras: g.requiereVacunaTosPerreras,
        compatibilidadSocialAdmitida: this.compatibilidadesSeleccionadas(),
        serviciosAdicionales: this.serviciosAdicionalesAlojamiento.controls.map(c => c.getRawValue()),
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
        especiesAtendidas: aCsv(g.especiesAtendidas),
        serviciosClinicos: this.serviciosClinicos.controls.map(c => c.getRawValue()),
      };
    }
    if (vertical === VerticalKey.PELUQUERIA) {
      const g = this.peluqueriaGroup.getRawValue();
      return {
        ...g,
        razasEspecificas: aCsv(g.razasEspecificas),
        serviciosGrooming: this.serviciosGrooming.controls.map(c => {
          const v = c.getRawValue();
          return { ...v, tipoPeloCompatible: aCsv(v.tipoPeloCompatible) };
        }),
        serviciosAdicionales: this.serviciosAdicionalesPeluqueria.controls.map(c => c.getRawValue()),
      };
    }
    if (vertical === VerticalKey.ADIESTRAMIENTO) {
      const g = this.adiestramientoGroup.getRawValue();
      return {
        ...g,
        tiposAdiestramiento: aCsv(g.tiposAdiestramiento),
        precioPrograma: g.modalidad === 'programa' && g.precioPrograma > 0 ? g.precioPrograma : undefined,
        sesionesPorPrograma: g.modalidad === 'programa' && g.sesionesPorPrograma > 0 ? g.sesionesPorPrograma : undefined,
        serviciosAdiestramiento: this.serviciosAdiestramiento.controls.map(c => c.getRawValue()),
        valoracionInicial: g.valoracionInicialPrecio > 0
          ? { modalidad: g.valoracionInicialModalidad, precio: g.valoracionInicialPrecio }
          : undefined,
      };
    }
    if (vertical === VerticalKey.HOTELES) {
      const g = this.hotelesGroup.getRawValue();
      return {
        ...g,
        especiesPermitidas: aCsv(g.especiesPermitidas),
        serviciosPetfriendly: aCsv(g.serviciosPetfriendly),
        razasEspecificasRestringidas: aCsv(g.razasEspecificasRestringidas),
        maxMascotasPorReserva: g.maxMascotasPorReserva > 0 ? g.maxMascotasPorReserva : undefined,
        pesoMaximoMascotaKg: g.pesoMaximoMascotaKg > 0 ? g.pesoMaximoMascotaKg : undefined,
        suplementoSegundaMascotaPorNoche: g.suplementoSegundaMascotaPorNoche > 0 ? g.suplementoSegundaMascotaPorNoche : undefined,
        fianza: g.fianza > 0 ? g.fianza : undefined,
        suplementoPorTamanoMascota: this.suplementoPorTamanoMascota.controls.map(c => c.getRawValue()),
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
      aptitud: {
        tamanosAdmitidos: this.tamanosSeleccionados(),
        tipoPeloAdmitido: this.pelosSeleccionados(),
        temperamentosNoAdmitidos: aCsv(this.temperamentosNoAdmitidosCsv),
      },
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
