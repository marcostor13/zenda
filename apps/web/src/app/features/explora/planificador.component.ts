import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { BRAND, HOTEL_IMAGES } from '../../shared/media/images';
import { CarritoService } from '../carrito/carrito.service';
import { PerroApi, PerrosService } from '../perros/perros.service';
import { environment } from '../../../environments/environment';

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
  presupuestoEstimado: number;
  dias: DiaApi[];
}

interface ItinerarioApi {
  provincia: string;
  opciones: OpcionApi[];
  esFallback: boolean;
  aviso?: string;
}

/** Provincias con contenido; entrada visual al planificador (patrón O2). */
const PROVINCIAS = [
  { nombre: 'Madrid', imagen: BRAND.heroHome },
  { nombre: 'Barcelona', imagen: HOTEL_IMAGES[3] },
  { nombre: 'Valencia', imagen: HOTEL_IMAGES[2] },
  { nombre: 'Cádiz', imagen: HOTEL_IMAGES[1] },
  { nombre: 'Asturias', imagen: HOTEL_IMAGES[4] },
  { nombre: 'Málaga', imagen: BRAND.heroDetalle },
];

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
    CurrencyPipe, FormsModule, RouterLink,
    RsNavbarComponent, RsIconComponent, ImgFallbackDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="pl-page">
  <rs-navbar />

  <section class="rs-section rs-section--sm">
    <div class="rs-wrap rs-wrap--2xl">
      <header class="pl-head">
        <p class="pl-eyebrow">Planificador de viajes</p>
        <h1>¿A dónde vais este año?</h1>
        <p class="pl-sub">
          Elige provincia y te proponemos un viaje completo con tu perro: dónde dormir,
          dónde pasear y qué reservar. Todo con sitios y profesionales que ya están en Doogking.
        </p>
      </header>

      @if (!provincia()) {
        <div class="pl-grid">
          @for (p of provincias; track p.nombre) {
            <button type="button" class="pl-card" (click)="elegir(p.nombre)">
              <img [src]="p.imagen" [alt]="p.nombre" loading="lazy" rsImg />
              <span class="pl-card__veil"></span>
              <span class="pl-card__nombre">{{ p.nombre }}</span>
            </button>
          }
        </div>
      } @else {
        <div class="pl-form rs-card">
          <div class="pl-form__cabecera">
            <h2>Tu viaje a {{ provincia() }}</h2>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="volver()">
              Cambiar provincia
            </button>
          </div>

          <div class="pl-form__campos">
            <div class="rs-field">
              <label class="rs-lbl" for="pl-desde">Desde</label>
              <input id="pl-desde" type="date" class="rs-inp" [(ngModel)]="desde" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="pl-hasta">Hasta</label>
              <input id="pl-hasta" type="date" class="rs-inp" [(ngModel)]="hasta" />
            </div>
            <div class="rs-field">
              <label class="rs-lbl" for="pl-presupuesto">Presupuesto (€)</label>
              <input id="pl-presupuesto" type="number" min="0" class="rs-inp" [(ngModel)]="presupuesto" />
            </div>
            @if (perros().length) {
              <div class="rs-field">
                <label class="rs-lbl" for="pl-perro">¿Con quién viajas?</label>
                <select id="pl-perro" class="rs-inp" [(ngModel)]="perroId">
                  <option value="">Sin especificar</option>
                  @for (p of perros(); track p._id) {
                    <option [value]="p._id">{{ p.nombre }}</option>
                  }
                </select>
              </div>
            }
          </div>

          <button type="button" class="rs-btn rs-btn--gold rs-btn--lg"
                  [disabled]="generando()" (click)="generar()">
            <rs-icon name="sparkles" [size]="18" [stroke]="2"></rs-icon>
            {{ generando() ? 'Preparando tu viaje…' : 'Generar itinerario' }}
          </button>

          @if (error()) { <div class="rs-alert rs-alert--error">{{ error() }}</div> }
        </div>

        @if (itinerario(); as it) {
          @if (it.aviso) {
            <p class="pl-aviso">
              <rs-icon name="alert-circle" [size]="14" [stroke]="2"></rs-icon> {{ it.aviso }}
            </p>
          }

          <div class="pl-opciones">
            @for (o of it.opciones; track o.nombre) {
              <article class="pl-opcion rs-card">
                <header>
                  <h3>{{ o.nombre }}</h3>
                  <p>{{ o.resumen }}</p>
                  @if (o.presupuestoEstimado) {
                    <span class="pl-presupuesto">Desde {{ o.presupuestoEstimado | currency: 'EUR' }}</span>
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
                          </div>
                          @if (p.servicioId) {
                            <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                                    [disabled]="anadiendo() === p.servicioId || anadidos().includes(p.servicioId)"
                                    (click)="anadir(p)">
                              @if (anadidos().includes(p.servicioId)) { <rs-icon name="check" [size]="13" [stroke]="3"></rs-icon> En tu viaje }
                              @else if (anadiendo() === p.servicioId) { Añadiendo… }
                              @else { Añadir al viaje }
                            </button>
                          } @else if (p.lugarId) {
                            <a [routerLink]="['/explora', p.lugarId]" class="rs-btn rs-btn--ghost rs-btn--sm">
                              Ver sitio
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
        }
      }
    </div>
  </section>
</div>
  `,
  styles: [`
    :host { display: block; }
    .pl-page { min-height: 100vh; background: var(--c-base); }

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
      border: none; border-radius: var(--r-xl); cursor: pointer; padding: 0;
      img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--d-4); }
      &:hover img { transform: scale(1.06); }
      @media (prefers-reduced-motion: reduce) { &:hover img { transform: none; } }
    }
    .pl-card__veil {
      position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(0,19,93,0) 45%, rgba(0,19,93,.75) 100%);
    }
    .pl-card__nombre {
      position: absolute; left: var(--sp-4); bottom: var(--sp-4);
      font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-7); color: #fff;
    }

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
      display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--sp-5);
    }
    .pl-opcion {
      padding: var(--sp-6);
      header { margin-bottom: var(--sp-5); }
      h3 { font-size: var(--f-lg); color: var(--dk-blue); }
      header p { color: var(--t-400); font-size: var(--f-sm); margin-top: var(--sp-1); line-height: 1.55; }
    }
    .pl-presupuesto {
      display: inline-block; margin-top: var(--sp-3);
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

  readonly provincias = PROVINCIAS;

  readonly provincia = signal('');
  readonly itinerario = signal<ItinerarioApi | null>(null);
  readonly generando = signal(false);
  readonly error = signal('');
  readonly perros = signal<PerroApi[]>([]);
  readonly anadiendo = signal<string | null>(null);
  readonly anadidos = signal<string[]>([]);

  desde = '';
  hasta = '';
  presupuesto: number | null = null;
  perroId = '';

  async ngOnInit(): Promise<void> {
    try {
      this.perros.set(await this.perrosService.misPerros());
    } catch {
      // Sin sesión el planificador funciona igual, solo sin personalizar.
    }
  }

  elegir(provincia: string): void {
    this.provincia.set(provincia);
    this.itinerario.set(null);
    this.error.set('');
  }

  volver(): void {
    this.provincia.set('');
    this.itinerario.set(null);
  }

  async generar(): Promise<void> {
    this.generando.set(true);
    this.error.set('');
    try {
      this.itinerario.set(
        await firstValueFrom(
          this.http.post<ItinerarioApi>(`${environment.apiUrl}/planificador/itinerario`, {
            provincia: this.provincia(),
            desde: this.desde || undefined,
            hasta: this.hasta || undefined,
            presupuestoMax: this.presupuesto ?? undefined,
            perroId: this.perroId || undefined,
          }),
        ),
      );
    } catch (e) {
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(mensaje ?? 'No hemos podido preparar el itinerario. Vuelve a intentarlo.');
    } finally {
      this.generando.set(false);
    }
  }

  /** Vuelca la parada al carrito: es lo que convierte el plan en reservas. */
  async anadir(parada: ParadaApi): Promise<void> {
    if (!parada.servicioId) return;

    this.anadiendo.set(parada.servicioId);
    this.error.set('');
    try {
      // Sin `comercioId`: lo deduce el backend del propio servicio.
      await this.carritoService.anadir({
        servicioId: parada.servicioId,
        vertical: (parada.vertical as VerticalKey) ?? VerticalKey.ALOJAMIENTO,
        fechaInicio: this.desde || new Date().toISOString().slice(0, 10),
        fechaFin: this.hasta || undefined,
      });
      this.anadidos.update((lista) => [...lista, parada.servicioId!]);
    } catch (e) {
      const mensaje = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(mensaje ?? `No se pudo añadir ${parada.titulo} a tu viaje.`);
    } finally {
      this.anadiendo.set(null);
    }
  }
}
