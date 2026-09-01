import { Component, signal, computed, effect, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticoSubidaService } from '../../../core/diagnostico/diagnostico-subida.service';
import { faqDeConfirmacion } from '../../../shared/catalogos/faq-confirmacion.catalogo';
import {
  VerticalKey, VERTICAL_LABELS, IVA_RATE, PasoEmbudo, TipoEvento, TAMANOS_PERRO,
  ESPECIES_FUNERARIO, FranjaHoraria, FRANJA_HORARIA_LABELS, LugarRecogida, LUGAR_RECOGIDA_LABELS,
  ModoPrecioRecogida, UrgenciaFunerario, URGENCIA_FUNERARIO_LABELS,
} from 'shared';
import {
  extrasFunerarios, serviciosFunerarios,
} from '../../../shared/verticales/funerarios.util';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsBrandIconComponent, type MarcaPagoKey } from '../../../shared/components/brand-icon/rs-brand-icon.component';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import {
  LugarElegido, RsPlaceAutocompleteComponent,
} from '../../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { IMG_FALLBACK } from '../../../shared/media/images';
import { RsPhoneInputComponent } from '../../../shared/components/phone-input/rs-phone-input.component';
import {
  RsCalendarioRangoComponent, type MesVisible, type RangoFechas,
} from '../../../shared/components/calendario-rango/rs-calendario-rango.component';
import { GeoService } from '../../../core/geo/geo.service';
import { EventosService } from '../../../core/eventos/eventos.service';
import { StripeService } from '../../../core/stripe/stripe.service';
import { ReservasService } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';
import { CuponesService } from '../services/cupones.service';
import { PerrosService, PerroApi, EstimacionPrecioApi } from '../../perros/perros.service';
import { RecomendadorService, RecomendacionAdiestramiento, RecomendacionVeterinaria } from '../services/recomendador.service';
import { CatalogBrowseService } from '../../verticales/catalog-browse.service';
import type { DiaCalendarioApi } from 'shared';
import type { Stripe, StripeElements } from '@stripe/stripe-js';

import { EurosPipe, euros } from '../../../shared/pipes/euros.pipe';
type Paso = 1 | 2 | 3 | 4;

/**
 * Disponibilidad del paso 1.
 * `idle`: faltan datos o la consulta falló · `comprobando`: en curso ·
 * `ok`: hay hueco · `sin_hueco`: el vertical dice que no, y por qué.
 */
interface EstadoDisponibilidad {
  estado: 'idle' | 'comprobando' | 'ok' | 'sin_hueco';
  motivo?: string;
}

/** Lo que se espera a que el cliente deje de teclear antes de consultar al API. */
const ESPERA_DISPONIBILIDAD_MS = 400;

/** Verticales que se reservan por rango de noches y por tanto tienen calendario. */
const VERTICALES_CON_CALENDARIO: string[] = [VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES];

/** Traducción del número de paso del wizard al paso del embudo medido. */
const PASO_EMBUDO: Record<number, PasoEmbudo> = {
  1: PasoEmbudo.DETALLE,
  2: PasoEmbudo.DATOS,
  3: PasoEmbudo.PAGO,
  4: PasoEmbudo.CONFIRMACION,
};

interface PrecioPorTamanoWizard {
  tamano: string;
  precio: number;
  duracionMin: number;
}

interface ServicioGroomingWizard {
  nombre: string;
  precio: number;
  duracionMin?: number;
  tipoPeloCompatible?: string[];
  preciosPorTamano?: PrecioPorTamanoWizard[];
}

interface ServicioAdicionalWizard {
  nombre: string;
  precio: number;
}

/** Un dato del resumen del viaje de hotel (HU-5.7.2), con su icono Lucide. */
interface ResumenViajeParte {
  icono: string;
  texto: string;
}

/** Detalle enriquecido del servicio de peluquería (Fase C), cargado bajo demanda. */
interface PeluqueriaDetalleWizard {
  serviciosGrooming: ServicioGroomingWizard[];
  politicaTemperamentoDificil: string;
  bozalObligatorioSiAgresivo: boolean;
  serviciosAdicionales: ServicioAdicionalWizard[];
  razasEspecificas: string[];
  requiereVacunasAlDia: boolean;
  requiereMicrochip: boolean;
}

interface ServicioClinicoWizard {
  nombre: string;
  precio: number;
  duracionMin?: number;
  esPrecioCerrado?: boolean;
}

interface ServicioAdiestramientoWizard {
  nombre: string;
  tipo: string;
  precio: number;
  duracionMin?: number;
  maxPerros?: number;
  edadMinimaMeses?: number;
  edadMaximaMeses?: number;
  lugar?: string;
}

interface SuplementoTamanoWizard {
  tamano: string;
  precioPorNoche: number;
}

/** Suplementos del hotel (HU-15.1/15.2), cargados bajo demanda desde el servicio configurado por el comercio. */
interface HotelSuplementosWizard {
  suplementoPorTamanoMascota: SuplementoTamanoWizard[];
  suplementoSegundaMascotaPorNoche: number;
}

const POLITICA_TEMPERAMENTO_LABEL: Record<string, string> = {
  aceptar: 'Acepta perros nerviosos o con temperamento difícil sin condiciones.',
  suplemento: 'Puede aplicar un suplemento si tu perro tiene temperamento difícil.',
  valoracion_previa: 'Requiere una valoración previa si tu perro tiene temperamento difícil.',
  rechazar: 'No atiende perros con temperamento difícil.',
};

@Component({
  selector: 'app-reserva-wizard',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, FormsModule, RsNavbarComponent, RsIconComponent, ImgFallbackDirective, RsPlaceAutocompleteComponent, RsPhoneInputComponent,
    RsBrandIconComponent, RsCalendarioRangoComponent, EurosPipe,],
  template: `
<div class="wizard-page">
  <rs-navbar />

  <div class="wizard-wrap rs-wrap">

    <!-- STEPS INDICATOR -->
    <div class="rs-steps wizard-steps">
      <div class="rs-steps__item" [class.active]="paso() >= 1" [class.done]="paso() > 1">
        <div class="rs-steps__num">@if (paso() > 1) { <rs-icon name="check" [size]="14" [stroke]="3" /> } @else { 1 }</div>
        <span>{{ paso1Label() }}</span>
      </div>
      <div class="rs-steps__line"></div>
      <div class="rs-steps__item" [class.active]="paso() >= 2" [class.done]="paso() > 2">
        <div class="rs-steps__num">@if (paso() > 2) { <rs-icon name="check" [size]="14" [stroke]="3" /> } @else { 2 }</div>
        <span>Tus datos</span>
      </div>
      <div class="rs-steps__line"></div>
      <div class="rs-steps__item" [class.active]="paso() >= 3" [class.done]="paso() > 3">
        <div class="rs-steps__num">@if (paso() > 3) { <rs-icon name="check" [size]="14" [stroke]="3" /> } @else { 3 }</div>
        <span>Pago</span>
      </div>
      <div class="rs-steps__line"></div>
      <div class="rs-steps__item" [class.active]="paso() === 4">
        <div class="rs-steps__num">4</div>
        <span>Confirmación</span>
      </div>
    </div>

    <div class="wizard-body">

      <!-- COLUMNA PRINCIPAL -->
      <div class="wizard-main">

        <!-- Resumen del establecimiento: visible en los 4 pasos (HU-5.1.1) -->
        <div class="reserva-summary">
          <div class="reserva-summary__service">
            <img [src]="imagenServicio()" alt="Servicio" rsImg />
            <div>
              <h3>{{ nombreServicio() || 'Servicio seleccionado' }}</h3>
              <p>{{ precioBase() | euros }} / {{ precioPorLabel() }}</p>
              <div class="reserva-summary__tags">
                <span class="rs-badge rs-badge--accent"><rs-icon [name]="iconoVertical()" [size]="13" [stroke]="2" /> {{ verticaLabel() }}</span>
                <span class="rs-badge rs-badge--success"><rs-icon name="badge-check" [size]="13" [stroke]="2" /> Profesional verificado</span>
              </div>
            </div>
          </div>

          <!-- Resumen del viaje: personas + mascotas + fechas (HU-5.7.2) -->
          @if (resumenViaje().length) {
            <p class="reserva-summary__viaje">
              @for (parte of resumenViaje(); track parte.texto; let ultimo = $last) {
                <span class="reserva-summary__dato">
                  <rs-icon [name]="parte.icono" [size]="14" [stroke]="2" /> {{ parte.texto }}
                </span>
                @if (!ultimo) { <span aria-hidden="true">·</span> }
              }
            </p>
          }
        </div>

        <!-- ═══════════ PASO 1 ═══════════ -->
        @if (paso() === 1) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">{{ paso1Titulo() }}</h2>

            <!-- ── SELECCIÓN DE PERRO (Ficha Inteligente) ── -->
            <div class="rs-field perro-picker">
              <label class="rs-lbl">¿Para qué perro es esta reserva?</label>
              @if (perros().length === 0) {
                <p class="perro-picker__empty">
                  Aún no tienes perros registrados.
                  <a routerLink="/perros/nuevo">Registra uno</a> para que el precio y los servicios se adapten a él.
                </p>
              } @else {
                <div class="perro-picker__list">
                  @for (p of perros(); track p._id) {
                    <button type="button" class="perro-card" [class.selected]="perroSeleccionado() === p._id"
                            (click)="seleccionarPerro(p._id)">
                      <img [src]="p.fotos[0] || imgFallback" [alt]="p.nombre" rsImg />
                      <span class="perro-card__body">
                        <strong><rs-icon name="dog" [size]="16" [stroke]="2" /> {{ p.nombre }}</strong>
                        <span class="perro-card__meta">
                          {{ p.raza || 'Raza no indicada' }}
                          @if (edadDe(p); as edad) { · {{ edad }} }
                          @if (p.peso) { · {{ p.peso }} kg }
                        </span>
                      </span>
                      @if (perroSeleccionado() === p._id) {
                        <span class="perro-card__check"><rs-icon name="check" [size]="13" [stroke]="3" /></span>
                      }
                    </button>
                  }
                </div>
              }
            </div>

            <!-- ── ALOJAMIENTO CANINO ── -->
            @if (vertical() === 'alojamiento') {
              <form [formGroup]="paso1AlojamientoForm">
                <!--
                  Calendario con las noches sin plaza deshabilitadas. Los campos
                  de fecha siguen ahí, ocultos pero vivos: son los que validan el
                  formulario y los que lee el resto del asistente.
                -->
                <div class="rs-field">
                  <label class="rs-lbl">Fechas de la estancia</label>
                  <rs-calendario-rango
                    [dias]="diasCalendario()"
                    [cargando]="cargandoCalendario()"
                    [entrada]="paso1AlojamientoForm.controls.checkIn.value"
                    [salida]="paso1AlojamientoForm.controls.checkOut.value"
                    (rangoElegido)="aplicarRango($event)"
                    (mesCambiado)="cargarCalendario($event)" />
                  <span class="rs-field-hint">{{ resumenEstancia() }}</span>
                </div>
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl" [attr.for]="idPerrosAlojamiento">Número de perros</label>
                    <div class="contador">
                      <button type="button" (click)="cambiarPerros(paso1AlojamientoForm.controls.perros, -1)"
                              [disabled]="!puedeQuitarPerros(paso1AlojamientoForm.controls.perros)"
                              aria-label="Quitar un perro">−</button>
                      <output [id]="idPerrosAlojamiento">{{ paso1AlojamientoForm.controls.perros.value }}</output>
                      <button type="button" (click)="cambiarPerros(paso1AlojamientoForm.controls.perros, 1)"
                              aria-label="Añadir un perro">+</button>
                    </div>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Tamaño del perro</label>
                    <select formControlName="tamanoPerro" class="rs-inp rs-inp--lg">
                      @for (tamano of tamanosPerro; track tamano.valor) {
                        <option [value]="tamano.valor">{{ tamano.etiqueta }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Compatibilidad social de tu perro</label>
                  <select formControlName="compatibilidadSocial" class="rs-inp rs-inp--lg">
                    <option value="cualquiera">Se lleva bien con otros perros</option>
                    <option value="solo_pequenos">Solo tolera perros pequeños</option>
                    <option value="solo_machos">Solo tolera machos</option>
                    <option value="solo_hembras">Solo tolera hembras</option>
                    <option value="individual">Necesita alojamiento individual</option>
                  </select>
                  <span class="rs-field-hint">Ayuda a la residencia a alojarlo de forma segura junto a otros perros.</span>
                </div>
                @if (serviciosAdicionalesAlojamiento().length > 0) {
                  <div class="extras-section">
                    <h3>Servicios adicionales</h3>
                    <div class="extras-grid">
                      @for (extra of serviciosAdicionalesAlojamiento(); track extra.nombre) {
                        <label class="extra-item" [class.selected]="extrasSelec().includes(extra.nombre)">
                          <input type="checkbox" [value]="extra.nombre" (change)="toggleExtra(extra.nombre)" />
                          <div class="extra-item__icon"><rs-icon name="sparkles" [size]="20" [stroke]="2" /></div>
                          <div class="extra-item__info">
                            <div class="extra-item__name">{{ extra.nombre }}</div>
                            <div class="extra-item__price">{{ extra.precio | euros }}</div>
                          </div>
                        </label>
                      }
                    </div>
                  </div>
                }

                <!-- Qué cubre el importe y qué pasa después (HU-5.4.3/5.4.4) -->
                <div class="info-block">
                  <h3>¿Qué incluye este precio?</h3>
                  <ul class="info-block__checks">
                    @for (item of ['Paseos diarios', 'Alimentación', 'Supervisión', 'Limpieza', 'Atención 24 h']; track item) {
                      <li><rs-icon name="check" [size]="15" [stroke]="2.5" /> {{ item }}</li>
                    }
                  </ul>
                </div>

                <div class="info-block">
                  <h3>Recomendaciones para esta estancia</h3>
                  <ul class="info-block__iconos">
                    <li><rs-icon name="clipboard-list" [size]="15" [stroke]="2" /> Trae la cartilla de vacunación al día.</li>
                    <li><rs-icon name="utensils" [size]="15" [stroke]="2" /> Trae su comida habitual para no cambiarle la dieta.</li>
                    <li><rs-icon name="bone" [size]="15" [stroke]="2" /> Un juguete o manta suyos le ayudarán a adaptarse.</li>
                    <li><rs-icon name="pill" [size]="15" [stroke]="2" /> Indícanos cualquier medicación en el paso siguiente.</li>
                  </ul>
                </div>

                <div class="info-block">
                  <h3>¿Qué ocurrirá después de reservar?</h3>
                  <ol class="info-block__iconos">
                    <li><rs-icon name="mail" [size]="15" [stroke]="2" /> Recibes la confirmación inmediata por email.</li>
                    <li><rs-icon name="smartphone" [size]="15" [stroke]="2" /> El alojamiento recibe tu reserva.</li>
                    <li><rs-icon name="check-circle" [size]="15" [stroke]="2" /> Te confirman los detalles definitivos.</li>
                    <li><rs-icon name="dog" [size]="15" [stroke]="2" /> Empieza la estancia.</li>
                  </ol>
                </div>
              </form>
            }

            <!-- ── TRANSPORTE DE ANIMALES ── -->
            @if (vertical() === 'transporte') {
              <form [formGroup]="paso1TransporteForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha del trayecto</label>
                    <input formControlName="fechaRecogida" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Hora de recogida</label>
                    <input formControlName="hora" type="time" class="rs-inp rs-inp--lg" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="wz-origen">Dirección de recogida (origen)</label>
                  <div class="rs-inp rs-inp--lg rs-inp--host">
                    <rs-place-autocomplete formControlName="origen" inputId="wz-origen"
                                           placeholder="Ej. Madrid"
                                           (lugarElegido)="fijarOrigen($event)" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="wz-destino">Destino</label>
                  <div class="rs-inp rs-inp--lg rs-inp--host">
                    <rs-place-autocomplete formControlName="destino" inputId="wz-destino"
                                           placeholder="Ej. Toledo"
                                           (lugarElegido)="fijarDestino($event)" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Distancia del trayecto (km)</label>
                    <input formControlName="distanciaKm" type="number" class="rs-inp rs-inp--lg" min="1" />
                    @if (calculandoTrayecto()) {
                      <span class="rs-field-hint">Calculando la distancia…</span>
                    } @else if (resumenTrayecto()) {
                      <span class="rs-field-hint">{{ resumenTrayecto() }}</span>
                    } @else {
                      <span class="rs-field-hint">
                        Elige origen y destino y la calculamos por ti (tarifa base + km).
                      </span>
                    }
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl" [attr.for]="idPerrosTransporte">Número de perros</label>
                    <div class="contador">
                      <button type="button" (click)="cambiarPerros(paso1TransporteForm.controls.perros, -1)"
                              [disabled]="!puedeQuitarPerros(paso1TransporteForm.controls.perros)"
                              aria-label="Quitar un perro">−</button>
                      <output [id]="idPerrosTransporte">{{ paso1TransporteForm.controls.perros.value }}</output>
                      <button type="button" (click)="cambiarPerros(paso1TransporteForm.controls.perros, 1)"
                              aria-label="Añadir un perro">+</button>
                    </div>
                  </div>
                </div>

                <!-- Extras que ofrece este transportista (HU-5.5.2) -->
                @if (serviciosAdicionalesTransporte().length > 0) {
                  <div class="extras-section">
                    <h3>Servicios adicionales</h3>
                    <div class="extras-grid">
                      @for (extra of serviciosAdicionalesTransporte(); track extra.nombre) {
                        <label class="extra-item" [class.selected]="extrasSelec().includes(extra.nombre)">
                          <input type="checkbox" [value]="extra.nombre" (change)="toggleExtra(extra.nombre)" />
                          <div class="extra-item__icon"><rs-icon name="sparkles" [size]="16" [stroke]="2" /></div>
                          <div class="extra-item__info">
                            <div class="extra-item__name">{{ extra.nombre }}</div>
                            <div class="extra-item__price">{{ extra.precio | euros }}</div>
                          </div>
                        </label>
                      }
                    </div>
                  </div>
                }

                <!-- Ida y vuelta con espera, como un solo servicio (Ref. TRA4) -->
                <div class="extras-section">
                  <label class="filter-check">
                    <input type="checkbox" [checked]="esIdaVuelta()"
                           (change)="esIdaVuelta.set(!esIdaVuelta())" />
                    Ida y vuelta con espera (ej. llevar y traer del veterinario)
                  </label>
                  @if (esIdaVuelta()) {
                    <div class="rs-field" style="margin-top:var(--sp-3)">
                      <label class="rs-lbl">Tiempo de espera estimado (minutos)</label>
                      <input type="number" min="0" step="5" class="rs-inp rs-inp--lg"
                             [value]="esperaMinutos()"
                             (input)="esperaMinutos.set(+$any($event.target).value)" />
                      <span class="rs-field-hint">La tarifa base y los km se cobran ida + vuelta; la espera se cobra aparte, según la tarifa del transportista.</span>
                    </div>
                  }
                </div>

                <!-- Trayectos recurrentes (Ref. TRA3) -->
                <div class="extras-section">
                  <label class="filter-check">
                    <input type="checkbox" [checked]="esRecurrente()"
                           (change)="esRecurrente.set(!esRecurrente())" />
                    Repetir este trayecto varios días a la semana
                  </label>
                  @if (esRecurrente()) {
                    <div class="rs-field" style="margin-top:var(--sp-3)">
                      <label class="rs-lbl">Días de la semana</label>
                      <div class="checks-grid">
                        @for (d of diasSemanaOpciones; track d.valor) {
                          <label class="filter-check">
                            <input type="checkbox" [checked]="tieneDiaSemana(d.valor)"
                                   (change)="toggleDiaSemana(d.valor)" />
                            {{ d.label }}
                          </label>
                        }
                      </div>
                    </div>
                    <div class="rs-field">
                      <label class="rs-lbl">Repetir hasta</label>
                      <input type="date" class="rs-inp rs-inp--lg"
                             [value]="fechaFinRecurrencia()"
                             (input)="fechaFinRecurrencia.set($any($event.target).value)" />
                      <span class="rs-field-hint">Se crea una reserva por cada día elegido, con el mismo origen, destino y hora, hasta esta fecha (máx. 52 trayectos).</span>
                    </div>
                  }
                </div>
              </form>
            }

            <!-- ── VETERINARIA ── -->
            @if (vertical() === 'veterinaria') {
              <form [formGroup]="paso1VeterinariaForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha de la cita</label>
                    <input formControlName="fecha" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Hora de la cita</label>
                    <input formControlName="hora" type="time" class="rs-inp rs-inp--lg" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Servicio (opcional)</label>
                  @if (serviciosClinicosDisponibles().length) {
                    <select formControlName="servicio" class="rs-inp rs-inp--lg">
                      <option value="">— Consulta general —</option>
                      @for (s of serviciosClinicosDisponibles(); track s.nombre) {
                        <option [value]="s.nombre">{{ s.nombre }} — {{ s.precio | euros }}</option>
                      }
                    </select>
                    @if (servicioClinicoSeleccionado(); as sc) {
                      <span class="rs-field-hint">
                        {{ sc.esPrecioCerrado
                          ? 'Precio cerrado: no cambiará tras la consulta.'
                          : 'Precio orientativo: puede variar según lo que se detecte en consulta; pruebas o tratamientos adicionales se facturan aparte, fuera de Doogking.' }}
                      </span>
                    }
                  } @else {
                    <select formControlName="servicio" class="rs-inp rs-inp--lg">
                      <option value="consulta">Consulta general</option>
                      <option value="vacunacion">Vacunación</option>
                      <option value="revision">Revisión / chequeo</option>
                      <option value="dermatologia">Dermatología</option>
                      <option value="urgencia">Urgencia</option>
                    </select>
                    <span class="rs-field-hint">El precio final puede variar según el servicio clínico</span>
                  }
                </div>

                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Motivo principal</label>
                    <select formControlName="motivoTriage" class="rs-inp rs-inp--lg" (change)="consultarRecomendacionVeterinaria()">
                      <option value="vacunacion">Vacunación</option>
                      <option value="revision_general">Revisión general</option>
                      <option value="problemas_digestivos">Problemas digestivos</option>
                      <option value="problemas_dermatologicos">Problemas dermatológicos</option>
                      <option value="cojera">Cojera</option>
                      <option value="vomitos">Vómitos</option>
                      <option value="diarrea">Diarrea</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Gravedad percibida</label>
                    <select formControlName="gravedad" class="rs-inp rs-inp--lg" (change)="consultarRecomendacionVeterinaria()">
                      <option value="leve">Leve</option>
                      <option value="moderada">Moderada</option>
                      <option value="grave">Grave</option>
                      <option value="emergencia">Emergencia</option>
                    </select>
                  </div>
                </div>

                @if (recomendacionVeterinaria(); as rec) {
                  <div class="rs-alert" [class.rs-alert--error]="rec.accion === 'urgencias_inmediatas'"
                       [class.rs-alert--info]="rec.accion !== 'urgencias_inmediatas'">
                    {{ rec.mensaje }}
                  </div>
                }
              </form>
            }

            <!-- ── PELUQUERÍA CANINA ── -->
            @if (vertical() === 'peluqueria') {
              <form [formGroup]="paso1PeluqueriaForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha de la cita</label>
                    <input formControlName="fecha" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Hora de la cita</label>
                    <input formControlName="hora" type="time" class="rs-inp rs-inp--lg" />
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Servicio de grooming</label>
                  @if (serviciosGroomingOpciones().length) {
                    <select formControlName="servicio" class="rs-inp rs-inp--lg">
                      @for (s of serviciosGroomingOpciones(); track s.nombre) {
                        <option [value]="s.nombre">{{ s.nombre }} — {{ precioServicioGrooming(s) | euros }}</option>
                      }
                    </select>
                    @if (perroSeleccionadoObj()?.tipoPelo?.length) {
                      <span class="rs-field-hint">Filtrado según el tipo de pelo de {{ perroSeleccionadoObj()?.nombre }}.</span>
                    }
                  } @else {
                    <select formControlName="servicio" class="rs-inp rs-inp--lg">
                      <option value="bano">Baño y secado</option>
                      <option value="corte">Corte de pelo</option>
                      <option value="deslanado">Deslanado</option>
                      <option value="spa">Spa canino</option>
                      <option value="unas">Corte de uñas</option>
                    </select>
                  }
                </div>

                @if (duracionGroomingElegida(); as minutos) {
                  <p class="rs-field-hint">⏱ Duración aproximada: {{ minutos }} min</p>
                }

                @if (politicaTemperamentoLabel(); as texto) {
                  <div class="rs-alert rs-alert--info"><rs-icon name="paw" [size]="15" [stroke]="2" /> {{ texto }}</div>
                }
                @if (peluqueriaDetalle()?.bozalObligatorioSiAgresivo) {
                  <div class="rs-alert rs-alert--info"><rs-icon name="alert-circle" [size]="15" [stroke]="2" /> Si tu perro es agresivo con la manipulación, deberás traerlo con bozal.</div>
                }
                @if (peluqueriaDetalle()?.serviciosAdicionales?.length) {
                  <div class="rs-field">
                    <label class="rs-lbl">Servicios adicionales disponibles en el salón</label>
                    <p class="rs-field-hint">{{ serviciosAdicionalesResumen() }}</p>
                  </div>
                }

                <!-- Preparación previa a la cita (HU-5.3.4) -->
                <div class="info-block">
                  <h3>Antes de la cita</h3>
                  <ul class="info-block__iconos">
                    <li><rs-icon name="dog" [size]="15" [stroke]="2" /> Pasea a tu perro antes de venir.</li>
                    <li><rs-icon name="utensils" [size]="15" [stroke]="2" /> Evita darle de comer justo antes si se pone nervioso.</li>
                    <li><rs-icon name="scissors" [size]="15" [stroke]="2" /> Si tiene nudos importantes, el precio podría variar tras la valoración.</li>
                  </ul>
                </div>
              </form>
            }

            <!-- ── ADIESTRAMIENTO ── -->
            @if (vertical() === 'adiestramiento') {
              <form [formGroup]="paso1AdiestramientoForm">
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha de inicio</label>
                    <input formControlName="fechaInicio" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Modalidad</label>
                    <select formControlName="modalidad" class="rs-inp rs-inp--lg">
                      <option value="sesion">Sesión suelta</option>
                      <option value="programa" [disabled]="recomendacionAdiestramiento()?.bloqueaGrupales">Programa completo</option>
                    </select>
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Edad del perro (meses)</label>
                  <input formControlName="edadMeses" type="number" class="rs-inp rs-inp--lg" min="0" max="240"
                         (change)="consultarRecomendacionAdiestramiento()" />
                  <span class="rs-field-hint">Para verificar la edad mínima requerida por el adiestrador</span>
                </div>
                @if (serviciosAdiestramientoOpciones().length) {
                  <div class="rs-field">
                    <label class="rs-lbl">Servicio o técnica (opcional)</label>
                    <select formControlName="servicio" class="rs-inp rs-inp--lg">
                      <option value="">— El centro propondrá el más adecuado —</option>
                      @for (s of serviciosAdiestramientoOpciones(); track s.nombre) {
                        <option [value]="s.nombre">{{ s.nombre }} — {{ s.precio | euros }}</option>
                      }
                    </select>
                  </div>
                }
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">¿Qué quieres trabajar?</label>
                    <select formControlName="motivo" class="rs-inp rs-inp--lg" (change)="consultarRecomendacionAdiestramiento()">
                      <option value="obediencia_basica">Obediencia básica</option>
                      <option value="tirones_correa">Tirones de correa</option>
                      <option value="no_acude_llamada">No acude a la llamada</option>
                      <option value="ansiedad_separacion">Ansiedad por separación</option>
                      <option value="destruccion_casa">Destrucción en casa</option>
                      <option value="ladridos_excesivos">Ladridos excesivos</option>
                      <option value="miedos">Miedos</option>
                      <option value="agresividad_perros">Agresividad hacia perros</option>
                      <option value="agresividad_personas">Agresividad hacia personas</option>
                      <option value="proteccion_recursos">Protección de recursos</option>
                      <option value="socializacion">Socialización</option>
                      <option value="preparacion_cachorro">Preparación de cachorro</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Intensidad del problema</label>
                    <select formControlName="intensidad" class="rs-inp rs-inp--lg" (change)="consultarRecomendacionAdiestramiento()">
                      <option value="leve">Leve</option>
                      <option value="moderado">Moderado</option>
                      <option value="grave">Grave</option>
                    </select>
                  </div>
                </div>

                <!-- Contexto libre para que el adiestrador prepare la sesión (HU-5.6.2) -->
                <div class="rs-field">
                  <label class="rs-lbl">Cuéntanos un poco más</label>
                  <textarea formControlName="descripcionComportamiento" rows="3" class="rs-inp"
                            placeholder="¿Cuándo aparece la conducta? ¿Desde cuándo? ¿Qué habéis probado ya?"></textarea>
                  <span class="rs-field-hint">
                    Cuanta más información nos proporciones, mejor podrá preparar el adiestrador la primera sesión.
                  </span>
                </div>

                <!-- Cuestionario de comportamiento ampliado (Ref. ADI2) -->
                <div class="rs-field">
                  <label class="rs-lbl">Historial previo (opcional)</label>
                  <textarea formControlName="historialPrevio" rows="2" class="rs-inp"
                            placeholder="¿Ha recibido adiestramiento antes? ¿Con qué resultado? ¿De dónde viene el perro?"></textarea>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Vínculo con el propietario (opcional)</label>
                  <select formControlName="vinculoPropietario" class="rs-inp rs-inp--lg">
                    <option value="">— Sin especificar —</option>
                    <option value="desde_cachorro">Lo tengo desde cachorro</option>
                    <option value="adoptado_reciente">Adoptado hace poco (menos de 6 meses)</option>
                    <option value="adoptado_antiguo">Adoptado hace tiempo (más de 6 meses)</option>
                    <option value="varios_convivientes">Varias personas conviven con él</option>
                  </select>
                </div>

                <!-- Vídeos del comportamiento (Ref. ADI3) -->
                <div class="rs-field">
                  <label class="rs-lbl">Vídeos del comportamiento (opcional)</label>
                  <!-- Las extensiones acompañan al tipo MIME: iOS graba en .mov
                       y no siempre rellena el tipo del fichero. -->
                  <input type="file"
                         accept="video/*,.mp4,.mov,.m4v,.webm"
                         (change)="subirVideoComportamiento($any($event.target))" />
                  <span class="rs-field-hint">Máx. 50 MB por vídeo. Ayuda al adiestrador a preparar la sesión.</span>
                  @if (subiendoVideo()) {
                    <span class="rs-field-hint">Subiendo vídeo…</span>
                  }
                  @if (errorVideo()) {
                    <span class="rs-field-err">{{ errorVideo() }}</span>
                  }
                  @if (videosComportamiento().length) {
                    <ul class="videos-lista">
                      @for (v of videosComportamiento(); track v; let i = $index) {
                        <li>
                          <rs-icon name="check-circle" [size]="13" [stroke]="2"></rs-icon>
                          Vídeo {{ i + 1 }}
                          <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarVideoComportamiento(i)">
                            <rs-icon name="x" [size]="12" [stroke]="2"></rs-icon>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>

                @if (recomendacionAdiestramiento(); as rec) {
                  <div class="rs-alert" [class.rs-alert--warning]="rec.tipoRecomendado === 'valoracion_previa'"
                       [class.rs-alert--info]="rec.tipoRecomendado !== 'valoracion_previa'">
                    {{ rec.mensaje }}
                  </div>
                }

                <!-- Qué compra el cliente y qué se lleva (HU-5.6.1) -->
                <div class="info-block">
                  <h3>¿Qué incluye esta sesión?</h3>
                  <ul class="info-block__checks">
                    @for (item of ['Valoración inicial de tu perro', 'Plan de trabajo personalizado', 'Recomendaciones para casa', 'Resolución de dudas']; track item) {
                      <li><rs-icon name="check" [size]="15" [stroke]="2.5" /> {{ item }}</li>
                    }
                  </ul>
                </div>

                <div class="info-block">
                  <h3>¿Qué conseguirás con esta sesión?</h3>
                  <ul class="info-block__iconos">
                    <li><rs-icon name="search" [size]="15" [stroke]="2" /> Evaluar el comportamiento de tu perro.</li>
                    <li><rs-icon name="brain" [size]="15" [stroke]="2" /> Identificar la causa real de la conducta.</li>
                    <li><rs-icon name="clipboard-list" [size]="15" [stroke]="2" /> Un plan personalizado para trabajarla.</li>
                    <li><rs-icon name="home" [size]="15" [stroke]="2" /> Ejercicios concretos para hacer en casa.</li>
                  </ul>
                </div>
              </form>
            }

            <!-- ── HOTEL PET-FRIENDLY ── -->
            @if (vertical() === 'hoteles') {
              <form [formGroup]="paso1HotelesForm">
                <div class="rs-field">
                  <label class="rs-lbl">Fechas de la estancia</label>
                  <rs-calendario-rango
                    [dias]="diasCalendario()"
                    [cargando]="cargandoCalendario()"
                    [entrada]="paso1HotelesForm.controls.checkIn.value"
                    [salida]="paso1HotelesForm.controls.checkOut.value"
                    (rangoElegido)="aplicarRango($event)"
                    (mesCambiado)="cargarCalendario($event)" />
                  <span class="rs-field-hint">{{ resumenEstancia() }}</span>
                </div>
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Adultos</label>
                    <select formControlName="adultos" class="rs-inp rs-inp--lg">
                      @for (n of [1,2,3,4,5,6,7,8,9,10]; track n) {
                        <option [value]="n">{{ n }} {{ n === 1 ? 'adulto' : 'adultos' }}</option>
                      }
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Niños</label>
                    <select formControlName="ninos" class="rs-inp rs-inp--lg">
                      @for (n of [0,1,2,3,4,5,6,7,8,9,10]; track n) {
                        <option [value]="n">{{ n }} {{ n === 1 ? 'niño' : 'niños' }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Número de mascotas</label>
                    <select formControlName="mascotas" class="rs-inp rs-inp--lg">
                      <option value="1">1 mascota</option>
                      <option value="2">2 mascotas</option>
                      <option value="3">3 mascotas</option>
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Tamaño de tu mascota</label>
                    <select formControlName="tamanoPerro" class="rs-inp rs-inp--lg">
                      @for (tamano of tamanosPerro; track tamano.valor) {
                        <option [value]="tamano.valor">{{ tamano.etiqueta }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Observaciones para el hotel</label>
                  <textarea formControlName="observaciones" rows="2" class="rs-inp"
                            placeholder="Llegada tardía, cuna, planta baja…"></textarea>
                  <span class="rs-field-hint">Opcional.</span>
                </div>
                <span class="rs-field-hint">El suplemento por mascota, si existe, se calculará automáticamente según las condiciones configuradas por el hotel.</span>
              </form>
            }

            <!-- ── SERVICIOS FUNERARIOS ── -->
            @if (vertical() === 'funerarios') {
              <form [formGroup]="paso1FunerariosForm">
                <!--
                  El orden lo pide el brief y tiene sentido: primero qué se
                  contrata, luego el peso (que fija el precio), después la
                  recogida, la fecha y por último los extras. Nada de hora
                  exacta: aquí se trabaja por franjas.
                -->
                <div class="rs-field">
                  <label class="rs-lbl">Qué necesitas</label>
                  <select formControlName="servicioNombre" class="rs-inp rs-inp--lg">
                    <option value="">— Elige un servicio —</option>
                    @for (sv of serviciosFunerariosDisponibles(); track sv.nombre) {
                      <option [value]="sv.nombre">{{ sv.nombre }}</option>
                    }
                  </select>
                  @if (servicioFunerarioElegido(); as sv) {
                    <span class="rs-field-hint">
                      {{ sv.descripcion || (sv.devuelveCenizas ? 'Con devolución de cenizas.' : 'Sin devolución individual de cenizas.') }}
                      @if (sv.tiempoEstimadoHoras) { · Aprox. {{ sv.tiempoEstimadoHoras }} h }
                    </span>
                  }
                </div>

                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">Tipo de animal</label>
                    <select formControlName="especie" class="rs-inp rs-inp--lg">
                      @for (e of especiesFunerario; track e) {
                        <option [value]="e">{{ e }}</option>
                      }
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Peso aproximado (kg)</label>
                    <input formControlName="pesoKg" type="number" min="0" step="0.5" class="rs-inp rs-inp--lg" />
                    <span class="rs-field-hint">Es lo que determina el precio del servicio.</span>
                  </div>
                </div>

                <div class="rs-field">
                  <label class="rs-checkbox">
                    <input type="checkbox" formControlName="necesitaRecogida" />
                    Necesito que vengan a recogerlo
                  </label>
                  @if (!ofreceRecogida()) {
                    <span class="rs-field-hint">Esta empresa no ofrece recogida.</span>
                  }
                </div>

                @if (paso1FunerariosForm.value.necesitaRecogida) {
                  <div class="form-row">
                    <div class="rs-field">
                      <label class="rs-lbl">¿Desde dónde?</label>
                      <select formControlName="lugarRecogida" class="rs-inp rs-inp--lg">
                        @for (l of lugaresRecogidaDisponibles(); track l.valor) {
                          <option [value]="l.valor">{{ l.label }}</option>
                        }
                      </select>
                    </div>
                    <div class="rs-field">
                      <label class="rs-lbl">Distancia aproximada (km)</label>
                      <input formControlName="distanciaKm" type="number" min="0" class="rs-inp rs-inp--lg" />
                      <span class="rs-field-hint">Radio máximo de esta empresa: {{ radioRecogidaKm() }} km.</span>
                    </div>
                  </div>

                  @if (zonasRecogidaDisponibles().length) {
                    <div class="rs-field">
                      <label class="rs-lbl">Zona de recogida</label>
                      <select formControlName="zonaRecogida" class="rs-inp rs-inp--lg">
                        <option value="">— Elige tu zona —</option>
                        @for (z of zonasRecogidaDisponibles(); track z.nombre) {
                          <option [value]="z.nombre">{{ z.nombre }} · {{ z.precio | euros }}</option>
                        }
                      </select>
                    </div>
                  }

                  <div class="rs-field">
                    <label class="rs-lbl">Dirección y observaciones</label>
                    <textarea formControlName="direccionRecogida" class="rs-inp rs-inp--lg" rows="2"
                              placeholder="Calle, número, planta… y lo que debamos saber al llegar"></textarea>
                  </div>
                }

                <div class="form-row">
                  <div class="rs-field">
                    <label class="rs-lbl">¿Cuándo lo necesitas?</label>
                    <select formControlName="urgencia" class="rs-inp rs-inp--lg">
                      @for (u of urgenciasFunerario; track u.valor) {
                        <option [value]="u.valor">{{ u.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="rs-field">
                    <label class="rs-lbl">Franja horaria</label>
                    <select formControlName="franja" class="rs-inp rs-inp--lg">
                      @for (f of franjasFunerarioDisponibles(); track f.valor) {
                        <option [value]="f.valor">{{ f.label }}</option>
                      }
                    </select>
                    <span class="rs-field-hint">No se pide hora exacta: la empresa trabaja por franjas.</span>
                  </div>
                </div>

                @if (paso1FunerariosForm.value.urgencia === 'fecha') {
                  <div class="rs-field">
                    <label class="rs-lbl">Fecha</label>
                    <input formControlName="fecha" type="date" class="rs-inp rs-inp--lg" />
                  </div>
                }

                @if (extrasFunerariosDisponibles().length) {
                  <div class="rs-field">
                    <span class="rs-lbl">Extras (opcional)</span>
                    <div class="extras-funerario">
                      @for (e of extrasFunerariosDisponibles(); track e.nombre) {
                        <label class="rs-checkbox">
                          <input type="checkbox" [checked]="tieneExtraFunerario(e.nombre)"
                                 (change)="toggleExtraFunerario(e.nombre)" />
                          {{ e.nombre }} · {{ e.precio | euros }}
                          @if (e.descripcion) { <span class="rs-field-hint">{{ e.descripcion }}</span> }
                        </label>
                      }
                    </div>
                  </div>
                }

                <!--
                  §8 del brief: la cremación colectiva no devuelve las cenizas y
                  eso no puede descubrirse después de pagar. Sin esta casilla la
                  reserva no avanza, y el backend lo vuelve a comprobar.
                -->
                @if (servicioFunerarioElegido(); as sv) {
                  @if (!sv.devuelveCenizas) {
                    <div class="rs-alert rs-alert--warning" style="margin-block:var(--sp-4)">
                      <rs-icon name="alert-circle" [size]="16" [stroke]="2"></rs-icon>
                      <label class="rs-checkbox">
                        <input type="checkbox" formControlName="aceptaSinCenizas" />
                        Entiendo y acepto que este servicio <strong>no incluye la devolución
                        individual de las cenizas</strong>.
                      </label>
                    </div>
                  }
                }

                @if (politicaCancelacionFunerario(); as pol) {
                  <div class="rs-card politica-funerario">
                    <h3 class="politica-funerario__tit">Condiciones de cancelación</h3>
                    <p>Antes de la recogida se reembolsa el {{ pol.reembolsoAntesRecogidaPct }} % del importe.</p>
                    <p>Una vez iniciado el servicio, el reembolso es del {{ pol.reembolsoIniciadoPct }} %.</p>
                    @if (pol.notas) { <p>{{ pol.notas }}</p> }
                  </div>
                }
              </form>
            }

            <!--
              Disponibilidad en el propio paso donde se eligen las fechas: si no
              hay hueco se dice aquí y no se deja avanzar, en vez de dejar que el
              cliente rellene sus datos para toparse con el rechazo al pagar.
            -->
            @if (disponibilidad().estado === 'sin_hueco') {
              <div class="rs-alert rs-alert--error" role="alert" style="margin-block:var(--sp-5)">
                <rs-icon name="alert-circle" [size]="16" [stroke]="2"></rs-icon>
                <span>{{ disponibilidad().motivo }}</span>
              </div>
            }

            <div class="wizard-cta">
              <button class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg"
                      [disabled]="!paso1Valido() || disponibilidad().estado === 'sin_hueco'
                                  || disponibilidad().estado === 'comprobando'"
                      (click)="irPaso(2)">
                @if (disponibilidad().estado === 'comprobando') {
                  <span class="rs-spin"></span> Comprobando disponibilidad…
                } @else {
                  Continuar → Tus datos
                }
              </button>
            </div>
          </div>
        }

        <!-- ═══════════ PASO 2 ═══════════ -->
        @if (paso() === 2) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">Datos del contacto principal</h2>

            <form [formGroup]="paso2Form">
              <div class="form-row">
                <div class="rs-field">
                  <label class="rs-lbl">Nombre</label>
                  <input formControlName="nombre" class="rs-inp rs-inp--lg" placeholder="Tu nombre"
                         [class.rs-inp--error]="p2Error('nombre')" />
                  @if (p2Error('nombre')) { <span class="rs-field-err">Indica tu nombre.</span> }
                </div>
                <div class="rs-field">
                  <label class="rs-lbl">Apellidos</label>
                  <input formControlName="apellidos" class="rs-inp rs-inp--lg" placeholder="Tus apellidos"
                         [class.rs-inp--error]="p2Error('apellidos')" />
                  @if (p2Error('apellidos')) { <span class="rs-field-err">Indica tus apellidos.</span> }
                </div>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Correo electrónico</label>
                <input formControlName="email" type="email" class="rs-inp rs-inp--lg" placeholder="tu@email.com"
                       [class.rs-inp--error]="p2Error('email')" />
                @if (p2Error('email')) {
                  <span class="rs-field-err">Indica un correo electrónico válido.</span>
                } @else {
                  <span class="rs-field-hint">La confirmación se enviará a este correo</span>
                }
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Teléfono</label>
                <rs-phone-input formControlName="telefono" etiqueta="Teléfono de contacto"
                                [error]="p2Error('telefono')" />
                @if (p2Error('telefono')) { <span class="rs-field-err">Indica un teléfono de contacto.</span> }
              </div>

              <div class="rs-field">
                <label class="rs-lbl">País de residencia</label>
                <select formControlName="pais" class="rs-inp rs-inp--lg">
                  <option value="ES">España</option>
                  <option value="PT">Portugal</option>
                  <option value="FR">Francia</option>
                  <option value="IT">Italia</option>
                  <option value="DE">Alemania</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div class="rs-field">
                <label class="rs-lbl">Peticiones especiales (opcional)</label>
                <textarea formControlName="peticiones" class="rs-inp" rows="3"
                          placeholder="{{ peticionesPlaceholder() }}"></textarea>
              </div>

              <div class="rs-alert rs-alert--info" style="margin-block:var(--sp-4)">
                <rs-icon name="alert-circle" [size]="16" [stroke]="2"></rs-icon>
                <span>El importe mostrado es una estimación. El precio final puede variar si el estado o las
                  necesidades de tu mascota no coinciden con lo indicado al llegar al servicio (te avisaremos
                  y podrás aceptar o rechazar cualquier ajuste antes de que se cobre nada de más).</span>
              </div>

              <!-- Presupuesto ajustado por el historial del perro (Ref. N8) -->
              @if (estimacionPrecio(); as est) {
                <div class="rs-alert rs-alert--warning" style="margin-block:var(--sp-4)">
                  <rs-icon name="trending-up" [size]="16" [stroke]="2"></rs-icon>
                  <span>
                    Según el historial de {{ perroSeleccionadoObj()?.nombre }} ({{ est.basadoEnReservas }} reserva(s)
                    anteriores), el precio final suele rondar
                    <strong>{{ est.precioEstimado | euros:'1.2-2' }}</strong>
                    ({{ est.promedioAjustePct > 0 ? '+' : '' }}{{ est.promedioAjustePct }}% sobre la estimación
                    inicial de {{ est.precioBase | euros:'1.2-2' }}).
                  </span>
                </div>
              }

              <div class="consent-box">
                <label class="filter-check">
                  <input type="checkbox" formControlName="confirmaDatosMascota" />
                  <span>Confirmo que la información de mi mascota es correcta y entiendo que el precio puede ajustarse si no coincide al llegar.</span>
                </label>
                @if (p2Error('confirmaDatosMascota')) {
                  <span class="rs-field-err">Debes confirmar que los datos de tu mascota son correctos.</span>
                }

                <label class="filter-check">
                  <input type="checkbox" formControlName="aceptaTerminos" />
                  <span>Acepto los <a routerLink="/terminos" style="color:var(--c-accent)">Términos y condiciones</a> y la <a routerLink="/privacidad" style="color:var(--c-accent)">Política de privacidad</a></span>
                </label>
                @if (p2Error('aceptaTerminos')) {
                  <span class="rs-field-err">Debes aceptar los términos para continuar.</span>
                }
              </div>
            </form>

            <div class="wizard-nav">
              <button class="rs-btn rs-btn--secondary" (click)="irPaso(1)">← Atrás</button>
              <button class="rs-btn rs-btn--gold rs-btn--lg" (click)="continuarPaso2()">
                Continuar → Pago
              </button>
            </div>
          </div>
        }

        <!-- ═══════════ PASO 3 ═══════════ -->
        @if (paso() === 3) {
          <div class="wizard-card">
            <h2 class="wizard-card__title">Método de pago</h2>

            <div class="payment-options">
              <label class="payment-option" [class.selected]="metodoPago() === 'card'">
                <input type="radio" name="metodo" value="card" [(ngModel)]="metodoPagoVal"
                       (change)="metodoPago.set('card')" />
                <div class="payment-option__icon"><rs-icon name="credit-card" [size]="20" [stroke]="2" /></div>
                <div>
                  <div class="payment-option__name">Tarjeta de crédito / débito</div>
                  <div class="payment-option__brands">
                    @for (marca of marcasTarjeta; track marca) {
                      <rs-brand-icon [name]="marca" [size]="20" />
                    }
                  </div>
                </div>
                <div class="payment-option__secure">
                  <rs-brand-icon name="stripe" [size]="16" />
                </div>
              </label>
            </div>

            @if (metodoPago() === 'card') {
              <div class="stripe-placeholder">
                <div class="stripe-placeholder__header">
                  <span>Datos de tarjeta</span>
                  <span class="rs-badge rs-badge--accent"><rs-icon name="lock" [size]="13" [stroke]="2" /> Stripe · Cifrado SSL</span>
                </div>

                <div id="stripe-payment-element"></div>

                @if (!stripeListo() && !errorPago()) {
                  <p style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-3)">
                    Cargando el formulario seguro de pago…
                  </p>
                }

                @if (errorPago()) {
                  <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">{{ errorPago() }}</div>
                }
              </div>
            }

            <div class="rs-alert rs-alert--info" style="margin-block:var(--sp-5);display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap">
              <span><rs-icon name="lock" [size]="14" [stroke]="2" /> Tu pago está protegido por</span>
              <rs-brand-icon name="stripe" [size]="17" />
              <span>· Nunca almacenamos datos de tarjeta.</span>
            </div>

            <div class="wizard-nav">
              <button class="rs-btn rs-btn--secondary" (click)="irPaso(2)">← Atrás</button>
              <button class="rs-btn rs-btn--gold rs-btn--lg"
                      [disabled]="procesando() || !stripeListo()"
                      (click)="procesarPago()">
                @if (procesando()) {
                  <span class="rs-spin"></span> Procesando…
                } @else if (!stripeListo()) {
                  Preparando pago…
                } @else {
                  <rs-icon name="lock" [size]="16" [stroke]="2.25" /> Pagar {{ total() | euros }}
                }
              </button>
            </div>

            <!--
              Atajo de pruebas. Sólo aparece si el API dice que este entorno lo
              permite; no se decide aquí. Va aparte del botón de pagar y con el
              aviso a la vista para que nadie lo pulse creyendo que paga.
            -->
            @if (bypassDisponible()) {
              <div class="bypass">
                <p class="bypass__aviso">
                  <rs-icon name="alert-circle" [size]="15" [stroke]="2"></rs-icon>
                  Entorno de pruebas: puedes confirmar la reserva sin pagar. No se
                  cobra nada y la reserva queda marcada como de prueba.
                </p>
                <!--
                  Sin reserva creada este botón no tenía nada que confirmar y al
                  pulsarlo no pasaba nada visible. Ahora se deshabilita y se dice
                  por qué: el motivo real lo trae errorPago.
                -->
                <button type="button" class="rs-btn rs-btn--outline rs-btn--block"
                        [disabled]="procesando() || !reservaIdReal()"
                        (click)="confirmarSinPagar()">
                  @if (procesando()) {
                    <span class="rs-spin"></span> Confirmando…
                  } @else {
                    Omitir el pago y confirmar la reserva
                  }
                </button>
                @if (!reservaIdReal()) {
                  <p class="bypass__aviso" style="margin:var(--sp-3) 0 0">
                    <rs-icon name="alert-circle" [size]="15" [stroke]="2"></rs-icon>
                    Esta reserva no se ha podido crear, así que no hay nada que confirmar.
                    Vuelve al primer paso y revisa las fechas.
                  </p>
                }
              </div>
            }
          </div>
        }

        <!-- ═══════════ PASO 4 ═══════════ -->
        @if (paso() === 4) {
          <div class="wizard-card confirmation">
            <div class="confirmation__icon"><rs-icon name="party-popper" [size]="40" [stroke]="1.75" /></div>
            <h2>¡Reserva confirmada!</h2>
            <p>Tu reserva ha sido procesada exitosamente. Recibirás la confirmación en tu correo.</p>

            @if (confirmacionPendiente()) {
              <!-- El cobro salió bien pero el servidor aún no la ha dado por
                   confirmada. Decirlo evita que el listado parezca contradecir
                   a esta pantalla. -->
              <div class="rs-alert rs-alert--info" style="text-align:left;margin-bottom:var(--sp-6)">
                <rs-icon name="alert-circle" [size]="16" [stroke]="2"></rs-icon>
                <span>
                  El pago se ha realizado correctamente. Estamos terminando de confirmarla con
                  el establecimiento: puede tardar un momento en aparecer como confirmada en
                  <a routerLink="/reservas/mis-reservas">mis reservas</a>.
                </span>
              </div>
            }

            <div class="confirmation__code">
              <span class="rs-label-caps">Código de reserva</span>
              <div class="code-box">{{ codigoReserva() }}</div>
            </div>

            <div class="confirmation__details rs-card">
              <div class="cd-row">
                <span><rs-icon [name]="iconoVertical()" [size]="14" [stroke]="2" /> Servicio</span>
                <strong>{{ nombreServicio() || verticaLabel() }}</strong>
              </div>
              <div class="cd-row">
                <span><rs-icon name="file-text" [size]="14" [stroke]="2" /> Detalle</span>
                <strong>{{ lineaResumen() }}</strong>
              </div>
              <div class="cd-row">
                <span><rs-icon name="wallet" [size]="14" [stroke]="2" /> Total pagado</span>
                <strong class="rs-gradient-text">{{ total() | euros }}</strong>
              </div>
            </div>

            @if (ofreceCompletarViaje()) {
              <!-- Gancho del carrito: es el momento en que el cliente ya tiene
                   fechas y ciudad, así que completar el viaje cuesta un clic. -->
              <div class="completar-viaje">
                <div>
                  <h3>¿Completamos el viaje?</h3>
                  <p>
                    Peluquería, transporte o veterinario para esas mismas fechas en
                    {{ ciudadServicio() || 'tu destino' }}. Cada servicio se reserva por separado,
                    pero se paga de una vez.
                  </p>
                </div>
                <a [routerLink]="['/peluqueria']" [queryParams]="parametrosViaje()"
                   class="rs-btn rs-btn--gold">
                  Añadir más servicios
                </a>
              </div>
            }

            <div class="confirmation__actions">
              <a routerLink="/reservas/mis-reservas" class="rs-btn rs-btn--primary rs-btn--lg">
                Ver mis reservas
              </a>
              <a routerLink="/" class="rs-btn rs-btn--secondary rs-btn--lg">
                Seguir explorando
              </a>
            </div>

            <!--
              Valoración del proceso de reserva, no del servicio: éste todavía
              no se ha prestado. La reseña del comercio se pide más tarde, por
              correo, cuando ya hay algo que valorar.
            -->
            <div class="valoracion">
              @if (valoracionEnviada()) {
                <p class="valoracion__gracias">
                  <rs-icon name="check-circle" [size]="18" [stroke]="2" />
                  Gracias. Nos ayuda a que reservar sea cada vez más fácil.
                </p>
              } @else {
                <p class="valoracion__pregunta">¿Qué tal ha ido la reserva?</p>
                <div class="valoracion__estrellas" role="group" aria-label="Valora el proceso de reserva">
                  @for (n of estrellas; track n) {
                    <button type="button" class="valoracion__estrella"
                            [class.valoracion__estrella--activa]="n <= (valoracion() ?? 0)"
                            [attr.aria-label]="n + ' de 5'"
                            (click)="valorarExperiencia(n)">
                      <rs-icon name="star" [size]="26" [stroke]="1.75" />
                    </button>
                  }
                </div>

                <!-- Sólo si algo ha ido mal: es donde está el dato que sirve. -->
                @if (pideMotivoValoracion()) {
                  <div class="valoracion__motivo">
                    <label class="rs-lbl" for="valoracion-motivo">¿Qué podríamos mejorar?</label>
                    <textarea id="valoracion-motivo" class="rs-inp" rows="2"
                              [value]="motivoValoracion()"
                              (input)="motivoValoracion.set($any($event.target).value)"
                              placeholder="Opcional, pero nos viene muy bien"></textarea>
                    <button type="button" class="rs-btn rs-btn--secondary rs-btn--sm"
                            (click)="enviarMotivoValoracion()">
                      Enviar
                    </button>
                  </div>
                }
              }
            </div>

            <!-- Las dudas que llegan justo aquí, contestadas aquí (feedback 2026-08-20). -->
            <div class="faq">
              <h3 class="faq__titulo">Preguntas frecuentes</h3>
              @for (p of faq(); track p.pregunta) {
                <details class="faq__item">
                  <summary class="faq__pregunta">
                    {{ p.pregunta }}
                    <rs-icon name="chevron-down" [size]="16" [stroke]="2" class="faq__chevron" />
                  </summary>
                  <p class="faq__respuesta">{{ p.respuesta }}</p>
                </details>
              }
              <a routerLink="/ayuda" class="faq__mas">
                Ver todas las preguntas en el centro de ayuda
                <rs-icon name="arrow-right" [size]="14" [stroke]="2" />
              </a>
            </div>
          </div>
        }
      </div>

      <!-- PANEL LATERAL: resumen de precio -->
      @if (paso() < 4) {
        <div class="price-summary">
          <div class="price-summary__card">
            <h3>Resumen de precio</h3>

            <div class="price-row">
              <span>{{ lineaResumen() }}</span>
              <span>{{ subtotal() | euros }}</span>
            </div>
            @if (vertical() === 'alojamiento') {
              @for (extra of extrasSelec(); track extra) {
                <div class="price-row">
                  <span>{{ extraNombre(extra) }}</span>
                  <span>{{ extraPrecio(extra) | euros }}</span>
                </div>
              }
            }
            @if (vertical() === 'transporte') {
              <!-- Desglose transparente del trayecto (HU-5.5.3) -->
              <div class="price-row price-row--sub">
                <span>Servicio base</span>
                <span>{{ tarifaBaseTransporte() | euros }}</span>
              </div>
              @if (costeKmTransporte() > 0) {
                <div class="price-row price-row--sub">
                  <span>Kilómetros</span>
                  <span>{{ costeKmTransporte() | euros }}</span>
                </div>
              }
              @for (extra of extrasSelec(); track extra) {
                <div class="price-row price-row--sub">
                  <span>{{ extra }}</span>
                  <span>{{ extraPrecioTransporte(extra) | euros }}</span>
                </div>
              }
            }
            @if (vertical() === 'hoteles' && suplementoHotel() > 0) {
              <div class="price-row">
                <span>Suplemento por mascota</span>
                <span>{{ suplementoHotel() | euros }}</span>
              </div>
            }
            <hr class="rs-hr" style="margin-block:var(--sp-4)">
            @if (descuento() > 0) {
              <div class="price-row price-row--sub">
                <span>Subtotal</span>
                <span>{{ subtotal() | euros }}</span>
              </div>
              <div class="price-row price-row--sub" style="color:#16A34A">
                <span>Descuento ({{ cuponCodigo() }})</span>
                <span>−{{ descuento() | euros }}</span>
              </div>
            }
            <div class="price-row price-row--total">
              <span>Total</span>
              <span>{{ total() | euros }}</span>
            </div>
            <!-- El IVA va desglosado como parte del total, no sumado debajo:
                 el precio anunciado es el que se paga. -->
            <p class="price-iva">
              Incluye {{ iva() | euros }} de IVA (21%) · base {{ baseImponible() | euros }}
            </p>

            <!-- Cupón de descuento -->
            <div class="cupon-box">
              @if (descuento() > 0) {
                <div class="rs-alert rs-alert--success" style="font-size:var(--f-xs)">
                  <rs-icon name="check" [size]="14" [stroke]="3" /> Cupón {{ cuponCodigo() }} aplicado
                  <button class="cupon-box__quitar" (click)="quitarCupon()">Quitar</button>
                </div>
              } @else {
                <div class="cupon-box__row">
                  <input [(ngModel)]="cuponInput" name="cupon" class="rs-inp" placeholder="Código de descuento"
                         style="text-transform:uppercase" />
                  <button class="rs-btn rs-btn--secondary" [disabled]="aplicandoCupon()" (click)="aplicarCupon()">
                    {{ aplicandoCupon() ? '…' : 'Aplicar' }}
                  </button>
                </div>
                @if (cuponError()) {
                  <p style="font-size:var(--f-xs);color:#DC2626;margin-top:var(--sp-2)">{{ cuponError() }}</p>
                }
              }
            </div>
            <p style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-4)">
              Precio en euros (EUR). El cargo se realiza al confirmar.
            </p>

            <hr class="rs-hr" style="margin-block:var(--sp-5)">

            <div class="price-trust">
              <p><rs-icon name="check" [size]="13" [stroke]="3" /> Sin cargos ocultos</p>
              <p><rs-icon name="check" [size]="13" [stroke]="3" /> Pago 100% seguro vía Stripe</p>
              <p><rs-icon name="check" [size]="13" [stroke]="3" /> Confirmación inmediata por correo</p>
              <p><rs-icon name="lock" [size]="13" [stroke]="2" /> No se realizará ningún cargo hasta confirmar el siguiente paso</p>
              <p><rs-icon name="shield-check" [size]="13" [stroke]="2" /> Protección Doogking: tu dinero está protegido hasta que el servicio se complete según la política de cancelación</p>
            </div>
          </div>
        </div>
      }
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .wizard-page { min-height: 100vh; background: var(--c-base); }
    .wizard-wrap { padding-block: var(--sp-8); }

    .wizard-cta { margin-top: var(--sp-6); }

    /* Extras del servicio funerario: una columna de casillas con su precio, que
       es lo que el cliente compara al decidir. */
    .extras-funerario {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      padding: var(--sp-4);
      background: var(--c-raised);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
    }
    .extras-funerario .rs-field-hint { display: block; }

    /* Las condiciones de cancelación se leen antes de pagar, no después (§11). */
    .politica-funerario {
      margin-top: var(--sp-5);
      padding: var(--sp-4);
      font-size: var(--f-sm);
      color: var(--t-300);
      line-height: 1.6;
    }
    .politica-funerario__tit {
      font-size: var(--f-sm);
      font-weight: var(--w-7);
      color: var(--t-100);
      margin-bottom: var(--sp-2);
    }

    /*
     * Barra fija de "Continuar/Pagar" en móvil. Mismo problema que en la
     * ficha de detalle (ver alojamiento-detalle.component.ts): por debajo de
     * 1024px el formulario de cada paso puede ser largo y el botón para
     * avanzar queda al final, obligando a bajar toda la pantalla para verlo.
     * En escritorio se deja tal cual, dentro del flujo normal de la tarjeta.
     */
    @media (max-width: 1024px) {
      .wizard-wrap { padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)); }

      .wizard-cta,
      .wizard-nav {
        position: fixed;
        inset: auto 0 0 0;
        z-index: var(--z-2);
        margin-top: 0;
        padding: var(--sp-3) var(--sp-5);
        padding-bottom: calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
        background: var(--c-card);
        border-top: 1px solid var(--b-1);
        box-shadow: 0 -8px 24px rgba(8, 37, 139, .10);
        flex-wrap: nowrap;
      }

      /*
       * flex:1 solo no basta: por defecto un flex item no encoge por debajo
       * del ancho de su contenido (min-width:auto), así que "Continuar" se
       * quedaba con casi todo el ancho y "Atrás" con una franja mínima.
       * min-width:0 permite repartir el espacio a partes iguales de verdad;
       * el ellipsis es red de seguridad si el texto no cabe ni así.
       */
      .wizard-cta .rs-btn,
      .wizard-nav .rs-btn {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .wizard-steps { justify-content: center; margin-bottom: var(--sp-10); padding: var(--sp-6); background: var(--c-raised); border-radius: var(--r-xl); border: 1px solid var(--b-1); }
    @media (max-width: 640px) {
      .wizard-steps { padding: var(--sp-4) var(--sp-3); margin-bottom: var(--sp-6); }
    }

    /* Gancho para completar el viaje tras reservar alojamiento. */
    .completar-viaje {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-5); flex-wrap: wrap;
      margin-top: var(--sp-6); padding: var(--sp-5);
      border: 1px solid rgba(251,174,23,.4); border-radius: var(--r-xl);
      background: rgba(251,174,23,.08);
      text-align: left;

      h3 { font-size: var(--f-md); color: var(--dk-blue); margin-bottom: var(--sp-1); }
      p { font-size: var(--f-sm); color: var(--t-400); line-height: 1.55; max-width: 52ch; }

      /* Sin esto el botón se queda con el ancho de su texto, alineado a la
         izquierda, mientras el resto de la pantalla va centrado. */
      @media (max-width: 640px) {
        align-items: stretch;
        .rs-btn { width: 100%; }
      }
    }

    /* Envoltorio para que el autocompletado de direcciones se vea como un input. */
    .rs-inp--host { display: flex; align-items: center; padding-block: 0; }
    .rs-inp--host rs-place-autocomplete { flex: 1; min-width: 0; }

    /* Contador de perros: sin tope superior, a diferencia del antiguo desplegable. */
    .contador {
      display: inline-flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--b-2); border-radius: var(--r-lg);
      background: var(--c-card);

      button {
        width: 36px; height: 36px; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: var(--f-lg); line-height: 1; font-weight: var(--w-6);
        border: 1px solid var(--b-2); border-radius: 50%;
        background: var(--c-card); color: var(--dk-blue); cursor: pointer;
        transition: background var(--d-2), border-color var(--d-2);

        &:hover:not(:disabled) { background: var(--c-accent-lo); border-color: var(--c-accent); }
        &:disabled { opacity: .4; cursor: not-allowed; }
      }

      output { min-width: 28px; text-align: center; font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); }
    }

    /*
     * minmax(0, 1fr) en lugar de 1fr: por defecto una celda de grid no encoge
     * por debajo del min-content de lo que lleva dentro, así que cualquier
     * elemento ancho del formulario (un input con su ancho intrínseco, una
     * palabra larga) estiraba la columna y sacaba toda la página del móvil.
     */
    .wizard-body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: var(--sp-8);
      align-items: start;
      @media (max-width: 1024px) { grid-template-columns: minmax(0, 1fr); }
    }

    .wizard-card {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-2xl);
      padding: var(--sp-8);
      animation: scaleIn var(--d-3) ease;

      /* 32px de margen interior a cada lado se comen un tercio de un móvil
         estrecho y dejan los campos del formulario sin sitio. */
      @media (max-width: 640px) { padding: var(--sp-5); }
    }

    .wizard-card__title {
      font-size: var(--f-2xl);
      font-weight: var(--w-8);
      color: var(--t-100);
      margin-bottom: var(--sp-8);
      letter-spacing: -.02em;
    }

    .reserva-summary__service {
      display: flex;
      gap: var(--sp-4);
      padding: var(--sp-4);
      background: var(--c-raised);
      border-radius: var(--r-lg);
      margin-bottom: var(--sp-6);

      img { width: 100px; height: 80px; object-fit: cover; border-radius: var(--r-md); flex-shrink: 0; }
      h3  { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2); }
      p   { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-3); }
    }
    .reserva-summary__tags { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .reserva-summary__viaje {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2);
      margin: var(--sp-3) 0 0;
      padding-top: var(--sp-3);
      border-top: 1px solid var(--b-1);
      font-size: var(--f-sm);
      color: var(--t-300);
    }
    .reserva-summary__dato { display: inline-flex; align-items: center; gap: 4px; }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-4);
      margin-bottom: var(--sp-5);
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }

    .rs-field { margin-bottom: var(--sp-5); }
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); display: block; }

    /* Bloques informativos del paso 1 (HU-5.3.4/5.4.3/5.4.4/5.6.1) */
    .info-block {
      margin-top: var(--sp-6);
      padding: var(--sp-4);
      background: var(--c-raised);
      border-radius: var(--r-lg);
      h3 { font-size: var(--f-sm); font-weight: var(--fw-bold); margin: 0 0 var(--sp-3); }
      ul, ol { margin: 0; padding-left: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-2); }
      li { font-size: var(--f-sm); color: var(--t-300); line-height: 1.6; }
    }
    /* Listas con icono Lucide en línea (TCK-8010: nada de emojis ni pseudo-elementos). */
    .info-block__checks, .info-block__iconos {
      list-style: none; padding-left: 0;
      li { display: flex; align-items: center; gap: var(--sp-2); }
      rs-icon { flex-shrink: 0; }
    }
    .info-block__checks rs-icon { color: var(--c-success); }
    .info-block__iconos rs-icon { color: var(--c-accent); }

    .extras-section { margin-block: var(--sp-6); h3 { font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100); margin-bottom: var(--sp-4); } }
    .extras-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-3); }
    .checks-grid { display: flex; flex-wrap: wrap; gap: var(--sp-3); }
    .videos-lista { list-style: none; display: flex; flex-direction: column; gap: var(--sp-1); margin-top: var(--sp-2); padding: 0; }
    .videos-lista li { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); }
    .extra-item {
      display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4);
      background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      cursor: pointer; transition: all var(--d-2);
      input { display: none; }
      &.selected { border-color: var(--c-accent); background: var(--c-accent-lo); }
      &:hover:not(.selected) { border-color: var(--b-2); }
    }
    .extra-item__icon { font-size: 1.5rem; }
    .extra-item__name { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .extra-item__price { font-size: var(--f-xs); color: var(--t-400); }

    .wizard-nav { display: flex; justify-content: space-between; align-items: center; margin-top: var(--sp-8); gap: var(--sp-4); flex-wrap: wrap; }

    .consent-box { margin-block: var(--sp-5); font-size: var(--f-sm); color: var(--t-300); label { display: flex; align-items: flex-start; gap: var(--sp-3); input { margin-top: 2px; accent-color: var(--c-accent); } } }

    .payment-options { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-6); }
    .payment-option {
      display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4) var(--sp-5);
      background: var(--c-raised); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      cursor: pointer; transition: all var(--d-2);
      input { accent-color: var(--c-accent); }
      &.selected { border-color: var(--c-accent); background: var(--c-accent-lo); }
    }
    .payment-option__icon { font-size: 1.5rem; }
    .payment-option__name { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .payment-option__brands { display: flex; align-items: center; gap: var(--sp-1); margin-top: 2px; }
    .payment-option__secure { margin-left: auto; font-size: var(--f-xs); color: var(--t-400); }

    .stripe-placeholder { background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-xl); padding: var(--sp-6); margin-bottom: var(--sp-5); }
    .stripe-placeholder__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-5); font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }

    .confirmation {
      text-align: center;
      padding: var(--sp-16) var(--sp-8);

      /* 32px a cada lado dejan el contenido en menos de 280px en un móvil
         estrecho: el código de reserva se partía en dos líneas. */
      @media (max-width: 640px) { padding: var(--sp-10) var(--sp-5); }
    }
    .confirmation__icon { font-size: 4rem; margin-bottom: var(--sp-4); animation: float 3s ease-in-out infinite; }
    .confirmation h2 { font-size: var(--f-4xl); font-weight: var(--w-9); color: var(--t-100); margin-bottom: var(--sp-4); }
    .confirmation p  { color: var(--t-300); margin-bottom: var(--sp-8); }
    .confirmation__code { margin-bottom: var(--sp-6); }
    .code-box {
      font-size: var(--f-3xl); font-weight: var(--w-9); letter-spacing: .1em;
      background: var(--g-accent); -webkit-background-clip: text;
      -webkit-text-fill-color: transparent; background-clip: text;
      margin-top: var(--sp-3);

      /* El código es una unidad: partido en dos líneas deja de leerse como tal. */
      @media (max-width: 640px) { font-size: var(--f-2xl); letter-spacing: .06em; }
    }
    .confirmation__details { padding: var(--sp-6); text-align: left; margin-bottom: var(--sp-8); }
    .cd-row {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: var(--sp-4);
      padding: var(--sp-3) 0; border-bottom: 1px solid var(--b-1);
      font-size: var(--f-sm); color: var(--t-300);

      span { flex-shrink: 0; }
      strong { color: var(--t-100); text-align: right; min-width: 0; }
      &:last-child { border: none; }
    }
    /*
     * Los dos botones de cierre tienen que leerse como un par.
     * "Ver mis reservas" era --lg y "Seguir explorando" del tamaño por defecto:
     * uno al lado del otro con distinto cuerpo de letra (16 vs 13 px) y distinto
     * radio (20 vs 16 px). En móvil, además, cada uno se quedaba con el ancho de
     * su texto y las dos cajas salían escalonadas.
     */
    .confirmation__actions {
      display: flex; gap: var(--sp-4); justify-content: center; flex-wrap: wrap;
      /* El gancho de viaje que va justo encima no trae margen inferior: sin
         esto los botones quedaban pegados a su panel. */
      margin-block: var(--sp-8);

      @media (max-width: 640px) {
        flex-direction: column;
        align-items: stretch;
      }
    }

    /* Atajo de pruebas: se distingue del pago de verdad a simple vista. */
    .bypass {
      margin-top: var(--sp-5);
      padding: var(--sp-4);
      border: 1px dashed var(--b-2);
      border-radius: var(--r-xl);
      background: var(--c-raised);
    }
    .bypass__aviso {
      display: flex; align-items: flex-start; gap: var(--sp-2);
      margin-bottom: var(--sp-3);
      font-size: var(--f-xs); color: var(--t-400); line-height: 1.5;

      rs-icon { flex-shrink: 0; margin-top: 1px; }
    }

    /* ══ VALORACIÓN DEL PROCESO ═══════════════════════════════════════ */
    .valoracion {
      margin-top: var(--sp-8); padding-top: var(--sp-6);
      border-top: 1px solid var(--b-1); text-align: center;
    }
    .valoracion__pregunta { font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-3); }
    .valoracion__gracias {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--c-success, var(--dk-blue));
    }
    .valoracion__estrellas { display: flex; justify-content: center; gap: var(--sp-1); }
    .valoracion__estrella {
      /* 44px de objetivo táctil: las estrellas se fallan con el pulgar. */
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; padding: 0;
      border: none; background: transparent; cursor: pointer;
      color: var(--t-400); transition: color var(--d-1), transform var(--d-1);

      &:hover { color: var(--dk-gold); transform: scale(1.1); }
    }
    /* Sin anidar: &--activa no es CSS nativo, y estos estilos no pasan por Sass. */
    .valoracion__estrella--activa { color: var(--dk-gold); }
    .valoracion__motivo {
      max-width: 420px; margin: var(--sp-4) auto 0; text-align: left;
      display: flex; flex-direction: column; gap: var(--sp-2);
      /* stretch, no flex-start: la etiqueta y el campo ocupan el ancho y el
         botón se quedaba solo, descolgado contra el margen izquierdo. */
      align-items: stretch;

      .rs-btn { align-self: flex-end; }
    }

    /* ══ PREGUNTAS FRECUENTES ═════════════════════════════════════════ */
    .faq {
      margin-top: var(--sp-8); padding-top: var(--sp-6);
      border-top: 1px solid var(--b-1); text-align: left;
    }
    .faq__titulo {
      font-size: var(--f-md); font-weight: var(--w-7);
      color: var(--t-100); margin-bottom: var(--sp-4);
    }
    /* details/summary nativos: accesibles y operables con teclado sin JS. */
    .faq__item { border-bottom: 1px solid var(--b-1); }
    .faq__pregunta {
      display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
      padding: var(--sp-4) 0; cursor: pointer; list-style: none;
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100);

      &::-webkit-details-marker { display: none; }
    }
    .faq__chevron { flex-shrink: 0; color: var(--t-400); transition: transform var(--d-1); }
    .faq__item[open] .faq__chevron { transform: rotate(180deg); }
    .faq__respuesta {
      padding-bottom: var(--sp-4);
      font-size: var(--f-sm); color: var(--t-300); line-height: 1.6;
    }
    .faq__mas {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-4);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--c-accent);
    }

    .price-summary { position: sticky; top: 84px; }
    .price-summary__card { background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-2xl); padding: var(--sp-6); box-shadow: var(--sh-xl); h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-6); } }
    .price-row { display: flex; justify-content: space-between; font-size: var(--f-sm); color: var(--t-300); margin-bottom: var(--sp-3); }
    .price-row--sub { color: var(--t-400); }
    .price-iva { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .price-row--total { color: var(--t-100); font-weight: var(--w-8); font-size: var(--f-md); }
    .price-trust { display: flex; flex-direction: column; gap: var(--sp-2); p { font-size: var(--f-xs); color: var(--t-400); } }
    .cupon-box { margin-top: var(--sp-4); }
    .cupon-box__row { display: flex; gap: var(--sp-2); .rs-inp { flex: 1; } }
    .cupon-box__quitar { margin-left: var(--sp-3); text-decoration: underline; color: inherit; font-size: var(--f-xs); }

    .filter-check { display: flex; align-items: flex-start; gap: var(--sp-3); cursor: pointer; }

    .perro-picker { margin-bottom: var(--sp-6); }
    .perro-picker__empty { font-size: var(--f-sm); color: var(--t-400); a { color: var(--c-accent); } }
    .perro-picker__list { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
    .perro-card {
      position: relative;
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-2) var(--sp-4) var(--sp-2) var(--sp-2);
      border-radius: var(--r-lg);
      border: 1.5px solid var(--b-2); background: var(--c-raised);
      cursor: pointer; transition: all var(--d-2); text-align: left;

      img { width: 44px; height: 44px; border-radius: var(--r-full); object-fit: cover; flex-shrink: 0; }

      &:hover { border-color: var(--c-accent); }
      &.selected { background: var(--c-accent-lo); border-color: var(--c-accent); box-shadow: var(--sh-sm); }
    }
    .perro-card__body { display: flex; flex-direction: column; gap: 2px; }
    .perro-card__body strong { font-size: var(--f-sm); color: var(--t-100); }
    .perro-card__meta { font-size: var(--f-xs); color: var(--t-400); }
    .perro-card__check {
      position: absolute; top: -6px; right: -6px;
      width: 20px; height: 20px; border-radius: var(--r-full);
      background: var(--c-accent); color: #fff; font-size: var(--f-xs);
      display: flex; align-items: center; justify-content: center;
    }
  `],
})
export class ReservaWizardComponent implements OnInit {
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly fb             = inject(FormBuilder);
  private readonly stripeService  = inject(StripeService);
  private readonly reservasService = inject(ReservasService);
  private readonly http = inject(HttpClient);
  private readonly paymentsService = inject(PaymentsService);
  private readonly cuponesService  = inject(CuponesService);
  private readonly perrosService   = inject(PerrosService);
  private readonly recomendadorService = inject(RecomendadorService);
  private readonly catalogBrowseService = inject(CatalogBrowseService);
  private readonly geoService = inject(GeoService);
  private readonly eventosService = inject(EventosService);
  private readonly auth = inject(AuthService);
  private readonly diagnostico = inject(DiagnosticoSubidaService);

  /** Escala de tamaños del dominio; ver `TAMANOS_PERRO` en shared. */
  readonly tamanosPerro = TAMANOS_PERRO;

  // Navigation
  readonly paso       = signal<Paso>(1);
  readonly procesando = signal(false);

  /**
   * ¿Deja este entorno confirmar sin pagar? Lo dice el API: decidirlo en el
   * cliente sacaría el botón donde el servidor lo va a rechazar.
   */
  readonly bypassDisponible = signal(false);
  readonly metodoPago = signal<'card' | 'bizum'>('card');
  readonly codigoReserva = signal('');

  // Vertical context (populated from route/query params)
  readonly vertical       = signal<string>(VerticalKey.ALOJAMIENTO);
  readonly nombreServicio = signal<string>('');
  /** Ciudad del servicio reservado; propaga el destino al resto del viaje. */
  readonly ciudadServicio = signal<string>('');
  readonly imagenServicio = signal<string>('');
  readonly precioBase     = signal<number>(0);

  // Stripe
  readonly stripeListo = signal(false);
  /**
   * El cobro se hizo pero el servidor todavía no ha podido dar la reserva por
   * confirmada. Se dice en pantalla en vez de callarlo: si no, el cliente ve
   * "confirmada" aquí y "pendiente de pago" en su listado.
   */
  readonly confirmacionPendiente = signal(false);
  readonly errorPago   = signal<string | null>(null);
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private clientSecret: string | null = null;
  /** Pago abierto para esta reserva; con él se pregunta a la pasarela cómo quedó. */
  private pagoId: string | null = null;
  private servicioId?: string;
  private comercioId?: string;
  private espacioId: string | null = null;
  /**
   * Id de la reserva creada al entrar en el paso 3. Es signal porque la
   * plantilla lo necesita: sin reserva creada no hay nada que confirmar, ni
   * pagando ni con el atajo de pruebas, y el botón tiene que decirlo.
   */
  readonly reservaIdReal = signal<string | null>(null);
  readonly totalFromApi = signal<number | null>(null);

  /**
   * ¿Se puede reservar con lo elegido en el paso 1?
   *
   * Antes esto sólo se sabía al entrar en el paso 3, cuando se creaba la
   * reserva: el cliente rellenaba sus datos para chocar al final con un
   * "no disponible" y con un botón de confirmar que ya no podía funcionar
   * porque nunca hubo reserva. Se consulta aquí, donde se eligen las fechas.
   */
  readonly disponibilidad = signal<EstadoDisponibilidad>({ estado: 'idle' });
  private temporizadorDisponibilidad?: ReturnType<typeof setTimeout>;
  /** Descarta respuestas de consultas que ya no son la última. */
  private consultaDisponibilidad = 0;

  /**
   * Noches con plaza del servicio, para el calendario del paso 1.
   *
   * Se acumulan por mes: al navegar el cliente va pidiendo meses nuevos y los
   * ya cargados se quedan, para que volver atrás no vuelva a pedirlos ni deje
   * el calendario en blanco un instante.
   */
  readonly diasCalendario = signal<DiaCalendarioApi[]>([]);
  readonly cargandoCalendario = signal(false);
  private readonly mesesCargados = new Set<string>();

  // Ficha Inteligente: perro para el que se reserva (opcional, filtra/precalcula en fases futuras).
  readonly perros = signal<PerroApi[]>([]);
  readonly perroSeleccionado = signal<string | null>(null);
  /** Presupuesto ajustado por el historial del perro (Ref. N8), solo informativo. */
  readonly estimacionPrecio = signal<EstimacionPrecioApi | null>(null);
  readonly imgFallback = IMG_FALLBACK;

  /** Edad legible a partir de la fecha de nacimiento (HU-5.1.3); null si no está declarada. */
  edadDe(p: PerroApi): string | null {
    if (!p.fechaNacimiento) return null;
    const nacimiento = new Date(p.fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;
    const meses = (Date.now() - nacimiento.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (meses < 12) return `${Math.max(1, Math.round(meses))} meses`;
    const anios = Math.floor(meses / 12);
    return `${anios} ${anios === 1 ? 'año' : 'años'}`;
  }

  // Recomendador de servicio (motivo/gravedad → recomendación, Fase B).
  readonly recomendacionAdiestramiento = signal<RecomendacionAdiestramiento | null>(null);
  readonly recomendacionVeterinaria = signal<RecomendacionVeterinaria | null>(null);

  // Enriquecimiento de peluquería (Fase C): catálogo real de grooming filtrado por perro.
  readonly peluqueriaDetalle = signal<PeluqueriaDetalleWizard | null>(null);
  readonly perroSeleccionadoObj = computed(() =>
    this.perros().find((p) => p._id === this.perroSeleccionado()) ?? null,
  );
  readonly serviciosGroomingOpciones = computed(() => {
    const todos = this.peluqueriaDetalle()?.serviciosGrooming ?? [];
    const tipoPeloPerro = this.perroSeleccionadoObj()?.tipoPelo ?? [];
    if (!tipoPeloPerro.length) return todos;
    return todos.filter(
      (s) => !s.tipoPeloCompatible?.length || s.tipoPeloCompatible.some((t) => tipoPeloPerro.includes(t)),
    );
  });
  readonly politicaTemperamentoLabel = computed(() => {
    const politica = this.peluqueriaDetalle()?.politicaTemperamentoDificil;
    return politica ? POLITICA_TEMPERAMENTO_LABEL[politica] ?? null : null;
  });
  readonly serviciosAdicionalesResumen = computed(() => {
    const lista = this.peluqueriaDetalle()?.serviciosAdicionales ?? [];
    return lista.map((a) => `${a.nombre} (${euros(a.precio)})`).join(' · ');
  });

  // Enriquecimiento de veterinaria (Fase C): catálogo real de servicios clínicos.
  readonly serviciosClinicosDisponibles = signal<ServicioClinicoWizard[]>([]);
  servicioClinicoSeleccionado(): ServicioClinicoWizard | undefined {
    const nombre = this.paso1VeterinariaForm.value.servicio;
    return this.serviciosClinicosDisponibles().find((s) => s.nombre === nombre);
  }

  // Enriquecimiento de adiestramiento (Fase C): catálogo real de servicios/técnicas.
  readonly serviciosAdiestramientoDisponibles = signal<ServicioAdiestramientoWizard[]>([]);

  /** Método (no computed): depende del valor del FormGroup, que no es una señal reactiva. */
  serviciosAdiestramientoOpciones(): ServicioAdiestramientoWizard[] {
    const edad = Number(this.paso1AdiestramientoForm.value.edadMeses ?? 0);
    return this.serviciosAdiestramientoDisponibles().filter((s) => {
      if (s.edadMinimaMeses !== undefined && edad < s.edadMinimaMeses) return false;
      if (s.edadMaximaMeses !== undefined && edad > s.edadMaximaMeses) return false;
      return true;
    });
  }

  precioServicioGrooming(s: ServicioGroomingWizard): number {
    const tamanoPerro = this.perroSeleccionadoObj()?.tamano;
    const tier = tamanoPerro ? s.preciosPorTamano?.find((t) => t.tamano === tamanoPerro) : undefined;
    return tier?.precio ?? s.precio;
  }

  /**
   * Duración del servicio de grooming elegido (HU-5.3.2). Igual que el precio,
   * puede depender del tamaño del perro. `null` si el salón no la ha configurado:
   * preferimos no decir nada a inventar una estimación.
   */
  readonly duracionGroomingElegida = computed(() => {
    this.revisionFormularios();
    const nombre = this.paso1PeluqueriaForm.value.servicio;
    const servicio = this.serviciosGroomingOpciones().find((s) => s.nombre === nombre);
    if (!servicio) return null;

    const tamanoPerro = this.perroSeleccionadoObj()?.tamano;
    const tier = tamanoPerro ? servicio.preciosPorTamano?.find((t) => t.tamano === tamanoPerro) : undefined;
    return tier?.duracionMin ?? servicio.duracionMin ?? null;
  });

  metodoPagoVal = 'card';

  /**
   * El gancho de viaje solo aparece tras reservar alojamiento u hotel: son los
   * verticales que definen unas fechas y un destino sobre los que tiene sentido
   * añadir el resto de servicios.
   */
  readonly ofreceCompletarViaje = computed(
    () => this.vertical() === VerticalKey.ALOJAMIENTO || this.vertical() === VerticalKey.HOTELES,
  );

  /** Lleva al siguiente servicio con las fechas y la ciudad ya puestas. */
  parametrosViaje(): Record<string, string> {
    const form = this.vertical() === VerticalKey.HOTELES
      ? this.paso1HotelesForm.value
      : this.paso1AlojamientoForm.value;

    const params: Record<string, string> = {};
    if (this.ciudadServicio()) params['ciudad'] = this.ciudadServicio();
    if (form.checkIn) params['desde'] = form.checkIn;
    return params;
  }

  /** Tarjetas admitidas, mostradas con su marca y no con el nombre (TCK-8008). */
  readonly marcasTarjeta: readonly MarcaPagoKey[] = ['visa', 'mastercard', 'amex'];

  readonly idPerrosAlojamiento = 'wz-perros-alojamiento';
  readonly idPerrosTransporte = 'wz-perros-transporte';

  // ─── Trayecto de transporte: la distancia se calcula sola (DK-V03) ───
  private readonly origenPlaceId = signal<string | null>(null);
  private readonly destinoPlaceId = signal<string | null>(null);
  readonly calculandoTrayecto = signal(false);
  readonly resumenTrayecto = signal('');

  fijarOrigen(lugar: LugarElegido): void {
    this.origenPlaceId.set(lugar.placeId ?? null);
    void this.calcularTrayecto();
  }

  fijarDestino(lugar: LugarElegido): void {
    this.destinoPlaceId.set(lugar.placeId ?? null);
    void this.calcularTrayecto();
  }

  /**
   * Rellena la distancia en cuanto hay origen y destino. El campo sigue siendo
   * editable: si el cliente sabe que su ruta real es otra, manda su dato.
   */
  private async calcularTrayecto(): Promise<void> {
    const origen = this.origenPlaceId();
    const destino = this.destinoPlaceId();
    if (!origen || !destino) return;

    this.calculandoTrayecto.set(true);
    this.resumenTrayecto.set('');
    try {
      const trayecto = await this.geoService.trayecto(origen, destino);
      if (!trayecto) {
        this.resumenTrayecto.set('No hemos podido calcularla; indícala tú para ver el precio.');
        return;
      }

      this.paso1TransporteForm.patchValue({ distanciaKm: trayecto.km });
      this.resumenTrayecto.set(
        trayecto.esEstimacion
          ? `≈ ${trayecto.km} km · ${trayecto.duracionMin} min (estimación aproximada)`
          : `${trayecto.km} km · ${trayecto.duracionMin} min por carretera`,
      );
    } finally {
      this.calculandoTrayecto.set(false);
    }
  }

  /** Suma o resta perros a la reserva. Mínimo 1; sin máximo (S3). */
  cambiarPerros(control: AbstractControl, delta: number): void {
    const actual = Number(control.value) || 1;
    control.setValue(Math.max(1, actual + delta));
  }

  puedeQuitarPerros(control: AbstractControl): boolean {
    return (Number(control.value) || 1) > 1;
  }

  // ─── Step 1 forms (one per vertical) ───
  readonly paso1AlojamientoForm = this.fb.group({
    checkIn:     ['', Validators.required],
    checkOut:    ['', Validators.required],
    // Sin `max`: quien viaja con seis perros debe poder reservar para seis.
    perros:      [1, [Validators.required, Validators.min(1)]],
    tamanoPerro: ['mediano', Validators.required],
    compatibilidadSocial: ['cualquiera'],
  });

  readonly paso1TransporteForm = this.fb.group({
    fechaRecogida: ['', Validators.required],
    hora:          ['', Validators.required],
    origen:        ['', Validators.required],
    destino:       ['', Validators.required],
    distanciaKm:   [10, [Validators.required, Validators.min(1)]],
    perros:        [1],
  });

  /** Ida y vuelta con espera, como un solo servicio (Ref. TRA4). */
  readonly esIdaVuelta = signal(false);
  readonly esperaMinutos = signal(30);

  /** Trayectos recurrentes (Ref. TRA3): el motor ya existe en el backend, esto es solo la UI. */
  readonly esRecurrente = signal(false);
  readonly diasSemanaSelec = signal<number[]>([]);
  readonly fechaFinRecurrencia = signal('');
  readonly diasSemanaOpciones: ReadonlyArray<{ valor: number; label: string }> = [
    { valor: 1, label: 'Lun' }, { valor: 2, label: 'Mar' }, { valor: 3, label: 'Mié' },
    { valor: 4, label: 'Jue' }, { valor: 5, label: 'Vie' }, { valor: 6, label: 'Sáb' },
    { valor: 0, label: 'Dom' },
  ];
  toggleDiaSemana(dia: number): void {
    this.diasSemanaSelec.update((l) => (l.includes(dia) ? l.filter((d) => d !== dia) : [...l, dia]));
  }
  tieneDiaSemana(dia: number): boolean { return this.diasSemanaSelec().includes(dia); }

  readonly paso1VeterinariaForm = this.fb.group({
    fecha:    ['', Validators.required],
    hora:     ['', Validators.required],
    servicio: ['consulta'],
    motivoTriage: ['revision_general'],
    gravedad: ['leve'],
  });

  readonly paso1PeluqueriaForm = this.fb.group({
    fecha:    ['', Validators.required],
    hora:     ['', Validators.required],
    servicio: ['bano', Validators.required],
  });

  readonly paso1AdiestramientoForm = this.fb.group({
    fechaInicio: ['', Validators.required],
    modalidad:   ['sesion', Validators.required],
    edadMeses:   [12, [Validators.min(0), Validators.max(240)]],
    motivo:      ['obediencia_basica'],
    intensidad:  ['leve'],
    servicio:    [''],
    descripcionComportamiento: [''],
    // Cuestionario ampliado (Ref. ADI2)
    historialPrevio: [''],
    vinculoPropietario: [''],
  });

  /** Vídeos del comportamiento subidos por el cliente (Ref. ADI3). */
  readonly videosComportamiento = signal<string[]>([]);
  readonly subiendoVideo = signal(false);
  readonly errorVideo = signal<string | null>(null);

  async subirVideoComportamiento(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    this.errorVideo.set(null);
    this.subiendoVideo.set(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${environment.apiUrl}/upload/video`, formData),
      );
      this.videosComportamiento.update((v) => [...v, res.url]);
      this.diagnostico.registrar({
        paso: 'subida', destino: 'video', origen: 'reserva/comportamiento', fichero: file,
      });
    } catch (error) {
      /*
       * El vídeo no pasa por ninguna conversión: un .mov de iPhone se sube tal
       * cual y son fáciles de pasar de 50 MB. El parte dice cuál de las dos
       * cosas fue.
       */
      this.diagnostico.registrarFalloHttp(
        { destino: 'video', origen: 'reserva/comportamiento', fichero: file }, error,
      );
      this.errorVideo.set('No se pudo subir el vídeo. Comprueba el formato (MP4/WebM/MOV) y que pese menos de 50 MB.');
    } finally {
      this.subiendoVideo.set(false);
      input.value = '';
    }
  }

  quitarVideoComportamiento(indice: number): void {
    this.videosComportamiento.update((v) => v.filter((_, i) => i !== indice));
  }

  /**
   * HU-5.7.1 — En hoteles la unidad reservable es el viaje completo (personas +
   * mascotas), no solo la estancia del perro: el paso 1 pide únicamente lo que
   * afecta a disponibilidad y precio; los datos personales viven en el paso 2.
   */
  readonly paso1HotelesForm = this.fb.group({
    checkIn:   ['', Validators.required],
    checkOut:  ['', Validators.required],
    adultos:   [2, [Validators.required, Validators.min(1), Validators.max(10)]],
    ninos:     [0, [Validators.required, Validators.min(0), Validators.max(10)]],
    mascotas:  [1, [Validators.required, Validators.min(1), Validators.max(3)]],
    tamanoPerro: ['mediano', Validators.required],
    observaciones: [''],
  });

  readonly paso1FunerariosForm = this.fb.group({
    servicioNombre:    ['', Validators.required],
    especie:           ['Perro', Validators.required],
    pesoKg:            [0, [Validators.required, Validators.min(0.1)]],
    necesitaRecogida:  [false],
    lugarRecogida:     [LugarRecogida.DOMICILIO as string],
    distanciaKm:       [0, [Validators.min(0)]],
    zonaRecogida:      [''],
    direccionRecogida: [''],
    urgencia:          [UrgenciaFunerario.LO_ANTES_POSIBLE as string, Validators.required],
    franja:            [FranjaHoraria.MANANA as string, Validators.required],
    fecha:             [''],
    aceptaSinCenizas:  [false],
  });

  /** Extras marcados por el cliente; van por señal y no por control, son una lista. */
  readonly extrasFunerarioElegidos = signal<string[]>([]);

  /** Ficha de la empresa funeraria, tal y como la publica el panel del comercio. */
  private readonly fichaFunerario = signal<Record<string, unknown>>({});

  readonly especiesFunerario = ESPECIES_FUNERARIO;

  readonly urgenciasFunerario = Object.values(UrgenciaFunerario)
    .map((valor) => ({ valor: valor as string, label: URGENCIA_FUNERARIO_LABELS[valor] }));

  readonly serviciosFunerariosDisponibles = computed(() => serviciosFunerarios(this.fichaFunerario()));
  readonly extrasFunerariosDisponibles = computed(() => extrasFunerarios(this.fichaFunerario()));

  readonly ofreceRecogida = computed(() => this.fichaFunerario()['ofreceRecogida'] === true);
  readonly radioRecogidaKm = computed(() => (this.fichaFunerario()['radioRecogidaKm'] as number) ?? 0);

  readonly zonasRecogidaDisponibles = computed(() => {
    const modo = this.fichaFunerario()['modoPrecioRecogida'];
    if (modo !== ModoPrecioRecogida.POR_ZONA) return [];
    return (this.fichaFunerario()['zonasRecogida'] as Array<{ nombre: string; precio: number }> | undefined) ?? [];
  });

  /** Sólo los lugares desde los que esta empresa recoge; sin lista, todos. */
  readonly lugaresRecogidaDisponibles = computed(() => {
    const declarados = (this.fichaFunerario()['lugaresRecogida'] as string[] | undefined) ?? [];
    const todos = Object.values(LugarRecogida)
      .map((valor) => ({ valor: valor as string, label: LUGAR_RECOGIDA_LABELS[valor] }));
    return declarados.length ? todos.filter((l) => declarados.includes(l.valor)) : todos;
  });

  readonly franjasFunerarioDisponibles = computed(() => {
    const declaradas = (this.fichaFunerario()['franjasDisponibles'] as string[] | undefined) ?? [];
    const todas = Object.values(FranjaHoraria)
      .map((valor) => ({ valor: valor as string, label: FRANJA_HORARIA_LABELS[valor] }));
    return declaradas.length ? todas.filter((f) => declaradas.includes(f.valor)) : todas;
  });

  readonly politicaCancelacionFunerario = computed(() =>
    this.fichaFunerario()['politicaCancelacionFunerario'] as
      { reembolsoAntesRecogidaPct: number; reembolsoIniciadoPct: number; notas?: string } | undefined,
  );

  /** Servicio elegido en el desplegable, con todo lo que declara la empresa. */
  readonly servicioFunerarioElegido = computed(() => {
    this.revisionFormularios();
    const nombre = this.paso1FunerariosForm.value.servicioNombre;
    return this.serviciosFunerariosDisponibles().find((sv) => sv.nombre === nombre);
  });

  tieneExtraFunerario(nombre: string): boolean { return this.extrasFunerarioElegidos().includes(nombre); }

  toggleExtraFunerario(nombre: string): void {
    this.extrasFunerarioElegidos.update((lista) =>
      lista.includes(nombre) ? lista.filter((n) => n !== nombre) : [...lista, nombre],
    );
  }

  /**
   * Lo que el formulario no puede expresar con validadores: aceptar que no hay
   * cenizas cuando el servicio no las devuelve, y no pedir una recogida a quien
   * no la hace o fuera de su radio. El backend lo vuelve a comprobar; esto es
   * para no dejar avanzar y que el rechazo llegue al pagar.
   */
  private funerarioListoParaSeguir(): boolean {
    const f = this.paso1FunerariosForm.value;
    const servicio = this.servicioFunerarioElegido();
    if (!servicio) return false;
    if (!servicio.devuelveCenizas && !f.aceptaSinCenizas) return false;

    if (f.necesitaRecogida) {
      if (!this.ofreceRecogida()) return false;
      if (Number(f.distanciaKm ?? 0) > this.radioRecogidaKm()) return false;
      if (this.zonasRecogidaDisponibles().length && !f.zonaRecogida) return false;
    }
    if (f.urgencia === UrgenciaFunerario.FECHA && !f.fecha) return false;
    return true;
  }

  /**
   * Fecha de inicio del servicio. "Lo antes posible" y "hoy" son ahora mismo;
   * "mañana", el día siguiente; y sólo "elegir fecha" trae una del calendario.
   * La hora sale de la franja, porque aquí no se promete una hora exacta.
   */
  private fechaInicioFunerario(): string {
    const f = this.paso1FunerariosForm.value;
    const horaDeFranja: Record<string, string> = {
      [FranjaHoraria.MANANA]: '09:00',
      [FranjaHoraria.TARDE]: '16:00',
      [FranjaHoraria.NOCHE]: '21:00',
    };
    const hora = horaDeFranja[f.franja ?? FranjaHoraria.MANANA] ?? '09:00';

    if (f.urgencia === UrgenciaFunerario.FECHA && f.fecha) return `${f.fecha}T${hora}:00`;

    const dia = new Date();
    if (f.urgencia === UrgenciaFunerario.MANANA) dia.setDate(dia.getDate() + 1);
    if (f.urgencia === UrgenciaFunerario.LO_ANTES_POSIBLE) return dia.toISOString();

    return `${dia.toISOString().slice(0, 10)}T${hora}:00`;
  }

  // ─── Step 2 (shared) ───
  // ─── Confirmación: valoración del proceso y preguntas frecuentes ───

  readonly estrellas = [1, 2, 3, 4, 5] as const;
  readonly valoracion = signal<number | null>(null);
  readonly valoracionEnviada = signal(false);
  readonly motivoValoracion = signal('');

  /** Preguntas de la categoría reservada, para la pantalla de confirmación. */
  readonly faq = computed(() => faqDeConfirmacion(this.vertical()));

  /**
   * Por debajo del aprobado se pregunta qué falló. Con cuatro o cinco estrellas
   * no se pregunta nada: alargar el formulario a quien ha ido bien sólo sirve
   * para que no vuelva a valorar la próxima vez.
   */
  readonly pideMotivoValoracion = computed(() => {
    const nota = this.valoracion();
    return nota !== null && nota <= 3;
  });

  /**
   * Registra la nota del proceso de reserva.
   *
   * Con 4 o 5 estrellas se cierra al momento; con 3 o menos se deja abierto el
   * campo del motivo, y el evento viaja igual —si el usuario se va sin
   * escribir, la nota no se pierde.
   */
  valorarExperiencia(nota: number): void {
    this.valoracion.set(nota);
    this.registrarValoracion(nota);
    if (nota > 3) this.valoracionEnviada.set(true);
  }

  /** Segundo envío, ya con el texto: la nota se mandó al pulsar la estrella. */
  enviarMotivoValoracion(): void {
    const nota = this.valoracion();
    if (nota === null) return;

    if (this.motivoValoracion().trim()) this.registrarValoracion(nota);
    this.valoracionEnviada.set(true);
  }

  private registrarValoracion(nota: number): void {
    /*
     * Es telemetría sobre una reserva que ya está confirmada y pagada: si el
     * envío falla no se le dice nada al usuario ni se reintenta. Un error aquí
     * daría a entender que algo ha ido mal con la reserva, y no es el caso.
     */
    const motivo = this.motivoValoracion().trim();
    try {
      this.eventosService.registrar(TipoEvento.EXPERIENCIA_VALORADA, {
        reservaId: this.reservaIdReal() ?? undefined,
        servicioId: this.servicioId,
        vertical: this.vertical(),
        paso: PasoEmbudo.CONFIRMACION,
        payload: { puntuacion: nota, ...(motivo ? { motivo } : {}) },
      });
    } catch {
      // Ver arriba: la valoración nunca puede estropear una reserva confirmada.
    }
  }

  /**
   * Rellena los datos de contacto de quien ya ha iniciado sesión.
   *
   * Se hace en el arranque y no al llegar al paso 2: la sesión está en memoria,
   * así que el formulario aparece relleno de una vez en lugar de rellenarse
   * delante del usuario. Todo sigue siendo editable —la reserva puede ir a
   * nombre de otra persona— y sin sesión no se toca nada: el wizard admite
   * invitados.
   */
  private precargarContacto(): void {
    const usuario = this.auth.usuario();
    if (!usuario) return;

    const { nombre, apellidos } = this.partirNombre(usuario.nombre);
    this.paso2Form.patchValue({ nombre, apellidos, email: usuario.email });

    /*
     * El teléfono no viaja en la sesión, sólo en el perfil. Llega tarde y por
     * eso se aplica con `pristine`: si para entonces el usuario ya está
     * escribiendo su número, no se le pisa lo tecleado.
     */
    void firstValueFrom(
      this.http.get<{ telefono?: string }>(`${environment.apiUrl}/users/me`),
    ).then(({ telefono }) => {
      const control = this.paso2Form.controls.telefono;
      if (telefono && control.pristine) control.setValue(telefono);
    }).catch(() => {
      // El perfil no es imprescindible: el usuario escribe su teléfono y sigue.
    });
  }

  /**
   * El usuario guarda un único `nombre` y el formulario pide nombre y
   * apellidos por separado, así que se parte por el primer espacio. Un nombre
   * de una sola palabra deja los apellidos vacíos, y el `required` obliga a
   * completarlos, que es lo que se quiere.
   */
  private partirNombre(completo: string): { nombre: string; apellidos: string } {
    const partes = completo.trim().split(/\s+/);
    return { nombre: partes[0] ?? '', apellidos: partes.slice(1).join(' ') };
  }

  readonly paso2Form = this.fb.group({
    nombre:         ['', Validators.required],
    apellidos:      ['', Validators.required],
    email:          ['', [Validators.required, Validators.email]],
    telefono:       ['', Validators.required],
    pais:           ['ES'],
    peticiones:     [''],
    confirmaDatosMascota: [false, Validators.requiredTrue],
    aceptaTerminos: [false, Validators.requiredTrue],
  });

  // ─── Extras (alojamiento) — configurados por el comercio (HU-15.1/15.2), no fijos ───
  readonly extrasSelec = signal<string[]>([]);
  readonly serviciosAdicionalesAlojamiento = signal<ServicioAdicionalWizard[]>([]);

  /**
   * Tarifas y extras del transportista (HU-5.5.2/5.5.3/15.1). Sin esto el resumen
   * mostraba solo la tarifa base e ignoraba los kilómetros, así que el cliente veía
   * un importe menor al que el backend cobra después.
   */
  readonly serviciosAdicionalesTransporte = signal<ServicioAdicionalWizard[]>([]);
  readonly tarifasTransporte = signal<{ tarifaBase: number; tarifaKm: number } | null>(null);

  // ─── Suplementos (hoteles) — configurados por el comercio (HU-15.1/15.2) ───
  readonly hotelSuplementos = signal<HotelSuplementosWizard>({
    suplementoPorTamanoMascota: [],
    suplementoSegundaMascotaPorNoche: 0,
  });

  // ─── Coupon ───
  readonly descuento      = signal(0);
  readonly cuponCodigo    = signal<string | null>(null);
  readonly cuponError     = signal<string | null>(null);
  readonly aplicandoCupon = signal(false);
  cuponInput = '';

  // ─── Computed ───
  /**
   * Los `FormGroup` no son señales: sin esta revisión, los `computed` que leen
   * `form.value` se quedarían con el primer valor y el resumen mostraría un
   * importe distinto al que se cobra en cuanto el cliente cambia las fechas.
   */
  private readonly revisionFormularios = signal(0);

  constructor() {
    // `AbstractControl` unifica los seis grupos, que son de tipos distintos.
    const formularios: AbstractControl[] = [
      this.paso1AlojamientoForm, this.paso1TransporteForm, this.paso1VeterinariaForm,
      this.paso1PeluqueriaForm, this.paso1AdiestramientoForm, this.paso1HotelesForm,
      this.paso1FunerariosForm,
    ];
    for (const form of formularios) {
      form.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.revisionFormularios.update((v) => v + 1));
    }

    // Cada vez que cambia algo del paso 1 que afecte a la disponibilidad se
    // vuelve a preguntar. Con espera, para no lanzar una consulta por tecla.
    effect(() => {
      const enPaso1 = this.paso() === 1;
      const datosCompletos = this.paso1Valido();
      // Dependencias explícitas: el efecto tiene que despertar con cada una.
      this.revisionFormularios();
      this.perroSeleccionado();
      this.extrasSelec();

      clearTimeout(this.temporizadorDisponibilidad);

      if (!enPaso1 || !datosCompletos || !this.servicioId) {
        this.consultaDisponibilidad++;
        this.disponibilidad.set({ estado: 'idle' });
        return;
      }

      this.disponibilidad.set({ estado: 'comprobando' });
      this.temporizadorDisponibilidad = setTimeout(
        () => void this.comprobarDisponibilidad(),
        ESPERA_DISPONIBILIDAD_MS,
      );
    });
  }

  /** ¿Se reserva este vertical por rango de noches? Sólo esos tienen calendario. */
  readonly usaCalendario = computed(() => VERTICALES_CON_CALENDARIO.includes(this.vertical()));

  /**
   * Lo que el cliente marca en el calendario pasa a los campos del formulario.
   *
   * Los dos grupos se tratan por separado a propósito: sus `FormGroup` tipados
   * tienen controles distintos y no hay un supertipo común que valga para los
   * dos sin recurrir a `any`.
   */
  aplicarRango(rango: RangoFechas): void {
    const valores = { checkIn: rango.entrada, checkOut: rango.salida };
    if (this.vertical() === VerticalKey.ALOJAMIENTO) this.paso1AlojamientoForm.patchValue(valores);
    if (this.vertical() === VerticalKey.HOTELES) this.paso1HotelesForm.patchValue(valores);
  }

  /** Fechas elegidas del vertical en curso; null si no se reserva por rango. */
  private fechasElegidas(): { checkIn: string | null; checkOut: string | null } | null {
    if (this.vertical() === VerticalKey.ALOJAMIENTO) {
      const { checkIn, checkOut } = this.paso1AlojamientoForm.value;
      return { checkIn: checkIn ?? null, checkOut: checkOut ?? null };
    }
    if (this.vertical() === VerticalKey.HOTELES) {
      const { checkIn, checkOut } = this.paso1HotelesForm.value;
      return { checkIn: checkIn ?? null, checkOut: checkOut ?? null };
    }
    return null;
  }

  readonly resumenEstancia = computed(() => {
    this.revisionFormularios();
    const fechas = this.fechasElegidas();
    if (!fechas?.checkIn || !fechas.checkOut) return 'Elige ingreso y salida en el calendario.';
    const noches = this.calcularNoches(fechas.checkIn, fechas.checkOut);
    return noches === 1 ? '1 noche' : `${noches} noches`;
  });

  /**
   * Trae del API los días reservables del mes pedido y de los dos siguientes.
   *
   * Se piden tres meses de golpe porque el calendario necesita saber qué pasa
   * después del mes visible: una entrada a final de mes tiene su salida en el
   * siguiente, y sin esos días el rango no se puede validar.
   */
  async cargarCalendario(mes: MesVisible): Promise<void> {
    if (!this.usaCalendario() || !this.servicioId) return;

    const clave = `${mes.anio}-${String(mes.mes).padStart(2, '0')}`;
    if (this.mesesCargados.has(clave)) return;
    this.mesesCargados.add(clave);

    const desde = new Date(Date.UTC(mes.anio, mes.mes - 1, 1));
    const hasta = new Date(Date.UTC(mes.anio, mes.mes + 2, 0));

    this.cargandoCalendario.set(true);
    try {
      const respuesta = await this.reservasService.calendario({
        servicioId: this.servicioId,
        desde: desde.toISOString().slice(0, 10),
        hasta: hasta.toISOString().slice(0, 10),
        espacioId: this.espacioId ?? undefined,
      });

      if (!respuesta.soportado) return;

      // Se fusiona por fecha: los meses ya cargados no se pierden al pedir otro.
      const porFecha = new Map(this.diasCalendario().map((dia) => [dia.fecha, dia]));
      for (const dia of respuesta.dias) porFecha.set(dia.fecha, dia);
      this.diasCalendario.set([...porFecha.values()]);
    } catch {
      // Sin calendario el cliente no se queda bloqueado: la comprobación de
      // disponibilidad del paso 1 sigue validando el rango contra el API.
      this.mesesCargados.delete(clave);
    } finally {
      this.cargandoCalendario.set(false);
    }
  }

  /**
   * Consulta al API si lo elegido en el paso 1 se puede reservar.
   *
   * Si la consulta falla no se bloquea el avance: el API vuelve a validar al
   * crear la reserva, y dejar a alguien atascado en el paso 1 por un fallo de
   * red sería peor que dejarle seguir.
   */
  private async comprobarDisponibilidad(): Promise<void> {
    const consulta = ++this.consultaDisponibilidad;
    try {
      const { cuponCodigo: _cupon, recurrencia: _recurrencia, ...payload } = this.buildPayload();
      const resultado = await this.reservasService.comprobarDisponibilidad(payload);

      if (consulta !== this.consultaDisponibilidad) return;

      this.disponibilidad.set(
        resultado.disponible
          ? { estado: 'ok' }
          : {
              estado: 'sin_hueco',
              motivo: resultado.motivo ?? 'El servicio no está disponible para las fechas seleccionadas.',
            },
      );
    } catch {
      if (consulta !== this.consultaDisponibilidad) return;
      this.disponibilidad.set({ estado: 'idle' });
    }
  }

  readonly paso1Valido = computed(() => {
    this.revisionFormularios();
    switch (this.vertical()) {
      case VerticalKey.ALOJAMIENTO:    return this.paso1AlojamientoForm.valid;
      case VerticalKey.TRANSPORTE:     return this.paso1TransporteForm.valid;
      case VerticalKey.VETERINARIA:    return this.paso1VeterinariaForm.valid;
      case VerticalKey.PELUQUERIA:     return this.paso1PeluqueriaForm.valid;
      case VerticalKey.ADIESTRAMIENTO: return this.paso1AdiestramientoForm.valid;
      case VerticalKey.HOTELES:        return this.paso1HotelesForm.valid;
      case VerticalKey.FUNERARIOS:     return this.paso1FunerariosForm.valid && this.funerarioListoParaSeguir();
      default:                         return false;
    }
  });

  readonly subtotal = computed(() => {
    this.revisionFormularios();
    const base = this.precioBase();
    switch (this.vertical()) {
      case VerticalKey.ALOJAMIENTO: {
        const { checkIn, checkOut } = this.paso1AlojamientoForm.value;
        const noches = Math.max(1, this.calcularNoches(checkIn ?? '', checkOut ?? ''));
        const extras = this.extrasSelec().reduce(
          (s, nombre) => s + (this.serviciosAdicionalesAlojamiento().find(e => e.nombre === nombre)?.precio ?? 0), 0,
        );
        return base * noches + extras;
      }
      case VerticalKey.TRANSPORTE:
        return Math.round((this.tarifaBaseTransporte() + this.costeKmTransporte() + this.extrasTransporte()) * 100) / 100;
      case VerticalKey.HOTELES: {
        const { checkIn, checkOut } = this.paso1HotelesForm.value;
        const noches = Math.max(1, this.calcularNoches(checkIn ?? '', checkOut ?? ''));
        return base * noches + this.suplementoHotel();
      }
      case VerticalKey.FUNERARIOS:
        return this.subtotalFunerario();
      default:
        return base;
    }
  });

  /**
   * Precio cerrado del servicio funerario, con el mismo desglose que aplica
   * `FunerariosAvailabilityStrategy`: servicio según el peso + recogida +
   * urgencia + extras. Se replica aquí —como en transporte y hoteles— para que
   * el cliente vea el importe mientras rellena, no sólo al llegar al pago; el
   * cobro lo sigue calculando el backend, que es la fuente de verdad.
   */
  readonly subtotalFunerario = computed(() => {
    this.revisionFormularios();
    const servicio = this.servicioFunerarioElegido();
    if (!servicio) return 0;

    const f = this.paso1FunerariosForm.value;
    const peso = Number(f.pesoKg ?? 0);
    const tramos = [...(servicio.tramosPeso ?? [])].sort((a, b) => a.hastaKg - b.hastaKg);
    const tramo = peso > 0 ? tramos.find((t) => peso <= t.hastaKg) : undefined;
    const precioServicio = tramo?.precio
      ?? (tramos.length && peso > 0 ? tramos[tramos.length - 1].precio : servicio.precioBase);

    const extras = this.extrasFunerarioElegidos().reduce(
      (suma, nombre) => suma + (this.extrasFunerariosDisponibles().find((e) => e.nombre === nombre)?.precio ?? 0), 0,
    );

    const ficha = this.fichaFunerario();
    const urgente = f.urgencia === UrgenciaFunerario.LO_ANTES_POSIBLE || f.urgencia === UrgenciaFunerario.HOY;
    const suplemento = urgente ? ((ficha['suplementoUrgencia'] as number) ?? 0) : 0;

    return this.redondear(precioServicio + this.precioRecogidaFunerario() + suplemento + extras);
  });

  /** Desplazamiento de recogida: fijo, por kilómetro o por zona, según declare la empresa. */
  private precioRecogidaFunerario(): number {
    const f = this.paso1FunerariosForm.value;
    if (!f.necesitaRecogida) return 0;

    const ficha = this.fichaFunerario();
    const modo = ficha['modoPrecioRecogida'];

    if (modo === ModoPrecioRecogida.POR_KM) {
      return this.redondear(((ficha['precioRecogidaPorKm'] as number) ?? 0) * Number(f.distanciaKm ?? 0));
    }
    if (modo === ModoPrecioRecogida.POR_ZONA) {
      return this.zonasRecogidaDisponibles().find((z) => z.nombre === f.zonaRecogida)?.precio ?? 0;
    }
    return (ficha['precioRecogida'] as number) ?? 0;
  }

  /**
   * Desglose del trayecto (HU-5.5.3). Replica la fórmula de
   * `transporte-availability.strategy.ts` (tarifaBase + tarifaKm × km + extras);
   * si el catálogo no ha cargado aún, cae a `precioBase()` para no mostrar 0 €.
   */
  readonly tarifaBaseTransporte = computed(
    () => this.tarifasTransporte()?.tarifaBase ?? this.precioBase(),
  );

  readonly costeKmTransporte = computed(() => {
    this.revisionFormularios();
    const tarifas = this.tarifasTransporte();
    if (!tarifas) return 0;
    const km = Number(this.paso1TransporteForm.value.distanciaKm ?? 0);
    if (!Number.isFinite(km) || km <= 0) return 0;
    return Math.round(tarifas.tarifaKm * km * 100) / 100;
  });

  readonly extrasTransporte = computed(() =>
    this.extrasSelec().reduce(
      (s, nombre) => s + (this.serviciosAdicionalesTransporte().find(e => e.nombre === nombre)?.precio ?? 0), 0,
    ),
  );

  /**
   * Estimación del suplemento por mascota del hotel (tamaño + mascotas adicionales),
   * replicando `HotelesAvailabilityStrategy` para que el resumen no muestre un precio
   * distinto al que se cobrará (HU-15.2).
   */
  readonly suplementoHotel = computed(() => {
    this.revisionFormularios();
    if (this.vertical() !== VerticalKey.HOTELES) return 0;
    const { checkIn, checkOut, mascotas, tamanoPerro } = this.paso1HotelesForm.value;
    const noches = Math.max(1, this.calcularNoches(checkIn ?? '', checkOut ?? ''));
    const suplementos = this.hotelSuplementos();
    const tier = suplementos.suplementoPorTamanoMascota.find(t => t.tamano === tamanoPerro);
    const suplementoTamano = (tier?.precioPorNoche ?? 0) * noches;
    const numMascotas = Number(mascotas ?? 1);
    const suplementoAdicionales = numMascotas > 1
      ? suplementos.suplementoSegundaMascotaPorNoche * noches * (numMascotas - 1)
      : 0;
    return suplementoTamano + suplementoAdicionales;
  });

  /** Céntimos, no coma flotante: el desglose tiene que cuadrar con el cobro. */
  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  /**
   * Los precios del catálogo **llevan el IVA incluido**, que es lo que dicen las
   * tarjetas del buscador. El desglose se obtiene dividiendo: sumarlo aquí
   * encarecía en el último paso lo que se había anunciado, que es justo la
   * sorpresa que nadie quiere al llegar al pago.
   */
  readonly total = computed(() => {
    const real = this.totalFromApi();
    return real !== null ? real : Math.max(0, this.redondear(this.subtotal() - this.descuento()));
  });

  /** Base imponible contenida en el total. */
  readonly baseImponible = computed(() => this.redondear(this.total() / (1 + IVA_RATE)));

  /** IVA ya contenido en el total; informativo, nunca se suma. */
  readonly iva = computed(() => this.redondear(this.total() - this.baseImponible()));

  /**
   * HU-5.7.2 — Resumen del viaje visible durante todo el proceso de reserva de
   * hotel. Solo aplica a hoteles: es el único vertical donde viajan personas
   * además de la mascota. Devuelve `null` en el resto para no pintar la línea.
   */
  readonly resumenViaje = computed<ResumenViajeParte[]>(() => {
    this.revisionFormularios();
    if (this.vertical() !== VerticalKey.HOTELES) return [];

    const { checkIn, checkOut, adultos, ninos, mascotas } = this.paso1HotelesForm.value;
    const partes: ResumenViajeParte[] = [];

    const numAdultos = Number(adultos ?? 0);
    if (numAdultos > 0) {
      partes.push({ icono: 'user', texto: `${numAdultos} ${numAdultos === 1 ? 'adulto' : 'adultos'}` });
    }

    const numNinos = Number(ninos ?? 0);
    if (numNinos > 0) {
      partes.push({ icono: 'baby', texto: `${numNinos} ${numNinos === 1 ? 'niño' : 'niños'}` });
    }

    // Si hay una mascota elegida en la Ficha Inteligente mostramos su nombre;
    // si son varias, el recuento — el nombre solo identifica a la primera.
    const numMascotas = Number(mascotas ?? 0);
    const nombrePerro = this.perroSeleccionadoObj()?.nombre;
    if (numMascotas === 1 && nombrePerro) {
      partes.push({ icono: 'dog', texto: nombrePerro });
    } else if (numMascotas > 0) {
      partes.push({ icono: 'dog', texto: `${numMascotas} ${numMascotas === 1 ? 'mascota' : 'mascotas'}` });
    }

    const rango = this.rangoFechasCorto(checkIn, checkOut);
    if (rango) partes.push({ icono: 'calendar', texto: rango });

    return partes;
  });

  /**
   * "28–30 julio" a partir de dos fechas `YYYY-MM-DD`. Vacío si falta alguna.
   *
   * Las partes se parsean del propio string en vez de con `new Date(iso)`: ese
   * constructor interpreta la fecha como UTC y `getDate()` la lee en la zona
   * local, así que en husos negativos el resumen mostraba el día anterior.
   */
  private rangoFechasCorto(desde?: string | null, hasta?: string | null): string {
    const inicio = this.partesFecha(desde);
    const fin = this.partesFecha(hasta);
    if (!inicio || !fin) return '';

    const nombreMes = (mes: number): string =>
      new Date(2000, mes - 1, 1).toLocaleDateString('es-ES', { month: 'long' });

    // Mismo mes → "28–30 julio"; distinto mes → "28 julio – 2 agosto".
    if (inicio.mes === fin.mes && inicio.anio === fin.anio) {
      return `${inicio.dia}–${fin.dia} ${nombreMes(fin.mes)}`;
    }
    return `${inicio.dia} ${nombreMes(inicio.mes)} – ${fin.dia} ${nombreMes(fin.mes)}`;
  }

  private partesFecha(iso?: string | null): { anio: number; mes: number; dia: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) } : null;
  }

  readonly paso1Label = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'Tu estancia',
      [VerticalKey.TRANSPORTE]: 'Tu trayecto',
      [VerticalKey.VETERINARIA]: 'Tu cita',
      [VerticalKey.PELUQUERIA]: 'Tu cita',
      [VerticalKey.ADIESTRAMIENTO]: 'Tu sesión',
      [VerticalKey.HOTELES]: 'Tu viaje',
      [VerticalKey.FUNERARIOS]: 'El servicio',
    };
    return m[this.vertical()] ?? 'Selección';
  });

  readonly paso1Titulo = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'Detalles de la estancia de tu perro',
      [VerticalKey.TRANSPORTE]: 'Detalles del trayecto',
      [VerticalKey.VETERINARIA]: 'Detalles de la cita veterinaria',
      [VerticalKey.PELUQUERIA]: 'Detalles de la cita de peluquería',
      [VerticalKey.ADIESTRAMIENTO]: 'Detalles del adiestramiento',
      [VerticalKey.HOTELES]: 'Detalles de tu viaje pet-friendly',
      [VerticalKey.FUNERARIOS]: 'Detalles del servicio funerario',
    };
    return m[this.vertical()] ?? 'Resumen de tu reserva';
  });

  /** Icono Lucide del vertical de la reserva (TCK-8010: ya no es un emoji). */
  readonly iconoVertical = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'home',
      [VerticalKey.TRANSPORTE]: 'truck',
      [VerticalKey.VETERINARIA]: 'stethoscope',
      [VerticalKey.PELUQUERIA]: 'scissors',
      [VerticalKey.ADIESTRAMIENTO]: 'graduation-cap',
      [VerticalKey.HOTELES]: 'hotel',
      [VerticalKey.FUNERARIOS]: 'heart',
    };
    return m[this.vertical()] ?? 'paw';
  });

  readonly verticaLabel = computed(() =>
    VERTICAL_LABELS[this.vertical() as VerticalKey] ?? this.vertical(),
  );

  readonly precioPorLabel = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'noche',
      [VerticalKey.TRANSPORTE]: 'trayecto',
      [VerticalKey.VETERINARIA]: 'cita',
      [VerticalKey.PELUQUERIA]: 'servicio',
      [VerticalKey.ADIESTRAMIENTO]: 'sesión',
      [VerticalKey.HOTELES]: 'noche',
      [VerticalKey.FUNERARIOS]: 'servicio',
    };
    return m[this.vertical()] ?? '';
  });

  readonly lineaResumen = computed(() => {
    this.revisionFormularios();
    const base = this.precioBase();
    switch (this.vertical()) {
      case VerticalKey.ALOJAMIENTO: {
        const { checkIn, checkOut, perros } = this.paso1AlojamientoForm.value;
        const n = Math.max(1, this.calcularNoches(checkIn ?? '', checkOut ?? ''));
        const p = Number(perros ?? 1);
        return `${euros(base)} × ${n} noche${n !== 1 ? 's' : ''} · ${p} perro${p !== 1 ? 's' : ''}`;
      }
      case VerticalKey.TRANSPORTE:
        return `Tarifa base ${euros(base)} + km`;
      case VerticalKey.VETERINARIA:
        return `Cita veterinaria · ${euros(base)}`;
      case VerticalKey.PELUQUERIA:
        return `Cita de peluquería · ${euros(base)}`;
      case VerticalKey.ADIESTRAMIENTO:
        return this.paso1AdiestramientoForm.value.modalidad === 'programa'
          ? `Programa de adiestramiento · ${euros(base)}`
          : `Sesión de adiestramiento · ${euros(base)}`;
      case VerticalKey.HOTELES: {
        const { checkIn, checkOut } = this.paso1HotelesForm.value;
        const n = Math.max(1, this.calcularNoches(checkIn ?? '', checkOut ?? ''));
        return `${euros(base)} × ${n} noche${n !== 1 ? 's' : ''}`;
      }
      case VerticalKey.FUNERARIOS:
        return `${this.paso1FunerariosForm.value.servicioNombre || 'Servicio funerario'} · ${euros(base)}`;
      default:
        return euros(base);
    }
  });

  readonly peticionesPlaceholder = computed(() => {
    const m: Record<string, string> = {
      [VerticalKey.ALOJAMIENTO]: 'Alergias, medicación, hábitos de tu perro…',
      [VerticalKey.TRANSPORTE]: 'Mi perro viaja mejor con su manta, jaula propia…',
      [VerticalKey.VETERINARIA]: 'Síntomas, historial médico, cartilla de vacunas…',
      [VerticalKey.PELUQUERIA]: 'Piel sensible, nudos, corte preferido…',
      [VerticalKey.ADIESTRAMIENTO]: 'Conducta a trabajar, nivel de socialización…',
      [VerticalKey.HOTELES]: 'Necesidades especiales de tu mascota, movilidad reducida…',
      [VerticalKey.FUNERARIOS]: 'Cómo se llamaba, si queréis acompañarlo, algo que debamos saber…',
    };
    return m[this.vertical()] ?? 'Peticiones especiales…';
  });

  ngOnInit(): void {
    this.precargarContacto();
    this.consultarBypass();

    const routeParams = this.route.snapshot.paramMap;
    const queryParams = this.route.snapshot.queryParamMap;

    this.vertical.set(routeParams.get('vertical') ?? VerticalKey.ALOJAMIENTO);
    this.servicioId = routeParams.get('servicioId') ?? undefined;
    this.comercioId = queryParams.get('comercioId') ?? undefined;
    this.nombreServicio.set(queryParams.get('nombre') ?? '');
    this.ciudadServicio.set(queryParams.get('ciudad') ?? '');
    this.imagenServicio.set(queryParams.get('imagen') ?? '');
    this.precioBase.set(Number(queryParams.get('precioBase') ?? 0));
    this.espacioId = queryParams.get('espacioId');

    // Prellenar con las fechas/perros ya buscados en el listado (no volver a pedirlos).
    // `desde`/`hasta` son los parámetros del buscador común; `checkIn`/`checkOut`
    // llegan del detalle de alojamiento.
    const checkIn = queryParams.get('checkIn') ?? queryParams.get('desde');
    const checkOut = queryParams.get('checkOut') ?? queryParams.get('hasta');
    const perrosQP = queryParams.get('perros');
    if (checkIn || checkOut || perrosQP) {
      this.paso1AlojamientoForm.patchValue({
        ...(checkIn ? { checkIn } : {}),
        ...(checkOut ? { checkOut } : {}),
        ...(perrosQP ? { perros: Number(perrosQP) } : {}),
      });
      this.paso1HotelesForm.patchValue({
        ...(checkIn ? { checkIn } : {}),
        ...(checkOut ? { checkOut } : {}),
      });
    }

    // Verticales de cita: la fecha buscada prellena el paso 1 correspondiente.
    if (checkIn) {
      this.paso1VeterinariaForm.patchValue({ fecha: checkIn });
      this.paso1PeluqueriaForm.patchValue({ fecha: checkIn });
      this.paso1AdiestramientoForm.patchValue({ fechaInicio: checkIn });
      this.paso1TransporteForm.patchValue({ fechaRecogida: checkIn });
    }

    const origen = queryParams.get('ciudad');
    if (origen) this.paso1TransporteForm.patchValue({ origen });

    // Calendario del mes que se va a ver primero: el de las fechas que ya trae
    // el cliente del buscador, o el actual si viene sin ellas.
    if (this.usaCalendario()) {
      const referencia = checkIn ? new Date(`${checkIn}T00:00:00Z`) : new Date();
      void this.cargarCalendario({
        anio: referencia.getUTCFullYear(), mes: referencia.getUTCMonth() + 1,
      });
    }

    const perroIdQP = queryParams.get('perroId');

    void this.perrosService.misPerros().then((perros) => {
      this.perros.set(perros);
      if (perroIdQP && perros.some((p) => p._id === perroIdQP)) {
        this.perroSeleccionado.set(perroIdQP);
      } else if (perros.length === 1) {
        this.perroSeleccionado.set(perros[0]._id);
      }
      // Igual que al elegirlo a mano: el perro autoseleccionado también manda
      // sobre el tamaño, que es contra lo que valida el API.
      this.sincronizarTamanoPerro();
      this.sincronizarServicioPeluqueria();
    }).catch(() => {
      // Sin perros registrados o API no disponible: el selector queda vacío, no bloquea la reserva.
    });

    if (this.vertical() === VerticalKey.PELUQUERIA && this.servicioId) {
      void this.catalogBrowseService.obtener(this.servicioId).then((s) => {
        const extra = s.extra ?? {};
        this.peluqueriaDetalle.set({
          serviciosGrooming: (extra['serviciosGrooming'] as ServicioGroomingWizard[] | undefined) ?? [],
          politicaTemperamentoDificil: (extra['politicaTemperamentoDificil'] as string) ?? 'aceptar',
          bozalObligatorioSiAgresivo: (extra['bozalObligatorioSiAgresivo'] as boolean) ?? true,
          serviciosAdicionales: (extra['serviciosAdicionales'] as ServicioAdicionalWizard[] | undefined) ?? [],
          razasEspecificas: (extra['razasEspecificas'] as string[] | undefined) ?? [],
          requiereVacunasAlDia: (extra['requiereVacunasAlDia'] as boolean) ?? true,
          requiereMicrochip: (extra['requiereMicrochip'] as boolean) ?? true,
        });
        this.sincronizarServicioPeluqueria();
      }).catch(() => {
        // Catálogo detallado no disponible: se mantiene sin opciones filtradas, no bloquea la reserva.
      });
    }

    if (this.vertical() === VerticalKey.VETERINARIA && this.servicioId) {
      void this.catalogBrowseService.obtener(this.servicioId).then((s) => {
        const extra = s.extra ?? {};
        this.serviciosClinicosDisponibles.set(
          (extra['serviciosClinicos'] as ServicioClinicoWizard[] | undefined) ?? [],
        );
      }).catch(() => {
        // Catálogo detallado no disponible: se mantiene con el selector genérico.
      });
    }

    if (this.vertical() === VerticalKey.ADIESTRAMIENTO && this.servicioId) {
      void this.catalogBrowseService.obtener(this.servicioId).then((s) => {
        const extra = s.extra ?? {};
        this.serviciosAdiestramientoDisponibles.set(
          (extra['serviciosAdiestramiento'] as ServicioAdiestramientoWizard[] | undefined) ?? [],
        );
      }).catch(() => {
        // Catálogo detallado no disponible: se mantiene con el selector de modalidad genérico.
      });
    }

    if (this.vertical() === VerticalKey.FUNERARIOS && this.servicioId) {
      void this.catalogBrowseService.obtener(this.servicioId).then((s) => {
        this.fichaFunerario.set(s.extra ?? {});
        // Con un solo servicio en catálogo no hay nada que elegir: se marca y
        // el cliente pasa directamente al peso, que es lo que fija el precio.
        const servicios = this.serviciosFunerariosDisponibles();
        if (servicios.length === 1) {
          this.paso1FunerariosForm.patchValue({ servicioNombre: servicios[0].nombre });
        }
      }).catch(() => {
        // Sin ficha detallada no se puede ofrecer el catálogo; el paso 1 se
        // queda sin opciones y el cliente no avanza, que es lo correcto aquí.
      });
    }

    if (this.vertical() === VerticalKey.ALOJAMIENTO && this.servicioId) {
      void this.catalogBrowseService.obtener(this.servicioId).then((s) => {
        const extra = s.extra ?? {};
        this.serviciosAdicionalesAlojamiento.set(
          (extra['serviciosAdicionales'] as ServicioAdicionalWizard[] | undefined) ?? [],
        );
      }).catch(() => {
        // Catálogo detallado no disponible: sin servicios adicionales que ofrecer.
      });
    }

    if (this.vertical() === VerticalKey.TRANSPORTE && this.servicioId) {
      void this.catalogBrowseService.obtener(this.servicioId).then((s) => {
        const extra = s.extra ?? {};
        this.serviciosAdicionalesTransporte.set(
          (extra['serviciosAdicionales'] as ServicioAdicionalWizard[] | undefined) ?? [],
        );
        const tarifaBase = extra['tarifaBase'] as number | undefined;
        const tarifaKm = extra['tarifaKm'] as number | undefined;
        if (tarifaBase !== undefined && tarifaKm !== undefined) {
          this.tarifasTransporte.set({ tarifaBase, tarifaKm });
        }
      }).catch(() => {
        // Catálogo detallado no disponible: el resumen cae a la tarifa base
        // (el cobro final lo sigue calculando el backend, que es la fuente de verdad).
      });
    }

    if (this.vertical() === VerticalKey.HOTELES && this.servicioId) {
      void this.catalogBrowseService.obtener(this.servicioId).then((s) => {
        const extra = s.extra ?? {};
        this.hotelSuplementos.set({
          suplementoPorTamanoMascota: (extra['suplementoPorTamanoMascota'] as SuplementoTamanoWizard[] | undefined) ?? [],
          suplementoSegundaMascotaPorNoche: (extra['suplementoSegundaMascotaPorNoche'] as number | undefined) ?? 0,
        });
      }).catch(() => {
        // Catálogo detallado no disponible: el resumen no anticipará el suplemento, pero el cobro final sigue siendo correcto.
      });
    }
  }

  /** Si el servicio elegido deja de estar disponible para el perro seleccionado, elige el primero compatible. */
  private sincronizarServicioPeluqueria(): void {
    if (this.vertical() !== VerticalKey.PELUQUERIA) return;
    const opciones = this.serviciosGroomingOpciones();
    if (!opciones.length) return;
    const actual = this.paso1PeluqueriaForm.value.servicio;
    if (!opciones.some((o) => o.nombre === actual)) {
      this.paso1PeluqueriaForm.patchValue({ servicio: opciones[0].nombre });
    }
  }

  seleccionarPerro(id: string): void {
    this.perroSeleccionado.set(id);
    this.sincronizarTamanoPerro();
    this.sincronizarServicioPeluqueria();
  }

  /**
   * El tamaño del desplegable pasa a ser el de la ficha del perro elegido.
   *
   * El API valida contra la ficha, no contra lo que diga el desplegable, así
   * que si no se igualan el cliente ve "mediano" y le rechazan la reserva por
   * un tamaño que nunca eligió. Sin tamaño en la ficha no se toca nada: lo que
   * haya puesto a mano es entonces el mejor dato disponible.
   */
  private sincronizarTamanoPerro(): void {
    const tamano = this.perroSeleccionadoObj()?.tamano;
    if (!tamano) return;

    this.paso1AlojamientoForm.patchValue({ tamanoPerro: tamano });
    this.paso1HotelesForm.patchValue({ tamanoPerro: tamano });
  }

  irPaso(p: number): void {
    // Si se vuelve al paso 1 tras haber preparado el pago, el importe pudo cambiar
    // (fechas, extras…): se descarta el PaymentIntent anterior para no cobrar de más/menos.
    if (p === 1 && this.stripeListo()) {
      this.stripeListo.set(false);
      this.totalFromApi.set(null);
      this.clientSecret = null;
      this.pagoId = null;
      this.stripe = null;
      this.elements = null;
      this.reservaIdReal.set(null);
    }

    this.paso.set(p as Paso);

    // Traza del paso alcanzado: es lo que permite saber dónde se abandona.
    this.eventosService.registrar(TipoEvento.PASO_COMPLETADO, {
      paso: PASO_EMBUDO[p] ?? PasoEmbudo.DETALLE,
      servicioId: this.servicioId,
      vertical: this.vertical(),
    });

    if (p === 3 && this.metodoPago() === 'card' && !this.stripeListo()) {
      void this.prepararStripe();
    }

    if (p === 2) {
      void this.cargarEstimacionPrecio();
    }
  }

  /**
   * Presupuesto ajustado por el historial de suplementos del perro (Ref. N8): informativo,
   * no cambia el precio real que calcula el backend al reservar.
   */
  private async cargarEstimacionPrecio(): Promise<void> {
    const perroId = this.perroSeleccionado();
    const precioBase = this.subtotal();
    if (!perroId || precioBase <= 0) {
      this.estimacionPrecio.set(null);
      return;
    }
    try {
      const estimacion = await this.perrosService.estimacionPrecio(perroId, precioBase);
      this.estimacionPrecio.set(
        estimacion.basadoEnReservas > 0 && Math.abs(estimacion.promedioAjustePct) >= 1 ? estimacion : null,
      );
    } catch {
      this.estimacionPrecio.set(null);
    }
  }

  p2Error(campo: string): boolean {
    const control = this.paso2Form.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  continuarPaso2(): void {
    if (this.paso2Form.invalid) {
      this.paso2Form.markAllAsTouched();
      return;
    }
    this.irPaso(3);
  }

  async consultarRecomendacionAdiestramiento(): Promise<void> {
    const { motivo, intensidad, edadMeses } = this.paso1AdiestramientoForm.value;
    if (!motivo || !intensidad) return;
    try {
      const rec = await this.recomendadorService.adiestramiento(motivo, intensidad, Number(edadMeses ?? 0));
      this.recomendacionAdiestramiento.set(rec);
      if (rec.bloqueaGrupales) {
        this.paso1AdiestramientoForm.patchValue({ modalidad: 'sesion' });
      }
    } catch {
      // Recomendación no disponible: no bloquea el flujo de reserva.
    }
  }

  async consultarRecomendacionVeterinaria(): Promise<void> {
    const { motivoTriage, gravedad } = this.paso1VeterinariaForm.value;
    if (!motivoTriage || !gravedad) return;
    try {
      this.recomendacionVeterinaria.set(
        await this.recomendadorService.veterinaria(motivoTriage, gravedad),
      );
    } catch {
      // Recomendación no disponible: no bloquea el flujo de reserva.
    }
  }

  private buildPayload(): import('../services/reservas.service').CrearReservaPayload {
    const v = this.vertical();
    switch (v) {
      case VerticalKey.ALOJAMIENTO: {
        const f = this.paso1AlojamientoForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: f.checkIn!, fechaFin: f.checkOut ?? undefined,
          cantidad: Number(f.perros ?? 1),
          detalle: {
            tamanoPerro: f.tamanoPerro,
            compatibilidadSocial: f.compatibilidadSocial,
            ...(this.espacioId ? { espacioId: this.espacioId } : {}),
            ...(this.extrasSelec().length > 0 ? { extras: this.extrasSelec() } : {}),
          },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.TRANSPORTE: {
        const f = this.paso1TransporteForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: `${f.fechaRecogida}T${f.hora}:00`,
          cantidad: 1,
          detalle: {
            origen: f.origen, destino: f.destino,
            distanciaKm: Number(f.distanciaKm ?? 10),
            perros: Number(f.perros ?? 1),
            // Se guarda cómo se obtuvo la distancia: si mañana hay una disputa
            // por el importe, hace falta saber si fue medida o estimada.
            trayectoCalculado: this.resumenTrayecto() || undefined,
            ...(this.extrasSelec().length > 0 ? { extras: this.extrasSelec() } : {}),
            ...(this.esIdaVuelta() ? { tipoTrayecto: 'ida_vuelta', esperaMinutos: this.esperaMinutos() } : {}),
          },
          cuponCodigo: this.cuponCodigo() ?? undefined,
          ...(this.esRecurrente() && this.diasSemanaSelec().length > 0 && this.fechaFinRecurrencia()
            ? {
                recurrencia: {
                  diasSemana: this.diasSemanaSelec(),
                  hora: f.hora!,
                  fechaFin: this.fechaFinRecurrencia(),
                },
              }
            : {}),
        };
      }
      case VerticalKey.VETERINARIA: {
        const f = this.paso1VeterinariaForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: f.fecha!,
          cantidad: 1,
          detalle: { hora: f.hora, servicio: f.servicio },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.PELUQUERIA: {
        const f = this.paso1PeluqueriaForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: f.fecha!,
          cantidad: 1,
          detalle: { hora: f.hora, servicio: f.servicio },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.ADIESTRAMIENTO: {
        const f = this.paso1AdiestramientoForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: f.fechaInicio!,
          cantidad: 1,
          detalle: {
            modalidad: f.modalidad,
            edadMeses: Number(f.edadMeses ?? 0),
            servicio: f.servicio || undefined,
            motivo: f.motivo || undefined,
            intensidad: f.intensidad || undefined,
            descripcionComportamiento: f.descripcionComportamiento || undefined,
            historialPrevio: f.historialPrevio || undefined,
            vinculoPropietario: f.vinculoPropietario || undefined,
            ...(this.videosComportamiento().length > 0 ? { videosUrl: this.videosComportamiento() } : {}),
          },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.HOTELES: {
        const f = this.paso1HotelesForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: f.checkIn!, fechaFin: f.checkOut ?? undefined,
          cantidad: Number(f.mascotas ?? 1),
          detalle: {
            tamanoPerro: f.tamanoPerro,
            adultos: Number(f.adultos ?? 0),
            ninos: Number(f.ninos ?? 0),
            observaciones: f.observaciones || undefined,
          },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      case VerticalKey.FUNERARIOS: {
        const f = this.paso1FunerariosForm.value;
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: this.fechaInicioFunerario(),
          cantidad: 1,
          // Todo esto llega a la estrategia como `parametrosExtra`: es con lo
          // que se calcula el precio cerrado y se decide si hay cobertura.
          detalle: {
            servicioNombre: f.servicioNombre,
            especie: f.especie,
            pesoKg: Number(f.pesoKg ?? 0),
            necesitaRecogida: !!f.necesitaRecogida,
            lugarRecogida: f.necesitaRecogida ? f.lugarRecogida : undefined,
            distanciaKm: f.necesitaRecogida ? Number(f.distanciaKm ?? 0) : undefined,
            zonaRecogida: f.necesitaRecogida ? (f.zonaRecogida || undefined) : undefined,
            direccionRecogida: f.necesitaRecogida ? (f.direccionRecogida || undefined) : undefined,
            urgencia: f.urgencia,
            franja: f.franja,
            extras: this.extrasFunerarioElegidos(),
            aceptaSinCenizas: !!f.aceptaSinCenizas,
          },
          cuponCodigo: this.cuponCodigo() ?? undefined,
        };
      }
      default:
        return {
          servicioId: this.servicioId!, comercioId: this.comercioId!, vertical: v,
          perroId: this.perroSeleccionado() ?? undefined,
          fechaInicio: new Date().toISOString(), cantidad: 1,
        };
    }
  }

  private async prepararStripe(): Promise<void> {
    if (!this.servicioId || !this.comercioId) return;
    this.errorPago.set(null);
    try {
      const payload = this.buildPayload();
      const reserva = await this.reservasService.crear(payload);
      const reservaId = reserva._id ?? reserva.id ?? null;
      this.reservaIdReal.set(reservaId);
      this.codigoReserva.set(reserva.codigo);
      if (!reservaId) return;

      const intent = await this.paymentsService.crearIntent(reservaId);
      this.clientSecret = intent.clientSecret;
      this.pagoId = intent.pagoId;
      this.totalFromApi.set(intent.montoTotal);

      this.stripe = await this.stripeService.getStripe();
      if (!this.stripe || !this.clientSecret) return;

      this.elements = this.stripe.elements({ clientSecret: this.clientSecret });
      const paymentElement = this.elements.create('payment');
      setTimeout(() => paymentElement.mount('#stripe-payment-element'), 0);
      this.stripeListo.set(true);
    } catch (error) {
      // No enmascarar: si el API rechaza la reserva (sin plazas, perro no
      // admitido…) lo dice con un motivo concreto, y ese motivo es lo único
      // que explica por qué el botón de confirmar no va a funcionar. El texto
      // genérico sólo se usa cuando no viene nada aprovechable.
      this.stripeListo.set(false);
      this.reservaIdReal.set(null);
      this.errorPago.set(
        this.mensajeDelApi(error)
          ?? 'No se pudo preparar el pago de esta reserva. Vuelve a intentarlo o elige otro servicio.',
      );
    }
  }

  /** Mensaje de negocio que manda el API en un error HTTP; null si no trae ninguno. */
  private mensajeDelApi(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const mensaje = (error.error as { message?: unknown } | null)?.message;
    if (typeof mensaje === 'string') return mensaje;
    if (Array.isArray(mensaje) && typeof mensaje[0] === 'string') return mensaje[0];
    return null;
  }

  toggleExtra(id: string): void {
    this.extrasSelec.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  extraNombre(nombre: string): string { return this.serviciosAdicionalesAlojamiento().find(e => e.nombre === nombre)?.nombre ?? ''; }
  extraPrecio(nombre: string): number { return this.serviciosAdicionalesAlojamiento().find(e => e.nombre === nombre)?.precio ?? 0; }
  extraPrecioTransporte(nombre: string): number { return this.serviciosAdicionalesTransporte().find(e => e.nombre === nombre)?.precio ?? 0; }

  async aplicarCupon(): Promise<void> {
    const codigo = this.cuponInput.trim().toUpperCase();
    if (!codigo) return;
    this.aplicandoCupon.set(true);
    this.cuponError.set(null);
    try {
      const res = await this.cuponesService.validar(codigo, this.vertical(), this.subtotal());
      this.descuento.set(res.descuento);
      this.cuponCodigo.set(res.codigo);
    } catch {
      this.cuponError.set('Cupón no válido o no aplicable a esta reserva.');
    } finally {
      this.aplicandoCupon.set(false);
    }
  }

  quitarCupon(): void {
    this.descuento.set(0);
    this.cuponCodigo.set(null);
    this.cuponInput = '';
  }

  /**
   * Confirma la reserva sin pasar por la pasarela.
   *
   * Termina en el mismo sitio que un pago de verdad —paso 4 y cierre del
   * embudo— porque de eso se trata: probar el recorrido completo. Quien decide
   * si se permite es el servidor, así que un 403 aquí es la respuesta correcta
   * si alguien llega con el botón de otro entorno.
   */
  /**
   * Pregunta al API si este entorno deja confirmar sin pagar. Si la consulta
   * falla se queda en "no": ante la duda, no se enseña un atajo de pruebas.
   */
  private consultarBypass(): void {
    void this.paymentsService.configuracion()
      .then((config) => this.bypassDisponible.set(config.bypassPagoHabilitado))
      .catch(() => this.bypassDisponible.set(false));
  }

  async confirmarSinPagar(): Promise<void> {
    const reservaId = this.reservaIdReal();
    if (!reservaId) {
      this.errorPago.set('La reserva todavía no está creada. Vuelve atrás y repite el paso.');
      return;
    }

    this.procesando.set(true);
    this.errorPago.set(null);
    try {
      await this.paymentsService.confirmarSinCobro(reservaId);
      this.eventosService.cerrarEmbudo(reservaId, this.vertical());
      this.irPaso(4);
    } catch {
      this.errorPago.set('No se pudo confirmar la reserva sin pago en este entorno.');
    } finally {
      this.procesando.set(false);
    }
  }

  async procesarPago(): Promise<void> {
    // Sin Stripe listo no hay pago real: no se simula éxito, se muestra el error.
    if (!this.stripe || !this.elements || !this.clientSecret) {
      this.errorPago.set(
        'El pago no está disponible ahora mismo. Vuelve a intentarlo en unos segundos.',
      );
      return;
    }

    this.procesando.set(true);
    this.errorPago.set(null);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });
    this.procesando.set(false);

    if (error) {
      this.errorPago.set(error.message ?? 'No se pudo procesar el pago. Revisa los datos de la tarjeta.');
      return;
    }

    // El cobro ha salido bien en el navegador, pero la reserva sólo se confirma
    // en el servidor. Antes se dejaba enteramente en manos del webhook de
    // Stripe: en producción llega con retraso, y en local no llega nunca, así
    // que la reserva se quedaba "pendiente de pago" con el dinero cobrado.
    await this.confirmarEnServidor();

    // Cierra el cronómetro: aquí se sabe cuánto tardó la reserva de verdad.
    this.eventosService.cerrarEmbudo(this.reservaIdReal() ?? undefined, this.vertical());
    this.irPaso(4);
  }

  /**
   * Pide al servidor que consulte el cobro en la pasarela y confirme la reserva.
   *
   * Nunca bloquea el paso a la confirmación: el dinero ya está cobrado, y el
   * webhook sigue de respaldo si esta consulta falla. Lo que sí hace es dejar
   * dicho en pantalla que la confirmación va con retraso, en vez de prometer
   * una reserva confirmada que el panel muestra como pendiente.
   */
  private async confirmarEnServidor(): Promise<void> {
    if (!this.pagoId) return;

    try {
      const { estado } = await this.paymentsService.sincronizar(this.pagoId);
      this.confirmacionPendiente.set(estado !== 'aprobado');
    } catch {
      this.confirmacionPendiente.set(true);
    }
  }

  private calcularNoches(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 1;
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    const diff = Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }
}
