import { Component, signal, inject, computed, input, output, DestroyRef, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormsModule, NonNullableFormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  VerticalKey, VERTICAL_LABELS, ServicioClinicoTipo, SERVICIO_CLINICO_LABELS,
  SERVICIO_CLINICO_CATALOGO, SERVICIO_CLINICO_SINONIMOS, ModoPrecioClinico,
  type ServicioClinicoCatalogo,
  TipoSeguro, TIPO_SEGURO_LABELS, TAMANOS_PERRO, MIN_FOTOS_SERVICIO,
  TipoServicioFunerario, TIPO_SERVICIO_FUNERARIO_LABELS,
  LugarRecogida, LUGAR_RECOGIDA_LABELS,
  ModoPrecioRecogida, MODO_PRECIO_RECOGIDA_LABELS,
  FranjaHoraria, FRANJA_HORARIA_LABELS } from 'shared';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { RsTagsInputComponent } from '../../shared/components/tags-input/rs-tags-input.component';
import { RsComboInputComponent } from '../../shared/components/combo-input/rs-combo-input.component';
import {
  RsPlaceAutocompleteComponent, type LugarElegido,
} from '../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import {
  MAX_PARADAS_INTERMEDIAS, PuntoMapa, PuntoRuta, ResumenRuta, RsMapaComponent,
} from '../../shared/components/mapa/rs-mapa.component';
import { GeoService, type DireccionLugar } from '../../core/geo/geo.service';
import { AuthService } from '../../core/auth/auth.service';
import { RsHorarioComponent, semanaVacia } from '../../shared/components/horario/rs-horario.component';
import {
  AMENITIES_ALOJAMIENTO, AMENITIES_ESPACIO, OTROS_SERVICIOS, ESPECIES_ATENDIDAS,
  CURSOS_ADIESTRAMIENTO,
  INCLUYE_FUNERARIO,
  RAZAS_FRECUENTES, SERVICIOS_PETFRIENDLY, TEMPERAMENTOS,
} from '../../shared/catalogos/tags.catalogo';
import { CIUDADES_ES, PROVINCIAS_ES } from '../../shared/catalogos/lugares.catalogo';
import { POLITICAS_CANCELACION } from '../../shared/catalogos/politicas-cancelacion.catalogo';
import {
  ComercioApiService, ServicioPayload, type ExcepcionHorario, type HorarioDia,
} from './comercio-api.service';

import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
/** Una parada del trayecto declarado por un transportista. */
interface ParadaTrayecto {
  nombre: string;
  lat: number;
  lng: number;
  placeId?: string;
}

/** Entrada del catálogo de un servicio, si es uno de los que se ofrecen. */
function catalogoClinicoDe(tipo: ServicioClinicoTipo): ServicioClinicoCatalogo | undefined {
  return SERVICIO_CLINICO_CATALOGO.find((s) => s.tipo === tipo);
}

/** Cómo se le llama a cada forma de cobrar, en la propia pantalla. */
const ETIQUETA_MODO_PRECIO: Record<string, string> = {
  [ModoPrecioClinico.FIJO]: 'Un precio fijo',
  [ModoPrecioClinico.POR_PESO]: 'Según el peso del animal',
  [ModoPrecioClinico.POR_VARIANTE]: 'Un precio por cada tipo',
  [ModoPrecioClinico.PACK]: 'Precio cerrado de pack',
};

/**
 * Reconoce el servicio del catálogo a partir del nombre escrito a mano en
 * listados antiguos, para que al editarlos no se pierda lo ya publicado.
 */
function tipoDesdeNombre(nombre?: string): ServicioClinicoTipo | undefined {
  if (!nombre) return undefined;
  const sinTildes = (t: string): string =>
    t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const buscado = sinTildes(nombre);
  const delCatalogo = SERVICIO_CLINICO_CATALOGO
    .find(({ label }) => sinTildes(label) === buscado)?.tipo;
  return delCatalogo ?? SERVICIO_CLINICO_SINONIMOS[buscado];
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
  [VerticalKey.FUNERARIOS]: 'Ej. Tanatorio de Mascotas Descanso Animal',
};

/** Zoom al enseñar un portal concreto: se distingue el número de la calle. */
const ZOOM_PORTAL = 17;
/** Zoom al enseñar una población: se ve el municipio entero, no una esquina. */
const ZOOM_POBLACION = 13;

/** Pasos del alta de un servicio; el orden es el del recorrido. */
type PasoListado = 'categoria' | 'ubicacion' | 'horarios' | 'detalles' | 'aptitud';

/**
 * Fotos mínimas para poder publicar. La misma cifra que exige el API al
 * publicar; aquí se comprueba antes para no dejar terminar el alta y avisar
 * después, cuando ya no se está mirando el formulario.
 */
const MIN_FOTOS = MIN_FOTOS_SERVICIO;

/**
 * Verticales cuyas fotos van **por unidad reservable** y no sueltas.
 *
 * Una residencia o un hotel no venden «el sitio»: venden una suite concreta o
 * una habitación concreta, y el cliente elige mirando esa foto. Con una galería
 * común no se sabe cuál de las diez fotos es la suite que se está reservando.
 * En el resto de categorías no hay unidad que fotografiar aparte, así que las
 * fotos son del servicio entero.
 */
const FOTOS_POR_UNIDAD: readonly string[] = [VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES];

/**
 * Un servicio pide entre veinte y sesenta datos según la categoría: en una sola
 * página nadie llegaba al final. Se reparte en pantallas cortas, el patrón de
 * "crea tu anuncio" de Airbnb, con lo obligatorio delante.
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
    ayuda: 'La dirección sitúa tu anuncio en el mapa. El precio es el «desde» que verá el cliente.' },
  { clave: 'horarios', label: 'Horarios',
    titulo: '¿Cuándo atiendes?',
    ayuda: 'El horario es de este servicio, no del negocio: si tienes otro con horas distintas, cada uno lleva las suyas.' },
  { clave: 'detalles', label: 'Detalles',
    titulo: 'Detalles del servicio',
    ayuda: 'Lo propio de tu categoría: es lo que hace que el cliente reserve contigo.' },
  { clave: 'aptitud', label: 'Para qué perros',
    titulo: '¿Para qué perros es apto?',
    ayuda: 'Déjalo sin marcar si vale para cualquier perro. Es el último paso: repasa y publica.' },
];

/** Campos obligatorios que cierra cada paso antes de dejar avanzar. */
const CAMPOS_DEL_PASO: Record<PasoListado, ReadonlyArray<string>> = {
  categoria: ['vertical', 'titulo', 'descripcion'],
  ubicacion: ['ciudad', 'precioBase'],
  // El horario es opcional: un transporte a demanda no tiene puerta que abrir.
  horarios: [],
  // Lo específico del vertical se valida contra su propio grupo y su regla
  // de negocio (`validarVertical`), no con una lista de campos fija.
  detalles: [],
  aptitud: [],
};

/** Unidades en las que un centro de adiestramiento declara la duración de un curso. */
type UnidadDuracion = 'minutos' | 'horas' | 'dias' | 'meses';

/** Un mes se cuenta como 30 días de calendario: es una duración comercial, no contable. */
const MINUTOS_POR_UNIDAD: Record<UnidadDuracion, number> = {
  minutos: 1,
  horas: 60,
  dias: 60 * 24,
  meses: 60 * 24 * 30,
};

/** La agenda y la disponibilidad trabajan en minutos, sea cual sea la unidad declarada. */
function enMinutos(valor: number, unidad: UnidadDuracion): number {
  return Math.round((valor || 0) * (MINUTOS_POR_UNIDAD[unidad] ?? 1));
}

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
    TraducirPipe, RouterLink, ReactiveFormsModule, FormsModule,
    RsIconComponent, RsImageUploadComponent, RsTagsInputComponent, RsComboInputComponent,
  RsPlaceAutocompleteComponent,
    RsMapaComponent, RsHorarioComponent, RsComboInputComponent, EurosPipe,
  ],
  template: `
    <div class="page-wrap">
      @if (!modoAlta()) {
        <div class="page-header">
          <a routerLink="/comercio/listados" class="back-link">
            <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
            {{ 'Volver a mis servicios' | t }}
          </a>
          <h1>{{ esEdicion() ? 'Editar servicio' : 'Nuevo servicio' }}</h1>
          <p>{{ esEdicion() ? 'Ve directamente al paso que quieras cambiar.' : 'Pasos cortos. Puedes volver atrás en cualquier momento.' }}</p>
        </div>
      }

      @if (cargando()) {
        <div class="rs-card" style="padding:var(--sp-16);text-align:center;color:var(--t-400)">{{ 'Cargando…' | t }}</div>
      } @else {
      <!--
        Indicador de pasos. En escritorio cada punto lleva su etiqueta; en móvil
        sólo los puntos, y el nombre del paso va en la línea de arriba, que es
        donde se lee sin apretar la pantalla.
      -->
      <div class="pasos">
        <p class="pasos__actual">
          <strong>Paso {{ indicePaso() + 1 }} de {{ pasos.length }}</strong>
          <span class="pasos__sep">·</span>{{ pasoUi().label | t }}
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
                <span class="paso__label">{{ p.label | t }}</span>
              </button>
            </li>
          }
        </ol>
      </div>

      @if (borradorRestaurado()) {
        <div class="rs-alert rs-alert--info borrador">
          <span>
            {{ 'Hemos recuperado lo que tenías a medias en este dispositivo.' | t }}
          </span>
          <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="empezarDeCero()">
            {{ 'Empezar de cero' | t }}
          </button>
        </div>
      }

      <div class="form-card rs-card">
        <form [formGroup]="form" (ngSubmit)="enviarFormulario()">

          <header class="paso-head">
            <h2 class="paso-head__titulo">{{ tituloPaso() }}</h2>
            <p class="paso-head__ayuda">{{ pasoUi().ayuda }}</p>
          </header>

          @if (paso() === 'categoria') {

          @if (!modoAlta()) {
            <div class="rs-field">
              <label class="rs-lbl" for="vertical">{{ 'Categoría *' | t }}</label>
              <select id="vertical" class="rs-inp" formControlName="vertical"
                      [class.rs-inp--error]="hasError('vertical')">
                <option value="">{{ '— Selecciona una categoría —' | t }}</option>
                @for (v of verticales; track v.valor) {
                  <option [value]="v.valor">{{ v.label | t }}</option>
                }
              </select>
              @if (esEdicion()) {
                <span class="rs-field-hint">{{ 'La categoría no se puede cambiar después de crear el servicio.' | t }}</span>
              }
              @if (hasError('vertical')) {
                <span class="rs-field-err">{{ 'Selecciona una categoría.' | t }}</span>
              }
            </div>
          }

          <div class="rs-field">
            <label class="rs-lbl" for="titulo">{{ 'Nombre del servicio *' | t }}</label>
            <input id="titulo" class="rs-inp" formControlName="titulo"
                   [placeholder]="placeholderTitulo()"
                   [class.rs-inp--error]="hasError('titulo')">
            @if (hasError('titulo')) {
              <span class="rs-field-err">{{ 'El nombre es obligatorio.' | t }}</span>
            }
          </div>

          <div class="rs-field">
            <label class="rs-lbl" for="descripcion">{{ 'Descripción *' | t }}</label>
            <textarea id="descripcion" class="rs-inp rs-textarea" formControlName="descripcion"
                      rows="4"
                      [placeholder]="'Describe tu servicio: características, lo que incluye, qué lo hace especial…' | t"
                      [class.rs-inp--error]="hasError('descripcion')"></textarea>
            @if (hasError('descripcion')) {
              <span class="rs-field-err">{{ 'La descripción es obligatoria.' | t }}</span>
            }
          </div>

          }

          @if (paso() === 'ubicacion') {
          <!--
            Formulario y mapa en paralelo, el patrón del extranet de Booking: el
            mapa no es una comprobación posterior escondida al final de la
            página, sino la mitad de la pantalla, y el pin se mueve a la vez que
            se escribe. En móvil se apilan —el mapa flotando sobre el formulario
            no cabe— con el mapa arriba, que es lo que da contexto a lo que se
            va a rellenar debajo.
          -->
          <div class="ubi">
            <div class="ubi__campos">
              <div class="rs-field">
                <label class="rs-lbl" for="calle">{{ 'Busca tu dirección' | t }}</label>
                <rs-place-autocomplete inputId="calle" formControlName="calle" tipo="direccion"
                                       apariencia="campo" [placeholder]="'Calle y número…' | t"
                                       (lugarElegido)="usarDireccionSugerida($event)" />
                <span class="rs-field-hint">
                  {{ 'Elígela de la lista y colocamos el pin en el punto exacto.' | t }}
                </span>
              </div>

              <div class="rs-field">
                <label class="rs-lbl" for="numero">{{ 'Número, piso o puerta' | t }} <span class="opt">{{ 'opcional' | t }}</span></label>
                <input id="numero" class="rs-inp" formControlName="numero" [placeholder]="'Ej: 24, 2ºB' | t">
              </div>

              <div class="form-row-2">
                <div class="rs-field">
                  <label class="rs-lbl" for="ciudad">{{ 'Ciudad *' | t }}</label>
                  <rs-place-autocomplete inputId="ciudad" formControlName="ciudad"
                                         apariencia="campo" [placeholder]="'Busca tu población…' | t"
                                         [catalogoLocal]="catalogos.ciudades"
                                         (lugarElegido)="guardarCoordenadas($event)" />
                  @if (hasError('ciudad')) {
                    <span class="rs-field-err">{{ 'La ciudad es obligatoria.' | t }}</span>
                  }
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="codigoPostal">{{ 'Código postal' | t }}</label>
                  <input id="codigoPostal" class="rs-inp" formControlName="codigoPostal" [placeholder]="'Ej: 28013' | t">
                </div>
              </div>

              <div class="form-row-2">
                <div class="rs-field">
                  <label class="rs-lbl" for="provincia">{{ 'Provincia' | t }}</label>
                  <rs-place-autocomplete inputId="provincia" formControlName="provincia"
                                         apariencia="campo" [placeholder]="'Elige provincia…' | t"
                                         [catalogoLocal]="catalogos.provincias" [usaPlaces]="false"
                                         [sugerenciasIniciales]="52" />
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="pais">{{ 'País' | t }}</label>
                  <input id="pais" class="rs-inp" formControlName="pais" [placeholder]="'España' | t">
                </div>
              </div>

              <label class="ubi__sync" [class.ubi__sync--on]="sincronizarPin()">
                <input type="checkbox" [checked]="sincronizarPin()"
                       (change)="sincronizarPin.set(!sincronizarPin())" />
                <span>{{ 'Actualizar la dirección al mover el pin en el mapa.' | t }}</span>
              </label>

              @if (avisoPin()) {
                <div class="ubi__aviso" role="note">
                  <rs-icon name="alert-circle" [size]="15" [stroke]="2"></rs-icon>
                  <p>
                    {{ '¿Está mal la ubicación del pin? Toca el mapa para llevarlo al sitio exacto. Si no quieres que eso reescriba lo que has escrito, desmarca la casilla de arriba.' | t }}
                  </p>
                  <button type="button" class="ubi__aviso-x" (click)="avisoPin.set(false)"
                          [attr.aria-label]="'Ocultar el aviso' | t">
                    <rs-icon name="x" [size]="14" [stroke]="2.5"></rs-icon>
                  </button>
                </div>
              }

              <div class="rs-field">
                <label class="rs-lbl" for="precioBase">{{ 'Precio orientativo (€) *' | t }}</label>
                <input id="precioBase" class="rs-inp" type="number" formControlName="precioBase"
                       placeholder="0.00" min="0" step="0.01"
                       [class.rs-inp--error]="hasError('precioBase')">
                <span class="rs-field-hint">{{ 'Es el precio «desde» que se muestra en las tarjetas de búsqueda.' | t }}</span>
                @if (hasError('precioBase')) {
                  <span class="rs-field-err">{{ 'Ingresa un precio válido mayor a 0.' | t }}</span>
                }
              </div>
            </div>

            <div class="ubi__mapa">
              <div class="ubi__lienzo">
                @if (punto(); as p) {
                  <rs-mapa [puntos]="[p]" [centro]="centroMapa()"
                           [permitePulsar]="true" [zoomConRueda]="true" [autoencuadre]="false"
                           ariaLabel="Ubicación exacta del servicio; toca el mapa para mover el pin"
                           (mapaPulsado)="moverPin($event)" />
                } @else {
                  <div class="ubi__vacio">
                    <rs-icon name="map-pin" [size]="26" [stroke]="1.75"></rs-icon>
                    <p>{{ 'Busca tu dirección y el mapa te enseñará el punto exacto.' | t }}</p>
                  </div>
                }

                @if (buscandoDireccion()) {
                  <div class="ubi__cargando" role="status">
                    <span class="rs-spin"></span> {{ 'Buscando la dirección…' | t }}
                  </div>
                }
              </div>

              <!-- Sin coordenadas el anuncio no sale en el mapa del buscador, y
                   eso hay que saberlo antes de guardar, no después. -->
              <div class="geo" [class.geo--ok]="tieneCoordenadas()">
                @if (tieneCoordenadas()) {
                  <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon>
                  <span>{{ 'Ubicación exacta guardada: tu servicio saldrá en el mapa del buscador.' | t }}</span>
                } @else {
                  <rs-icon name="alert-circle" [size]="15" [stroke]="2"></rs-icon>
                  <span>{{ 'Sin ubicación exacta todavía: elige tu dirección o tu población de la lista.' | t }}</span>
                }
              </div>
            </div>
          </div>

          }

          <!-- ═══ HORARIOS DEL SERVICIO ═══ -->
          @if (paso() === 'horarios') {
          <rs-horario [(horario)]="horario" [(excepciones)]="excepciones"
                      (horarioChange)="guardarCambioSuelto()" (excepcionesChange)="guardarCambioSuelto()" />
          }

          <!-- ═══ APTITUD (compatibilidad servicio↔perro) ═══ -->
          @if (paso() === 'aptitud') {
          <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
            {{ 'Si marcas algo, Doogking solo mostrará este servicio a clientes cuyo perro encaje.' | t }}
          </p>
          <div class="rs-field">
            <label class="rs-lbl">{{ 'Tamaños admitidos' | t }}</label>
            <div class="checks-grid">
              @for (t of tamanosAdmitidos; track t.valor) {
                <label class="filter-check">
                  <input type="checkbox" [checked]="tieneTamano(t.valor)" (change)="toggleTamano(t.valor)" />
                  {{ t.label | t }}
                </label>
              }
            </div>
          </div>
          <div class="rs-field">
            <span class="rs-lbl">{{ 'Temperamentos que no admites' | t }}</span>
            <rs-tags-input [(ngModel)]="temperamentosNoAdmitidos" [ngModelOptions]="{standalone: true}"
                           [etiqueta]="'Temperamentos que no admites' | t"
                           [opciones]="catalogos.temperamentos" [permiteNuevos]="false"
                           [placeholder]="'Elige de la lista…' | t" />
          </div>

          }

          <!-- ═══ SECCIÓN POR VERTICAL ═══ -->
          @if (paso() === 'detalles') {
          @switch (form.controls.vertical.value) {

            @case ('') {
              <p class="rs-field-hint">
                {{ 'Vuelve al primer paso y elige una categoría para ver aquí sus datos propios.' | t }}
              </p>
            }

            @case ('alojamiento') {
              <div formGroupName="alojamiento" class="vertical-section">
                <h2 class="section-title">{{ 'Espacios y detalles del alojamiento' | t }}</h2>

                <div formArrayName="espacios" class="rows">
                  @for (esp of espacios.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tipo *' | t }}</label>
                          <select class="rs-inp" formControlName="tipo">
                            <option value="estandar">{{ 'Individual / estándar' | t }}</option>
                            <option value="compartido">{{ 'Compartido' | t }}</option>
                            <option value="premium">{{ 'Zona premium' | t }}</option>
                            <option value="climatizada">{{ 'Habitación climatizada' | t }}</option>
                            <option value="suite">{{ 'Suite familiar (varios perros)' | t }}</option>
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tamaño máx. de perro (opcional)' | t }}</label>
                          <select class="rs-inp" formControlName="tamanoMaxPerro">
                            <option value="">{{ 'Sin restricción de tamaño' | t }}</option>
                            @for (tamano of tamanosPerro; track tamano.valor) {
                              <option [value]="tamano.valor">{{ tamano.etiqueta }}</option>
                            }
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio/noche (€) *' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioNoche">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Cantidad disponible *' | t }}</label>
                          <input class="rs-inp" type="number" min="1" formControlName="cantidad">
                        </div>
                      </div>
                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Descripción del espacio' | t }}</label>
                        <input class="rs-inp" formControlName="descripcion" [placeholder]="'Ej. Suite individual con jardín privado' | t">
                      </div>
                      <div class="rs-field">
                        <span class="rs-lbl">{{ 'Servicios de este espacio' | t }}</span>
                        <rs-tags-input formControlName="amenities" [etiqueta]="'Servicios de este espacio' | t"
                                       [opciones]="catalogos.amenitiesEspacio"
                                       [opcionOtros]="OTROS_SERVICIOS"
                                       [placeholder]="'Ej. salida a jardín privado…' | t" />
                        <span class="rs-field-hint">{{ 'Lo que incluye esta suite o habitación en concreto: cama, climatización, salida al jardín…' | t }}</span>
                      </div>
                      <div class="rs-field">
                        <span class="rs-lbl">{{ 'Fotos de este espacio' | t }}</span>
                        <rs-image-upload origen="servicio/imagenes" [multiple]="true" [maxFiles]="8"
                                         formControlName="imagenes"></rs-image-upload>
                        <span class="rs-field-hint">
                          {{ 'El cliente reserva' | t }} <em>{{ 'esta' | t }}</em> {{ 'suite, no «la residencia»: enséñale la que va a coger. JPEG, PNG o WebP · máx. 5 MB cada una.' | t }}
                        </span>
                      </div>
                      <div class="checkbox-row">
                        <label class="rs-checkbox"><input type="checkbox" formControlName="disponible"> {{ 'Disponible' | t }}</label>
                        <label class="rs-checkbox"><input type="checkbox" formControlName="cancelacionGratis"> {{ 'Cancelación gratis' | t }}</label>
                        <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarEspacio(i)">
                          <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                        </button>
                      </div>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarEspacio()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir tipo de espacio' | t }}
                </button>

                <div class="fotos-cuenta" [class.fotos-cuenta--ok]="fotosSuficientes()">
                  <rs-icon [name]="fotosSuficientes() ? 'check-circle' : 'camera'" [size]="15" [stroke]="2" />
                  <span>{{ mensajeFotos() }}</span>
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Ingreso' | t }}</label>
                    <input class="rs-inp" type="time" formControlName="checkIn">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Salida' | t }}</label>
                    <input class="rs-inp" type="time" formControlName="checkOut">
                  </div>
                </div>

                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Servicios del alojamiento' | t }}</span>
                  <rs-tags-input formControlName="amenities" [etiqueta]="'Servicios del alojamiento' | t"
                                 [opciones]="catalogos.amenitiesAlojamiento" [placeholder]="'Ej. jardín vallado…' | t" />
                  <span class="rs-field-hint">{{ 'Lo que ofrece el alojamiento en conjunto, se reserve el espacio que se reserve.' | t }}</span>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Política de cancelación' | t }}</label>
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
                          <span class="politica__nombre">{{ p.label | t }}</span>
                          <span class="politica__desc">{{ p.descripcion }}</span>
                        </span>
                      </label>
                    }
                    <label class="politica" [class.politica--sel]="!politicaElegida()">
                      <input type="radio" formControlName="politicaCancelacion" value="" />
                      <span>
                        <span class="politica__nombre">{{ 'Sin especificar' | t }}</span>
                        <span class="politica__desc">{{ 'Acuerdas las condiciones con cada cliente.' | t }}</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requisitoVacunas"> {{ 'Exige cartilla de vacunas' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="paseosIncluidos"> {{ 'Paseos incluidos' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="camaras24h"> {{ 'Cámaras 24h' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="cancelacionGratis"> {{ 'Cancelación gratuita' | t }}</label>
                </div>

                <h2 class="section-title">{{ 'Requisitos sanitarios adicionales (opcionales)' | t }}</h2>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requisitoMicrochip"> {{ 'Microchip obligatorio' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereDesparasitacionInterna"> {{ 'Desparasitación interna' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereDesparasitacionExterna"> {{ 'Desparasitación externa' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereVacunaTosPerreras"> {{ 'Vacuna tos de las perreras' | t }}</label>
                </div>

                <h2 class="section-title">{{ 'Compatibilidad social que admites' | t }}</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
                  {{ 'Déjalo todo sin marcar si admites cualquier perfil social.' | t }}
                </p>
                <div class="checks-grid">
                  @for (c of compatibilidadesSociales; track c.valor) {
                    <label class="filter-check">
                      <input type="checkbox" [checked]="tieneCompatibilidad(c.valor)" (change)="toggleCompatibilidad(c.valor)" />
                      {{ c.label | t }}
                    </label>
                  }
                </div>

                <h2 class="section-title">{{ 'Conductas de riesgo que no admites (Ref. RES5)' | t }}</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
                  {{ 'Si un perro con esta conducta intenta reservar, se le avisará antes de completar la reserva. Déjalo todo sin marcar si admites cualquier conducta.' | t }}
                </p>
                <div class="checks-grid">
                  @for (c of conductasRiesgo; track c.valor) {
                    <label class="filter-check">
                      <input type="checkbox" [checked]="tieneConductaNoAdmitida(c.valor)" (change)="toggleConductaNoAdmitida(c.valor)" />
                      {{ c.label | t }}
                    </label>
                  }
                </div>

                <h2 class="section-title">{{ 'Servicios adicionales' | t }}</h2>
                <div formArrayName="serviciosAdicionales" class="rows">
                  @for (s of serviciosAdicionalesAlojamiento.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Nombre' | t }}</label>
                          <input class="rs-inp" formControlName="nombre" [placeholder]="'Ej. Paseo individual diario' | t">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio (€)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdicionalAlojamiento(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdicionalAlojamiento()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir servicio adicional' | t }}
                </button>
              </div>
            }

            @case ('transporte') {
              <div formGroupName="transporte" class="vertical-section">
                <h2 class="section-title">{{ 'Detalles del transporte' | t }}</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-3)">
                  {{ 'Los campos marcados con' | t }} <strong>*</strong> {{ 'son obligatorios; el resto son opcionales y solo ayudan a que recibas solicitudes que sí puedas atender.' | t }}
                </p>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Tipo de vehículo' | t }} <span class="rs-field-hint">{{ '(opcional)' | t }}</span></label>
                    <select class="rs-inp" formControlName="tipoVehiculo">
                      <option value="van_acondicionada">{{ 'Van acondicionada' | t }}</option>
                      <option value="coche">{{ 'Coche' | t }}</option>
                      <option value="furgon_climatizado">{{ 'Furgón climatizado' | t }}</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Capacidad (perros)' | t }} <span class="rs-field-hint">{{ '(opcional)' | t }}</span></label>
                    <input class="rs-inp" type="number" min="1" formControlName="capacidadPerros">
                  </div>
                </div>

                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Zona de cobertura' | t }} <span class="rs-field-hint">{{ '(opcional)' | t }}</span></span>
                  <rs-tags-input formControlName="zonaCobertura" [etiqueta]="'Zona de cobertura' | t"
                                 [opciones]="catalogos.provincias" [placeholder]="'Ej. Madrid, Toledo…' | t" />
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Tarifa base (€) *' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaBase">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Tarifa por km (€) *' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaKm">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Tarifa de espera, por hora (€)' | t }} <span class="rs-field-hint">{{ '(opcional)' | t }}</span></label>
                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="tarifaEsperaPorHora">
                  <span class="rs-field-hint">{{ 'Se cobra en trayectos de "ida y vuelta con espera" (Ref. TRA4). Déjalo en 0 si no cobras el tiempo de espera.' | t }}</span>
                </div>

                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="jaulasIncluidas"> {{ 'Jaulas incluidas' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="acompananteHumano"> {{ 'Acompañante humano opcional' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="soloPerros"> {{ 'Sólo perros' | t }}</label>
                </div>

                <h2 class="section-title">{{ 'Condiciones del servicio (todas opcionales)' | t }}</h2>
                <span class="rs-field-hint" style="display:block;margin-bottom:var(--sp-3)">
                  {{ 'Cuanto más concretes, menos solicitudes recibirás que no puedas atender.' | t }}
                </span>
                <div class="row-card__grid row-card__grid--2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Distancia mínima facturable (km)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="distanciaMinimaKm">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Antelación mínima (horas)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="antelacionMinimaHoras">
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Máximo de perros por trayecto' | t }}</label>
                  <input class="rs-inp" type="number" min="1" formControlName="maxPerrosPorTrayecto">
                  <span class="rs-field-hint">{{ 'Déjalo vacío para usar la capacidad del vehículo.' | t }}</span>
                </div>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="aceptaPPP"> {{ 'Acepto perros de razas PPP' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereTransportinPropio"> {{ 'El cliente aporta su transportín' | t }}</label>
                </div>

                <h2 class="section-title">{{ 'Tu trayecto habitual (opcional)' | t }}</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-3)">
                  {{ 'Si haces una ruta fija, marca sus puntos de recogida en orden: trazamos el recorrido por carretera y el cliente lo verá dibujado en tu ficha. Es lo que distingue «hago Madrid–Zaragoza» de «hago traslados».' | t }}
                </p>

                <div class="rs-field">
                  <!-- Busca direcciones y no propone nada de salida: el desplegable
                       sale en blanco hasta que se escribe. Sugerir poblaciones al
                       enfocar invitaba a marcar «Madrid» como punto de recogida, y
                       una ciudad entera no es un sitio donde parar la furgoneta. -->
                  <rs-place-autocomplete apariencia="campo" inputId="tr-parada"
                                         [formControl]="direccionParada"
                                         tipo="direccion" [sugerenciasIniciales]="0"
                                         [placeholder]="'Escribe la dirección de recogida…' | t"
                                         (lugarElegido)="anadirParada($event)" />
                  <span class="rs-field-hint">
                    {{ 'Calle y número. Escríbela y elígela de la lista para que quede situada en el mapa.' | t }}
                  </span>
                  @if (trayectoLleno()) {
                    <span class="rs-field-hint">
                      {{ 'Has llegado al máximo de puntos que se pueden trazar de una vez.' | t }}
                    </span>
                  }
                </div>

                @if (trayecto().length) {
                  <ol class="paradas">
                    @for (parada of trayecto(); track parada.nombre + $index; let i = $index) {
                      <li class="parada">
                        <span class="parada__orden">{{ i + 1 }}</span>
                        <span class="parada__nombre">{{ parada.nombre }}</span>
                        <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                                [disabled]="i === 0" (click)="subirParada(i)" [attr.aria-label]="'Subir' | t">
                          <rs-icon name="chevron-down" [size]="13" [stroke]="2.5" class="parada__subir"></rs-icon>
                        </button>
                        <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                                [disabled]="i === trayecto().length - 1" (click)="bajarParada(i)"
                                [attr.aria-label]="'Bajar' | t">
                          <rs-icon name="chevron-down" [size]="13" [stroke]="2.5"></rs-icon>
                        </button>
                        <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                                (click)="quitarParada(i)" [attr.aria-label]="'Quitar parada' | t">
                          <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon>
                        </button>
                      </li>
                    }
                  </ol>

                  <div class="mapa-trayecto">
                    <rs-mapa [puntos]="pinesTrayecto()" [ruta]="lineaTrayecto()"
                             (rutaTrazada)="rutaTrazada.set($event)"
                             ariaLabel="Trayecto declarado" />
                  </div>

                  @if (rutaTrazada(); as r) {
                    <p class="ruta-resumen">
                      <rs-icon name="navigation" [size]="14" [stroke]="2"></rs-icon>
                      @if (r.porCarretera) {
                        <strong>{{ r.distanciaKm }} km</strong> {{ 'por carretera' | t }}
                        <span>· {{ duracionLegible(r.duracionMin) }}</span>
                      } @else {
                        <strong>{{ r.distanciaKm }} km</strong> {{ 'en línea recta' | t }}
                        <span>{{ '· no hemos podido trazar el recorrido real' | t }}</span>
                      }
                    </p>
                  }
                }

                <h2 class="section-title">{{ 'Servicios adicionales' | t }}</h2>
                <p class="rs-field-hint">
                  {{ 'Se muestran al cliente en el paso 1 de la reserva y se suman al precio del trayecto.' | t }}
                </p>
                <div formArrayName="serviciosAdicionales" class="rows">
                  @for (s of serviciosAdicionalesTransporte.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Nombre' | t }}</label>
                          <input class="rs-inp" formControlName="nombre" [placeholder]="'Ej. Recogida a domicilio' | t">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio (€)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdicionalTransporte(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdicionalTransporte()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir servicio adicional' | t }}
                </button>
              </div>
            }

            @case ('veterinaria') {
              <div formGroupName="veterinaria" class="vertical-section">

                <h2 class="section-title">{{ '1. Servicios veterinarios disponibles' | t }}</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-4)">
                  {{ 'Selecciona los servicios que tus clientes pueden reservar directamente. Podrás indicar el precio y las condiciones de cada uno.' | t }}
                </p>

                <!-- Rejilla de actos concretos, no de especialidades: lo que se
                     elige aquí es lo que el cliente puede pagar por adelantado. -->
                <div class="serv-grid" role="group" [attr.aria-label]="'Servicios veterinarios' | t">
                  @for (s of catalogoClinico(); track s.tipo) {
                    <button type="button" class="serv" [class.serv--on]="tieneServicioClinico(s.tipo)"
                            [attr.aria-pressed]="tieneServicioClinico(s.tipo)"
                            (click)="alternarServicioClinico(s.tipo)">
                      <span class="serv__ico"><rs-icon [name]="s.icono" [size]="20" [stroke]="1.75" /></span>
                      <span class="serv__cuerpo">
                        <span class="serv__label">{{ s.label | t }}</span>
                        <span class="serv__base">{{ s.base }}</span>
                      </span>
                      <span class="serv__check" aria-hidden="true">
                        @if (tieneServicioClinico(s.tipo)) {
                          <rs-icon name="check" [size]="12" [stroke]="3" />
                        }
                      </span>
                    </button>
                  }

                  <button type="button" class="serv serv--nuevo" (click)="agregarServicioLibre()">
                    <rs-icon name="plus" [size]="16" [stroke]="2.5" />
                    <span>{{ 'Añadir otro servicio' | t }}</span>
                  </button>
                </div>

                <div class="rs-alert rs-alert--info" style="margin-top:var(--sp-4)">
                  {{ 'Solo puedes publicar servicios con precio cerrado o calculable (según peso, tipo de mascota, etc.). Los servicios de diagnóstico o tratamiento personalizado no se podrán reservar online: publica la consulta —«Primera consulta de cardiología, 70 €»—, no la especialidad.' | t }}
                </div>

                <!-- Precio y condiciones de cada servicio elegido -->
                @if (serviciosClinicos.length) {
                  <h2 class="section-title">{{ '2. Precio y condiciones de cada servicio' | t }}</h2>
                  <div formArrayName="serviciosClinicos" class="rows">
                    @for (s of serviciosClinicos.controls; track $index; let i = $index) {
                      <div [formGroupName]="i" class="row-card">
                        <div class="row-card__cab">
                          <strong>{{ nombreServicioClinico(i) }}</strong>
                          <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                                  (click)="quitarServicioClinico(i)" [attr.aria-label]="'Quitar este servicio' | t">
                            <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon>
                          </button>
                        </div>

                        @if (esServicioLibre(i)) {
                          <div class="rs-field">
                            <label class="rs-lbl">{{ 'Nombre del servicio *' | t }}</label>
                            <input class="rs-inp" formControlName="nombre"
                                   [placeholder]="'Ej. Primera consulta de cardiología' | t">
                            <span class="rs-field-hint">
                              {{ 'Tiene que ser un acto con precio, no una especialidad suelta.' | t }}
                            </span>
                          </div>
                        }

                        @if (modosPrecioDe(i).length > 1) {
                          <div class="rs-field">
                            <label class="rs-lbl">{{ '¿Cómo lo cobras?' | t }}</label>
                            <select class="rs-inp" formControlName="modoPrecio"
                                    (change)="modoPrecioCambiado(i)">
                              @for (m of modosPrecioDe(i); track m) {
                                <option [value]="m">{{ etiquetaModoPrecio(m) }}</option>
                              }
                            </select>
                          </div>
                        }

                        @if (cobraPorVariantes(i)) {
                          <!-- El cliente no reserva «vacunación»: reserva «vacuna de
                               la rabia — 32 €», y eso sí lo puede pagar online. -->
                          <div class="rs-field">
                            <span class="rs-lbl">{{ tituloVariantes(i) }}</span>
                            <div formArrayName="variantes" class="variantes">
                              @for (v of variantesDe(i).controls; track $index; let j = $index) {
                                <div [formGroupName]="j" class="variante">
                                  <input class="rs-inp variante__nombre" formControlName="nombre"
                                         [placeholder]="'Ej. Rabia' | t">
                                  <input class="rs-inp variante__precio" type="number" min="0" step="0.01"
                                         formControlName="precio" placeholder="€">
                                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                                          (click)="quitarVariante(i, j)" [attr.aria-label]="'Quitar' | t">
                                    <rs-icon name="x" [size]="12" [stroke]="2"></rs-icon>
                                  </button>
                                </div>
                              }
                            </div>
                            <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                                    (click)="agregarVariante(i)">
                              <rs-icon name="plus" [size]="13" [stroke]="2"></rs-icon>
                              {{ textoAnadirVariante(i) }}
                            </button>
                            <span class="rs-field-hint">
                              {{ 'Lo que dejes sin precio no se publica: así marcas sólo lo que ofreces.' | t }}
                            </span>
                          </div>
                        } @else {
                          <div class="row-card__grid row-card__grid--2">
                            <div class="rs-field">
                              <label class="rs-lbl">{{ 'Precio (€) *' | t }}</label>
                              <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                            </div>
                            <div class="rs-field">
                              <label class="rs-lbl">{{ 'Duración (min)' | t }}</label>
                              <input class="rs-inp" type="number" min="0" formControlName="duracionMin">
                            </div>
                          </div>
                        }

                        @if (detallaAlcance(i)) {
                          <div class="row-card__grid row-card__grid--2">
                            <div class="rs-field">
                              <label class="rs-lbl">{{ 'Incluye' | t }}</label>
                              <input class="rs-inp" formControlName="incluye"
                                     [placeholder]="'Ej. anestesia, intervención y revisión' | t">
                            </div>
                            <div class="rs-field">
                              <label class="rs-lbl">{{ 'No incluye' | t }}</label>
                              <input class="rs-inp" formControlName="noIncluye"
                                     [placeholder]="'Ej. analítica preoperatoria' | t">
                            </div>
                          </div>

                          <div class="rs-field">
                            <span class="rs-lbl">{{ 'Extras que el cliente puede añadir' | t }}</span>
                            <div formArrayName="complementos" class="variantes">
                              @for (c of complementosDe(i).controls; track $index; let j = $index) {
                                <div [formGroupName]="j" class="variante">
                                  <input class="rs-inp variante__nombre" formControlName="nombre"
                                         [placeholder]="'Ej. Analítica preoperatoria' | t">
                                  <input class="rs-inp variante__precio" type="number" min="0" step="0.01"
                                         formControlName="precio" placeholder="€">
                                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                                          (click)="quitarComplemento(i, j)" [attr.aria-label]="'Quitar' | t">
                                    <rs-icon name="x" [size]="12" [stroke]="2"></rs-icon>
                                  </button>
                                </div>
                              }
                            </div>
                            <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                                    (click)="agregarComplemento(i)">
                              <rs-icon name="plus" [size]="13" [stroke]="2"></rs-icon> {{ 'Añadir extra' | t }}
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

                <h2 class="section-title">{{ '3. Información básica de la clínica' | t }}</h2>
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Precio de consulta (€) *' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioConsulta">
                    <span class="rs-field-hint">{{ 'El «desde» que verá el cliente en el buscador.' | t }}</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Duración de la cita (min)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="duracionCitaMin">
                  </div>
                </div>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Citas disponibles por día' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="citasPorDia">
                    <span class="rs-field-hint">{{ 'Número máximo de reservas al día.' | t }}</span>
                  </div>
                  <div class="rs-field">
                    <span class="rs-lbl">{{ 'Especies atendidas' | t }}</span>
                    <rs-tags-input formControlName="especiesAtendidas" [etiqueta]="'Especies atendidas' | t"
                                   [opciones]="catalogos.especies" [permiteNuevos]="false"
                                   [placeholder]="'Elige de la lista…' | t" />
                    <span class="rs-field-hint">{{ 'No es un vertical solo de perros.' | t }}</span>
                  </div>
                </div>

                <label class="rs-checkbox">
                  <input type="checkbox" formControlName="atiendeUrgencias"> {{ 'Atiende urgencias' | t }}
                </label>
                <span class="rs-field-hint">
                  {{ 'Marca esto si además atiendes fuera de cita. El precio de una urgencia no se cierra por adelantado, así que no se reserva online: se avisa al cliente de que la atiendes.' | t }}
                </span>
              </div>
            }

            @case ('peluqueria') {
              <div formGroupName="peluqueria" class="vertical-section">
                <h2 class="section-title">{{ 'Servicios de grooming' | t }}</h2>

                <div formArrayName="serviciosGrooming" class="rows">
                  @for (s of serviciosGrooming.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--4">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Servicio *' | t }}</label>
                          <input class="rs-inp" formControlName="nombre" [placeholder]="'Ej. Baño y corte' | t">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio (€) *' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Duración (min)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" formControlName="duracionMin">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tamaño de perro (por defecto)' | t }}</label>
                          <select class="rs-inp" formControlName="tamanoPerro">
                            <option value="">{{ 'Todos' | t }}</option>
                            @for (tamano of tamanosPerro; track tamano.valor) {
                              <option [value]="tamano.valor">{{ tamano.nombre }}</option>
                            }
                          </select>
                        </div>
                      </div>

                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Tipo de pelo compatible (vacío = cualquiera)' | t }}</label>
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
                        <label class="rs-lbl">{{ 'Precio y duración por tamaño (opcional, sustituye al precio por defecto)' | t }}</label>
                        <div formArrayName="preciosPorTamano" class="rows">
                          @for (t of preciosPorTamano(i).controls; track $index; let ti = $index) {
                            <div [formGroupName]="ti" class="row-card row-card--sm">
                              <div class="row-card__grid row-card__grid--3">
                                <div class="rs-field">
                                  <label class="rs-lbl">{{ 'Tamaño' | t }}</label>
                                  <select class="rs-inp" formControlName="tamano">
                                    @for (tp of tamanosPerro; track tp.valor) {
                                      <option [value]="tp.valor">{{ tp.etiqueta }}</option>
                                    }
                                  </select>
                                </div>
                                <div class="rs-field">
                                  <label class="rs-lbl">{{ 'Precio (€)' | t }}</label>
                                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                                </div>
                                <div class="rs-field">
                                  <label class="rs-lbl">{{ 'Duración (min)' | t }}</label>
                                  <input class="rs-inp" type="number" min="0" formControlName="duracionMin">
                                </div>
                              </div>
                              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarPrecioPorTamano(i, ti)">
                                <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                              </button>
                            </div>
                          }
                        </div>
                        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarPrecioPorTamano(i)">
                          <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir tier de tamaño' | t }}
                        </button>
                      </div>

                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioGrooming(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar servicio' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioGrooming()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir servicio de grooming' | t }}
                </button>

                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Duración por turno (min)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="duracionSlotMin">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Capacidad simultánea' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="capacidadSimultanea">
                  </div>
                </div>

                <label class="rs-checkbox"><input type="checkbox" formControlName="aDomicilio"> {{ 'Servicio a domicilio' | t }}</label>

                <h2 class="section-title">{{ 'Perros con temperamento difícil' | t }}</h2>
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Política ante perros nerviosos/agresivos' | t }}</label>
                  <select class="rs-inp" formControlName="politicaTemperamentoDificil">
                    <option value="aceptar">{{ 'Aceptar igual' | t }}</option>
                    <option value="suplemento">{{ 'Aceptar con suplemento' | t }}</option>
                    <option value="valoracion_previa">{{ 'Requiere valoración previa' | t }}</option>
                    <option value="rechazar">{{ 'Rechazar' | t }}</option>
                  </select>
                  <span class="rs-field-hint">{{ 'El importe del suplemento se define en tu catálogo de suplementos, no aquí.' | t }}</span>
                </div>
                <label class="rs-checkbox">
                  <input type="checkbox" formControlName="bozalObligatorioSiAgresivo"> {{ 'Bozal obligatorio si el perro es agresivo con la manipulación' | t }}
                </label>

                <h2 class="section-title">{{ 'Servicios adicionales' | t }}</h2>
                <div formArrayName="serviciosAdicionales" class="rows">
                  @for (s of serviciosAdicionalesPeluqueria.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Nombre' | t }}</label>
                          <input class="rs-inp" formControlName="nombre" [placeholder]="'Ej. Corte de uñas' | t">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio (€)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdicionalPeluqueria(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdicionalPeluqueria()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir servicio adicional' | t }}
                </button>

                <h2 class="section-title">{{ 'Requisitos' | t }}</h2>
                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Razas específicas atendidas (opcional)' | t }}</span>
                  <rs-tags-input formControlName="razasEspecificas" [etiqueta]="'Razas específicas atendidas' | t"
                                 [opciones]="catalogos.razas" [placeholder]="'Ej. Caniche…' | t" />
                </div>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereVacunasAlDia"> {{ 'Exige vacunas al día' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="requiereMicrochip"> {{ 'Exige microchip' | t }}</label>
                </div>
              </div>
            }

            @case ('adiestramiento') {
              <div formGroupName="adiestramiento" class="vertical-section">
                <h2 class="section-title">{{ 'Valoración inicial' | t }}</h2>
                <p class="rs-field-hint">
                  {{ 'Pon el precio de las modalidades que ofrezcas: una, dos o las tres. Deja en 0 las que no hagas.' | t }}
                </p>
                <div class="form-row-3">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Presencial (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="valoracionPresencialPrecio">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Online, videollamada (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="valoracionOnlinePrecio">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'A domicilio (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="valoracionDomicilioPrecio">
                  </div>
                </div>

                <h2 class="section-title">{{ 'Catálogo de servicios y cursos' | t }}</h2>
                <div formArrayName="serviciosAdiestramiento" class="rows">
                  @for (s of serviciosAdiestramiento.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--curso">
                        <div class="rs-field">
                          <label class="rs-lbl">
                            {{ 'Nombre *' | t }} <span class="lbl-nota">{{ '(Escribe o selecciona)' | t }}</span>
                          </label>
                          <rs-combo-input formControlName="nombre" [opciones]="nombresCursos"
                                          [etiqueta]="'Nombre del servicio o curso' | t"
                                          [placeholder]="'Elige un curso o escribe el tuyo' | t" />
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tipo' | t }}</label>
                          <select class="rs-inp" formControlName="tipo">
                            <option value="individual">{{ 'Sesión individual' | t }}</option>
                            <option value="grupal">{{ 'Sesión grupal' | t }}</option>
                            <option value="curso">{{ 'Curso completo' | t }}</option>
                            <option value="especial">{{ 'Servicio especial' | t }}</option>
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio (€) *' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Duración' | t }}</label>
                          <div class="campo-duracion">
                            <input class="rs-inp" type="number" min="0" formControlName="duracionValor">
                            <select class="rs-inp" formControlName="duracionUnidad" [attr.aria-label]="'Unidad de la duración' | t">
                              <option value="minutos">{{ 'Minutos' | t }}</option>
                              <option value="horas">{{ 'Horas' | t }}</option>
                              <option value="dias">{{ 'Días' | t }}</option>
                              <option value="meses">{{ 'Meses' | t }}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div class="row-card__grid row-card__grid--curso-datos">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Máx. perros' | t }}</label>
                          <input class="rs-inp" type="number" min="1" formControlName="maxPerros">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Edad mín. (meses)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" formControlName="edadMinimaMeses">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Edad máx. (0 = sin límite)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" formControlName="edadMaximaMeses">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Lugar' | t }}</label>
                          <select class="rs-inp" formControlName="lugar">
                            <option value="centro">{{ 'En el centro' | t }}</option>
                            <option value="domicilio">{{ 'A domicilio' | t }}</option>
                            <option value="online">{{ 'Online' | t }}</option>
                          </select>
                        </div>
                      </div>
                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Material necesario (opcional)' | t }}</label>
                        <input class="rs-inp" formControlName="materialNecesario" [placeholder]="'Ej. correa larga, arnés antitirón' | t">
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioAdiestramiento(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioAdiestramiento()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir servicio o curso' | t }}
                </button>

              </div>
            }

            @case ('hoteles') {
              <div formGroupName="hoteles" class="vertical-section">
                <h2 class="section-title">{{ 'Política de mascotas' | t }}</h2>
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Máximo de mascotas por reserva (0 = sin límite)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="maxMascotasPorReserva">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Peso máximo por mascota, kg (0 = sin límite)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="pesoMaximoMascotaKg">
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Razas restringidas' | t }}</label>
                  <select class="rs-inp" formControlName="razasRestringidas">
                    <option value="ninguna">{{ 'Ninguna restricción' | t }}</option>
                    <option value="ppp">{{ 'Razas potencialmente peligrosas (PPP)' | t }}</option>
                    <option value="razas_gigantes">{{ 'Razas gigantes' | t }}</option>
                    <option value="especificas">{{ 'Razas específicas' | t }}</option>
                  </select>
                </div>
                @if (hotelesGroup.get('razasRestringidas')?.value === 'especificas') {
                  <div class="rs-field">
                    <span class="rs-lbl">{{ 'Razas restringidas' | t }}</span>
                    <rs-tags-input formControlName="razasEspecificasRestringidas" [etiqueta]="'Razas restringidas' | t"
                                   [opciones]="catalogos.razas" [placeholder]="'Ej. Pit Bull Terrier…' | t" />
                  </div>
                }

                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Especies permitidas' | t }}</span>
                  <rs-tags-input formControlName="especiesPermitidas" [etiqueta]="'Especies permitidas' | t"
                                 [opciones]="catalogos.especies" [permiteNuevos]="false"
                                 [placeholder]="'Elige de la lista…' | t" />
                </div>

                <h2 class="section-title">{{ 'Suplemento por tamaño de mascota (€/noche)' | t }}</h2>
                <div formArrayName="suplementoPorTamanoMascota" class="rows">
                  @for (t of suplementoPorTamanoMascota.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card row-card--sm">
                      <div class="row-card__grid row-card__grid--2">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tamaño' | t }}</label>
                          <select class="rs-inp" formControlName="tamano">
                            @for (tp of tamanosPerro; track tp.valor) {
                              <option [value]="tp.valor">{{ tp.etiqueta }}</option>
                            }
                          </select>
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Suplemento (€/noche)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioPorNoche">
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarSuplementoPorTamanoMascota(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarSuplementoPorTamanoMascota()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir tier de tamaño' | t }}
                </button>

                <h2 class="section-title">{{ 'Servicios petfriendly' | t }}</h2>
                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Servicios disponibles' | t }}</span>
                  <rs-tags-input formControlName="serviciosPetfriendly" [etiqueta]="'Servicios pet-friendly del hotel' | t"
                                 [opciones]="catalogos.serviciosPetfriendly" [placeholder]="'Ej. cama para mascota…' | t" />
                </div>

                <h2 class="section-title">{{ 'Normas del alojamiento' | t }}</h2>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="puedeQuedarseSoloEnHabitacion"> {{ 'Puede quedarse solo en la habitación' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="accesoZonasComunes"> {{ 'Acceso a zonas comunes' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="debeIrConCorrea"> {{ 'Debe ir con correa' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="debeLlevarBozalSiCorresponde"> {{ 'Debe llevar bozal si corresponde' | t }}</label>
                </div>

                <h2 class="section-title">{{ 'Habitaciones pet-friendly' | t }}</h2>
                <p class="rs-field-hint" style="margin-bottom:var(--sp-3)">
                  {{ 'Declara los tipos que admiten mascota, con sus fotos. Las plazas del hotel salen de la suma de sus cantidades, así que no hay que contarlas aparte.' | t }}
                </p>

                <div formArrayName="espacios" class="rows">
                  @for (hab of habitacionesHotel.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--3">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tipo de habitación *' | t }}</label>
                          <input class="rs-inp" formControlName="tipo" [placeholder]="'Ej. Doble pet-friendly' | t">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio/noche (€) *' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioNoche">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Cantidad disponible *' | t }}</label>
                          <input class="rs-inp" type="number" min="1" formControlName="cantidad">
                        </div>
                      </div>
                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Descripción de la habitación' | t }}</label>
                        <input class="rs-inp" formControlName="descripcion"
                               [placeholder]="'Ej. Doble con terraza y cama para mascota' | t">
                      </div>
                      <div class="rs-field">
                        <span class="rs-lbl">{{ 'Fotos de esta habitación' | t }}</span>
                        <rs-image-upload origen="servicio/imagenes" [multiple]="true" [maxFiles]="8"
                                         formControlName="imagenes"></rs-image-upload>
                        <span class="rs-field-hint">
                          {{ 'El cliente reserva' | t }} <em>{{ 'esta' | t }}</em> {{ 'habitación: enséñale la que va a coger. JPEG, PNG o WebP · máx. 5 MB cada una.' | t }}
                        </span>
                      </div>
                      <div class="checkbox-row">
                        <label class="rs-checkbox"><input type="checkbox" formControlName="disponible"> {{ 'Disponible' | t }}</label>
                        <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarHabitacionHotel(i)">
                          <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                        </button>
                      </div>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarHabitacionHotel()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir tipo de habitación' | t }}
                </button>

                <div class="fotos-cuenta" [class.fotos-cuenta--ok]="fotosSuficientes()">
                  <rs-icon [name]="fotosSuficientes() ? 'check-circle' : 'camera'" [size]="15" [stroke]="2" />
                  <span>{{ mensajeFotos() }}</span>
                </div>

                <h2 class="section-title">{{ 'Info general' | t }}</h2>
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Ingreso' | t }}</label>
                    <input class="rs-inp" type="time" formControlName="checkIn">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Salida' | t }}</label>
                    <input class="rs-inp" type="time" formControlName="checkOut">
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Fianza (€, 0 = sin fianza)' | t }}</label>
                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="fianza">
                </div>
              </div>
            }

            @case ('seguros') {
              <div formGroupName="seguros" class="vertical-section">
                <!--
                  Sólo se llega aquí editando: al crear, elegir "Seguros" lleva
                  a la solicitud de alta. Estas coberturas y primas las configura
                  el equipo con la documentación de la compañía delante.
                -->
                <h2 class="section-title">{{ 'Coberturas de la póliza' | t }}</h2>
                <span class="rs-field-hint" style="display:block;margin-bottom:var(--sp-3)">
                  {{ 'Marca todo lo que incluye. El cliente verá estas coberturas antes de contratar.' | t }}
                </span>
                <div class="checks-grid">
                  @for (t of tiposSeguroCatalogo; track t.tipo) {
                    <label class="rs-checkbox">
                      <input type="checkbox" [checked]="tieneCobertura(t.tipo)"
                             (change)="alternarCobertura(t.tipo)">
                      {{ t.label | t }}
                    </label>
                  }
                </div>

                <h2 class="section-title">{{ 'Prima y vigencia' | t }}</h2>
                <div class="row-card__grid row-card__grid--3">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Prima anual de referencia (€) *' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="primaAnualBase">
                    <span class="rs-field-hint">{{ 'Orientativa: la validas tú antes de emitir.' | t }}</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Duración (meses)' | t }}</label>
                    <input class="rs-inp" type="number" min="1" formControlName="duracionMeses">
                    <span class="rs-field-hint">{{ '12 = anual · menos = temporal (viajes, eventos)' | t }}</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Descuento por pago anual (%)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" max="100" formControlName="descuentoPagoAnualPct">
                  </div>
                </div>
                <label class="rs-checkbox">
                  <input type="checkbox" formControlName="renovacionAutomatica"> {{ 'Renovación automática al vencimiento' | t }}
                </label>

                <h2 class="section-title">{{ 'Condiciones de admisión' | t }}</h2>
                <span class="rs-field-hint" style="display:block;margin-bottom:var(--sp-3)">
                  {{ 'Determinan qué mascotas pueden contratar. Doogking las comprueba antes de dejar contratar, así que no recibirás solicitudes que no puedas aceptar.' | t }}
                </span>
                <div class="row-card__grid row-card__grid--3">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Edad mínima (meses)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="edadMinimaMeses">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Edad máxima (años)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="edadMaximaAnios">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Peso máximo (kg)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="pesoMaximoKg">
                  </div>
                </div>
                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Razas excluidas' | t }}</span>
                  <rs-tags-input formControlName="razasExcluidas" [etiqueta]="'Razas excluidas de la póliza' | t"
                                 [opciones]="catalogos.razas" [placeholder]="'Ej. Pit Bull Terrier…' | t" />
                </div>
                <div class="row-card__grid row-card__grid--2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Recargo por riesgo (%)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" max="200" formControlName="recargoRiesgoPct">
                    <span class="rs-field-hint">{{ 'Se aplica en vez de rechazar a perfiles de mayor riesgo.' | t }}</span>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Cupo de pólizas (0 = sin límite)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="cupoPolizas">
                  </div>
                </div>
                <div class="checkbox-row">
                  <label class="rs-checkbox">
                    <input type="checkbox" formControlName="excluyePPP"> {{ 'No cubre razas PPP' | t }}
                  </label>
                  <label class="rs-checkbox">
                    <input type="checkbox" formControlName="requiereVacunasAlDia"> {{ 'Exige vacunación al día' | t }}
                  </label>
                </div>

                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Condiciones generales (URL del PDF)' | t }}</label>
                  <input class="rs-inp" formControlName="documentoCondicionesUrl" placeholder="https://…">
                </div>
              </div>
            }

            @case ('funerarios') {
              <div formGroupName="funerarios" class="vertical-section">
                <!--
                  El catálogo manda: de él salen el precio cerrado, los filtros
                  del buscador y lo que el cliente elige al contratar. Un
                  servicio se desactiva sin borrarlo, porque las reservas
                  antiguas siguen apuntando a su nombre.
                -->
                <h2 class="section-title">{{ 'Servicios que ofreces' | t }}</h2>
                <p class="rs-field-hint">
                  {{ 'Añade cada servicio con su precio. Si cobras según el peso del animal, usa los tramos: el cliente verá el precio exacto de su caso, no un «desde».' | t }}
                </p>

                <div formArrayName="serviciosFunerarios" class="rows">
                  @for (sv of serviciosFunerarios.controls; track $index; let i = $index) {
                    <div [formGroupName]="i" class="row-card">
                      <div class="row-card__grid row-card__grid--curso-tres">
                        <div class="rs-field">
                          <label class="rs-lbl">
                            {{ 'Nombre *' | t }} <span class="lbl-nota">{{ '(Escribe o selecciona)' | t }}</span>
                          </label>
                          <rs-combo-input formControlName="nombre" [opciones]="nombresServiciosFunerarios"
                                          [etiqueta]="'Nombre del servicio funerario' | t"
                                          [placeholder]="'Elige un servicio o escribe el tuyo' | t" />
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio (€) *' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioBase">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Tiempo estimado (h)' | t }}</label>
                          <input class="rs-inp" type="number" min="0" formControlName="tiempoEstimadoHoras">
                        </div>
                      </div>

                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Descripción' | t }}</label>
                        <input class="rs-inp" formControlName="descripcion"
                               [placeholder]="'Ej. Cremación individual con entrega de cenizas en 48 h' | t">
                      </div>

                      <div class="rs-field">
                        <span class="rs-lbl">
                          {{ 'Qué incluye' | t }} <span class="lbl-nota">{{ '(Escribe o selecciona)' | t }}</span>
                        </span>
                        <rs-tags-input formControlName="incluye" [etiqueta]="'Qué incluye el servicio' | t"
                                       [opciones]="catalogos.incluyeFunerario"
                                       [placeholder]="'Elige de la lista o escribe lo tuyo…' | t" />
                      </div>

                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Precio por tramos de peso (opcional, sustituye al precio de arriba)' | t }}</label>
                        <div formArrayName="tramosPeso" class="rows">
                          @for (t of tramosPeso(i).controls; track $index; let ti = $index) {
                            <div [formGroupName]="ti" class="row-card row-card--sm">
                              <div class="row-card__grid row-card__grid--2">
                                <div class="rs-field">
                                  <label class="rs-lbl">{{ 'Hasta (kg)' | t }}</label>
                                  <input class="rs-inp" type="number" min="0" step="0.5" formControlName="hastaKg">
                                </div>
                                <div class="rs-field">
                                  <label class="rs-lbl">{{ 'Precio (€)' | t }}</label>
                                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                                </div>
                              </div>
                              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarTramoPeso(i, ti)">
                                <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                              </button>
                            </div>
                          }
                        </div>
                        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarTramoPeso(i)">
                          <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir tramo de peso' | t }}
                        </button>
                      </div>

                      <div class="checkbox-row">
                        <label class="rs-checkbox"><input type="checkbox" formControlName="devuelveCenizas"> {{ 'Devuelve las cenizas' | t }}</label>
                        <label class="rs-checkbox"><input type="checkbox" formControlName="urnaIncluida"> {{ 'Urna incluida' | t }}</label>
                        <label class="rs-checkbox"><input type="checkbox" formControlName="certificadoIncluido"> {{ 'Certificado incluido' | t }}</label>
                        <label class="rs-checkbox"><input type="checkbox" formControlName="activo"> {{ 'Activo' | t }}</label>
                      </div>

                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarServicioFunerario(i)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar servicio' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarServicioFunerario()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir servicio' | t }}
                </button>

                <h2 class="section-title">{{ 'Recogida' | t }}</h2>
                <p class="rs-field-hint">
                  {{ 'Si no recoges, el cliente solo podrá llevarte al animal. Fuera del radio que declares, la plataforma no dejará contratar la recogida.' | t }}
                </p>
                <label class="rs-checkbox"><input type="checkbox" formControlName="ofreceRecogida"> {{ 'Ofrezco recogida' | t }}</label>

                @if (funerariosGroup.get('ofreceRecogida')?.value) {
                  <div class="rs-field">
                    <span class="rs-lbl">{{ 'Desde dónde recoges' | t }}</span>
                    <div class="checks-grid">
                      @for (l of lugaresRecogida; track l.valor) {
                        <label class="filter-check">
                          <input type="checkbox" [checked]="tieneLugarRecogida(l.valor)"
                                 (change)="toggleLugarRecogida(l.valor)" />
                          {{ l.label | t }}
                        </label>
                      }
                    </div>
                  </div>

                  <div class="form-row-2">
                    <div class="rs-field">
                      <label class="rs-lbl">{{ 'Radio máximo (km)' | t }}</label>
                      <input class="rs-inp" type="number" min="0" formControlName="radioRecogidaKm">
                    </div>
                    <div class="rs-field">
                      <label class="rs-lbl">{{ 'Cómo cobras el desplazamiento' | t }}</label>
                      <select class="rs-inp" formControlName="modoPrecioRecogida">
                        @for (m of modosPrecioRecogida; track m.valor) {
                          <option [value]="m.valor">{{ m.label | t }}</option>
                        }
                      </select>
                    </div>
                  </div>

                  @switch (funerariosGroup.get('modoPrecioRecogida')?.value) {
                    @case ('fija') {
                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Precio de la recogida (€)' | t }}</label>
                        <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioRecogida">
                      </div>
                    }
                    @case ('por_km') {
                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Precio por kilómetro (€)' | t }}</label>
                        <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precioRecogidaPorKm">
                      </div>
                    }
                    @case ('por_zona') {
                      <div class="rs-field">
                        <label class="rs-lbl">{{ 'Zonas y su precio' | t }}</label>
                        <div formArrayName="zonasRecogida" class="rows">
                          @for (z of zonasRecogida.controls; track $index; let zi = $index) {
                            <div [formGroupName]="zi" class="row-card row-card--sm">
                              <div class="row-card__grid row-card__grid--2">
                                <div class="rs-field">
                                  <label class="rs-lbl">{{ 'Zona' | t }}</label>
                                  <input class="rs-inp" formControlName="nombre" [placeholder]="'Ej. Área metropolitana' | t">
                                </div>
                                <div class="rs-field">
                                  <label class="rs-lbl">{{ 'Precio (€)' | t }}</label>
                                  <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                                </div>
                              </div>
                              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarZonaRecogida(zi)">
                                <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                              </button>
                            </div>
                          }
                        </div>
                        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarZonaRecogida()">
                          <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir zona' | t }}
                        </button>
                      </div>
                    }
                  }
                }

                <h2 class="section-title">{{ 'Urgencias y disponibilidad' | t }}</h2>
                <div class="checkbox-row">
                  <label class="rs-checkbox"><input type="checkbox" formControlName="servicioUrgente"> {{ 'Atiendo servicios urgentes' | t }}</label>
                  <label class="rs-checkbox"><input type="checkbox" formControlName="atiende24h"> {{ 'Disponible 24 h' | t }}</label>
                </div>
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Suplemento por urgencia (€)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" step="0.01" formControlName="suplementoUrgencia">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Servicios que puedes atender al día' | t }}</label>
                    <input class="rs-inp" type="number" min="0" formControlName="cuposDisponibles">
                  </div>
                </div>
                <div class="rs-field">
                  <span class="rs-lbl">{{ 'Franjas en las que recoges o entregas' | t }}</span>
                  <div class="checks-grid">
                    @for (f of franjasHorarias; track f.valor) {
                      <label class="filter-check">
                        <input type="checkbox" [checked]="tieneFranja(f.valor)" (change)="toggleFranja(f.valor)" />
                        {{ f.label | t }}
                      </label>
                    }
                  </div>
                  <span class="rs-field-hint">
                    {{ 'No se pide hora exacta al cliente: se reserva por franja.' | t }}
                  </span>
                </div>

                <h2 class="section-title">{{ 'Extras opcionales' | t }}</h2>
                <p class="rs-field-hint">
                  {{ 'Lo que el cliente puede añadir al contratar: urnas, huellas, relicarios, grabados, sala de despedida, ceremonia…' | t }}
                </p>
                <div formArrayName="extras" class="rows">
                  @for (e of extrasFunerarios.controls; track $index; let ei = $index) {
                    <div [formGroupName]="ei" class="row-card">
                      <div class="row-card__grid row-card__grid--curso">
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Nombre *' | t }}</label>
                          <input class="rs-inp" formControlName="nombre" [placeholder]="'Ej. Urna de madera' | t">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Precio (€) *' | t }}</label>
                          <input class="rs-inp" type="number" min="0" step="0.01" formControlName="precio">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Descripción' | t }}</label>
                          <input class="rs-inp" formControlName="descripcion" [placeholder]="'Opcional' | t">
                        </div>
                        <div class="rs-field">
                          <label class="rs-lbl">{{ 'Estado' | t }}</label>
                          <label class="rs-checkbox"><input type="checkbox" formControlName="activo"> {{ 'Activo' | t }}</label>
                        </div>
                      </div>
                      <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarExtraFunerario(ei)">
                        <rs-icon name="x" [size]="13" [stroke]="2"></rs-icon> {{ 'Quitar' | t }}
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarExtraFunerario()">
                  <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon> {{ 'Añadir extra' | t }}
                </button>

                <h2 class="section-title">{{ 'Cancelaciones' | t }}</h2>
                <p class="rs-field-hint">
                  {{ 'Esta categoría necesita dos condiciones distintas: antes de recoger todo es reversible; una vez iniciado el servicio, no. El cliente las ve antes de pagar.' | t }}
                </p>
                <div class="form-row-2">
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Reembolso antes de la recogida (%)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" max="100" formControlName="reembolsoAntesRecogidaPct">
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Reembolso con el servicio iniciado (%)' | t }}</label>
                    <input class="rs-inp" type="number" min="0" max="100" formControlName="reembolsoIniciadoPct">
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">{{ 'Notas de la política' | t }}</label>
                  <input class="rs-inp" formControlName="notasCancelacion"
                         [placeholder]="'Ej. Cancelaciones por teléfono hasta 2 h antes de la recogida' | t">
                </div>

                <h2 class="section-title">{{ 'Autorizaciones' | t }}</h2>
                <div class="rs-field">
                  <label class="rs-checkbox">
                    <input type="checkbox" formControlName="declaraAutorizaciones">
                    {{ 'Declaro disponer de las autorizaciones, registros, permisos o acuerdos necesarios para prestar legalmente los servicios que publico.' | t }}
                  </label>
                  <span class="rs-field-hint">
                    {{ 'Obligatorio para publicar en esta categoría, además de la declaración responsable general de Doogking.' | t }}
                  </span>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">{{ '¿Quién realiza la cremación?' | t }}</label>
                  <select class="rs-inp" formControlName="cremacionPropia">
                    <option [ngValue]="true">{{ 'La realiza mi empresa' | t }}</option>
                    <option [ngValue]="false">{{ 'Trabajo con un tercero' | t }}</option>
                  </select>
                </div>
                @if (funerariosGroup.get('cremacionPropia')?.value === false) {
                  <div class="rs-field">
                    <label class="rs-lbl">{{ 'Empresa que realiza la cremación' | t }}</label>
                    <input class="rs-inp" formControlName="terceroCrematorio" [placeholder]="'Nombre del crematorio' | t">
                  </div>
                }
              </div>
            }
          }

          <!-- Las categorías sin unidad reservable propia enseñan el servicio
               entero: no hay una suite concreta que fotografiar. -->
          @if (!fotosPorUnidad() && form.controls.vertical.value) {
            <div class="rs-field fotos-servicio">
              <label class="rs-lbl">{{ 'Fotos del servicio' | t }}</label>
              <rs-image-upload origen="servicio/imagenes" [multiple]="true" [maxFiles]="10"
                               formControlName="imagenes"></rs-image-upload>
              <span class="rs-field-hint">{{ 'JPEG, PNG o WebP · máx. 5 MB cada una.' | t }}</span>
              <div class="fotos-cuenta" [class.fotos-cuenta--ok]="fotosSuficientes()">
                <rs-icon [name]="fotosSuficientes() ? 'check-circle' : 'camera'" [size]="15" [stroke]="2" />
                <span>{{ mensajeFotos() }}</span>
              </div>
            </div>
          }
          }

          @if (paso() === 'aptitud') {
            <!-- Repaso antes de crear: lo que se va a publicar, en una línea. -->
            <div class="repaso">
              <p class="repaso__titulo">{{ 'Esto es lo que vas a publicar' | t }}</p>
              <dl class="repaso__lista">
                <div><dt>{{ 'Categoría' | t }}</dt><dd>{{ etiquetaVertical() || '—' }}</dd></div>
                <div><dt>{{ 'Nombre' | t }}</dt><dd>{{ form.controls.titulo.value || '—' }}</dd></div>
                <div><dt>{{ 'Ciudad' | t }}</dt><dd>{{ form.controls.ciudad.value || '—' }}</dd></div>
                <div><dt>{{ 'Precio desde' | t }}</dt><dd>{{ form.controls.precioBase.value || 0 | euros }}</dd></div>
                <div><dt>{{ 'Fotos' | t }}</dt><dd>{{ totalFotos() }}</dd></div>
              </dl>
            </div>

            @if (!esEdicion()) {
              <div class="rs-alert rs-alert--info">
                @if (modoAlta()) {
                  Tu servicio queda <strong>{{ 'publicado' | t }}</strong> al terminar el alta. Aparecerá en el
                  buscador en cuanto revisemos tu negocio.
                } @else {
                  Tu servicio queda <strong>{{ 'publicado' | t }}</strong>. Puedes pausarlo cuando quieras desde
                  «Mis servicios».
                }
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
              @if (modoAlta()) {
                <button type="button" class="rs-btn rs-btn--ghost" (click)="volverAtras.emit()">
                  <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
                  {{ 'Cambiar de servicio' | t }}
                </button>
              } @else {
                <a routerLink="/comercio/listados" class="rs-btn rs-btn--ghost">{{ 'Cancelar' | t }}</a>
              }
            } @else {
              <button type="button" class="rs-btn rs-btn--ghost" (click)="pasoAnterior()">
                <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon>
                {{ 'Atrás' | t }}
              </button>
            }

            @if (esUltimoPaso()) {
              <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
                @if (guardando()) { Guardando… } @else {
                  <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
                  {{ textoBotonFinal() }}
                }
              </button>
            } @else {
              <button type="button" class="rs-btn rs-btn--primary" (click)="siguientePaso()">
                {{ 'Continuar' | t }}
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

    /*
     * .rs-card recorta con overflow:hidden para redondear las esquinas de su
     * contenido. El desplegable de "Ciudad" (rs-place-autocomplete) es
     * position:absolute y puede sobresalir bastante por debajo de la tarjeta
     * cuando el paso es corto; con el recorte activo, la lista de sugerencias
     * se cortaba a mitad y no se veia completa. Nada del contenido de este
     * formulario depende de ese recorte para verse bien (las miniaturas de
     * rs-image-upload ya redondean sus propias esquinas), asi que se desactiva.
     */
    .form-card { padding: var(--sp-8); overflow: visible; }
    .borrador { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); flex-wrap: wrap; }
    form { display: flex; flex-direction: column; gap: var(--sp-5); }

    .section-title {
      font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100);
      padding-top: var(--sp-3); margin-top: var(--sp-2); border-top: 1px solid var(--b-1);
      &:first-child { padding-top: 0; margin-top: 0; border-top: none; }
    }

    .vertical-section { display: flex; flex-direction: column; gap: var(--sp-5); }

    /* Aclaración dentro de una etiqueta: acompaña al nombre del campo sin
       competir con él, y al vivir en la etiqueta no descuadra la fila. */
    .lbl-nota { font-size: var(--f-xs); font-weight: var(--w-4); color: var(--t-400); }

    /* La pista que explica una sección pertenece a su título: sin esto queda a
       la misma distancia del título que del bloque de campos y no se sabe de
       cuál de los dos habla. */
    .section-title + .rs-field-hint { margin-top: calc(var(--sp-2) - var(--sp-5)); }

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
    .form-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4); @media (max-width: 720px) { grid-template-columns: 1fr; } }

    /* Aviso de coordenadas: sin ellas el servicio no sale en el mapa del buscador. */
    .geo {
      display: flex; align-items: flex-start; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--r-lg); background: var(--c-raised);
      font-size: var(--f-sm); color: var(--t-300);
    }
    .geo rs-icon { flex-shrink: 0; color: var(--c-amber); }
    .geo--ok rs-icon { color: var(--c-success, #10B981); }

    /*
     * ══ UBICACIÓN: FORMULARIO Y MAPA EN PARALELO ═══════════════════════
     * El patrón del extranet de Booking. Móvil primero: una columna con el
     * mapa arriba —da contexto a lo que se rellena debajo— y los campos
     * después. A partir de 900px se parten en dos, con el mapa pegado
     * mientras se rellena el formulario, que es más largo.
     */
    .ubi { display: flex; flex-direction: column-reverse; gap: var(--sp-5); }
    .ubi__campos { display: flex; flex-direction: column; gap: var(--sp-4); }
    .ubi__mapa { display: flex; flex-direction: column; gap: var(--sp-3); }

    .ubi__lienzo {
      position: relative;
      /* Alto suficiente para reconocer la manzana; por debajo el mapa no
         resuelve la duda de si el pin cayó donde toca. */
      height: 260px;
      border: 1px solid var(--b-1); border-radius: var(--r-xl);
      overflow: hidden; background: var(--c-raised);
    }
    .ubi__lienzo rs-mapa { display: block; height: 100%; }

    .ubi__vacio {
      height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: var(--sp-2); padding: var(--sp-6);
      color: var(--t-400); font-size: var(--f-sm); text-align: center;
    }

    .ubi__cargando {
      position: absolute; left: 50%; bottom: var(--sp-3); transform: translateX(-50%);
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      background: var(--c-card); box-shadow: var(--sh-2);
      font-size: var(--f-xs); color: var(--t-300); white-space: nowrap;
    }

    .ubi__sync {
      display: flex; align-items: flex-start; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      font-size: var(--f-sm); color: var(--t-300); cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);

      input { margin-top: 2px; flex-shrink: 0; }
    }
    .ubi__sync--on { border-color: var(--c-accent); background: var(--c-accent-lo); }

    .ubi__aviso {
      position: relative;
      display: flex; align-items: flex-start; gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-9) var(--sp-3) var(--sp-4);
      border-radius: var(--r-lg); background: var(--c-raised);
      font-size: var(--f-sm); color: var(--t-300); line-height: 1.55;

      /* Acotado al primer icono: el aspa de cerrar tiene su propio color. */
      > rs-icon { flex-shrink: 0; color: var(--c-amber); margin-top: 1px; }
    }
    .ubi__aviso-x {
      position: absolute; top: var(--sp-2); right: var(--sp-2);
      display: grid; place-items: center;
      width: 28px; height: 28px; border: 0; border-radius: var(--r-full);
      background: transparent; color: var(--t-400); cursor: pointer;
      &:hover { background: var(--c-card); color: var(--t-100); }
    }

    .opt { font-weight: var(--w-4); color: var(--t-400); font-size: var(--f-xs); }

    @media (min-width: 900px) {
      .ubi {
        flex-direction: row;
        align-items: flex-start;
        gap: var(--sp-6);
      }
      .ubi__campos { flex: 1 1 58%; min-width: 0; }
      .ubi__mapa {
        flex: 1 1 42%; min-width: 0;
        position: sticky; top: var(--sp-4);
      }
      .ubi__lienzo { height: 420px; }
    }

    .rows { display: flex; flex-direction: column; gap: var(--sp-4); }
    .row-card {
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding: var(--sp-4); background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg);
    }
    .row-card--sm { padding: var(--sp-3); background: var(--c-surface); }
    .row-card__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-3); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }

    /*
     * Las etiquetas de una misma fila no miden lo mismo —«Tipo *» frente a
     * «Tamaño máx. de perro (opcional)»— y la larga saltaba a dos líneas,
     * empujando su campo un renglón por debajo de los demás. La etiqueta se
     * queda con el hueco sobrante y los campos se alinean abajo, así que la
     * fila se lee recta tanto a cuatro columnas como a dos en móvil.
     */
    .row-card__grid > .rs-field { justify-content: flex-end; }
    .row-card__grid > .rs-field > .rs-lbl { flex: 1; }
    .row-card__grid--2 { grid-template-columns: repeat(2, 1fr); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .row-card__grid--3 { grid-template-columns: repeat(3, 1fr); @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .row-card__grid--4 { grid-template-columns: repeat(4, 1fr); @media (max-width: 640px) { grid-template-columns: 1fr 1fr; } }

    /*
     * Sin esto, una etiqueta larga o un input con contenido ancho ensancha su
     * columna (el mínimo automático de una celda de rejilla es su contenido) y
     * la fila deja de repartirse en partes iguales.
     */
    .row-card__grid > .rs-field { min-width: 0; }
    .row-card__grid .rs-inp { min-width: 0; }

    /*
     * Catálogo de adiestramiento: los cuatro datos de la primera fila no piden
     * el mismo ancho —el nombre del curso es texto largo y la duración son dos
     * campos—, así que se reparte en proporción y no en cuartos iguales. En
     * tablet baja a dos columnas y en móvil cada campo ocupa su propia línea:
     * un desplegable y un número compartiendo 160 px no se pueden usar.
     */
    .row-card__grid--curso {
      grid-template-columns: 1.7fr 1.1fr .9fr 1.3fr;
      @media (max-width: 980px) { grid-template-columns: 1fr 1fr; }
      @media (max-width: 560px) { grid-template-columns: 1fr; }
    }

    /* La misma fila sin el tipo: son tres datos y el nombre sigue mandando. */
    .row-card__grid--curso-tres {
      grid-template-columns: 1.9fr 1fr 1.1fr;
      @media (max-width: 980px) { grid-template-columns: 1fr 1fr; }
      @media (max-width: 560px) { grid-template-columns: 1fr; }
    }

    /* Segunda fila: cuatro cifras cortas, que sí caben emparejadas en móvil. */
    .row-card__grid--curso-datos {
      grid-template-columns: repeat(4, 1fr);
      @media (max-width: 980px) { grid-template-columns: 1fr 1fr; }
    }

    /* Duración: el número y su unidad son un solo dato, así que comparten fila. */
    .campo-duracion { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: var(--sp-2); }

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

    /* ══ TRAYECTO DEL TRANSPORTISTA ═══════════════════════════════════ */
    /* El número lleva el orden: la línea del mapa no dice cuál es la primera. */
    .paradas { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-3); }
    .parada {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-2) var(--sp-3);
      background: var(--c-raised); border-radius: var(--r-md);
    }
    .parada__orden {
      display: grid; place-items: center; flex-shrink: 0;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--dk-blue); color: #fff;
      font-size: var(--f-xs); font-weight: var(--w-7);
    }
    .parada__nombre { flex: 1; min-width: 0; font-size: var(--f-sm); color: var(--t-100); }
    .parada__subir { transform: rotate(180deg); }

    .ruta-resumen {
      display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap;
      margin-top: var(--sp-3); padding: var(--sp-2) var(--sp-3);
      border-radius: var(--r-md); background: var(--c-accent-lo);
      color: var(--dk-blue); font-size: var(--f-sm);
    }
    .ruta-resumen span { color: var(--t-400); }

    .mapa-trayecto {
      height: 320px; margin-top: var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-lg); overflow: hidden;
    }

    /* ══ REJILLA DE SERVICIOS VETERINARIOS ════════════════════════════ */
    /* Tarjetas y no un desplegable: una clínica marca de un vistazo los ocho o
       diez actos que vende, y con un select los elegía de uno en uno. */
    .serv-grid {
      display: grid; gap: var(--sp-3);
      grid-template-columns: repeat(4, 1fr);
      @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 860px)  { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 560px)  { grid-template-columns: 1fr; }
    }

    .serv {
      display: flex; align-items: flex-start; gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4); min-height: 74px;
      border: 1.5px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card); text-align: left; font: inherit; cursor: pointer;
      transition: border-color var(--d-2), background var(--d-2);
      &:hover { border-color: var(--dk-blue); }
    }
    .serv--on { border-color: var(--dk-blue); background: var(--c-accent-lo); }
    .serv__ico { color: var(--dk-blue); flex-shrink: 0; display: flex; padding-top: 2px; }
    .serv__cuerpo { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .serv__label { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); line-height: 1.3; }
    .serv__base { font-size: var(--f-xs); color: var(--t-400); }

    .serv__check {
      width: 18px; height: 18px; flex-shrink: 0;
      border: 1.5px solid var(--b-1); border-radius: var(--r-sm);
      display: grid; place-items: center; color: #fff;
    }
    .serv--on .serv__check { background: var(--dk-blue); border-color: var(--dk-blue); }

    .serv--nuevo {
      align-items: center; justify-content: center; gap: var(--sp-2);
      border-style: dashed; color: var(--dk-blue);
      font-size: var(--f-sm); font-weight: var(--w-6);
    }

    .row-card__cab {
      display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
      font-size: var(--f-sm); color: var(--t-100);
    }

    /* Cada vacuna y cada tramo de peso llevan su importe: el cliente reserva
       «vacuna de la rabia — 32 €», no «vacunación». */
    .variantes { display: flex; flex-direction: column; gap: var(--sp-2); }
    .variante { display: flex; align-items: center; gap: var(--sp-2); }
    .variante__nombre { flex: 1; min-width: 0; }
    .variante__precio { width: 110px; flex-shrink: 0; }

    /* ══ CUENTA DE FOTOS ══════════════════════════════════════════════ */
    /* El mínimo se dice mientras se suben, no al intentar publicar: enterarse
       al final obliga a rehacer el recorrido. */
    .fotos-cuenta {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-3); padding: var(--sp-2) var(--sp-3);
      border-radius: var(--r-md);
      background: var(--c-raised); color: var(--t-400);
      font-size: var(--f-sm); font-weight: var(--w-6);
    }
    .fotos-cuenta--ok { background: var(--c-accent-lo); color: var(--dk-blue); }
    .fotos-servicio { margin-top: var(--sp-6); }

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
      .form-card { padding: var(--sp-5); }

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
  private readonly geoService = inject(GeoService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exitoMsg = signal('');

  readonly verticales = VERTICALES;
  readonly servicioId = signal<string | null>(null);
  readonly esEdicion = computed(() => this.servicioId() !== null);

  /**
   * El formulario va empotrado en el alta guiada (`/comercio/alta`).
   *
   * Cambia el marco, no el contenido: el asistente ya pone su propia cabecera y
   * su barra de avance, la categoría llega elegida del paso anterior y al
   * terminar no se navega a «Mis servicios» —el alta sigue con los datos del
   * negocio—, sino que se avisa al asistente.
   */
  readonly modoAlta = input(false);

  /** Categoría con la que arranca el formulario en el alta guiada. */
  readonly verticalInicial = input<string | null>(null);

  /** Servicio creado; lo escucha el asistente para pasar al paso siguiente. */
  readonly creado = output<void>();

  /** Volver a elegir categoría, dentro del alta guiada. */
  readonly volverAtras = output<void>();

  textoBotonFinal(): string {
    if (this.esEdicion()) return 'Guardar cambios';
    return this.modoAlta() ? 'Guardar y continuar' : 'Crear servicio';
  }

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

  // ── Fotos ────────────────────────────────────────────────────────────

  /**
   * Cambia con cada tecleo del formulario. Los `FormArray` no son señales, así
   * que sin este contador las cuentas de fotos se quedarían congeladas en el
   * valor que tuvieran al pintar.
   */
  private readonly versionFormulario = signal(0);

  /** Residencias y hoteles fotografían la unidad; el resto, el servicio. */
  readonly fotosPorUnidad = computed(() => {
    this.versionFormulario();
    return FOTOS_POR_UNIDAD.includes(this.form.controls.vertical.value);
  });

  /** Las unidades reservables del vertical a la vista, sean suites o habitaciones. */
  private unidadesConFotos(): FormArray {
    return this.form.controls.vertical.value === VerticalKey.HOTELES
      ? this.habitacionesHotel
      : this.espacios;
  }

  /**
   * Fotos de la ficha: sueltas en la mayoría de categorías, y la suma de las de
   * cada unidad en residencias y hoteles, donde no hay galería aparte.
   */
  readonly totalFotos = computed(() => {
    this.versionFormulario();
    if (!this.fotosPorUnidad()) return this.fotosSueltas().length;
    return this.fotosDeLasUnidades().length;
  });

  /** Galería del servicio. Un listado antiguo puede no traerla. */
  private fotosSueltas(): string[] {
    return this.form.controls.imagenes.value ?? [];
  }

  /** Todas las fotos de las unidades, en orden y sin repetir. */
  private fotosDeLasUnidades(): string[] {
    const vistas = new Set<string>();
    for (const unidad of this.unidadesConFotos().controls) {
      for (const url of (unidad.getRawValue() as { imagenes?: string[] }).imagenes ?? []) {
        vistas.add(url);
      }
    }
    return [...vistas];
  }

  readonly fotosSuficientes = computed(() => this.totalFotos() >= MIN_FOTOS);

  mensajeFotos(): string {
    const total = this.totalFotos();
    if (total >= MIN_FOTOS) return `${total} fotos. Ya puedes publicar.`;

    const faltan = MIN_FOTOS - total;
    const sitio = this.fotosPorUnidad() ? ' repartidas entre tus unidades' : '';
    return `${total} de ${MIN_FOTOS} fotos${sitio}: te ${faltan === 1 ? 'falta 1' : 'faltan ' + faltan}.`;
  }

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
    // El paso forma parte del borrador: cambiarlo no dispara `valueChanges`, así
    // que recargar tras avanzar devolvía al primero con los campos ya llenos.
    this.guardarBorrador();
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
  // La escala es la del dominio: si aquí se declara un tamaño que el cliente no
  // puede elegir al reservar, ese espacio no lo reserva nadie.
  readonly tamanosPerro = TAMANOS_PERRO;
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
  /** Etiqueta que abre el campo de texto libre en «Servicios de este espacio». */
  readonly OTROS_SERVICIOS = OTROS_SERVICIOS;

  readonly catalogos = {
    amenitiesAlojamiento: AMENITIES_ALOJAMIENTO,
    amenitiesEspacio: AMENITIES_ESPACIO,
    provincias: PROVINCIAS_ES,
    ciudades: CIUDADES_ES,
    especies: ESPECIES_ATENDIDAS,
    razas: RAZAS_FRECUENTES,
    temperamentos: TEMPERAMENTOS,
    serviciosPetfriendly: SERVICIOS_PETFRIENDLY,
    incluyeFunerario: INCLUYE_FUNERARIO,
  };

  /** Nombres sugeridos en el catálogo de adiestramiento; el campo admite otros. */
  readonly nombresCursos = CURSOS_ADIESTRAMIENTO.map(c => c.nombre);

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

  /** Horario de atención de este servicio y sus días especiales. */
  readonly horario = signal<HorarioDia[]>(semanaVacia());
  readonly excepciones = signal<ExcepcionHorario[]>([]);

  /** Punto que pinta el mapa de comprobación; null sin coordenadas. */
  readonly punto = computed(() => {
    const c = this.coordenadas();
    if (!c) return null;
    const { vertical, titulo } = this.form.getRawValue();
    return { id: 'servicio', lat: c.lat, lng: c.lng, vertical, titulo: titulo || 'Tu servicio' };
  });

  /**
   * Vista del mapa. Va aparte del pin a propósito: sólo se recentra al elegir
   * una dirección o al cargar la ficha, **nunca** al tocar el mapa. Recentrar en
   * cada toque haría saltar el mapa bajo el dedo justo cuando se está afinando
   * el sitio, que es la sensación de que el mapa "se pelea" con el usuario.
   */
  readonly centroMapa = signal<{ lat: number; lng: number; zoom: number } | null>(null);

  /**
   * Al mover el pin, la dirección escrita se reescribe con la del punto nuevo.
   *
   * Es la casilla de Booking, y se puede apagar: un comercio en un polígono o en
   * una finca sin portal necesita clavar el pin donde de verdad se entra sin que
   * el geocodificador le sustituya la dirección por la de la nave de al lado.
   */
  readonly sincronizarPin = signal(true);

  /** Aviso de "el pin está mal": se descarta y no vuelve durante la sesión. */
  readonly avisoPin = signal(true);

  /** Hay una geocodificación inversa en vuelo tras mover el pin. */
  readonly buscandoDireccion = signal(false);

  /**
   * Recoloca el punto donde se ha tocado el mapa y, si la casilla está marcada,
   * reescribe la dirección con la de ese sitio: dejar el pin movido y la calle
   * antigua daría una ficha que se contradice a sí misma.
   */
  async moverPin({ lat, lng }: { lat: number; lng: number }): Promise<void> {
    this.coordenadas.set({ lat, lng });
    this.guardarBorrador();
    if (!this.sincronizarPin()) return;

    this.buscandoDireccion.set(true);
    try {
      const direccion = await this.geoService.direccionDePunto(lat, lng);
      if (direccion) this.aplicarDireccion(direccion);
    } finally {
      this.buscandoDireccion.set(false);
    }
  }

  /**
   * Rellena la dirección con la sugerencia elegida. La calle escrita a mano no
   * trae coordenadas, y sin ellas el servicio no sale en el mapa del buscador.
   */
  usarDireccionSugerida(lugar: LugarElegido): void {
    this.guardarCoordenadas(lugar);

    // Una calle escrita a mano no trae desglose: se respeta lo tecleado en vez
    // de vaciar los campos que el comercio ya hubiera puesto.
    const direccion = lugar.direccion;
    if (direccion) this.aplicarDireccion(direccion);
  }

  /**
   * Vuelca una dirección resuelta en el formulario **sin vaciar lo que ya
   * hubiera**: el geocodificador no siempre devuelve el número, y borrar un
   * "2ºB" que Google no conoce sería peor que dejarlo.
   */
  private aplicarDireccion(direccion: DireccionLugar): void {
    const actual = this.form.getRawValue();
    this.form.patchValue({
      calle: direccion.calle || actual.calle,
      numero: direccion.numero || actual.numero,
      ciudad: direccion.ciudad || actual.ciudad,
      provincia: direccion.provincia || actual.provincia,
      codigoPostal: direccion.codigoPostal || actual.codigoPostal,
      pais: direccion.pais || actual.pais,
    });
  }

  readonly form = this.fb.group({
    vertical:    ['', Validators.required],
    titulo:      ['', [Validators.required, Validators.minLength(3)]],
    descripcion: ['', [Validators.required, Validators.minLength(10)]],
    ciudad:      ['', Validators.required],
    calle:        [''],
    numero:       [''],
    provincia:    [''],
    codigoPostal: [''],
    pais:         ['España'],
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
      precioConsulta: [0, [Validators.required, Validators.min(0)]],
      especiesAtendidas: [['Perro'] as string[]],
    }),

    peluqueria: this.fb.group({
      serviciosGrooming: this.fb.array<FormGroup>([]),
      duracionSlotMin: [60],
      capacidadSimultanea: [2],
      aDomicilio: [false],
      politicaTemperamentoDificil: ['aceptar'],
      bozalObligatorioSiAgresivo: [true],
      serviciosAdicionales: this.fb.array<FormGroup>([]),
      razasEspecificas: [[] as string[]],
      requiereVacunasAlDia: [true],
      requiereMicrochip: [true],
    }),

    // El catálogo de cursos es lo único que declara el centro: modalidad, precio
    // por sesión, edad mínima, capacidad y servicio a domicilio se derivan de él
    // al guardar (ver `detalleVertical`), así que no tienen control propio.
    adiestramiento: this.fb.group({
      serviciosAdiestramiento: this.fb.array<FormGroup>([]),
      valoracionPresencialPrecio: [0],
      valoracionOnlinePrecio: [0],
      valoracionDomicilioPrecio: [0],
    }),

    hoteles: this.fb.group({
      // Sin campo en la ficha: en Doogking todo hotel es pet-friendly. El dato
      // se sigue guardando porque la disponibilidad lo exige para reservar.
      admiteMascotas: [true],
      maxMascotasPorReserva: [0],
      pesoMaximoMascotaKg: [0],
      razasRestringidas: ['ninguna'],
      razasEspecificasRestringidas: [[] as string[]],
      especiesPermitidas: [[] as string[]],
      suplementoPorTamanoMascota: this.fb.array<FormGroup>([]),
      serviciosPetfriendly: [[] as string[]],
      puedeQuedarseSoloEnHabitacion: [true],
      accesoZonasComunes: [true],
      debeIrConCorrea: [true],
      debeLlevarBozalSiCorresponde: [true],
      checkIn: [''],
      checkOut: [''],
      fianza: [0],
      // Las plazas del hotel salen de la suma de sus habitaciones; el comercio
      // ya no las cuenta a mano (`CONTADOR_DISPONIBILIDAD` en el API).
      espacios: this.fb.array<FormGroup>([]),
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

    funerarios: this.fb.group({
      serviciosFunerarios: this.fb.array<FormGroup>([]),
      extras: this.fb.array<FormGroup>([]),
      zonasRecogida: this.fb.array<FormGroup>([]),
      ofreceRecogida: [true],
      lugaresRecogida: [[LugarRecogida.DOMICILIO, LugarRecogida.VETERINARIO] as string[]],
      radioRecogidaKm: [25, [Validators.min(0)]],
      modoPrecioRecogida: [ModoPrecioRecogida.FIJA as string],
      precioRecogida: [0, [Validators.min(0)]],
      precioRecogidaPorKm: [0, [Validators.min(0)]],
      servicioUrgente: [false],
      atiende24h: [false],
      suplementoUrgencia: [0, [Validators.min(0)]],
      franjasDisponibles: [[FranjaHoraria.MANANA, FranjaHoraria.TARDE] as string[]],
      cuposDisponibles: [1, [Validators.required, Validators.min(0)]],
      reembolsoAntesRecogidaPct: [100, [Validators.min(0), Validators.max(100)]],
      reembolsoIniciadoPct: [0, [Validators.min(0), Validators.max(100)]],
      notasCancelacion: [''],
      declaraAutorizaciones: [false],
      cremacionPropia: [true],
      terceroCrematorio: [''],
    }),
  });

  get alojamientoGroup(): FormGroup { return this.form.controls.alojamiento; }
  get transporteGroup(): FormGroup { return this.form.controls.transporte; }
  get veterinariaGroup(): FormGroup { return this.form.controls.veterinaria; }
  get peluqueriaGroup(): FormGroup { return this.form.controls.peluqueria; }
  get adiestramientoGroup(): FormGroup { return this.form.controls.adiestramiento; }
  get hotelesGroup(): FormGroup { return this.form.controls.hoteles; }
  get segurosGroup(): FormGroup { return this.form.controls.seguros; }
  get funerariosGroup(): FormGroup { return this.form.controls.funerarios; }
  get serviciosAdiestramiento(): FormArray { return this.adiestramientoGroup.get('serviciosAdiestramiento') as FormArray; }
  get serviciosFunerarios(): FormArray { return this.funerariosGroup.get('serviciosFunerarios') as FormArray; }
  get extrasFunerarios(): FormArray { return this.funerariosGroup.get('extras') as FormArray; }
  get zonasRecogida(): FormArray { return this.funerariosGroup.get('zonasRecogida') as FormArray; }

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
      imagenes: [(e?.['imagenes'] as string[] | undefined) ?? []],
      disponible: [(e?.['disponible'] as boolean) ?? true],
      cancelacionGratis: [(e?.['cancelacionGratis'] as boolean) ?? true],
    });
  }

  agregarEspacio(): void { this.espacios.push(this.nuevoEspacio()); }
  quitarEspacio(i: number): void { this.espacios.removeAt(i); }

  // ── Habitaciones del hotel ───────────────────────────────────────────

  get habitacionesHotel(): FormArray { return this.hotelesGroup.get('espacios') as FormArray; }

  private nuevaHabitacionHotel(e?: Record<string, unknown>) {
    return this.fb.group({
      tipo: [(e?.['tipo'] as string) ?? ''],
      descripcion: [(e?.['descripcion'] as string) ?? ''],
      precioNoche: [(e?.['precioNoche'] as number) ?? 0],
      cantidad: [(e?.['cantidad'] as number) ?? 1],
      imagenes: [(e?.['imagenes'] as string[] | undefined) ?? []],
      disponible: [(e?.['disponible'] as boolean) ?? true],
    });
  }

  agregarHabitacionHotel(): void { this.habitacionesHotel.push(this.nuevaHabitacionHotel()); }
  quitarHabitacionHotel(i: number): void { this.habitacionesHotel.removeAt(i); }

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
    // Fichas anteriores solo guardaban minutos; y el tipo «valoración» vive
    // ahora en su propia sección, así que esas filas pasan a «especial».
    const unidad = (e?.['duracionUnidad'] as UnidadDuracion | undefined) ?? 'minutos';
    const valor = (e?.['duracionValor'] as number | undefined)
      ?? (e?.['duracionMin'] as number | undefined)
      ?? 60;
    const tipo = (e?.['tipo'] as string) ?? 'individual';
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      tipo: [tipo === 'valoracion' ? 'especial' : tipo],
      precio: [(e?.['precio'] as number) ?? 0],
      duracionValor: [valor],
      duracionUnidad: [unidad],
      maxPerros: [(e?.['maxPerros'] as number) ?? 1],
      edadMinimaMeses: [(e?.['edadMinimaMeses'] as number) ?? 0],
      edadMaximaMeses: [(e?.['edadMaximaMeses'] as number) ?? 0],
      lugar: [(e?.['lugar'] as string) ?? 'centro'],
      materialNecesario: [(e?.['materialNecesario'] as string) ?? ''],
    });
  }

  /**
   * Tipos de adiestramiento que declara la ficha. El buscador ordena por este
   * vocabulario (TIPOS_ADIESTRAMIENTO), no por el nombre comercial del curso:
   * los cursos del catálogo se traducen y los de nombre propio se dejan tal cual.
   */
  private tiposDesdeCatalogo(servicios: ReadonlyArray<{ nombre: string }>): string[] {
    const tipos = servicios
      .map(s => (s.nombre ?? '').trim())
      .filter(nombre => nombre.length > 0)
      .map(nombre => CURSOS_ADIESTRAMIENTO.find(c => c.nombre === nombre)?.tipo ?? nombre);
    return [...new Set(tipos)];
  }

  private nuevoServicioFunerario(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      // Sin campo en la ficha: se deduce del nombre al guardar
      // (`tipoDesdeNombreFunerario`) y es lo que filtra el buscador.
      tipo: [(e?.['tipo'] as string) ?? TipoServicioFunerario.OTROS],
      descripcion: [(e?.['descripcion'] as string) ?? ''],
      incluye: [(e?.['incluye'] as string[] | undefined) ?? []],
      precioBase: [(e?.['precioBase'] as number) ?? 0],
      tiempoEstimadoHoras: [(e?.['tiempoEstimadoHoras'] as number) ?? 48],
      // La cremación individual devuelve cenizas; la colectiva, no. Se marca por
      // defecto lo que es cierto en la mayoría de los casos, pero manda la empresa.
      devuelveCenizas: [(e?.['devuelveCenizas'] as boolean) ?? true],
      urnaIncluida: [(e?.['urnaIncluida'] as boolean) ?? false],
      certificadoIncluido: [(e?.['certificadoIncluido'] as boolean) ?? false],
      activo: [(e?.['activo'] as boolean) ?? true],
      tramosPeso: this.fb.array<FormGroup>(
        ((e?.['tramosPeso'] as Record<string, unknown>[] | undefined) ?? [])
          .map((t) => this.nuevoTramoPeso(t)),
      ),
    });
  }

  agregarServicioFunerario(): void { this.serviciosFunerarios.push(this.nuevoServicioFunerario()); }
  quitarServicioFunerario(i: number): void { this.serviciosFunerarios.removeAt(i); }

  private nuevoTramoPeso(t?: Record<string, unknown>) {
    return this.fb.group({
      hastaKg: [(t?.['hastaKg'] as number) ?? 10],
      precio: [(t?.['precio'] as number) ?? 0],
    });
  }

  tramosPeso(rowIndex: number): FormArray {
    return this.serviciosFunerarios.at(rowIndex).get('tramosPeso') as FormArray;
  }
  agregarTramoPeso(rowIndex: number): void { this.tramosPeso(rowIndex).push(this.nuevoTramoPeso()); }
  quitarTramoPeso(rowIndex: number, i: number): void { this.tramosPeso(rowIndex).removeAt(i); }

  private nuevoExtraFunerario(e?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
      descripcion: [(e?.['descripcion'] as string) ?? ''],
      activo: [(e?.['activo'] as boolean) ?? true],
    });
  }

  agregarExtraFunerario(): void { this.extrasFunerarios.push(this.nuevoExtraFunerario()); }
  quitarExtraFunerario(i: number): void { this.extrasFunerarios.removeAt(i); }

  private nuevaZonaRecogida(z?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(z?.['nombre'] as string) ?? ''],
      precio: [(z?.['precio'] as number) ?? 0],
    });
  }

  agregarZonaRecogida(): void { this.zonasRecogida.push(this.nuevaZonaRecogida()); }
  quitarZonaRecogida(i: number): void { this.zonasRecogida.removeAt(i); }

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

  // ── Servicios funerarios ───────────────────────────────────────────
  readonly lugaresRecogida = Object.values(LugarRecogida)
    .map((valor) => ({ valor: valor as string, label: LUGAR_RECOGIDA_LABELS[valor] }));

  readonly modosPrecioRecogida = Object.values(ModoPrecioRecogida)
    .map((valor) => ({ valor: valor as string, label: MODO_PRECIO_RECOGIDA_LABELS[valor] }));

  readonly franjasHorarias = Object.values(FranjaHoraria)
    .map((valor) => ({ valor: valor as string, label: FRANJA_HORARIA_LABELS[valor] }));

  /** Nombres sugeridos del sector; el campo admite escribir el propio. */
  readonly nombresServiciosFunerarios: readonly string[] = Object.values(TipoServicioFunerario)
    .filter((t) => t !== TipoServicioFunerario.OTROS)
    .map((t) => TIPO_SERVICIO_FUNERARIO_LABELS[t]);

  /**
   * El tipo se deduce del nombre y no se pregunta: las opciones del
   * desplegable de nombres **son** los tipos, así que pedir las dos cosas era
   * pedir dos veces lo mismo. Un servicio con nombre propio cuenta como "otros".
   */
  private tipoDesdeNombreFunerario(nombre: string): TipoServicioFunerario {
    const limpio = (nombre ?? '').trim().toLowerCase();
    const encontrado = Object.values(TipoServicioFunerario)
      .find((t) => TIPO_SERVICIO_FUNERARIO_LABELS[t].toLowerCase() === limpio);
    return encontrado ?? TipoServicioFunerario.OTROS;
  }

  tieneLugarRecogida(v: string): boolean { return this.listaFunerario('lugaresRecogida').includes(v); }
  toggleLugarRecogida(v: string): void { this.alternarEnLista('lugaresRecogida', v); }
  tieneFranja(v: string): boolean { return this.listaFunerario('franjasDisponibles').includes(v); }
  toggleFranja(v: string): void { this.alternarEnLista('franjasDisponibles', v); }

  /** Lista de valores marcados de un control del grupo funerario. */
  private listaFunerario(control: string): string[] {
    return (this.funerariosGroup.get(control)?.value as string[] | undefined) ?? [];
  }

  private alternarEnLista(control: string, valor: string): void {
    const actual = this.listaFunerario(control);
    const siguiente = actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor];
    this.funerariosGroup.get(control)?.setValue(siguiente);
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

    const entrada = tipo ? catalogoClinicoDe(tipo) : undefined;
    const modo = (e?.['modoPrecio'] as ModoPrecioClinico | undefined)
      ?? entrada?.modosPrecio[0] ?? ModoPrecioClinico.FIJO;

    const variantes = (e?.['variantes'] as Record<string, unknown>[] | undefined)
      ?? this.variantesPropuestas(entrada, modo);

    return this.fb.group({
      tipo: [tipo ?? '', Validators.required],
      nombre: [(e?.['nombre'] as string) ?? ''],
      precio: [(e?.['precio'] as number) ?? 0],
      duracionMin: [(e?.['duracionMin'] as number) ?? 30],
      // Todo lo del catálogo tiene precio cerrado o calculable: es la condición
      // para poder publicarlo (regla de oro de `veterinarios.md`).
      esPrecioCerrado: [(e?.['esPrecioCerrado'] as boolean) ?? true],
      modoPrecio: [modo],
      variantes: this.fb.array(variantes.map((v) => this.nuevaVarianteClinica(v))),
      incluye: [(e?.['incluye'] as string) ?? ''],
      noIncluye: [(e?.['noIncluye'] as string) ?? ''],
      complementos: this.fb.array(
        ((e?.['complementos'] as Record<string, unknown>[] | undefined) ?? [])
          .map((c) => this.nuevaVarianteClinica(c)),
      ),
    });
  }


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

  // ── Cobertura y trayecto del transportista ───────────────────────────

  /**
   * Paradas de la ruta habitual del transportista.
   *
   * Va en una señal y no en el formulario reactivo porque no son campos que se
   * teclean: se eligen del buscador de lugares, que ya devuelve el nombre y las
   * coordenadas resueltas.
   */
  readonly trayecto = signal<ParadaTrayecto[]>([]);

  /** Lo que mide el trayecto ya trazado; lo rellena el mapa. */
  readonly rutaTrazada = signal<ResumenRuta | null>(null);

  /**
   * Campo donde se escribe la siguiente dirección. Se vacía al añadirla: si se
   * quedara la anterior escrita, teclear la siguiente obligaría a borrarla a
   * mano cada vez.
   */
  readonly direccionParada = this.fb.control('');

  /**
   * El trazado de rutas admite un número limitado de puntos intermedios; pasarse
   * devolvería un error y dejaría el trayecto sin dibujar, así que se corta antes.
   */
  readonly trayectoLleno = computed(() =>
    this.trayecto().length >= MAX_PARADAS_INTERMEDIAS + 2);

  duracionLegible(minutos: number): string {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return resto ? `${horas} h ${resto} min` : `${horas} h`;
  }

  anadirParada(lugar: LugarElegido): void {
    const nombre = this.nombreDeParada(lugar);
    // Sin coordenadas no se puede dibujar, y una parada que no sale en el mapa
    // no es una parada: es una línea de texto que nadie mira.
    if (!nombre || !Number.isFinite(lugar.lat) || !Number.isFinite(lugar.lng)) return;
    if (this.trayectoLleno()) return;

    this.trayecto.update((paradas) => [
      ...paradas,
      { nombre, lat: lugar.lat, lng: lugar.lng, placeId: lugar.placeId },
    ]);
    this.direccionParada.setValue('');
    this.guardarCambioSuelto();
  }

  /**
   * Cómo se llama la parada en la lista.
   *
   * Se prefiere la dirección formateada: entre dos recogidas de la misma ciudad
   * la calle es lo único que las distingue. Si Places no devolvió el detalle se
   * compone con lo que haya, y en último caso queda la población.
   */
  private nombreDeParada(lugar: LugarElegido): string {
    const d = lugar.direccion;
    if (d?.formateada?.trim()) return d.formateada.trim();

    const compuesta = [[d?.calle, d?.numero].filter(Boolean).join(' '), d?.ciudad ?? lugar.ciudad]
      .filter((parte) => parte?.trim())
      .join(', ');
    return compuesta.trim();
  }

  quitarParada(i: number): void {
    this.trayecto.update((paradas) => paradas.filter((_, j) => j !== i));
    this.guardarCambioSuelto();
  }

  /** El orden es el recorrido: mover una parada cambia por dónde se pasa antes. */
  subirParada(i: number): void { this.moverParada(i, i - 1); }
  bajarParada(i: number): void { this.moverParada(i, i + 1); }

  private moverParada(desde: number, hasta: number): void {
    this.trayecto.update((paradas) => {
      if (hasta < 0 || hasta >= paradas.length) return paradas;
      const movidas = [...paradas];
      [movidas[desde], movidas[hasta]] = [movidas[hasta], movidas[desde]];
      return movidas;
    });
    this.guardarCambioSuelto();
  }

  /** Pines numerados de las paradas, para saber cuál es cuál sobre la línea. */
  readonly pinesTrayecto = computed<PuntoMapa[]>(() =>
    this.trayecto().map((parada, i) => ({
      id: `parada-${i}`,
      lat: parada.lat,
      lng: parada.lng,
      titulo: parada.nombre,
      etiqueta: String(i + 1),
      vertical: VerticalKey.TRANSPORTE,
    })));

  readonly lineaTrayecto = computed<PuntoRuta[]>(() =>
    this.trayecto().map(({ lat, lng }) => ({ lat, lng })));

  // ── Rejilla de servicios veterinarios ────────────────────────────────

  /**
   * Lo que se ofrece marcar. Al final se añade lo que el listado ya tuviera y
   * el catálogo no contemple —un servicio de una versión anterior—, para que al
   * editar siga viéndose y no se pierda al guardar.
   */
  readonly catalogoClinico = computed<readonly ServicioClinicoCatalogo[]>(() => {
    this.versionFormulario();
    const enCatalogo = new Set(SERVICIO_CLINICO_CATALOGO.map((s) => s.tipo));
    const heredados = this.serviciosClinicos.controls
      .map((c) => (c.getRawValue() as { tipo?: ServicioClinicoTipo }).tipo)
      .filter((tipo): tipo is ServicioClinicoTipo =>
        !!tipo && tipo !== ServicioClinicoTipo.OTRO && !enCatalogo.has(tipo));

    if (!heredados.length) return SERVICIO_CLINICO_CATALOGO;

    return [
      ...SERVICIO_CLINICO_CATALOGO,
      ...[...new Set(heredados)].map((tipo) => ({
        tipo, label: SERVICIO_CLINICO_LABELS[tipo], base: 'Servicio ya publicado',
        icono: 'stethoscope', modosPrecio: [ModoPrecioClinico.FIJO],
      })),
    ];
  });

  private indiceDelTipo(tipo: ServicioClinicoTipo): number {
    return this.serviciosClinicos.controls
      .findIndex((c) => (c.getRawValue() as { tipo?: string }).tipo === tipo);
  }

  tieneServicioClinico(tipo: ServicioClinicoTipo): boolean {
    this.versionFormulario();
    return this.indiceDelTipo(tipo) >= 0;
  }

  /** Marcar la tarjeta añade su fila de precio; desmarcarla la quita. */
  alternarServicioClinico(tipo: ServicioClinicoTipo): void {
    const indice = this.indiceDelTipo(tipo);
    if (indice >= 0) this.serviciosClinicos.removeAt(indice);
    else this.serviciosClinicos.push(this.nuevoServicioClinico({ tipo }));
    this.versionFormulario.update((v) => v + 1);
  }

  /** Una clínica puede tener un procedimiento tarifado que el catálogo no trae. */
  agregarServicioLibre(): void {
    this.serviciosClinicos.push(this.nuevoServicioClinico({ tipo: ServicioClinicoTipo.OTRO }));
    this.versionFormulario.update((v) => v + 1);
  }

  esServicioLibre(i: number): boolean {
    return this.tipoEnLaFila(i) === ServicioClinicoTipo.OTRO;
  }

  private tipoEnLaFila(i: number): ServicioClinicoTipo | undefined {
    return (this.serviciosClinicos.at(i)?.getRawValue() as { tipo?: ServicioClinicoTipo }).tipo
      || undefined;
  }

  private entradaDeLaFila(i: number): ServicioClinicoCatalogo | undefined {
    const tipo = this.tipoEnLaFila(i);
    return tipo ? catalogoClinicoDe(tipo) : undefined;
  }

  nombreServicioClinico(i: number): string {
    const fila = this.serviciosClinicos.at(i).getRawValue() as { tipo?: ServicioClinicoTipo; nombre?: string };
    if (fila.tipo === ServicioClinicoTipo.OTRO) return fila.nombre?.trim() || 'Otro servicio';
    return fila.tipo ? SERVICIO_CLINICO_LABELS[fila.tipo] : 'Servicio';
  }

  modosPrecioDe(i: number): readonly ModoPrecioClinico[] {
    return this.entradaDeLaFila(i)?.modosPrecio ?? [ModoPrecioClinico.FIJO];
  }

  etiquetaModoPrecio(modo: ModoPrecioClinico): string {
    return ETIQUETA_MODO_PRECIO[modo] ?? modo;
  }

  private modoDeLaFila(i: number): ModoPrecioClinico {
    return (this.serviciosClinicos.at(i).getRawValue() as { modoPrecio?: ModoPrecioClinico })
      .modoPrecio ?? ModoPrecioClinico.FIJO;
  }

  cobraPorVariantes(i: number): boolean {
    this.versionFormulario();
    const modo = this.modoDeLaFila(i);
    return modo === ModoPrecioClinico.POR_VARIANTE || modo === ModoPrecioClinico.POR_PESO;
  }

  detallaAlcance(i: number): boolean {
    return this.entradaDeLaFila(i)?.detallaAlcance === true;
  }

  tituloVariantes(i: number): string {
    return this.modoDeLaFila(i) === ModoPrecioClinico.POR_PESO
      ? 'Precio por tramo de peso'
      : '¿Qué tipos ofreces, y a qué precio?';
  }

  textoAnadirVariante(i: number): string {
    return this.modoDeLaFila(i) === ModoPrecioClinico.POR_PESO ? 'Añadir tramo' : 'Añadir tipo';
  }

  variantesDe(i: number): FormArray {
    return this.serviciosClinicos.at(i).get('variantes') as FormArray;
  }

  complementosDe(i: number): FormArray {
    return this.serviciosClinicos.at(i).get('complementos') as FormArray;
  }

  agregarVariante(i: number): void { this.variantesDe(i).push(this.nuevaVarianteClinica()); }
  quitarVariante(i: number, j: number): void { this.variantesDe(i).removeAt(j); }
  agregarComplemento(i: number): void { this.complementosDe(i).push(this.nuevaVarianteClinica()); }
  quitarComplemento(i: number, j: number): void { this.complementosDe(i).removeAt(j); }

  /**
   * Cambiar de forma de cobrar rehace la lista: pasar a tramos de peso con las
   * vacunas escritas dentro no tendría sentido, y dejarla vacía obligaría a
   * teclear los cuatro tramos a mano.
   */
  modoPrecioCambiado(i: number): void {
    const variantes = this.variantesDe(i);
    const escritas = variantes.controls
      .some((v) => (v.getRawValue() as { nombre?: string }).nombre?.trim());
    if (escritas) return;

    variantes.clear();
    for (const v of this.variantesPropuestas(this.entradaDeLaFila(i), this.modoDeLaFila(i))) {
      variantes.push(this.nuevaVarianteClinica(v));
    }
    this.versionFormulario.update((n) => n + 1);
  }

  /** Nombres de partida para no arrancar con la lista en blanco. */
  private variantesPropuestas(
    entrada: ServicioClinicoCatalogo | undefined, modo: ModoPrecioClinico,
  ): Record<string, unknown>[] {
    const porVariantes = modo === ModoPrecioClinico.POR_VARIANTE || modo === ModoPrecioClinico.POR_PESO;
    if (!porVariantes) return [];
    return (entrada?.variantes ?? []).map((nombre) => ({ nombre, precio: 0 }));
  }

  private nuevaVarianteClinica(v?: Record<string, unknown>) {
    return this.fb.group({
      nombre: [(v?.['nombre'] as string) ?? ''],
      precio: [(v?.['precio'] as number) ?? 0],
    });
  }

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
  /** Persiste lo que cambia fuera del formulario reactivo: horario, pin, fotos. */
  guardarCambioSuelto(): void {
    this.guardarBorrador();
  }

  guardarCoordenadas(lugar: LugarElegido): void {
    const valido = Number.isFinite(lugar.lat) && Number.isFinite(lugar.lng);
    if (!valido) { this.coordenadas.set(null); return; }

    this.coordenadas.set({ lat: lugar.lat, lng: lugar.lng });
    // Elegir del desplegable sí recentra: es el momento en que el usuario pide
    // ver otro sitio. Una población se enseña más abierta que un portal.
    const zoom = lugar.direccion ? ZOOM_PORTAL : ZOOM_POBLACION;
    this.centroMapa.set({ lat: lugar.lat, lng: lugar.lng, zoom });
    this.guardarBorrador();
  }

  tieneCoordenadas(): boolean {
    return this.coordenadas() !== null;
  }

  /**
   * Borrador del alta guardado en el dispositivo.
   *
   * Rellenar la ficha de un servicio lleva veinte campos y varias fotos: una
   * recarga, un móvil que descarta la pestaña o un toque de «atrás» del
   * navegador tiraban todo el trabajo. Va por usuario para que dos cuentas del
   * mismo ordenador no se pisen el borrador.
   *
   * Sólo en el **alta**: al editar manda lo que hay guardado en el servidor, y
   * restaurar un borrador encima sería resucitar cambios que se descartaron.
   */
  private claveBorrador(): string {
    return `dk_borrador_servicio_${this.auth.usuario()?.id ?? 'anon'}`;
  }

  /** Todo lo que hace falta para reconstruir el formulario tal cual estaba. */
  private instantanea(): Record<string, unknown> {
    const vertical = this.form.getRawValue().vertical;
    return {
      ...this.form.getRawValue(),
      paso: this.paso(),
      coordenadas: this.coordenadas(),
      horario: this.horario(),
      excepciones: this.excepciones(),
      aptitud: {
        tamanosAdmitidos: this.tamanosSeleccionados(),
        tipoPeloAdmitido: this.pelosSeleccionados(),
        temperamentosNoAdmitidos: this.temperamentosNoAdmitidos,
      },
      // Se guarda ya en forma de payload: `precargarVertical` sabe leerlo, así
      // que restaurar reutiliza el mismo camino que la edición.
      extra: vertical ? this.construirDetalleVertical(vertical) : null,
    };
  }

  private guardarBorrador(): void {
    if (this.esEdicion()) return;
    try {
      localStorage.setItem(this.claveBorrador(), JSON.stringify(this.instantanea()));
    } catch {
      // Sin espacio o en modo privado: el borrador es una comodidad, no se
      // interrumpe el alta por no poder guardarlo.
    }
  }

  private descartarBorrador(): void {
    try {
      localStorage.removeItem(this.claveBorrador());
    } catch { /* nada que descartar si no hay storage */ }
  }

  /** @returns `true` si había un borrador y se aplicó. */
  private restaurarBorrador(): boolean {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(this.claveBorrador());
    } catch { return false; }
    if (!guardado) return false;

    try {
      const b = JSON.parse(guardado) as Record<string, unknown>;
      const vertical = (b['vertical'] as string) ?? '';
      // El alta guiada llega con su categoría ya elegida; si el borrador es de
      // otra, no es el mismo alta y arrancar mezclando las dos sería peor.
      const fijada = this.verticalInicial();
      if (fijada && vertical && vertical !== fijada) return false;

      this.form.patchValue(b as never);
      if (vertical) this.precargarVertical(vertical, (b['extra'] as Record<string, unknown>) ?? undefined);

      const punto = b['coordenadas'] as { lat: number; lng: number } | null;
      if (punto) {
        this.coordenadas.set(punto);
        this.centroMapa.set({ ...punto, zoom: ZOOM_PORTAL });
      }
      const horario = b['horario'] as HorarioDia[] | undefined;
      if (horario?.length) this.horario.set(horario);
      this.excepciones.set((b['excepciones'] as ExcepcionHorario[]) ?? []);

      const aptitud = (b['aptitud'] ?? {}) as Record<string, string[] | undefined>;
      this.tamanosSeleccionados.set(aptitud['tamanosAdmitidos'] ?? []);
      this.pelosSeleccionados.set(aptitud['tipoPeloAdmitido'] ?? []);
      this.temperamentosNoAdmitidos = aptitud['temperamentosNoAdmitidos'] ?? [];

      // Un borrador guardado cuando las fotos eran un paso aparte trae un paso
      // que ya no existe: se abre el último, que es donde estaba a punto de
      // terminar.
      const pasoBorrador = b['paso'] as PasoListado | undefined;
      const paso = pasoBorrador && !PASOS.some((x) => x.clave === pasoBorrador)
        ? PASOS[PASOS.length - 1].clave
        : pasoBorrador;
      if (paso) {
        // Se abre el paso donde se quedó, y se dan por buenos los anteriores:
        // ya los había pasado antes de recargar.
        this.pasoMaximo.set(Math.max(0, PASOS.findIndex((p) => p.clave === paso)));
        this.paso.set(paso);
      }
      this.borradorRestaurado.set(true);
      return true;
    } catch {
      // Borrador de una versión anterior del formulario: se descarta antes de
      // dejar el alta a medio construir.
      this.descartarBorrador();
      return false;
    }
  }

  /** Se enseña una vez, para que nadie crea que el formulario se ha liado solo. */
  readonly borradorRestaurado = signal(false);

  /** Tira el borrador y deja el formulario en blanco. */
  empezarDeCero(): void {
    this.descartarBorrador();
    window.location.reload();
  }

  async ngOnInit(): Promise<void> {
    // Las cuentas de fotos leen `FormArray`, que no son señales: sin esto se
    // quedarían con el número que tuvieran al pintar el paso.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.versionFormulario.update((v) => v + 1));

    // Elegir "Seguros" en el desplegable de categoría no sigue por aquí.
    this.form.controls.vertical.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vertical) => this.desviarSiEsSeguros(vertical));

    const inicial = this.verticalInicial();
    if (inicial) {
      // Se eligió en el paso anterior del alta: enseñarla otra vez como un
      // desplegable sería pedir dos veces la misma decisión.
      this.form.controls.vertical.setValue(inicial);
      this.form.controls.vertical.disable();
    }

    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.restaurarBorrador();
      // A partir de aquí cualquier tecleo se guarda; los cambios que no pasan
      // por el formulario (horario, fotos, pin) llaman a `guardarBorrador`
      // desde su propio manejador.
      this.form.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.guardarBorrador());
      return;
    }

    this.servicioId.set(id);
    this.cargando.set(true);
    try {
      const s = await firstValueFrom(this.comercioApi.obtenerServicioGestion(id));
      this.form.patchValue({
        vertical: s.vertical,
        titulo: s.titulo,
        descripcion: s.descripcion,
        ciudad: s.ciudad,
        calle: s.calle ?? '',
        numero: s.numero ?? '',
        provincia: s.provincia ?? '',
        codigoPostal: s.codigoPostal ?? '',
        pais: s.pais ?? 'España',
        precioBase: s.precioBase,
        imagenes: s.imagenes ?? [],
      });
      // Un servicio de antes de que el horario colgara del listado llega sin
      // semana: se le da una en blanco para que el editor tenga los siete días.
      if (s.horario?.length) this.horario.set(s.horario);
      this.excepciones.set(s.excepcionesHorario ?? []);
      // Un listado ya geolocalizado no debe pedir que se vuelva a elegir la
      // población: la pista solo tiene sentido cuando faltan coordenadas.
      if (s.lat != null && s.lng != null) {
        this.coordenadas.set({ lat: s.lat, lng: s.lng });
        this.centroMapa.set({ lat: s.lat, lng: s.lng, zoom: ZOOM_PORTAL });
      }
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
        requisitoMicrochip: d['requisitoMicrochip'] ?? false,
        requiereDesparasitacionInterna: d['requiereDesparasitacionInterna'] ?? false,
        requiereDesparasitacionExterna: d['requiereDesparasitacionExterna'] ?? false,
        requiereVacunaTosPerreras: d['requiereVacunaTosPerreras'] ?? false,
      });
      const lista = (d['espacios'] as Record<string, unknown>[] | undefined) ?? [];
      lista.forEach(e => this.espacios.push(this.nuevoEspacio(e)));
      this.heredarGaleriaEnLaPrimeraUnidad(this.espacios);
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
      this.trayecto.set((d['trayecto'] as ParadaTrayecto[] | undefined) ?? []);
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
      // Fichas anteriores a los precios por modalidad guardaban una sola valoración.
      const legado = d['valoracionInicial'] as Record<string, unknown> | undefined;
      const valoraciones = (d['valoracionesIniciales'] as Record<string, unknown>[] | undefined)
        ?? (legado ? [legado] : []);
      const precioDe = (modalidad: string): number =>
        (valoraciones.find(v => v['modalidad'] === modalidad)?.['precio'] as number | undefined) ?? 0;
      this.adiestramientoGroup.patchValue({
        valoracionPresencialPrecio: precioDe('presencial'),
        valoracionOnlinePrecio: precioDe('online'),
        valoracionDomicilioPrecio: precioDe('domicilio'),
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
      this.cargarHabitacionesHotel(d);
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
    } else if (vertical === VerticalKey.FUNERARIOS) {
      const politica = (d['politicaCancelacionFunerario'] as Record<string, unknown> | undefined) ?? {};
      this.funerariosGroup.patchValue({
        ...d,
        lugaresRecogida: (d['lugaresRecogida'] as string[] | undefined) ?? [],
        franjasDisponibles: (d['franjasDisponibles'] as string[] | undefined) ?? [],
        reembolsoAntesRecogidaPct: politica['reembolsoAntesRecogidaPct'] ?? 100,
        reembolsoIniciadoPct: politica['reembolsoIniciadoPct'] ?? 0,
        notasCancelacion: politica['notas'] ?? '',
      });
      const servicios = (d['serviciosFunerarios'] as Record<string, unknown>[] | undefined) ?? [];
      servicios.forEach((sv) => this.serviciosFunerarios.push(this.nuevoServicioFunerario(sv)));
      const extras = (d['extras'] as Record<string, unknown>[] | undefined) ?? [];
      extras.forEach((e) => this.extrasFunerarios.push(this.nuevoExtraFunerario(e)));
      const zonas = (d['zonasRecogida'] as Record<string, unknown>[] | undefined) ?? [];
      zonas.forEach((z) => this.zonasRecogida.push(this.nuevaZonaRecogida(z)));
    }
  }

  /**
   * Una aseguradora no publica una ficha como las demás categorías: entrega una
   * solicitud con su documentación y Doogking la revisa antes de dejarla entrar
   * (máximo `MAX_ASEGURADORAS`). Por eso, al crear, elegir "Seguros" cambia de
   * pantalla en vez de seguir por este formulario; editando sí se queda, que es
   * cuando el equipo configura coberturas y primas.
   */
  private desviarSiEsSeguros(vertical: string): void {
    if (this.esEdicion() || this.modoAlta() || vertical !== VerticalKey.SEGUROS) return;
    void this.router.navigate(['/comercio/listados/solicitud-seguros']);
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
      return {
        ...this.transporteGroup.getRawValue(),
        trayecto: this.trayecto(),
      };
    }
    if (vertical === VerticalKey.VETERINARIA) {
      const g = this.veterinariaGroup.getRawValue();
      return {
        ...g,
        serviciosClinicos: this.serviciosClinicos.controls.map((_, i) => this.servicioClinicoAGuardar(i)),
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
      const servicios = this.serviciosAdiestramiento.controls.map(c => {
        const v = c.getRawValue();
        return { ...v, duracionMin: enMinutos(v.duracionValor, v.duracionUnidad as UnidadDuracion) };
      });
      const valoraciones = [
        { modalidad: 'presencial', precio: g.valoracionPresencialPrecio },
        { modalidad: 'online', precio: g.valoracionOnlinePrecio },
        { modalidad: 'domicilio', precio: g.valoracionDomicilioPrecio },
      ].filter(v => v.precio > 0);
      const precios = servicios.map(s => s.precio).filter(p => p > 0);
      const edades = servicios.map(s => s.edadMinimaMeses).filter(e => e > 0);
      // La ficha ya no pide los datos sueltos del servicio: se derivan del
      // catálogo de cursos, que es lo único que declara el centro.
      return {
        precioSesion: precios.length ? Math.min(...precios) : this.form.controls.precioBase.value,
        modalidad: servicios.some(s => s.tipo === 'curso') ? 'programa' : 'sesion',
        tiposAdiestramiento: this.tiposDesdeCatalogo(servicios),
        edadMinimaMeses: edades.length ? Math.min(...edades) : 3,
        capacidadPorSesion: Math.max(1, ...servicios.map(s => s.maxPerros || 1)),
        aDomicilio: servicios.some(s => s.lugar === 'domicilio'),
        serviciosAdiestramiento: servicios,
        valoracionesIniciales: valoraciones,
      };
    }
    if (vertical === VerticalKey.HOTELES) {
      const g = this.hotelesGroup.getRawValue();
      return {
        ...g,
        maxMascotasPorReserva: g.maxMascotasPorReserva > 0 ? g.maxMascotasPorReserva : undefined,
        pesoMaximoMascotaKg: g.pesoMaximoMascotaKg > 0 ? g.pesoMaximoMascotaKg : undefined,
        fianza: g.fianza > 0 ? g.fianza : undefined,
        suplementoPorTamanoMascota: this.suplementoPorTamanoMascota.controls.map(c => c.getRawValue()),
        espacios: this.habitacionesHotel.controls.map(c => c.getRawValue()),
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
    if (vertical === VerticalKey.FUNERARIOS) {
      const g = this.funerariosGroup.getRawValue();
      const servicios = this.serviciosFunerarios.controls.map((c) => {
        const v = c.getRawValue();
        // Los tramos se guardan ordenados: la estrategia de precio busca el
        // primero que cubre el peso, y desordenados cobraría el que no es.
        const tramos = [...(v.tramosPeso ?? [])]
          .filter((t: { hastaKg: number; precio: number }) => t.hastaKg > 0)
          .sort((a: { hastaKg: number }, b: { hastaKg: number }) => a.hastaKg - b.hastaKg);
        return { ...v, tipo: this.tipoDesdeNombreFunerario(v.nombre), tramosPeso: tramos };
      });

      return {
        serviciosFunerarios: servicios,
        extras: this.extrasFunerarios.controls.map((c) => c.getRawValue()),
        // El buscador filtra por el tipo de servicio, y ese dato no se pide
        // aparte: es el que ya declara cada línea del catálogo.
        tiposServicioFunerario: [...new Set(servicios.map((sv) => sv.tipo as string))],
        ofreceRecogida: g.ofreceRecogida,
        lugaresRecogida: g.ofreceRecogida ? g.lugaresRecogida : [],
        radioRecogidaKm: g.radioRecogidaKm,
        modoPrecioRecogida: g.modoPrecioRecogida,
        precioRecogida: g.precioRecogida,
        precioRecogidaPorKm: g.precioRecogidaPorKm,
        zonasRecogida: this.zonasRecogida.controls.map((c) => c.getRawValue()),
        servicioUrgente: g.servicioUrgente,
        atiende24h: g.atiende24h,
        suplementoUrgencia: g.suplementoUrgencia,
        franjasDisponibles: g.franjasDisponibles,
        cuposDisponibles: g.cuposDisponibles,
        declaraAutorizaciones: g.declaraAutorizaciones,
        cremacionPropia: g.cremacionPropia,
        terceroCrematorio: g.cremacionPropia ? undefined : (g.terceroCrematorio || undefined),
        politicaCancelacionFunerario: {
          reembolsoAntesRecogidaPct: g.reembolsoAntesRecogidaPct,
          reembolsoIniciadoPct: g.reembolsoIniciadoPct,
          notas: g.notasCancelacion || undefined,
        },
      };
    }
    return null;
  }

  /**
   * Los hoteles antiguos sólo tenían un contador de habitaciones libres. Al
   * editarlos se convierte en un tipo de habitación con esa cantidad, para que
   * el hotel no pierda su inventario ni aparezca de golpe sin plazas.
   */
  private cargarHabitacionesHotel(datos: Record<string, unknown>): void {
    const habitaciones = (datos['espacios'] as Record<string, unknown>[] | undefined) ?? [];
    if (habitaciones.length) {
      habitaciones.forEach((h) => this.habitacionesHotel.push(this.nuevaHabitacionHotel(h)));
      this.heredarGaleriaEnLaPrimeraUnidad(this.habitacionesHotel);
      return;
    }

    const unidades = Number(datos['unidadesDisponibles']) || 0;
    if (unidades <= 0) return;

    this.habitacionesHotel.push(this.nuevaHabitacionHotel({
      tipo: 'Habitación pet-friendly',
      cantidad: unidades,
      precioNoche: this.form.controls.precioBase.value,
      imagenes: this.fotosSueltas(),
    }));
  }

  /**
   * Las fichas publicadas antes de esto tienen su galería en el servicio y las
   * unidades vacías. Al editarlas, esas fotos pasan a la primera unidad: si no,
   * al guardar se reemplazaría la galería por la suma de las unidades —vacía— y
   * el comercio perdería todas sus fotos sin haber tocado nada.
   */
  private heredarGaleriaEnLaPrimeraUnidad(unidades: FormArray): void {
    const galeria = this.fotosSueltas();
    if (!galeria.length || !unidades.length) return;

    const yaTienen = unidades.controls.some(
      (u) => ((u.getRawValue() as { imagenes?: string[] }).imagenes ?? []).length > 0,
    );
    if (yaTienen) return;

    unidades.at(0).patchValue({ imagenes: galeria });
  }

  /**
   * Un servicio clínico tal como se guarda.
   *
   * El nombre sale del catálogo salvo en los añadidos a mano, donde es lo que
   * el comercio escribió. Las filas de variante en blanco se tiran: una lista
   * con «Leishmania — 0 €» que la clínica no ofrece acabaría en el buscador.
   */
  private servicioClinicoAGuardar(i: number): Record<string, unknown> {
    const fila = this.serviciosClinicos.at(i).getRawValue() as Record<string, unknown>;
    const tipo = fila['tipo'] as ServicioClinicoTipo;
    const nombre = tipo === ServicioClinicoTipo.OTRO
      ? String(fila['nombre'] ?? '').trim()
      : SERVICIO_CLINICO_LABELS[tipo] ?? String(fila['nombre'] ?? '');

    const limpiar = (lista: unknown): Array<{ nombre: string; precio: number }> =>
      (lista as Array<{ nombre?: string; precio?: number }> ?? [])
        .filter((v) => v.nombre?.trim())
        .map((v) => ({ nombre: v.nombre!.trim(), precio: Number(v.precio) || 0 }));

    // Las propuestas que la clínica deja a cero no se ofrece: publicar
    // "Leishmania — 0 €" pondría en el buscador algo que no vende.
    const variantes = this.cobraPorVariantes(i)
      ? limpiar(fila['variantes']).filter((v) => v.precio > 0)
      : [];
    const complementos = this.detallaAlcance(i) ? limpiar(fila['complementos']) : [];

    return {
      tipo,
      nombre,
      // Con precio por variante, el «desde» del servicio es la variante más
      // barata: es el número que el cliente compara en la ficha.
      precio: variantes.length
        ? Math.min(...variantes.map((v) => v.precio))
        : Number(fila['precio']) || 0,
      duracionMin: fila['duracionMin'],
      esPrecioCerrado: fila['esPrecioCerrado'],
      modoPrecio: fila['modoPrecio'],
      ...(variantes.length ? { variantes } : {}),
      ...(complementos.length ? { complementos } : {}),
      ...(String(fila['incluye'] ?? '').trim() ? { incluye: String(fila['incluye']).trim() } : {}),
      ...(String(fila['noIncluye'] ?? '').trim() ? { noIncluye: String(fila['noIncluye']).trim() } : {}),
    };
  }

  private validarVertical(vertical: string): string | null {
    if (vertical === VerticalKey.ALOJAMIENTO && this.espacios.length === 0) {
      return 'Añade al menos un tipo de espacio para tu alojamiento.';
    }
    if (vertical === VerticalKey.HOTELES && this.habitacionesHotel.length === 0) {
      return 'Añade al menos un tipo de habitación pet-friendly.';
    }
    if (vertical === VerticalKey.SEGUROS && this.coberturas().length === 0) {
      return 'Marca al menos una cobertura de la póliza.';
    }
    if (vertical === VerticalKey.VETERINARIA) {
      const error = this.validarServiciosClinicos();
      if (error) return error;
    }
    if (vertical === VerticalKey.PELUQUERIA && this.serviciosGrooming.length === 0) {
      return 'Añade al menos un servicio de grooming.';
    }
    if (vertical === VerticalKey.FUNERARIOS) {
      const error = this.validarServiciosFunerarios();
      if (error) return error;
    }
    // Lo último: si además falta un espacio o un servicio, eso es lo que hay
    // que decir primero, porque es lo que estructura la ficha.
    return this.validarFotos();
  }

  /**
   * Sin catálogo no hay nada que contratar, y sin la declaración de
   * autorizaciones no se puede publicar en esta categoría (§10 del brief).
   */
  private validarServiciosFunerarios(): string | null {
    if (this.serviciosFunerarios.length === 0) {
      return 'Añade al menos un servicio (cremación, recogida, entierro…).';
    }
    const sinNombre = this.serviciosFunerarios.controls
      .some((c) => !String(c.get('nombre')?.value ?? '').trim());
    if (sinNombre) return 'Todos los servicios necesitan un nombre.';

    const sinPrecio = this.serviciosFunerarios.controls.some((c) => {
      const tramos = (c.get('tramosPeso') as FormArray).controls;
      const conTramos = tramos.some((t) => Number(t.get('precio')?.value ?? 0) > 0);
      return Number(c.get('precioBase')?.value ?? 0) <= 0 && !conTramos;
    });
    if (sinPrecio) return 'Pon precio a cada servicio, o al menos un tramo de peso con precio.';

    if (!this.funerariosGroup.get('declaraAutorizaciones')?.value) {
      return 'Debes declarar que dispones de las autorizaciones necesarias para prestar estos servicios.';
    }
    if (this.funerariosGroup.get('cremacionPropia')?.value === false
        && !String(this.funerariosGroup.get('terceroCrematorio')?.value ?? '').trim()) {
      return 'Indica con qué empresa trabajas para la cremación.';
    }
    return null;
  }

  /**
   * Regla de oro de la pantalla veterinaria: si el cliente no puede saber
   * cuánto va a pagar antes de acudir, eso no se publica. De ahí que cada
   * servicio elegido tenga que salir de aquí con un importe.
   */
  private validarServiciosClinicos(): string | null {
    if (this.serviciosClinicos.length === 0) {
      return 'Marca al menos un servicio veterinario que tus clientes puedan reservar.';
    }

    for (let i = 0; i < this.serviciosClinicos.length; i++) {
      const servicio = this.servicioClinicoAGuardar(i);
      const nombre = servicio['nombre'] as string;

      if (!nombre) return 'Ponle nombre al servicio que has añadido.';

      if (this.cobraPorVariantes(i) && !(servicio['variantes'] as unknown[] | undefined)?.length) {
        return `Di al menos un tipo con su precio en «${nombre}».`;
      }
      if (!((servicio['precio'] as number) > 0)) {
        return `Ponle precio a «${nombre}»: sin importe no se puede reservar online.`;
      }
    }
    return null;
  }

  /**
   * Sin fotos la ficha no se reserva, así que se corta aquí y no al publicar:
   * enterarse tres pantallas después de que faltaban fotos obliga a rehacer el
   * recorrido entero.
   */
  private validarFotos(): string | null {
    if (this.fotosSuficientes()) return null;

    const donde = this.fotosPorUnidad()
      ? ' Cuentan todas las de tus unidades juntas.'
      : '';
    return `Sube al menos ${MIN_FOTOS} fotos; ahora tienes ${this.totalFotos()}.${donde}`;
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

    const {
      titulo, descripcion, ciudad, calle, numero, provincia, codigoPostal, pais,
      precioBase,
    } = this.form.getRawValue();
    // En residencias y hoteles no hay galería suelta: la portada y el carrusel
    // de la ficha son las fotos de las unidades, sin repetir.
    const imagenes = this.fotosPorUnidad() ? this.fotosDeLasUnidades() : this.fotosSueltas();
    const detalle = this.construirDetalleVertical(vertical);
    const payload: ServicioPayload = {
      ...(this.esEdicion() ? {} : { vertical }),
      titulo, descripcion, ciudad, precioBase, imagenes,
      calle, numero, provincia, codigoPostal, pais,
      horario: this.horario(),
      excepcionesHorario: this.excepciones(),
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
        this.descartarBorrador();
        this.exitoMsg.set('¡Servicio creado en borrador!');
        if (this.modoAlta()) { this.creado.emit(); return; }
      }
      setTimeout(() => void this.router.navigate(['/comercio/listados']), 1200);
    } catch {
      this.errorMsg.set('Error al guardar el servicio. Verifica los datos e intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
