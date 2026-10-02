import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ALOJAMIENTO_VIAJE_LABELS, AlojamientoViaje, DESPLAZAMIENTO_VIAJE_LABELS, DesplazamientoViaje,
  MUNICIPIOS_ES, PROVINCIAS_ES, RITMO_VIAJE_LABELS, RitmoViaje, SERVICIOS_EXTRA_VIAJE, TIPO_LUGAR_LABELS,
  TipoLugar, VERTICAL_ALOJAMIENTO_VIAJE, VERTICAL_LABELS, VerticalKey, claveDiaEnZona, errorFechasViaje,
  resolverDestinoViaje,
} from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { BRAND, EXPLORA_DESTACADOS_IMAGES, HOTEL_IMAGES } from '../../shared/media/images';
import { enlaceAServicio } from '../../shared/verticales/verticales.config';
import { CarritoService } from '../carrito/carrito.service';
import { PerroApi, PerrosService } from '../perros/perros.service';
import { environment } from '../../../environments/environment';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { EurosPipe } from '../../shared/pipes/euros.pipe';
import { SeoService } from '../../core/seo/seo.service';
import { seoCategoria } from '../../core/seo/plantillas-seo';

interface ParadaApi {
  titulo: string;
  descripcion: string;
  tipo: 'lugar' | 'servicio';
  servicioId?: string;
  lugarId?: string;
  vertical?: string;
  precioEstimado?: number;
}

interface DiaApi {
  dia: number;
  titulo: string;
  paradas: ParadaApi[];
}

interface OpcionApi {
  nombre: string;
  resumen: string;
  /** Estimación orientativa calculada por el API con las fechas reales. */
  presupuestoEstimado: number;
  /** Noches de hotel incluidas en la estimación. */
  noches?: number;
  superaPresupuesto?: boolean;
  dias: DiaApi[];
}

interface ItinerarioApi {
  provincia: string;
  destino?: string;
  noches?: number;
  opciones: OpcionApi[];
  /** Lo reservable del plan: cierra la pantalla con «Reserva tu viaje». */
  serviciosSugeridos?: ParadaApi[];
  esFallback: boolean;
  aviso?: string;
  /** No hay hoteles pet friendly en la zona: el plan no trae dónde dormir. */
  avisoAlojamiento?: string;
}

interface DestinoApi {
  provincia: string;
  lugares: number;
  servicios: number;
}

interface Destino {
  nombre: string;
  imagen: string;
  lugares: number;
}

/** Fotos para las tarjetas de destino; se reparten en orden. */
const FOTOS_DESTINO: readonly string[] = [
  EXPLORA_DESTACADOS_IMAGES.playa, EXPLORA_DESTACADOS_IMAGES.ruta, EXPLORA_DESTACADOS_IMAGES.parque,
  EXPLORA_DESTACADOS_IMAGES.restaurante, BRAND.heroHome, ...HOTEL_IMAGES,
];

/**
 * Si el API de destinos no responde, las tres provincias que tienen todo el
 * contenido de Explora. Nunca más una lista de sitios sin nada detrás.
 */
const DESTINOS_POR_DEFECTO: readonly DestinoApi[] = [
  { provincia: 'Valencia', lugares: 0, servicios: 0 },
  { provincia: 'Alicante', lugares: 0, servicios: 0 },
  { provincia: 'Castellón', lugares: 0, servicios: 0 },
];

/**
 * Sugerencias del campo de destino: provincias y poblaciones del catálogo con
 * su provincia. Son sólo ayuda: se puede escribir cualquier otra población.
 */
const SUGERENCIAS_DESTINO: readonly string[] = [
  ...PROVINCIAS_ES,
  ...MUNICIPIOS_ES
    .filter((m) => m.nombre !== m.provincia)
    .map((m) => `${m.nombre} (${m.provincia})`),
];

/** Fechas del viaje coherentes (mismas reglas que el API). */
function fechasDelViaje(grupo: AbstractControl): ValidationErrors | null {
  const { desde, hasta } = grupo.value as { desde?: string; hasta?: string };
  if (!desde || !hasta) return null;
  const motivo = errorFechasViaje(desde, hasta);
  return motivo ? { fechas: motivo } : null;
}

const opciones = <T extends string>(labels: Record<T, string>): Array<{ valor: T; etiqueta: string }> =>
  (Object.entries(labels) as Array<[T, string]>).map(([valor, etiqueta]) => ({ valor, etiqueta }));

/**
 * Planificador de viajes con mascota (DK-C06 / O2).
 *
 * El itinerario se arma **solo con sitios y servicios que existen en
 * Doogking**, así que cada parada reservable se puede añadir al viaje de un
 * clic: ese enlace con el carrito es la razón de negocio de la pantalla.
 */
@Component({
  selector: 'app-planificador',
  standalone: true,
  imports: [
    TraducirPipe, EurosPipe, ReactiveFormsModule, RouterLink,
    RsNavbarComponent, RsIconComponent, ImgFallbackDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="pl-page">
  <rs-navbar />

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap rs-wrap--2xl">
      <header class="pl-head">
        <p class="pl-eyebrow">{{ 'Planificador de viajes' | t }}</p>
        <h1>{{ '¿A dónde vais este año?' | t }}</h1>
        <p class="pl-sub">
          {{ 'Escribe a dónde vais (una ciudad, un pueblo o una provincia) y te proponemos un viaje completo con tu perro: hotel pet friendly, dónde pasear y qué reservar. Todo con sitios y profesionales que ya están en Doogking.' | t }}
        </p>
      </header>

      <datalist id="pl-sugerencias">
        @for (s of sugerencias; track s) { <option [value]="s"></option> }
      </datalist>

      @if (!destino()) {
        <!--
          Destino libre (bloqueo del cliente, octubre): antes sólo se podía
          pinchar una provincia de la lista y no había dónde escribir el lugar.
        -->
        <form class="pl-buscar rs-card" (submit)="$event.preventDefault(); continuar()">
          <label class="rs-lbl" for="pl-destino-inicio">{{ '¿A dónde vais?' | t }}</label>
          <div class="pl-buscar__fila">
            <input id="pl-destino-inicio" type="text" class="rs-inp" list="pl-sugerencias" autocomplete="off"
                   [class.rs-inp--error]="!!errorDestino()"
                   [formControl]="form.controls.destino"
                   [placeholder]="'Escribe una ciudad, un pueblo o una provincia' | t" />
            <button type="submit" class="rs-btn rs-btn--gold">{{ 'Continuar' | t }}</button>
          </div>
          @if (errorDestino()) { <p class="rs-field-error">{{ errorDestino() | t }}</p> }
        </form>

        <p class="pl-leyenda">{{ 'O inspírate con estos destinos' | t }}</p>
        <div class="pl-grid">
          @for (d of destinos(); track d.nombre) {
            <button type="button" class="pl-card" (click)="elegir(d.nombre)">
              <img [src]="d.imagen" [alt]="d.nombre" loading="lazy" rsImg />
              <span class="pl-card__veil"></span>
              <span class="pl-card__nombre">
                {{ d.nombre }}
                @if (d.lugares) { <small>{{ '{n} sitios pet friendly' | t: { n: d.lugares } }}</small> }
              </span>
            </button>
          }
        </div>
      } @else {
        <div class="pl-form rs-card">
          <div class="pl-form__cabecera">
            <h2>{{ 'Tu viaje a {destino}' | t: { destino: destino() } }}</h2>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="volver()">
              {{ 'Cambiar destino' | t }}
            </button>
          </div>

          <form [formGroup]="form" (submit)="$event.preventDefault(); generar()">
            <fieldset class="pl-grupo">
              <legend>{{ 'Cuándo y dónde' | t }}</legend>
              <div class="pl-form__campos">
                <div class="rs-field">
                  <label class="rs-lbl" for="pl-destino">{{ 'Destino' | t }}</label>
                  <input id="pl-destino" type="text" class="rs-inp" formControlName="destino" list="pl-sugerencias"
                         autocomplete="off" [class.rs-inp--error]="!!errorDestino()"
                         [placeholder]="'Por ejemplo, Dénia' | t" />
                  @if (errorDestino()) { <p class="rs-field-error">{{ errorDestino() | t }}</p> }
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="pl-desde">{{ 'Ida' | t }}</label>
                  <input id="pl-desde" type="date" class="rs-inp" formControlName="desde" required
                         [min]="hoy" [class.rs-inp--error]="campoInvalido('desde')" />
                  @if (campoInvalido('desde')) { <p class="rs-field-error">{{ 'Indica la fecha de ida' | t }}</p> }
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="pl-hasta">{{ 'Vuelta' | t }}</label>
                  <input id="pl-hasta" type="date" class="rs-inp" formControlName="hasta" required
                         [min]="form.controls.desde.value || hoy"
                         [class.rs-inp--error]="campoInvalido('hasta') || !!errorFechas()" />
                  @if (campoInvalido('hasta')) {
                    <p class="rs-field-error">{{ 'Indica la fecha de vuelta' | t }}</p>
                  } @else if (errorFechas()) {
                    <p class="rs-field-error">{{ errorFechas() | t }}</p>
                  }
                </div>
                <div class="rs-field">
                  <label class="rs-lbl" for="pl-presupuesto">{{ 'Presupuesto máximo (€, opcional)' | t }}</label>
                  <input id="pl-presupuesto" type="number" min="1" class="rs-inp" formControlName="presupuesto" inputmode="numeric" />
                  <p class="pl-ayuda">{{ 'Descarta servicios más caros y te avisa si la estimación lo supera.' | t }}</p>
                </div>
                @if (perros().length) {
                  <div class="rs-field">
                    <label class="rs-lbl" for="pl-perro">{{ '¿Con quién viajas?' | t }}</label>
                    <select id="pl-perro" class="rs-inp" formControlName="perroId">
                      <option value="">{{ 'Sin especificar' | t }}</option>
                      @for (p of perros(); track p._id) {
                        <option [value]="p._id">{{ p.nombre }}</option>
                      }
                    </select>
                  </div>
                }
              </div>
            </fieldset>

            <fieldset class="pl-grupo">
              <legend>{{ '¿Qué os apetece hacer?' | t }}</legend>
              <div class="pl-chips">
                @for (i of intereses; track i.valor) {
                  <button type="button" class="pl-chip" [class.is-on]="interesesElegidos().includes(i.valor)"
                          [attr.aria-pressed]="interesesElegidos().includes(i.valor)" (click)="alternarInteres(i.valor)">
                    {{ i.etiqueta | t }}
                  </button>
                }
              </div>
            </fieldset>

            <fieldset class="pl-grupo">
              <legend>{{ '¿A qué ritmo?' | t }}</legend>
              <div class="pl-chips">
                @for (r of ritmos; track r.valor) {
                  <label class="pl-chip" [class.is-on]="form.controls.ritmo.value === r.valor">
                    <input type="radio" formControlName="ritmo" [value]="r.valor" class="rs-sr-only" />
                    {{ r.etiqueta | t }}
                  </label>
                }
              </div>
            </fieldset>

            <div class="pl-grupo pl-grupo--doble">
              <div>
                <p class="pl-leyenda">{{ '¿Dónde dormiréis?' | t }}</p>
                <div class="pl-chips">
                  @for (a of alojamientos; track a.valor) {
                    <label class="pl-chip" [class.is-on]="form.controls.alojamiento.value === a.valor">
                      <input type="radio" formControlName="alojamiento" [value]="a.valor" class="rs-sr-only" />
                      {{ a.etiqueta | t }}
                    </label>
                  }
                </div>
              </div>
              <div>
                <p class="pl-leyenda">{{ '¿Cómo llegáis?' | t }}</p>
                <div class="pl-chips">
                  @for (d of desplazamientos; track d.valor) {
                    <label class="pl-chip" [class.is-on]="form.controls.desplazamiento.value === d.valor">
                      <input type="radio" formControlName="desplazamiento" [value]="d.valor" class="rs-sr-only" />
                      {{ d.etiqueta | t }}
                    </label>
                  }
                </div>
              </div>
            </div>

            <fieldset class="pl-grupo">
              <legend>{{ '¿Necesitaréis algún servicio durante el viaje?' | t }}</legend>
              <div class="pl-chips">
                @for (s of serviciosExtra; track s.valor) {
                  <button type="button" class="pl-chip" [class.is-on]="extrasElegidos().includes(s.valor)"
                          [attr.aria-pressed]="extrasElegidos().includes(s.valor)" (click)="alternarExtra(s.valor)">
                    {{ s.etiqueta | t }}
                  </button>
                }
              </div>
            </fieldset>
          </form>

          <button type="button" class="rs-btn rs-btn--gold rs-btn--lg"
                  [disabled]="generando()" (click)="generar()">
            <rs-icon name="sparkles" [size]="18" [stroke]="2"></rs-icon>
            {{ (generando() ? 'Preparando tu viaje…' : 'Generar itinerario') | t }}
          </button>

          @if (error()) { <div class="rs-alert rs-alert--error">{{ error() | t }}</div> }
        </div>

        @if (itinerario(); as it) {
          @if (it.avisoAlojamiento) {
            <div class="rs-alert rs-alert--warning pl-alerta" role="status">{{ it.avisoAlojamiento }}</div>
          }
          @if (it.aviso) {
            <!--
              Nota informativa, no advertencia. El icono era el de alerta y el
              texto anunciaba una avería del asistente: el usuario leía que el
              planificador no funcionaba mientras tenía debajo el itinerario
              completo. Lo que dice ahora es de dónde salen las paradas.
            -->
            <p class="pl-aviso">
              <rs-icon name="badge-check" [size]="14" [stroke]="2"></rs-icon> {{ it.aviso }}
            </p>
          }

          <div class="pl-opciones">
            @for (o of it.opciones; track o.nombre) {
              <article class="pl-opcion rs-card">
                <header>
                  <h3>{{ o.nombre }}</h3>
                  <p>{{ o.resumen }}</p>
                  <!--
                    Bloqueo del cliente (octubre): el importe se leía como el
                    coste del viaje aunque no hubiera fechas. Ahora las fechas
                    son obligatorias y la cifra se rotula como estimación, con
                    lo que incluye.
                  -->
                  @if (o.presupuestoEstimado) {
                    <div class="pl-estimacion">
                      <span class="pl-presupuesto">
                        {{ 'Estimación orientativa' | t }}: {{ o.presupuestoEstimado | euros }}
                      </span>
                      @if (o.superaPresupuesto) {
                        <span class="rs-badge rs-badge--warning">{{ 'Supera tu presupuesto' | t }}</span>
                      }
                      <small>
                        @if (o.noches) {
                          {{ '{n} noches de hotel y una vez cada servicio, a precio «desde». El precio final se confirma al reservar.' | t: { n: o.noches } }}
                        } @else {
                          {{ 'Una vez cada servicio, a precio «desde». El precio final se confirma al reservar.' | t }}
                        }
                      </small>
                    </div>
                  }
                </header>

                @for (d of o.dias; track d.dia) {
                  <section class="pl-dia">
                    <h4><span class="pl-dia__num">{{ d.dia }}</span> {{ d.titulo }}</h4>
                    <ul>
                      @for (p of d.paradas; track p.titulo) {
                        <li class="pl-parada">
                          <div>
                            <strong>{{ p.titulo }}</strong>
                            <em>{{ p.descripcion }}</em>
                            @if (p.servicioId && p.precioEstimado) {
                              <span class="pl-precio">{{ precioOrientativo(p) | t: { precio: (p.precioEstimado | euros) } }}</span>
                            }
                          </div>
                          @if (p.servicioId) {
                            <a class="rs-btn rs-btn--primary rs-btn--sm" [routerLink]="enlace(p)">{{ 'Reservar' | t }}</a>
                          } @else if (p.lugarId) {
                            <a [routerLink]="['/explora', p.lugarId]" class="rs-btn rs-btn--ghost rs-btn--sm">
                              {{ 'Ver sitio' | t }}
                            </a>
                          }
                        </li>
                      }
                    </ul>
                  </section>
                }
              </article>
            }
          </div>

          <!--
            El plan termina en la plataforma (observación del cliente 28-09): lo
            reservable del itinerario, junto, con su botón de reservar y la
            opción de pasarlo todo al carrito de un clic.
          -->
          @if (it.serviciosSugeridos?.length) {
            <section class="pl-reserva rs-card" aria-labelledby="pl-reserva-titulo">
              <header class="pl-reserva__cab">
                <div>
                  <h3 id="pl-reserva-titulo">{{ 'Reserva tu viaje' | t }}</h3>
                  <p>{{ 'Todo lo que tu plan necesita, con profesionales verificados de la zona.' | t }}</p>
                </div>
                <button type="button" class="rs-btn rs-btn--gold"
                        [disabled]="!!anadiendo() || todoAnadido(it.serviciosSugeridos!)"
                        (click)="anadirTodo(it.serviciosSugeridos!)">
                  <rs-icon name="plus" [size]="16" [stroke]="2.5"></rs-icon>
                  {{ (todoAnadido(it.serviciosSugeridos!) ? 'Todo en tu viaje' : 'Añadir todo al viaje') | t }}
                </button>
              </header>
              <ul class="pl-reserva__lista">
                @for (s of it.serviciosSugeridos; track s.servicioId) {
                  <li class="pl-parada">
                    <div>
                      <strong>{{ s.titulo }}</strong>
                      <em>
                        {{ etiquetaVertical(s.vertical) | t }}
                        @if (s.precioEstimado) { · {{ precioOrientativo(s) | t: { precio: (s.precioEstimado | euros) } }} }
                      </em>
                    </div>
                    <div class="pl-parada__acciones">
                      <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                              [disabled]="anadiendo() === s.servicioId || anadidos().includes(s.servicioId!)"
                              (click)="anadir(s)">
                        @if (anadidos().includes(s.servicioId!)) {
                          <rs-icon name="check" [size]="13" [stroke]="3"></rs-icon> {{ 'En tu viaje' | t }}
                        } @else if (anadiendo() === s.servicioId) { {{ 'Añadiendo…' | t }} }
                        @else { {{ 'Añadir al viaje' | t }} }
                      </button>
                      <a class="rs-btn rs-btn--primary rs-btn--sm" [routerLink]="enlace(s)">{{ 'Reservar' | t }}</a>
                    </div>
                  </li>
                }
              </ul>
            </section>
          }
        }
      }
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .pl-page { min-height: 100vh; min-height: 100dvh; background: var(--c-base); }

    .pl-head { margin-bottom: var(--sp-6); max-width: 64ch; }
    .pl-eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .pl-head h1 { font-size: var(--f-3xl); color: var(--dk-blue); letter-spacing: -.02em; }
    .pl-sub { color: var(--t-400); margin-top: var(--sp-2); font-size: var(--f-md); line-height: 1.6; }

    .pl-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4);
      @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 560px) { grid-template-columns: 1fr; }
    }

    .pl-card {
      position: relative; aspect-ratio: 4/3; overflow: hidden;
      width: 100%; min-width: 0; min-height: 0;
      border: none; border-radius: var(--r-xl); cursor: pointer; padding: 0;
      /* Ancho explícito y foto fuera del flujo: sin ancho definido Safari/iOS
         no sabe de qué alto colgar la proporción y deja que la imagen imponga
         su tamaño natural (ver ".ec__img" en experiencias-cerca). */
      img {
        position: absolute; inset: 0;
        width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4);
      }
      &:hover img { transform: scale(1.06); }
      @media (prefers-reduced-motion: reduce) { &:hover img { transform: none; } }
    }
    .pl-card__veil {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(0,19,93,0) 45%, rgba(0,19,93,.75) 100%);
    }
    .pl-card__nombre {
      position: absolute; left: var(--sp-4); bottom: var(--sp-4);
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
      font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-7); color: #fff;
      small { font-family: var(--font); font-size: var(--f-xs); font-weight: var(--w-5); opacity: .9; }
    }

    .pl-grupo {
      border: 0; padding: 0; margin: 0 0 var(--sp-5);
      legend, .pl-leyenda { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-3); }
    }
    .pl-grupo--doble {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: var(--sp-5);
    }
    .pl-chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .pl-chip {
      display: inline-flex; align-items: center;
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-300); cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6);
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);
      &:hover { border-color: var(--c-accent); }
      &:focus-within, &:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
      &.is-on { background: var(--dk-blue); border-color: var(--dk-blue); color: var(--c-card); }
    }

    .pl-reserva { padding: var(--sp-6); margin-top: var(--sp-6); border: 2px solid var(--dk-gold); }
    .pl-reserva__cab {
      display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4);
      flex-wrap: wrap; margin-bottom: var(--sp-4);
      h3 { font-size: var(--f-xl); color: var(--dk-blue); }
      p { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-1); }
    }
    .pl-reserva__lista { list-style: none; display: flex; flex-direction: column; gap: var(--sp-2); }
    .pl-parada__acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; justify-content: flex-end; flex: none; }

    .pl-form { padding: var(--sp-6); margin-bottom: var(--sp-6); }
    .pl-form__cabecera {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-4); flex-wrap: wrap; margin-bottom: var(--sp-4);
      h2 { font-size: var(--f-xl); color: var(--dk-blue); }
    }
    .pl-form__campos {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--sp-4); margin-bottom: var(--sp-5);
    }

    .pl-aviso {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-bottom: var(--sp-4); font-size: var(--f-sm); color: var(--t-400);
    }

    .pl-opciones {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: var(--sp-5);
    }
    .pl-opcion {
      padding: var(--sp-6);
      header { margin-bottom: var(--sp-5); }
      h3 { font-size: var(--f-lg); color: var(--dk-blue); }
      header p { color: var(--t-400); font-size: var(--f-sm); margin-top: var(--sp-1); line-height: 1.55; }
    }
    .pl-buscar { padding: var(--sp-5); margin-bottom: var(--sp-5); }
    .pl-buscar__fila {
      display: flex; gap: var(--sp-3); flex-wrap: wrap; margin-top: var(--sp-2);
      .rs-inp { flex: 1 1 240px; }
    }
    .pl-alerta { margin-bottom: var(--sp-4); }
    .pl-ayuda { font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-1); }
    .pl-precio { display: block; font-size: var(--f-xs); color: var(--dk-blue); font-weight: var(--w-6); margin-top: var(--sp-1); }
    .pl-estimacion {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); margin-top: var(--sp-3);
      small { flex-basis: 100%; font-size: var(--f-xs); color: var(--t-400); line-height: 1.5; }
    }
    .pl-presupuesto {
      display: inline-block;
      padding: 2px var(--sp-3); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-size: var(--f-xs); font-weight: var(--w-6);
    }

    .pl-dia { margin-bottom: var(--sp-5); }
    .pl-dia h4 {
      display: flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-md); color: var(--t-100); margin-bottom: var(--sp-3);
    }
    .pl-dia__num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--dk-blue); color: #fff; font-size: var(--f-xs); font-weight: var(--w-7);
    }
    .pl-dia ul { list-style: none; display: flex; flex-direction: column; gap: var(--sp-2); }

    .pl-parada {
      display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3);
      padding: var(--sp-3);
      border: 1px solid var(--b-1); border-radius: var(--r-md);
      strong { display: block; font-size: var(--f-sm); color: var(--t-100); }
      em { font-style: normal; font-size: var(--f-xs); color: var(--t-400); line-height: 1.5; }
    }
  `],
})
export class PlanificadorComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly carritoService = inject(CarritoService);
  private readonly perrosService = inject(PerrosService);
  private readonly seo = inject(SeoService);

  readonly intereses = opciones(TIPO_LUGAR_LABELS);
  readonly ritmos = opciones(RITMO_VIAJE_LABELS);
  readonly alojamientos = opciones(ALOJAMIENTO_VIAJE_LABELS);
  readonly desplazamientos = opciones(DESPLAZAMIENTO_VIAJE_LABELS);
  readonly serviciosExtra = SERVICIOS_EXTRA_VIAJE.map((valor) => ({ valor, etiqueta: VERTICAL_LABELS[valor] }));
  readonly sugerencias = SUGERENCIAS_DESTINO;
  /** Hoy en Madrid: mínimo de los campos de fecha. */
  readonly hoy = claveDiaEnZona(new Date());

  readonly destinos = signal<Destino[]>(this.aDestinos(DESTINOS_POR_DEFECTO));
  /** Destino confirmado («Dénia (Alicante)»); vacío = pantalla de elegir destino. */
  readonly destino = signal('');
  readonly errorDestino = signal('');
  readonly itinerario = signal<ItinerarioApi | null>(null);
  readonly generando = signal(false);
  readonly error = signal('');
  readonly perros = signal<PerroApi[]>([]);
  readonly anadiendo = signal<string | null>(null);
  readonly anadidos = signal<string[]>([]);
  readonly interesesElegidos = signal<TipoLugar[]>([]);
  readonly extrasElegidos = signal<VerticalKey[]>([]);

  readonly form = new FormGroup({
    destino: new FormControl('', { nonNullable: true }),
    desde: new FormControl('', { nonNullable: true, validators: Validators.required }),
    hasta: new FormControl('', { nonNullable: true, validators: Validators.required }),
    presupuesto: new FormControl<number | null>(null, { validators: Validators.min(1) }),
    perroId: new FormControl('', { nonNullable: true }),
    ritmo: new FormControl<RitmoViaje>(RitmoViaje.EQUILIBRADO, { nonNullable: true }),
    alojamiento: new FormControl<AlojamientoViaje>(AlojamientoViaje.NECESITO, { nonNullable: true }),
    desplazamiento: new FormControl<DesplazamientoViaje>(DesplazamientoViaje.COCHE_PROPIO, { nonNullable: true }),
  }, { validators: fechasDelViaje });

  async ngOnInit(): Promise<void> {
    // Es una página pública más: sin esto se quedaba con el título y la
    // descripción genéricos de la portada, que es justo lo que corrige SEO-1.
    this.seo.aplicar(seoCategoria({
      label: 'Planifica una escapada con tu perro',
      descripcion: 'Arma el viaje de principio a fin: dónde dormir, dónde parar y qué servicios '
        + 'necesita tu perro por el camino.',
      ruta: '/explora/planificador',
    }));

    await Promise.all([this.cargarDestinos(), this.cargarPerros()]);
  }

  /** Provincias con contenido de verdad; sin respuesta se quedan las de Explora. */
  private async cargarDestinos(): Promise<void> {
    try {
      const destinos = await firstValueFrom(
        this.http.get<DestinoApi[]>(`${environment.apiUrl}/planificador/destinos`),
      );
      if (destinos.length) this.destinos.set(this.aDestinos(destinos));
    } catch {
      // Se quedan los destinos por defecto.
    }
  }

  private async cargarPerros(): Promise<void> {
    try {
      this.perros.set(await this.perrosService.misPerros());
    } catch {
      // Sin sesión el planificador funciona igual, solo sin personalizar.
    }
  }

  private aDestinos(destinos: readonly DestinoApi[]): Destino[] {
    return destinos.map((d, i) => ({
      nombre: d.provincia,
      imagen: FOTOS_DESTINO[i % FOTOS_DESTINO.length],
      lugares: d.lugares,
    }));
  }

  /** Tarjeta de destino: equivale a escribirlo y continuar. */
  elegir(destino: string): void {
    this.form.controls.destino.setValue(destino);
    this.continuar();
  }

  /** Confirma el destino escrito; cualquier población vale, no sólo las sugeridas. */
  continuar(): boolean {
    const resuelto = resolverDestinoViaje(this.form.controls.destino.value);
    if (!resuelto) {
      this.errorDestino.set('Escribe a dónde queréis viajar');
      return false;
    }
    this.errorDestino.set('');
    this.form.controls.destino.setValue(resuelto.etiqueta);
    if (resuelto.etiqueta !== this.destino()) this.itinerario.set(null);
    this.destino.set(resuelto.etiqueta);
    this.error.set('');
    return true;
  }

  volver(): void {
    this.destino.set('');
    this.form.controls.destino.setValue('');
    this.itinerario.set(null);
    this.errorDestino.set('');
  }

  campoInvalido(campo: 'desde' | 'hasta'): boolean {
    const control = this.form.controls[campo];
    return control.touched && control.hasError('required');
  }

  /** Motivo por el que las fechas no valen (pasadas, al revés…), si lo hay. */
  errorFechas(): string {
    return (this.form.errors?.['fechas'] as string | undefined) ?? '';
  }

  /** Los precios de las fichas son «desde»: en hoteles, por noche. Nunca el coste del viaje. */
  precioOrientativo(parada: ParadaApi): string {
    return parada.vertical === VERTICAL_ALOJAMIENTO_VIAJE
      ? 'Desde {precio} la noche (orientativo)'
      : 'Desde {precio} (orientativo)';
  }

  alternarInteres(tipo: TipoLugar): void {
    this.interesesElegidos.update((lista) => alternar(lista, tipo));
  }

  alternarExtra(vertical: VerticalKey): void {
    this.extrasElegidos.update((lista) => alternar(lista, vertical));
  }

  etiquetaVertical(vertical?: string): string {
    return vertical ? VERTICAL_LABELS[vertical as VerticalKey] ?? '' : '';
  }

  /** Ficha del servicio, donde se elige fecha o cita y se reserva. */
  enlace(parada: ParadaApi): unknown[] {
    return enlaceAServicio(parada.vertical, parada.servicioId ?? '');
  }

  todoAnadido(paradas: readonly ParadaApi[]): boolean {
    return paradas.every((p) => !p.servicioId || this.anadidos().includes(p.servicioId));
  }

  async generar(): Promise<void> {
    this.form.markAllAsTouched();
    if (!this.continuar()) return;
    if (this.form.invalid) {
      this.error.set(this.errorFechas() || 'Indica las fechas de ida y vuelta del viaje');
      return;
    }

    this.generando.set(true);
    this.error.set('');
    try {
      this.itinerario.set(
        await firstValueFrom(
          this.http.post<ItinerarioApi>(`${environment.apiUrl}/planificador/itinerario`, this.peticion()),
        ),
      );
    } catch (e) {
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(mensaje ?? 'No hemos podido preparar el itinerario. Vuelve a intentarlo.');
    } finally {
      this.generando.set(false);
    }
  }

  /** Cuerpo de la petición: lo vacío no viaja, para que el API aplique sus valores por defecto. */
  private peticion(): Record<string, unknown> {
    const f = this.form.getRawValue();
    return {
      destino: this.destino(),
      desde: f.desde,
      hasta: f.hasta,
      presupuestoMax: f.presupuesto || undefined,
      perroId: f.perroId || undefined,
      intereses: this.interesesElegidos().length ? this.interesesElegidos() : undefined,
      ritmo: f.ritmo,
      alojamiento: f.alojamiento,
      desplazamiento: f.desplazamiento,
      serviciosExtra: this.extrasElegidos().length ? this.extrasElegidos() : undefined,
    };
  }

  /** Vuelca la parada al carrito: es lo que convierte el plan en reservas. */
  async anadir(parada: ParadaApi): Promise<void> {
    if (!parada.servicioId || !parada.vertical) return;

    const { desde, hasta } = this.form.getRawValue();
    // Sólo el hotel ocupa del día de ida al de vuelta; el resto es una cita.
    const esHotel = parada.vertical === VERTICAL_ALOJAMIENTO_VIAJE;
    this.anadiendo.set(parada.servicioId);
    this.error.set('');
    try {
      // Sin `comercioId`: lo deduce el backend del propio servicio.
      await this.carritoService.anadir({
        servicioId: parada.servicioId,
        vertical: parada.vertical as VerticalKey,
        fechaInicio: desde || this.hoy,
        fechaFin: esHotel ? hasta || undefined : undefined,
      });
      this.anadidos.update((lista) => [...lista, parada.servicioId!]);
    } catch (e) {
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(mensaje ?? `No se pudo añadir ${parada.titulo} a tu viaje.`);
    } finally {
      this.anadiendo.set(null);
    }
  }

  /** Todo lo reservable del plan al carrito, de uno en uno para poder nombrar el que falle. */
  async anadirTodo(paradas: readonly ParadaApi[]): Promise<void> {
    for (const parada of paradas) {
      if (!parada.servicioId || this.anadidos().includes(parada.servicioId)) continue;
      await this.anadir(parada);
      if (this.error()) return;
    }
  }
}

function alternar<T>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}
