import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormsModule, NonNullableFormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  VerticalKey, VERTICAL_LABELS, ServicioClinicoTipo, SERVICIO_CLINICO_LABELS,
  TipoSeguro, TIPO_SEGURO_LABELS,
} from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { RsTagsInputComponent } from '../../shared/components/tags-input/rs-tags-input.component';
import {
  RsPlaceAutocompleteComponent, type LugarElegido,
} from '../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import {
  AMENITIES_ALOJAMIENTO, AMENITIES_ESPACIO, ESPECIALIDADES_VETERINARIAS, ESPECIES_ATENDIDAS,
  RAZAS_FRECUENTES, SERVICIOS_PETFRIENDLY, TEMPERAMENTOS, TIPOS_ADIESTRAMIENTO,
} from '../../shared/catalogos/tags.catalogo';
import { CIUDADES_ES, PROVINCIAS_ES } from '../../shared/catalogos/lugares.catalogo';
import { POLITICAS_CANCELACION } from '../../shared/catalogos/politicas-cancelacion.catalogo';
import { ComercioApiService, ServicioPayload } from './comercio-api.service';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
/** Catálogo cerrado de servicios veterinarios, para el desplegable del formulario. */
const SERVICIOS_CLINICOS_CATALOGO = Object.values(ServicioClinicoTipo)
  .map((tipo) => ({ tipo, label: SERVICIO_CLINICO_LABELS[tipo] }));

/**
 * Reconoce el servicio del catálogo a partir del nombre escrito a mano en
 * listados antiguos, para que al editarlos no se pierda lo ya publicado.
 */
function tipoDesdeNombre(nombre?: string): ServicioClinicoTipo | undefined {
  if (!nombre) return undefined;
  const sinTildes = (t: string): string =>
    t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  const buscado = sinTildes(nombre);
  return SERVICIOS_CLINICOS_CATALOGO.find(({ label }) => sinTildes(label) === buscado)?.tipo;
}

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

/** Pasos del alta de un servicio; el orden es el del recorrido. */
type PasoListado = 'categoria' | 'ubicacion' | 'detalles' | 'aptitud' | 'fotos';

/**
 * Un servicio pide entre veinte y sesenta datos según la categoría: en una sola
 * página nadie llegaba al final. Se reparte en cinco pantallas cortas, el patrón
 * de "crea tu anuncio" de Airbnb, con lo obligatorio delante.
 */
const PASOS: ReadonlyArray<{
  readonly clave: PasoListado;
  /** Etiqueta corta del indicador de pasos. */
  readonly label: string;
  readonly titulo: string;
  readonly ayuda: string;
}> = [
  { clave: 'categoria', label: 'Categoría',
    titulo: '¿Qué servicio ofreces?',
    ayuda: 'Elige la categoría y ponle un nombre que se entienda de un vistazo.' },
  { clave: 'ubicacion', label: 'Dónde y cuánto',
    titulo: '¿Dónde lo ofreces y por cuánto?',
    ayuda: 'La población sitúa tu anuncio en el mapa. El precio es el «desde» que verá el cliente.' },
  { clave: 'detalles', label: 'Detalles',
    titulo: 'Detalles del servicio',
    ayuda: 'Lo propio de tu categoría: es lo que hace que el cliente reserve contigo.' },
  { clave: 'aptitud', label: 'Para qué perros',
    titulo: '¿Para qué perros es apto?',
    ayuda: 'Déjalo sin marcar si vale para cualquier perro.' },
  { clave: 'fotos', label: 'Fotos',
    titulo: 'Fotos y publicación',
    ayuda: 'Las fichas con fotos reales reciben muchas más reservas que las que no las tienen.' },
];

/** Campos obligatorios que cierra cada paso antes de dejar avanzar. */
const CAMPOS_DEL_PASO: Record<PasoListado, ReadonlyArray<string>> = {
  categoria: ['vertical', 'titulo', 'descripcion'],
  ubicacion: ['ciudad', 'precioBase'],
  // Lo específico del vertical se valida contra su propio grupo y su regla
  // de negocio (`validarVertical`), no con una lista de campos fija.
  detalles: [],
  aptitud: [],
  fotos: [],
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
  imports: [
    RouterLink, ReactiveFormsModule, FormsModule,
    RsIconComponent, RsImageUploadComponent, RsTagsInputComponent, RsPlaceAutocompleteComponent, EurosPipe,],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <a routerLink="/comercio/listados" class="back-link">
          <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
          Volver a mis servicios
        </a>
        <h1>{{ esEdicion() ? 'Editar servicio' : 'Nuevo servicio' }}</h1>
        <p>{{ esEdicion() ? 'Ve directamente al paso que quieras cambiar.' : 'Cinco pasos cortos. Puedes volver atrás en cualquier momento.' }}</p>
      </div>

      @if (cargando()) {
        <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">Cargando…</div>
      } @else {
      <!--
        Indicador de pasos. En escritorio cada punto lleva su etiqueta; en móvil
        sólo los puntos, y el nombre del paso va en la línea de arriba, que es
        donde se lee sin apretar la pantalla.
      -->
      <div class="pasos">
        <p class="pasos__actual">
          <strong>Paso {{ indicePaso() + 1 }} de {{ pasos.length }}</strong>
          <span class="pasos__sep">·</span>{{ pasoUi().label }}
        </p>
        <ol class="pasos__lista">
          @for (p of pasos; track p.clave; let i = $index) {
            <li class="paso"
                [class.paso--actual]="paso() === p.clave"
                [class.paso--hecho]="i < indicePaso()">
              <button type="button" class="paso__btn" [disabled]="!puedeIrAlPaso(i)"
                      [attr.aria-current]="paso() === p.clave ? 'step' : null"
                      (click)="irAlPaso(p.clave)">
                <span class="paso__num">
                  @if (i < indicePaso()) {
                    <rs-icon name="check" [size]="12" [stroke]="3"></rs-icon>
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <span class="paso__label">{{ p.label }}</span>
              </button>
            </li>
          }
        </ol>
      </div>

      <div class="form-card rs-card">
        <form [formGroup]="form" (ngSubmit)="enviarFormulario()">

          <header class="paso-head">
            <h2 class="paso-head__titulo">{{ tituloPaso() }}</h2>
            <p class="paso-head__ayuda">{{ pasoUi().ayuda }}</p>
          </header>

          @if (paso() === 'categoria') {

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
              <span class="rs-field-hint">La categoría no se puede cambiar después de crear el servicio.</span>
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

          }

          @if (paso() === 'ubicacion') {
          <div class="form-row-2">
            <div class="rs-field">
              <label class="rs-lbl" for="ciudad">Ciudad *</label>
              <rs-place-autocomplete inputId="ciudad" formControlName="ciudad"
                                     apariencia="campo" placeholder="Busca tu población…"
                                     [catalogoLocal]="catalogos.ciudades"
                                     (lugarElegido)="guardarCoordenadas($event)" />
              @if (hasError('ciudad')) {
                <span class="rs-field-err">La ciudad es obligatoria.</span>
              }
              @if (!tieneCoordenadas()) {
                <span class="rs-field-hint">
                  Elige tu población en la lista para que tu anuncio salga en la búsqueda por mapa.
                </span>
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

          }

          <!-- ═══ APTITUD (compatibilidad servicio↔perro) ═══ -->
          @if (paso() === 'aptitud') {
          <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
            Si marcas algo, Doogking solo mostrará este servicio a clientes cuyo perro encaje.
          </p>
          <div class="rs-field">
            <label class="rs-lbl">Tamaños admitidos</label>
            <div class="checks-grid">
              @for (t of tamanosAdmitidos; track t.valor) {
                <label class="filter-check">
                  <input type="checkbox" [checked]="tieneTamano(t.valor)" (change)="toggleTamano(t.valor)" />
                  {{ t.label }}
                </label>
              }
            </div>
          </div>
          <div class="rs-field">
            <span class="rs-lbl">Temperamentos que no admites</span>
            <rs-tags-input [(ngModel)]="temperamentosNoAdmitidos" [ngModelOptions]="{standalone: true}"
                           etiqueta="Temperamentos que no admites"
                           [opciones]="catalogos.temperamentos" [permiteNuevos]="false"
                           placeholder="Elige de la lista…" />
          </div>

          }

          <!-- ═══ SECCIÓN POR VERTICAL ═══ -->
          @if (paso() === 'detalles') {
          @switch (form.controls.vertical.value) {

            @case ('') {
              <p class="rs-field-hint">
                Vuelve al primer paso y elige una categoría para ver aquí sus datos propios.
              </p>
            }

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
                        <span class="rs-lbl">Amenities de este espacio</span>
                        <rs-tags-input formControlName="amenities" etiqueta="Amenities de este espacio"
                                       [opciones]="catalogos.amenitiesEspacio" placeholder="Ej. cama ortopédica…" />
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
                  <span class="rs-lbl">Amenities generales</span>
                  <rs-tags-input formControlName="amenities" etiqueta="Amenities generales del alojamiento"
                                 [opciones]="catalogos.amenitiesAlojamiento" placeholder="Ej. jardín vallado…" />
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
                  <!--
                    Tarjetas en vez de un desplegable: elegir entre "flexible",
                    "moderada" y "estricta" sin saber qué significa cada una
                    lleva a marcar la primera. Con la condición a la vista se
                    elige la que el comercio de verdad puede cumplir.
                  -->
                  <div class="politicas">
                    @for (p of politicasCancelacion; track p.valor) {
                      <label class="politica" [class.politica--sel]="politicaElegida() === p.valor">
                        <input type="radio" formControlName="politicaCancelacion" [value]="p.valor" />
                        <span>
                          <span class="politica__nombre">{{ p.label }}</span>
                          <span class="politica__desc">{{ p.descripcion }}</span>
                        </span>
                      </label>
                    }
                    <label class="politica" [class.politica--sel]="!politicaElegida()">
                      <input type="radio" formControlName="politicaCancelacion" value="" />
                      <span>
                        <span class="politica__nombre">Sin especificar</span>
                        <span class="politica__desc">Acuerdas las condiciones con cada cliente.</span>
                      </span>
                    </label>
                  </div>
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

                <h2 class="section-title">Conductas de riesgo que no admites (Ref. RES5)</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
                  Si un perro con esta conducta intenta reservar, se le avisará antes de completar la reserva.
                  Déjalo todo sin marcar si admites cualquier conducta.
                </p>
                <div class="checks-grid">
                  @for (c of conductasRiesgo; track c.valor) {
                    <label class="filter-check">
                      <input type="checkbox" [checked]="tieneConductaNoAdmitida(c.valor)" (change)="toggleConductaNoAdmitida(c.valor)" />
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
                <p class="rs-field-hint" style="margin-bottom:var(--sp-3)">
                  Los campos marcados con <strong>*</strong> son obligatorios; el resto son
                  opcionales y solo ayudan a que recibas solicitudes que sí puedas atender.
                </p>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">Tipo de vehículo <span class="rs-field-hint">(opcional)</span></label>
                    <select class="rs-inp" formControlName="tipoVehiculo">
                      <option value="van_acondicionada">Van acondicionada</option>
                      <option value="coche">Coche</option>
                      <option value="furgon_climatizado">Furgón climatizado</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Capacidad (perros) <span class="rs-field-hint">(opcional)</span></label>
                    <input class="rs-inp" type="number" min="1" formControlName="capacidadPerros">
                  </div>
                </div>

                <div class="rs-field">
                  <span class="rs-lbl">Zona de cobertura <span class="rs-field-hint">(opcional)</span></span>
                  <rs-tags-input formControlName="zonaCobertura" etiqueta="Zona de cobertura"
                                 [opciones]="catalogos.provincias" placeholder="Ej. Madrid, Toledo…" />
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

                <div class="rs-field">
                  <label class="rs-lbl">Tarifa de espera, por hora (€) <span class="rs-field-hint">(opcional)</span></label>
                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaEsperaPorHora">
                  <span class="rs-field-hint">Se cobra en trayectos de "ida y vuelta con espera" (Ref. TRA4). Déjalo en 0 si no cobras el tiempo de espera.</span>
                </div>

                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="jaulasIncluidas"> Jaulas incluidas</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="acompananteHumano"> Acompañante humano opcional</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="soloPerros"> Sólo perros</label>
                </div>

                <h2 class="section-title">Condiciones del servicio (todas opcionales)</h2>
                <span class="rs-field-hint" style="display:block;margin-bottom:var(--sp-3)">
                  Cuanto más concretes, menos solicitudes recibirás que no puedas atender.
                </span>
                <div class="row-card__grid row-card__grid--3">
                  <div class="rs-field">
                    <label class="rs-lbl">Radio de cobertura (km)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="radioCoberturaKm">
                    <span class="rs-field-hint">0 = sin límite</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Distancia mínima facturable (km)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="distanciaMinimaKm">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Antelación mínima (horas)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="antelacionMinimaHoras">
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Máximo de perros por trayecto</label>
                  <input class="rs-inp" type="number" min="1" formControlName="maxPerrosPorTrayecto">
                  <span class="rs-field-hint">Déjalo vacío para usar la capacidad del vehículo.</span>
                </div>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="aceptaPPP"> Acepto perros de razas PPP</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereTransportinPropio"> El cliente aporta su transportín</label>
                </div>

                <h2 class="section-title">Servicios adicionales</h2>
                <p class="rs-field-hint">
                  Se muestran al cliente en el paso 1 de la reserva y se suman al precio del trayecto.
                </p>
                <div formArrayName="serviciosAdicionales" class="rows">
                  @for (s of serviciosAdicionalesTransporte.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">Nombre</label>
                          <input class="rs-inp" formControlName="nombre" placeholder="Ej. Recogida a domicilio">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">Precio (€)</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdicionalTransporte(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> Quitar
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdicionalTransporte()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> Añadir servicio adicional
                </button>
              </div>
            }

            @case ('veterinaria') {
              <div formGroupName="veterinaria" class="vertical-section">
                <h2 class="section-title">Servicios clínicos</h2>

                <div class="rs-field">
                  <span class="rs-lbl">Especialidades</span>
                  <rs-tags-input formControlName="especialidades" etiqueta="Especialidades de la clínica"
                                 [opciones]="catalogos.especialidades" placeholder="Ej. traumatología…" />
                </div>

                <div formArrayName="serviciosClinicos" class="rows">
                  @for (s of serviciosClinicos.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--3">
                        <div class="rs-field">
                          <label class="rs-lbl">Servicio *</label>
                          <select class="rs-inp" formControlName="tipo">
                            <option value="">Elige un servicio…</option>
                            @for (t of serviciosClinicosCatalogo; track t.tipo) {
                              <option [value]="t.tipo">{{ t.label }}</option>
                            }
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
                      <label class="rs-checkbox">
                        <input type="checkbox" formControlName="esPrecioCerrado"> Precio cerrado (no orientativo)
                      </label>
                      <span class="rs-field-hint">
                        Marca esto para vacunas, microchip o higiene dental, donde el importe es fijo. Déjalo sin marcar
                        para consultas y urgencias, donde el precio final puede variar.
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
                <span class="rs-field-hint" style="display:block;margin-top:var(--sp-2)">
                  Doogking solo intermedia servicios de precio acotado. Dermatología, cirugía y cualquier tratamiento
                  de precio abierto se presupuestan y facturan directamente con el cliente, fuera de la plataforma.
                </span>

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
                  <span class="rs-lbl">Especies atendidas</span>
                  <rs-tags-input formControlName="especiesAtendidas" etiqueta="Especies atendidas"
                                 [opciones]="catalogos.especies" [permiteNuevos]="false"
                                 placeholder="Elige de la lista…" />
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
                  <span class="rs-lbl">Razas específicas atendidas (opcional)</span>
                  <rs-tags-input formControlName="razasEspecificas" etiqueta="Razas específicas atendidas"
                                 [opciones]="catalogos.razas" placeholder="Ej. Caniche…" />
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
                  <span class="rs-lbl">Tipos de adiestramiento</span>
                  <rs-tags-input formControlName="tiposAdiestramiento" etiqueta="Tipos de adiestramiento"
                                 [opciones]="catalogos.tiposAdiestramiento" placeholder="Ej. obediencia básica…" />
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
                    <span class="rs-lbl">Razas restringidas</span>
                    <rs-tags-input formControlName="razasEspecificasRestringidas" etiqueta="Razas restringidas"
                                   [opciones]="catalogos.razas" placeholder="Ej. Pit Bull Terrier…" />
                  </div>
                }

                <div class="rs-field">
                  <span class="rs-lbl">Especies permitidas</span>
                  <rs-tags-input formControlName="especiesPermitidas" etiqueta="Especies permitidas"
                                 [opciones]="catalogos.especies" [permiteNuevos]="false"
                                 placeholder="Elige de la lista…" />
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
                  <span class="rs-lbl">Servicios disponibles</span>
                  <rs-tags-input formControlName="serviciosPetfriendly" etiqueta="Servicios pet-friendly del hotel"
                                 [opciones]="catalogos.serviciosPetfriendly" placeholder="Ej. cama para mascota…" />
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

            @case ('seguros') {
              <div formGroupName="seguros" class="vertical-section">
                <h2 class="section-title">Coberturas de la póliza</h2>
                <span class="rs-field-hint" style="display:block;margin-bottom:var(--sp-3)">
                  Marca todo lo que incluye. El cliente verá estas coberturas antes de contratar.
                </span>
                <div class="checks-grid">
                  @for (t of tiposSeguroCatalogo; track t.tipo) {
                    <label class="rs-checkbox">
                      <input type="checkbox" [checked]="tieneCobertura(t.tipo)"
                             (change)="alternarCobertura(t.tipo)">
                      {{ t.label }}
                    </label>
                  }
                </div>

                <h2 class="section-title">Prima y vigencia</h2>
                <div class="row-card__grid row-card__grid--3">
                  <div class="rs-field">
                    <label class="rs-lbl">Prima anual de referencia (€) *</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="primaAnualBase">
                    <span class="rs-field-hint">Orientativa: la validas tú antes de emitir.</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Duración (meses)</label>
                    <input class="rs-inp" type="number" min="1" formControlName="duracionMeses">
                    <span class="rs-field-hint">12 = anual · menos = temporal (viajes, eventos)</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Descuento por pago anual (%)</label>
                    <input class="rs-inp" type="number" min="0" max="100" formControlName="descuentoPagoAnualPct">
                  </div>
                </div>
                <label class="rs-checkbox">
                  <input type="checkbox" formControlName="renovacionAutomatica"> Renovación automática al vencimiento
                </label>

                <h2 class="section-title">Condiciones de admisión</h2>
                <span class="rs-field-hint" style="display:block;margin-bottom:var(--sp-3)">
                  Determinan qué mascotas pueden contratar. Doogking las comprueba antes de dejar
                  contratar, así que no recibirás solicitudes que no puedas aceptar.
                </span>
                <div class="row-card__grid row-card__grid--3">
                  <div class="rs-field">
                    <label class="rs-lbl">Edad mínima (meses)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="edadMinimaMeses">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Edad máxima (años)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="edadMaximaAnios">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Peso máximo (kg)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="pesoMaximoKg">
                  </div>
                </div>
                <div class="rs-field">
                  <span class="rs-lbl">Razas excluidas</span>
                  <rs-tags-input formControlName="razasExcluidas" etiqueta="Razas excluidas de la póliza"
                                 [opciones]="catalogos.razas" placeholder="Ej. Pit Bull Terrier…" />
                </div>
                <div class="row-card__grid row-card__grid--2">
                  <div class="rs-field">
                    <label class="rs-lbl">Recargo por riesgo (%)</label>
                    <input class="rs-inp" type="number" min="0" max="200" formControlName="recargoRiesgoPct">
                    <span class="rs-field-hint">Se aplica en vez de rechazar a perfiles de mayor riesgo.</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Cupo de pólizas (0 = sin límite)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="cupoPolizas">
                  </div>
                </div>
                <div class="checkbox-row">
                  <label class="rs-checkbox">
                    <input type="checkbox" formControlName="excluyePPP"> No cubre razas PPP
                  </label>
                  <label class="rs-checkbox">
                    <input type="checkbox" formControlName="requiereVacunasAlDia"> Exige vacunación al día
                  </label>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">Condiciones generales (URL del PDF)</label>
                  <input class="rs-inp" formControlName="documentoCondicionesUrl" placeholder="https://…">
                </div>
              </div>
            }

            @case ('cuidadores') {
              <div formGroupName="cuidadores" class="vertical-section">
                <h2 class="section-title">Qué servicios ofreces</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
                  Marca al menos una modalidad. Comparten el mismo cupo diario.
                </p>
                <div class="checks-grid">
                  @for (m of modalidadesCuidado; track m.valor) {
                    <label class="filter-check">
                      <input type="checkbox" [checked]="tieneModalidad(m.valor)" (change)="toggleModalidad(m.valor)" />
                      {{ m.label }}
                    </label>
                  }
                </div>

                <h2 class="section-title">Precios</h2>
                <div class="row-card__grid row-card__grid--2">
                  <div class="rs-field">
                    <label class="rs-lbl">Precio por paseo (€)</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioPaseo">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Duración del paseo (min)</label>
                    <input class="rs-inp" type="number" min="1" formControlName="duracionPaseoMin">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Precio por visita (€)</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioVisita">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Duración de la visita (min)</label>
                    <input class="rs-inp" type="number" min="1" formControlName="duracionVisitaMin">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Precio día completo (€)</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioDiaCompleto">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Precio noche (€)</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioNoche">
                  </div>
                </div>
                <span class="rs-field-hint" style="display:block;margin-bottom:var(--sp-4)">
                  Deja en 0 el precio de cualquier modalidad que no ofrezcas.
                </span>

                <h2 class="section-title">Condiciones</h2>
                <div class="row-card__grid row-card__grid--2">
                  <div class="rs-field">
                    <label class="rs-lbl">Radio de desplazamiento (km)</label>
                    <input class="rs-inp" type="number" min="0" formControlName="radioDesplazamientoKm">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Cupos disponibles al día</label>
                    <input class="rs-inp" type="number" min="0" formControlName="cuposDisponibles">
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Horario (opcional)</label>
                  <input class="rs-inp" formControlName="horario" placeholder="Ej. L-V 9:00-19:00">
                </div>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="aceptaPPP"> Acepto razas PPP</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="administraMedicacion"> Administro medicación</label>
                </div>

                <h2 class="section-title">Tamaños de perro admitidos</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
                  Déjalo todo sin marcar si admites cualquier tamaño.
                </p>
                <div class="checks-grid">
                  @for (t of tamanosCuidado; track t.valor) {
                    <label class="filter-check">
                      <input type="checkbox" [checked]="tieneTamanoCuidado(t.valor)" (change)="toggleTamanoCuidado(t.valor)" />
                      {{ t.label }}
                    </label>
                  }
                </div>

                <div class="rs-field">
                  <span class="rs-lbl">Tareas incluidas</span>
                  <rs-tags-input formControlName="tareasIncluidas" etiqueta="Tareas incluidas"
                                 placeholder="Ej. Comida, agua, juego…" />
                </div>
              </div>
            }
          }
          }

          @if (paso() === 'fotos') {
            <div class="rs-field">
              <label class="rs-lbl">Imágenes del servicio</label>
              <rs-image-upload [multiple]="true" [maxFiles]="8" formControlName="imagenes"></rs-image-upload>
              <span class="rs-field-hint">Sube hasta 8 imágenes · JPEG, PNG, WebP · Max 5 MB cada una.</span>
            </div>

            <!-- Repaso antes de crear: lo que se va a publicar, en una línea. -->
            <div class="repaso">
              <p class="repaso__titulo">Esto es lo que vas a publicar</p>
              <dl class="repaso__lista">
                <div><dt>Categoría</dt><dd>{{ etiquetaVertical() || '—' }}</dd></div>
                <div><dt>Nombre</dt><dd>{{ form.controls.titulo.value || '—' }}</dd></div>
                <div><dt>Ciudad</dt><dd>{{ form.controls.ciudad.value || '—' }}</dd></div>
                <div><dt>Precio desde</dt><dd>{{ form.controls.precioBase.value || 0 | euros }}</dd></div>
                <div><dt>Fotos</dt><dd>{{ form.controls.imagenes.value.length }}</dd></div>
              </dl>
            </div>

            @if (!esEdicion()) {
              <div class="rs-alert rs-alert--info">
                El servicio se creará en estado <strong>Borrador</strong>. Revísalo y publícalo desde «Mis servicios» cuando esté listo.
              </div>
            }
          }

          @if (errorMsg()) {
            <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
          }
          @if (exitoMsg()) {
            <div class="rs-alert rs-alert--success">{{ exitoMsg() }}</div>
          }

          <div class="form-actions">
            @if (esPrimerPaso()) {
              <a routerLink="/comercio/listados" class="rs-btn rs-btn--ghost">Cancelar</a>
            } @else {
              <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()">
                <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
                Atrás
              </button>
            }

            @if (esUltimoPaso()) {
              <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
                @if (guardando()) { Guardando… } @else {
                  <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
                  {{ esEdicion() ? 'Guardar cambios' : 'Crear servicio' }}
                }
              </button>
            } @else {
              <button type="button" class="rs-btn rs-btn--primary" (click)="siguientePaso()">
                Continuar
                <rs-icon name="arrow-right" [size]="15" [stroke]="2"></rs-icon>
              </button>
            }
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

    .politicas { display: flex; flex-direction: column; gap: var(--sp-2); }
    .politica {
      display: flex; align-items: flex-start; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4); cursor: pointer;
      background: var(--c-raised); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      transition: border-color var(--d-2), background var(--d-2);
      &:hover { border-color: var(--c-accent); }
      input { margin-top: 2px; flex-shrink: 0; }
    }
    .politica--sel { border-color: var(--c-accent); background: var(--c-accent-lo); }
    .politica__nombre { display: block; font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .politica__desc { display: block; font-size: var(--f-xs); color: var(--t-400); margin-top: 2px; }

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
    .rs-checkbox input { accent-color: var(--c-accent); width: 18px; height: 18px; }

    /* ══ INDICADOR DE PASOS ═══════════════════════════════════════════ */
    .pasos { display: flex; flex-direction: column; gap: var(--sp-3); }

    .pasos__actual { font-size: var(--f-sm); color: var(--t-300); }
    .pasos__actual strong { color: var(--c-accent); font-weight: var(--w-7); }
    .pasos__sep { margin-inline: var(--sp-2); opacity: .5; }
    /* En escritorio cada punto lleva su etiqueta: esta línea sobraría. */
    @media (min-width: 720px) { .pasos__actual { display: none; } }

    .pasos__lista { display: flex; align-items: flex-start; list-style: none; }

    .paso { flex: 1; min-width: 0; position: relative; }

    /* Línea que une los puntos; nace del anterior para no salirse por la izquierda. */
    .paso + .paso::before {
      content: '';
      position: absolute; top: 13px; right: 50%; left: -50%;
      height: 2px; background: var(--b-1);
    }
    .paso--hecho::before,
    .paso--actual::before { background: var(--c-accent); }

    .paso__btn {
      position: relative;
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
      width: 100%; padding: 0; background: transparent; border: none;
      color: var(--t-400); font-size: var(--f-xs); cursor: pointer;

      &:disabled { cursor: default; opacity: .55; }
    }

    .paso__num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: var(--r-full);
      background: var(--c-card); border: 2px solid var(--b-2);
      color: var(--t-400); font-size: var(--f-xs); font-weight: var(--w-7);
      transition: background var(--d-2), border-color var(--d-2), color var(--d-2);
    }
    .paso--hecho .paso__num { background: var(--c-accent); border-color: var(--c-accent); color: #fff; }
    .paso--actual .paso__num {
      border-color: var(--c-accent); color: var(--c-accent);
      box-shadow: 0 0 0 4px var(--c-accent-lo);
    }
    .paso--actual .paso__label { color: var(--c-accent); font-weight: var(--w-6); }

    /* Móvil: cinco etiquetas no caben sin partirse; el nombre del paso ya está
       en la línea de arriba. */
    .paso__label { display: none; text-align: center; line-height: 1.3; }
    @media (min-width: 720px) { .paso__label { display: block; } }

    /* ══ CABECERA DEL PASO ════════════════════════════════════════════ */
    .paso-head { display: flex; flex-direction: column; gap: var(--sp-2); }
    .paso-head__titulo { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
    .paso-head__ayuda { font-size: var(--f-sm); color: var(--t-400); max-width: 60ch; }

    /* ══ REPASO PREVIO A PUBLICAR ═════════════════════════════════════ */
    .repaso {
      padding: var(--sp-4); background: var(--c-raised);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
    }
    .repaso__titulo { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-3); }
    .repaso__lista { display: flex; flex-direction: column; gap: var(--sp-2); }
    .repaso__lista > div {
      display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-4);
      font-size: var(--f-sm);
    }
    .repaso__lista dt { color: var(--t-400); flex-shrink: 0; }
    .repaso__lista dd { color: var(--t-100); font-weight: var(--w-6); text-align: right; min-width: 0; }

    .form-actions {
      display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3);
      padding-top: var(--sp-4); border-top: 1px solid var(--b-1);
    }

    /*
     * Móvil: el pie del paso se queda pegado al fondo mientras se rellena, así
     * "Continuar" está siempre a un pulgar de distancia.
     *
     * .rs-card recorta con overflow:hidden, y un ancestro que recorta anula el
     * sticky de sus descendientes: por eso la tarjeta deja de recortar aquí.
     */
    @media (max-width: 719px) {
      .form-card { overflow: visible; padding: var(--sp-5); }

      .form-actions {
        position: sticky;
        bottom: 0;
        z-index: 2;
        margin: var(--sp-2) calc(var(--sp-5) * -1) calc(var(--sp-5) * -1);
        padding: var(--sp-3) var(--sp-5) calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
        background: var(--c-card);
        border-top: 1px solid var(--b-1);
        border-radius: 0 0 var(--r-xl) var(--r-xl);
      }
      /* El avance manda: ocupa el ancho que sobra. */
      .form-actions > .rs-btn--primary { flex: 1; }
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

  // ── Recorrido paso a paso ────────────────────────────────────────────────
  readonly pasos = PASOS;
  readonly paso = signal<PasoListado>('categoria');

  /**
   * Hasta dónde ha llegado el alta. No se salta hacia delante sin haber
   * cerrado los pasos anteriores; al editar ya está todo puesto, así que se
   * puede ir directamente al dato que se viene a cambiar.
   */
  private readonly pasoMaximo = signal(0);

  readonly indicePaso = computed(() => PASOS.findIndex((p) => p.clave === this.paso()));
  readonly pasoUi = computed(() => PASOS[this.indicePaso()] ?? PASOS[0]);
  readonly esPrimerPaso = computed(() => this.indicePaso() === 0);
  readonly esUltimoPaso = computed(() => this.indicePaso() === PASOS.length - 1);

  /** Nombre legible de la categoría elegida, para el repaso y el titular. */
  etiquetaVertical(): string {
    const vertical = this.form.controls.vertical.value;
    return VERTICALES.find((v) => v.valor === vertical)?.label ?? '';
  }

  /** El paso de detalles dice de qué categoría son, que es la duda real. */
  tituloPaso(): string {
    const etiqueta = this.etiquetaVertical();
    if (this.paso() === 'detalles' && etiqueta) return `Detalles de ${etiqueta.toLowerCase()}`;
    return this.pasoUi().titulo;
  }

  puedeIrAlPaso(indice: number): boolean {
    return this.esEdicion() || indice <= this.pasoMaximo();
  }

  irAlPaso(clave: PasoListado): void {
    const indice = PASOS.findIndex((p) => p.clave === clave);
    if (indice < 0 || !this.puedeIrAlPaso(indice)) return;
    this.paso.set(clave);
    // Cada paso es una pantalla nueva: sin esto se cambia de paso y el
    // formulario aparece a media altura, con los primeros campos arriba.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  pasoAnterior(): void {
    const anterior = PASOS[this.indicePaso() - 1];
    if (anterior) this.irAlPaso(anterior.clave);
  }

  /**
   * Avanza sólo si lo obligatorio de este paso está puesto. Validar aquí y no
   * al final evita el clásico "crear" que falla por un campo tres pantallas
   * más arriba y que nadie encuentra.
   */
  siguientePaso(): void {
    if (!this.validarPaso()) return;

    const siguiente = PASOS[this.indicePaso() + 1];
    if (!siguiente) return;

    this.errorMsg.set('');
    this.pasoMaximo.update((max) => Math.max(max, this.indicePaso() + 1));
    this.irAlPaso(siguiente.clave);
  }

  /** ¿Está cerrado el paso visible? Marca lo que falte para que se vea rojo. */
  private validarPaso(): boolean {
    const invalidos = CAMPOS_DEL_PASO[this.paso()]
      .map((campo) => this.form.get(campo))
      .filter((control) => control?.invalid);

    for (const control of invalidos) control?.markAsTouched();
    if (invalidos.length) return false;

    if (this.paso() !== 'detalles') return true;

    // Los detalles del vertical tienen su propio grupo y su regla de negocio.
    const vertical = this.form.controls.vertical.value;
    const grupo = vertical ? this.form.get(vertical) : null;
    if (grupo?.invalid) { grupo.markAllAsTouched(); return false; }

    const errorVertical = this.validarVertical(vertical);
    if (errorVertical) { this.errorMsg.set(errorVertical); return false; }

    return true;
  }

  // Aptitud (compatibilidad servicio↔perro) — comunes a cualquier vertical.
  readonly tamanosPerro: ReadonlyArray<{ valor: string; label: string }> = [
    { valor: 'mini', label: 'Mini (0-5 kg)' },
    { valor: 'pequeno', label: 'Pequeño (5-10 kg)' },
    { valor: 'mediano', label: 'Mediano (10-25 kg)' },
    { valor: 'grande', label: 'Grande (25-40 kg)' },
    { valor: 'gigante', label: 'Gigante (+40 kg)' },
  ];
  /**
   * Los tamaños que el comercio declara aceptar. Lista más corta que
   * `tamanosPerro` a propósito: los tramos de precio de peluquería siguen
   * distinguiendo mini y gigante, pero para decir "a qué perros atiendo" tres
   * opciones se marcan de un vistazo y cinco se dejan a medias.
   */
  readonly politicasCancelacion = POLITICAS_CANCELACION;

  /** Sólo para resaltar la tarjeta elegida; el valor vive en el formulario. */
  politicaElegida(): string {
    return this.alojamientoGroup.controls['politicaCancelacion'].value as string;
  }

  readonly tamanosAdmitidos: ReadonlyArray<{ valor: string; label: string }> = [
    { valor: 'pequeno', label: 'Pequeño' },
    { valor: 'mediano', label: 'Mediano' },
    { valor: 'grande', label: 'Grande' },
  ];

  readonly tiposPelo = ['corto', 'medio', 'largo', 'rizado', 'duro', 'doble_capa'];
  private readonly tamanosSeleccionados = signal<string[]>([]);
  /**
   * Tipo de pelo admitido por el servicio. Ya no se edita desde el formulario
   * —la peluquería lo declara por servicio de grooming, que es donde importa—,
   * pero se conserva y se reenvía para no borrar lo que un comercio dejara
   * puesto antes de quitar el campo.
   */
  private readonly pelosSeleccionados = signal<string[]>([]);
  temperamentosNoAdmitidos: string[] = [];

  /** Sugerencias de los campos de etiquetas, agrupadas para la plantilla. */
  readonly catalogos = {
    amenitiesAlojamiento: AMENITIES_ALOJAMIENTO,
    amenitiesEspacio: AMENITIES_ESPACIO,
    provincias: PROVINCIAS_ES,
    ciudades: CIUDADES_ES,
    especialidades: ESPECIALIDADES_VETERINARIAS,
    especies: ESPECIES_ATENDIDAS,
    razas: RAZAS_FRECUENTES,
    temperamentos: TEMPERAMENTOS,
    tiposAdiestramiento: TIPOS_ADIESTRAMIENTO,
    serviciosPetfriendly: SERVICIOS_PETFRIENDLY,
  };

  tieneTamano(v: string): boolean { return this.tamanosSeleccionados().includes(v); }
  toggleTamano(v: string): void {
    this.tamanosSeleccionados.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }


  placeholderTitulo(): string {
    const vertical = this.form.controls.vertical.value;
    return PLACEHOLDER_TITULO[vertical] ?? 'Ej. Residencia Canina Villa Perruna';
  }

  /** Coordenadas de la población elegida; null mientras no se resuelvan. */
  private readonly coordenadas = signal<{ lat: number; lng: number } | null>(null);

  readonly form = this.fb.group({
    vertical:    ['', Validators.required],
    titulo:      ['', [Validators.required, Validators.minLength(3)]],
    descripcion: ['', [Validators.required, Validators.minLength(10)]],
    ciudad:      ['', Validators.required],
    precioBase:  [0, [Validators.required, Validators.min(1)]],
    imagenes:    [[] as string[]],

    alojamiento: this.fb.group({
      espacios: this.fb.array<FormGroup>([]),
      amenities: [[] as string[]],
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
      zonaCobertura: [[] as string[]],
      tarifaBase: [0, [Validators.required, Validators.min(0)]],
      tarifaKm: [0, [Validators.required, Validators.min(0)]],
      tarifaEsperaPorHora: [0, [Validators.min(0)]],
      jaulasIncluidas: [true],
      acompananteHumano: [false],
      soloPerros: [true],
      radioCoberturaKm: [0],
      distanciaMinimaKm: [0],
      antelacionMinimaHoras: [0],
      maxPerrosPorTrayecto: [null as number | null],
      aceptaPPP: [false],
      requiereTransportinPropio: [false],
      serviciosAdicionales: this.fb.array<FormGroup>([]),
    }),

    veterinaria: this.fb.group({
      especialidades: [[] as string[]],
      serviciosClinicos: this.fb.array<FormGroup>([]),
      duracionCitaMin: [30],
      citasPorDia: [16],
      atiendeUrgencias: [false],
      horario: [''],
      precioConsulta: [0, [Validators.required, Validators.min(0)]],
      especiesAtendidas: [['Perro'] as string[]],
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
      razasEspecificas: [[] as string[]],
      requiereVacunasAlDia: [true],
      requiereMicrochip: [true],
    }),

    adiestramiento: this.fb.group({
      tiposAdiestramiento: [[] as string[]],
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
      razasEspecificasRestringidas: [[] as string[]],
      especiesPermitidas: [[] as string[]],
      suplementoPorTamanoMascota: this.fb.array<FormGroup>([]),
      suplementoSegundaMascotaPorNoche: [0],
      serviciosPetfriendly: [[] as string[]],
      puedeQuedarseSoloEnHabitacion: [true],
      accesoZonasComunes: [true],
      debeIrConCorrea: [true],
      debeLlevarBozalSiCorresponde: [true],
      checkIn: [''],
      checkOut: [''],
      fianza: [0],
      unidadesDisponibles: [1, [Validators.required, Validators.min(0)]],
    }),

    seguros: this.fb.group({
      primaAnualBase: [0, [Validators.required, Validators.min(0)]],
      duracionMeses: [12, [Validators.required, Validators.min(1)]],
      descuentoPagoAnualPct: [0],
      renovacionAutomatica: [true],
      cupoPolizas: [0],
      documentoCondicionesUrl: [''],
      // Condiciones de admisión, planas en el formulario y anidadas al guardar.
      edadMinimaMeses: [0],
      edadMaximaAnios: [0],
      pesoMaximoKg: [0],
      razasExcluidas: [[] as string[]],
      excluyePPP: [false],
      requiereVacunasAlDia: [false],
      recargoRiesgoPct: [0],
    }),

    cuidadores: this.fb.group({
      tareasIncluidas: [[] as string[]],
      precioPaseo: [0, [Validators.min(0)]],
      precioVisita: [0, [Validators.min(0)]],
      precioDiaCompleto: [0, [Validators.min(0)]],
      precioNoche: [0, [Validators.min(0)]],
      duracionPaseoMin: [30, [Validators.min(1)]],
      duracionVisitaMin: [45, [Validators.min(1)]],
      aceptaPPP: [false],
      administraMedicacion: [false],
      radioDesplazamientoKm: [10, [Validators.min(0)]],
      cuposDisponibles: [1, [Validators.required, Validators.min(0)]],
      horario: [''],
    }),
  });

  get alojamientoGroup(): FormGroup { return this.form.controls.alojamiento; }
  get transporteGroup(): FormGroup { return this.form.controls.transporte; }
  get veterinariaGroup(): FormGroup { return this.form.controls.veterinaria; }
  get peluqueriaGroup(): FormGroup { return this.form.controls.peluqueria; }
  get adiestramientoGroup(): FormGroup { return this.form.controls.adiestramiento; }
  get hotelesGroup(): FormGroup { return this.form.controls.hoteles; }
  get segurosGroup(): FormGroup { return this.form.controls.seguros; }
  get cuidadoresGroup(): FormGroup { return this.form.controls.cuidadores; }
  get serviciosAdiestramiento(): FormArray { return this.adiestramientoGroup.get('serviciosAdiestramiento') as FormArray; }

  get espacios(): FormArray { return this.alojamientoGroup.get('espacios') as FormArray; }
  get serviciosAdicionalesAlojamiento(): FormArray { return this.alojamientoGroup.get('serviciosAdicionales') as FormArray; }
  get serviciosClinicos(): FormArray { return this.veterinariaGroup.get('serviciosClinicos') as FormArray; }
  get serviciosGrooming(): FormArray { return this.peluqueriaGroup.get('serviciosGrooming') as FormArray; }
  get serviciosAdicionalesPeluqueria(): FormArray { return this.peluqueriaGroup.get('serviciosAdicionales') as FormArray; }
  get serviciosAdicionalesTransporte(): FormArray { return this.transporteGroup.get('serviciosAdicionales') as FormArray; }
  get suplementoPorTamanoMascota(): FormArray { return this.hotelesGroup.get('suplementoPorTamanoMascota') as FormArray; }

  private nuevoEspacio(e?: Record<string, unknown>) {
    return this.fb.group({
      tipo: [(e?.['tipo'] as string) ?? 'estandar'],
      tamanoMaxPerro: [(e?.['tamanoMaxPerro'] as string) ?? ''],
      descripcion: [(e?.['descripcion'] as string) ?? ''],
      precioNoche: [(e?.['precioNoche'] as number) ?? 0],
      cantidad: [(e?.['cantidad'] as number) ?? 1],
      amenities: [(e?.['amenities'] as string[] | undefined) ?? []],
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

  agregarServicioAdicionalTransporte(): void {
    // Mismo par nombre/precio que alojamiento y peluquería: `ServicioAdicionalTransporte`.
    this.serviciosAdicionalesTransporte.push(this.nuevoServicioAdicionalAlojamiento());
  }
  quitarServicioAdicionalTransporte(i: number): void { this.serviciosAdicionalesTransporte.removeAt(i); }

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

  // Conductas de riesgo no admitidas (residencia, Ref. RES5) — mismo patrón que compatibilidad social.
  readonly conductasRiesgo: ReadonlyArray<{ valor: string; label: string }> = [
    { valor: 'agresividad', label: 'Agresividad' },
    { valor: 'ansiedad_extrema', label: 'Ansiedad extrema' },
    { valor: 'tendencia_escapar', label: 'Tendencia a escapar' },
    { valor: 'destructivo', label: 'Destructivo' },
  ];
  private readonly conductasNoAdmitidasSeleccionadas = signal<string[]>([]);
  tieneConductaNoAdmitida(v: string): boolean { return this.conductasNoAdmitidasSeleccionadas().includes(v); }
  toggleConductaNoAdmitida(v: string): void {
    this.conductasNoAdmitidasSeleccionadas.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  // Modalidades y tamaños admitidos (paseadores/cuidado a domicilio, Ref. COMI3).
  readonly modalidadesCuidado: ReadonlyArray<{ valor: string; label: string }> = [
    { valor: 'paseo', label: 'Paseo' },
    { valor: 'visita', label: 'Visita suelta' },
    { valor: 'dia_completo', label: 'Día completo' },
    { valor: 'noche', label: 'Noche' },
  ];
  readonly tamanosCuidado: ReadonlyArray<{ valor: string; label: string }> = [
    { valor: 'mini', label: 'Mini' },
    { valor: 'pequeno', label: 'Pequeño' },
    { valor: 'mediano', label: 'Mediano' },
    { valor: 'grande', label: 'Grande' },
    { valor: 'gigante', label: 'Gigante' },
  ];
  private readonly modalidadesSeleccionadas = signal<string[]>([]);
  private readonly tamanosCuidadoSeleccionados = signal<string[]>([]);
  tieneModalidad(v: string): boolean { return this.modalidadesSeleccionadas().includes(v); }
  toggleModalidad(v: string): void {
    this.modalidadesSeleccionadas.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }
  tieneTamanoCuidado(v: string): boolean { return this.tamanosCuidadoSeleccionados().includes(v); }
  toggleTamanoCuidado(v: string): void {
    this.tamanosCuidadoSeleccionados.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }
  private readonly compatibilidadesSeleccionadas = signal<string[]>([]);
  tieneCompatibilidad(v: string): boolean { return this.compatibilidadesSeleccionadas().includes(v); }
  toggleCompatibilidad(v: string): void {
    this.compatibilidadesSeleccionadas.update((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  private nuevoServicioClinico(e?: Record<string, unknown>) {
    const tipo = (e?.['tipo'] as ServicioClinicoTipo | undefined)
      // Listados antiguos guardaban el nombre a mano: se intenta reconocer para
      // que el comercio no pierda lo que ya tenía publicado.
      ?? tipoDesdeNombre(e?.['nombre'] as string | undefined);

    return this.fb.group({
      tipo: [tipo ?? '', Validators.required],
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
      duracionMin: [(e?.['duracionMin'] as number) ?? 30],
      esPrecioCerrado: [(e?.['esPrecioCerrado'] as boolean) ?? false],
    });
  }

  readonly serviciosClinicosCatalogo = SERVICIOS_CLINICOS_CATALOGO;

  readonly tiposSeguroCatalogo = Object.values(TipoSeguro)
    .map((tipo) => ({ tipo, label: TIPO_SEGURO_LABELS[tipo] }));

  /** Coberturas marcadas; van fuera del FormGroup por ser una lista de enum. */
  private readonly coberturas = signal<TipoSeguro[]>([]);

  tieneCobertura(tipo: TipoSeguro): boolean {
    return this.coberturas().includes(tipo);
  }

  alternarCobertura(tipo: TipoSeguro): void {
    this.coberturas.update((lista) =>
      lista.includes(tipo) ? lista.filter((t) => t !== tipo) : [...lista, tipo],
    );
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

  /**
   * Coordenadas de la población elegida, para que el listado aparezca en la
   * búsqueda por mapa. El catálogo local sugiere poblaciones sin coordenadas
   * (`NaN`): ahí se deja el listado sin geolocalizar en lugar de guardar un
   * punto falso, y se avisa al comercio con la pista bajo el campo.
   */
  guardarCoordenadas(lugar: LugarElegido): void {
    const valido = Number.isFinite(lugar.lat) && Number.isFinite(lugar.lng);
    this.coordenadas.set(valido ? { lat: lugar.lat, lng: lugar.lng } : null);
  }

  tieneCoordenadas(): boolean {
    return this.coordenadas() !== null;
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
      // Un listado ya geolocalizado no debe pedir que se vuelva a elegir la
      // población: la pista solo tiene sentido cuando faltan coordenadas.
      if (s.lat != null && s.lng != null) this.coordenadas.set({ lat: s.lat, lng: s.lng });
      this.form.controls.vertical.disable();
      this.precargarVertical(s.vertical, s.extra);
      if (s.aptitud) {
        this.tamanosSeleccionados.set(s.aptitud.tamanosAdmitidos ?? []);
        this.pelosSeleccionados.set(s.aptitud.tipoPeloAdmitido ?? []);
        this.temperamentosNoAdmitidos = s.aptitud.temperamentosNoAdmitidos ?? [];
      }
    } catch {
      this.errorMsg.set('No se pudo cargar el servicio.');
    } finally {
      this.cargando.set(false);
    }
  }

  private precargarVertical(vertical: string, d?: Record<string, unknown>): void {
    if (!d) return;

    if (vertical === VerticalKey.ALOJAMIENTO) {
      this.alojamientoGroup.patchValue({
        amenities: (d['amenities'] as string[] | undefined) ?? [],
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
      this.conductasNoAdmitidasSeleccionadas.set((d['conductasNoAdmitidas'] as string[] | undefined) ?? []);
      const adicionales = (d['serviciosAdicionales'] as Record<string, unknown>[] | undefined) ?? [];
      adicionales.forEach(e => this.serviciosAdicionalesAlojamiento.push(this.nuevoServicioAdicionalAlojamiento(e)));
    } else if (vertical === VerticalKey.TRANSPORTE) {
      this.transporteGroup.patchValue({
        ...d,
        zonaCobertura: (d['zonaCobertura'] as string[] | undefined) ?? [],
      });
      const adicionales = (d['serviciosAdicionales'] as Record<string, unknown>[] | undefined) ?? [];
      adicionales.forEach(e => this.serviciosAdicionalesTransporte.push(this.nuevoServicioAdicionalAlojamiento(e)));
    } else if (vertical === VerticalKey.VETERINARIA) {
      this.veterinariaGroup.patchValue({
        ...d,
        especialidades: (d['especialidades'] as string[] | undefined) ?? [],
        especiesAtendidas: (d['especiesAtendidas'] as string[] | undefined) ?? [],
      });
      const lista = (d['serviciosClinicos'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.serviciosClinicos.push(this.nuevoServicioClinico(e)));
    } else if (vertical === VerticalKey.PELUQUERIA) {
      this.peluqueriaGroup.patchValue({
        ...d,
        razasEspecificas: (d['razasEspecificas'] as string[] | undefined) ?? [],
      });
      const lista = (d['serviciosGrooming'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.serviciosGrooming.push(this.nuevoServicioGrooming(e)));
      const adicionales = (d['serviciosAdicionales'] as Record<string, unknown>[] | undefined) ?? [];
      adicionales.forEach(e => this.serviciosAdicionalesPeluqueria.push(this.nuevoServicioAdicionalPeluqueria(e)));
    } else if (vertical === VerticalKey.ADIESTRAMIENTO) {
      const valoracionInicial = d['valoracionInicial'] as Record<string, unknown> | undefined;
      this.adiestramientoGroup.patchValue({
        ...d,
        tiposAdiestramiento: (d['tiposAdiestramiento'] as string[] | undefined) ?? [],
        valoracionInicialModalidad: valoracionInicial?.['modalidad'] ?? 'presencial',
        valoracionInicialPrecio: valoracionInicial?.['precio'] ?? 0,
      });
      const servicios = (d['serviciosAdiestramiento'] as Record<string, unknown>[] | undefined) ?? [];
      servicios.forEach(e => this.serviciosAdiestramiento.push(this.nuevoServicioAdiestramiento(e)));
    } else if (vertical === VerticalKey.HOTELES) {
      this.hotelesGroup.patchValue({
        ...d,
        especiesPermitidas: (d['especiesPermitidas'] as string[] | undefined) ?? [],
        serviciosPetfriendly: (d['serviciosPetfriendly'] as string[] | undefined) ?? [],
        razasEspecificasRestringidas: (d['razasEspecificasRestringidas'] as string[] | undefined) ?? [],
      });
      const lista = (d['suplementoPorTamanoMascota'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(t => this.suplementoPorTamanoMascota.push(this.nuevoSuplementoPorTamanoMascota(t)));
    } else if (vertical === VerticalKey.SEGUROS) {
      const admision = (d['condicionesAdmision'] as Record<string, unknown> | undefined) ?? {};
      this.segurosGroup.patchValue({
        ...d,
        // El modelo guarda fracciones; el formulario muestra porcentajes.
        descuentoPagoAnualPct: Math.round(((d['descuentoPagoAnualPct'] as number) ?? 0) * 100),
        edadMinimaMeses: admision['edadMinimaMeses'] ?? 0,
        edadMaximaAnios: admision['edadMaximaAnios'] ?? 0,
        pesoMaximoKg: admision['pesoMaximoKg'] ?? 0,
        razasExcluidas: (admision['razasExcluidas'] as string[] | undefined) ?? [],
        excluyePPP: admision['excluyePPP'] ?? false,
        requiereVacunasAlDia: admision['requiereVacunasAlDia'] ?? false,
        recargoRiesgoPct: Math.round(((admision['recargoRiesgoPct'] as number) ?? 0) * 100),
      });
      this.coberturas.set((d['tiposSeguro'] as TipoSeguro[] | undefined) ?? []);
    } else if (vertical === VerticalKey.CUIDADORES) {
      this.cuidadoresGroup.patchValue({
        ...d,
        tareasIncluidas: (d['tareasIncluidas'] as string[] | undefined) ?? [],
      });
      this.modalidadesSeleccionadas.set((d['modalidades'] as string[] | undefined) ?? ['visita']);
      this.tamanosCuidadoSeleccionados.set((d['tamanosAdmitidos'] as string[] | undefined) ?? []);
    }
  }

  private construirDetalleVertical(vertical: string): Record<string, unknown> | null {
    if (vertical === VerticalKey.ALOJAMIENTO) {
      const g = this.alojamientoGroup.getRawValue();
      return {
        espacios: this.espacios.controls.map(c => {
          const v = c.getRawValue();
          return { ...v, tamanoMaxPerro: v.tamanoMaxPerro || undefined };
        }),
        amenities: g.amenities,
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
        conductasNoAdmitidas: this.conductasNoAdmitidasSeleccionadas(),
        serviciosAdicionales: this.serviciosAdicionalesAlojamiento.controls.map(c => c.getRawValue()),
      };
    }
    if (vertical === VerticalKey.TRANSPORTE) {
      return this.transporteGroup.getRawValue();
    }
    if (vertical === VerticalKey.VETERINARIA) {
      const g = this.veterinariaGroup.getRawValue();
      return {
        ...g,
        // `nombre` se rellena desde el catálogo: el comercio ya no lo escribe,
        // pero el resto de la aplicación sigue mostrándolo.
        serviciosClinicos: this.serviciosClinicos.controls.map((c) => {
          const v = c.getRawValue() as { tipo: ServicioClinicoTipo; nombre: string };
          return { ...v, nombre: SERVICIO_CLINICO_LABELS[v.tipo] ?? v.nombre };
        }),
      };
    }
    if (vertical === VerticalKey.PELUQUERIA) {
      const g = this.peluqueriaGroup.getRawValue();
      return {
        ...g,
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
        maxMascotasPorReserva: g.maxMascotasPorReserva > 0 ? g.maxMascotasPorReserva : undefined,
        pesoMaximoMascotaKg: g.pesoMaximoMascotaKg > 0 ? g.pesoMaximoMascotaKg : undefined,
        suplementoSegundaMascotaPorNoche: g.suplementoSegundaMascotaPorNoche > 0 ? g.suplementoSegundaMascotaPorNoche : undefined,
        fianza: g.fianza > 0 ? g.fianza : undefined,
        suplementoPorTamanoMascota: this.suplementoPorTamanoMascota.controls.map(c => c.getRawValue()),
      };
    }
    if (vertical === VerticalKey.SEGUROS) {
      const g = this.segurosGroup.getRawValue();
      return {
        tiposSeguro: this.coberturas(),
        primaAnualBase: g.primaAnualBase,
        duracionMeses: g.duracionMeses,
        // El formulario pide porcentajes enteros; el modelo trabaja con fracciones.
        descuentoPagoAnualPct: (g.descuentoPagoAnualPct || 0) / 100,
        renovacionAutomatica: g.renovacionAutomatica,
        cupoPolizas: g.cupoPolizas,
        documentoCondicionesUrl: g.documentoCondicionesUrl || undefined,
        condicionesAdmision: {
          // Un cero significa "sin límite", no "límite cero".
          edadMinimaMeses: g.edadMinimaMeses > 0 ? g.edadMinimaMeses : undefined,
          edadMaximaAnios: g.edadMaximaAnios > 0 ? g.edadMaximaAnios : undefined,
          pesoMaximoKg: g.pesoMaximoKg > 0 ? g.pesoMaximoKg : undefined,
          razasExcluidas: g.razasExcluidas,
          excluyePPP: g.excluyePPP,
          requiereVacunasAlDia: g.requiereVacunasAlDia,
          recargoRiesgoPct: g.recargoRiesgoPct > 0 ? g.recargoRiesgoPct / 100 : undefined,
        },
      };
    }
    if (vertical === VerticalKey.CUIDADORES) {
      const g = this.cuidadoresGroup.getRawValue();
      return {
        ...g,
        modalidades: this.modalidadesSeleccionadas(),
        tamanosAdmitidos: this.tamanosCuidadoSeleccionados(),
        precioPaseo: g.precioPaseo > 0 ? g.precioPaseo : undefined,
        precioVisita: g.precioVisita > 0 ? g.precioVisita : undefined,
        precioDiaCompleto: g.precioDiaCompleto > 0 ? g.precioDiaCompleto : undefined,
        precioNoche: g.precioNoche > 0 ? g.precioNoche : undefined,
        horario: g.horario || undefined,
      };
    }
    return null;
  }

  private validarVertical(vertical: string): string | null {
    if (vertical === VerticalKey.ALOJAMIENTO && this.espacios.length === 0) {
      return 'Añade al menos un tipo de espacio para tu alojamiento.';
    }
    if (vertical === VerticalKey.SEGUROS && this.coberturas().length === 0) {
      return 'Marca al menos una cobertura de la póliza.';
    }
    if (vertical === VerticalKey.VETERINARIA && this.serviciosClinicos.length === 0) {
      return 'Añade al menos un servicio clínico.';
    }
    if (vertical === VerticalKey.PELUQUERIA && this.serviciosGrooming.length === 0) {
      return 'Añade al menos un servicio de grooming.';
    }
    if (vertical === VerticalKey.CUIDADORES && this.modalidadesSeleccionadas().length === 0) {
      return 'Marca al menos una modalidad (paseo, visita, día completo o noche).';
    }
    return null;
  }

  /**
   * Envío del formulario. Enter dentro de un campo lo dispara desde cualquier
   * paso, y a mitad del recorrido eso crearía el servicio sin haber visto los
   * pasos que quedan: ahí Enter avanza, que es lo que el usuario espera.
   */
  enviarFormulario(): Promise<void> | void {
    if (!this.esUltimoPaso()) { this.siguientePaso(); return; }
    return this.submit();
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
      // Sin coordenadas no se envían las claves: así una edición que no toca la
      // ciudad no borra la geolocalización que el listado ya tuviera.
      ...(this.coordenadas() ?? {}),
      ...(detalle ? { extra: detalle } : {}),
      aptitud: {
        tamanosAdmitidos: this.tamanosSeleccionados(),
        tipoPeloAdmitido: this.pelosSeleccionados(),
        temperamentosNoAdmitidos: this.temperamentosNoAdmitidos,
      },
    };

    try {
      const id = this.servicioId();
      if (id) {
        await firstValueFrom(this.comercioApi.actualizarServicio(id, payload));
        this.exitoMsg.set('¡Cambios guardados!');
      } else {
        await firstValueFrom(this.comercioApi.crearServicio(payload));
        this.exitoMsg.set('¡Servicio creado en borrador! Redirigiendo…');
      }
      setTimeout(() => void this.router.navigate(['/comercio/listados']), 1200);
    } catch {
      this.errorMsg.set('Error al guardar el servicio. Verifica los datos e intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
