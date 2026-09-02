import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../shared/pipes/euros.pipe';
import {
  COMPARATIVA, PLANES, Plan, esPlanActual, planDeComercio,
} from '../../shared/catalogos/planes.catalogo';
import { ComercioApiService, MiComercio } from './comercio-api.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/** Cuántos beneficios se ven en el móvil antes de pedir "ver todos". */
const BENEFICIOS_EN_MOVIL = 4;

/** Buzón al que llega la solicitud de mejora de plan. */
const CORREO_SUSCRIPCIONES = 'soporte@doogking.com';

@Component({
  selector: 'app-comercio-suscripcion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TraducirPipe, RsIconComponent, EurosPipe
  ],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ 'Tu plan Doogking' | t }}</h1>
        <p class="page-sub">{{ 'Publica tu negocio gratis y mejora tu visibilidad cuando estés listo.' | t }}</p>
      </div>
    </div>

    @if (cargando()) {
      <div class="rs-card" style="padding:var(--sp-8);text-align:center;color:var(--t-400)">{{ 'Cargando…' | t }}</div>
    } @else {

    <div class="planes">
      @for (plan of planes; track plan.clave) {
        <section class="plan" [class.plan--destacado]="plan.recomendado">
          @if (plan.recomendado) {
            <span class="plan__cinta"><rs-icon name="star" [size]="12" [stroke]="2.5"></rs-icon> {{ 'Recomendado' | t }}</span>
          }

          <header class="plan__head">
            <span class="plan__icono" [class.plan__icono--oro]="plan.recomendado">
              <rs-icon [name]="plan.icono" [size]="26" [stroke]="1.75"></rs-icon>
            </span>
            <div>
              <h2 class="plan__nombre">{{ plan.nombre }}</h2>
              <p class="plan__gancho">{{ plan.gancho }}</p>
            </div>
          </header>

          <p class="plan__precio">
            <strong>{{ plan.precioMensual | euros }}</strong>
            <span>/ mes</span>

            @if (esActual(plan)) {
              <span class="plan__actual">
                {{ 'Tu plan actual' | t }} <rs-icon name="check" [size]="13" [stroke]="3"></rs-icon>
              </span>
            }
          </p>

          <ul class="plan__lista">
            @if (plan.incluye) {
              <li class="plan__hereda">Todo lo incluido en el {{ nombreDe(plan.incluye) }}, más:</li>
            }
            @for (b of beneficiosDe(plan); track b) {
              <li>
                <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon>
                <span>{{ b }}</span>
              </li>
            }
          </ul>

          <!-- En el móvil la lista completa del Pro son diez líneas: se recorta
               y se despliega a petición para no alargar la pantalla. -->
          @if (tieneMasBeneficios(plan)) {
            <button type="button" class="plan__mas" (click)="verTodos.set(true)">
              {{ 'Ver todos los beneficios' | t }}
              <rs-icon name="arrow-right" [size]="14" [stroke]="2"></rs-icon>
            </button>
          }

          @if (!esActual(plan)) {
            <a class="rs-btn rs-btn--primary rs-btn--block plan__cta" [href]="enlaceMejora(plan)">
              Mejorar a {{ plan.nombre }}
            </a>
            <p class="plan__nota">
              <rs-icon name="shield-check" [size]="13" [stroke]="2"></rs-icon>
              {{ 'Cancela o cambia tu plan cuando quieras.' | t }}
            </p>
          }
        </section>
      }
    </div>

    <section class="cmp">
      <h2 class="cmp__titulo">{{ 'Compara todos los beneficios' | t }}</h2>

      <div class="cmp__caja" [class.cmp__caja--abierta]="comparativaAbierta()">
        <table class="cmp__tabla">
          <thead>
            <tr>
              <th scope="col">{{ 'Beneficios' | t }}</th>
              @for (plan of planes; track plan.clave) {
                <th scope="col" [class.cmp__col--pro]="plan.recomendado">
                  <span class="cmp__plan">
                    @if (plan.recomendado) { <rs-icon name="crown" [size]="13" [stroke]="2"></rs-icon> }
                    {{ etiquetaCorta(plan) }}
                  </span>
                  <small>{{ plan.precioMensual ? (plan.precioMensual | euros) + '/mes' : 'Gratis' }}</small>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (fila of comparativa; track fila.concepto) {
              <tr>
                <th scope="row">
                  <rs-icon [name]="fila.icono" [size]="15" [stroke]="2"></rs-icon>
                  {{ fila.concepto }}
                </th>
                <td>
                  @if (fila.basico === true) {
                    <rs-icon name="check" [size]="15" [stroke]="2.5" class="cmp__si"></rs-icon>
                  } @else if (fila.basico === false) {
                    <span class="cmp__no" [attr.aria-label]="'No incluido' | t">—</span>
                  } @else {
                    {{ fila.basico }}
                  }
                </td>
                <td class="cmp__col--pro">
                  @if (fila.pro === true) {
                    <rs-icon name="check" [size]="15" [stroke]="2.5" class="cmp__si"></rs-icon>
                  } @else if (fila.pro === false) {
                    <span class="cmp__no" [attr.aria-label]="'No incluido' | t">—</span>
                  } @else {
                    {{ fila.pro }}
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Sólo en móvil: en escritorio la tabla cabe entera y el botón sobra. -->
      <button type="button" class="cmp__toggle"
              [attr.aria-expanded]="comparativaAbierta()"
              (click)="comparativaAbierta.set(!comparativaAbierta())">
        {{ comparativaAbierta() ? 'Ocultar la comparación' : 'Ver comparación completa' }}
        <rs-icon [name]="comparativaAbierta() ? 'chevron-down' : 'arrow-right'" [size]="14" [stroke]="2"></rs-icon>
      </button>
    </section>
    }
  `,
  styles: [`
    :host { display: block; }

    .page-header { margin-bottom: var(--sp-6); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .page-sub { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-1); }

    /* ══ TARJETAS DE PLAN ══════════════════════════════════════════════
       Dos columnas en escritorio; apiladas en móvil, con el plan actual
       arriba para que se lea antes lo que ya se tiene. */
    .planes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--sp-5);
      align-items: start;

      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .plan {
      position: relative;
      padding: var(--sp-6);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-2xl);
    }

    /* El Pro es el que se quiere mirar: borde dorado y fondo cálido. */
    .plan--destacado {
      border-color: var(--dk-gold);
      background: rgba(251,174,23,.04);
      box-shadow: var(--sh-lg);
    }

    .plan__cinta {
      position: absolute; top: calc(-1 * var(--sp-3)); right: var(--sp-5);
      display: inline-flex; align-items: center; gap: var(--sp-1);
      padding: var(--sp-1) var(--sp-3);
      background: var(--dk-gold); color: var(--dk-blue-deep);
      border-radius: var(--r-full);
      font-family: var(--font-accent);
      font-size: 10px; font-weight: var(--w-7);
      letter-spacing: .08em; text-transform: uppercase;
    }

    .plan__head { display: flex; align-items: flex-start; gap: var(--sp-4); margin-bottom: var(--sp-5); }

    .plan__icono {
      display: inline-flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; flex-shrink: 0;
      border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--c-accent);
    }
    .plan__icono--oro { background: rgba(251,174,23,.18); color: var(--dk-gold); }

    .plan__nombre { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
    .plan__gancho { font-size: var(--f-sm); color: var(--t-400); margin-top: var(--sp-1); line-height: 1.5; }

    .plan__precio {
      display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--sp-2);
      padding-bottom: var(--sp-5);
      border-bottom: 1px solid var(--b-1);
      margin-bottom: var(--sp-5);

      strong { font-size: var(--f-4xl); font-weight: var(--w-9); color: var(--dk-blue); letter-spacing: -.03em; }
      span { font-size: var(--f-md); color: var(--t-400); }
    }

    .plan__actual {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      margin-left: auto; align-self: center;
      padding: var(--sp-1) var(--sp-3);
      background: var(--c-accent-lo); color: var(--dk-blue);
      border-radius: var(--r-full);
      font-size: var(--f-xs) !important; font-weight: var(--w-7);
    }

    .plan__lista { list-style: none; display: flex; flex-direction: column; gap: var(--sp-3); }
    .plan__lista li {
      display: flex; align-items: flex-start; gap: var(--sp-3);
      font-size: var(--f-sm); color: var(--t-200); line-height: 1.45;

      rs-icon { flex-shrink: 0; margin-top: 1px; color: var(--dk-gold); }
    }
    .plan__hereda { font-weight: var(--w-7); color: var(--t-100); }

    .plan__mas {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-4); padding: 0;
      background: none; border: none; cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--c-accent);
    }

    .plan__cta { margin-top: var(--sp-6); }

    .plan__nota {
      display: flex; align-items: center; justify-content: center; gap: var(--sp-2);
      margin-top: var(--sp-3);
      font-size: var(--f-xs); color: var(--t-400);
    }

    /* ══ COMPARATIVA ═══════════════════════════════════════════════════ */
    .cmp { margin-top: var(--sp-10); }
    .cmp__titulo { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-4); }

    /* La tabla se sale en pantallas estrechas: rueda dentro de su caja en vez
       de empujar el ancho de la página. */
    .cmp__caja { overflow-x: auto; border: 1px solid var(--b-1); border-radius: var(--r-xl); }

    .cmp__tabla { width: 100%; border-collapse: collapse; font-size: var(--f-sm); }

    .cmp__tabla th, .cmp__tabla td {
      padding: var(--sp-3) var(--sp-4);
      text-align: center;
      border-bottom: 1px solid var(--b-1);
      color: var(--t-300);
    }
    .cmp__tabla tbody tr:last-child th,
    .cmp__tabla tbody tr:last-child td { border-bottom: none; }

    .cmp__tabla thead th { background: var(--c-raised); color: var(--t-100); font-weight: var(--w-7); }

    .cmp__tabla th[scope='row'] {
      display: flex; align-items: center; gap: var(--sp-2);
      text-align: left; font-weight: var(--w-5); color: var(--t-200);

      rs-icon { color: var(--t-400); flex-shrink: 0; }
    }

    .cmp__plan {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-1);
      font-family: var(--font-accent); letter-spacing: .06em; text-transform: uppercase;
      font-size: var(--f-xs);
    }
    .cmp__tabla thead small { display: block; font-weight: var(--w-4); color: var(--t-400); font-size: 11px; }

    .cmp__col--pro { background: rgba(251,174,23,.06); }
    .cmp__tabla thead .cmp__col--pro rs-icon { color: var(--dk-gold); }

    .cmp__si { color: var(--c-teal, var(--dk-blue)); }
    .cmp__no { color: var(--t-500); }

    .cmp__toggle {
      display: none;
      align-items: center; justify-content: center; gap: var(--sp-2);
      width: 100%; margin-top: var(--sp-3); padding: var(--sp-3);
      background: none; border: none; cursor: pointer;
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--c-accent);
    }

    /* En móvil la tabla arranca plegada: la pantalla ya trae dos tarjetas. */
    @media (max-width: 767px) {
      .cmp__caja { display: none; }
      .cmp__caja--abierta { display: block; }
      .cmp__toggle { display: flex; }
    }
  `],
})
export class ComercioSuscripcionComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);

  readonly planes = PLANES;
  readonly comparativa = COMPARATIVA;

  readonly cargando = signal(true);
  readonly comercio = signal<MiComercio | null>(null);

  /** Despliega la lista completa de beneficios en el móvil. */
  readonly verTodos = signal(false);
  readonly comparativaAbierta = signal(false);

  /** Plan contratado; un `premium` antiguo cuenta como Pro. */
  readonly planActual = computed(() => planDeComercio(this.comercio()?.plan));

  async ngOnInit(): Promise<void> {
    try {
      this.comercio.set(await firstValueFrom(this.comercioApi.getMiComercio()));
    } catch {
      // Sin la ficha no se sabe qué plan tiene, pero los planes se pueden
      // seguir consultando: es información pública del producto.
    } finally {
      this.cargando.set(false);
    }
  }

  esActual(plan: Plan): boolean {
    return esPlanActual(plan, this.comercio()?.plan);
  }

  nombreDe(clave: string): string {
    return PLANES.find((p) => p.clave === clave)?.nombre ?? clave;
  }

  /** `Plan Pro` → `PRO`, para la cabecera de la comparativa. */
  etiquetaCorta(plan: Plan): string {
    return plan.nombre.replace(/^Plan\s+/i, '');
  }

  /**
   * Beneficios que se pintan. En el móvil la lista del Pro son diez líneas y
   * la pantalla se hacía interminable, así que se recorta hasta que el comercio
   * pide verlos todos. La CSS no vale aquí: hay que saber si sobran para
   * decidir si se enseña el botón.
   */
  beneficiosDe(plan: Plan): readonly string[] {
    if (this.verTodos() || !this.esMovil()) return plan.beneficios;
    return plan.beneficios.slice(0, BENEFICIOS_EN_MOVIL);
  }

  tieneMasBeneficios(plan: Plan): boolean {
    return this.beneficiosDe(plan).length < plan.beneficios.length;
  }

  /**
   * Mientras no haya alta de suscripción en la plataforma, la mejora de plan se
   * pide por correo y la tramita el equipo. El botón lleva ahí en vez de a un
   * pago que todavía no existe.
   */
  enlaceMejora(plan: Plan): string {
    const asunto = encodeURIComponent(`Quiero mejorar a ${plan.nombre}`);
    const cuerpo = encodeURIComponent(
      `Hola:\n\nQuiero mejorar mi suscripción de Doogking a ${plan.nombre}.\n\n`
      + `Negocio: ${this.comercio()?.nombreComercial ?? ''}\n`,
    );
    return `mailto:${CORREO_SUSCRIPCIONES}?subject=${asunto}&body=${cuerpo}`;
  }

  /**
   * Se mira el ancho real y no un `input`: el corte de la lista tiene que
   * coincidir con el de la CSS, y duplicar el número en dos sitios acabaría
   * descuadrado. 900px es donde las tarjetas dejan de ir en dos columnas.
   */
  private esMovil(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 900;
  }
}
